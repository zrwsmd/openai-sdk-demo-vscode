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
  isReadOnlyInspectionRequest,
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

// 只读校验不属于改动类工作流。Jev 即使把 st_delivery 报上来，也不能接。
const readOnlyHint = {
  delivery: 'not_required',
  deliveryConfidence: 0.58,
  orchestration: 'single',
  orchestrationConfidence: 0.98,
  workflow: 'st_delivery',
  workflowConfidence: 0.85,
  toolNeeds: {
    readFile: { value: 'yes', confidence: 0.78 },
    writeFile: { value: 'no', confidence: 0.66 },
    runCommand: { value: 'uncertain', confidence: 0.36 },
  },
  riskLevel: 'unknown',
  riskConfidence: 0.51,
  needsApproval: { value: 'no', confidence: 0.58 },
  evaluation: {},
};
const routingLogs = [];
const readOnlyRouting = new WorkflowDecisionService(
  (line) => routingLogs.push(line),
  { taskHint: async () => readOnlyHint },
  appRegistry,
  createAppToolRegistry().getToolCatalog(),
);
let readOnlyClassifierCalls = 0;
const inspectionDecision = await readOnlyRouting.decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: process.cwd(),
    workspaceRoot: process.cwd(),
  },
  '校验项目的st有没有语法错误',
  undefined,
  [],
  {
    modelClassifier: async () => {
      readOnlyClassifierCalls += 1;
      return {
        kind: 'workflow',
        workflowId: 'st_workspace_delivery',
        confidence: 0.99,
        reason: 'intentionally overbroad classifier result',
      };
    },
  },
);
assert.notEqual(inspectionDecision.kind, 'workflow', '只读校验不能被改动类工作流接住');
assert.equal(inspectionDecision.mode, 'read_only');
assert.equal(readOnlyClassifierCalls, 1, 'Jev 报的改动类工作流被挡下后应继续往下判');
assert(
  routingLogs.some((line) => line.includes('用户只要求校验/检查')),
  '被只读判定挡下的工作流必须说明原因',
);

// 同一句话只要出现写、改、生成的动词，就不该被只读判定挡掉。
const repairDecision = await readOnlyRouting.decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: process.cwd(),
    workspaceRoot: process.cwd(),
  },
  '校验项目的st有没有语法错误，有的话修复',
);
assert.equal(repairDecision.kind, 'workflow');
assert.equal(repairDecision.workflow.id, 'st_workspace_delivery');

assert.equal(isReadOnlyInspectionRequest('校验项目的st有没有语法错误'), true);
assert.equal(isReadOnlyInspectionRequest('看看这个 ST 文件有没有问题'), true);
assert.equal(isReadOnlyInspectionRequest('检查一下语法，然后生成一个报告'), false);
assert.equal(isReadOnlyInspectionRequest('把这段逻辑改一下'), false);
assert.equal(isReadOnlyInspectionRequest('项目的 st 在哪'), false, '没有只读动词时不拦');

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
