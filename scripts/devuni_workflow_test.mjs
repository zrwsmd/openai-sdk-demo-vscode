import assert from 'node:assert/strict';
import {
  AgentDecisionService,
  DEVUNI_COMMANDS,
  DEVUNI_PROJECT_TOOL_NAMES,
  DEVUNI_PROJECT_PIPELINE_PLAN,
  DEVUNI_PROJECT_WORKFLOW,
  DEVUNI_PROJECT_WORKFLOW_ID,
  WorkflowDecisionService,
  PipelineStageRuntime,
  createAppToolRegistry,
  createAppWorkflowRegistry,
  createWorkflowRuntime,
  createWorkflowRuntimeState,
  composeToolSet,
  inferClarificationValidation,
  resolveWorkflowBusinessToolPolicy,
} from './agent.testbundle.mjs';

/* ------------------------------------------------------------------ */
/* [1] 认领规则:该认的认,不该认的不认                                  */
/* ------------------------------------------------------------------ */

const match = (text) => DEVUNI_PROJECT_WORKFLOW.localMatch({ userText: text });

const shouldMatch = [
  '帮我建个工程',
  '新建一个工程',
  '新建另一个工程',
  '再建另一个工程',
  '创建一个 PLC 工程',
  '建工程',
  '在 E 盘建一个项目',
  '新建一个 ST 工程',
  '关闭当前工程',
  '把工程关了',
  '把工程改个名字',
  '打开刚刚创建的工程',
];
for (const text of shouldMatch) {
  assert.equal(match(text).matched, true, `应当认领:${text}`);
}

// 认领规则必须写窄:这块牌子也要进模型分诊的候选名单,写宽了会去抢代码交付的活。
const shouldNotMatch = [
  '写个交通灯程序',
  '生成一段 ST 代码',
  '帮我写个水泵控制程序',
  '建个工程然后写个交通灯程序',
  '检查当前工作区里的文件内容',
  '今天天气怎么样',
  '建议这个工程怎么优化',
  '打开那个配置文件',
  '刚刚新建的工程怎么样',
  '不要在刚刚新建的工程下写文件，只解释一下怎么写',
  '在刚刚新建的工程下面写入一个文件 asd.txt，内容是 hello',
  '读取刚刚新建的工程里的 config.json',
  '列出刚刚新建的工程下面的文件',
  '在刚刚新建的工程里运行构建命令',
];
for (const text of shouldNotMatch) {
  assert.equal(match(text).matched, false, `不该认领:${text}`);
}

/* ------------------------------------------------------------------ */
/* [2] 工具名单:命令表 + 反问工具,且都在注册表里                       */
/* ------------------------------------------------------------------ */

assert.deepEqual(
  [...DEVUNI_PROJECT_TOOL_NAMES],
  [...DEVUNI_COMMANDS.map((command) => command.toolName), 'request_clarification'],
);
assert(
  DEVUNI_PROJECT_TOOL_NAMES.includes('devuni_create_project'),
  '名单必须包含创建工程工具',
);
assert(
  DEVUNI_PROJECT_TOOL_NAMES.includes('request_clarification'),
  '名单必须包含反问工具,否则缺参数时模型连问一句的余地都没有',
);

const appToolRegistry = createAppToolRegistry();
const registeredToolNames = new Set(
  appToolRegistry
    .list()
    .flatMap((provider) =>
      (provider.capabilities ?? []).map((capability) => capability.name),
    ),
);
for (const name of DEVUNI_PROJECT_TOOL_NAMES) {
  assert(
    registeredToolNames.has(name),
    `名单里的 ${name} 没有注册,模型会拿到一个幽灵工具`,
  );
}

/* ------------------------------------------------------------------ */
/* [3] 端到端:本地规则直接认领,不进模型分诊                            */
/* ------------------------------------------------------------------ */

const cfg = {
  baseUrl: 'http://127.0.0.1:8790/v1',
  apiKey: 'test',
  model: 'test',
  exportDir: process.cwd(),
  workspaceRoot: process.cwd(),
  jev: { enabled: false },
};
const decisionService = new WorkflowDecisionService(
  () => {},
  new AgentDecisionService(() => {}),
  createAppWorkflowRegistry(),
);

const workflowIdOf = (decision) =>
  decision.kind === 'workflow' ? decision.workflow.id : undefined;

const createDecision = await decisionService.decide(cfg, '帮我在 E 盘建个工程');
assert.equal(createDecision.kind, 'workflow');
assert.equal(createDecision.workflow.id, DEVUNI_PROJECT_WORKFLOW_ID);
assert.equal(
  createDecision.source,
  'local',
  '必须由本地规则认领,不能依赖模型分诊的运气',
);
const repeatedCreateDecision = await decisionService.decide(cfg, '新建另一个工程');
assert.equal(repeatedCreateDecision.kind, 'workflow');
assert.equal(repeatedCreateDecision.workflow.id, DEVUNI_PROJECT_WORKFLOW_ID);
assert.equal(repeatedCreateDecision.source, 'local');

// 代码交付类的请求不能被工程事务抢走。
for (const text of ['生成一个水泵控制程序', '建个工程然后写个交通灯程序']) {
  const decision = await decisionService.decide(cfg, text);
  assert.notEqual(
    workflowIdOf(decision),
    DEVUNI_PROJECT_WORKFLOW_ID,
    `代码交付请求不该被工程事务工作流认领:${text}`,
  );
}

// The project noun may be carried over as target context, but an explicit
// current-turn action must select the corresponding fallback surface.
for (const [text, expectedTool] of [
  ['在刚刚新建的工程下面写入一个文件 asd.txt，内容是 hello', 'write_file'],
  ['读取刚刚新建的工程里的 config.json', 'read_file'],
  ['列出刚刚新建的工程下面的文件', 'list_files'],
  ['在刚刚新建的工程里运行构建命令', 'run_command'],
]) {
  const decision = await decisionService.decide(cfg, text);
  assert.notEqual(
    workflowIdOf(decision),
    DEVUNI_PROJECT_WORKFLOW_ID,
    `当前动作不该被工程 workflow 抢走:${text}`,
  );
  assert(
    decision.allowedTools?.includes(expectedTool),
    `当前动作的工具面应包含 ${expectedTool}:${text}`,
  );
}

// The same action boundary must protect against a stale/high-confidence
// Jev route and a model classifier route, not only the local matcher.
const forcedProjectHint = {
  delivery: 'required',
  deliveryConfidence: 0.95,
  orchestration: 'single',
  orchestrationConfidence: 0.95,
  workflow: DEVUNI_PROJECT_WORKFLOW_ID,
  workflowConfidence: 0.99,
  toolNeeds: {
    readFile: { value: 'no', confidence: 0.95 },
    writeFile: { value: 'yes', confidence: 0.95 },
    runCommand: { value: 'no', confidence: 0.95 },
  },
  riskLevel: 'medium',
  riskConfidence: 0.9,
  needsApproval: { value: 'yes', confidence: 0.9 },
  evaluation: {},
};
const forcedProjectRoute = new WorkflowDecisionService(
  () => {},
  { taskHint: async () => forcedProjectHint },
  createAppWorkflowRegistry(),
);
const forcedJevDecision = await forcedProjectRoute.decide(
  cfg,
  '在刚刚新建的工程下面写入一个文件 asd.txt，内容是 hello',
);
assert.notEqual(workflowIdOf(forcedJevDecision), DEVUNI_PROJECT_WORKFLOW_ID);
const forcedModelDecision = await forcedProjectRoute.decide(
  cfg,
  '在刚刚新建的工程下面写入一个文件 asd.txt，内容是 hello',
  undefined,
  [],
  {
    modelClassifier: async () => ({
      kind: 'workflow',
      workflowId: DEVUNI_PROJECT_WORKFLOW_ID,
      confidence: 0.99,
      reason: 'intentionally stale project route',
    }),
  },
);
assert.notEqual(workflowIdOf(forcedModelDecision), DEVUNI_PROJECT_WORKFLOW_ID);

/* ------------------------------------------------------------------ */
/* [4] 运行时:名单原样发,不经过风险过滤和文本收窄                      */
/* ------------------------------------------------------------------ */

const runtime = DEVUNI_PROJECT_WORKFLOW.createRuntime?.(
  undefined,
  createWorkflowRuntimeState(),
);
assert(runtime, 'devuni 工程事务工作流必须能建出运行时');
assert.deepEqual([...runtime.businessToolNames], [...DEVUNI_PROJECT_TOOL_NAMES]);
assert.equal(runtime.parallelToolCalls, true);
assert.equal(runtime.requiredActionTool, 'devuni_create_project');
assert.equal(runtime.pipelinePlan, DEVUNI_PROJECT_PIPELINE_PLAN);
assert.equal(runtime.initialTool({ isResume: false }), undefined);
assert.match(runtime.instructions(), /devuni_project_options/u);
assert.match(runtime.instructions(), /request_clarification/u);
assert.match(runtime.instructions(), /批准/u);

const policy = resolveWorkflowBusinessToolPolicy(
  [runtime, DEVUNI_PROJECT_WORKFLOW],
  {
    userText: '帮我在 E 盘建个工程',
    state: createWorkflowRuntimeState(),
    toolCatalog: appToolRegistry.getToolCatalog(),
  },
);
assert.equal(policy.mode, 'allow_list');
assert.deepEqual([...policy.names], [...DEVUNI_PROJECT_TOOL_NAMES]);

const genericRuntime = createWorkflowRuntime(
  DEVUNI_PROJECT_WORKFLOW_ID,
  undefined,
  createWorkflowRuntimeState(),
  createAppWorkflowRegistry(),
  { userText: '帮我在 E 盘建个工程' },
);
assert(genericRuntime, '通用入口必须能按 id 建出 devuni 运行时');
assert.equal(genericRuntime.id, DEVUNI_PROJECT_WORKFLOW_ID);
assert.deepEqual([...genericRuntime.stages], [], '轻量工作流不该带阶段');
assert.deepEqual(
  [...genericRuntime.businessToolNames],
  [...DEVUNI_PROJECT_TOOL_NAMES],
  '规范化之后的运行时仍要原样带着完整名单',
);
const nonCreateRuntime = createWorkflowRuntime(
  DEVUNI_PROJECT_WORKFLOW_ID,
  undefined,
  createWorkflowRuntimeState(),
  createAppWorkflowRegistry(),
  { userText: '打开刚刚创建的工程' },
);
assert.equal(
  nonCreateRuntime?.requiredActionTool,
  undefined,
  '非创建类工程事务不能被误强制成 devuni_create_project',
);

const pipelineRuntime = new PipelineStageRuntime(runtime.pipelinePlan);
const clarified = pipelineRuntime.nextToolAfterResult(
  'request_clarification',
  {
    protocolVersion: 1,
    ok: true,
    data: {
      cancelled: false,
      sequenceCompleted: true,
      answers: {
        projectType: { selectedOptionId: 'standard' },
        language: { selectedOptionId: 'st' },
        deviceModel: { selectedOptionId: 'SC5100' },
        projectPath: { customText: 'D:\\\\' },
        projectName: { customText: 'new1' },
      },
    },
    diagnostics: [],
    effect: 'none',
    risk: 'plan',
  },
  new Set(DEVUNI_PROJECT_TOOL_NAMES),
);
assert.equal(
  clarified?.toolName,
  'devuni_create_project',
  '五步配置完成后必须把下一次模型调用约束为创建工具',
);
const cancelled = pipelineRuntime.nextToolAfterResult(
  'request_clarification',
  {
    protocolVersion: 1,
    ok: true,
    data: { cancelled: true, sequenceCompleted: true },
    diagnostics: [],
    effect: 'none',
    risk: 'plan',
  },
  new Set(DEVUNI_PROJECT_TOOL_NAMES),
);
assert.equal(cancelled, undefined, '用户取消配置时不能强制创建工程');

const createdRecord = {
  name: 'devuni_create_project',
  args: JSON.stringify({ projectName: 'new1', projectPath: 'D:\\\\' }),
  result: {
    protocolVersion: 1,
    ok: true,
    data: { projectCreated: true, opened: false },
    diagnostics: [],
    effect: 'filesystem',
    risk: 'write',
  },
};
assert.equal(
  runtime.completionAdapter.collectActionArtifact?.(createdRecord)?.name,
  'devUni 工程',
  '创建成功回执必须成为工作流完成证据',
);
assert.equal(
  runtime.completionAdapter.collectActionArtifact?.(createdRecord)?.uri,
  undefined,
  '工作区文件路径不能作为模型可见的工程产物路径',
);
const createdMessage = runtime.completionAdapter.finalMessage?.([createdRecord]) ?? '';
assert.match(createdMessage, /工程已成功创建/u);
assert.match(createdMessage, /本轮结束后将自动在新窗口打开/u);
assert.doesNotMatch(createdMessage, /\.code-workspace|workspaceFile/u);
assert.doesNotMatch(createdMessage, /尚未|手动打开|是否需要打开/u);

/* ------------------------------------------------------------------ */
/* [5] 模拟第 4 站:按名单从注册表里挑出这一轮真正发给模型的工具         */
/* ------------------------------------------------------------------ */

const allTools = appToolRegistry.createTools({ cfg });
// composeToolSet 就是内核第 4 站用的那个函数:业务工具按名单过滤,运行时控制工具另走一条通道。
const visibleNames = composeToolSet(allTools, [], policy.names).map(
  (tool) => tool.name,
);
assert(
  visibleNames.includes('devuni_create_project'),
  `写工具必须真的发得出去:${visibleNames.join('|')}`,
);
assert(
  visibleNames.includes('request_clarification'),
  `反问工具必须真的发得出去:${visibleNames.join('|')}`,
);
assert.deepEqual(
  [...visibleNames].sort(),
  [...DEVUNI_PROJECT_TOOL_NAMES].sort(),
  '名单上的工具必须全部发出去,不能多也不能少',
);

/* ------------------------------------------------------------------ */
/* [N] 弹窗校验兜底:模型不写 validation 时按字段 id 补                   */
/* ------------------------------------------------------------------ */

// 创建工程这几步是模型自己拼的 request_clarification,validation 全靠它自觉。
// 漏写就等于弹窗不校验,用户填个空目录、带冒号的工程名也能提交。
assert.deepEqual(
  inferClarificationValidation('projectPath', '请选择工程父目录'),
  { type: 'directoryPath', label: '目录' },
  'projectPath 必须自动套上目录校验',
);
assert.deepEqual(
  inferClarificationValidation('projectName', '工程叫什么名字'),
  { type: 'projectName', label: '工程名' },
  'projectName 必须自动套上工程名校验',
);
assert.deepEqual(
  inferClarificationValidation('parentDirectory'),
  { type: 'directoryPath', label: '目录' },
);
assert.deepEqual(
  inferClarificationValidation('父目录'),
  { type: 'directoryPath', label: '目录' },
);
assert.deepEqual(
  inferClarificationValidation('工程名'),
  { type: 'projectName', label: '工程名' },
);
// 只有一句话没有 id 时靠文案判断。
assert.deepEqual(
  inferClarificationValidation(undefined, '工程父目录填哪个盘?'),
  { type: 'directoryPath', label: '目录' },
);
assert.deepEqual(
  inferClarificationValidation(undefined, '新工程叫什么名字'),
  { type: 'projectName', label: '工程名' },
);
// 一步里同时问两件事,猜哪条都不对,宁可不补。
assert.equal(
  inferClarificationValidation(undefined, '工程名和父目录分别是什么'),
  undefined,
  '一步问两件事时不能瞎猜校验类型',
);
// 别的字段不能被误判,否则会拦住合法输入。
assert.equal(inferClarificationValidation('deviceModel'), undefined);
assert.equal(inferClarificationValidation('projectType'), undefined);
assert.equal(inferClarificationValidation('language', '用哪种编程语言'), undefined);

// 指令里必须点名这两个 id,不然模型写的是别的名字,兜底也接不上。
assert.match(runtime.instructions(), /projectPath/u, '工作流指令必须告诉模型父目录那一步的 id');
assert.match(runtime.instructions(), /projectName/u, '工作流指令必须告诉模型工程名那一步的 id');

console.log('devuni workflow tests passed');

