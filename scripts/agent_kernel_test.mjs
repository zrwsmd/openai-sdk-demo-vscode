// 编译产物级验证:加载 esbuild ESM 打包的 agent 内核 + 会话模块,对 mock 网关跑十个场景
// 前置: node scripts/mock_gateway.mjs 8790
// 运行: node scripts/agent_kernel_test.mjs
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentEventFactory,
  runAgent,
  setAgentLogger,
  JsonFileSession,
  extractChatMessages,
  MaxTurnsExceededError,
  MAX_TURNS,
} from './agent.testbundle.mjs';

// 捕获网关原始报文诊断(与插件里 "PLC Agent" 输出面板同源)
const diagLines = [];
setAgentLogger((line) => diagLines.push(line));

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-test-'));
const mockGatewayPort = process.env.MOCK_GATEWAY_PORT || '8790';
const cfg = {
  baseUrl: `http://127.0.0.1:${mockGatewayPort}/v1`,
  apiKey: 'mock-key',
  model: 'mock-model',
  exportDir: path.join(dir, 'exports'),
  workspaceRoot: dir,
};
const session = new JsonFileSession(path.join(dir, 'session.json'));
const noApproval = async (name) => {
  throw new Error(`不应触发审批,却收到 ${name}`);
};
let runSequence = 0;
async function runTestTurn(userText, decide) {
  const events = [];
  const runId = `kernel-${++runSequence}`;
  const factory = new AgentEventFactory(runId, runId);
  const protocol = {
    runId,
    operationId: runId,
    eventFactory: factory,
    onEvent: (event) => events.push(event),
  };
  let result = await runAgent(cfg, session, userText, { protocol });
  while (result.status === 'awaiting_approval') {
    if (!decide) throw new Error('测试遇到未处理的审批断点');
    const decisions = {};
    for (const approval of result.approvals || []) {
      decisions[approval.id] = await decide(approval.name, approval.args);
    }
    result = await runAgent(cfg, session, userText, {
      initialState: result.state,
      decisions,
      protocol,
    });
  }
  return { ...result, events };
}

// [1] 第一句问候 → mock 回显 msgs=2(系统提示+本句);usage 单次
{
  const r = await runTestTurn('你好', noApproval);
  const m = /\[msgs=(\d+)\]/.exec(r.output);
  console.log('[1] 问候:', r.output.slice(0, 16) + '…', '| msgs 回显 =', m?.[1], '| usage =', JSON.stringify(r.usage));
  if (!m || Number(m[1]) !== 2) throw new Error('场景1 msgs 不为 2');
  if (r.usage.requests !== 1 || r.usage.inputTokens !== 120) throw new Error('场景1 usage 不符合预期');
}

// [2] 同一会话第二句 → msgs 应包含第一句历史(系统+u1+a1+u2 = 4),证明 session 回放
{
  const r = await runTestTurn('记住,我叫张三', noApproval);
  const m = /\[msgs=(\d+)\]/.exec(r.output);
  console.log('[2] 第二句:msgs 回显 =', m?.[1], '(>2 即带上了历史)');
  if (!m || Number(m[1]) < 4) throw new Error('场景2 会话历史未回放');
}

// [3] 会话持久化文件 + 历史抽取
{
  const raw = JSON.parse(await fs.readFile(path.join(dir, 'session.json'), 'utf8'));
  const chat = extractChatMessages(await session.getItems());
  const has = (t) => chat.some((c) => c.text.includes(t));
  console.log('[3] session.json 条目 =', raw.items.length, '| 回放消息 =', chat.length, '| 含"张三" =', has('张三'));
  if (!raw.sessionId || !has('张三') || !has('你好')) throw new Error('场景3 持久化不完整');
}

// [4] 星三角工具链(无需审批):get_io_table → 最终 ST 代码
{
  const r = await runTestTurn('写一个电机星三角启动的 ST 程序,延时 5 秒切换', noApproval);
  const toolCalls = r.events.filter((e) => e.type === 'tool.started').map((e) => e.payload.toolName);
  console.log('[4] 工具链:', toolCalls.join(','), '| 含ST代码 =', r.output.includes('END_PROGRAM'), '| usage =', JSON.stringify(r.usage));
  if (r.usage.requests < 2 || !r.output.includes('END_PROGRAM')) throw new Error('场景4 工具链不符合预期');
}

// [5] needsApproval-允许:export_st_program 先弹审批 → 批准后文件落盘
{
  const asked = [];
  const capabilityLogStart = diagLines.length;
  const approveAll = async (name, args) => {
    asked.push({ name, args });
    return true;
  };
  const r = await runTestTurn('把上面的程序导出为文件', approveAll);
  const files = await fs.readdir(path.join(dir, 'exports'));
  console.log('[5] 审批(允许):asked =', JSON.stringify(asked.map((a) => a.name)), '| 落盘文件 =', files.join(','), '| 输出含确认 =', r.output.includes('导出'));
  if (asked.length !== 1 || asked[0].name !== 'export_st_program' || !asked[0].args.includes('PROGRAM'))
    throw new Error('场景5 审批请求参数不符合预期');
  if (!files.includes('StarDelta.st')) throw new Error('场景5 批准后未落盘');
  const capabilityRequests = diagLines
    .slice(capabilityLogStart)
    .filter((line) => line.includes('[req]'));
  if (!capabilityRequests.some((line) => line.includes('format=json_schema') && !line.includes('choice=-'))) {
    throw new Error('场景5 首次工具请求没有尝试 response_format + tool_choice');
  }
  if (!capabilityRequests.some((line) => line.includes('format=json_schema') && line.includes('choice=-'))) {
    throw new Error('场景5 工具完成后的最终请求没有恢复结构化输出');
  }
  if (process.env.MOCK_REJECT_COMBINED === '1'
    && !capabilityRequests.some((line) => line.includes('format=-') && !line.includes('choice=-'))) {
    throw new Error('场景5 网关组合能力冲突后没有降级工具请求');
  }
}

// [6] needsApproval-拒绝:不落盘
{
  const asked = [];
  const denyAll = async (name, args) => {
    asked.push({ name, args });
    return false;
  };
  const r = await runTestTurn('再次把程序导出为文件', denyAll);
  const files = await fs.readdir(path.join(dir, 'exports'));
  console.log('[6] 审批(拒绝):asked =', asked.map((a) => a.name).join(','), '| 状态 =', r.status, '| 落盘文件仍为 =', files.join(','));
  if (asked.length < 1 || files.length !== 1 || r.status !== 'refused') {
    throw new Error('场景6 拒绝后应返回 refused 且不产生新文件');
  }
}

// [7] 死循环 → maxTurns 截停(放最后:会往会话里灌 10 轮工具往返)
{
  let thrown = null;
  try {
    await runTestTurn('写一个循环测试程序', noApproval);
  } catch (e) {
    thrown = e;
  }
  console.log('[7] 死循环: 抛出 =', thrown?.constructor?.name, '| instanceof =', thrown instanceof MaxTurnsExceededError);
  if (!(thrown instanceof MaxTurnsExceededError)) throw new Error('场景7 未触发 MaxTurnsExceededError');
}

// [8] 新会话:clearSession 后文件清空
{
  await fs.writeFile(path.join(dir, 'lk.txt'), '你好', 'utf8');
  const capabilityLogStart = diagLines.length;
  const r = await runTestTurn('读取 lk.txt 文件里面的内容', noApproval);
  const toolCalls = r.events.filter((e) => e.type === 'tool.started').map((e) => e.payload.toolName);
  const toolResults = r.events.filter((e) => e.type === 'tool.completed');
  const readResult = toolResults.find((e) => e.payload.toolName === 'read_file');
  console.log('[8] 读取文件:工具链 =', toolCalls.join(','), '| 成功回执 =', toolResults.some((e) => e.payload.toolName === 'read_file' && e.payload.ok), '| 输出 =', r.output);
  if (toolCalls.join(',') !== 'read_file' || !toolResults.some((e) => e.payload.toolName === 'read_file' && e.payload.ok)) {
    throw new Error('读取文件未通过 read_file 成功完成');
  }
  if (
    readResult?.payload.result?.ok !== true ||
    readResult.payload.result?.data?.content !== '你好'
  ) {
    throw new Error('读取文件未透出结构化工具结果，UI 无法稳定格式化');
  }
  const advertisedTools = diagLines
    .slice(capabilityLogStart)
    .find((line) => line.includes('[req]') && line.includes('tools='));
  if (
    !advertisedTools
    || !advertisedTools.includes('read_file')
    || !advertisedTools.includes('get_io_table')
    || !advertisedTools.includes('validate_st_code')
    || !advertisedTools.includes('write_file')
  ) {
    throw new Error('required read_file 不应把其他工具从模型可见列表里拿掉');
  }
  if (
    process.env.MOCK_IGNORE_COMBINED === '1' &&
    !diagLines
      .slice(capabilityLogStart)
      .some(
        (line) =>
          line.includes('format=-') && line.includes('choice='),
      )
  ) {
    throw new Error('场景8 网关忽略组合参数后没有重试纯工具请求');
  }
}

// [9] 新会话:clearSession 后文件清空
{
  const asked = [];
  const r = await runTestTurn(
    '写你好我是agent这5个字到rr.txt下面',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
  );
  const written = await fs.readFile(path.join(dir, 'rr.txt'), 'utf8');
  const toolCalls = r.events.filter((e) => e.type === 'tool.started').map((e) => e.payload.toolName);
  console.log('[9] 写入文件:工具链 =', toolCalls.join(','), '| 内容 =', written, '| 输出 =', r.output);
  if (toolCalls.join(',') !== 'write_file' || asked.length !== 1 || written !== '你好我是agent') {
    throw new Error('自然语言写入请求未通过 write_file 正确落盘');
  }
}

// [10] 新会话:clearSession 后文件清空
{
  await session.clearSession();
  const raw = JSON.parse(await fs.readFile(path.join(dir, 'session.json'), 'utf8'));
  const chat = extractChatMessages(await session.getItems());
  console.log('[10] clearSession:条目 =', raw.items.length, '| 回放消息 =', chat.length);
  if (raw.items.length !== 0) throw new Error('场景8 clearSession 未清空');
}

// [10] 复现"批准后无反馈"场景:批准后模型在工具结果回喂后返回空 completion(真实网关坏行为)。
//     内核仍必须透出 tool_result 事件(带文件路径),UI 才有"✓ 成功"可显示;模型文本为空但不算出错
{
  const r = await runTestTurn('静默导出程序', async () => true);
  const results = r.events.filter((e) => e.type === 'tool.completed');
  console.log(
    '[9] 工具后模型沉默:模型文本长度 =', r.output.length,
    '| tool.completed =', JSON.stringify(results.map((e) => ({ n: e.payload.toolName, ok: e.payload.ok }))),
    '| 模型调用 =', r.usage.requests,
  );
  if (r.output.length !== 0) throw new Error('场景9 预期模型无文本输出');
  const okResult = results.find((e) => e.payload.toolName === 'export_st_program' && e.payload.ok);
  if (!okResult || !okResult.payload.summary.includes('StarDelta.st')) throw new Error('场景9 未透出成功的工具回执');
  // 熔断生效:空回复重试被截停在个位数(SDK 原生会一路重试到 maxTurns=10)
  if (r.usage.requests < 2 || r.usage.requests > 6)
    throw new Error(`场景9 熔断未生效或过度截停,模型调用 = ${r.usage.requests}`);
}

// [11] 只吐 reasoning 不吐正文(套壳推理模型常见坏行为):诊断日志必须记录到 推理>0/正文=0,
//      熔断照常截停,工具回执照常透出
{
  const before = diagLines.length;
  const r = await runTestTurn('思考导出程序', async () => true);
  const myLines = diagLines.slice(before);
  const respLine = myLines.find((l) => l.includes('正文=0') && /推理=[1-9]/.test(l));
  console.log('[10] 只思考不说话:模型文本长度 =', r.output.length, '| tool.completed ok =', r.events.some((e) => e.type === 'tool.completed' && e.payload.ok), '| 诊断行:', (respLine ?? myLines.at(-1) ?? '(无)').slice(0, 90));
  if (r.output.length !== 0) throw new Error('场景10 预期无正文');
  if (!respLine) throw new Error('场景10 诊断日志未识别出"正文0/推理>0"的响应');
  if (!r.events.some((e) => e.type === 'tool.completed' && e.payload.ok)) throw new Error('场景10 工具回执丢失');
}

console.log(`\n全部通过 ✔ (MAX_TURNS=${MAX_TURNS},工作目录 ${dir})`);
