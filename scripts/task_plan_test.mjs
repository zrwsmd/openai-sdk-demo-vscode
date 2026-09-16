import {
  parseTaskPlan,
  restartTaskPlan,
  startTaskPlan,
  updateTaskPlan,
} from './agent.testbundle.mjs';

const basePlan = {
  schemaVersion: 1,
  id: 'verification-plan',
  goal: '完成一个通用多步任务',
  reason: '步骤有明确依赖',
  status: 'pending',
  steps: [
    {
      id: 'step-1',
      title: '准备',
      objective: '准备需要的输入',
      completionCriteria: '全部输入已确认',
      suggestedTools: [],
      status: 'pending',
    },
    {
      id: 'step-2',
      title: '执行',
      objective: '完成目标动作',
      completionCriteria: '结果已验证',
      suggestedTools: [],
      status: 'pending',
    },
  ],
};

let plan = startTaskPlan(parseTaskPlan(basePlan));
let missingVerificationBlocked = false;
try {
  updateTaskPlan(plan, { stepId: 'step-1', phase: 'completed' });
} catch (error) {
  missingVerificationBlocked = /自检结论/.test(error?.message ?? '');
}
if (!missingVerificationBlocked) {
  throw new Error('a plan step completed without a self-check');
}

plan = updateTaskPlan(plan, {
  stepId: 'step-1',
  phase: 'completed',
  verification: {
    verdict: 'retry',
    evidence: '读取结果缺少一个必填字段',
    issue: '输入不完整',
    nextAction: '读取并确认缺失字段',
  },
});
if (
  plan.status !== 'running' ||
  plan.currentStepId !== 'step-1' ||
  plan.steps[0].status !== 'running' ||
  plan.steps[0].verification?.verdict !== 'retry'
) {
  throw new Error('failed verification advanced or lost the active step');
}

plan = updateTaskPlan(plan, {
  stepId: 'step-1',
  phase: 'completed',
  verification: { verdict: 'passed', evidence: '全部必填输入均已读取并确认' },
});
plan = updateTaskPlan(plan, { stepId: 'step-2', phase: 'started' });
plan = updateTaskPlan(plan, {
  stepId: 'step-2',
  phase: 'completed',
  verification: { verdict: 'passed', evidence: '执行回执满足本步骤完成标准' },
});
if (plan.status !== 'completed' || plan.steps.some((step) => step.verification?.verdict !== 'passed')) {
  throw new Error('verified plan did not complete');
}

const restarted = restartTaskPlan(plan);
if (restarted?.status !== 'pending' || restarted.steps.some((step) => step.verification !== undefined)) {
  throw new Error('retry retained stale verification evidence');
}

console.log('task plan tests passed: verified completion, corrective retry, clean restart');
