import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentDecisionService,
  GENERIC_FILE_INSPECTION_TOOL_NAMES,
  GENERIC_FILE_INSPECTION_WORKFLOW,
  ToolRegistry,
  WorkflowDecisionService,
  WorkflowRegistry,
  createCoreToolProvider,
  createDeliveryWorkflowRuntimeState,
  evaluateCompletionGate,
  getGenericFileInspectionState,
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

  console.log('generic workflow plugin tests passed');
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}
