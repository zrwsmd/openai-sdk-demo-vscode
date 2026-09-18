import {
  createForcedTeamTask,
  startTeamNode,
  applyTeamPlannerReport,
  completeTeamNode,
  continueTeamTask,
  pauseTeamTask,
  restartTeamTask,
  createExecutionGraph,
  getExecutionGraphReadyNodes,
  startExecutionGraphNode,
  completeExecutionGraphNode,
  failExecutionGraphNode,
  pauseExecutionGraphNode,
  continueExecutionGraph,
  retryExecutionGraphNodes,
  reviseExecutionGraph,
  updateExecutionGraphControl,
} from './agent.testbundle.mjs';

let dag = createExecutionGraph({
  maxParallelism: 2,
  nodes: [
    { id: 'read-a', title: '读取 A', objective: '读取 A', dependsOn: [], completionCriteria: '有结果', suggestedTools: ['read_file'], effect: 'read', resources: ['file:a'], parallelSafe: true },
    { id: 'read-b', title: '读取 B', objective: '读取 B', dependsOn: [], completionCriteria: '有结果', suggestedTools: ['read_file'], effect: 'read', resources: ['file:b'], parallelSafe: true },
    { id: 'write', title: '写入', objective: '写入结果', dependsOn: ['read-a', 'read-b'], completionCriteria: '写入成功', suggestedTools: ['write_file'], effect: 'write', resources: ['workspace'], parallelSafe: false },
  ],
});
if (getExecutionGraphReadyNodes(dag).map((node) => node.id).join(',') !== 'read-a,read-b') {
  throw new Error('DAG did not select independent read-only nodes in parallel');
}
dag = startExecutionGraphNode(startExecutionGraphNode(dag, 'read-a'), 'read-b');
if (getExecutionGraphReadyNodes(dag).length !== 0) throw new Error('DAG scheduled a node while reads were running');
dag = completeExecutionGraphNode(dag, 'read-a', { summary: 'A', evidence: ['a'] });
dag = completeExecutionGraphNode(dag, 'read-b', { summary: 'B', evidence: ['b'] });
if (getExecutionGraphReadyNodes(dag).map((node) => node.id).join(',') !== 'write') throw new Error('DAG did not unlock dependent write');
dag = startExecutionGraphNode(dag, 'write');
dag = pauseExecutionGraphNode(dag, 'write', 'checkpoint');
dag = continueExecutionGraph(dag);
if (getExecutionGraphReadyNodes(dag).map((node) => node.id).join(',') !== 'write') throw new Error('DAG continuation did not resume paused node');
dag = startExecutionGraphNode(dag, 'write');
dag = failExecutionGraphNode(dag, 'write', 'write failed');
if (dag.status !== 'failed' || dag.nodes.find((node) => node.id === 'write')?.status !== 'failed') throw new Error('DAG failure state not persisted');

const normalizedSideEffect = createExecutionGraph({
  maxParallelism: 2,
  nodes: [
    { id: 'write-safe-oops', title: '误标写入', objective: 'write', dependsOn: [], completionCriteria: 'done', suggestedTools: ['write_file'], effect: 'write', resources: ['workspace'], parallelSafe: true },
  ],
});
if (normalizedSideEffect.nodes[0].parallelSafe !== false) {
  throw new Error('side-effect node parallelSafe flag was not normalized to false');
}
if (getExecutionGraphReadyNodes(normalizedSideEffect).map((node) => node.id).join(',') !== 'write-safe-oops') {
  throw new Error('normalized side-effect node should still be schedulable as an exclusive node');
}

let governed = createExecutionGraph({
  maxParallelism: 2,
  budget: { maxRequests: 3 },
  timeoutMs: 2_000,
  nodeTimeoutMs: 500,
  maxRetries: 2,
  nodes: [
    { id: 'low', title: '低优先级', objective: 'low', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['low'], parallelSafe: true, priority: 10 },
    { id: 'high', title: '高优先级', objective: 'high', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['high'], parallelSafe: true, priority: 90 },
    { id: 'middle', title: '中优先级', objective: 'middle', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['middle'], parallelSafe: true, priority: 50 },
  ],
});
if (getExecutionGraphReadyNodes(governed).map((node) => node.id).join(',') !== 'high,middle') {
  throw new Error('DAG priority or concurrency limit was not enforced');
}
const mixedPriority = createExecutionGraph({
  maxParallelism: 2,
  nodes: [
    { id: 'high-read', title: '高优先只读', objective: 'read', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['source'], parallelSafe: true, priority: 90 },
    { id: 'low-write', title: '低优先写入', objective: 'write', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'write', resources: ['workspace'], parallelSafe: false, priority: 10 },
  ],
});
if (getExecutionGraphReadyNodes(mixedPriority).map((node) => node.id).join(',') !== 'high-read') {
  throw new Error('a lower-priority exclusive node bypassed a higher-priority safe node');
}
governed = updateExecutionGraphControl(governed, { inputTokens: 11, outputTokens: 7, requests: 1 }, 250);
if (governed.usage.requests !== 1 || governed.elapsedMs !== 250 || governed.timeoutMs !== 2_000) {
  throw new Error('DAG budget and timeout progress was not persisted');
}

let controlled = createExecutionGraph({
  maxParallelism: 1,
  budget: { maxRequests: 4 },
  timeoutMs: 2_000,
  nodeTimeoutMs: 500,
  maxRetries: 2,
  nodes: [
    { id: 'inspect', title: '检查', objective: 'inspect', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['source'], parallelSafe: true, priority: 80 },
    { id: 'apply', title: '应用', objective: 'apply', dependsOn: ['inspect'], completionCriteria: 'done', suggestedTools: [], effect: 'write', resources: ['workspace'], parallelSafe: false, priority: 50 },
  ],
});
controlled = startExecutionGraphNode(controlled, 'inspect');
controlled = completeExecutionGraphNode(controlled, 'inspect', { summary: 'inspected', evidence: ['source'] });
controlled = startExecutionGraphNode(controlled, 'apply');
controlled = completeExecutionGraphNode(controlled, 'apply', { summary: 'applied', evidence: ['workspace'] });
controlled = retryExecutionGraphNodes(controlled, ['apply'], 'verification gap');
if (controlled.nodes[0].status !== 'completed' || controlled.nodes[1].status !== 'pending' || controlled.retryCount !== 1) {
  throw new Error('controlled retry did not preserve completed dependencies');
}
controlled = reviseExecutionGraph(controlled, {
  maxParallelism: 4,
  budget: { maxRequests: 100 },
  timeoutMs: 20_000,
  nodeTimeoutMs: 5_000,
  maxRetries: 5,
  nodes: [
    { id: 'inspect', title: '检查', objective: 'inspect', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['source'], parallelSafe: true, priority: 80 },
    { id: 'apply', title: '重新应用', objective: 'apply safely', dependsOn: ['inspect'], completionCriteria: 'done', suggestedTools: [], effect: 'write', resources: ['workspace'], parallelSafe: false, priority: 60 },
    { id: 'confirm', title: '确认', objective: 'confirm', dependsOn: ['apply'], completionCriteria: 'verified', suggestedTools: [], effect: 'read', resources: ['workspace'], parallelSafe: true, priority: 40 },
  ],
}, 'add final confirmation');
if (
  controlled.nodes[0].status !== 'completed' || controlled.nodes[1].title !== '重新应用' ||
  controlled.nodes[2].id !== 'confirm' || controlled.revision !== 2 ||
  controlled.maxParallelism !== 1 || controlled.budget.maxRequests !== 4 ||
  controlled.timeoutMs !== 2_000 || controlled.nodeTimeoutMs !== 500 || controlled.maxRetries !== 2
) {
  throw new Error('controlled graph revision did not preserve started nodes or update pending nodes');
}

let task = createForcedTeamTask('检查项目并安全修改文件');
task = startTeamNode(task, 'planner');
task = applyTeamPlannerReport(task, {
  planSummary: '读取项目、修改目标文件、运行验证',
  reviewFocus: ['修改范围'],
  verificationCriteria: ['目标文件内容正确'],
});
task = completeTeamNode(task, 'planner', { summary: '计划完成', evidence: ['已定义三步计划'] });
task = startTeamNode(task, 'reviewer');
task = completeTeamNode(task, 'reviewer', { summary: '审查通过', evidence: ['范围受限于用户目标'] });
task = startTeamNode(task, 'executor');

const continued = continueTeamTask(pauseTeamTask(task));
if (
  continued.status !== 'pending' ||
  continued.nodes[0].status !== 'completed' ||
  continued.nodes[1].status !== 'completed' ||
  continued.nodes[2].status !== 'pending' ||
  continued.nodes[3].status !== 'pending' ||
  continued.planSummary !== '读取项目、修改目标文件、运行验证'
) {
  throw new Error('safe Team continuation did not preserve completed role boundaries');
}

const restarted = restartTeamTask(task);
if (restarted?.status !== 'pending' || restarted.nodes.some((node) => node.status !== 'pending' || node.output)) {
  throw new Error('Team retry did not reset the full graph');
}

console.log('team task tests passed: contract graph, boundary continuation, clean retry');
