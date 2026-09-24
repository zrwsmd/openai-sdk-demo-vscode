import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentDecisionService,
  GENERIC_FILE_INSPECTION_TOOL_NAMES,
  GENERIC_FILE_INSPECTION_WORKFLOW,
  ST_INSPECTION_WORKFLOW,
  ToolCatalog,
  ToolRegistry,
  WorkflowDecisionService,
  WorkflowRegistry,
  createCoreToolProvider,
  createDeliveryWorkflowRuntimeState,
  evaluateCompletionGate,
  getGenericFileInspectionState,
  resolveWorkflowBusinessToolPolicy,
} from './agent.testbundle.mjs';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'generic-workflow-'));
const samplePath = path.join(workspace, 'sample.txt');
await fs.writeFile(samplePath, 'generic workflow fixture\n', 'utf8');

try {
  const workflowRegistry = new WorkflowRegistry([
    GENERIC_FILE_INSPECTION_WORKFLOW,
  ]);
  const cfg = {
    baseUrl: 'http://127.0.0.1:8790/v1',
    apiKey: 'test',
    model: 'test',
    exportDir: workspace,
    workspaceRoot: workspace,
    jev: { enabled: false },
  };
  const decisionService = new WorkflowDecisionService(
    () => {},
    new AgentDecisionService(() => {}),
    workflowRegistry,
  );
  const decision = await decisionService.decide(
    cfg,
    '检查当前工作区里的文件内容',
  );
  assert.equal(decision.kind, 'workflow');
  assert.equal(decision.workflow.id, 'generic_file_inspection');
  assert.equal(decision.source, 'local');

  const runtimeState = createDeliveryWorkflowRuntimeState();
  const runtime = GENERIC_FILE_INSPECTION_WORKFLOW.createRuntime?.(
    undefined,
    runtimeState,
  );
  assert(runtime);
  assert.deepEqual(
    [...runtime.visibleToolNames],
    [...GENERIC_FILE_INSPECTION_TOOL_NAMES],
  );

  const toolRegistry = new ToolRegistry([createCoreToolProvider()]);
  const tools = toolRegistry.createTools({ cfg, workflow: runtime });
  const visibleTools = tools.filter((tool) =>
    runtime.visibleToolNames.includes(tool.name),
  );
  assert.deepEqual(
    visibleTools.map((tool) => tool.name).sort(),
    [...GENERIC_FILE_INSPECTION_TOOL_NAMES].sort(),
  );
  assert(!visibleTools.some((tool) => tool.name === 'write_file'));

  const readTool = visibleTools.find((tool) => tool.name === 'read_file');
  assert(readTool, 'workflow should expose read_file');
  const readResult = {
    protocolVersion: 1,
    ok: true,
    data: {
      path: 'sample.txt',
      content: 'generic workflow fixture\n',
    },
    diagnostics: [],
    effect: 'none',
    risk: 'read',
  };

  const record = {
    name: 'read_file',
    args: JSON.stringify({ path: 'sample.txt' }),
    result: readResult,
    order: 1,
  };
  runtime.hydrate([record]);
  assert(runtime.state.inspectedTargets.has('read_file'));
  assert(runtime.state.inspectedTargets.has('sample.txt'));

  const gate = evaluateCompletionGate({
    userText: '检查当前工作区里的文件内容',
    finalMessage: '已完成文件检查。',
    toolResults: [record],
    workflowAdapter: runtime,
  });
  assert.deepEqual(gate, { passed: true });

  const resumedRuntime = GENERIC_FILE_INSPECTION_WORKFLOW.createRuntime?.(
    undefined,
    runtimeState,
  );
  assert(resumedRuntime);
  assert(
    getGenericFileInspectionState(runtimeState).inspectedTargets.has('sample.txt'),
  );
  assert(resumedRuntime.state.inspectedTargets.has('sample.txt'));

  const visibilityContext = {
    userText: '检查当前工作区里的文件内容',
    state: runtimeState,
    toolCatalog: toolRegistry.getToolCatalog(),
  };
  assert.deepEqual(
    resolveWorkflowBusinessToolPolicy([{
      id: 'no-policy',
    }], visibilityContext),
    { mode: 'deny_all' },
  );
  assert.deepEqual(
    resolveWorkflowBusinessToolPolicy([{
      id: 'all-business-tools',
      defaultBusinessToolAccess: 'allow_all',
    }], visibilityContext),
    { mode: 'allow_all' },
  );
  const descriptorOnlyPolicy = {
    id: 'descriptor-only',
    businessToolNames: ['read_file'],
  };
  assert.deepEqual(
    resolveWorkflowBusinessToolPolicy([descriptorOnlyPolicy], visibilityContext),
    { mode: 'allow_list', names: ['read_file'] },
  );

  const stState = createDeliveryWorkflowRuntimeState();
  const stRuntime = ST_INSPECTION_WORKFLOW.createRuntime?.(
    undefined,
    stState,
    { userText: '分析这个 ST 文件的变更影响面' },
  );
  assert(stRuntime);
  const stVisibility = resolveWorkflowBusinessToolPolicy(
    [stRuntime, ST_INSPECTION_WORKFLOW],
    {
      userText: '分析这个 ST 文件的变更影响面',
      state: stState,
      toolCatalog: new ToolCatalog(),
    },
  );
  assert.deepEqual(stVisibility, {
    mode: 'allow_list',
    names: ['st_change_impact'],
  });
  assert.equal(stRuntime.initialTool({ isResume: false }), 'st_change_impact');
  assert.deepEqual(
    resolveWorkflowBusinessToolPolicy(
      [stRuntime, ST_INSPECTION_WORKFLOW],
      {
        userText: '查找变量的声明和引用位置',
        state: stState,
        toolCatalog: new ToolCatalog(),
      },
    ),
    { mode: 'allow_list', names: ['st_symbol_references'] },
  );

  console.log('generic workflow plugin tests passed');
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}
