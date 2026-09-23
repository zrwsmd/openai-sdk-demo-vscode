import {
  AgentDecisionService,
  classifyDeliveryContract,
  isStWorkspaceDeliveryContract,
  JevDecisionProvider,
  ST_INSPECTION_WORKFLOW,
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

let stWorkflowFallbackCalls = 0;
globalThis.fetch = async () => {
  stWorkflowFallbackCalls += 1;
  return response({
    model: 'jev-test',
    answers: {
      delivery: { type: 'noul', noul: 0.52 },
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
    'PID 恒压供水：根据管网压力反馈调节变频器，压力低启动，压力高降频。',
  );
  if (stWorkflowFallbackCalls !== 1) {
    throw new Error(`expected one Jev workflow fallback call, got ${stWorkflowFallbackCalls}`);
  }
  if (!isStWorkspaceDeliveryContract(contract)) {
    throw new Error('high-confidence Jev st_delivery workflow should create the runtime ST delivery contract');
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
  if (!isStWorkspaceDeliveryContract(workflowDecision.deliveryContract)) {
    throw new Error('Jev workflow decision did not attach an ST delivery contract');
  }
} finally {
  globalThis.fetch = originalFetch;
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
      choice: 'st_inspection',
      probabilities: {
        st_inspection: 0.96,
        st_delivery: 0.01,
        file_read: 0.02,
        general_chat: 0.01,
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
  const workflowDecision = await new WorkflowDecisionService().decide(
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
    workflowDecision.kind !== 'workflow' ||
    workflowDecision.source !== 'jev' ||
    workflowDecision.workflow.id !== 'st_inspection' ||
    workflowDecision.deliveryContract !== undefined
  ) {
    throw new Error('Jev ST inspection request did not stay on the registered read-only workflow');
  }
  const runtime = ST_INSPECTION_WORKFLOW.createRuntime?.(undefined, {
    slots: new Map(),
  });
  const tools = runtime?.visibleToolNames ?? [];
  if (
    tools.length !== 3 ||
    !tools.includes('st_dependency_map') ||
    !tools.includes('st_change_impact') ||
    !tools.includes('st_symbol_references') ||
    tools.includes('validate_st_code') ||
    tools.includes('write_file')
  ) {
    throw new Error('ST inspection workflow exposed the wrong tool set');
  }
} finally {
  globalThis.fetch = originalFetch;
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
