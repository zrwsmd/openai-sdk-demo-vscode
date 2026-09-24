import assert from 'node:assert/strict';
import {
  ToolCatalog,
  ToolRegistry,
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
assert.deepEqual(
  appCatalog.find({ providerId: 'st', tags: ['analysis'] }).map((item) => item.name),
  ['validate_st_code', 'st_dependency_map', 'st_change_impact', 'st_symbol_references'],
);

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

console.log('tool catalog tests passed');
