import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const taskPlanDecisionSchema = z.object({
  requiresPlan: z.boolean(),
  goal: z.string(),
  reason: z.string(),
  steps: z.array(z.object({
    title: z.string(),
    objective: z.string(),
    completionCriteria: z.string(),
    suggestedTools: z.array(z.string()),
  }).strict()),
}).strict();

export type TaskPlanDecision = z.infer<typeof taskPlanDecisionSchema>;

export const taskStepStatusSchema = z.enum(['pending', 'running', 'completed']);
export type TaskStepStatus = z.infer<typeof taskStepStatusSchema>;

export const taskPlanStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
]);
export type TaskPlanStatus = z.infer<typeof taskPlanStatusSchema>;

export const taskPlanSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  goal: z.string().min(1),
  reason: z.string(),
  status: taskPlanStatusSchema,
  currentStepId: z.string().optional(),
  steps: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    objective: z.string().min(1),
    completionCriteria: z.string().min(1),
    suggestedTools: z.array(z.string()),
    status: taskStepStatusSchema,
    note: z.string().optional(),
  })).min(2).max(8),
});

export type TaskPlan = z.infer<typeof taskPlanSchema>;
export type TaskPlanProgress = {
  stepId: string;
  phase: 'started' | 'completed';
  note?: string;
};

function compact(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

/** Convert untrusted model output into the bounded durable plan contract. */
export function createTaskPlan(value: unknown, fallbackGoal: string): TaskPlan | undefined {
  const decision = taskPlanDecisionSchema.parse(value);
  if (!decision.requiresPlan) return undefined;
  if (decision.steps.length < 2 || decision.steps.length > 8) {
    throw new Error('多步计划必须包含 2 到 8 个线性步骤');
  }
  const goal = compact(decision.goal, 500) || compact(fallbackGoal, 500);
  if (!goal) throw new Error('多步计划缺少有效目标');
  return taskPlanSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    goal,
    reason: compact(decision.reason, 500),
    status: 'pending',
    steps: decision.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      title: compact(step.title, 120) || `步骤 ${index + 1}`,
      objective: compact(step.objective, 600),
      completionCriteria: compact(step.completionCriteria, 600),
      suggestedTools: [...new Set(step.suggestedTools.map((name) => compact(name, 80)).filter(Boolean))]
        .slice(0, 12),
      status: 'pending',
    })),
  });
}

export function parseTaskPlan(value: unknown): TaskPlan {
  return taskPlanSchema.parse(value);
}

export function startTaskPlan(plan: TaskPlan): TaskPlan {
  const next = structuredClone(plan);
  if (next.status === 'completed') return next;
  const current = next.steps.find((step) => step.status === 'running')
    ?? next.steps.find((step) => step.status === 'pending');
  next.status = 'running';
  if (current) {
    current.status = 'running';
    next.currentStepId = current.id;
  }
  return taskPlanSchema.parse(next);
}

export function updateTaskPlan(plan: TaskPlan, progress: TaskPlanProgress): TaskPlan {
  const next = structuredClone(plan);
  const index = next.steps.findIndex((step) => step.id === progress.stepId);
  if (index < 0) throw new Error(`计划步骤不存在: ${progress.stepId}`);
  if (next.status === 'completed' || next.status === 'failed') {
    throw new Error(`计划已处于终态: ${next.status}`);
  }
  if (next.steps.slice(0, index).some((step) => step.status !== 'completed')) {
    throw new Error(`计划步骤必须按顺序执行: ${progress.stepId}`);
  }
  const step = next.steps[index];
  if (progress.phase === 'started') {
    const otherRunning = next.steps.find((item) => item.status === 'running' && item.id !== step.id);
    if (otherRunning) throw new Error(`必须先完成当前步骤: ${otherRunning.id}`);
    if (step.status === 'completed') throw new Error(`计划步骤已完成: ${step.id}`);
    step.status = 'running';
    next.currentStepId = step.id;
    next.status = 'running';
  } else {
    if (step.status === 'pending') throw new Error(`计划步骤尚未开始: ${step.id}`);
    step.status = 'completed';
    next.currentStepId = next.steps[index + 1]?.id;
    next.status = next.steps.every((item) => item.status === 'completed') ? 'completed' : 'running';
  }
  const note = compact(progress.note ?? '', 500);
  if (note) step.note = note;
  return taskPlanSchema.parse(next);
}

export function finishTaskPlan(plan: TaskPlan): TaskPlan {
  const next = structuredClone(plan);
  for (const step of next.steps) step.status = 'completed';
  next.status = 'completed';
  delete next.currentStepId;
  return taskPlanSchema.parse(next);
}

export function pauseTaskPlan(plan: TaskPlan): TaskPlan {
  if (plan.status === 'completed' || plan.status === 'failed') return plan;
  return taskPlanSchema.parse({ ...plan, status: 'paused' });
}

export function failTaskPlan(plan: TaskPlan): TaskPlan {
  if (plan.status === 'completed') return plan;
  return taskPlanSchema.parse({ ...plan, status: 'failed' });
}

export function restartTaskPlan(plan: TaskPlan | undefined): TaskPlan | undefined {
  if (!plan) return undefined;
  return taskPlanSchema.parse({
    ...plan,
    status: 'pending',
    currentStepId: undefined,
    steps: plan.steps.map((step) => ({
      ...step,
      status: 'pending',
      note: undefined,
    })),
  });
}

export function renderTaskPlan(plan: TaskPlan): string {
  return [
    `目标: ${plan.goal}`,
    ...plan.steps.map((step, index) => {
      const tools = step.suggestedTools.length ? `；可用工具建议: ${step.suggestedTools.join(', ')}` : '';
      return `${index + 1}. [${step.id}] ${step.title}: ${step.objective}；完成标准: ${step.completionCriteria}${tools}`;
    }),
  ].join('\n');
}
