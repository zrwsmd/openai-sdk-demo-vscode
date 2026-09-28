import assert from 'node:assert/strict';
import {
  ToolCatalog,
  ToolRegistry,
  AgentDecisionService,
  WorkflowDecisionService,
  WorkflowRegistry,
  createCoreToolProvider,
  createStToolProvider,
} from './agent.testbundle.mjs';

const coreRegistry = new ToolRegistry([createCoreToolProvider()]);
const coreCatalog = coreRegistry.getToolCatalog();

assert(coreCatalog.has('read_file'));
assert.equal(coreCatalog.get('read_file')?.providerId, 'core');
assert.equal(coreCatalog.get('read_file')?.risk, 'read');
assert.equal(coreCatalog.get('write_file')?.risk, 'write');
assert.equal(coreCatalog.get('write_file')?.requiresApproval, true);
assert.equal(coreRegistry.getRisk('write_file'), 'write');
assert.deepEqual(coreRegistry.evidenceMap().write_file, ['successful_write']);
assert.deepEqual(coreCatalog.riskMap(), {
  get_io_table: 'read',
  read_plc_variables: 'read',
  list_files: 'read',
  read_file: 'read',
  search_files: 'read',
  write_file: 'write',
  edit_file: 'write',
  run_command: 'execute',
});
assert.deepEqual(coreCatalog.evidenceMap(), {
  write_file: ['successful_write'],
  edit_file: ['successful_write'],
});
assert.deepEqual(coreCatalog.toolsForFallback('read_only'), [
  'get_io_table',
  'read_plc_variables',
  'list_files',
  'read_file',
  'search_files',
]);
assert.deepEqual(coreCatalog.toolsForFallback('file_edit'), [
  'list_files',
  'read_file',
  'search_files',
  'write_file',
  'edit_file',
]);
assert.deepEqual(coreCatalog.toolsForFallback('command_query'), ['run_command']);
assert.deepEqual(
  coreCatalog.findByTag('workspace').map((item) => item.name),
  ['list_files', 'read_file', 'search_files', 'write_file', 'edit_file', 'run_command'],
);
assert.deepEqual(
  coreCatalog.findByIntent('读取文件').map((item) => item.name),
  ['read_file'],
);
assert.deepEqual(
  coreCatalog.find({ risks: ['read'] }).map((item) => item.name),
  ['get_io_table', 'read_plc_variables', 'list_files', 'read_file', 'search_files'],
);
assert.deepEqual(
  coreCatalog.toolsForQuery({ risks: ['read', 'plan'] }),
  ['get_io_table', 'read_plc_variables', 'list_files', 'read_file', 'search_files'],
);
const coreCapabilityPrompt = coreCatalog.renderToolCapabilityPrompt([
  'read_file',
  'write_file',
  'report_plan_progress',
]);
assert.match(coreCapabilityPrompt, /- read_file: 读取授权工作区内文本文件的内容/u);
assert.match(coreCapabilityPrompt, /适用意图：读取文件、查看文件内容、打开文件/u);
assert.match(coreCapabilityPrompt, /风险：read/u);
assert.match(coreCapabilityPrompt, /- write_file: 向授权工作区文件写入完整文本内容/u);
assert.match(coreCapabilityPrompt, /风险：write/u);
assert.match(coreCapabilityPrompt, /副作用：filesystem/u);
assert.match(coreCapabilityPrompt, /需要审批：是/u);
assert.match(
  coreCapabilityPrompt,
  /- report_plan_progress$/,
);
for (const mode of ['general_chat', 'needs_clarification', 'blocked_high_risk']) {
  assert.deepEqual(
    coreCatalog.toolsForFallback(mode),
    ['get_io_table', 'read_plc_variables', 'list_files', 'read_file', 'search_files'],
    `safe fallback ${mode} should expose only read/plan capabilities`,
  );
}

const appRegistry = new ToolRegistry([
  createCoreToolProvider(),
  createStToolProvider(),
]);
const appCatalog = appRegistry.getToolCatalog();
assert.equal(appCatalog.get('st_dependency_map')?.providerId, 'st');
assert.equal(appCatalog.get('st_dependency_map')?.domain, 'structured_text');
assert.equal(appCatalog.get('export_st_program')?.evidence?.includes('successful_export'), true);
assert.deepEqual(appRegistry.toolsForEvidence('successful_export'), ['export_st_program']);
assert.deepEqual(
  appCatalog.find({ providerId: 'st', tags: ['analysis'] }).map((item) => item.name),
  [
    'validate_st_code',
    'st_dependency_map',
    'st_change_impact',
    'st_symbol_references',
    'st_library_symbol',
  ],
);
assert.deepEqual(appCatalog.toolsForFallback('read_only'), [
  'get_io_table',
  'read_plc_variables',
  'list_files',
  'read_file',
  'search_files',
  'validate_st_code',
  'st_dependency_map',
  'st_change_impact',
  'st_symbol_references',
  'st_library_symbol',
]);
assert.deepEqual(appCatalog.toolsForFallback('general_chat'), [
  'get_io_table',
  'read_plc_variables',
  'list_files',
  'read_file',
  'search_files',
  'validate_st_code',
  'st_dependency_map',
  'st_change_impact',
  'st_symbol_references',
  'st_library_symbol',
]);
assert(!appCatalog.toolsForFallback('general_chat').includes('write_file'));
assert(!appCatalog.toolsForFallback('general_chat').includes('export_st_program'));
assert(!appCatalog.toolsForFallback('blocked_high_risk').includes('run_command'));
assert.deepEqual(appCatalog.toolsForFallback('command_query'), ['run_command']);

const customCapability = {
  name: 'query_modbus_device',
  description: '读取 Modbus 设备状态。',
  domain: 'modbus',
  intents: ['查询 Modbus 状态'],
  tags: ['modbus', 'read'],
  risk: 'read',
  effect: 'device',
};
const customCatalog = new ToolCatalog();
customCatalog.register('modbus', customCapability);
customCatalog.register('library', {
  name: 'library_symbol',
  description: '查询领域库中的符号定义。',
  domain: 'library',
  tags: ['lookup'],
  risk: 'plan',
  effect: 'none',
});
assert.deepEqual(customCatalog.listByProvider('MODBUS').map((item) => item.name), [
  'query_modbus_device',
]);
assert.equal(customCatalog.findByIntent('查询 Modbus 状态')[0]?.name, 'query_modbus_device');
assert.deepEqual(customCatalog.toolsForFallback('read_only'), [
  'query_modbus_device',
  'library_symbol',
]);
assert.deepEqual(customCatalog.toolsForFallback('file_edit'), ['query_modbus_device']);
assert.deepEqual(customCatalog.toolsForFallback('general_chat'), [
  'query_modbus_device',
  'library_symbol',
]);
assert.deepEqual(customCatalog.toolsForFallback('needs_clarification'), [
  'query_modbus_device',
  'library_symbol',
]);
assert.throws(
  () => customCatalog.register('other', customCapability),
  /already registered/,
);

const duplicateProvider = {
  id: 'duplicate',
  capabilities: [customCapability],
  createTools: () => [],
};
assert.throws(
  () => new ToolRegistry([
    {
      id: 'one',
      capabilities: [customCapability],
      createTools: () => [],
    },
    duplicateProvider,
  ]),
  /already registered/,
);

const dynamicRegistry = new ToolRegistry([{
  id: 'modbus',
  capabilities: [customCapability, {
    name: 'library_symbol',
    description: '查询领域库中的符号定义。',
    domain: 'library',
    tags: ['lookup'],
    risk: 'plan',
    effect: 'none',
  }],
  createTools: () => [],
}]);
assert.equal(dynamicRegistry.getRisk('query_modbus_device'), 'read');

const capabilityOnlyRegistry = new ToolRegistry([{
  id: 'capability-only',
  capabilities: [{
    name: 'capability_write',
    description: '能力声明直接提供写入工具元数据。',
    risk: 'write',
    evidence: ['successful_write'],
    effect: 'filesystem',
  }],
  createTools: () => [],
}]);
assert.equal(capabilityOnlyRegistry.getRisk('capability_write'), 'write');
assert.deepEqual(capabilityOnlyRegistry.evidenceMap().capability_write, ['successful_write']);
assert.deepEqual(capabilityOnlyRegistry.toolsForEvidence('successful_write'), ['capability_write']);

assert.throws(
  () => new ToolRegistry([{
    id: 'conflicting-metadata',
    riskByTool: { conflicting_tool: 'read' },
    capabilities: [{
      name: 'conflicting_tool',
      description: '冲突元数据测试。',
      risk: 'write',
    }],
    createTools: () => [],
  }]),
  /Conflicting risk registration/,
);

const decisionService = new WorkflowDecisionService(
  () => {},
  new AgentDecisionService(() => {}),
  new WorkflowRegistry(),
  dynamicRegistry.getToolCatalog(),
);
const fallbackDecision = await decisionService.decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: '',
    workspaceRoot: '',
    jev: { enabled: false },
  },
  '查询 Modbus 状态',
  undefined,
  [],
  {
    modelClassifier: async () => ({
      kind: 'fallback',
      mode: 'read_only',
      confidence: 0.91,
      reason: 'test selected read-only fallback',
    }),
  },
);
assert.equal(fallbackDecision.kind, 'fallback');
assert.deepEqual(fallbackDecision.allowedTools, [
  'query_modbus_device',
  'library_symbol',
]);

const safeFallbackDecision = await decisionService.decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: '',
    workspaceRoot: '',
    jev: { enabled: false },
  },
  '解释这个领域符号',
  undefined,
  [],
  {
    modelClassifier: async () => ({
      kind: 'fallback',
      mode: 'general_chat',
      confidence: 0.93,
      reason: 'test selected general chat fallback',
    }),
  },
);
assert.equal(safeFallbackDecision.kind, 'fallback');
assert.deepEqual(safeFallbackDecision.allowedTools, [
  'query_modbus_device',
  'library_symbol',
]);

let modelClassifierCalledForJevCommand = false;
const jevCommandDecision = await new WorkflowDecisionService(
  () => {},
  {
    taskHint: async () => ({
      delivery: 'not_required',
      deliveryConfidence: 0.9,
      orchestration: 'single',
      orchestrationConfidence: 0.95,
      workflow: 'general_chat',
      workflowConfidence: 0.82,
      toolNeeds: {
        readFile: { value: 'no', confidence: 0.9 },
        writeFile: { value: 'no', confidence: 0.9 },
        runCommand: { value: 'yes', confidence: 0.92 },
      },
      riskLevel: 'unknown',
      riskConfidence: 0.2,
      needsApproval: { value: 'yes', confidence: 0.85 },
      evaluation: { status: 'ok', elapsedMs: 1 },
    }),
  },
  new WorkflowRegistry(),
  coreCatalog,
).decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: '',
    workspaceRoot: '',
    jev: { enabled: true },
  },
  '查看 java、git、nodejs 和 powershell 版本',
  undefined,
  [],
  {
    modelClassifier: async () => {
      modelClassifierCalledForJevCommand = true;
      return {
        kind: 'fallback',
        mode: 'read_only',
        confidence: 0.99,
        reason: 'incorrectly selected read-only fallback',
      };
    },
  },
);
assert.equal(jevCommandDecision.kind, 'fallback');
assert.equal(jevCommandDecision.mode, 'command_query');
assert.equal(jevCommandDecision.source, 'jev');
assert.deepEqual(jevCommandDecision.allowedTools, ['run_command']);
assert.equal(modelClassifierCalledForJevCommand, false);

const unsafeJevCommandDecision = await new WorkflowDecisionService(
  () => {},
  {
    taskHint: async () => ({
      delivery: 'required',
      deliveryConfidence: 0.92,
      orchestration: 'single',
      orchestrationConfidence: 0.95,
      workflow: 'general_chat',
      workflowConfidence: 0.82,
      toolNeeds: {
        readFile: { value: 'no', confidence: 0.9 },
        writeFile: { value: 'yes', confidence: 0.92 },
        runCommand: { value: 'yes', confidence: 0.92 },
      },
      riskLevel: 'medium',
      riskConfidence: 0.8,
      needsApproval: { value: 'yes', confidence: 0.9 },
      evaluation: { status: 'ok', elapsedMs: 1 },
    }),
  },
  new WorkflowRegistry(),
  coreCatalog,
).decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: '',
    workspaceRoot: '',
    jev: { enabled: true },
  },
  '运行检查并保存报告',
  undefined,
  [],
);
assert.equal(unsafeJevCommandDecision.kind, 'fallback');
assert.equal(unsafeJevCommandDecision.mode, 'file_edit');
assert(!unsafeJevCommandDecision.allowedTools?.includes('run_command'));

const explicitAllowlistDecision = await decisionService.decide(
  {
    baseUrl: '',
    apiKey: 'test',
    model: 'test',
    exportDir: '',
    workspaceRoot: '',
    jev: { enabled: false },
  },
  '执行旧 Provider 的自定义动作',
  undefined,
  [],
  {
    modelClassifier: async () => ({
      kind: 'fallback',
      mode: 'file_edit',
      confidence: 0.88,
      reason: 'legacy provider supplied an explicit allowlist',
      allowedTools: ['legacy_custom_tool'],
    }),
  },
);
assert.deepEqual(explicitAllowlistDecision.allowedTools, ['legacy_custom_tool']);

console.log('tool catalog tests passed');
