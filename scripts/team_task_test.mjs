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
