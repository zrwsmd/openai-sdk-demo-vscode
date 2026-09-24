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
  ['validate_st_code', 'st_dependency_map', 'st_change_impact', 'st_symbol_references'],
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
]);

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
assert.deepEqual(customCatalog.listByProvider('MODBUS').map((item) => item.name), [
  'query_modbus_device',
]);
assert.equal(customCatalog.findByIntent('查询 Modbus 状态')[0]?.name, 'query_modbus_device');
assert.deepEqual(customCatalog.toolsForFallback('read_only'), ['query_modbus_device']);
assert.deepEqual(customCatalog.toolsForFallback('file_edit'), ['query_modbus_device']);
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
  capabilities: [customCapability],
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
assert.deepEqual(fallbackDecision.allowedTools, ['query_modbus_device']);

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
