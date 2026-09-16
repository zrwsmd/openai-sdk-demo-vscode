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

export const dagNodeEffectSchema = z.enum(['none', 'read', 'write', 'command', 'device', 'unknown']);
export type DagNodeEffect = z.infer<typeof dagNodeEffectSchema>;

export const dagNodeStatusSchema = z.enum([
  'pending',
  'running',
  'awaiting_approval',
  'paused',
  'completed',
  'failed',
  'blocked',
]);
export type DagNodeStatus = z.infer<typeof dagNodeStatusSchema>;

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

/** Model-produced execution DAG. Only read/none nodes may opt into parallelism. */
export const dagNodePlanSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  objective: z.string().min(1).max(1_000),
  dependsOn: z.array(z.string().min(1).max(64)).max(12),
  completionCriteria: z.string().min(1).max(600),
  suggestedTools: z.array(z.string().min(1).max(80)).max(8),
  effect: dagNodeEffectSchema,
  resources: z.array(z.string().min(1).max(300)).max(12),
  parallelSafe: z.boolean(),
  priority: z.number().int().min(0).max(100).default(50),
}).strict();
export type DagNodePlan = z.infer<typeof dagNodePlanSchema>;

export const executionBudgetSchema = z.object({
  maxInputTokens: z.number().int().positive().max(1_000_000).optional(),
  maxOutputTokens: z.number().int().positive().max(250_000).optional(),
  maxRequests: z.number().int().positive().max(100).optional(),
}).strict();
export type ExecutionBudget = z.infer<typeof executionBudgetSchema>;

export const executionUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
}).strict();
export type ExecutionUsage = z.infer<typeof executionUsageSchema>;

export const dagNodeSchema = dagNodePlanSchema.extend({
  status: dagNodeStatusSchema,
  output: teamNodeOutputSchema.optional(),
  state: z.string().optional(),
  approvals: z.array(z.object({
    id: z.string(),
    name: z.string(),
    args: z.string(),
  }).strict()).optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
}).strict();
export type DagNode = z.infer<typeof dagNodeSchema>;

export const executionGraphPlanSchema = z.object({
  maxParallelism: z.number().int().min(1).max(4).optional(),
  budget: executionBudgetSchema.optional(),
  timeoutMs: z.number().int().positive().max(86_400_000).optional(),
  nodeTimeoutMs: z.number().int().positive().max(86_400_000).optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  nodes: z.array(dagNodePlanSchema).min(1).max(12),
}).strict();
export type ExecutionGraphPlan = z.infer<typeof executionGraphPlanSchema>;

export const executionGraphSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(['pending', 'running', 'paused', 'completed', 'failed']),
  maxParallelism: z.number().int().min(1).max(4),
  budget: executionBudgetSchema.default({}),
  usage: executionUsageSchema.default({ inputTokens: 0, outputTokens: 0, requests: 0 }),
  timeoutMs: z.number().int().positive().max(86_400_000).default(15 * 60_000),
  nodeTimeoutMs: z.number().int().positive().max(86_400_000).default(5 * 60_000),
  elapsedMs: z.number().int().nonnegative().default(0),
  revision: z.number().int().nonnegative().default(0),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().min(0).max(5).default(2),
  controlLog: z.array(z.object({
    action: z.enum(['retry', 'revise', 'limit']),
    reason: z.string(),
    at: z.string(),
  }).strict()).max(20).default([]),
  nodes: z.array(dagNodeSchema).min(1).max(12),
  sessionCommitted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();
export type ExecutionGraph = z.infer<typeof executionGraphSchema>;

export const pendingTeamVerificationSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(1_000),
  action: z.enum(['retry', 'revise']),
  retryNodeIds: z.array(z.string().min(1).max(64)).max(12).optional(),
  revisedGraph: executionGraphPlanSchema.optional(),
}).strict();
export type PendingTeamVerification = z.infer<typeof pendingTeamVerificationSchema>;

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
  /** V2 scheduler graph. Omitted only for V1 records; planner application supplies a safe fallback. */
  executionGraph: executionGraphSchema.optional(),
  pendingVerification: pendingTeamVerificationSchema.optional(),
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
  decision: z.enum(['pass', 'retry', 'ask_user', 'revise']).optional(),
  retryNodeIds: z.array(z.string().min(1).max(64)).max(12).optional(),
  revisedGraph: executionGraphPlanSchema.optional(),
  userQuestion: z.string().max(1_000).optional(),
  questionAction: z.enum(['retry', 'revise']).optional(),
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
  executionGraph: executionGraphPlanSchema.optional(),
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
  if (parsed.executionGraph) assertExecutionGraph(parsed.executionGraph);
  return parsed;
}

function isReadOnlyEffect(effect: DagNodeEffect): boolean {
  return effect === 'none' || effect === 'read';
}

function assertExecutionGraph(graph: ExecutionGraph): ExecutionGraph {
  const parsed = executionGraphSchema.parse(graph);
  const ids = new Set<string>();
  for (const node of parsed.nodes) {
    if (ids.has(node.id)) throw new Error('执行图节点重复: ' + node.id);
    ids.add(node.id);
    if (node.dependsOn.includes(node.id)) throw new Error('执行图节点不能依赖自身: ' + node.id);
    if (node.parallelSafe && !isReadOnlyEffect(node.effect)) {
      throw new Error('有副作用节点不能声明并行安全: ' + node.id);
    }
  }
  for (const node of parsed.nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) throw new Error('执行图依赖不存在: ' + node.id + ' -> ' + dependency);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error('执行图存在循环依赖: ' + id);
    visiting.add(id);
    const node = parsed.nodes.find((item) => item.id === id)!;
    node.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  parsed.nodes.forEach((node) => visit(node.id));
  return parsed;
}

function graphNow(graph: ExecutionGraph, nodes: DagNode[]): ExecutionGraph {
  const terminal = nodes.every((node) => node.status === 'completed');
  const failed = nodes.some((node) => node.status === 'failed' || node.status === 'blocked');
  return assertExecutionGraph({
    ...graph,
    nodes,
    status: terminal ? 'completed' : failed && nodes.every((node) => ['completed', 'failed', 'blocked'].includes(node.status))
      ? 'failed'
      : graph.status,
    updatedAt: now(),
  });
}

export function createExecutionGraph(plan: unknown): ExecutionGraph {
  const parsed = executionGraphPlanSchema.parse(plan);
  const timestamp = now();
  return assertExecutionGraph({
    schemaVersion: 1,
    status: 'pending',
    maxParallelism: parsed.maxParallelism ?? 3,
    budget: parsed.budget ?? { maxInputTokens: 120_000, maxOutputTokens: 30_000, maxRequests: 24 },
    usage: { inputTokens: 0, outputTokens: 0, requests: 0 },
    timeoutMs: parsed.timeoutMs ?? 15 * 60_000,
    nodeTimeoutMs: parsed.nodeTimeoutMs ?? 5 * 60_000,
    elapsedMs: 0,
    revision: 0,
    retryCount: 0,
    maxRetries: parsed.maxRetries ?? 2,
    controlLog: [],
    nodes: parsed.nodes.map((node) => ({ ...node, status: 'pending' })),
    sessionCommitted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function getExecutionGraphReadyNodes(graph: ExecutionGraph): DagNode[] {
  const parsed = assertExecutionGraph(graph);
  const byId = new Map(parsed.nodes.map((node) => [node.id, node]));
  const running = parsed.nodes.filter((node) => node.status === 'running');
  const runningResources = new Set(running.flatMap((node) => node.resources));
  const hasRunningExclusive = running.some((node) => !node.parallelSafe || !isReadOnlyEffect(node.effect));
  const ready = parsed.nodes
    .filter((node) =>
      node.status === 'pending' && node.dependsOn.every((dependency) => byId.get(dependency)?.status === 'completed'),
    )
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  if (hasRunningExclusive) return [];
  const highestPriority = ready[0];
  if (highestPriority && (!highestPriority.parallelSafe || !isReadOnlyEffect(highestPriority.effect))) {
    return running.length === 0 ? [highestPriority] : [];
  }
  const selected: DagNode[] = [];
  const selectedResources = new Set(runningResources);
  const slots = Math.max(0, parsed.maxParallelism - running.length);
  for (const node of ready) {
    if (selected.length >= slots) break;
    if (!node.parallelSafe || !isReadOnlyEffect(node.effect)) continue;
    if (node.resources.some((resource) => selectedResources.has(resource))) continue;
    selected.push(node);
    node.resources.forEach((resource) => selectedResources.add(resource));
  }
  return selected;
}

export function startExecutionGraphNode(graph: ExecutionGraph, nodeId: string): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  const node = parsed.nodes.find((item) => item.id === nodeId);
  if (!node || node.status !== 'pending') throw new Error('执行图节点不可启动: ' + nodeId);
  if (!getExecutionGraphReadyNodes(parsed).some((item) => item.id === nodeId)) {
    throw new Error('执行图节点尚未就绪或存在资源冲突: ' + nodeId);
  }
  return graphNow({ ...parsed, status: 'running' }, parsed.nodes.map((item) => item.id !== nodeId ? item : {
    ...item,
    status: 'running',
    startedAt: item.startedAt ?? now(),
    error: undefined,
  }));
}

export function completeExecutionGraphNode(
  graph: ExecutionGraph,
  nodeId: string,
  output: TeamNodeOutput,
): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  const node = parsed.nodes.find((item) => item.id === nodeId);
  if (!node || node.status !== 'running') throw new Error('执行图节点尚未运行: ' + nodeId);
  return graphNow(parsed, parsed.nodes.map((item) => item.id !== nodeId ? item : {
    ...item,
    status: 'completed',
    output: teamNodeOutputSchema.parse({
      summary: compact(output.summary, 1_000),
      evidence: output.evidence.map((entry) => compact(entry, 500)).filter(Boolean).slice(0, 12),
    }),
    completedAt: now(),
    state: undefined,
    approvals: undefined,
    error: undefined,
  }));
}

export function commitExecutionGraphSession(graph: ExecutionGraph): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  return assertExecutionGraph({ ...parsed, sessionCommitted: true, updatedAt: now() });
}

export function updateExecutionGraphControl(
  graph: ExecutionGraph,
  usage: ExecutionUsage,
  elapsedMs: number,
): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  return assertExecutionGraph({
    ...parsed,
    usage: executionUsageSchema.parse(usage),
    elapsedMs: Math.max(parsed.elapsedMs, Math.floor(elapsedMs)),
    updatedAt: now(),
  });
}

export function markExecutionGraphLimit(graph: ExecutionGraph, reason: string): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  return assertExecutionGraph({
    ...parsed,
    status: 'failed',
    revision: parsed.revision + 1,
    controlLog: [...parsed.controlLog, { action: 'limit' as const, reason: compact(reason, 500) || '执行限制已触发', at: now() }].slice(-20),
    updatedAt: now(),
  });
}

function nodePlanFields(node: DagNode): Record<string, unknown> {
  return {
    id: node.id,
    title: node.title,
    objective: node.objective,
    dependsOn: node.dependsOn,
    completionCriteria: node.completionCriteria,
    suggestedTools: node.suggestedTools,
    effect: node.effect,
    resources: node.resources,
    parallelSafe: node.parallelSafe,
    priority: node.priority,
  };
}

export function retryExecutionGraphNodes(
  graph: ExecutionGraph,
  nodeIds: string[] | undefined,
  reason: string,
): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  if (parsed.retryCount >= parsed.maxRetries) {
    throw new Error('执行图重试次数已耗尽');
  }
  const fallbackIds = parsed.nodes.filter((node) => node.status !== 'completed').map((node) => node.id);
  if (!fallbackIds.length && parsed.nodes.length) fallbackIds.push(parsed.nodes[parsed.nodes.length - 1].id);
  const ids = new Set(nodeIds?.length ? nodeIds : fallbackIds);
  for (const id of ids) {
    const node = parsed.nodes.find((item) => item.id === id);
    if (!node) throw new Error(`重试节点不存在: ${id}`);
    if (node.status === 'running' || node.status === 'awaiting_approval') {
      throw new Error(`不能重试正在运行或审批中的节点: ${id}`);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of parsed.nodes) {
      if (node.dependsOn.some((dependency) => ids.has(dependency)) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }
  const nextNodes = parsed.nodes.map((node) => ids.has(node.id)
    ? { ...node, status: 'pending' as const, output: undefined, state: undefined, approvals: undefined, startedAt: undefined, completedAt: undefined, error: undefined }
    : node);
  return graphNow({
    ...parsed,
    status: 'pending',
    retryCount: parsed.retryCount + 1,
    revision: parsed.revision + 1,
    controlLog: [...parsed.controlLog, { action: 'retry' as const, reason: compact(reason, 500) || 'verifier 请求重试', at: now() }].slice(-20),
  }, nextNodes);
}

export function reviseExecutionGraph(
  graph: ExecutionGraph,
  plan: unknown,
  reason: string,
): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  if (parsed.retryCount >= parsed.maxRetries) {
    throw new Error('执行图动态调整次数已耗尽');
  }
  const revised = createExecutionGraph(plan);
  const oldById = new Map(parsed.nodes.map((node) => [node.id, node]));
  const revisedById = new Map(revised.nodes.map((node) => [node.id, node]));
  for (const oldNode of parsed.nodes) {
    if (oldNode.status !== 'completed' && oldNode.status !== 'running') continue;
    const nextNode = revisedById.get(oldNode.id);
    if (!nextNode) throw new Error(`受控改图不能删除已开始节点: ${oldNode.id}`);
    if (JSON.stringify(nodePlanFields(oldNode)) !== JSON.stringify(nodePlanFields(nextNode))) {
      throw new Error(`受控改图不能修改已开始节点: ${oldNode.id}`);
    }
  }
  const nodes = revised.nodes.map((node) => {
    const old = oldById.get(node.id);
    return old?.status === 'completed' || old?.status === 'running' ? old : node;
  });
  if (nodes.every((node) => node.status === 'completed')) {
    throw new Error('受控改图必须增加至少一个未执行节点');
  }
  return graphNow({
    ...parsed,
    // A verifier may reshape unfinished work, but it must not widen the
    // planner-approved resource and retry envelope.
    status: 'pending',
    sessionCommitted: false,
    revision: parsed.revision + 1,
    retryCount: parsed.retryCount + 1,
    controlLog: [...parsed.controlLog, { action: 'revise' as const, reason: compact(reason, 500) || 'verifier 请求调整任务图', at: now() }].slice(-20),
  }, nodes);
}

export function checkpointExecutionGraphNode(
  graph: ExecutionGraph,
  nodeId: string,
  state: string,
  approvals: Array<{ id: string; name: string; args: string }>,
): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  const node = parsed.nodes.find((item) => item.id === nodeId);
  if (!node || node.status !== 'running') throw new Error('执行图节点不能保存审批断点: ' + nodeId);
  return graphNow(parsed, parsed.nodes.map((item) => item.id !== nodeId ? item : {
    ...item,
    status: 'awaiting_approval',
    state,
    approvals,
  }));
}

export function resumeExecutionGraphNode(graph: ExecutionGraph, nodeId: string): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  const node = parsed.nodes.find((item) => item.id === nodeId);
  if (!node || node.status !== 'awaiting_approval') {
    throw new Error('执行图节点没有可恢复的审批断点: ' + nodeId);
  }
  return graphNow({ ...parsed, status: 'running' }, parsed.nodes.map((item) => item.id !== nodeId ? item : {
    ...item,
    status: 'running',
    approvals: undefined,
  }));
}

export function pauseExecutionGraphNode(
  graph: ExecutionGraph,
  nodeId: string,
  state?: string,
): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  const node = parsed.nodes.find((item) => item.id === nodeId);
  if (!node || node.status !== 'running') throw new Error('执行图节点不能暂停: ' + nodeId);
  return graphNow({ ...parsed, status: 'paused' }, parsed.nodes.map((item) => item.id !== nodeId ? item : {
    ...item,
    status: 'paused',
    state,
  }));
}

export function failExecutionGraphNode(graph: ExecutionGraph, nodeId: string, error: string): ExecutionGraph {
  const parsed = assertExecutionGraph(graph);
  const failed = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of parsed.nodes) {
      if (node.dependsOn.some((dependency) => failed.has(dependency)) && !failed.has(node.id)) {
        failed.add(node.id);
        changed = true;
      }
    }
  }
  return graphNow(parsed, parsed.nodes.map((node) => !failed.has(node.id) ? node : node.id === nodeId ? {
    ...node,
    status: 'failed',
    error: compact(error, 1_000) || '执行节点失败',
    completedAt: now(),
    state: undefined,
    approvals: undefined,
  } : {
    ...node,
    status: node.status === 'completed' ? node.status : 'blocked',
    error: node.status === 'completed' ? node.error : '依赖节点 ' + nodeId + ' 未完成',
    state: undefined,
    approvals: undefined,
  }));
}

export function pauseExecutionGraph(graph: ExecutionGraph | undefined): ExecutionGraph | undefined {
  if (!graph || graph.status === 'completed' || graph.status === 'failed') return graph;
  return graphNow({ ...graph, status: 'paused' }, graph.nodes.map((node) =>
    node.status === 'running' ? { ...node, status: 'paused' } : node,
  ));
}

export function continueExecutionGraph(graph: ExecutionGraph | undefined): ExecutionGraph | undefined {
  if (!graph || graph.status === 'completed' || graph.status === 'failed') return graph;
  return graphNow({ ...graph, status: 'running' }, graph.nodes.map((node) =>
    node.status === 'paused' || node.status === 'running'
      ? { ...node, status: 'pending', approvals: undefined }
      : node,
  ));
}

export function restartExecutionGraph(graph: ExecutionGraph | undefined): ExecutionGraph | undefined {
  if (!graph) return undefined;
  return graphNow({
    ...graph,
    status: 'pending',
    sessionCommitted: false,
    usage: { inputTokens: 0, outputTokens: 0, requests: 0 },
    elapsedMs: 0,
    revision: 0,
    retryCount: 0,
    controlLog: [],
  }, graph.nodes.map((node) => ({
    ...node,
    status: 'pending',
    output: undefined,
    state: undefined,
    approvals: undefined,
    startedAt: undefined,
    completedAt: undefined,
    error: undefined,
  })));
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

export function resetTeamVerifier(task: TeamTask): TeamTask {
  if (task.nodes[3].status === 'completed') return task;
  return assertGraph({
    ...task,
    status: 'running',
    pendingVerification: undefined,
    nodes: task.nodes.map((node, index) => index === 3
      ? { ...node, status: 'pending', output: undefined, startedAt: undefined, completedAt: undefined, error: undefined }
      : node),
    updatedAt: now(),
  });
}

export function reopenTeamExecution(task: TeamTask, executionGraph: ExecutionGraph): TeamTask {
  return assertGraph({
    ...task,
    status: 'running',
    executionGraph,
    pendingVerification: undefined,
    nodes: task.nodes.map((node, index) => index < 2
      ? node
      : { ...node, status: 'pending', output: undefined, startedAt: undefined, completedAt: undefined, error: undefined }),
    updatedAt: now(),
  });
}

export function checkpointTeamVerification(
  task: TeamTask,
  pending: PendingTeamVerification,
): TeamTask {
  const parsedPending = pendingTeamVerificationSchema.parse(pending);
  return assertGraph({
    ...task,
    status: 'paused',
    pendingVerification: parsedPending,
    nodes: task.nodes.map((node, index) => index === 3
      ? { ...node, status: 'pending', output: undefined, startedAt: undefined, completedAt: undefined, error: undefined }
      : node),
    updatedAt: now(),
  });
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
  next.executionGraph = parsed.executionGraph
    ? createExecutionGraph(parsed.executionGraph)
    : next.executionGraph
      ? assertExecutionGraph(next.executionGraph)
      : createExecutionGraph({
      nodes: [{
        id: 'execute-task',
        title: '执行已审查任务',
        objective: next.planSummary,
        dependsOn: [],
        completionCriteria: next.verificationCriteria.join('；') || '完成用户请求并提供真实证据',
        suggestedTools: [],
        effect: 'unknown',
        resources: ['workspace:primary'],
        parallelSafe: false,
      }],
    });
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
  return assertGraph({
    ...task,
    status: 'paused',
    executionGraph: pauseExecutionGraph(task.executionGraph),
    updatedAt: now(),
  });
}

export function resumeTeamTask(task: TeamTask): TeamTask {
  if (task.status !== 'paused') return task;
  return assertGraph({
    ...task,
    status: 'running',
    executionGraph: continueExecutionGraph(task.executionGraph),
    updatedAt: now(),
  });
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
    executionGraph: continueExecutionGraph(task.executionGraph),
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
    executionGraph: restartExecutionGraph(task.executionGraph),
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
