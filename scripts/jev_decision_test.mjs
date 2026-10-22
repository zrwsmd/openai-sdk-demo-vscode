import {
  AgentDecisionService,
  classifyDeliveryContract,
  isStWorkspaceDeliveryContract,
  JevDecisionProvider,
  getDefaultToolRegistry,
  routeTeamTask,
  WorkflowDecisionService,
} from './agent.testbundle.mjs';

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

let calls = 0;
let lastRequest;
const provider = new JevDecisionProvider(
  {
    apiKey: 'test-key',
    model: 'jev-latest',
    timeoutMs: 1_000,
    maxRetries: 0,
  },
  async (url, init) => {
    calls += 1;
    lastRequest = { url, init };
    return response({
      model: 'jev-test',
      answers: {
        delivery: { type: 'noul', noul: 0.96 },
        orchestration: {
          type: 'choice',
          choice: 'single',
          probabilities: { single: 0.94, team: 0.06 },
          confidence: 0.88,
        },
      },
      usage: { input_tokens: 11, output_tokens: 7 },
    });
  },
);

const evaluation = await provider.evaluate({
  state: { request: '读取 yy.txt' },
  questions: {
    delivery: {
      type: 'noul',
      instructions: '是否需要交付物？',
      criteria: { true: '需要', false: '不需要' },
    },
  },
});
if (evaluation.status !== 'ok') throw new Error('Jev success response was not accepted');
if (evaluation.usage?.inputTokens !== 11 || evaluation.answers?.delivery?.noul !== 0.96) {
  throw new Error('Jev response fields were not normalized');
}
if (lastRequest?.url !== 'https://api.typesafe.ai/v1/systemone') {
  throw new Error(`unexpected Jev endpoint: ${lastRequest?.url}`);
}
if (lastRequest?.init?.headers?.Authorization !== 'Bearer test-key') {
  throw new Error('Jev authorization header missing');
}

const savedTypesafeKey = process.env.TYPESAFE_API_KEY;
delete process.env.TYPESAFE_API_KEY;
try {
  const disabled = new JevDecisionProvider({ enabled: true });
  const disabledResult = await disabled.evaluate({
    state: 'offline',
    questions: {
      delivery: { type: 'noul', instructions: 'x' },
    },
  });
  if (disabledResult.status !== 'disabled') {
    throw new Error('missing Jev key should use disabled/fallback status');
  }
} finally {
  if (savedTypesafeKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = savedTypesafeKey;
}

const originalFetch = globalThis.fetch;
let sharedCalls = 0;
globalThis.fetch = async (_url, init) => {
  sharedCalls += 1;
  const body = JSON.parse(init?.body ?? '{}');
  if (body.questions?.looks_complete) {
    return response({
      model: 'jev-test',
      answers: {
        looks_complete: { type: 'noul', noul: 0.93 },
        missing_deliverable: { type: 'noul', noul: 0.03 },
        next_action: {
          type: 'choice',
          choice: 'pass',
          probabilities: { pass: 0.9, retry: 0.03, revise: 0.03, stop: 0.02, escalate: 0.02 },
          confidence: 0.9,
        },
      },
      usage: { input_tokens: 21, output_tokens: 9 },
    });
  }
  if (body.questions?.repair_action) {
    return response({
      model: 'jev-test',
      answers: {
        repair_action: {
          type: 'choice',
          choice: 'revise',
          probabilities: { retry: 0.04, revise: 0.91, stop: 0.02, escalate: 0.03 },
          confidence: 0.91,
        },
      },
      usage: { input_tokens: 18, output_tokens: 5 },
    });
  }
  return response({
    model: 'jev-test',
    answers: {
      delivery: { type: 'noul', noul: 0.04 },
      orchestration: {
        type: 'choice',
        choice: 'single',
        probabilities: { single: 0.91, team: 0.09 },
        confidence: 0.86,
      },
      workflow: {
        type: 'choice',
        choice: 'file_read',
        probabilities: { file_read: 0.92, file_edit: 0.03, general_chat: 0.05 },
        confidence: 0.92,
      },
      needs_read_file: { type: 'noul', noul: 0.95 },
      needs_write_file: { type: 'noul', noul: 0.02 },
      needs_validate_st_code: { type: 'noul', noul: 0.01 },
      needs_run_command: { type: 'noul', noul: 0.03 },
      needs_approval: { type: 'noul', noul: 0.02 },
      risk_level: {
        type: 'choice',
        choice: 'low',
        probabilities: { low: 0.89, medium: 0.07, high: 0.03, critical: 0.01 },
        confidence: 0.89,
      },
    },
    usage: { input_tokens: 13, output_tokens: 8 },
  });
};
try {
  const service = new AgentDecisionService();
  const settings = { apiKey: 'test-key', minConfidence: 0.78 };
  const first = await service.taskHint(settings, '查看当前工作区文件');
  const second = await service.taskHint(settings, '查看当前工作区文件');
  if (sharedCalls !== 1) throw new Error(`expected one shared Jev call, got ${sharedCalls}`);
  if (first.delivery !== 'not_required' || first.orchestration !== 'single') {
    throw new Error('Jev task hint did not apply confidence thresholds');
  }
  if (
    first.workflow !== 'file_read' ||
    first.toolNeeds.readFile.value !== 'yes' ||
    first.toolNeeds.writeFile.value !== 'no' ||
    first.riskLevel !== 'low' ||
    first.needsApproval.value !== 'no'
  ) {
    throw new Error('Jev workflow/tool/risk hint was not normalized');
  }
  if (second.evaluation.usage?.inputTokens !== 13) {
    throw new Error('cached Jev task hint changed its result');
  }
  const completion = await service.completionGateHint(settings, {
    userText: '读取 yy.txt',
    finalMessage: '已读取 yy.txt。',
    rulePassed: true,
    deliveryRequired: false,
    issueSummaries: [],
    toolSummaries: ['read_file ok=true'],
    artifactSummaries: [],
  });
  if (completion.nextAction !== 'pass' || completion.missingDeliverable.value !== 'no') {
    throw new Error('Jev completion gate hint was not normalized');
  }
  const recovery = await service.diagnosticRecoveryHint(settings, {
    userText: '生成 ST 代码',
    failureReason: 'ST 校验未通过',
    issues: ['validate_st_code: syntax error'],
  });
  if (recovery.action !== 'revise') {
    throw new Error('Jev diagnostic recovery hint was not normalized');
  }
  if (sharedCalls !== 3) {
    throw new Error(`expected one cached task call plus two advisory calls, got ${sharedCalls}`);
  }
} finally {
  globalThis.fetch = originalFetch;
}

// MCP intent questions are added to the shared triage request and normalized
// back to per-server signals without requiring a second model call.
const originalMcpIntentFetch = globalThis.fetch;
let mcpIntentRequest;
globalThis.fetch = async (_url, init) => {
  mcpIntentRequest = JSON.parse(init?.body ?? '{}');
  const questionKeys = Object.keys(mcpIntentRequest.questions ?? {});
  const filesKey = questionKeys.find((key) => key.startsWith('needs_mcp_server_files_'));
  const databaseKey = questionKeys.find((key) => key.startsWith('needs_mcp_server_database_'));
  const borderlineKey = questionKeys.find((key) => key.startsWith('needs_mcp_server_borderline_'));
  return response({
    model: 'jev-test',
    answers: {
      [filesKey]: { type: 'noul', noul: 0.96 },
      [databaseKey]: { type: 'noul', noul: 0.03 },
      [borderlineKey]: { type: 'noul', noul: 0.15 },
    },
    usage: { input_tokens: 7, output_tokens: 3 },
  });
};
try {
  const mcpHint = await new AgentDecisionService().taskHint(
    { apiKey: 'test-key', minConfidence: 0.78 },
    '查询文件服务中的内容',
    undefined,
    {
      mcpServerChoices: [
        { name: 'files', description: 'read_file: read workspace files' },
        { name: 'database', description: 'query_records: query database records' },
        { name: 'borderline', description: 'optional capability' },
      ],
    },
  );
  if (
    !Object.keys(mcpIntentRequest?.questions ?? {}).some((key) => key.startsWith('needs_mcp_server_files_')) ||
    !Object.keys(mcpIntentRequest?.questions ?? {}).some((key) => key.startsWith('needs_mcp_server_database_')) ||
    !Object.keys(mcpIntentRequest?.questions ?? {}).some((key) => key.startsWith('needs_mcp_server_borderline_')) ||
    mcpHint.mcpServerNeeds?.files?.value !== 'yes' ||
    mcpHint.mcpServerNeeds?.database?.value !== 'no' ||
    mcpHint.mcpServerNeeds?.borderline?.value !== 'unknown'
  ) {
    throw new Error('MCP server intent was not included or normalized');
  }
} finally {
  globalThis.fetch = originalMcpIntentFetch;
}

let deliveryClassifierCalls = 0;
globalThis.fetch = async () => {
  deliveryClassifierCalls += 1;
  return response({
    model: 'jev-test',
    answers: {
      delivery: { type: 'noul', noul: 0.04 },
      orchestration: {
        type: 'choice',
        choice: 'single',
        probabilities: { single: 0.45, team: 0.35 },
        confidence: 0.2,
      },
      workflow: {
        type: 'choice',
        choice: 'st_delivery',
        probabilities: { st_delivery: 0.93, general_chat: 0.04, file_read: 0.02, file_edit: 0.01 },
        confidence: 0.93,
      },
      needs_read_file: { type: 'noul', noul: 0.11 },
      needs_write_file: { type: 'noul', noul: 0.52 },
      needs_validate_st_code: { type: 'noul', noul: 0.7 },
      needs_run_command: { type: 'noul', noul: 0.05 },
      needs_approval: { type: 'noul', noul: 0.48 },
      risk_level: {
        type: 'choice',
        choice: 'medium',
        probabilities: { low: 0.2, medium: 0.55, high: 0.18, critical: 0.07 },
        confidence: 0.55,
      },
    },
    usage: { input_tokens: 31, output_tokens: 12 },
  });
};
try {
  const contract = await classifyDeliveryContract(
    {
      apiKey: 'unused',
      baseUrl: '',
      model: 'unused',
      exportDir: '',
      workspaceRoot: '',
      jev: { apiKey: 'test-key', minConfidence: 0.78, maxRetries: 0 },
    },
    '法国的首都是哪里？',
  );
  if (deliveryClassifierCalls !== 1) {
    throw new Error(`expected one generic delivery hint call, got ${deliveryClassifierCalls}`);
  }
  if (contract?.requiresDeliverable !== false) {
    throw new Error('generic delivery classifier should honor Jev not-required result');
  }
} finally {
  globalThis.fetch = originalFetch;
}

globalThis.fetch = async () => response({
  model: 'jev-test',
  answers: {
    delivery: { type: 'noul', noul: 0.5 },
    orchestration: {
      type: 'choice',
      choice: 'single',
      probabilities: { single: 0.5, team: 0.5 },
      confidence: 0,
    },
    workflow: {
      type: 'choice',
      choice: 'st_delivery',
      probabilities: { st_delivery: 0.94, general_chat: 0.03, file_read: 0.02, file_edit: 0.01 },
      confidence: 0.94,
    },
  },
  usage: { input_tokens: 9, output_tokens: 4 },
});
try {
  const workflowDecision = await new WorkflowDecisionService().decide(
    {
      apiKey: 'unused',
      baseUrl: '',
      model: 'unused',
      exportDir: '',
      workspaceRoot: '',
      jev: { apiKey: 'test-key', minConfidence: 0.78, maxRetries: 0 },
    },
    '给我生成一个 ST 语言 PLC 控制程序并保存文件',
  );
  if (workflowDecision.kind !== 'workflow' || workflowDecision.workflow.id !== 'st_workspace_delivery') {
    throw new Error('Jev workflow decision did not route to registered ST workflow');
  }
  if (!isStWorkspaceDeliveryContract(workflowDecision.contract)) {
    throw new Error('Jev workflow decision did not attach an ST delivery contract');
  }
  if (
    !workflowDecision.signals.toolNeeds ||
    !workflowDecision.signals.needsApproval ||
    workflowDecision.signals.delivery !== 'unknown'
  ) {
    throw new Error('Workflow decision did not carry reusable Jev tool and approval signals');
  }
} finally {
  globalThis.fetch = originalFetch;
}

// A Coordinator-provided Workflow signal is sufficient for Team routing. The
// route helper must not ask Jev again when it already has the signal.
{
  const signals = {
    delivery: 'not_required',
    deliveryConfidence: 0.94,
    orchestration: 'single',
    orchestrationConfidence: 0.96,
    riskLevel: 'low',
    riskConfidence: 0.9,
    toolNeeds: {
      readFile: { value: 'no', confidence: 0.9 },
      writeFile: { value: 'no', confidence: 0.9 },
      runCommand: { value: 'no', confidence: 0.9 },
    },
    needsApproval: { value: 'no', confidence: 0.9 },
  };
  const routed = await routeTeamTask(
    {
      apiKey: 'unused',
      baseUrl: '',
      model: 'unused',
      exportDir: '',
      workspaceRoot: '',
      jev: { enabled: true },
      decisionService: {
        taskHint: async () => {
          throw new Error('routeTeamTask requested duplicate Jev evaluation');
        },
      },
    },
    '普通问答',
    undefined,
    [],
    signals,
  );
  if (routed !== undefined) {
    throw new Error('reused single orchestration signal did not skip Team routing');
  }
}

globalThis.fetch = async () => response({
  model: 'jev-test',
  answers: {
    delivery: { type: 'noul', noul: 0.08 },
    orchestration: {
      type: 'choice',
      choice: 'single',
      probabilities: { single: 0.95, team: 0.05 },
      confidence: 0.95,
    },
    workflow: {
      type: 'choice',
      choice: 'file_read',
      probabilities: {
        file_read: 0.96,
        st_delivery: 0.01,
        general_chat: 0.03,
      },
      confidence: 0.96,
    },
    needs_read_file: { type: 'noul', noul: 0.97 },
    needs_write_file: { type: 'noul', noul: 0.02 },
    needs_validate_st_code: { type: 'noul', noul: 0.01 },
    needs_run_command: { type: 'noul', noul: 0.04 },
    needs_approval: { type: 'noul', noul: 0.02 },
    risk_level: {
      type: 'choice',
      choice: 'low',
      probabilities: { low: 0.96, medium: 0.03, high: 0.01, critical: 0 },
      confidence: 0.96,
    },
  },
  usage: { input_tokens: 17, output_tokens: 8 },
});
try {
  const inspectionLogs = [];
  const defaultCatalog = getDefaultToolRegistry().getToolCatalog();
  const expectedFallbackTools = defaultCatalog.list()
    .filter((capability) => capability.fallbackModes?.length !== 0)
    .map((capability) => capability.name);
  const workflowDecision = await new WorkflowDecisionService(
    (line) => inspectionLogs.push(line),
    undefined,
    undefined,
    getDefaultToolRegistry().getToolCatalog(),
  ).decide(
    {
      apiKey: 'unused',
      baseUrl: '',
      model: 'unused',
      exportDir: '',
      workspaceRoot: '',
      jev: { apiKey: 'test-key', minConfidence: 0.78, maxRetries: 0 },
    },
    '分析一下当前工作区里这些 st 文件之间的依赖关系',
  );
  if (
    workflowDecision.kind !== 'fallback' ||
    workflowDecision.source !== 'jev' ||
    workflowDecision.mode !== 'read_only' ||
    JSON.stringify(workflowDecision.allowedTools) !== JSON.stringify(expectedFallbackTools) ||
    !workflowDecision.allowedTools.includes('write_file')
  ) {
    throw new Error('ST dependency analysis did not use the full generic read_only fallback surface');
  }
  if (
    !inspectionLogs.some((line) =>
      line.includes(`[workflow] Jev safe fallback read_only`) &&
      line.includes(`tools=${expectedFallbackTools.join('|')}`),
    )
  ) {
    throw new Error('ST dependency analysis Jev fallback log did not name the full selected tool surface');
  }
} finally {
  globalThis.fetch = originalFetch;
}

// 删除类请求的实测形状：Jev 判 file_edit(0.94)，但 write_file 只给 uncertain(0.68)、
// run_command 给 yes、delivery 给 required。旧的安全兜底要求 delivery=not_required +
// writeFile=no + runCommand=no，三条全不满足 → 结论被丢弃 → 模型分类器判成
// blocked_high_risk → 只发只读工具 → delete_file 根本不在名单里。
globalThis.fetch = async () => response({
  model: 'jev-test',
  answers: {
    delivery: { type: 'noul', noul: 0.84 },
    orchestration: {
      type: 'choice',
      choice: 'single',
      probabilities: { single: 0.98, team: 0.02 },
      confidence: 0.98,
    },
    workflow: {
      type: 'choice',
      choice: 'file_edit',
      probabilities: { file_edit: 0.94, file_read: 0.04, command_query: 0.02 },
      confidence: 0.94,
    },
    needs_read_file: { type: 'noul', noul: 0.10 },
    needs_write_file: { type: 'noul', noul: 0.68 },
    needs_run_command: { type: 'noul', noul: 0.88 },
    needs_approval: { type: 'noul', noul: 0.81 },
    risk_level: {
      type: 'choice',
      choice: 'medium',
      probabilities: { low: 0.2, medium: 0.57, high: 0.23, critical: 0 },
      confidence: 0.57,
    },
  },
  usage: { input_tokens: 17, output_tokens: 8 },
});
try {
  const deleteLogs = [];
  const deleteDecision = await new WorkflowDecisionService(
    (line) => deleteLogs.push(line),
    undefined,
    undefined,
    getDefaultToolRegistry().getToolCatalog(),
  ).decide(
    {
      apiKey: 'unused',
      baseUrl: '',
      model: 'unused',
      exportDir: '',
      workspaceRoot: '',
      jev: { apiKey: 'test-key', minConfidence: 0.78, maxRetries: 0 },
    },
    '删除ssrt.txt',
  );
  if (
    deleteDecision.kind !== 'fallback' ||
    deleteDecision.source !== 'jev' ||
    deleteDecision.mode !== 'file_edit'
  ) {
    throw new Error(
      `删除请求没有走 Jev 的 file_edit 兜底，实际 ${deleteDecision.kind}/${deleteDecision.source}/${deleteDecision.mode}`,
    );
  }
  if (!deleteDecision.allowedTools?.includes('delete_file')) {
    throw new Error('file_edit 兜底没有把 delete_file 发出来');
  }
  if (
    !deleteLogs.some((line) =>
      line.includes('[workflow] Jev safe fallback file_edit'),
    )
  ) {
    throw new Error('删除请求没有记录 Jev safe fallback file_edit 日志');
  }
} finally {
  globalThis.fetch = originalFetch;
}

// 单信号定档的主导性矩阵：档位只能由"最突出的那个工具信号"决定，
// 不能被一个把握更低、但恰好也是 yes 的信号抢走。
// 实测来源：run_80ca32a9「校验一下所有 st 文件有没有语法错误」，Jev 给
// read_file yes(0.94) / run_command yes(0.74) / write_file no(0.72)，
// 旧门槛只看 run_command 是不是 yes，就把这单判成 command_query 了。
{
  const cases = [
    {
      name: 'read_file 主导时不判 command_query',
      // noul 是"需要该工具的概率"，0.97 -> yes(conf 0.94)，0.14 -> no(conf 0.72)
      answers: { readFile: 0.97, runCommand: 0.87, writeFile: 0.14 },
      workflow: { choice: 'command_query', confidence: 0.64 },
      expectMode: 'read_only',
      forbidLog: '[workflow] Jev 命中 command_query',
    },
    {
      name: 'write_file 主导时落到 file_edit',
      answers: { readFile: 0.55, runCommand: 0.87, writeFile: 0.94 },
      workflow: { choice: 'command_query', confidence: 0.64 },
      expectMode: 'file_edit',
      forbidLog: '[workflow] Jev 命中 command_query',
    },
    {
      name: 'run_command 唯一主导且过线才判 command_query',
      answers: { readFile: 0.55, runCommand: 0.95, writeFile: 0.10 },
      workflow: { choice: 'command_query', confidence: 0.64 },
      expectMode: 'command_query',
      // 这一路必须留下命中日志，否则排查时看不出是谁定的档。
      expectLog: '[workflow] Jev 命中 command_query',
    },
    {
      name: '两个 yes 并列时不让任何一方定档',
      answers: { readFile: 0.95, runCommand: 0.95, writeFile: 0.10 },
      workflow: { choice: 'command_query', confidence: 0.64 },
      expectMode: 'read_only',
      forbidLog: '[workflow] Jev 命中 command_query',
    },
  ];

  for (const item of cases) {
    globalThis.fetch = async () => response({
      model: 'jev-test',
      answers: {
        delivery: { type: 'noul', noul: 0.30 },
        orchestration: {
          type: 'choice',
          choice: 'single',
          probabilities: { single: 0.94, team: 0.06 },
          confidence: 0.88,
        },
        workflow: {
          type: 'choice',
          choice: item.workflow.choice,
          probabilities: {
            file_edit: item.workflow.choice === 'file_edit' ? item.workflow.confidence : 0.18,
            file_read: item.workflow.choice === 'file_read' ? item.workflow.confidence : 0.18,
            command_query: item.workflow.choice === 'command_query' ? item.workflow.confidence : 0.18,
          },
          confidence: item.workflow.confidence,
        },
        needs_read_file: { type: 'noul', noul: item.answers.readFile },
        needs_write_file: { type: 'noul', noul: item.answers.writeFile },
        needs_run_command: { type: 'noul', noul: item.answers.runCommand },
        needs_approval: { type: 'noul', noul: 0.34 },
        risk_level: {
          type: 'choice',
          choice: 'low',
          probabilities: { low: 0.41, medium: 0.4, high: 0.15, critical: 0.04 },
          confidence: 0.41,
        },
      },
      usage: { input_tokens: 17, output_tokens: 8 },
    });
    const logs = [];
    try {
      const decision = await new WorkflowDecisionService(
        (line) => logs.push(line),
        undefined,
        undefined,
        getDefaultToolRegistry().getToolCatalog(),
      ).decide(
        {
          apiKey: 'unused',
          baseUrl: '',
          model: 'unused',
          exportDir: '',
          workspaceRoot: '',
          jev: { apiKey: 'test-key', minConfidence: 0.78, maxRetries: 0 },
        },
        '校验一下所有 st 文件有没有语法错误',
      );
      if (decision.mode !== item.expectMode) {
        throw new Error(
          `${item.name}: 期望 ${item.expectMode}，实际 ${decision.kind}/${decision.source}/${decision.mode}`,
        );
      }
      if (item.forbidLog && logs.some((line) => line.includes(item.forbidLog))) {
        throw new Error(`${item.name}: 不该出现 ${item.forbidLog}`);
      }
      if (item.expectLog && !logs.some((line) => line.includes(item.expectLog))) {
        throw new Error(`${item.name}: 缺少 ${item.expectLog}`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
}

{
  const workflowDecision = await new WorkflowDecisionService().decide(
    {
      apiKey: 'unused',
      baseUrl: '',
      model: 'unused',
      exportDir: '',
      workspaceRoot: '',
      jev: { enabled: false },
    },
    '设计一个 PLC 控制程序，使用 ST 语言实现 3 台水泵自动/手动控制',
  );
  if (workflowDecision.kind !== 'workflow' || workflowDecision.source !== 'local') {
    throw new Error('local workflow detector did not route explicit ST delivery request');
  }
}

{
  const workflowDecision = await new WorkflowDecisionService().decide(
    {
      apiKey: 'unused',
      baseUrl: '',
      model: 'unused',
      exportDir: '',
      workspaceRoot: '',
      jev: { enabled: false },
    },
    '做一个新的控制逻辑文件',
    undefined,
    [],
    {
      modelClassifier: async (_cfg, _text, _signal, _history, workflows) => ({
        kind: 'workflow',
        workflowId: workflows[0].id,
        confidence: 0.83,
        reason: 'model selected registered workflow in test',
      }),
    },
  );
  if (workflowDecision.kind !== 'workflow' || workflowDecision.source !== 'model') {
    throw new Error('model workflow classifier was not used after Jev/local miss');
  }
}

let flakyCalls = 0;
globalThis.fetch = async () => {
  flakyCalls += 1;
  if (flakyCalls === 1) {
    return response({ error: { message: 'temporary failure' } }, 500);
  }
  return response({
    model: 'jev-test',
    answers: {
      delivery: { type: 'noul', noul: 0.04 },
      orchestration: {
        type: 'choice',
        choice: 'single',
        probabilities: { single: 0.91, team: 0.09 },
        confidence: 0.86,
      },
    },
    usage: { input_tokens: 3, output_tokens: 2 },
  });
};
try {
  const service = new AgentDecisionService();
  const settings = { apiKey: 'test-key', minConfidence: 0.78, maxRetries: 0 };
  const first = await service.taskHint(settings, '同一句失败后重试');
  const second = await service.taskHint(settings, '同一句失败后重试');
  if (flakyCalls !== 2) {
    throw new Error(`failed Jev task hint should not be cached, got ${flakyCalls} calls`);
  }
  if (first.evaluation.status !== 'failed' || second.evaluation.status !== 'ok') {
    throw new Error('Jev failed task hint retry did not recover');
  }
} finally {
  globalThis.fetch = originalFetch;
}

if (calls !== 1) throw new Error(`expected one provider call, got ${calls}`);
console.log('jev decision tests passed');
