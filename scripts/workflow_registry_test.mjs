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
assert(allToolNames.includes('st_dependency_map'));
assert.equal(appTools.getRisk('validate_st_code'), 'plan');
assert.equal(appTools.getRisk('export_st_program'), 'write');
assert(appTools.toolsForEvidence('successful_export').includes('export_st_program'));
assert.throws(
  () => new ToolRegistry([createCoreToolProvider(), createStToolProvider(), createStToolProvider()]),
  /already registered/,
);

console.log('workflow and tool registry tests passed');
