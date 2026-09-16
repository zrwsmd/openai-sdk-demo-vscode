import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** Model-selected entry point: ordinary requests stay on the single-agent path. */
export const teamRouteDecisionSchema = z.object({
  route: z.enum(['single', 'team']),
  goal: z.string(),
  reason: z.string(),
  planSummary: z.string(),
  reviewFocus: z.array(z.string()),
  verificationCriteria: z.array(z.string()),
}).strict();
export type TeamRouteDecision = z.infer<typeof teamRouteDecisionSchema>;

export const teamRoleSchema = z.enum(['planner', 'reviewer', 'executor', 'verifier']);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const teamNodeStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type TeamNodeStatus = z.infer<typeof teamNodeStatusSchema>;

export const teamTaskStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'verification_failed',
  'failed',
]);
export type TeamTaskStatus = z.infer<typeof teamTaskStatusSchema>;

/**
 * Role contracts are deliberately compact and durable. Full SDK RunState and
 * tool output stay in their existing stores; this graph records only the
 * evidence summary needed to safely explain, resume and schedule a task.
 */
export const teamNodeOutputSchema = z.object({
  summary: z.string().min(1),
  evidence: z.array(z.string()).max(12),
}).strict();
export type TeamNodeOutput = z.infer<typeof teamNodeOutputSchema>;

export const teamTaskNodeSchema = z.object({
  id: teamRoleSchema,
  role: teamRoleSchema,
  dependsOn: z.array(teamRoleSchema),
  status: teamNodeStatusSchema,
  inputSummary: z.string().min(1),
  output: teamNodeOutputSchema.optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
}).strict();
export type TeamTaskNode = z.infer<typeof teamTaskNodeSchema>;

export const teamTaskSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  goal: z.string().min(1),
  routeReason: z.string(),
  planSummary: z.string().min(1),
  reviewFocus: z.array(z.string()).max(8),
  verificationCriteria: z.array(z.string()).max(8),
  status: teamTaskStatusSchema,
  nodes: z.array(teamTaskNodeSchema).length(4),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();
export type TeamTask = z.infer<typeof teamTaskSchema>;

export const teamReviewReportSchema = z.object({
  approved: z.boolean(),
  summary: z.string(),
  findings: z.array(z.string()),
  requiredChanges: z.array(z.string()),
}).strict();
export type TeamReviewReport = z.infer<typeof teamReviewReportSchema>;

export const teamVerificationReportSchema = z.object({
  passed: z.boolean(),
  summary: z.string(),
  evidence: z.array(z.string()),
  gaps: z.array(z.string()),
  nextAction: z.string().optional(),
}).strict();
export type TeamVerificationReport = z.infer<typeof teamVerificationReportSchema>;

export interface TeamPlannerInput {
  userText: string;
  historyItemCount: number;
}

export const teamPlannerReportSchema = z.object({
  planSummary: z.string(),
  reviewFocus: z.array(z.string()),
  verificationCriteria: z.array(z.string()),
}).strict();
export type TeamPlannerReport = z.infer<typeof teamPlannerReportSchema>;
export type TeamPlannerOutput = TeamPlannerReport;

export interface TeamReviewerInput {
  goal: string;
  planSummary: string;
}

export type TeamReviewerOutput = TeamReviewReport;

export interface TeamExecutorInput {
  goal: string;
  approvedPlanSummary: string;
}

export interface TeamExecutorOutput {
  summary: string;
  evidence: string[];
}

export interface TeamVerifierInput {
  goal: string;
  planSummary: string;
  executorSummary: string;
}

export type TeamVerifierOutput = TeamVerificationReport;

const ROLE_ORDER: TeamRole[] = ['planner', 'reviewer', 'executor', 'verifier'];
const DEPENDENCIES: Record<TeamRole, TeamRole[]> = {
  planner: [],
  reviewer: ['planner'],
  executor: ['reviewer'],
  verifier: ['executor'],
};

function compact(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function now(): string {
  return new Date().toISOString();
}

function initialNodes(userText: string): TeamTaskNode[] {
  return ROLE_ORDER.map((role) => ({
    id: role,
    role,
    dependsOn: DEPENDENCIES[role],
    status: 'pending',
    inputSummary: role === 'planner'
      ? `用户请求：${compact(userText, 800)}`
      : `${DEPENDENCIES[role].join(' → ')} 的已确认输出`,
  }));
}

function assertGraph(task: TeamTask): TeamTask {
  const parsed = teamTaskSchema.parse(task);
  const ids = parsed.nodes.map((node) => node.id);
  if (ROLE_ORDER.some((role, index) => ids[index] !== role)) {
    throw new Error('协作任务图节点顺序无效');
  }
  for (const node of parsed.nodes) {
    if (node.role !== node.id) throw new Error(`协作节点角色不匹配: ${node.id}`);
    if (node.dependsOn.join(',') !== DEPENDENCIES[node.id].join(',')) {
      throw new Error(`协作节点依赖无效: ${node.id}`);
    }
  }
  return parsed;
}

export function createTeamTask(decision: unknown, userText: string): TeamTask | undefined {
  const route = teamRouteDecisionSchema.parse(decision);
  if (route.route !== 'team') return undefined;
  const timestamp = now();
  return assertGraph({
    schemaVersion: 1,
    id: randomUUID(),
    goal: compact(route.goal, 500) || compact(userText, 500),
    routeReason: compact(route.reason, 500),
    planSummary: compact(route.planSummary, 1_000) || compact(userText, 1_000),
    reviewFocus: route.reviewFocus.map((item) => compact(item, 300)).filter(Boolean).slice(0, 8),
    verificationCriteria: route.verificationCriteria.map((item) => compact(item, 300)).filter(Boolean).slice(0, 8),
    status: 'pending',
    nodes: initialNodes(userText),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Manual Team mode is an explicit override; automatic mode uses createTeamTask. */
export function createForcedTeamTask(userText: string): TeamTask {
  return createTeamTask({
    route: 'team',
    goal: userText,
    reason: '用户在配置中明确要求使用协作模式',
    planSummary: userText,
    reviewFocus: ['范围、风险和副作用约束'],
    verificationCriteria: ['最终结果满足用户请求且有真实证据'],
  }, userText)!;
}

export function parseTeamTask(value: unknown): TeamTask {
  return assertGraph(value as TeamTask);
}

export function startTeamNode(task: TeamTask, role: TeamRole): TeamTask {
  const next = structuredClone(task);
  if (next.status === 'completed' || next.status === 'verification_failed' || next.status === 'failed') {
    throw new Error(`协作任务已处于终态: ${next.status}`);
  }
  const index = ROLE_ORDER.indexOf(role);
  const node = next.nodes[index];
  if (node.status === 'completed') throw new Error(`协作节点已完成: ${role}`);
  if (node.status === 'failed') throw new Error(`协作节点已失败: ${role}`);
  if (next.nodes.slice(0, index).some((item) => item.status !== 'completed')) {
    throw new Error(`协作节点依赖尚未完成: ${role}`);
  }
  const running = next.nodes.find((item) => item.status === 'running' && item.id !== role);
  if (running) throw new Error(`必须先收敛协作节点: ${running.id}`);
  node.status = 'running';
  node.startedAt ??= now();
  next.status = 'running';
  next.updatedAt = now();
  return assertGraph(next);
}

export function completeTeamNode(
  task: TeamTask,
  role: TeamRole,
  output: TeamNodeOutput,
): TeamTask {
  const next = structuredClone(task);
  const node = next.nodes[ROLE_ORDER.indexOf(role)];
  if (node.status !== 'running') throw new Error(`协作节点尚未运行: ${role}`);
  node.status = 'completed';
  node.output = teamNodeOutputSchema.parse({
    summary: compact(output.summary, 1_000),
    evidence: output.evidence.map((item) => compact(item, 500)).filter(Boolean).slice(0, 12),
  });
  node.completedAt = now();
  delete node.error;
  next.status = next.nodes.every((item) => item.status === 'completed') ? 'completed' : 'running';
  next.updatedAt = now();
  return assertGraph(next);
}

/** Only the planner may refine the route's preliminary contract. */
export function applyTeamPlannerReport(task: TeamTask, report: unknown): TeamTask {
  const parsed = teamPlannerReportSchema.parse(report);
  const next = structuredClone(task);
  const planner = next.nodes[0];
  if (planner.status !== 'running') throw new Error('规划节点尚未运行');
  next.planSummary = compact(parsed.planSummary, 1_000) || next.planSummary;
  next.reviewFocus = parsed.reviewFocus
    .map((item) => compact(item, 300)).filter(Boolean).slice(0, 8);
  next.verificationCriteria = parsed.verificationCriteria
    .map((item) => compact(item, 300)).filter(Boolean).slice(0, 8);
  next.updatedAt = now();
  return assertGraph(next);
}

export function failTeamNode(
  task: TeamTask,
  role: TeamRole,
  error: string,
  verificationFailure = false,
): TeamTask {
  const next = structuredClone(task);
  const node = next.nodes[ROLE_ORDER.indexOf(role)];
  if (node.status === 'completed') throw new Error(`不能将已完成协作节点标记失败: ${role}`);
  node.status = 'failed';
  node.error = compact(error, 1_000) || '协作节点失败';
  node.completedAt = now();
  next.status = verificationFailure ? 'verification_failed' : 'failed';
  next.updatedAt = now();
  return assertGraph(next);
}

/** Marks an interrupted graph terminal without pretending that a running role completed. */
export function failTeamTask(task: TeamTask): TeamTask {
  if (task.status === 'completed' || task.status === 'verification_failed' || task.status === 'failed') return task;
  return assertGraph({ ...task, status: 'failed', updatedAt: now() });
}

export function pauseTeamTask(task: TeamTask): TeamTask {
  if (task.status === 'completed' || task.status === 'verification_failed' || task.status === 'failed') return task;
  return assertGraph({ ...task, status: 'paused', updatedAt: now() });
}

export function resumeTeamTask(task: TeamTask): TeamTask {
  if (task.status !== 'paused') return task;
  return assertGraph({ ...task, status: 'running', updatedAt: now() });
}

/**
 * Continues from the durable role boundary when the SDK did not expose a
 * resumable RunState. Completed roles remain authoritative; only the role
 * that was interrupted (and its dependants) is made runnable again.
 */
export function continueTeamTask(task: TeamTask | undefined): TeamTask | undefined {
  if (!task) return undefined;
  if (task.status === 'completed') return task;
  const firstIncomplete = task.nodes.findIndex((node) => node.status !== 'completed');
  if (firstIncomplete < 0) return task;
  const timestamp = now();
  return assertGraph({
    ...task,
    status: 'pending',
    nodes: task.nodes.map((node, index) => index < firstIncomplete
      ? node
      : {
        ...node,
        status: 'pending',
        output: undefined,
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
      }),
    updatedAt: timestamp,
  });
}

export function restartTeamTask(task: TeamTask | undefined): TeamTask | undefined {
  if (!task) return undefined;
  const timestamp = now();
  return assertGraph({
    ...task,
    status: 'pending',
    nodes: task.nodes.map((node) => ({
      ...node,
      status: 'pending',
      output: undefined,
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
    })),
    updatedAt: timestamp,
  });
}

export function renderTeamTask(task: TeamTask): string {
  return task.nodes.map((node) => {
    const output = node.output ? `：${node.output.summary}` : '';
    const error = node.error ? `：${node.error}` : '';
    return `${node.role} [${node.status}]${output || error}`;
  }).join(' → ');
}
