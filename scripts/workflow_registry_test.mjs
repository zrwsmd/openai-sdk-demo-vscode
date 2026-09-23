import assert from 'node:assert/strict';
import {
  ST_INSPECTION_WORKFLOW,
  ST_WORKSPACE_DELIVERY_WORKFLOW,
  WorkflowRegistry,
  createAppWorkflowRegistry,
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

console.log('workflow registry tests passed');
