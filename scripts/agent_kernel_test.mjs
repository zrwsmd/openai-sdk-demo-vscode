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
  TurnBudgetExceededError,
  getResumableAgentState,
  MAX_TURNS,
  makeLoggingFetch,
  normalizeWorkflowContract,
  sanitizeChatCompletionRequestBody,
  summarizeNonStreamChatCompletionResponse,
  createPromptCacheFingerprint,
  PROMPT_CACHE_DYNAMIC_MARKER,
  projectNewTurnSessionHistory,
  createHistoricalToolArgumentGuard,
  buildHistoricalExplanationContext,
  createNewTurnModelInputSession,
  isToolHistoryItem,
  sanitizeAssistantMessageForPersistence,
  stripHistoricalContextMarker,
  composeToolSet,
  isRetryableAgentError,
  renderFallbackModeInstructions,
  composeFinalMessage,
  createAppWorkflowRegistry,
  bindClarificationOptionValue,
} from './agent.testbundle.mjs';

// A clarification choice is resolved against the host-owned option list. The
// webview may echo a value for display, but it cannot replace the canonical ID.
{
  const bound = bindClarificationOptionValue(
    [{ id: 'record-a', label: 'Record A', value: JSON.stringify({ recordId: 'case-42' }) }],
    {
      requestId: 'clarification-1',
      cancelled: false,
      selectedOptionId: 'record-a',
      value: JSON.stringify({ recordId: 'forged' }),
    },
  );
  if (bound.value !== JSON.stringify({ recordId: 'case-42' })) {
    throw new Error('澄清选项值没有绑定到宿主提供的候选目标');
  }
  const unknown = bindClarificationOptionValue(
    [{ id: 'record-a', label: 'Record A', value: 'case-42' }],
    {
      requestId: 'clarification-2',
      cancelled: false,
      selectedOptionId: 'not-offered',
      value: 'forged',
    },
  );
  if ('value' in unknown) throw new Error('未提供的澄清选项保留了客户端伪造值');
  console.log('[clarification] 候选 ID 与规范值绑定:通过');
}

// 最终消息合成：泛化收尾不能遮住工具证据；失败模型文本不能和成功证据并列；
// 同一文件的不同字节数/措辞不能重复展示。
{
  const fallback = composeFinalMessage(
    '已完成运行时结构化收尾。',
    undefined,
    '已导出 C:\\tmp\\StarDelta.st。',
  );
  if (fallback !== '已导出 C:\\tmp\\StarDelta.st。') {
    throw new Error(`泛化收尾没有让位给工具兜底: ${fallback}`);
  }

  const authoritative = composeFinalMessage(
    '无法完成本轮交付。',
    '已完成正式交付：C:\\tmp\\StarDelta.st；已确认内容通过 ST 校验并成功写入（commit=st-delivery-1）。',
  );
  if (
    !authoritative?.includes('已完成正式交付') ||
    authoritative.includes('无法完成')
  ) {
    throw new Error(`失败模型文本与成功证据发生冲突: ${authoritative}`);
  }

  const deduped = composeFinalMessage(
    'StarDelta.st 已保存到工作区（128 字节）。',
    '已完成正式交付：StarDelta.st；已确认内容通过 ST 校验并成功写入（commit=st-delivery-1）。',
  );
  if (
    !deduped?.includes('StarDelta.st 已保存') ||
    !deduped.includes('通过 ST 校验') ||
    deduped.includes('成功写入') ||
    (deduped.match(/StarDelta\.st/gi) ?? []).length !== 1
  ) {
    throw new Error(`同一交付证据没有去重: ${deduped}`);
  }
  console.log('[final-message] 泛化收尾、矛盾文本、重复证据:通过');
}

for (const [mode, label] of [
  ['general_chat', '普通问答'],
  ['read_only', '只读'],
  ['file_edit', '文件编辑'],
  ['command_query', '命令查询'],
  ['needs_clarification', '需要澄清'],
  ['blocked_high_risk', '高风险拦截'],
]) {
  const instructions = renderFallbackModeInstructions(mode);
  if (!instructions.includes(`本轮分诊档位：${label}`)) {
    throw new Error(`fallback prompt did not describe mode ${mode}`);
  }
}

// 捕获网关原始报文诊断(与插件里 "PLC Agent" 输出面板同源)
const diagLines = [];
setAgentLogger((line) => diagLines.push(line));

// [0a] 第三方兼容网关拒绝 Prompt Cache 时，只重试一次并关闭后续注入；
// 网关返回 usage 缓存明细时，诊断日志必须保留命中 token。
{
  const originalFetch = globalThis.fetch;
  const requests = [];
  let callCount = 0;
  globalThis.fetch = async (_input, init = {}) => {
    callCount += 1;
    const body = JSON.parse(init.body);
    requests.push(body);
    if (callCount === 1) {
      return new Response(
        JSON.stringify({ error: { message: 'prompt_cache_options is not supported' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'ok' },
        }],
        usage: {
          prompt_tokens: 100,
          prompt_tokens_details: { cached_tokens: 12 },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  const before = diagLines.length;
  try {
    const fetcher = makeLoggingFetch({
      promptCache: { enabled: true, ttl: '30m' },
    });
    const response = await fetcher('https://gateway.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'mock-model',
        stream: false,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    await response.text();
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    globalThis.fetch = originalFetch;
  }
  const retryBody = requests[1] ?? {};
  const cacheLines = diagLines.slice(before);
  if (
    callCount !== 2 ||
    requests[0]?.prompt_cache_options?.ttl !== '30m' ||
    retryBody.prompt_cache_options !== undefined ||
    !cacheLines.some((line) => line.includes('网关不支持 prompt_cache_options')) ||
    !cacheLines.some((line) => line.includes('cache=cached:12,write:0,input:100,hit:12.0%,state=hit'))
  ) {
    throw new Error(`Prompt Cache 网关回退失败: ${JSON.stringify({ callCount, requests, cacheLines })}`);
  }
  console.log('[0a] Prompt Cache 不兼容回退与命中日志:通过');
}

// [0aa] 网关能力在新的 fetch/client 实例之间复用,避免同一网关和模型重复探测。
{
  const originalFetch = globalThis.fetch;
  const requests = [];
  const diagnosticsStart = diagLines.length;
  globalThis.fetch = async (_input, init = {}) => {
    requests.push(JSON.parse(init.body));
    return new Response(
      JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'ok' },
        }],
        usage: {
          prompt_tokens: 120,
          prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 120 },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const url = 'https://prompt-cache-capability.test/v1/chat/completions';
    const body = {
      model: 'capability-model',
      stream: false,
      messages: [{ role: 'user', content: 'hello' }],
    };
    for (const fetcher of [
      makeLoggingFetch({ promptCache: { enabled: true, ttl: '30m' } }),
      makeLoggingFetch({ promptCache: { enabled: true, ttl: '30m' } }),
    ]) {
      const response = await fetcher(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await response.text();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  const capabilityLines = diagLines.slice(diagnosticsStart);
  const accepted = capabilityLines.filter((line) => line.includes('网关已接受 prompt_cache_options'));
  const reused = capabilityLines.filter((line) => line.includes('复用网关能力'));
  if (
    requests.length !== 2 ||
    requests.some((request) => request.prompt_cache_options?.ttl !== '30m') ||
    accepted.length !== 1 ||
    reused.length !== 1
  ) {
    throw new Error(`Prompt Cache 能力记忆失败: ${JSON.stringify({ requests, accepted, reused })}`);
  }
  console.log('[0aa] Prompt Cache 能力记忆:通过');
}

// [0ab] 显式关闭缓存时，即使 AgentConfig 保留了启用配置，也不能从配置中隐式恢复。
{
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_input, init = {}) => {
    requestBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'ok' },
        }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const fetcher = makeLoggingFetch({ promptCache: undefined });
    const response = await fetcher(
      'https://prompt-cache-disabled.test/v1/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: 'disabled-model',
          stream: false,
          messages: [{ role: 'user', content: 'hello' }],
        }),
      },
    );
    await response.text();
  } finally {
    globalThis.fetch = originalFetch;
  }
  if (requestBody?.prompt_cache_options !== undefined) {
    throw new Error(`显式关闭 Prompt Cache 仍被注入: ${JSON.stringify(requestBody)}`);
  }
  console.log('[0ab] Prompt Cache 显式关闭:通过');
}

// [0ac] 兼容不同网关的缓存 usage 字段，并观测实际请求前缀是否稳定。
{
  const originalFetch = globalThis.fetch;
  const diagnosticsStart = diagLines.length;
  let callCount = 0;
  const baseBody = {
    model: 'compat-cache-model',
    stream: false,
    tools: [{
      type: 'function',
      function: { name: 'read_file', description: 'read a file', parameters: {} },
    }],
    messages: [
      { role: 'system', content: 'stable system' },
      { role: 'user', content: 'first question' },
    ],
  };
  globalThis.fetch = async (_input, init = {}) => {
    callCount += 1;
    const body = JSON.parse(init.body);
    const usage = callCount === 1
      ? { prompt_cache_miss_tokens: 40, prompt_cache_hit_tokens: 60 }
      : callCount === 2
        ? { input_tokens: 100, cache_creation_input_tokens: 100 }
        : callCount === 3
          ? { prompt_tokens: 80, prompt_tokens_details: { cached_tokens: 20 } }
          : { input_tokens: 25, cache_read_input_tokens: 75 };
    if (body.stream === true) {
      const chunks = [
        {
          choices: [{ delta: { content: 'ok' }, finish_reason: null }],
          usage,
        },
        {
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage,
        },
        '[DONE]',
      ];
      return new Response(
        chunks
          .map((chunk) => `data: ${typeof chunk === 'string' ? chunk : JSON.stringify(chunk)}\n\n`)
          .join(''),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'ok' },
        }],
        usage,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const fetcher = makeLoggingFetch({
      promptCache: { enabled: true, ttl: '30m' },
    });
    for (const body of [
      baseBody,
      baseBody,
      { ...baseBody, messages: [...baseBody.messages.slice(0, 1), { role: 'user', content: 'second question' }] },
    ]) {
      const response = await fetcher(
        'https://prompt-cache-observation.test/v1/chat/completions',
        { method: 'POST', body: JSON.stringify(body) },
      );
      await response.text();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const streamResponse = await fetcher(
      'https://prompt-cache-observation.test/v1/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          ...baseBody,
          stream: true,
          messages: [...baseBody.messages.slice(0, 1), { role: 'user', content: 'stream question' }],
        }),
      },
    );
    await streamResponse.text();
    await new Promise((resolve) => setTimeout(resolve, 30));
  } finally {
    globalThis.fetch = originalFetch;
  }
  const cacheLines = diagLines.slice(diagnosticsStart);
  const fingerprintLines = cacheLines.filter((line) => line.includes('[prompt-cache] prefix='));
  const fingerprints = fingerprintLines.map((line) => {
    const match = line.match(/prefix=([0-9a-f]{12}) full=([0-9a-f]{12})/u);
    return match ? { prefix: match[1], full: match[2] } : undefined;
  }).filter(Boolean);
  const first = createPromptCacheFingerprint(JSON.stringify({
    ...baseBody,
    stream: false,
  }));
  const second = createPromptCacheFingerprint(JSON.stringify({
    ...baseBody,
    stream: false,
    messages: [...baseBody.messages.slice(0, 1), { role: 'user', content: 'second question' }],
  }));
  const layeredFirst = createPromptCacheFingerprint(JSON.stringify({
    ...baseBody,
    messages: [{
      role: 'system',
      content: `stable rules${PROMPT_CACHE_DYNAMIC_MARKER}dynamic one`,
    }, {
      role: 'user',
      content: 'same request',
    }],
  }));
  const layeredSecond = createPromptCacheFingerprint(JSON.stringify({
    ...baseBody,
    messages: [{
      role: 'system',
      content: `stable rules${PROMPT_CACHE_DYNAMIC_MARKER}dynamic two`,
    }, {
      role: 'user',
      content: 'same request',
    }],
  }));
  if (
    callCount !== 4 ||
    !cacheLines.some((line) =>
      line.includes('cache=cached:60,write:0,input:40,hit:60.0%,state=hit,total:100'),
    ) ||
    !cacheLines.some((line) =>
      line.includes('cache=cached:0,write:100,input:100,hit:0.0%,state=write,total:200'),
    ) ||
    !cacheLines.some((line) => line.includes('cache=cached:20,write:0,input:80,hit:25.0%,state=hit')) ||
    !cacheLines.some((line) =>
      line.includes('cache=cached:75,write:0,input:25,hit:75.0%,state=hit,total:100'),
    ) ||
    fingerprints.length < 4 ||
    !first ||
    !second ||
    first.prefix !== second.prefix ||
    first.full === second.full ||
    !layeredFirst ||
    !layeredSecond ||
    layeredFirst.systemPrefix !== layeredSecond.systemPrefix ||
    layeredFirst.systemDynamic === layeredSecond.systemDynamic
  ) {
    throw new Error(`Prompt Cache 统计或前缀指纹观测失败: ${JSON.stringify({
      callCount,
      cacheLines,
      fingerprints,
      first,
      second,
      layeredFirst,
      layeredSecond,
    })}`);
  }
  console.log('[0ac] Prompt Cache 统计兼容与前缀指纹:通过');
}

// [0] 出站请求边界:任意工具产生空参数、非法 JSON 或非对象参数时,
// 下一次 OpenAI 兼容请求必须被修复,且已经合法的对象参数保持原样。
{
  const raw = JSON.stringify({
    model: 'mock-model',
    messages: [
      {
        role: 'assistant',
        tool_calls: [
          { id: 'call-empty', type: 'function', function: { name: 'arbitrary_tool', arguments: '' } },
          { id: 'call-invalid', type: 'function', function: { name: 'another_tool', arguments: '{"x":' } },
          { id: 'call-valid', type: 'function', function: { name: 'kept_tool', arguments: '{"x":1}' } },
        ],
      },
    ],
    input: [
      { type: 'function_call', name: 'response_tool', arguments: '' },
    ],
  });
  const sanitized = sanitizeChatCompletionRequestBody(raw);
  const request = JSON.parse(sanitized.body);
  const args = request.messages[0].tool_calls.map((call) => call.function.arguments);
  if (sanitized.repaired !== 3 || args[0] !== '{}' || args[1] !== '{}' || args[2] !== '{"x":1}') {
    throw new Error(`工具参数出站修复结果不正确: ${JSON.stringify({ repaired: sanitized.repaired, args })}`);
  }
  if (request.input[0].arguments !== '{}') throw new Error('Responses 风格 function_call 参数没有修复');
  console.log('[0] 通用工具参数出站修复:通过 | 修复数 =', sanitized.repaired);
}

{
  const raw = JSON.stringify({
    stream: false,
    messages: [{
      role: 'assistant',
      tool_calls: [{ id: 'call-bytes', type: 'function', function: { name: 'byte_tool', arguments: '' } }],
    }],
  });
  const sanitized = sanitizeChatCompletionRequestBody(new TextEncoder().encode(raw));
  const request = JSON.parse(sanitized.body);
  if (sanitized.repaired !== 1 || request.messages[0].tool_calls[0].function.arguments !== '{}') {
    throw new Error('字节请求体的工具参数没有被修复');
  }
  console.log('[0c] 字节请求体工具参数修复:通过');
}

// [0d] 业务工具白名单不能误删运行时控制工具。
{
  const businessTools = [{ name: 'read_file' }, { name: 'write_file' }];
  const runtimeTools = [
    { name: 'report_plan_progress' },
    { name: 'deliver_artifact' },
  ];
  const restricted = composeToolSet(
    businessTools,
    runtimeTools,
    ['read_file'],
    (item) => item.name,
  ).map((item) => item.name);
  const unrestricted = composeToolSet(
    businessTools,
    runtimeTools,
    undefined,
    (item) => item.name,
  ).map((item) => item.name);
  if (restricted.join('|') !== 'read_file|report_plan_progress|deliver_artifact') {
    throw new Error(`业务白名单错误过滤运行时工具: ${restricted.join('|')}`);
  }
  if (unrestricted.join('|') !== 'read_file|write_file|report_plan_progress|deliver_artifact') {
    throw new Error(`无白名单时工具组装错误: ${unrestricted.join('|')}`);
  }
  console.log('[0d] 业务白名单与运行时工具隔离:通过');
}

// [0b] 非流式 Chat Completions 响应是普通 JSON,不能按 SSE 误判成空完成。
{
  const summary = summarizeNonStreamChatCompletionResponse(200, JSON.stringify({
    choices: [{
      finish_reason: 'stop',
      message: { role: 'assistant', content: '{"message":"ok","diagnostics":[],"artifacts":[],"data":null}' },
    }],
  }));
  if (!summary.summary.includes('非流式') || summary.summary.includes('空完成') || summary.emptyTail) {
    throw new Error(`非流式正常响应被误判: ${JSON.stringify(summary)}`);
  }
  const empty = summarizeNonStreamChatCompletionResponse(200, JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
  }));
  if (!empty.emptyTail) throw new Error('真正空的非流式响应没有保留原文尾部');
  console.log('[0b] 非流式响应诊断:通过 |', summary.summary);
}

// [0e] Node/undici 会把流式响应中途断开包装成 TypeError: terminated。
// 这是瞬时连接错误，应该允许 coordinator 继续或安全重试，而不是直接判死。
{
  const error = new TypeError('terminated');
  error.cause = Object.assign(new Error('other side closed'), {
    name: 'SocketError',
    code: 'UND_ERR_SOCKET',
  });
  if (!isRetryableAgentError(error)) {
    throw new Error('TypeError: terminated 没有被识别为可恢复连接错误');
  }
  console.log('[0e] 流式连接 terminated 可恢复分类:通过');
}

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
async function runTestTurn(
  userText,
  decide,
  extraOptions = {},
  runSession = session,
  runConfig = cfg,
) {
  const events = [];
  const runId = `kernel-${++runSequence}`;
  const factory = new AgentEventFactory(runId, runId);
  const protocol = {
    runId,
    operationId: runId,
    eventFactory: factory,
    onEvent: (event) => events.push(event),
  };
  let result = await runAgent(runConfig, runSession, userText, { ...extraOptions, protocol });
  while (result.status === 'awaiting_approval') {
    if (!decide) throw new Error('测试遇到未处理的审批断点');
    const decisions = {};
    for (const approval of result.approvals || []) {
      decisions[approval.id] = await decide(approval.name, approval.args);
    }
    result = await runAgent(runConfig, runSession, userText, {
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
  const contract = normalizeWorkflowContract({
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
    allowedToolNames: [],
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
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
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
  if (toolCalls.join(',') !== 'validate_st_code,commit_st_delivery,write_file') {
    throw new Error('ST 默认落盘没有按校验、候选授权、写入顺序执行');
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
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
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
  if (toolCalls.join(',') !== 'validate_st_code,commit_st_delivery,write_file') {
    throw new Error('ST 摘要误判场景没有收敛到校验、写入、正式交付提交流水线');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 摘要误判场景触发了错误的审批工具');
  }
  if (r.output.includes('文件被截断了，请重新写入') || r.output.includes('请重新写入完整代码')) {
    throw new Error('模型的摘要误判覆盖了已验证的工具事实');
  }
  if (!r.output.includes('正式交付')) {
    throw new Error('最终结果没有确认正式交付 commit');
  }
}

// [3c2a] ST Delivery 允许先用只读标准库工具确认功能块接口,
// 再进入 validate_st_code -> write_file 主交付链路。
{
  const asked = [];
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const r = await runTestTurn(
    '标准库辅助回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'st-library-assisted-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3c2a] ST 标准库辅助:工具链 =', toolCalls.join(','), '| 审批 =', asked.map((item) => item.name).join(','));
  if (toolCalls.join(',') !== 'st_library_symbol,validate_st_code,commit_st_delivery,write_file') {
    throw new Error('ST Delivery 没有按查询、校验、写入、正式交付提交顺序执行');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 标准库辅助场景的审批工具不正确');
  }
}

// [3c2a2] 辅助工具之后如果 ST 草稿校验失败,运行时必须把下一轮拉回
// validate_st_code 修复闭环,不能让模型继续发散到依赖/引用查询直到耗尽 turns。
{
  const asked = [];
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const r = await runTestTurn(
    '辅助失败修正回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'st-assisted-repair-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3c2a2] ST 辅助后修正:工具链 =', toolCalls.join(','), '| 审批 =', asked.map((item) => item.name).join(','));
  if (toolCalls.join(',') !== 'st_library_symbol,validate_st_code,validate_st_code,commit_st_delivery,write_file') {
    throw new Error('ST 辅助查询后校验失败没有按修复、写入、正式交付提交闭环');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 辅助后修正场景的审批工具不正确');
  }
}

// [3c2b] 显式校验失败后不能直接落盘:必须先重新校验修正版,
// 再授权并写入同一份已通过校验的 ST 内容。
{
  const asked = [];
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
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
  if (toolCalls.join(',') !== 'validate_st_code,validate_st_code,commit_st_delivery,write_file') {
    throw new Error('ST 预写校验场景没有阻止失败草稿直接写入并进入正式交付链路');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('ST 预写校验场景的审批工具不正确');
  }
  if (
    completedWrite?.payload?.ok !== true ||
    !completedWrite.payload.result?.data?.deliveryCommit
  ) {
    throw new Error('修正版没有先获得正式交付授权并生成 deliveryCommit');
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
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const diagnosticsStart = diagLines.length;
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
  const validationLog = diagLines
    .slice(diagnosticsStart)
    .find((line) => line.startsWith('[st-validation] failed'));
  console.log(
    '[3c3] ST 草稿修正:工具链 =',
    toolCalls.join(','),
    '| 审批 =',
    asked.map((item) => item.name).join(','),
    '| 诊断旁路 =',
    diagnosticReports.length,
    '| 运行日志 =',
    validationLog ?? '(无)',
  );
  if (toolCalls.join(',') !== 'validate_st_code,validate_st_code,commit_st_delivery,write_file') {
    throw new Error('ST 草稿修正没有按 校验失败 -> 再校验 -> 写入 -> 正式交付提交 顺序执行');
  }
  const diagnosticReport = diagnosticReports[0]?.payload?.report;
  if (
    diagnosticReports.length !== 1 ||
    !Array.isArray(diagnosticReport?.diagnostics) ||
    !diagnosticReport.diagnostics.length ||
    diagnosticReport.repairPacket?.kind !== 'diagnostic_repair_packet' ||
    !validationLog ||
    !validationLog.includes('error=1') ||
    !validationLog.includes('缺少 END_PROGRAM')
  ) {
    throw new Error('ST 草稿校验失败没有产生完整诊断旁路、压缩修复包和运行日志');
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
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
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
  if (toolCalls.join(',') !== 'validate_st_code,commit_st_delivery,write_file') {
    throw new Error('重复 write_file 被批准后不应执行多次写入，且应完成正式交付提交');
  }
  const saved = await fs.readFile(path.join(dir, 'PumpControl.st'), 'utf8');
  if (saved !== DEFAULT_SAVE_ST_CODE || !r.output.includes('PumpControl.st')) {
    throw new Error('重复写入折叠后的保存结果不正确');
  }
}

// [3c4b] 坏模型可能在交付已经完成后又发起新的 write_file。
// 运行时应基于 workflow 已完成状态自动拒绝,不再弹第二张审批卡。
{
  const asked = [];
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const r = await runTestTurn(
    '交付后重复写入回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'post-delivery-duplicate-write-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  const approvalRequests = r.events.filter((event) => event.type === 'approval.requested');
  console.log(
    '[3c4b] 交付后重复写入拦截:工具链 =',
    toolCalls.join(','),
    '| 审批请求 =',
    approvalRequests.length,
    '| decide =',
    asked.map((item) => item.name).join(','),
  );
  if (approvalRequests.length !== 1 || asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('交付完成后的重复 write_file 不应再次暴露给用户审批');
  }
  if (toolCalls.join(',') !== 'validate_st_code,commit_st_delivery,write_file') {
    throw new Error('交付完成后的重复 workflow 工具调用不应再显示或执行');
  }
  const saved = await fs.readFile(path.join(dir, 'PumpControl.st'), 'utf8');
  if (saved !== DEFAULT_SAVE_ST_CODE || !r.output.includes('PumpControl.st')) {
    throw new Error('交付后重复写入拦截后的保存结果不正确');
  }
}

// [3c5] 坏网关/坏模型可能在一次响应里返回多个完全相同的
// validate_st_code。运行时只展示一张成功校验卡,并在成功后强制推进到写入。
{
  const asked = [];
  const capabilityLogStart = diagLines.length;
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码默认保存到当前工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const r = await runTestTurn(
    '重复校验卡片回归',
    async (name, args) => {
      asked.push({ name, args });
      return true;
    },
    { deliveryContract: contract },
    new JsonFileSession(path.join(dir, 'duplicate-validation-session.json')),
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  const freshLogs = diagLines.slice(capabilityLogStart);
  console.log(
    '[3c5] 重复校验折叠:工具链 =',
    toolCalls.join(','),
    '| 审批 =',
    asked.map((item) => item.name).join(','),
  );
  if (toolCalls.join(',') !== 'validate_st_code,validate_st_code,commit_st_delivery,write_file') {
    throw new Error('重复 validate_st_code 没有折叠成单个可见成功校验并推进正式交付提交');
  }
  if (!freshLogs.some((line) => line.includes('下一轮先提交最终候选: commit_st_delivery'))) {
    throw new Error('validate_st_code 成功后没有强制推进到 commit_st_delivery');
  }
  if (asked.length !== 1 || asked[0].name !== 'write_file') {
    throw new Error('重复校验折叠场景触发了错误的审批工具');
  }
  const saved = await fs.readFile(path.join(dir, 'PumpControl.st'), 'utf8');
  if (saved !== DEFAULT_SAVE_ST_CODE || !r.output.includes('PumpControl.st')) {
    throw new Error('重复校验折叠后的保存结果不正确');
  }
}

// [3d] 模型先给了最终答复却没有按契约执行动作时,完成验收必须主动
// 强制验证工具,验证通过后再强制落盘,不能只把修复要求再交给模型自觉处理。
{
  const asked = [];
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码并默认保存到工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
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
  if (toolCalls.join(',') !== 'validate_st_code,commit_st_delivery,write_file') {
    throw new Error('完成验收没有按交付契约强制验证、落盘并提交正式交付');
  }
  if (asked.join(',') !== 'write_file') {
    throw new Error('完成验收兜底触发了错误的审批工具');
  }
}

// [3e] 兼容坏网关/坏模型:即使主 Agent 在结构化输出请求下直接吐普通正文,
// runtime 也要保留正文并进入交付闭环,不能把 SDK 的 schema 错误直接抛给用户。
{
  const asked = [];
  const contract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码并默认保存到工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
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
  if (toolCalls.join(',') !== 'validate_st_code,commit_st_delivery,write_file') {
    throw new Error('普通正文输出没有进入校验、落盘并提交正式交付闭环');
  }
  if (!r.output.includes('PumpControl.st')) {
    throw new Error('普通正文兜底后的最终确认不正确');
  }
}

// [3g] 工作流交付完成后的收尾轮：模型只写一段正文总结，不该再被要求补 JSON。
// 这一轮工具已经收起、不会再产生诊断和产物，重写一次只会把模型写的总结换成账本话。
{
  const asked = [];
  const before = diagLines.length;
  const tailContract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码并保存到工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const r = await runTestTurn(
    '收尾正文回归',
    async (name) => {
      asked.push(name);
      return true;
    },
    {
      workflowId: 'st_workspace_delivery',
      workflowRegistry: createAppWorkflowRegistry(),
      deliveryContract: tailContract,
    },
    new JsonFileSession(path.join(dir, 'tail-plain-text-session.json')),
  );
  const fresh = diagLines.slice(before);
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3g] 交付收尾轮:工具链 =', toolCalls.join(','), '| 正文 =', r.output.split('\n')[0]);
  if (!r.output.includes('语法错误 0 个')) {
    throw new Error('收尾轮的正文没有直接作为最终输出');
  }
  if (!fresh.some((line) => line.includes('按正文收下'))) {
    throw new Error('收尾轮没有走正文直收分支');
  }
  if (fresh.some((line) => line.includes('收尾请求失败'))) {
    throw new Error('收尾轮不该再触发结构化重写');
  }
}

// [3h] 通用交付（有交付契约、没有工作流）的最后一轮写普通正文时，
// 正文就是给用户的结论，同样不该再被结构化收尾器重写一遍。
{
  const asked = [];
  const before = diagLines.length;
  const plainContract = normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: '生成 ST 代码并保存到工作区',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const r = await runTestTurn(
    '通用交付正文回归',
    async (name) => {
      asked.push(name);
      return true;
    },
    { deliveryContract: plainContract },
    new JsonFileSession(path.join(dir, 'generic-plain-delivery-session.json')),
  );
  const fresh = diagLines.slice(before);
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log('[3h] 通用交付收尾:工具链 =', toolCalls.join(','), '| 正文 =', r.output.split('\n')[0]);
  if (toolCalls.join(',') !== 'validate_st_code,commit_st_delivery,write_file') {
    throw new Error('通用交付没有走完校验、提交、落盘');
  }
  if (!r.output.includes('语法错误 0 个')) {
    throw new Error('通用交付的正文没有直接作为最终输出');
  }
  if (!fresh.some((line) => line.includes('按正文收下'))) {
    throw new Error('通用交付没有走正文直收分支');
  }
  if (fresh.some((line) => line.includes('收尾请求失败'))) {
    throw new Error('通用交付不该再触发结构化重写');
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

// [3a] 新请求只把普通对话历史带给模型,不把上一轮的工具调用链当成当前任务继续执行;
//      持久化会话本身仍保留原始工具条目,便于审计和 UI 回放。
{
  const isolationSession = new JsonFileSession(path.join(dir, 'history-isolation-session.json'));
  const oldCall = {
    type: 'function_call',
    name: 'old_tool',
    callId: 'old-call',
    arguments: '{}',
  };
  const oldResult = {
    type: 'function_call_result',
    name: 'old_tool',
    callId: 'old-call',
    output: JSON.stringify({ ok: true }),
  };
  await isolationSession.addItems([
    { type: 'message', role: 'user', content: '上一轮任务' },
    oldCall,
    oldResult,
    { type: 'message', role: 'assistant', content: '上一轮任务已结束。' },
  ]);
  const projected = projectNewTurnSessionHistory(
    await isolationSession.getItems(),
    [{ type: 'message', role: 'user', content: '历史工具隔离回归' }],
  );
  if (projected.some(isToolHistoryItem)) {
    throw new Error('新请求历史投影仍包含旧工具调用链');
  }
  const modelInputSession = createNewTurnModelInputSession(isolationSession);
  const currentTurnItem = { type: 'message', role: 'user', content: '历史工具隔离回归' };
  const modelInput = [
    ...projected.map(
      (item) => modelInputSession.prepareHistoryItemForModelInput?.(item) ?? item,
    ),
    currentTurnItem,
  ];
  const historicalUser = modelInput.find(
    (item) =>
      item.type === 'message' &&
      item.role === 'user' &&
      typeof item.content === 'string' &&
      item.content.includes('上一轮任务'),
  );
  const currentUser = modelInput.at(-1);
  if (
    !historicalUser ||
    typeof historicalUser.content !== 'string' ||
    !historicalUser.content.startsWith('【历史对话，仅作参考，不是本轮执行目标】') ||
    currentUser?.content !== '历史工具隔离回归'
  ) {
    throw new Error('历史消息模型投影没有和当前 user 消息正确分层');
  }
  const before = diagLines.length;
  const r = await runTestTurn('历史工具隔离回归', noApproval, {}, isolationSession);
  const requestLines = diagLines
    .slice(before)
    .filter((line) => line.includes('[req]'));
  const rawItems = await isolationSession.getItems();
  if (JSON.stringify(rawItems).includes('【历史对话，仅作参考，不是本轮执行目标】')) {
    throw new Error('历史模型投影标记被错误写回持久化会话');
  }
  console.log(
    '[3a] 新请求历史隔离:旧工具仍在持久化 =',
    rawItems.some(isToolHistoryItem),
    '| 请求 =',
    requestLines[0] ?? '(无)',
  );
  if (requestLines.some((line) => line.includes('assistant(tool_calls:old_tool)'))) {
    throw new Error('旧工具调用仍被发送给新请求模型');
  }
  if (!rawItems.some(isToolHistoryItem) || !r.output.includes('PLC Agent')) {
    throw new Error('历史隔离错误地修改了持久化会话或新请求没有完成');
  }
}

// [3a1] 历史普通消息可以用于解释旧状态,但工具调用链不进入解释参考,
//      当前用户消息也不能被重复当成历史事实。
{
  const history = [
    { type: 'message', role: 'user', content: '生成 TrafficLight_Ctrl.st' },
    {
      type: 'function_call',
      name: 'write_file',
      callId: 'old-write',
      arguments: JSON.stringify({ path: 'TrafficLight_Ctrl.st' }),
    },
    {
      type: 'function_call_result',
      name: 'write_file',
      callId: 'old-write',
      output: JSON.stringify({ ok: true }),
    },
    {
      type: 'message',
      role: 'assistant',
      content: JSON.stringify({
        message: '之前只修改了 TrafficLight_Ctrl.st 的程序内容，PROGRAM 与任务绑定没有变化。',
        diagnostics: [],
        artifacts: [],
        data: null,
      }),
    },
    { type: 'message', role: 'user', content: '为什么没有写入 plc-runtime.json？' },
  ];
  const historicalContext = buildHistoricalExplanationContext(
    history,
    '为什么没有写入 plc-runtime.json？',
  );
  if (
    !historicalContext.includes('PROGRAM 与任务绑定没有变化') ||
    historicalContext.includes('function_call') ||
    historicalContext.includes('当前用户')
  ) {
    throw new Error('历史解释参考没有正确隔离普通消息、工具链和当前请求');
  }
  console.log('[3a1] 历史解释参考与当前执行证据分离:通过');
}

// [3a2] 工具名有效但参数沿用了旧任务时,统一 guardrail 应在工具实现前拦截,
//       把可恢复错误回传给模型,而不是让旧路径继续进入任意领域工具。
{
  const testToolRisk = (toolName) => {
    if (['read_file', 'search_files', 'list_files'].includes(toolName)) return 'read';
    if (toolName === 'st_dependency_map' || toolName === 'request_clarification') return 'plan';
    if (['write_file', 'edit_file', 'delete_file', 'devuni_create_project'].includes(toolName)) return 'write';
    return 'execute';
  };
  const history = [
    { type: 'message', role: 'user', content: '上一轮读取 yy.txt' },
    {
      type: 'function_call',
      name: 'read_file',
      callId: 'old-read',
      arguments: JSON.stringify({ path: 'yy.txt' }),
    },
  ];
  const guard = createHistoricalToolArgumentGuard(
    history,
    '分析当前工作区里这些 ST 文件之间的依赖关系',
    testToolRisk,
  );
  const rejection = guard?.('st_dependency_map', { path: 'yy.txt' });
  if (!rejection?.includes('yy.txt') || !rejection.includes('已阻止工具')) {
    throw new Error('历史资源参数 guard 没有拦截跨工具旧参数');
  }
  // 同一个文件用相对路径和绝对路径各记过一次，不算两个候选：
  // 用户只有一个文件，不该被问"用哪个路径"。
  const sameFileHistory = [
    { type: 'message', role: 'user', content: '校验 MainProgram.st' },
    {
      type: 'function_call',
      name: 'validate_st_code',
      callId: 'same-1',
      arguments: JSON.stringify({ path: 'MainProgram.st' }),
    },
    { type: 'message', role: 'user', content: '再看 d:\\e\\SC5100\\MainProgram.st 这个' },
    {
      type: 'function_call',
      name: 'validate_st_code',
      callId: 'same-2',
      arguments: JSON.stringify({ path: 'd:\\e\\SC5100\\MainProgram.st' }),
    },
  ];
  const sameFileGuard = createHistoricalToolArgumentGuard(
    sameFileHistory,
    '校验一下项目所有的st文件有没有错误了',
    testToolRisk,
  );
  const sameFileReason = sameFileGuard?.('validate_st_code', { path: 'MainProgram.st' });
  if (sameFileReason?.includes('多个候选资源')) {
    throw new Error('同一文件的相对/绝对写法不应被当成两个候选资源');
  }
  if (!sameFileReason?.includes('不要调用 request_clarification')) {
    throw new Error('候选唯一时应让模型重新取参数，而不是弹窗问用户');
  }
  const explicitGuard = createHistoricalToolArgumentGuard(history, '读取 yy.txt', testToolRisk);
  if (explicitGuard?.('read_file', { path: 'yy.txt' }) !== undefined) {
    throw new Error('当前用户明确指定的资源被错误拦截');
  }
  const continuationGuard = createHistoricalToolArgumentGuard(
    history,
    '继续分析刚才的文件',
    testToolRisk,
  );
  if (continuationGuard?.('st_dependency_map', { path: 'yy.txt' }) !== undefined) {
    throw new Error('明确的历史上下文续接被错误拦截');
  }

  // 澄清问题本身没有副作用，不应因为问题文字提到旧路径而被拦；用户在
  // 本轮弹窗中明确填写的路径，应允许后续工具使用。
  const clarifiedGuard = createHistoricalToolArgumentGuard(
    [
      { type: 'message', role: 'user', content: '在 D:\\ 创建工程 old' },
      {
        type: 'function_call',
        name: 'devuni_create_project',
        callId: 'old-project',
        arguments: JSON.stringify({ projectPath: 'D:\\', projectName: 'old' }),
      },
    ],
    '新建另一个工程',
    testToolRisk,
  );
  if (clarifiedGuard?.('request_clarification', { question: '父目录是否使用 D:\\？' }) !== undefined) {
    throw new Error('澄清工具被历史资源守卫错误拦截');
  }
  if (clarifiedGuard?.('devuni_create_project', { projectPath: 'D:\\', projectName: 'new' }) === undefined) {
    throw new Error('用户确认前不应允许副作用工具复用历史路径');
  }
  clarifiedGuard?.allowConfirmedResources({
    answers: { projectPath: { customText: 'd://' } },
  });
  if (clarifiedGuard?.('devuni_create_project', { projectPath: 'D:\\', projectName: 'new' }) !== undefined) {
    throw new Error('用户在本轮澄清中确认的路径仍被当成历史参数');
  }

  // 最近只有一个活动文件时，省略式追问也允许只读工具继续使用它；
  // 非只读工具仍然需要显式表达继续操作。
  const implicitFollowUpGuard = createHistoricalToolArgumentGuard(
    history,
    '周期分别是多少啊',
    testToolRisk,
  );
  if (implicitFollowUpGuard?.('read_file', { path: 'yy.txt' }) !== undefined) {
    throw new Error('最近唯一文件的自然追问不应拦截 read_file');
  }
  if (implicitFollowUpGuard?.('st_dependency_map', { path: 'yy.txt' }) === undefined) {
    throw new Error('自然追问不应放行非只读工具');
  }
  const naturalReferenceGuard = createHistoricalToolArgumentGuard(
    history,
    '这个程序的周期是多少',
    testToolRisk,
  );
  if (naturalReferenceGuard?.('read_file', { path: 'yy.txt' }) !== undefined) {
    throw new Error('自然语言指代最近唯一程序时应允许只读工具承接');
  }
  const writeWithoutActionGuard = createHistoricalToolArgumentGuard(
    history,
    '继续处理刚才的文件',
    testToolRisk,
  );
  if (writeWithoutActionGuard?.('write_file', { path: 'yy.txt', content: 'new' }) === undefined) {
    throw new Error('仅表达继续上下文不能授权写入');
  }
  const verifiedReadHistory = [
    ...history,
    {
      type: 'function_call_result',
      callId: 'old-read',
      output: JSON.stringify({ ok: true, data: { path: 'yy.txt' } }),
    },
  ];
  const explicitWriteGuard = createHistoricalToolArgumentGuard(
    verifiedReadHistory,
    '继续修改刚才的文件',
    testToolRisk,
  );
  if (explicitWriteGuard?.('write_file', { path: 'yy.txt', content: 'new' }) !== undefined) {
    throw new Error('当前请求明确继续修改已被工具确认的唯一目标时不应拦截');
  }
  const naturalRenameGuard = createHistoricalToolArgumentGuard(
    verifiedReadHistory,
    '改名并把文件一起重命名',
    testToolRisk,
  );
  if (naturalRenameGuard?.('write_file', { path: 'yy.txt', content: 'new' }) !== undefined) {
    throw new Error('自然语言重命名未能承接唯一且已确认的历史目标');
  }
  const unverifiedMutationGuard = createHistoricalToolArgumentGuard(
    history,
    '继续修改刚才的文件',
    testToolRisk,
  );
  if (unverifiedMutationGuard?.('write_file', { path: 'yy.txt', content: 'new' }) === undefined) {
    throw new Error('只有历史工具调用、没有成功回执时不应放行副作用');
  }
  if (!unverifiedMutationGuard?.('write_file', { path: 'yy.txt', content: 'new' }).includes('成功工具回执')) {
    throw new Error('未验证目标的拦截结果没有说明证据不足');
  }

  // Generic resource IDs use the same continuation policy as paths.
  const recordHistory = [
    { type: 'message', role: 'user', content: '读取记录 case-42' },
    {
      type: 'function_call',
      name: 'read_record',
      callId: 'read-record-1',
      arguments: JSON.stringify({ recordId: 'case-42' }),
    },
    {
      type: 'function_call_result',
      callId: 'read-record-1',
      output: JSON.stringify({ ok: true, data: { recordId: 'case-42', status: 'open' } }),
    },
  ];
  const recordRenameGuard = createHistoricalToolArgumentGuard(
    recordHistory,
    'Rename it',
    testToolRisk,
  );
  if (recordRenameGuard?.('update_record', { recordId: 'case-42', name: 'Renamed' }) !== undefined) {
    throw new Error('非文件资源的稳定 ID 未能承接唯一且已确认的历史目标');
  }
  const unrelatedRenameGuard = createHistoricalToolArgumentGuard(
    recordHistory,
    'Rename the new dashboard',
    testToolRisk,
  );
  if (unrelatedRenameGuard?.('update_record', { recordId: 'case-42', name: 'Dashboard' }) === undefined) {
    throw new Error('新目标请求不应因为历史里只有一个 ID 就继承旧目标');
  }
  const selectedRecordGuard = createHistoricalToolArgumentGuard(
    recordHistory.slice(0, 2),
    'update this record',
    testToolRisk,
  );
  if (selectedRecordGuard?.('update_record', { recordId: 'case-42', name: 'Renamed' }) === undefined) {
    throw new Error('澄清前的历史目标不应直接进入副作用工具');
  }
  selectedRecordGuard?.allowConfirmedResources({
    selectedOptionId: 'record-case-42',
    value: JSON.stringify({ recordId: 'case-42' }),
  });
  if (selectedRecordGuard?.('update_record', { recordId: 'case-42', name: 'Renamed' }) !== undefined) {
    throw new Error('用户在本轮澄清中选择的通用资源 ID 仍被拦截');
  }
  const negatedWriteGuard = createHistoricalToolArgumentGuard(
    history,
    '不要修改刚才的文件',
    testToolRisk,
  );
  if (negatedWriteGuard?.('write_file', { path: 'yy.txt', content: 'new' }) === undefined) {
    throw new Error('否定写入意图不应被当作写入授权');
  }
  const historicalQuestionGuard = createHistoricalToolArgumentGuard(
    history,
    '为什么之前没写入这个文件？',
    testToolRisk,
  );
  if (historicalQuestionGuard?.('write_file', { path: 'yy.txt', content: 'new' }) === undefined) {
    throw new Error('询问历史上为何没有写入，不应触发新的写入');
  }
  const politeHistoricalQuestionGuard = createHistoricalToolArgumentGuard(
    history,
    '请问为什么之前没写入这个文件？',
    testToolRisk,
  );
  if (politeHistoricalQuestionGuard?.('write_file', { path: 'yy.txt', content: 'new' }) === undefined) {
    throw new Error('礼貌询问历史操作原因，不应触发新的写入');
  }
  // search_files 的 text 是“要搜什么字”，不是路径；glob 仍然是路径筛选。
  if (implicitFollowUpGuard?.('search_files', { text: 'yy.txt' }) !== undefined) {
    throw new Error('搜索词不应被当成历史资源参数');
  }
  if (guard?.('search_files', { text: 'yy.txt' }) !== undefined) {
    throw new Error('非追问轮次也不应因为搜索词拦截 search_files');
  }

  // 只认疑问或只读请求：“结果”“内容”这类名词、“吧”“啊”这类语气词都不能
  // 把一句命令变成追问。
  const nounGuard = createHistoricalToolArgumentGuard(history, '结果不对，重新生成一版', testToolRisk);
  if (nounGuard?.('read_file', { path: 'yy.txt' }) === undefined) {
    throw new Error('含名词的命令式请求被误判成自然追问');
  }
  const modalGuard = createHistoricalToolArgumentGuard(history, '快点处理吧', testToolRisk);
  if (modalGuard?.('read_file', { path: 'yy.txt' }) === undefined) {
    throw new Error('语气词“吧”被误判成自然追问');
  }

  // 删除类承接：用户说“删掉吧”，指的就是上一轮刚产出的文件，可以有多个。
  // 以前这里一律拦截，模型只能改成“扫目录里所有 .ps1 再删”这种不含文件名的
  // 写法绕过去，比直接删更危险。
  const twoFileHistory = [
    { type: 'message', role: 'user', content: '把这两个临时脚本写出来' },
    {
      type: 'function_call',
      name: 'write_file',
      callId: 'w1',
      arguments: JSON.stringify({ path: '_du_d.ps1', content: 'x' }),
    },
    {
      type: 'function_call',
      name: 'write_file',
      callId: 'w2',
      arguments: JSON.stringify({ path: '_du_d2.ps1', content: 'y' }),
    },
    {
      type: 'function_call_result',
      callId: 'w1',
      output: JSON.stringify({ ok: true, data: { path: '_du_d.ps1' } }),
    },
    {
      type: 'function_call_result',
      callId: 'w2',
      output: JSON.stringify({ ok: true, data: { path: '_du_d2.ps1' } }),
    },
  ];
  const deleteFollowUpGuard = createHistoricalToolArgumentGuard(twoFileHistory, '删掉吧', testToolRisk);
  if (deleteFollowUpGuard?.('delete_file', { path: '_du_d.ps1' }) !== undefined) {
    throw new Error('“删掉吧”承接上一轮的文件时不应被拦');
  }
  if (deleteFollowUpGuard?.('delete_file', { path: '_du_d2.ps1' }) !== undefined) {
    throw new Error('“删掉吧”应当同时放行上一轮产出的多个文件');
  }
  const nonDeleteGuard = createHistoricalToolArgumentGuard(twoFileHistory, '这两个脚本讲的是什么', testToolRisk);
  if (nonDeleteGuard?.('delete_file', { path: '_du_d.ps1' }) === undefined) {
    throw new Error('非删除请求不应放行删除类工具复用旧路径');
  }
  const staleDeleteHistory = [
    { type: 'message', role: 'user', content: '写 _old.ps1' },
    {
      type: 'function_call',
      name: 'write_file',
      callId: 'w0',
      arguments: JSON.stringify({ path: '_old.ps1', content: 'x' }),
    },
    { type: 'message', role: 'user', content: '看看别的' },
    { type: 'message', role: 'user', content: '再看看' },
    { type: 'message', role: 'user', content: '还在吗' },
  ];
  const staleDeleteGuard = createHistoricalToolArgumentGuard(staleDeleteHistory, '删掉吧', testToolRisk);
  if (staleDeleteGuard?.('delete_file', { path: '_old.ps1' }) === undefined) {
    throw new Error('超过最近两轮的旧目标不应被“删掉吧”放行');
  }
  const staleContinuationGuard = createHistoricalToolArgumentGuard(
    staleDeleteHistory,
    '继续查看刚才的文件',
    testToolRisk,
  );
  if (staleContinuationGuard?.('read_file', { path: '_old.ps1' }) === undefined) {
    throw new Error('超过最近两轮的旧目标不应被“继续”重新激活');
  }

  const noisyHistory = [
    ...history,
    {
      type: 'function_call_output',
      callId: 'old-read',
      output: JSON.stringify({ matches: ['other-a.txt', 'other-b.txt', 'other-c.txt'] }),
    },
  ];
  const noisyFollowUpGuard = createHistoricalToolArgumentGuard(
    noisyHistory,
    '周期分别是多少啊',
    testToolRisk,
  );
  if (noisyFollowUpGuard?.('read_file', { path: 'yy.txt' }) !== undefined) {
    throw new Error('工具回执中的多个文件名不应让唯一活动目标变成歧义');
  }

  const ambiguousHistory = [
    { type: 'message', role: 'user', content: '读取 a.txt' },
    {
      type: 'function_call',
      name: 'read_file',
      callId: 'old-a',
      arguments: JSON.stringify({ path: 'a.txt' }),
    },
    { type: 'message', role: 'user', content: '再读取 b.txt' },
    {
      type: 'function_call',
      name: 'read_file',
      callId: 'old-b',
      arguments: JSON.stringify({ path: 'b.txt' }),
    },
  ];
  const ambiguousGuard = createHistoricalToolArgumentGuard(
    ambiguousHistory,
    '周期分别是多少啊',
    testToolRisk,
  );
  if (ambiguousGuard?.('read_file', { path: 'b.txt' }) === undefined) {
    throw new Error('存在多个近期文件时不应猜测自然追问的目标');
  }
  const ambiguousReason = ambiguousGuard?.('read_file', { path: 'b.txt' });
  if (!ambiguousReason?.includes('request_clarification') || !ambiguousReason.includes('a.txt')) {
    throw new Error('多目标追问应要求先澄清并给出候选资源');
  }
  // “继续”也不再一律放行：上一轮碰过两个文件时同样退回澄清。
  const ambiguousContinueGuard = createHistoricalToolArgumentGuard(
    ambiguousHistory,
    '继续处理刚才的文件',
    testToolRisk,
  );
  if (ambiguousContinueGuard?.('read_file', { path: 'b.txt' }) === undefined) {
    throw new Error('多个近期目标时“继续”不应直接选定其中一个');
  }

  // 相对目录没有扩展名，也必须能认出来，否则 list_files 带旧目录时守卫不响。
  // 参数名按真实 schema 用 dir。
  const directoryHistory = [
    { type: 'message', role: 'user', content: '列出 src/runtime 下的文件' },
    {
      type: 'function_call',
      name: 'list_files',
      callId: 'old-list',
      arguments: JSON.stringify({ dir: 'src/runtime' }),
    },
  ];
  const directoryGuard = createHistoricalToolArgumentGuard(
    directoryHistory,
    '分析当前工作区的 ST 依赖关系',
    testToolRisk,
  );
  if (directoryGuard?.('list_files', { dir: 'src/runtime' }) === undefined) {
    throw new Error('相对目录路径没有被识别为历史资源');
  }
  // text 跳过，glob 仍然算路径，不能被一起放过。
  if (directoryGuard?.('search_files', { glob: 'src/runtime' }) === undefined) {
    throw new Error('search_files 的 glob 仍然是路径，应该检查');
  }
  if (directoryGuard?.('search_files', { text: 'src/runtime' }) !== undefined) {
    throw new Error('search_files 的 text 不是路径，不应该检查');
  }

  // 中文和路径粘在一起时，显示和比对都应该只取文件名，不能整句吞进去。
  // 这里只留一条用户消息：工具调用里再带一遍路径的话，就算裁剪失败也能过。
  const gluedHistory = [
    { type: 'message', role: 'user', content: '读取yy.txt并总结' },
  ];
  const gluedRejection = createHistoricalToolArgumentGuard(
    gluedHistory,
    '分析当前工作区的 ST 依赖关系',
    testToolRisk,
  )?.('st_dependency_map', { path: 'yy.txt' });
  if (!gluedRejection?.includes('yy.txt')) {
    throw new Error('粘连中文的历史路径没有被识别');
  }
  if (gluedRejection.includes('读取yy.txt并总结')) {
    throw new Error('整句仍然被当成文件路径');
  }
  // 无空格的中文文件名也要能从开头的请求动词后拆出来，不能把整句吞成路径。
  const chineseNameGuard = createHistoricalToolArgumentGuard(
    [
      {
        type: 'message',
        role: 'user',
        content: '读取日志.st 读取变量A.st 读取项目1.st',
      },
    ],
    '分析当前工作区的 ST 依赖关系',
    testToolRisk,
  );
  for (const name of ['日志.st', '变量A.st', '项目1.st']) {
    const gluedName = `读取${name}`;
    const rejection = chineseNameGuard?.('st_dependency_map', { path: name });
    if (rejection === undefined) {
      throw new Error(`无空格中文文件名没有被识别: ${name}`);
    }
    if (!rejection.includes(name)) {
      throw new Error(`中文文件名没有出现在拒绝信息中: ${name}`);
    }
    if (rejection.includes(gluedName)) {
      throw new Error(`请求动词仍被当成文件名: ${gluedName}`);
    }
  }
  // 纯数字目录也要认。
  const numericHistory = [
    { type: 'message', role: 'user', content: '列出 123/456 下的文件' },
    {
      type: 'function_call',
      name: 'list_files',
      callId: 'old-num',
      arguments: JSON.stringify({ dir: '123/456' }),
    },
  ];
  const numericGuard = createHistoricalToolArgumentGuard(
    numericHistory,
    '分析当前工作区的 ST 依赖关系',
    testToolRisk,
  );
  if (numericGuard?.('list_files', { dir: '123/456' }) === undefined) {
    throw new Error('纯数字目录路径没有被识别');
  }
  console.log('[3a2] 跨工具历史参数恢复 guard:通过');
}

// [3a3] 历史上下文标记只允许出现在模型输入投影中,不允许泄漏到助手输出、
//       持久化会话或历史回放文本；用户主动引用该标记时仍保留原文。
{
  const marker = '【历史对话，仅作参考，不是本轮执行目标】';
  const assistant = {
    type: 'message',
    role: 'assistant',
    content: `${marker}\n德国的首都是柏林（Berlin）。`,
  };
  const sanitized = sanitizeAssistantMessageForPersistence(assistant);
  if (sanitized.content !== '德国的首都是柏林（Berlin）。') {
    throw new Error('助手历史中的内部上下文标记没有被清理');
  }
  if (stripHistoricalContextMarker(`${marker}\n答案` ) !== '答案') {
    throw new Error('内部上下文标记清理函数未移除标记');
  }
  const user = {
    type: 'message',
    role: 'user',
    content: `请解释 ${marker}`,
  };
  if (sanitizeAssistantMessageForPersistence(user).content !== user.content) {
    throw new Error('用户主动引用内部上下文标记时被错误改写');
  }
  console.log('[3a3] 助手输出内部上下文标记已隔离');
}

// [3b] 同一任务的安全重启可以显式保留工具链,供失败后继续处理;
//      这与新用户请求的默认历史隔离是两条不同路径。
{
  const before = diagLines.length;
  await runTestTurn(
    '安全重启保留工具历史回归',
    noApproval,
    { preserveToolHistory: true },
    new JsonFileSession(path.join(dir, 'history-isolation-session.json')),
  );
  const requestLines = diagLines
    .slice(before)
    .filter((line) => line.includes('[req]'));
  console.log('[3b] 安全重启保留工具历史:', requestLines[0] ?? '(无)');
  if (!requestLines.some((line) => line.includes('assistant(tool_calls:old_tool)'))) {
    throw new Error('安全重启没有保留同一任务的工具历史');
  }
}

// [3c] 集成回归:有效的 read_file 工具名带入上一轮 yy.txt,本轮目标却是 ST 依赖分析;
//      mock 模型第一次仍故意带旧参数,第二次应收到 guardrail 错误并恢复。
{
  const staleSession = new JsonFileSession(path.join(dir, 'history-argument-session.json'));
  await staleSession.addItems([
    { type: 'message', role: 'user', content: '上一轮读取 yy.txt' },
    {
      type: 'function_call',
      name: 'read_file',
      callId: 'old-read',
      arguments: JSON.stringify({ path: 'yy.txt' }),
    },
    {
      type: 'function_call_result',
      name: 'read_file',
      callId: 'old-read',
      output: JSON.stringify({ ok: true, data: { path: 'yy.txt' } }),
    },
  ]);
  const before = diagLines.length;
  const r = await runTestTurn(
    '历史参数恢复回归',
    noApproval,
    {},
    staleSession,
  );
  const turnDiagnostics = diagLines.slice(before);
  const staleLog = turnDiagnostics.find((line) => line.includes('[context] 疑似沿用了历史对话中的资源参数'));
  const results = r.events.filter((event) => event.type === 'tool.completed');
  console.log(
    '[3c] 历史参数恢复:模型调用 =',
    r.usage.requests,
    '| 工具回执 =',
    results.map((event) => `${event.payload.toolName}:${event.payload.ok}`).join(','),
    '| 输出 =',
    r.output,
  );
  if (!staleLog || !r.output.includes('历史工具参数')) {
    throw new Error('有效工具名的历史参数没有被 guardrail 回传并恢复');
  }
  const staleResult = results.find((event) => event.payload.toolName === 'read_file');
  if (!staleResult?.payload.summary?.includes('已阻止工具 read_file 执行')) {
    throw new Error('历史参数没有在工具实现前被 guardrail 拦截');
  }
  if (r.usage.requests < 2) {
    throw new Error('历史参数恢复没有触发模型重试');
  }
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
  if (!files.some((name) => name.toLowerCase() === 'stardelta.st')) {
    throw new Error('场景5 批准后未落盘');
  }
  const capabilityRequests = diagLines
    .slice(capabilityLogStart)
    .filter((line) => line.includes('[req]'));
  if (!capabilityRequests.some((line) => line.includes('format=json_schema') && line.includes('choice=-'))) {
    throw new Error('场景5 首轮工具选择没有保持 auto');
  }
}

// [5a] 完全访问:副作用工具自动批准,但仍走同一套工具与回执链路。
{
  const fullAccessSession = new JsonFileSession(
    path.join(dir, 'full-access-session.json'),
  );
  const r = await runTestTurn(
    '把上面的程序导出为文件',
    undefined,
    {},
    fullAccessSession,
    { ...cfg, permissionMode: 'full_access' },
  );
  const approvalRequests = r.events.filter(
    (event) => event.type === 'approval.requested',
  );
  const toolCalls = r.events
    .filter((event) => event.type === 'tool.started')
    .map((event) => event.payload.toolName);
  console.log(
    '[5a] 完全访问:审批请求 =',
    approvalRequests.length,
    '| 工具链 =',
    toolCalls.join(','),
  );
  if (
    r.status !== 'completed' ||
    approvalRequests.length !== 0 ||
    !toolCalls.includes('export_st_program')
  ) {
    throw new Error('完全访问没有自动批准副作用工具或工具链未完成');
  }
}

// [6] 首轮 auto 未执行动作时,第二轮只发送一次普通提醒,不强制 tool_choice。
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
  const reminderLog = diagLines
    .slice(capabilityLogStart)
    .find((line) => line.includes('[action]') && line.includes('不强制 toolChoice'));
  console.log(
    '[6] 普通动作提醒:首轮 =',
    capabilityRequests[0] ?? '(无)',
    '| 提醒 =',
    reminderLog ?? '(无)',
  );
  if (!capabilityRequests[0]?.includes('choice=-')) {
    throw new Error('场景6 首轮没有使用 auto 工具选择');
  }
  if (!reminderLog || capabilityRequests.length < 2) {
    throw new Error('场景6 首轮未执行动作后没有发送普通提醒');
  }
  if (capabilityRequests.some((line) => line.includes('choice={'))) {
    throw new Error('场景6 普通动作提醒错误地设置了强制 tool_choice');
  }
  if (asked.length !== 1 || asked[0].name !== 'export_st_program' || !r.output.includes('导出')) {
    throw new Error('场景6 普通动作提醒后没有完成审批和导出');
  }
}

// [6b] 查询上一轮状态时,即使动作词出现在问题里,也不能因为没有可用工具而
// 强制 write_file,否则会在 SDK 本地校验阶段直接崩溃。
{
  const capabilityLogStart = diagLines.length;
  const r = await runTestTurn(
    '刚刚写入了哪个文件了',
    noApproval,
    { allowedToolNames: [] },
    new JsonFileSession(path.join(dir, 'action-query-session.json')),
  );
  const capabilityRequests = diagLines
    .slice(capabilityLogStart)
    .filter((line) => line.includes('[req]'));
  console.log(
    '[6b] 动作查询不强制工具:请求 =',
    capabilityRequests.length,
    '| 输出 =',
    r.output,
  );
  if (r.status !== 'completed' || capabilityRequests.some((line) => line.includes('choice={'))) {
    throw new Error('动作查询错误地强制了 write_file');
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

// [8] 死循环 → 普通预算边界可恢复(放最后:会往会话里灌 10 轮工具往返)
{
  let thrown = null;
  try {
    await runTestTurn('写一个循环测试程序', noApproval);
  } catch (e) {
    thrown = e;
  }
  console.log('[7] 死循环: 抛出 =', thrown?.constructor?.name, '| 可恢复状态 =', Boolean(getResumableAgentState(thrown)));
  if (!(thrown instanceof TurnBudgetExceededError) || !getResumableAgentState(thrown)) {
    throw new Error('场景7 未保存可恢复的普通预算断点');
  }
  const continuationStart = diagLines.length;
  let continuationResult;
  let continuationError;
  try {
    continuationResult = await runAgent(cfg, session, '写一个循环测试程序', {
      initialState: getResumableAgentState(thrown),
      continueTurnBudget: true,
      protocol: {
        runId: 'kernel-budget-continuation',
        operationId: 'kernel-budget-continuation',
        eventFactory: new AgentEventFactory(
          'kernel-budget-continuation',
          'kernel-budget-continuation',
        ),
        onEvent: () => {},
      },
    });
  } catch (error) {
    continuationError = error;
  }
  const continuationRequests = diagLines
    .slice(continuationStart)
    .filter((line) => line.includes('[req]') && line.includes('mock-model'))
    .length;
  if (
    continuationRequests === 0 ||
    (continuationError !== undefined && !(continuationError instanceof TurnBudgetExceededError)) ||
    (continuationResult !== undefined && !['completed', 'cancelled'].includes(continuationResult.status))
  ) {
    throw new Error(`普通预算续跑没有进入下一段: ${JSON.stringify({ continuationRequests, continuationError: continuationError?.name, status: continuationResult?.status })}`);
  }
  console.log('[7b] 普通预算续跑:请求数 =', continuationRequests, '| 结果 =', continuationResult?.status ?? continuationError?.name);
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

// [8c0] 模型收到成功只读回执后重复发起相同 read_file → 只允许第一次真正执行
{
  await fs.writeFile(path.join(dir, 'repeat.txt'), '重复读取内容', 'utf8');
  const capabilityLogStart = diagLines.length;
  const r = await runTestTurn(
    '重复读取回归 repeat.txt',
    noApproval,
    {},
    new JsonFileSession(path.join(dir, 'duplicate-read-session.json')),
  );
  const started = r.events.filter(
    (event) => event.type === 'tool.started' && event.payload.toolName === 'read_file',
  );
  const completed = r.events.filter(
    (event) => event.type === 'tool.completed' && event.payload.toolName === 'read_file',
  );
  const dedupeLog = diagLines
    .slice(capabilityLogStart)
    .find((line) => line.includes('[tool-dedupe]'));
  console.log(
    '[8c0] 重复只读调用收敛:started =',
    started.length,
    '| completed =',
    completed.length,
    '| dedupe =',
    dedupeLog ?? '(无)',
  );
  if (started.length !== 1 || completed.length !== 1) {
    throw new Error('重复 read_file 没有在工具执行和 UI 事件层收敛');
  }
  if (!dedupeLog || !r.output.includes('repeat.txt')) {
    throw new Error('重复 read_file 收敛后没有留下诊断或最终答复');
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
  const diagnosticsStart = diagLines.length;
  const r = await runTestTurn('写入 schema崩写入.txt', async () => true);
  const written = await fs.readFile(path.join(dir, 'schema崩写入.txt'), 'utf8');
  const toolCalls = r.events.filter((e) => e.type === 'tool.started').map((e) => e.payload.toolName);
  const diagnosticsDeadline = Date.now() + 1_000;
  while (
    Date.now() < diagnosticsDeadline &&
    !diagLines.slice(diagnosticsStart).some((line) => line.includes('[resp]') && line.includes('非流式'))
  ) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const turnDiagnostics = diagLines.slice(diagnosticsStart);
  const finalizerLines = turnDiagnostics.filter((line) => line.includes('[resp]') && line.includes('非流式'));
  console.log('[9b] 写入后 schema 崩兜底:工具链 =', toolCalls.join(','), '| 内容 =', written, '| 输出 =', r.output);
  if (toolCalls.join(',') !== 'write_file' || written !== 'hello' || !r.output.includes('schema崩写入.txt')) {
    throw new Error('最终 schema 崩溃后没有按成功 write_file 工具账本完成');
  }
  if (
    !finalizerLines.length ||
    turnDiagnostics.some((line) =>
      line.includes('流式空完成原文') || line.includes('非流式空完成原文'),
    )
  ) {
    throw new Error('非流式最终收尾仍被诊断器误判为空完成');
  }
}

// [9c] 模型回放了当前工具表之外的旧工具时,运行时应把错误回传给模型,
//      而不是直接抛出 ModelBehaviorError 终止本轮。
{
  const before = diagLines.length;
  const r = await runTestTurn(
    '未知工具恢复回归',
    noApproval,
    {},
    new JsonFileSession(path.join(dir, 'unknown-tool-session.json')),
  );
  const requestLines = diagLines
    .slice(before)
    .filter((line) => line.includes('[req]'));
  console.log(
    '[9c] 未知工具恢复:模型调用 =',
    r.usage.requests,
    '| 输出 =',
    r.output,
    '| 请求数 =',
    requestLines.length,
  );
  if (!r.output.includes('未知工具已被运行时拒绝')) {
    throw new Error('未知工具没有回传给模型并恢复当前请求');
  }
  if (r.usage.requests < 2 || requestLines.length < 2) {
    throw new Error('未知工具恢复没有产生第二次模型请求');
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
  if (!r.output.includes('已导出') || !r.output.toLowerCase().includes('stardelta.st')) {
    throw new Error('场景9 未用工具结果生成兜底输出');
  }
  const okResult = results.find((e) => e.payload.toolName === 'export_st_program' && e.payload.ok);
  if (!okResult || !okResult.payload.summary.toLowerCase().includes('stardelta.st')) {
    throw new Error('场景9 未透出成功的工具回执');
  }
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
  if (!r.output.includes('已导出') || !r.output.toLowerCase().includes('stardelta.st')) {
    throw new Error('场景10 未用工具结果生成兜底输出');
  }
  if (!respLine) throw new Error('场景10 诊断日志未识别出"正文0/推理>0"的响应');
  if (!r.events.some((e) => e.type === 'tool.completed' && e.payload.ok)) throw new Error('场景10 工具回执丢失');
}

console.log(`\n全部通过 ✔ (MAX_TURNS=${MAX_TURNS},工作目录 ${dir})`);
