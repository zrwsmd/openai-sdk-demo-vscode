import {
  createForcedTeamTask,
  startTeamNode,
  applyTeamPlannerReport,
  completeTeamNode,
  continueTeamTask,
  pauseTeamTask,
  restartTeamTask,
} from './agent.testbundle.mjs';

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
