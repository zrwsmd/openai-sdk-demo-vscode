// 编译产物级验证:加载 esbuild ESM 打包的 agent 内核 + 会话模块,对 mock 网关跑十个场景
// 前置: node scripts/mock_gateway.mjs 8790
// 运行: node scripts/agent_kernel_test.mjs
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentEventFactory,
  planTeamTask,
  runAgent,
  setAgentLogger,
  JsonFileSession,
  extractChatMessages,
  MaxTurnsExceededError,
  MAX_TURNS,
  createDeliveryContract,
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
const DEFAULT_SAVE_ST_CODE = [
  'PROGRAM StarDelta',
  '  VAR',
  '    TON_Star : TON;',
  '  END_VAR',
  '  TON_Star(IN := Start_Btn, PT := T#5s);',
  '  Motor_Star := TON_Star.Q;',
  'END_PROGRAM',
].join('\n');
const session = new JsonFileSession(path.join(dir, 'session.json'));
const noApproval = async (name) => {
  throw new Error(`不应触发审批,却收到 ${name}`);
};
let runSequence = 0;
async function runTestTurn(userText, decide, extraOptions = {}, runSession = session) {
  const events = [];
  const runId = `kernel-${++runSequence}`;
  const factory = new AgentEventFactory(runId, runId);
  const protocol = {
    runId,
    operationId: runId,
    eventFactory: factory,
    onEvent: (event) => events.push(event),
  };
  let result = await runAgent(cfg, runSession, userText, { ...extraOptions, protocol });
  while (result.status === 'awaiting_approval') {
    if (!decide) throw new Error('测试遇到未处理的审批断点');
    const decisions = {};
    for (const approval of result.approvals || []) {
      decisions[approval.id] = await decide(approval.name, approval.args);
    }
    result = await runAgent(cfg, runSession, userText, {
      ...extraOptions,
      initialState: result.state,
      decisions,
      protocol,
    });
  }
  return { ...result, events };
}

// [3b] 需要内联交付时,模型通过通用 deliver_artifact 工具提交完整内容;
// 即使最终结构化总结仍给出空 artifacts, runtime 也应从工具回执恢复交付物。
{
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求生成可交付 ST 程序',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspacePersistence: 'not_required',
    }],
  });
  const r = await runTestTurn('交付物工具回归', noApproval, {
    deliveryContract: contract,
  }, new JsonFileSession(path.join(dir, 'delivery-session.json')));
  const delivered = r.events.filter(
    (event) => event.type === 'tool.completed' && event.payload.toolName === 'deliver_artifact',
  );
  console.log('[3b] 通用交付工具:回执 =', delivered.length, '| artifacts =', r.result.artifacts.length);
  if (delivered.length !== 1 || r.result.artifacts.length !== 1) {
    throw new Error('通用 deliver_artifact 回执没有恢复为最终交付物');
  }
  if (!r.result.artifacts[0]?.content?.includes('PROGRAM StarDelta')) {
    throw new Error('通用 deliver_artifact 恢复的内容不完整');
  }
}

// [3c] 代码默认落盘:先验证同一份 ST 内容,再写入当前工作区;
// write_file 的审批恢复不能丢失前一步校验状态。
{
  const asked = [];
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  const r = await runTestTurn(
    '默认保存回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'default-save-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3c] 默认 ST 落盘:工具链 =', toolCalls.join(','), '| 审批 =', asked.map((item) => item.name).join(','));
  if (toolCalls.join(',') !== 'validate_st_code,write_file') {
    throw new Error('ST 默认落盘没有先校验再写入');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 默认落盘的审批工具不正确');
  }
  const saved = await fs.readFile(path.join(dir, 'PumpControl.st'), 'utf8');
  if (saved !== DEFAULT_SAVE_ST_CODE || !r.output.includes('PumpControl.st')) {
    throw new Error('ST 默认落盘结果或最终确认不正确');
  }
}

// [3c2] 模型在 ST 校验和写入成功后胡说"文件被截断"时,运行时仍以
// 校验哈希和写入哈希一致为准,且 ST 固定流水线不再额外 read/path 复核。
{
  const asked = [];
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  const r = await runTestTurn(
    'ST摘要误判回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'st-summary-evidence-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3c2] ST 摘要误判纠正:工具链 =', toolCalls.join(','), '| 审批 =', asked.map((item) => item.name).join(','));
  if (toolCalls.join(',') !== 'validate_st_code,write_file') {
    throw new Error('ST 摘要误判场景没有收敛到校验、写入固定流水线');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 摘要误判场景触发了错误的审批工具');
  }
  if (r.output.includes('文件被截断了，请重新写入') || r.output.includes('请重新写入完整代码')) {
    throw new Error('模型的摘要误判覆盖了已验证的工具事实');
  }
  if (!r.output.includes('内容与 validate_st_code 通过校验的完整代码一致')) {
    throw new Error('最终结果没有说明写入内容与校验内容哈希一致');
  }
}

// [3c2b] 模型在显式校验失败后直接写入一份修正后的 ST 内容时,
// write_file 必须在落盘前内部重新校验这份写入内容,通过后才写。
{
  const asked = [];
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  const r = await runTestTurn(
    '预写校验回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'prewrite-validation-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  const completedWrite = r.events.find(
    (event) => event.type === 'tool.completed' && event.payload.toolName === 'write_file',
  );
  console.log('[3c2b] ST 预写校验:工具链 =', toolCalls.join(','), '| 审批 =', asked.map((item) => item.name).join(','));
  if (toolCalls.join(',') !== 'validate_st_code,write_file') {
    throw new Error('ST 预写校验场景没有保持先尝试校验再写入');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 预写校验场景的审批工具不正确');
  }
  if (completedWrite?.payload?.ok !== true || !completedWrite.payload.result?.data?.preWriteValidation) {
    throw new Error('write_file 没有对不一致写入内容执行内部预写校验');
  }
  const saved = await fs.readFile(path.join(dir, 'PumpControl.st'), 'utf8');
  if (saved !== DEFAULT_SAVE_ST_CODE || !r.output.includes('PumpControl.st')) {
    throw new Error('ST 预写校验后的写入结果不正确');
  }
}

// [3c3] 草稿校验失败时,模型必须继续修改内存草稿并再次 validate_st_code;
// 只有 errorCount=0 的草稿可以进入唯一一次 write_file 审批。
{
  const asked = [];
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  const r = await runTestTurn(
    'ST草稿修正回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'st-draft-repair-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  const diagnosticReports = r.events.filter(
    (event) => event.type === 'run.progress' && event.payload.stage === 'diagnostics.report',
  );
  console.log(
    '[3c3] ST 草稿修正:工具链 =',
    toolCalls.join(','),
    '| 审批 =',
    asked.map((item) => item.name).join(','),
    '| 诊断旁路 =',
    diagnosticReports.length,
  );
  if (toolCalls.join(',') !== 'validate_st_code,validate_st_code,write_file') {
    throw new Error('ST 草稿修正没有按 校验失败 -> 再校验 -> 写入 顺序执行');
  }
  const diagnosticReport = diagnosticReports[0]?.payload?.report;
  if (
    diagnosticReports.length !== 1 ||
    !Array.isArray(diagnosticReport?.diagnostics) ||
    !diagnosticReport.diagnostics.length ||
    diagnosticReport.repairPacket?.kind !== 'diagnostic_repair_packet'
  ) {
    throw new Error('ST 草稿校验失败没有产生完整诊断旁路和压缩修复包');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 草稿修正触发了错误的审批次数或审批工具');
  }
  const saved = await fs.readFile(path.join(dir, 'PumpControl.st'), 'utf8');
  if (saved !== DEFAULT_SAVE_ST_CODE || !r.output.includes('PumpControl.st')) {
    throw new Error('ST 草稿修正后的写入结果不正确');
  }
}

// [3c4] 坏网关/坏模型可能忽略 parallel=false,在同一轮返回多个完全
// 相同的 write_file 审批。运行时应折叠成一个审批,且只执行第一条。
{
  const asked = [];
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  const r = await runTestTurn(
    '重复写入审批回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'duplicate-write-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  const approvalRequests = r.events.filter((event) => event.type === 'approval.requested');
  console.log(
    '[3c4] 重复写入审批折叠:工具链 =',
    toolCalls.join(','),
    '| 审批请求 =',
    approvalRequests.length,
    '| decide =',
    asked.map((item) => item.name).join(','),
  );
  if (approvalRequests.length !== 1 || asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('重复 write_file 没有折叠成单个审批');
  }
  if (toolCalls.join(',') !== 'validate_st_code,write_file') {
    throw new Error('重复 write_file 被批准后不应执行多次写入');
  }
  const saved = await fs.readFile(path.join(dir, 'PumpControl.st'), 'utf8');
  if (saved !== DEFAULT_SAVE_ST_CODE || !r.output.includes('PumpControl.st')) {
    throw new Error('重复写入折叠后的保存结果不正确');
  }
}

// [3d] 模型先给了最终答复却没有按契约执行动作时,完成验收必须主动
// 强制验证工具,验证通过后再强制落盘,不能只把修复要求再交给模型自觉处理。
{
  const asked = [];
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码并默认保存到工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  const r = await runTestTurn(
    '强制交付闭环',
    async (name) => {
      asked.push(name);
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'completion-repair-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3d] 完成验收兜底:工具链 =', toolCalls.join(','), '| 审批 =', asked.join(','));
  if (toolCalls.join(',') !== 'validate_st_code,write_file') {
    throw new Error('完成验收没有按交付契约强制验证再落盘');
  }
  if (asked.join(',') !== 'write_file') {
    throw new Error('完成验收兜底触发了错误的审批工具');
  }
}

// [3e] 兼容坏网关/坏模型:即使主 Agent 在结构化输出请求下直接吐普通正文,
// runtime 也要保留正文并进入交付闭环,不能把 SDK 的 schema 错误直接抛给用户。
{
  const asked = [];
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码并默认保存到工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  const r = await runTestTurn(
    '正文交付闭环',
    async (name) => {
      asked.push(name);
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'plain-output-repair-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3e] 普通正文 schema 兜底:工具链 =', toolCalls.join(','), '| 审批 =', asked.join(','));
  if (toolCalls.join(',') !== 'validate_st_code,write_file') {
    throw new Error('普通正文输出没有进入校验再落盘闭环');
  }
  if (!r.output.includes('PumpControl.st')) {
    throw new Error('普通正文兜底后的最终确认不正确');
  }
}

// [3f] Team 角色不再依赖 SDK 黑盒 schema 错误。planner 首次返回缺字段
// JSON 时,运行时应把具体 zod issue 回灌给模型并拿到修正后的结构化计划。
{
  const before = diagLines.length;
  const report = await planTeamTask(cfg, {
    goal: 'Team schema repair',
    planSummary: 'Team schema repair',
    reviewFocus: [],
    verificationCriteria: ['完成'],
  });
  const freshLogs = diagLines.slice(before);
  console.log('[3f] Team schema 自修:计划 =', report.planSummary, '| 节点 =', report.executionGraph?.nodes?.length ?? 0);
  if (report.planSummary !== '修正后的 Team 计划' || report.executionGraph?.nodes?.[0]?.id !== 'generate') {
    throw new Error('Team schema 自修没有返回修正后的计划');
  }
  if (!freshLogs.some((line) => line.includes('结构化输出未通过 schema') && line.includes('completionCriteria'))) {
    throw new Error('Team schema 自修没有记录字段级 schema 错误');
  }
}

// [1] 第一句问候 → mock 回显 msgs=2(系统提示+本句);usage 单次
{
  const r = await runTestTurn('你好', noApproval);
  const m = /\[msgs=(\d+)\]/.exec(r.output);
  console.log('[1] 问候:', r.output.slice(0, 16) + '…', '| msgs 回显 =', m?.[1], '| usage =', JSON.stringify(r.usage));
  if (!m || Number(m[1]) !== 2) throw new Error('场景1 msgs 不为 2');
  if (!r.events.some((event) => event.type === 'text.delta')) throw new Error('场景1 普通文本没有增量事件');
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
  if (!capabilityRequests.some((line) => line.includes('format=json_schema') && line.includes('choice=-'))) {
    throw new Error('场景5 首轮工具选择没有保持 auto');
  }
}

// [6] 首轮 auto 未执行动作时,只在第二轮启用一次强制工具兜底
{
  const asked = [];
  const capabilityLogStart = diagLines.length;
  const r = await runTestTurn('请自动兜底导出程序', async (name, args) => {
    asked.push({ name, args });
    return true;
  });
  const capabilityRequests = diagLines
    .slice(capabilityLogStart)
    .filter((line) => line.includes('[req]'));
  const forcedRequest = capabilityRequests.find(
    (line) => line.includes('export_st_program') && !line.includes('choice=-'),
  );
  console.log(
    '[6] 工具选择兜底:首轮 =',
    capabilityRequests[0] ?? '(无)',
    '| 强制兜底 =',
    forcedRequest ?? '(无)',
  );
  if (!capabilityRequests[0]?.includes('choice=-')) {
    throw new Error('场景6 首轮没有使用 auto 工具选择');
  }
  if (!forcedRequest) {
    throw new Error('场景6 首轮未执行动作后没有启用强制工具兜底');
  }
  if (process.env.MOCK_REJECT_COMBINED === '1'
    && !capabilityRequests.some((line) => line.includes('format=-') && !line.includes('choice=-'))) {
    throw new Error('场景6 网关组合能力冲突后没有降级工具请求');
  }
  if (asked.length !== 1 || asked[0].name !== 'export_st_program' || !r.output.includes('导出')) {
    throw new Error('场景6 强制工具兜底未完成审批和导出');
  }
}

// [7] needsApproval-拒绝:不落盘
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

// [8] 死循环 → maxTurns 截停(放最后:会往会话里灌 10 轮工具往返)
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

// [9] 新会话:clearSession 后文件清空
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
}

// [8b] 工具成功但模型最终 schema message 为空 → 后端用工具结果合成兜底文字
{
  await fs.writeFile(path.join(dir, 'lk.txt'), '兜底内容', 'utf8');
  const r = await runTestTurn('空总结读取 lk.txt 文件里面的内容', noApproval);
  console.log('[8b] 空总结读取兜底:输出 =', JSON.stringify(r.output));
  if (!r.output.includes('已读取 lk.txt') || !r.output.includes('兜底内容')) {
    throw new Error('读取工具成功但空 message 时没有生成兜底输出');
  }
}

// [8b2] 工具成功但模型把 SDK/artifact 内部错误当最终总结 → 后端改用工具结果兜底
{
  await fs.writeFile(path.join(dir, 'lk.txt'), 'artifact兜底内容', 'utf8');
  const r = await runTestTurn('artifact坏总结读取 lk.txt 文件里面的内容', noApproval);
  console.log('[8b2] artifact 坏总结兜底:输出 =', JSON.stringify(r.output));
  if (r.output.includes('no available artifacts') || r.output.includes('Tool call')) {
    throw new Error('artifact 内部错误文案泄漏到了最终输出');
  }
  if (!r.output.includes('已读取 lk.txt') || !r.output.includes('artifact兜底内容')) {
    throw new Error('artifact 坏总结没有回退到 read_file 工具结果');
  }
}

// [8d] 工具失败且模型最终 schema message 为空 → 后端用失败回执合成兜底文字并停止重试
{
  const r = await runTestTurn('读取缺失文件', noApproval);
  const started = r.events.filter((e) => e.type === 'tool.started' && e.payload.toolName === 'read_file');
  const completed = r.events.filter((e) => e.type === 'tool.completed' && e.payload.toolName === 'read_file');
  console.log('[8d] 读取失败兜底:started =', started.length, '| completed =', completed.length, '| 输出 =', JSON.stringify(r.output));
  if (started.length !== 1 || completed.length !== 1) {
    throw new Error('读取失败后不应反复强制重试同一个 read_file 工具');
  }
  if (completed[0]?.payload.result?.ok !== false) {
    throw new Error('读取缺失文件没有透出失败工具回执');
  }
  if (!r.output.includes('读取 no_such.txt 失败') || !r.output.includes('文件不存在:no_such.txt')) {
    throw new Error('读取工具失败且空 message 时没有生成失败兜底输出');
  }
}

// [8e] 通用完成验收:工具失败后模型假装完成 → runtime 反馈失败原因并驱动下一轮修正
{
  await fs.writeFile(path.join(dir, 'fixed.txt'), '修正后的内容', 'utf8');
  const capabilityLogStart = diagLines.length;
  const r = await runTestTurn('通用闭环读取 typo.txt', noApproval);
  const started = r.events.filter((e) => e.type === 'tool.started' && e.payload.toolName === 'read_file');
  const completed = r.events.filter((e) => e.type === 'tool.completed' && e.payload.toolName === 'read_file');
  const gateRetries = r.events.filter((e) => e.type === 'run.progress' && e.payload.stage === 'completion_gate.retry');
  const requestLines = diagLines.slice(capabilityLogStart).filter((line) => line.includes('[completion_gate]'));
  console.log('[8e] 通用验收闭环:started =', started.length, '| completed =', completed.length, '| gateRetries =', gateRetries.length, '| 输出 =', r.output);
  if (started.length !== 2 || completed.length !== 2) {
    throw new Error('通用完成验收未驱动失败工具后的第二次修正调用');
  }
  if (completed[0]?.payload.result?.ok !== false || completed[1]?.payload.result?.ok !== true) {
    throw new Error('通用完成验收场景没有先失败后成功的工具回执');
  }
  if (gateRetries.length !== 1 || requestLines.length !== 1) {
    throw new Error('通用完成验收未记录一次重试反馈');
  }
  if (!r.output.includes('fixed.txt') || !r.output.includes('成功')) {
    throw new Error('通用完成验收修正后的最终答复缺少成功依据');
  }
}

// [8f] SDK 工具入参错误也必须纳入工具账本 → completion gate 反馈坏参数并驱动修正
{
  await fs.writeFile(path.join(dir, 'needle.txt'), 'needle', 'utf8');
  const capabilityLogStart = diagLines.length;
  const r = await runTestTurn('参数闭环搜索 needle', noApproval);
  const started = r.events.filter((e) => e.type === 'tool.started' && e.payload.toolName === 'search_files');
  const completed = r.events.filter((e) => e.type === 'tool.completed' && e.payload.toolName === 'search_files');
  const gateRetries = r.events.filter((e) => e.type === 'run.progress' && e.payload.stage === 'completion_gate.retry');
  const requestLines = diagLines.slice(capabilityLogStart).filter((line) => line.includes('[completion_gate]'));
  console.log('[8f] 参数错误闭环:started =', started.length, '| completed =', completed.length, '| gateRetries =', gateRetries.length, '| 输出 =', r.output);
  if (started.length !== 2 || completed.length !== 2) {
    throw new Error('工具入参错误未驱动第二次修正调用');
  }
  if (gateRetries.length !== 1 || requestLines.length !== 1) {
    throw new Error('工具入参错误未触发完成验收重试');
  }
  if (!String(gateRetries[0].payload.repairInstruction || '').includes('args={"text":')) {
    throw new Error('完成验收反馈没有包含错误工具参数');
  }
  if (!r.output.includes('已修正') || !r.output.includes('needle')) {
    throw new Error('工具入参错误修正后的最终答复缺少成功依据');
  }
}

// [8c] 同一轮多个独立工具调用 → 请求开启 parallel_tool_calls,SDK 并发执行并回喂全部结果
{
  await fs.writeFile(path.join(dir, 'pa.txt'), '并行A', 'utf8');
  await fs.writeFile(path.join(dir, 'pb.txt'), '并行B', 'utf8');
  const capabilityLogStart = diagLines.length;
  const r = await runTestTurn('并行读取 pa.txt 和 pb.txt', noApproval);
  const started = r.events.filter((e) => e.type === 'tool.started' && e.payload.toolName === 'read_file');
  const completed = r.events.filter((e) => e.type === 'tool.completed' && e.payload.toolName === 'read_file');
  const contents = completed.map((e) => e.payload.result?.data?.content).sort();
  const requestLines = diagLines.slice(capabilityLogStart).filter((line) => line.includes('[req]'));
  console.log('[8c] 并行工具:started =', started.length, '| completed =', completed.length, '| 请求 =', requestLines[0] ?? '(无)');
  if (!requestLines[0]?.includes('parallel=true')) {
    throw new Error('并行工具请求未开启 parallel_tool_calls');
  }
  if (started.length !== 2 || completed.length !== 2) {
    throw new Error('同一轮并行读取没有产生两个 read_file 工具调用和回执');
  }
  if (contents.join('|') !== '并行A|并行B') {
    throw new Error(`并行读取结果不完整: ${contents.join('|')}`);
  }
  if (!r.output.includes('pa.txt') || !r.output.includes('pb.txt')) {
    throw new Error('并行读取最终总结缺少文件名');
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

// [9b] 工具已成功但最终 assistant 输出 schema 崩溃时，运行时必须按工具账本合成完成结果。
{
  const r = await runTestTurn('写入 schema崩写入.txt', async () => true);
  const written = await fs.readFile(path.join(dir, 'schema崩写入.txt'), 'utf8');
  const toolCalls = r.events.filter((e) => e.type === 'tool.started').map((e) => e.payload.toolName);
  console.log('[9b] 写入后 schema 崩兜底:工具链 =', toolCalls.join(','), '| 内容 =', written, '| 输出 =', r.output);
  if (toolCalls.join(',') !== 'write_file' || written !== 'hello' || !r.output.includes('schema崩写入.txt')) {
    throw new Error('最终 schema 崩溃后没有按成功 write_file 工具账本完成');
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
//     内核必须透出 tool_result 事件,并用工具结果合成兜底总结,避免 UI 显示"模型无文本"。
{
  const r = await runTestTurn('静默导出程序', async () => true);
  const results = r.events.filter((e) => e.type === 'tool.completed');
  console.log(
    '[9] 工具后模型沉默:模型文本长度 =', r.output.length,
    '| tool.completed =', JSON.stringify(results.map((e) => ({ n: e.payload.toolName, ok: e.payload.ok }))),
    '| 模型调用 =', r.usage.requests,
  );
  if (!r.output.includes('已导出') || !r.output.includes('StarDelta.st')) {
    throw new Error('场景9 未用工具结果生成兜底输出');
  }
  const okResult = results.find((e) => e.payload.toolName === 'export_st_program' && e.payload.ok);
  if (!okResult || !okResult.payload.summary.includes('StarDelta.st')) throw new Error('场景9 未透出成功的工具回执');
  // 熔断生效:空回复重试被截停在个位数(SDK 原生会一路重试到 maxTurns=10)
  if (r.usage.requests < 2 || r.usage.requests > 6)
    throw new Error(`场景9 熔断未生效或过度截停,模型调用 = ${r.usage.requests}`);
}

// [11] 只吐 reasoning 不吐正文(套壳推理模型常见坏行为):诊断日志必须记录到 推理>0/正文=0,
//      熔断照常截停,工具回执照常透出,并基于成功工具结果合成兜底总结
{
  const before = diagLines.length;
  const r = await runTestTurn('思考导出程序', async () => true);
  const myLines = diagLines.slice(before);
  const respLine = myLines.find((l) => l.includes('正文=0') && /推理=[1-9]/.test(l));
  console.log('[10] 只思考不说话:模型文本长度 =', r.output.length, '| tool.completed ok =', r.events.some((e) => e.type === 'tool.completed' && e.payload.ok), '| 诊断行:', (respLine ?? myLines.at(-1) ?? '(无)').slice(0, 90));
  if (!r.output.includes('已导出') || !r.output.includes('StarDelta.st')) {
    throw new Error('场景10 未用工具结果生成兜底输出');
  }
  if (!respLine) throw new Error('场景10 诊断日志未识别出"正文0/推理>0"的响应');
  if (!r.events.some((e) => e.type === 'tool.completed' && e.payload.ok)) throw new Error('场景10 工具回执丢失');
}

console.log(`\n全部通过 ✔ (MAX_TURNS=${MAX_TURNS},工作目录 ${dir})`);
