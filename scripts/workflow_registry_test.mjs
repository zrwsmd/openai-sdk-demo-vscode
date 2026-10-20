import assert from 'node:assert/strict';
import {
  createStValidationState,
  StWorkspaceDeliveryWorkflow,
  ST_WORKSPACE_DELIVERY_AUXILIARY_TOOL_NAMES,
  ST_WORKSPACE_DELIVERY_PRIMARY_TOOL_NAMES,
  ST_WORKSPACE_DELIVERY_TOOL_NAMES,
  ST_WORKSPACE_DELIVERY_WORKFLOW,
  WorkflowRegistry,
  ToolRegistry,
  createCoreToolProvider,
  createStToolProvider,
  createAppWorkflowRegistry,
  createAppToolRegistry,
  WorkflowDecisionService,
} from './agent.testbundle.mjs';

const generic = {
  id: 'generic_file_inspection',
  title: 'Generic file inspection',
  description: 'A domain-neutral test workflow',
  runtimeManaged: false,
  workflowRoute: 'generic_file_inspection',
  describe: () => ({
    id: 'generic_file_inspection',
    title: 'Generic file inspection',
    stages: [],
  }),
};

const registry = new WorkflowRegistry([generic]);
assert.equal(registry.get('generic_file_inspection'), generic);
assert.equal(registry.getByRoute('generic_file_inspection'), generic);
assert.deepEqual(registry.findByContract(undefined), undefined);
assert.deepEqual(registry.list(), [generic]);
assert.throws(() => registry.register(generic), /already registered/);

const legacyContractOnly = {
  ...generic,
  id: 'legacy_contract_only',
  workflowRoute: 'legacy_contract_only',
  matchesDeliveryContract: () => true,
};
assert.equal(
  new WorkflowRegistry([legacyContractOnly]).findByContract({}),
  undefined,
  'Registry must only use the generic matchesContract hook',
);

const appRegistry = createAppWorkflowRegistry();
assert.equal(appRegistry.get('st_workspace_delivery'), ST_WORKSPACE_DELIVERY_WORKFLOW);
assert.equal(appRegistry.get('st_inspection'), undefined);
assert.deepEqual(
  appRegistry.list().map((workflow) => workflow.id),
  ['st_workspace_delivery', 'devuni_project'],
  '注册顺序即优先级:代码交付必须排在工程事务前面',
);
assert.equal(
  appRegistry.get('devuni_project')?.runtimeManaged,
  true,
  'devuni 工程事务工作流必须由运行时接管,避免再走通用计划/团队那套',
);
assert.equal(appRegistry.getByRoute('devuni_project'), appRegistry.get('devuni_project'));
assert.equal(appRegistry.getByRoute('st_delivery'), ST_WORKSPACE_DELIVERY_WORKFLOW);
assert.match(ST_WORKSPACE_DELIVERY_WORKFLOW.description, /仅修改注释/u);
assert.equal(
  ST_WORKSPACE_DELIVERY_WORKFLOW.localFallback?.({
    userText: '格式化 PID_Pressure_Supply.st 并调整缩进',
    actionIntent: 'file_edit',
  })?.mode,
  'file_edit',
);
assert.equal(
  ST_WORKSPACE_DELIVERY_WORKFLOW.localFallback?.({
    userText: '取消 PID_Pressure_Supply.st 里启动逻辑的注释并保存',
    actionIntent: 'file_edit',
  }),
  undefined,
  '取消代码注释会改变程序语义，不能降级为轻量编辑',
);

const stDeliveryHint = {
  delivery: 'required',
  deliveryConfidence: 0.9,
  orchestration: 'single',
  orchestrationConfidence: 0.98,
  workflow: 'st_delivery',
  workflowConfidence: 0.96,
  toolNeeds: {
    readFile: { value: 'yes', confidence: 0.8 },
    writeFile: { value: 'yes', confidence: 0.9 },
    runCommand: { value: 'no', confidence: 0.9 },
  },
  riskLevel: 'medium',
  riskConfidence: 0.85,
  needsApproval: { value: 'unknown', confidence: 0.2 },
  evaluation: {},
};
let nonSemanticClassifierCalls = 0;
const stRouting = new WorkflowDecisionService(
  () => {},
  { taskHint: async () => stDeliveryHint },
  appRegistry,
  createAppToolRegistry().getToolCatalog(),
);
const commentEditDecision = await stRouting.decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: process.cwd(),
    workspaceRoot: process.cwd(),
  },
  'PID_Pressure_Supply.st,在最后随便加一行注释',
  undefined,
  [],
  {
    modelClassifier: async () => {
      nonSemanticClassifierCalls += 1;
      return {
        kind: 'workflow',
        workflowId: 'st_workspace_delivery',
        confidence: 0.99,
        reason: 'intentionally overbroad classifier result',
      };
    },
  },
);
assert.equal(commentEditDecision.kind, 'fallback');
assert.equal(commentEditDecision.mode, 'file_edit');
assert.equal(commentEditDecision.source, 'local');
assert.equal(nonSemanticClassifierCalls, 0, '明确的非语义 ST 编辑不应再调用独立模型分类器');
assert(commentEditDecision.allowedTools.includes('edit_file'));

const logicEditDecision = await stRouting.decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: process.cwd(),
    workspaceRoot: process.cwd(),
  },
  '修改 PID_Pressure_Supply.st 的压力控制逻辑并保存',
);
assert.equal(logicEditDecision.kind, 'workflow');
assert.equal(logicEditDecision.workflow.id, 'st_workspace_delivery');
assert.deepEqual([...ST_WORKSPACE_DELIVERY_PRIMARY_TOOL_NAMES], [
  'validate_st_code',
  'commit_st_delivery',
  'write_file',
]);
assert.deepEqual([...ST_WORKSPACE_DELIVERY_AUXILIARY_TOOL_NAMES], [
  'st_dependency_map',
  'st_change_impact',
  'st_symbol_references',
  'st_library_symbol',
]);
assert.deepEqual([...ST_WORKSPACE_DELIVERY_TOOL_NAMES], [
  ...ST_WORKSPACE_DELIVERY_PRIMARY_TOOL_NAMES,
  ...ST_WORKSPACE_DELIVERY_AUXILIARY_TOOL_NAMES,
]);
const stDeliveryRuntime = new StWorkspaceDeliveryWorkflow(
  undefined,
  createStValidationState(),
);
assert.equal(stDeliveryRuntime.initialTool({ isResume: false }), undefined);
const stDeliveryInstructions = stDeliveryRuntime.instructions();
assert.match(stDeliveryInstructions, /严格禁止臆造外部\/标准库功能块/u);
assert.match(stDeliveryInstructions, /st_library_symbol/u);
assert.match(stDeliveryInstructions, /inputs\/outputs\/usage/u);
assert.match(stDeliveryInstructions, /matchCount=0/u);

// A separately constructed registry is isolated from the host's built-in list.
assert.equal(registry.get('st_workspace_delivery'), undefined);
assert.equal(registry.get('st_inspection'), undefined);

const toolConfig = {
  baseUrl: 'http://localhost/v1',
  apiKey: 'test',
  model: 'test',
  exportDir: process.cwd(),
  workspaceRoot: process.cwd(),
};
const coreTools = new ToolRegistry([createCoreToolProvider()]);
const coreToolSet = coreTools.createTools({ cfg: toolConfig });
const coreToolNames = coreToolSet.map((tool) => tool.name);
assert(coreToolNames.includes('write_file'));
assert(coreToolNames.includes('edit_file'));
assert(!coreToolNames.includes('validate_st_code'));
assert(!coreToolNames.includes('st_dependency_map'));
assert.equal(coreTools.getRisk('write_file'), 'write');
assert.equal(coreTools.getRisk('edit_file'), 'write');
assert.equal(coreTools.getRisk('validate_st_code'), undefined);
assert.deepEqual(coreTools.toolsForEvidence('successful_write'), ['write_file', 'edit_file']);
assert.deepEqual(coreTools.toolsForEvidence('successful_export'), []);

// @openai/agents strict tool schemas mark every property as required. The
// read_file descriptions must therefore provide concrete sentinel values while
// retaining the parser's backward-compatible path-only input handling.
const readFileTool = coreToolSet.find((tool) => tool.name === 'read_file');
assert(readFileTool, 'core provider should expose read_file');
assert.deepEqual(
  [...(readFileTool.parameters.required ?? [])].sort(),
  ['endLine', 'path', 'startLine'],
);
assert.equal(readFileTool.parameters.properties.startLine.default, 1);
assert.equal(readFileTool.parameters.properties.endLine.default, 0);
assert.match(
  readFileTool.parameters.properties.startLine.description,
  /读取整个文件时传 1/u,
);
assert.match(
  readFileTool.parameters.properties.endLine.description,
  /读取整个文件时传 0/u,
);
assert.match(
  readFileTool.parameters.properties.endLine.description,
  /超出会截断/u,
);

const appTools = createAppToolRegistry();
const allTools = appTools.createTools({ cfg: toolConfig });
const allToolNames = allTools.map((tool) => tool.name);
assert(allToolNames.includes('validate_st_code'));
assert(!allToolNames.includes('commit_st_delivery'));
const stWorkflowTools = appTools.createTools({
  cfg: toolConfig,
  workflow: stDeliveryRuntime,
});
assert(
  stWorkflowTools.map((tool) => tool.name).includes('commit_st_delivery'),
  '正式交付 commit 只能在 ST workspace delivery workflow 中暴露',
);
assert(allToolNames.includes('st_dependency_map'));
assert.equal(appTools.getRisk('validate_st_code'), 'plan');
assert.equal(appTools.getRisk('commit_st_delivery'), 'plan');
assert.equal(appTools.getRisk('export_st_program'), 'write');
assert(appTools.toolsForEvidence('successful_export').includes('export_st_program'));
assert.throws(
  () => new ToolRegistry([createCoreToolProvider(), createStToolProvider(), createStToolProvider()]),
  /already registered/,
);

console.log('workflow and tool registry tests passed');
