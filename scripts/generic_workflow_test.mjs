import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentDecisionService,
  GENERIC_FILE_INSPECTION_TOOL_NAMES,
  GENERIC_FILE_INSPECTION_WORKFLOW,
  ST_WORKSPACE_DELIVERY_WORKFLOW,
  StWorkspaceDeliveryWorkflow,
  ToolCatalog,
  ToolRegistry,
  WorkflowDecisionService,
  WorkflowRegistry,
  createCoreToolProvider,
  createStCodeDeliveryContract,
  createWorkflowRuntimeState,
  createWorkflowRuntime,
  evaluateCompletionGate,
  getGenericFileInspectionState,
  normalizeWorkflowRuntime,
  describeWorkflowDescriptor,
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

  const runtimeState = createWorkflowRuntimeState();
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
  assert(runtime.completionAdapter);
  assert.equal('hydrate' in runtime, false);
  assert.equal('chooseRepairTool' in runtime, false);
  runtime.completionAdapter.restore?.([record]);
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

  const minimalRuntime = normalizeWorkflowRuntime({
    id: 'minimal_generic_workflow',
    title: 'Minimal generic workflow',
    businessToolNames: ['read_file'],
  });
  assert.deepEqual(minimalRuntime.stages, []);
  assert.equal(minimalRuntime.parallelToolCalls, true);
  assert.equal(minimalRuntime.instructions(), '');
  assert.equal(minimalRuntime.initialTool({ isResume: false }), undefined);
  assert.equal(
    minimalRuntime.completionAdapter?.selectRepairTool?.(
      {
        passed: false,
        reason: 'not needed',
        repairInstruction: '',
        issues: [],
      },
      [],
      new Set(['read_file']),
    ),
    undefined,
  );
  minimalRuntime.completionAdapter?.restore?.([]);
  assert.equal(minimalRuntime.completionAdapter?.finalMessage?.([]), undefined);
  assert.equal(minimalRuntime.completionAdapter?.collectActionArtifact?.({
    name: 'read_file',
    args: '{}',
    result: readResult,
  }), undefined);
  assert.deepEqual(
    describeWorkflowDescriptor({
      id: 'minimal_generic_workflow',
      title: 'Minimal generic workflow',
      description: 'No delivery-specific methods.',
      runtimeManaged: true,
    }),
    {
      id: 'minimal_generic_workflow',
      title: 'Minimal generic workflow',
      description: 'No delivery-specific methods.',
    },
  );

  const stDeliveryContract = createStCodeDeliveryContract({
    workspacePersistence: 'required',
  });
  const genericStRuntime = createWorkflowRuntime(
    'st_workspace_delivery',
    stDeliveryContract,
    createWorkflowRuntimeState(),
    new WorkflowRegistry([ST_WORKSPACE_DELIVERY_WORKFLOW]),
    { userText: '生成 ST 程序并保存到工作区' },
  );
  assert(genericStRuntime);
  assert.equal(typeof ST_WORKSPACE_DELIVERY_WORKFLOW.matchesContract, 'function');
  assert.equal(typeof ST_WORKSPACE_DELIVERY_WORKFLOW.createContract, 'function');
  assert.equal(ST_WORKSPACE_DELIVERY_WORKFLOW.matchesDeliveryContract, undefined);
  assert.equal(ST_WORKSPACE_DELIVERY_WORKFLOW.createDeliveryContract, undefined);
  assert.equal(
    StWorkspaceDeliveryWorkflow.prototype.chooseRepairTool,
    undefined,
  );
  assert.equal(StWorkspaceDeliveryWorkflow.prototype.hydrate, undefined);
  assert.equal(
    StWorkspaceDeliveryWorkflow.prototype.verifyRequiredAction,
    undefined,
  );
  assert(genericStRuntime.completionAdapter);
  assert.equal(
    genericStRuntime.completionAdapter.finalMessage?.([]),
    undefined,
  );
  assert.equal(
    genericStRuntime.completionAdapter.collectActionArtifact?.({
      name: 'st_change_impact',
      args: '{}',
      result: readResult,
    }),
    undefined,
  );

  console.log('generic workflow plugin tests passed');
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}
