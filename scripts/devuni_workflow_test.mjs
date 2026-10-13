import assert from 'node:assert/strict';
import {
  AgentDecisionService,
  DEVUNI_COMMANDS,
  DEVUNI_PROJECT_TOOL_NAMES,
  DEVUNI_PROJECT_WORKFLOW,
  DEVUNI_PROJECT_WORKFLOW_ID,
  WorkflowDecisionService,
  createAppToolRegistry,
  createAppWorkflowRegistry,
  createWorkflowRuntime,
  createWorkflowRuntimeState,
  composeToolSet,
  resolveWorkflowBusinessToolPolicy,
} from './agent.testbundle.mjs';

/* ------------------------------------------------------------------ */
/* [1] 认领规则:该认的认,不该认的不认                                  */
/* ------------------------------------------------------------------ */

const match = (text) => DEVUNI_PROJECT_WORKFLOW.localMatch({ userText: text });

const shouldMatch = [
  '帮我建个工程',
  '新建一个工程',
  '创建一个 PLC 工程',
  '建工程',
  '在 E 盘建一个项目',
  '新建一个 ST 工程',
  '关闭当前工程',
  '把工程关了',
  '把工程改个名字',
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

// 代码交付类的请求不能被工程事务抢走。
for (const text of ['生成一个水泵控制程序', '建个工程然后写个交通灯程序']) {
  const decision = await decisionService.decide(cfg, text);
  assert.notEqual(
    workflowIdOf(decision),
    DEVUNI_PROJECT_WORKFLOW_ID,
    `代码交付请求不该被工程事务工作流认领:${text}`,
  );
}

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

console.log('devuni workflow tests passed');
