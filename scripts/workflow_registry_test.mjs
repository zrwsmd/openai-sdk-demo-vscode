import assert from 'node:assert/strict';
import {
  ST_INSPECTION_WORKFLOW,
  ST_WORKSPACE_DELIVERY_WORKFLOW,
  WorkflowRegistry,
  ToolRegistry,
  createCoreToolProvider,
  createStToolProvider,
  createAppWorkflowRegistry,
  createAppToolRegistry,
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

const appRegistry = createAppWorkflowRegistry();
assert.equal(appRegistry.get('st_workspace_delivery'), ST_WORKSPACE_DELIVERY_WORKFLOW);
assert.equal(appRegistry.get('st_inspection'), ST_INSPECTION_WORKFLOW);
assert.equal(appRegistry.getByRoute('st_delivery'), ST_WORKSPACE_DELIVERY_WORKFLOW);

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
const coreToolNames = coreTools
  .createTools({ cfg: toolConfig })
  .map((tool) => tool.name);
assert(coreToolNames.includes('write_file'));
assert(!coreToolNames.includes('validate_st_code'));
assert(!coreToolNames.includes('st_dependency_map'));
assert.equal(coreTools.getRisk('write_file'), 'write');
assert.equal(coreTools.getRisk('validate_st_code'), undefined);
assert.deepEqual(coreTools.toolsForEvidence('successful_write'), ['write_file']);
assert.deepEqual(coreTools.toolsForEvidence('successful_export'), []);

const appTools = createAppToolRegistry();
const allTools = appTools.createTools({ cfg: toolConfig });
const allToolNames = allTools.map((tool) => tool.name);
assert(allToolNames.includes('validate_st_code'));
assert(allToolNames.includes('st_dependency_map'));
assert.equal(appTools.getRisk('validate_st_code'), 'plan');
assert.equal(appTools.getRisk('export_st_program'), 'write');
assert(appTools.toolsForEvidence('successful_export').includes('export_st_program'));
assert.throws(
  () => new ToolRegistry([createCoreToolProvider(), createStToolProvider(), createStToolProvider()]),
  /already registered/,
);

console.log('workflow and tool registry tests passed');
