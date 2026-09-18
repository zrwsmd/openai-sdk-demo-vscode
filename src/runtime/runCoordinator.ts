import {
  runAgent,
  validateConfig,
  getResumableAgentState,
  isRetryableAgentError,
  planTask,
  classifyDeliveryContract,
  routeTeamTask,
  planTeamTask,
  reviewTeamTask,
  verifyTeamTask,
  MaxTurnsExceededError,
  AgentActionVerificationError,
  MAX_TURNS,
  type AgentRunOptions,
  type AgentRunResult,
  type TurnUsage,
} from './agent';
import type { AgentInputItem, Session } from '@openai/agents';
import { extractChatMessages } from './session';
import type { DurableRunConfig, DurableRunRecord, DurableRunResumeStage, RunStore } from './runStore';
import type { AuditEventType, AuditSink } from '../observability/audit';
import {
  toolOptionsFromSettings,
  type StAnalyzer,
  type StAnalyzerSettings,
} from '../analysis/stAnalyzer';
import { AgentEventFactory, type AgentProtocolEvent } from '../protocol/events';
import { createAgentResult } from '../protocol/results';
import {
  ensureContextCompacted,
  type ContextCompactionResult,
  type ContextManagerOptions,
} from './contextManager';
import {
  failTaskPlan,
  pauseTaskPlan,
  restartTaskPlan,
  updateTaskPlan,
  type TaskPlanProgress,
} from './taskPlan';
import {
  inferDeliveryContractFromUserText,
  isStCodeDeliveryContract,
} from './deliveryContract';
import {
  applyTeamPlannerReport,
  checkpointTeamVerification,
  completeTeamNode,
  continueTeamTask,
  createForcedTeamTask,
  completeExecutionGraphNode,
  commitExecutionGraphSession,
  checkpointExecutionGraphNode,
  failExecutionGraphNode,
  getExecutionGraphReadyNodes,
  markExecutionGraphLimit,
  pauseExecutionGraphNode,
  reopenTeamExecution,
  retryExecutionGraphNodes,
  reviseTeamPlanAfterReview,
  reviseExecutionGraph,
  resumeExecutionGraphNode,
  startExecutionGraphNode,
  updateExecutionGraphControl,
  failTeamNode,
  failTeamTask,
  pauseTeamTask,
  restartTeamTask,
  resumeTeamTask,
  startTeamNode,
  type DagNode,
  type TeamTask,
  type ExecutionGraph,
} from '../orchestration/teamTask';

export type RuntimeEvent =
  | { type: 'agentEvent'; event: AgentProtocolEvent }
  | ({ type: string } & Record<string, unknown>);

const MAX_REPLAYABLE_PROTOCOL_EVENTS = 200;
const MAX_TEAM_REVIEW_REVISIONS = 2;
const REPLAYABLE_PROTOCOL_EVENT_TYPES = new Set<AgentProtocolEvent['type']>([
  'run.started',
  'tool.started',
  'tool.completed',
  'approval.requested',
  'approval.resolved',
  'run.progress',
]);

function isTeamPreparationSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; message?: unknown };
  const name = typeof value.name === 'string' ? value.name : '';
  const message = typeof value.message === 'string' ? value.message : '';
  // Team planner/reviewer calls are read-only preflight. A malformed
  // structured response is recoverable here, while auth/network/tool errors
  // must still surface normally instead of being hidden by a fallback.
  return name === 'ModelBehaviorError' ||
    name === 'AgentOutputValidationError' ||
    /(?:Invalid output type|expected schema|output does not match)/i.test(message);
}

function shouldUseRuntimeManagedStFlow(
  contract: DurableRunRecord['deliveryContract'],
  orchestration: DurableRunConfig['orchestration'],
): boolean {
  return orchestration !== 'team' && isStCodeDeliveryContract(contract);
}

export interface RunCoordinatorDependencies {
  session: RecoverableSession;
  store: RunStore;
  emit: (event: RuntimeEvent) => void;
  log?: (line: string) => void;
  executeAgent?: typeof runAgent;
  /** Optional model planner. Tests and embedders can omit it to retain the single path. */
  planTask?: typeof planTask;
  /** Optional deliverable classifier. Hosts opt in to runtime delivery contracts. */
  classifyDeliveryContract?: typeof classifyDeliveryContract;
  /** ST 校验端口工厂:按 run 的持久化设置产出实例;缺省内核走内置降级。 */
  createStAnalyzer?: (settings?: StAnalyzerSettings) => StAnalyzer;
  /** Optional Team collaborators. Omit all four to retain the pre-V3 runtime path. */
  routeTeamTask?: typeof routeTeamTask;
  planTeamTask?: typeof planTeamTask;
  reviewTeamTask?: typeof reviewTeamTask;
  verifyTeamTask?: typeof verifyTeamTask;
  audit?: AuditSink;
  compactContext?: ContextCompactor;
}

export interface RecoverableSession extends Session {
  getItems(limit?: number): Promise<AgentInputItem[]>;
  clearSession(): Promise<void>;
  truncate(length: number): Promise<void>;
  replaceItems(items: AgentInputItem[]): Promise<void>;
}

export type ContextCompactor = (
  session: RecoverableSession,
  config: DurableRunConfig & { apiKey: string },
  options?: ContextManagerOptions,
) => Promise<ContextCompactionResult>;

/** A node must not append its internal prompt/result to the user session. */
class DagWorkerSession implements Session {
  private static sequence = 0;
  private readonly id = `dag-worker-${++DagWorkerSession.sequence}`;
  private items: AgentInputItem[];

  constructor(items: AgentInputItem[]) {
    this.items = items.map((item) => ({ ...item }));
  }

  async getSessionId(): Promise<string> {
    return this.id;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    return limit === undefined ? [...this.items] : this.items.slice(-limit);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    this.items.push(...items.map((item) => ({ ...item })));
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    return this.items.pop();
  }

  async clearSession(): Promise<void> {
    this.items = [];
  }
}

function replayableHistoryEvents(
  run: DurableRunRecord | undefined,
  messageCount: number,
): AgentProtocolEvent[] {
  if (!run?.events?.length) return [];
  if (messageCount === 0 && run.status !== 'awaiting_approval') return [];
  return run.events
    .filter((event) => REPLAYABLE_PROTOCOL_EVENT_TYPES.has(event.type))
    .sort((a, b) => a.sequence - b.sequence);
}

function mergeReplayableHistoryEvents(
  stored: AgentProtocolEvent[],
  current: AgentProtocolEvent[],
): AgentProtocolEvent[] {
  const byId = new Map<string, AgentProtocolEvent>();
  const merged: AgentProtocolEvent[] = [];
  for (const event of [...stored, ...current]) {
    if (!REPLAYABLE_PROTOCOL_EVENT_TYPES.has(event.type) || byId.has(event.eventId)) continue;
    byId.set(event.eventId, event);
    merged.push(event);
  }
  return merged;
}

/**
 * Application service for a single durable agent lane.
 *
 * It deliberately has no VS Code dependency: UI hosts only translate events
 * and provide secrets. This makes the same lifecycle reusable by a CLI, an
 * edge daemon, or a future industrial control console.
 */
export class RunCoordinator {
  private readonly session: RecoverableSession;
  private readonly store: RunStore;
  private readonly emitEvent: (event: RuntimeEvent) => void;
  private readonly writeLog: (line: string) => void;
  private readonly executeAgent: typeof runAgent;
  private readonly planTask?: typeof planTask;
  private readonly classifyDeliveryContract?: typeof classifyDeliveryContract;
  private readonly routeTeamTask?: typeof routeTeamTask;
  private readonly planTeamTask?: typeof planTeamTask;
  private readonly reviewTeamTask?: typeof reviewTeamTask;
  private readonly verifyTeamTask?: typeof verifyTeamTask;
  private readonly auditSink?: AuditSink;
  private readonly compactContext: ContextCompactor;
  private readonly createStAnalyzer?: (settings?: StAnalyzerSettings) => StAnalyzer;
  private busy = false;
  private transitioning = false;
  private controller?: AbortController;
  private activeDone?: Promise<void>;
  private resolveActiveDone?: () => void;
  private transitionDone?: Promise<void>;
  private resolveTransitionDone?: () => void;
  private liveOutput = '';
  private stopRequested = false;
  private pauseRequested = false;
  private cancelChain: Promise<void> = Promise.resolve();
  private clearing = false;
  private clearGeneration = 0;
  private clearOperation?: Promise<void>;
  private initializeOperation?: Promise<void>;
  private protocolFactory?: AgentEventFactory;
  private protocolRunId?: string;
  private protocolRun?: DurableRunRecord;
  private transitionController?: AbortController;

  constructor(dependencies: RunCoordinatorDependencies) {
    this.session = dependencies.session;
    this.store = dependencies.store;
    this.emitEvent = dependencies.emit;
    this.writeLog = dependencies.log ?? (() => {});
    this.executeAgent = dependencies.executeAgent ?? runAgent;
    this.planTask = dependencies.planTask;
    this.classifyDeliveryContract = dependencies.classifyDeliveryContract;
    this.routeTeamTask = dependencies.routeTeamTask ?? routeTeamTask;
    this.planTeamTask = dependencies.planTeamTask ?? planTeamTask;
    this.reviewTeamTask = dependencies.reviewTeamTask ?? reviewTeamTask;
    this.verifyTeamTask = dependencies.verifyTeamTask ?? verifyTeamTask;
    this.auditSink = dependencies.audit;
    this.compactContext = dependencies.compactContext ?? ensureContextCompacted;
    this.createStAnalyzer = dependencies.createStAnalyzer;
  }

  async initialize(): Promise<void> {
    if (this.initializeOperation) return this.initializeOperation;
    if (this.clearing && this.clearOperation) await this.clearOperation;
    this.initializeOperation = this.initializeInternal().finally(() => {
      this.initializeOperation = undefined;
    });
    return this.initializeOperation;
  }

  async hasActiveWork(): Promise<boolean> {
    return this.busy ||
      this.transitioning ||
      this.clearing ||
      !!this.initializeOperation ||
      !!(await this.store.getActive());
  }

  private async initializeInternal(): Promise<void> {
    const generation = this.clearGeneration;
    const active = await this.store.getActive();
    if (this.isClearing(generation)) return;
    if (active?.status === 'running') {
      if (active.resumeStage) {
        active.status = 'paused';
        active.canContinue = true;
        active.result = createAgentResult({ status: 'cancelled', reason: 'user_paused', usage: active.usage });
        await this.store.update(active);
        this.emit({ type: 'runRecovered', message: '预处理阶段中断，已保存继续断点。', canContinue: true });
        return;
      }
      if (this.busy || this.transitioning) {
        await this.replayHistory(generation);
        if (this.isClearing(generation)) return;
        this.emit({
          type: 'runAttached',
          runId: active.id,
          userText: active.userText,
          partialOutput: this.liveOutput,
        });
        return;
      }
      // A live AbortController cannot survive a host restart. Roll back the
      // incomplete Session turn and expose deterministic retry instead.
      await this.session.truncate(active.sessionItemCountBefore);
      if (this.isClearing(generation)) return;
      active.status = 'failed';
      active.error = '扩展进程在运行期间中断，本轮已回滚，可以安全重试。';
      if (active.plan) active.plan = failTaskPlan(active.plan);
      if (active.teamTask) active.teamTask = failTeamTask(active.teamTask);
      active.result = createAgentResult({
        status: 'failed',
        error: active.error,
        usage: active.usage,
      });
      await this.store.update(active);
      await this.replayHistory(generation);
      if (this.isClearing(generation)) return;
      this.emit({ type: 'runRecovered', message: active.error, canRetry: true });
      return;
    }
    await this.replayHistory(generation);
    if (this.isClearing(generation)) return;
    if (active?.status === 'awaiting_approval') {
      if (active.plan) {
        this.ensureProtocolFactory(active);
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.progress',
          payload: { stage: 'plan.restored', plan: active.plan },
        }));
      }
      if (active.teamTask) this.emitTeamProgress(active, 'team.restored', '已恢复 Team 任务图');
      this.emit({
        type: 'runRestored',
        runId: active.id,
        approvals: active.approvals,
        partialOutput: active.output,
      });
      return;
    }
    const last = await this.store.getLast();
    if (this.isClearing(generation)) return;
    const recoverableFailure = last?.status === 'failed' && isRetryableAgentError(last.error);
    this.emit({
      type: 'retryState',
      canRetry: !!last && last.status !== 'refused',
      canContinue:
        (last?.status === 'paused' && last.canContinue === true) ||
        (last?.status === 'paused' && !!last.resumeStage) ||
        recoverableFailure,
    });
    if (last?.plan) {
      this.ensureProtocolFactory(last);
      this.emitProtocol(this.protocolFactory!.next({
        type: 'run.progress',
        payload: { stage: 'plan.restored', plan: last.plan },
      }));
    }
  }

  async start(userText: string, config: DurableRunConfig, apiKey: string): Promise<void> {
    if (this.busy || this.transitioning || this.clearing) return;
    const generation = this.beginTransition();
    try {
      if (await this.store.getActive()) return;
      const error = validateConfig({ ...config, apiKey });
      if (error) {
        this.emit({ type: 'error', message: error });
        return;
      }
      if (this.isClearing(generation)) return;
      let sessionItems = await this.session.getItems();
      const run = await this.store.begin(
        userText,
        config,
        sessionItems.length,
      );
      if (this.isClearing(generation)) return;
      this.emit({ type: 'user', text: userText, runId: run.id });
      // 这里记录的是诊断原文，不要只保留前 120 个字符，否则多段需求
      // 会看起来像被截断，排查模型是否收到完整输入时会产生误判。
      this.writeLog(
        `[run:${run.id}] 用户(${userText.length}字符): ${userText.replace(/\r?\n/g, '⏎')}`,
      );
      const compactionController = new AbortController();
      this.transitionController = compactionController;
      const compaction = await this.compactContext(
        this.session,
        { ...config, apiKey },
        { signal: compactionController.signal },
      );
      if (this.transitionController === compactionController) this.transitionController = undefined;
      if (this.isClearing(generation)) return;
      if (this.stopRequested || compaction.reason === 'aborted') {
        this.stopRequested = false;
        await this.pausePending(run, false);
        return;
      }
      if (compaction.compacted) {
        this.writeLog(
          `[context] 已压缩历史: items ${compaction.beforeItems}->${compaction.afterItems}, chars ${compaction.beforeCharacters}->${compaction.afterCharacters}`,
        );
        sessionItems = await this.session.getItems();
        run.sessionItemCountBefore = sessionItems.length;
        await this.store.update(run);
      } else if (compaction.error) {
        this.writeLog(`[context] 历史压缩失败，继续使用原始历史: ${compaction.error}`);
      }
      if (this.isClearing(generation)) return;
      if (this.classifyDeliveryContract) {
        run.resumeStage = 'delivery';
        await this.store.update(run);
        const deliveryController = new AbortController();
        this.transitionController = deliveryController;
        try {
          run.deliveryContract = await this.classifyDeliveryContract(
            { ...config, apiKey },
            userText,
            deliveryController.signal,
            sessionItems,
          );
          if (!this.isClearing(generation) && !this.stopRequested) {
            run.resumeStage = undefined;
            await this.store.update(run);
          }
        } catch (error) {
          if (this.isClearing(generation)) return;
          if (this.stopRequested || isRetryableAgentError(error)) {
            await this.pauseBeforeSdkTurn(run, 'delivery', error, generation);
            return;
          }
          const inferred = inferDeliveryContractFromUserText(userText);
          if (inferred) {
            this.writeLog(`[delivery] 交付契约判定失败，已启用运行时 ST 固定交付契约: ${this.formatError(error)}`);
            run.deliveryContract = inferred;
          } else {
            this.writeLog(`[delivery] 交付契约判定失败，继续执行但不启用交付契约: ${this.formatError(error)}`);
            run.deliveryContract = undefined;
          }
          run.resumeStage = undefined;
          await this.store.update(run);
        } finally {
          if (this.transitionController === deliveryController) this.transitionController = undefined;
        }
      }
      if (this.stopRequested) {
        this.stopRequested = false;
        await this.pausePending(run, false);
        return;
      }
      if (this.isClearing(generation)) return;
      await this.audit('run_started', run, { model: config.model });
      if (this.isClearing(generation)) return;
      const runtimeManagedStFlow = shouldUseRuntimeManagedStFlow(run.deliveryContract, config.orchestration);
      if (!runtimeManagedStFlow && (config.orchestration === 'team' || (config.orchestration === 'auto' && this.routeTeamTask))) {
        run.resumeStage = 'routing';
        await this.store.update(run);
        const routeTeam = this.routeTeamTask;
        const routingController = new AbortController();
        this.transitionController = routingController;
        try {
          run.teamTask = config.orchestration === 'team'
            ? createForcedTeamTask(userText)
            : await routeTeam!(
              { ...config, apiKey },
              userText,
              routingController.signal,
              sessionItems,
            );
          if (!this.isClearing(generation) && !this.stopRequested) {
            run.resumeStage = undefined;
            await this.store.update(run);
          }
          if (run.teamTask && !this.isClearing(generation) && !this.stopRequested) {
            await this.audit('team_routed', run, {
              route: 'team',
              reason: run.teamTask.routeReason,
            });
            this.ensureProtocolFactory(run);
            this.emitTeamProgress(run, 'team.routed', '已路由到串行 Team');
          }
        } catch (error) {
          if (this.isClearing(generation)) return;
          if (this.stopRequested || isRetryableAgentError(error) || config.orchestration === 'team') {
            await this.pauseBeforeSdkTurn(run, 'routing', error, generation);
            return;
          }
          this.writeLog(`[team] 路由失败，退回现有 single 路径: ${this.formatError(error)}`);
          run.teamTask = undefined;
          run.resumeStage = undefined;
          await this.store.update(run);
        } finally {
          if (this.transitionController === routingController) this.transitionController = undefined;
        }
      }
      if (!runtimeManagedStFlow && !run.teamTask && this.planTask && config.orchestration !== 'team') {
        run.resumeStage = 'planning';
        this.emit({ type: 'planning' });
        await this.store.update(run);
        const planningController = new AbortController();
        this.transitionController = planningController;
        try {
          run.plan = await this.planTask(
            { ...config, apiKey },
            userText,
            planningController.signal,
            sessionItems,
          );
          if (!this.isClearing(generation) && !this.stopRequested) {
            run.resumeStage = undefined;
            await this.store.update(run);
          }
          if (run.plan && !this.isClearing(generation) && !this.stopRequested) {
            this.ensureProtocolFactory(run);
            this.emitProtocol(this.protocolFactory!.next({
              type: 'run.progress',
              payload: {
                stage: 'plan.created',
                message: `已生成 ${run.plan.steps.length} 步线性计划`,
                plan: run.plan,
              },
            }));
          }
        } catch (error) {
          // Planning is an optimization layer. A provider that cannot return
          // the structured plan must not break the existing single-agent UX.
          if (this.isClearing(generation)) return;
          if (this.stopRequested || isRetryableAgentError(error)) {
            await this.pauseBeforeSdkTurn(run, 'planning', error, generation);
            return;
          }
          this.writeLog(`[plan] 规划失败，退回单任务执行: ${this.formatError(error)}`);
          run.plan = undefined;
          run.resumeStage = undefined;
          await this.store.update(run);
        } finally {
          if (this.transitionController === planningController) this.transitionController = undefined;
        }
      }
      if (this.isClearing(generation)) return;
      if (this.stopRequested) {
        this.stopRequested = false;
        await this.pausePending(run, false);
        return;
      }
      await this.execute(run, apiKey);
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error) });
    } finally {
      this.endTransition();
    }
  }

  async approve(runId: string, approvalId: string, approved: boolean, apiKey: string): Promise<void> {
    if (this.busy || this.transitioning || this.clearing || !runId || !approvalId) return;
    const generation = this.beginTransition();
    try {
      if (this.isClearing(generation)) return;
      const run = await this.store.getActive();
      if (!run || run.id !== runId || run.status !== 'awaiting_approval') return;
      if (!run.approvals.some((approval) => approval.id === approvalId)) return;

      this.writeLog(`[run:${run.id}] 用户${approved ? '允许' : '拒绝'} ${approvalId}`);
      await this.audit('approval_decided', run, { approvalId, approved });
      const pendingVerification = run.teamTask?.pendingVerification;
      if (pendingVerification?.id === approvalId) {
        this.ensureProtocolFactory(run);
        this.emitProtocol(this.protocolFactory!.next({
          type: 'approval.resolved',
          payload: { approvalId, approved, reason: approved ? undefined : 'user_rejected' },
        }));
        if (!approved) {
          const reason = '用户拒绝了 verifier 提出的后续调整。';
          run.status = 'refused';
          run.state = undefined;
          run.approvals = [];
          run.canContinue = false;
          run.error = undefined;
          run.result = createAgentResult({ status: 'refused', reason, usage: run.usage });
          run.teamTask = failTeamTask({ ...run.teamTask!, pendingVerification: undefined });
          await this.store.update(run);
          await this.audit('run_refused', run, { reason, source: 'verifier' });
          this.emit({ type: 'refused', message: reason, canRetry: false });
          this.emitProtocol(this.protocolFactory!.next({ type: 'run.refused', payload: { reason } }));
          return;
        }
        const graph = run.teamTask?.executionGraph;
        if (!graph) throw new Error('Verifier 调整缺少执行图');
        let adjusted: ExecutionGraph;
        try {
          if (pendingVerification.action === 'revise') {
            if (!pendingVerification.revisedGraph) throw new Error('Verifier 未提供动态调整后的执行图');
            adjusted = reviseExecutionGraph(graph, pendingVerification.revisedGraph, pendingVerification.question);
          } else {
            adjusted = retryExecutionGraphNodes(graph, pendingVerification.retryNodeIds, pendingVerification.question);
          }
        } catch (error) {
          const reason = `Verifier 调整被控制策略拒绝：${this.formatError(error)}`;
          run.teamTask = failTeamNode({
            ...run.teamTask!,
            pendingVerification: undefined,
            executionGraph: markExecutionGraphLimit(graph, reason),
          }, 'verifier', reason, true);
          run.status = 'failed';
          run.state = undefined;
          run.approvals = [];
          run.canContinue = false;
          run.error = reason;
          run.result = createAgentResult({ status: 'failed', error: reason, usage: run.usage });
          await this.store.update(run);
          await this.audit('team_verification_failed', run, { reason, source: 'verifier_adjustment' });
          this.emit({ type: 'error', message: reason, canRetry: true });
          this.emitProtocol(this.protocolFactory!.next({ type: 'run.failed', payload: { error: reason } }));
          return;
        }
        run.teamTask = reopenTeamExecution(run.teamTask!, adjusted);
        run.status = 'running';
        run.state = undefined;
        run.approvals = [];
        run.canContinue = false;
        await this.store.update(run);
        this.emit({ type: 'resumeStarted', runId: run.id, approvalId });
        await this.execute(run, apiKey);
        return;
      }
      if (!run.state) return;
      const approvalDecisions = {
        ...(run.approvalDecisions ?? {}),
        [approvalId]: approved,
      };
      this.ensureProtocolFactory(run);
      this.emitProtocol(this.protocolFactory!.next({
        type: 'approval.resolved',
        payload: { approvalId, approved, reason: approved ? undefined : 'user_rejected' },
      }));
      const remainingApprovals = approved
        ? run.approvals.filter((approval) => approval.id !== approvalId)
        : [];
      if (approved && remainingApprovals.length > 0) {
        run.approvals = remainingApprovals;
        run.approvalDecisions = approvalDecisions;
        run.status = 'awaiting_approval';
        run.canContinue = false;
        await this.store.update(run);
        this.writeLog(
          `[run:${run.id}] 已记录审批决定 (${Object.keys(approvalDecisions).length} 项), ` +
            `等待剩余 ${remainingApprovals.length} 项`,
        );
        this.emit({ type: 'awaitingApproval', runId: run.id, approvals: remainingApprovals });
        return;
      }
      run.status = 'running';
      run.approvals = [];
      run.approvalDecisions = undefined;
      await this.store.update(run);
      if (this.isClearing(generation)) return;
      await this.audit('run_resumed', run, { approvalId });
      if (this.isClearing(generation)) return;
      this.emit({ type: 'resumeStarted', runId: run.id, approvalId });
      if (this.stopRequested) {
        this.stopRequested = false;
        await this.pausePending(run, false);
        return;
      }
      await this.execute(run, apiKey, {
        initialState: run.state,
        decisions: approvalDecisions,
      });
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error), canRetry: true });
    } finally {
      this.endTransition();
    }
  }

  async stop(notify = true): Promise<void> {
    if (this.clearing) {
      if (this.clearOperation) await this.clearOperation;
      return;
    }
    if (this.controller) {
      const done = this.activeDone;
      this.pauseRequested = true;
      this.controller.abort();
      if (notify) this.emit({ type: 'stopping' });
      await done;
      return;
    }
    if (this.transitioning) {
      this.stopRequested = true;
      this.transitionController?.abort();
      const pending = await this.store.getActive();
      if (pending) await this.pausePending(pending, notify);
      return;
    }
    const run = await this.store.getActive();
    if (!run) return;
    await this.cancelPending(run, notify);
  }

  async continue(apiKey: string, displayText?: string): Promise<void> {
    if (this.busy || this.transitioning || this.clearing) return;
    const generation = this.beginTransition();
    try {
      if (await this.store.getActive()) return;
      let previous = await this.store.getContinuable();
      if (!previous) {
        const last = await this.store.getLast();
        if (last?.status === 'failed' && isRetryableAgentError(last.error)) previous = last;
      }
      if (!previous) {
        this.emit({ type: 'error', message: '没有可续跑的任务断点，请使用重试重新执行。' });
        return;
      }
      if (validateConfig({ ...previous.config, apiKey })) {
        this.emit({
          type: 'error',
          message: '继续失败：当前没有可用的 API Key。',
          canContinue: true,
        });
        return;
      }
      if (this.isClearing(generation)) return;
      const hasSdkState = typeof previous.state === 'string' && previous.state.length > 0;
      // Only a current paused record is eligible for SDK RunState.resume.
      // Legacy retryable `failed` records may contain a stale serialized
      // state, but their session boundary is the only safe continuation.
      const canResumeSdkState = previous.status === 'paused' && hasSdkState;
      if (!canResumeSdkState) {
        // An immediate stop can happen before the SDK has a serializable
        // RunState. The stopped turn was already rolled back, so claim a new
        // attempt in the same operation lineage; the effect journal prevents
        // completed or uncertain side effects from being duplicated.
        await this.session.truncate(previous.sessionItemCountBefore);
      }
      if (this.isClearing(generation)) return;
      const run = canResumeSdkState
        ? await this.store.resume(previous.id)
        : await this.store.begin(
          previous.userText,
          previous.config,
          previous.sessionItemCountBefore,
          previous.operationId,
          restartTaskPlan(previous.plan),
          continueTeamTask(previous.teamTask),
          previous.deliveryContract,
        );
      run.resumeStage = previous.resumeStage;
      await this.store.update(run);
      if (this.isClearing(generation)) return;
      await this.audit('run_resumed', run, {
        resumedRunId: previous.id,
        strategy: canResumeSdkState ? 'sdk_state' : 'safe_restart',
      });
      if (this.isClearing(generation)) return;
      this.emit({
        type: 'resumeStarted',
        runId: run.id,
        continued: true,
        restartedFromBoundary: !canResumeSdkState,
        userText: run.userText,
        displayText: displayText?.trim() || undefined,
      });
      if (run.plan) {
        this.ensureProtocolFactory(run);
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.progress',
          payload: { stage: 'plan.restored', plan: run.plan },
        }));
      }
      if (run.teamTask) this.emitTeamProgress(run, 'team.restored', '已恢复 Team 任务图');
      if (run.resumeStage) {
        const ready = await this.resumePreflight(run, apiKey, generation);
        if (!ready || this.isClearing(generation)) return;
      }
      if (this.stopRequested) {
        this.stopRequested = false;
        await this.pausePending(run, false);
        return;
      }
      await this.execute(run, apiKey, canResumeSdkState ? { initialState: run.state } : {});
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error), canRetry: true });
    } finally {
      this.endTransition();
    }
  }

  private async pauseBeforeSdkTurn(
    run: DurableRunRecord,
    stage: DurableRunResumeStage,
    error: unknown,
    generation: number,
  ): Promise<void> {
    if (this.isRunInvalidated(generation)) return;
    const active = await this.store.getActive();
    if (!active || active.id !== run.id) {
      if (this.stopRequested) this.stopRequested = false;
      return;
    }
    run.status = 'paused';
    run.canContinue = true;
    run.resumeStage = stage;
    run.state = undefined;
    run.approvals = [];
    run.error = this.formatError(error);
    run.result = createAgentResult({ status: 'cancelled', reason: 'user_paused', usage: run.usage });
    await this.store.update(run);
    if (this.isRunInvalidated(generation)) return;
    await this.audit('run_paused', run, { strategy: 'preflight', stage, error: run.error });
    this.emit({ type: 'paused', canContinue: true, canRetry: true, resumeStrategy: 'safe_restart' });
    this.emit({ type: 'idle' });
    if (this.stopRequested) this.stopRequested = false;
  }

  private async resumePreflight(
    run: DurableRunRecord,
    apiKey: string,
    generation: number,
  ): Promise<boolean> {
    let stage = run.resumeStage;
    if (!stage || this.isRunInvalidated(generation)) return false;
    const sessionItems = await this.session.getItems();
    if (stage === 'delivery' && !this.classifyDeliveryContract) {
      run.deliveryContract = inferDeliveryContractFromUserText(run.userText) ?? run.deliveryContract;
      run.resumeStage = undefined;
      await this.store.update(run);
      stage = shouldUseRuntimeManagedStFlow(run.deliveryContract, run.config.orchestration)
        ? undefined
        : run.config.orchestration === 'team' || this.routeTeamTask ? 'routing' : 'planning';
    }
    if (stage === 'delivery' && this.classifyDeliveryContract) {
      const deliveryController = new AbortController();
      this.transitionController = deliveryController;
      try {
        run.deliveryContract = await this.classifyDeliveryContract(
          { ...run.config, apiKey },
          run.userText,
          deliveryController.signal,
          sessionItems,
        );
      } catch (error) {
        const inferred = inferDeliveryContractFromUserText(run.userText);
        if (!inferred) {
          await this.pauseBeforeSdkTurn(run, 'delivery', error, generation);
          return false;
        }
        this.writeLog(`[delivery] 恢复交付契约判定失败，已启用运行时 ST 固定交付契约: ${this.formatError(error)}`);
        run.deliveryContract = inferred;
      } finally {
        if (this.transitionController === deliveryController) this.transitionController = undefined;
      }
      if (this.stopRequested || this.isRunInvalidated(generation)) return false;
      run.resumeStage = undefined;
      await this.store.update(run);
      stage = shouldUseRuntimeManagedStFlow(run.deliveryContract, run.config.orchestration)
        ? undefined
        : run.config.orchestration === 'team' || this.routeTeamTask ? 'routing' : 'planning';
    }
    const runtimeManagedStFlow = shouldUseRuntimeManagedStFlow(run.deliveryContract, run.config.orchestration);
    if (!runtimeManagedStFlow && stage === 'routing' && (run.config.orchestration === 'team' || this.routeTeamTask)) {
      const routingController = new AbortController();
      this.transitionController = routingController;
      try {
        run.teamTask = run.config.orchestration === 'team'
          ? createForcedTeamTask(run.userText)
          : await this.routeTeamTask!({ ...run.config, apiKey }, run.userText, routingController.signal, sessionItems);
      } catch (error) {
        await this.pauseBeforeSdkTurn(run, 'routing', error, generation);
        return false;
      } finally {
        if (this.transitionController === routingController) this.transitionController = undefined;
      }
      if (this.stopRequested || this.isRunInvalidated(generation)) return false;
      run.resumeStage = undefined;
      await this.store.update(run);
    }
    if (!runtimeManagedStFlow && !run.teamTask && this.planTask && run.config.orchestration !== 'team') {
      run.resumeStage = 'planning';
      await this.store.update(run);
      const planningController = new AbortController();
      this.transitionController = planningController;
      try {
        run.plan = await this.planTask({ ...run.config, apiKey }, run.userText, planningController.signal, sessionItems);
      } catch (error) {
        await this.pauseBeforeSdkTurn(run, 'planning', error, generation);
        return false;
      } finally {
        if (this.transitionController === planningController) this.transitionController = undefined;
      }
      if (this.stopRequested || this.isRunInvalidated(generation)) return false;
      run.resumeStage = undefined;
      await this.store.update(run);
    }
    return !this.stopRequested && !this.isRunInvalidated(generation);
  }

  private cancelPending(run: DurableRunRecord, notify: boolean): Promise<void> {
    // A stop call may have passed its initial clearing check and only reach
    // this point after clear() started. Let clear own the final rollback.
    if (this.clearing) return Promise.resolve();
    const operation = this.cancelChain.then(() => this.cancelPendingInternal(run, notify));
    this.cancelChain = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async cancelPendingInternal(run: DurableRunRecord, notify: boolean): Promise<void> {
    // Rollback first: an intervening crash leaves the record active and startup
    // safely repeats this idempotent truncation.
    await this.session.truncate(run.sessionItemCountBefore);
    run.status = 'cancelled';
    run.result = createAgentResult({
      status: 'cancelled',
      reason: 'user_cancelled',
      usage: run.usage,
    });
    run.state = undefined;
    run.canContinue = false;
    run.approvals = [];
    if (run.plan) run.plan = failTaskPlan(run.plan);
    if (run.teamTask) run.teamTask = failTeamTask(run.teamTask);
    await this.store.update(run);
    await this.audit('run_cancelled', run);
    if (notify) {
      this.emit({ type: 'cancelled', canRetry: true });
      this.emit({ type: 'idle' });
    }
  }

  private pausePending(run: DurableRunRecord, notify: boolean): Promise<void> {
    if (this.clearing) return Promise.resolve();
    const operation = this.cancelChain.then(() => this.pausePendingInternal(run, notify));
    this.cancelChain = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async pausePendingInternal(run: DurableRunRecord, notify: boolean): Promise<void> {
    const active = await this.store.getActive();
    if (!active || active.id !== run.id) {
      const last = await this.store.getLast();
      if (notify && last?.id === run.id && last.status === 'paused') {
        const hasSdkState = typeof last.state === 'string' && last.state.length > 0;
        this.emit({
          type: 'paused',
          canContinue: true,
          canRetry: true,
          resumeStrategy: hasSdkState ? 'sdk_state' : 'safe_restart',
        });
        this.emit({ type: 'idle' });
      }
      return;
    }
    const hasSdkState = typeof active.state === 'string' && active.state.length > 0;
    if (!hasSdkState) await this.session.truncate(active.sessionItemCountBefore);
    active.status = 'paused';
    active.canContinue = true;
    active.result = createAgentResult({
      status: 'cancelled',
      reason: 'user_paused',
      usage: active.usage,
    });
    if (!hasSdkState) active.approvals = [];
    if (active.plan) active.plan = pauseTaskPlan(active.plan);
    if (active.teamTask) active.teamTask = pauseTeamTask(active.teamTask);
    await this.store.update(active);
    await this.audit('run_paused', active, {
      strategy: hasSdkState ? 'sdk_state' : 'safe_restart',
    });
    if (notify) {
      this.emit({
        type: 'paused',
        canContinue: true,
        canRetry: true,
        resumeStrategy: hasSdkState ? 'sdk_state' : 'safe_restart',
      });
      this.emit({ type: 'idle' });
    }
  }

  async retry(apiKey: string): Promise<void> {
    if (this.busy || this.transitioning || this.clearing) return;
    const generation = this.beginTransition();
    try {
      if (await this.store.getActive()) return;
      const previous = await this.store.getLast();
      if (!previous) return;
      if (this.isClearing(generation)) return;
      if (previous.status === 'refused') {
        this.emit({ type: 'error', message: '本轮审批已拒绝，请重新提交需求。' });
        return;
      }
      if (validateConfig({ ...previous.config, apiKey })) {
        this.emit({ type: 'error', message: '重试失败：当前没有可用的 API Key。' });
        return;
      }
      await this.session.truncate(previous.sessionItemCountBefore);
      await this.replayHistory(generation);
      const run = await this.store.begin(
        previous.userText,
        previous.config,
        previous.sessionItemCountBefore,
        previous.operationId,
        restartTaskPlan(previous.plan),
        restartTeamTask(previous.teamTask),
        previous.deliveryContract,
      );
      if (this.isClearing(generation)) return;
      await this.audit('retry_started', run, { previousRunId: previous.id });
      if (this.isClearing(generation)) return;
      this.emit({ type: 'user', text: run.userText, runId: run.id, retry: true });
      if (run.plan) {
        this.ensureProtocolFactory(run);
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.progress',
          payload: {
            stage: 'plan.created',
            message: `已重新生成 ${run.plan.steps.length} 步线性计划`,
            plan: run.plan,
          },
        }));
      }
      this.writeLog(`[run:${run.id}] 重试 operation=${run.operationId}`);
      await this.execute(run, apiKey);
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error) });
    } finally {
      this.endTransition();
    }
  }

  async clear(): Promise<void> {
    if (this.clearOperation) return this.clearOperation;
    this.clearing = true;
    this.clearGeneration += 1;
    this.stopRequested = true;
    this.pauseRequested = false;
    const operation = (async () => {
      // Abort the current model/tool stream, then wait for the complete
      // transition. The transition owns all late Session writes and must
      // finish before the new session is persisted.
      this.controller?.abort();
      this.transitionController?.abort();
      if (this.activeDone) await this.activeDone;
      if (this.transitionDone) await this.transitionDone;
      if (this.initializeOperation) {
        try {
          await this.initializeOperation;
        } catch (error) {
          this.writeLog(`[clear] 初始化收尾失败，继续清理: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      await this.cancelChain;

      // An approval checkpoint has no controller, but is still an active run.
      // Roll it back before clearing the session so its terminal update cannot
      // race the clear operation.
      const active = await this.store.getActive();
      if (active) await this.cancelPendingInternal(active, false);
      await this.session.clearSession();
      await this.store.clearRuns();
      this.emit({ type: 'cleared' });
    })();
    this.clearOperation = operation.finally(() => {
      this.stopRequested = false;
      this.clearing = false;
      this.clearOperation = undefined;
    });
    return this.clearOperation;
  }

  private async execute(
    run: DurableRunRecord,
    apiKey: string,
    options: Pick<AgentRunOptions, 'initialState' | 'decisions'> = {},
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.pauseRequested = false;
    const runGeneration = this.clearGeneration;
    const controller = new AbortController();
    this.controller = controller;
    this.activeDone = new Promise<void>((resolve) => {
      this.resolveActiveDone = resolve;
    });
    this.liveOutput = '';
    if (this.stopRequested) {
      this.stopRequested = false;
      await this.pausePending(run, false);
      this.controller = undefined;
      this.busy = false;
      this.resolveActiveDone?.();
      this.resolveActiveDone = undefined;
      this.activeDone = undefined;
      if (!this.isRunInvalidated(runGeneration)) this.emit({ type: 'idle' });
      return;
    }
    this.emit({ type: 'busy', runId: run.id });

    // Keep the same envelope sequence across an approval resume, while a
    // retry/new run receives a fresh factory bound to its new run id.
    this.ensureProtocolFactory(run);

    const baseOutput = run.output;
    try {
      try {
        await this.prepareTeam(run, apiKey, controller.signal, runGeneration);
      } catch (error) {
        const executor = run.teamTask?.nodes.find((node) => node.id === 'executor');
        const canFallbackToSingle =
          run.config.orchestration !== 'team' &&
          executor?.status === 'pending' &&
          isTeamPreparationSchemaError(error) &&
          !controller.signal.aborted &&
          !this.isRunInvalidated(runGeneration);
        if (!canFallbackToSingle) throw error;

        const failedTeamId = run.teamTask?.id;
        run.teamTask = undefined;
        run.resumeStage = undefined;
        run.state = undefined;
        run.approvals = [];
        run.error = undefined;
        run.status = 'running';
        run.canContinue = false;
        await this.store.update(run);
        this.writeLog(
          `[team] 规划/审查结构化输出不符合 schema${failedTeamId ? ` (${failedTeamId})` : ''}，` +
            `尚未执行副作用，退回 single 路径: ${this.formatError(error)}`,
        );
        this.ensureProtocolFactory(run);
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.progress',
          payload: {
            stage: 'team.fallback',
            message: 'Team 规划结果不符合结构化协议，已安全退回单 Agent 执行',
            reason: this.formatError(error),
          },
        }));
      }
      if (this.isRunInvalidated(runGeneration)) return;
      // The executor may have completed before a transient verifier failure.
      // In that case its durable output is authoritative: resume verification
      // only, never replay a potentially side-effecting executor turn.
      const completedExecutor = run.teamTask?.nodes.find((node) => node.id === 'executor');
      if (completedExecutor?.status === 'completed' && completedExecutor.output) {
        const verification = await this.completeAndVerifyTeam(
          run,
          apiKey,
          completedExecutor.output.summary,
          completedExecutor.output.evidence,
          controller.signal,
          runGeneration,
        );
        if (!verification || this.isRunInvalidated(runGeneration)) return;
        if (!await this.commitTeamGraphSession(run, runGeneration)) return;
        run.status = 'completed';
        run.state = undefined;
        run.canContinue = false;
        await this.store.update(run);
        if (this.isRunInvalidated(runGeneration)) return;
        await this.audit('run_completed', run, { usage: run.usage, orchestration: 'team', resumedVerifier: true });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.completed',
          payload: { result: run.result },
        }));
        this.emit({ type: 'done', usage: run.usage, canRetry: true });
        return;
      }
      const executeSingleAgent = (
        agentOptions: Pick<AgentRunOptions, 'initialState' | 'decisions'>,
      ): Promise<AgentRunResult> =>
        this.executeAgent(
          {
            ...run.config,
            apiKey,
            stAnalyzer: this.createStAnalyzer?.(run.config.stAnalyzerSettings),
            stAnalyzerOptions: toolOptionsFromSettings(run.config.stAnalyzerSettings),
            executeEffect: (toolName, input, invoke) =>
              this.store.executeEffect(run.id, run.operationId, toolName, input, invoke),
            audit: async (event) => {
              if (!this.auditSink) return;
              await this.auditSink.append({
                ...event,
                runId: run.id,
                operationId: run.operationId,
                traceId: run.id,
              });
            },
          },
          this.session,
          run.userText,
          {
            ...agentOptions,
            taskPlan: run.plan,
            teamTask: run.teamTask,
            deliveryContract: run.deliveryContract,
            signal: controller.signal,
            protocol: {
              runId: run.id,
              operationId: run.operationId,
              eventFactory: this.protocolFactory,
              onEvent: (event: AgentProtocolEvent) => {
                if (!this.isRunInvalidated(runGeneration)) this.emitProtocol(event);
              },
            },
            onCheckpoint: async (checkpoint) => {
              if (this.isRunInvalidated(runGeneration)) {
                controller.abort();
                return;
              }
              run.status = 'awaiting_approval';
              run.canContinue = false;
              run.state = checkpoint.state;
              run.approvals = checkpoint.approvals;
              run.approvalDecisions = undefined;
              run.output = baseOutput + checkpoint.output;
              run.usage = checkpoint.usage;
              await this.store.update(run);
              await this.audit('checkpoint_saved', run, { approvalCount: checkpoint.approvals.length });
            },
            onPlanProgress: async (progress: TaskPlanProgress) => {
              if (!run.plan || this.isRunInvalidated(runGeneration)) return;
              run.plan = updateTaskPlan(run.plan, progress);
              await this.store.update(run);
              if (!this.isRunInvalidated(runGeneration)) {
                const verification = progress.verification;
                const stage = progress.phase === 'completed' && verification && verification.verdict !== 'passed'
                  ? 'plan.step.verification_failed'
                  : `plan.step.${progress.phase}`;
                this.emitProtocol(this.protocolFactory!.next({
                  type: 'run.progress',
                  payload: {
                    stage,
                    message: progress.note,
                    planId: run.plan.id,
                    stepId: progress.stepId,
                    planStatus: run.plan.status,
                    verification: run.plan.steps.find((step) => step.id === progress.stepId)?.verification,
                  },
                }));
              }
            },
          },
        );

      let result: AgentRunResult;
      if (run.teamTask?.executionGraph) {
        result = await this.executeTeamGraph(run, apiKey, controller.signal, runGeneration, options);
      } else {
        try {
          result = await executeSingleAgent(options);
        } catch (error) {
          if (!run.plan || run.teamTask || !this.isLinearPlanIncompleteError(error)) throw error;
          const failedPlanId = run.plan.id;
          const message = '线性计划未推进，已退回单任务执行';
          await this.session.truncate(run.sessionItemCountBefore);
          if (this.isRunInvalidated(runGeneration)) return;
          run.plan = undefined;
          run.resumeStage = undefined;
          run.state = undefined;
          run.approvals = [];
          run.error = undefined;
          run.status = 'running';
          run.canContinue = false;
          await this.store.update(run);
          if (this.isRunInvalidated(runGeneration)) return;
          this.writeLog(`[plan] ${message}: ${this.formatError(error)}`);
          this.emitProtocol(this.protocolFactory!.next({
            type: 'run.progress',
            payload: { stage: 'plan.fallback', message, planId: failedPlanId },
          }));
          result = await executeSingleAgent({});
        }
      }

      // clear() may have invalidated this run while the SDK was settling its
      // final promise. Its cleanup owns the final Session/RunStore state.
      if (this.isRunInvalidated(runGeneration)) return;
      run.output = result.output;
      run.result = result.result;
      run.usage = result.usage;
      run.approvals = result.approvals ?? [];
      run.approvalDecisions = result.status === 'awaiting_approval'
        ? run.approvalDecisions
        : undefined;
      const manuallyPaused = this.pauseRequested && result.status === 'cancelled';
      const resumable = manuallyPaused
        && typeof result.state === 'string'
        && result.state.length > 0;
      run.state = result.status === 'awaiting_approval' || resumable ? result.state : undefined;
      // Keep the run active while the separate verifier is evaluating the
      // executor's completed result. This prevents a crash in that narrow
      // window from exposing an unverified completion as final.
      const verifyingTeam = !!run.teamTask && result.status === 'completed';
      run.status = manuallyPaused ? 'paused' : verifyingTeam ? 'running' : result.status;
      run.canContinue = manuallyPaused;
      if (run.teamTask && manuallyPaused) run.teamTask = pauseTeamTask(run.teamTask);
      if (run.teamTask && (result.status === 'refused' || result.status === 'cancelled') && !manuallyPaused) {
        run.teamTask = failTeamTask(run.teamTask);
      }
      if (run.plan) {
        if (manuallyPaused) run.plan = pauseTaskPlan(run.plan);
        else if (result.status === 'refused' || result.status === 'cancelled') run.plan = failTaskPlan(run.plan);
      }

      // Session rollback must happen before the run becomes terminal. If the
      // host crashes between these writes, startup still sees an active run.
      if ((result.status === 'cancelled' && !resumable) || result.status === 'refused') {
        await this.session.truncate(run.sessionItemCountBefore);
        if (this.isRunInvalidated(runGeneration)) return;
      }
      await this.store.update(run);
      if (this.isRunInvalidated(runGeneration)) return;

      if (result.status === 'awaiting_approval') {
        await this.audit('approval_requested', run, { approvals: run.approvals });
        if (this.isRunInvalidated(runGeneration)) return;
        this.writeLog(`[run:${run.id}] 已持久化审批断点 (${run.approvals.length} 项)`);
        this.emit({ type: 'awaitingApproval', runId: run.id, approvals: run.approvals });
        for (const approval of run.approvals) {
          this.emitProtocol(this.protocolFactory!.next({
            type: 'approval.requested',
            payload: {
              approvalId: approval.id,
              toolName: approval.name,
              args: approval.args,
            },
          }));
        }
        await this.store.update(run);
      } else if (result.status === 'cancelled' && manuallyPaused) {
        await this.audit('run_paused', run, {
          strategy: resumable ? 'sdk_state' : 'safe_restart',
        });
        if (this.isRunInvalidated(runGeneration)) return;
        this.writeLog(
          `[run:${run.id}] 已暂停，恢复策略=${resumable ? 'sdk_state' : 'safe_restart'}`,
        );
        this.emit({
          type: 'paused',
          canContinue: true,
          canRetry: true,
          resumeStrategy: resumable ? 'sdk_state' : 'safe_restart',
          usage: result.usage,
        });
      } else if (result.status === 'cancelled') {
        await this.audit('run_cancelled', run);
        if (this.isRunInvalidated(runGeneration)) return;
        this.writeLog(`[run:${run.id}] 已取消并回滚会话`);
        this.emit({ type: 'cancelled', canRetry: true });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.cancelled',
          payload: { reason: 'user_cancelled' },
        }));
      } else if (result.status === 'refused') {
        const reason =
          result.result.status === 'refused'
            ? result.result.reason
            : '用户拒绝了工具调用。';
        await this.audit('run_refused', run, { reason });
        if (this.isRunInvalidated(runGeneration)) return;
        this.writeLog(`[run:${run.id}] 用户拒绝审批，本轮已终止并回滚会话`);
        this.emit({
          type: 'refused',
          message: reason,
          canRetry: false,
        });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.refused',
          payload: { reason },
        }));
      } else if (run.teamTask && result.status === 'completed') {
        const verification = await this.completeAndVerifyTeam(
          run,
          apiKey,
          result.output,
          [
            result.output,
            result.result ? JSON.stringify(result.result) : '执行器未提供额外结构化结果',
          ],
          controller.signal,
          runGeneration,
        );
        if (!verification) return;
        if (!await this.commitTeamGraphSession(run, runGeneration)) return;
        run.status = 'completed';
        await this.store.update(run);
        if (this.isRunInvalidated(runGeneration)) return;
        await this.audit('run_completed', run, { usage: result.usage, orchestration: 'team' });
        if (this.isRunInvalidated(runGeneration)) return;
        this.writeLog(
          `[run:${run.id}] Team 完成: 文本 ${run.output.length} 字符 | tokens ${result.usage.inputTokens}/${result.usage.outputTokens}`,
        );
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.completed',
          payload: { result: result.result },
        }));
        this.emit({ type: 'done', usage: result.usage, canRetry: true });
      } else {
        await this.audit('run_completed', run, { usage: result.usage });
        if (this.isRunInvalidated(runGeneration)) return;
        this.writeLog(
          `[run:${run.id}] 完成: 文本 ${run.output.length} 字符 | tokens ${result.usage.inputTokens}/${result.usage.outputTokens} | 模型调用 ${result.usage.requests} 次`,
        );
        const agentResult = result.result;
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.completed',
          payload: { result: agentResult },
        }));
        this.emit({ type: 'done', usage: result.usage, canRetry: true });
      }
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      const manuallyPaused = cancelled && this.pauseRequested;
      const retryableFailure = !cancelled && isRetryableAgentError(error);
      const errorState = manuallyPaused || retryableFailure
        ? getResumableAgentState(error)
        : undefined;
      const hasSdkState = typeof errorState === 'string' && errorState.length > 0;
      if (this.isRunInvalidated(runGeneration)) return;
      const executorAlreadyCompleted = run.teamTask?.nodes.find((node) => node.id === 'executor')?.status === 'completed';
      if (!hasSdkState && !executorAlreadyCompleted) {
        await this.session.truncate(run.sessionItemCountBefore);
        if (this.isRunInvalidated(runGeneration)) return;
      }
      const continuable = manuallyPaused || retryableFailure;
      run.status = continuable ? 'paused' : cancelled ? 'cancelled' : 'failed';
      run.state = hasSdkState ? errorState : undefined;
      run.approvals = [];
      run.error = cancelled ? undefined : this.formatError(error);
      run.result = cancelled
        ? createAgentResult({ status: 'cancelled', reason: 'aborted', usage: run.usage })
        : createAgentResult({
          status: 'failed',
          error: run.error ?? 'unknown_error',
          usage: run.usage,
        });
      run.canContinue = continuable;
      if (run.plan) {
        run.plan = continuable ? pauseTaskPlan(run.plan) : failTaskPlan(run.plan);
      }
      if (run.teamTask) {
        run.teamTask = continuable ? pauseTeamTask(run.teamTask) : failTeamTask(run.teamTask);
      }
      await this.store.update(run);
      if (this.isRunInvalidated(runGeneration)) return;
      if (manuallyPaused) {
        const strategy = hasSdkState ? 'sdk_state' : 'safe_restart';
        await this.audit('run_paused', run, { strategy });
        this.writeLog(`[run:${run.id}] 已暂停，恢复策略=${strategy}`);
        this.emit({
          type: 'paused',
          canContinue: true,
          canRetry: true,
          resumeStrategy: strategy,
        });
      } else if (cancelled) {
        await this.audit('run_cancelled', run);
        this.writeLog(`[run:${run.id}] 已取消并回滚会话`);
        this.emit({ type: 'cancelled', canRetry: true });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.cancelled',
          payload: { reason: 'aborted' },
        }));
      } else if (retryableFailure) {
        const strategy = hasSdkState ? 'sdk_state' : 'safe_restart';
        await this.audit('run_failed', run, {
          error: run.error,
          recoverable: true,
          strategy,
        });
        this.writeLog(`[run:${run.id}] 可恢复错误: ${run.error} | 恢复策略=${strategy}`);
        this.emit({
          type: 'error',
          message: run.error,
          canRetry: true,
          canContinue: true,
          resumeStrategy: strategy,
        });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.failed',
          payload: { error: run.error ?? 'unknown_error', recoverable: true },
        }));
      } else {
        await this.audit('run_failed', run, { error: run.error });
        this.writeLog(`[run:${run.id}] 出错: ${run.error}`);
        this.emit({ type: 'error', message: run.error, canRetry: true });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.failed',
          payload: { error: run.error ?? 'unknown_error' },
        }));
      }
    } finally {
      if (this.controller === controller) this.controller = undefined;
      this.busy = false;
      this.resolveActiveDone?.();
      this.resolveActiveDone = undefined;
      this.activeDone = undefined;
      this.liveOutput = '';
      this.pauseRequested = false;
      if (!this.isRunInvalidated(runGeneration)) this.emit({ type: 'idle' });
    }
  }

  /** Execute a planner-produced DAG using isolated node sessions. */
  private async executeTeamGraph(
    run: DurableRunRecord,
    apiKey: string,
    signal: AbortSignal,
    generation: number,
    options: Pick<AgentRunOptions, 'initialState' | 'decisions'>,
  ): Promise<AgentRunResult> {
    if (!run.teamTask?.executionGraph) throw new Error('Team 执行图不存在');
    let graph = run.teamTask.executionGraph;
    let usage: TurnUsage = { ...run.usage };
    let decisions = options.decisions;
    const history = await this.session.getItems();
    const executionStartedAt = Date.now();
    const elapsedBeforeRun = graph.elapsedMs;
    const persistGraph = async (): Promise<void> => {
      run.teamTask = { ...run.teamTask!, executionGraph: graph };
      run.usage = usage;
      await this.store.update(run);
    };
    const timeoutError = (message: string): Error => Object.assign(new Error(message), {
      name: 'ExecutionTimeoutError',
      status: 408,
    });
    const globalTimeoutError = (message: string): Error => Object.assign(new Error(message), {
      name: 'ExecutionGlobalTimeoutError',
      executionTimeoutScope: 'global',
    });
    const isGlobalTimeoutError = (error: unknown): boolean =>
      typeof error === 'object' && error !== null &&
      (error as { executionTimeoutScope?: unknown }).executionTimeoutScope === 'global';
    const budgetExceeded = (): string | undefined => {
      const budget = graph.budget;
      if (budget.maxInputTokens !== undefined && usage.inputTokens >= budget.maxInputTokens) return `输入 token 预算已耗尽（${usage.inputTokens}/${budget.maxInputTokens}）`;
      if (budget.maxOutputTokens !== undefined && usage.outputTokens >= budget.maxOutputTokens) return `输出 token 预算已耗尽（${usage.outputTokens}/${budget.maxOutputTokens}）`;
      if (budget.maxRequests !== undefined && usage.requests >= budget.maxRequests) return `模型请求预算已耗尽（${usage.requests}/${budget.maxRequests}）`;
      return undefined;
    };
    const addUsage = (next: TurnUsage): void => {
      usage = {
        inputTokens: usage.inputTokens + next.inputTokens,
        outputTokens: usage.outputTokens + next.outputTokens,
        requests: usage.requests + next.requests,
      };
    };
    const completedResult = async (): Promise<AgentRunResult> => {
      const summary = graph.nodes
        .filter((node) => node.status === 'completed' && node.output)
        .map((node) => `${node.title}: ${node.output?.summary ?? ''}`.trim())
        .join('\n');
      const output = {
        message: summary || '执行图完成',
        diagnostics: [],
        artifacts: [],
        data: null,
      };
      return { result: createAgentResult({ status: 'completed', output, usage }), output: output.message, usage, status: 'completed' };
    };
    while (true) {
      if (this.isRunInvalidated(generation)) {
        return { result: createAgentResult({ status: 'cancelled', reason: 'aborted', usage }), output: '', usage, status: 'cancelled' };
      }
      graph = updateExecutionGraphControl(
        graph,
        usage,
        elapsedBeforeRun + (Date.now() - executionStartedAt),
      );
      const elapsed = graph.elapsedMs;
      if (graph.status === 'completed') return completedResult();
      if (elapsed >= graph.timeoutMs) {
        graph = markExecutionGraphLimit(graph, `任务级超时（${graph.timeoutMs}ms）`);
        await persistGraph();
        throw new Error(`Team 任务超过全局超时 ${graph.timeoutMs}ms`);
      }
      const limit = budgetExceeded();
      if (limit) {
        graph = markExecutionGraphLimit(graph, limit);
        await persistGraph();
        throw new Error(limit);
      }
      const waiting = graph.nodes.find((node) => node.status === 'awaiting_approval');
      let resumedNodeId: string | undefined;
      let resumedDecisions: Record<string, boolean> | undefined;
      if (waiting) {
        const hasDecision = !!decisions && waiting.approvals?.some((approval) => Object.prototype.hasOwnProperty.call(decisions, approval.id));
        if (!hasDecision) {
          const approvals = waiting.approvals ?? [];
          return {
            result: createAgentResult({ status: 'awaiting_approval', state: waiting.state ?? '', approvals, usage }),
            output: waiting.output?.summary ?? '', usage, status: 'awaiting_approval', state: waiting.state, approvals,
          };
        }
        graph = resumeExecutionGraphNode(graph, waiting.id);
        run.teamTask = { ...run.teamTask, executionGraph: graph };
        await this.store.update(run);
        resumedNodeId = waiting.id;
        resumedDecisions = decisions;
        decisions = undefined;
      }
      let ready: DagNode[];
      if (resumedNodeId) {
        const resumed = graph.nodes.find((node) => node.id === resumedNodeId);
        if (!resumed || resumed.status !== 'running') {
          throw new Error('执行图审批节点恢复失败: ' + resumedNodeId);
        }
        ready = [resumed];
      } else {
        ready = getExecutionGraphReadyNodes(graph);
        if (graph.budget.maxRequests !== undefined) {
          ready = ready.slice(0, Math.max(0, graph.budget.maxRequests - usage.requests));
        }
        if (!ready.length) {
          if (graph.nodes.some((node) => node.status === 'failed' || node.status === 'blocked')) throw new Error('执行图存在失败节点，无法继续完成依赖节点');
          if (signal.aborted) return { result: createAgentResult({ status: 'cancelled', reason: 'aborted', usage }), output: '', usage, status: 'cancelled' };
          throw new Error('执行图没有可运行节点，可能存在未满足的依赖');
        }
        for (const node of ready) graph = startExecutionGraphNode(graph, node.id);
      }
      run.teamTask = { ...run.teamTask, executionGraph: graph };
      run.status = 'running';
      await this.store.update(run);
      this.emitTeamProgress(run, 'team.graph.nodes_started', ready.map((node) => node.id).join(', '));
      const results = await Promise.all(ready.map(async (node) => {
        const nodePrompt = [
          `执行 Team 执行图节点：${node.title}`,
          `节点目标：${node.objective}`,
          `完成标准：${node.completionCriteria}`,
          `建议工具：${node.suggestedTools.join(', ') || '由你判断'}`,
          `副作用等级：${node.effect}；资源：${node.resources.join(', ') || '无'}`,
          '只完成本节点，不要代替其他节点，也不要在未获得审批时执行副作用操作。',
        ].join('\n');
        const safeNode = node.effect === 'none' || node.effect === 'read';
        const nodeController = new AbortController();
        const abort = () => nodeController.abort();
        signal.addEventListener('abort', abort, { once: true });
        const remainingTaskMs = Math.max(1, graph.timeoutMs - (elapsedBeforeRun + (Date.now() - executionStartedAt)));
        const globalDeadlineWins = remainingTaskMs <= graph.nodeTimeoutMs;
        const effectiveTimeoutMs = Math.min(graph.nodeTimeoutMs, remainingTaskMs);
        const timeoutHandle = setTimeout(() => nodeController.abort(), effectiveTimeoutMs);
        let timedOut = false;
        const workerTimeoutError = (): Error => globalDeadlineWins
          ? globalTimeoutError(`Team 任务超过全局超时 ${graph.timeoutMs}ms`)
          : timeoutError(`节点 ${node.id} 超过 ${effectiveTimeoutMs}ms`);
        try {
          const result = await this.executeAgent(
            {
              ...run.config,
              apiKey,
              stAnalyzer: this.createStAnalyzer?.(run.config.stAnalyzerSettings),
              stAnalyzerOptions: toolOptionsFromSettings(run.config.stAnalyzerSettings),
              policyContext: safeNode ? { ...run.config.policyContext, dryRun: true } : run.config.policyContext,
              executeEffect: (toolName, input, invoke) => this.store.executeEffect(run.id, run.operationId, toolName, input, invoke),
              audit: async (event) => {
                if (!this.auditSink) return;
                await this.auditSink.append({ ...event, runId: run.id, operationId: run.operationId, traceId: run.id, metadata: { ...(event.metadata ?? {}), dagNodeId: node.id } });
              },
            },
            new DagWorkerSession(history),
            nodePrompt,
            {
              initialState: node.state,
              decisions: node.id === resumedNodeId ? resumedDecisions : undefined,
              teamTask: run.teamTask,
              signal: nodeController.signal,
              protocol: {
                runId: run.id,
                operationId: run.operationId,
                eventFactory: this.protocolFactory,
                onEvent: (event: AgentProtocolEvent) => {
                  if (event.type !== 'text.delta' && !this.isRunInvalidated(generation)) this.emitProtocol(event);
                },
              },
            },
          );
          timedOut = !signal.aborted && nodeController.signal.aborted;
          if (timedOut) return { node, error: workerTimeoutError(), usage: result.usage };
          return { node, result };
        } catch (error) {
          timedOut = timedOut || (!signal.aborted && nodeController.signal.aborted);
          if (timedOut && !(error instanceof Error && error.name === 'ExecutionTimeoutError')) {
            return { node, error: workerTimeoutError() };
          }
          return { node, error };
        } finally {
          clearTimeout(timeoutHandle);
          signal.removeEventListener('abort', abort);
        }
      }));
      let awaiting: AgentRunResult | undefined;
      let paused: AgentRunResult | undefined;
      for (const item of results) {
        if (item.result) {
          addUsage(item.result.usage);
          if (item.result.status === 'completed') {
            graph = completeExecutionGraphNode(graph, item.node.id, { summary: item.result.output || `${item.node.title} 完成`, evidence: [item.result.output, JSON.stringify(item.result.result)].filter((value): value is string => !!value) });
          } else if (item.result.status === 'awaiting_approval') {
            graph = checkpointExecutionGraphNode(graph, item.node.id, item.result.state ?? '', item.result.approvals ?? []);
            awaiting = item.result;
          } else if (item.result.status === 'cancelled') {
            graph = pauseExecutionGraphNode(graph, item.node.id, item.result.state);
            paused = item.result;
          } else {
            graph = failExecutionGraphNode(graph, item.node.id, item.result.result.status === 'refused' ? item.result.result.reason : '节点执行未完成');
          }
        } else {
          if ('usage' in item && item.usage) addUsage(item.usage);
          const message = this.formatError(item.error);
          if (isGlobalTimeoutError(item.error)) {
            graph = updateExecutionGraphControl(
              graph,
              usage,
              elapsedBeforeRun + (Date.now() - executionStartedAt),
            );
            graph = failExecutionGraphNode(graph, item.node.id, message);
            graph = markExecutionGraphLimit(graph, message);
            await persistGraph();
            throw item.error;
          }
          if (signal.aborted || isRetryableAgentError(item.error)) {
            graph = pauseExecutionGraphNode(graph, item.node.id, getResumableAgentState(item.error));
            run.teamTask = { ...run.teamTask, executionGraph: graph };
            run.usage = usage;
            await this.store.update(run);
            throw item.error;
          }
          graph = failExecutionGraphNode(graph, item.node.id, message);
        }
      }
      run.teamTask = { ...run.teamTask, executionGraph: graph };
      run.usage = usage;
      graph = updateExecutionGraphControl(
        graph,
        usage,
        elapsedBeforeRun + (Date.now() - executionStartedAt),
      );
      const overrun = graph.budget.maxInputTokens !== undefined && usage.inputTokens > graph.budget.maxInputTokens
        ? `输入 token 超出预算（${usage.inputTokens}/${graph.budget.maxInputTokens}）`
        : graph.budget.maxOutputTokens !== undefined && usage.outputTokens > graph.budget.maxOutputTokens
          ? `输出 token 超出预算（${usage.outputTokens}/${graph.budget.maxOutputTokens}）`
          : graph.budget.maxRequests !== undefined && usage.requests > graph.budget.maxRequests
            ? `模型请求超出预算（${usage.requests}/${graph.budget.maxRequests}）`
            : undefined;
      if (overrun) graph = markExecutionGraphLimit(graph, overrun);
      run.teamTask = { ...run.teamTask, executionGraph: graph };
      await this.store.update(run);
      if (overrun) throw new Error(overrun);
      this.emitTeamProgress(run, 'team.graph.nodes_completed', ready.map((node) => node.id).join(', '));
      if (awaiting) return awaiting;
      if (paused) return paused;
    }
  }

  private async commitTeamGraphSession(run: DurableRunRecord, generation: number): Promise<boolean> {
    const task = run.teamTask;
    const graph = task?.executionGraph;
    if (!task || !graph || graph.sessionCommitted) return true;
    if (this.isRunInvalidated(generation)) return false;
    const summary = graph.nodes
      .filter((node) => node.status === 'completed' && node.output)
      .map((node) => `${node.title}: ${node.output?.summary ?? ''}`.trim())
      .join('\n');
    await this.session.addItems([
      { type: 'message', role: 'user', content: run.userText } as unknown as AgentInputItem,
      { type: 'message', role: 'assistant', content: summary || run.output } as unknown as AgentInputItem,
    ]);
    if (this.isRunInvalidated(generation)) return false;
    run.teamTask = { ...task, executionGraph: commitExecutionGraphSession(graph) };
    await this.store.update(run);
    return !this.isRunInvalidated(generation);
  }

  private async prepareTeam(
    run: DurableRunRecord,
    apiKey: string,
    signal: AbortSignal,
    generation: number,
  ): Promise<void> {
    if (!run.teamTask) return;
    if (run.teamTask.status === 'paused') {
      run.teamTask = resumeTeamTask(run.teamTask);
      await this.store.update(run);
    }
    let reviewRevisions = 0;
    while (run.teamTask.nodes[1].status !== 'completed') {
      if (this.isRunInvalidated(generation)) return;
      if (run.teamTask.nodes[0].status === 'pending') {
        run.teamTask = startTeamNode(run.teamTask, 'planner');
        await this.persistTeamRole(run, 'planner', 'started', generation);
        const report = await this.planTeamTask!(
          { ...run.config, apiKey },
          run.teamTask,
          signal,
        );
        run.teamTask = applyTeamPlannerReport(run.teamTask, report);
        run.teamTask = completeTeamNode(run.teamTask, 'planner', {
          summary: report.planSummary,
          evidence: ['Team Planner 返回结构化计划、审查重点和验证标准'],
        });
        await this.persistTeamRole(run, 'planner', 'completed', generation);
      }
      if (run.teamTask.nodes[1].status !== 'pending') break;
      run.teamTask = startTeamNode(run.teamTask, 'reviewer');
      await this.persistTeamRole(run, 'reviewer', 'started', generation);
      const report = await this.reviewTeamTask!(
        { ...run.config, apiKey },
        run.teamTask,
        signal,
      );
      if (!report.approved) {
        reviewRevisions += 1;
        const feedback = report.summary || report.requiredChanges.join('；') || '审查未通过';
        if (reviewRevisions > MAX_TEAM_REVIEW_REVISIONS) {
          run.teamTask = failTeamNode(run.teamTask, 'reviewer', feedback);
          await this.persistTeamRole(run, 'reviewer', 'failed', generation);
          throw new Error(`Team 审查未通过：${feedback}`);
        }
        run.teamTask = reviseTeamPlanAfterReview(run.teamTask, report);
        await this.store.update(run);
        if (this.isRunInvalidated(generation)) return;
        this.emitTeamProgress(run, 'team.review.revision_requested', feedback);
        continue;
      }
      run.teamTask = completeTeamNode(run.teamTask, 'reviewer', {
        summary: report.summary || '审查通过',
        evidence: [...report.findings, ...report.requiredChanges].slice(0, 12),
      });
      await this.persistTeamRole(run, 'reviewer', 'completed', generation);
    }
    if (run.teamTask.nodes[2].status === 'pending') {
      run.teamTask = startTeamNode(run.teamTask, 'executor');
      await this.persistTeamRole(run, 'executor', 'started', generation);
    }
  }

  private async completeAndVerifyTeam(
    run: DurableRunRecord,
    apiKey: string,
    output: string,
    evidence: string[],
    signal: AbortSignal,
    generation: number,
  ): Promise<boolean> {
    if (!run.teamTask) return true;
    if (run.teamTask.nodes[2].status === 'running') {
      run.teamTask = completeTeamNode(run.teamTask, 'executor', {
        summary: output || '执行器完成',
        evidence,
      });
      await this.persistTeamRole(run, 'executor', 'completed', generation);
    }
    if (run.teamTask.nodes[3].status === 'pending') {
      run.teamTask = startTeamNode(run.teamTask, 'verifier');
      await this.persistTeamRole(run, 'verifier', 'started', generation);
      const report = await this.verifyTeamTask!(
        { ...run.config, apiKey },
        run.teamTask,
        output,
        evidence,
        signal,
      );
      if (!report.passed) {
        // Older verifier implementations only returned passed/summary/gaps.
        // Preserve their terminal-failure behavior unless they explicitly opt
        // into one of the controlled recovery decisions.
        const decision = report.decision;
        let reason = report.summary || report.gaps.join('；') || report.nextAction || '验收未通过';
        if (decision === 'ask_user') {
          const graph = run.teamTask.executionGraph;
          if (graph && graph.retryCount >= graph.maxRetries) {
            reason = `${reason}（执行图重试/调整次数已耗尽）`;
            run.teamTask = { ...run.teamTask, executionGraph: markExecutionGraphLimit(graph, reason) };
          } else {
            const approvalId = `team-verification:${graph?.revision ?? 0}:${graph?.retryCount ?? 0}`;
            const action = report.questionAction ?? (report.revisedGraph ? 'revise' : 'retry');
            const question = report.userQuestion || report.nextAction || reason;
            run.teamTask = checkpointTeamVerification(run.teamTask, {
              id: approvalId,
              question,
              action,
              retryNodeIds: report.retryNodeIds,
              revisedGraph: report.revisedGraph,
            });
            run.status = 'awaiting_approval';
            run.canContinue = false;
            run.state = `team-verification:${approvalId}`;
            run.approvals = [{ id: approvalId, name: 'team_verification', args: JSON.stringify({ question, action }) }];
            run.error = undefined;
            await this.store.update(run);
            await this.audit('approval_requested', run, { approvals: run.approvals, source: 'verifier' });
            this.emitTeamProgress(run, 'team.verification.user_input_required', question);
            this.emit({ type: 'awaitingApproval', runId: run.id, approvals: run.approvals });
            this.emitProtocol(this.protocolFactory!.next({
              type: 'approval.requested',
              payload: { approvalId, toolName: 'team_verification', args: run.approvals[0].args },
            }));
            await this.store.update(run);
            return false;
          }
        }
        if ((decision === 'retry' || decision === 'revise') && run.teamTask.executionGraph) {
          let adjusted: ExecutionGraph;
          try {
            if (decision === 'revise') {
              if (!report.revisedGraph) throw new Error('Verifier 未提供动态调整后的执行图');
              adjusted = reviseExecutionGraph(run.teamTask.executionGraph, report.revisedGraph, reason);
            } else {
              adjusted = retryExecutionGraphNodes(run.teamTask.executionGraph, report.retryNodeIds, reason);
            }
          } catch (error) {
            this.writeLog(`[team] verifier 调整被控制策略拒绝: ${this.formatError(error)}`);
            adjusted = markExecutionGraphLimit(run.teamTask.executionGraph, this.formatError(error));
            run.teamTask = { ...run.teamTask, executionGraph: adjusted };
          }
          if (adjusted.status !== 'failed') {
            run.teamTask = reopenTeamExecution(run.teamTask, adjusted);
            run.status = 'running';
            run.state = undefined;
            run.approvals = [];
            run.error = undefined;
            await this.store.update(run);
            this.emitTeamProgress(run, `team.verification.${decision}`, reason);
            await this.prepareTeam(run, apiKey, signal, generation);
            const retryResult = await this.executeTeamGraph(run, apiKey, signal, generation, {});
            if (retryResult.status === 'awaiting_approval') {
              run.status = 'awaiting_approval';
              run.state = retryResult.state;
              run.approvals = retryResult.approvals ?? [];
              run.output = retryResult.output;
              run.result = retryResult.result;
              run.usage = retryResult.usage;
              await this.store.update(run);
              await this.audit('approval_requested', run, { approvals: run.approvals, source: 'verifier_retry' });
              this.emit({ type: 'awaitingApproval', runId: run.id, approvals: run.approvals });
              for (const approval of run.approvals) {
                this.emitProtocol(this.protocolFactory!.next({
                  type: 'approval.requested',
                  payload: { approvalId: approval.id, toolName: approval.name, args: approval.args },
                }));
              }
              await this.store.update(run);
              return false;
            }
            if (retryResult.status === 'cancelled') {
              throw Object.assign(new Error('Verifier 后续执行被中止'), { name: 'AbortError' });
            }
            if (retryResult.status !== 'completed') throw new Error('Verifier 后续执行未完成');
            run.output = retryResult.output;
            run.result = retryResult.result;
            run.usage = retryResult.usage;
            return this.completeAndVerifyTeam(
              run,
              apiKey,
              retryResult.output,
              [retryResult.output, JSON.stringify(retryResult.result)],
              signal,
              generation,
            );
          }
        }
        run.teamTask = failTeamNode(
          run.teamTask,
          'verifier',
          reason,
          true,
        );
        run.status = 'failed';
        run.canContinue = false;
        run.error = `Team 验收未通过：${reason}`;
        run.result = createAgentResult({ status: 'failed', error: run.error, usage: run.usage });
        await this.store.update(run);
        await this.audit('team_verification_failed', run, {
          summary: report.summary,
          gaps: report.gaps,
          nextAction: report.nextAction,
        });
        this.emitTeamProgress(run, 'team.verification_failed', run.error);
        this.emit({ type: 'error', message: run.error, canRetry: true });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.failed',
          payload: { error: run.error, recoverable: false },
        }));
        return false;
      }
      run.teamTask = completeTeamNode(run.teamTask, 'verifier', {
        summary: report.summary || '验收通过',
        evidence: report.evidence,
      });
      await this.persistTeamRole(run, 'verifier', 'completed', generation);
    }
    return true;
  }

  private async persistTeamRole(
    run: DurableRunRecord,
    role: 'planner' | 'reviewer' | 'executor' | 'verifier',
    phase: 'started' | 'completed' | 'failed',
    generation: number,
  ): Promise<void> {
    await this.store.update(run);
    if (this.isRunInvalidated(generation)) return;
    await this.audit(phase === 'started' ? 'team_role_started' : 'team_role_completed', run, {
      role,
      phase,
      taskId: run.teamTask?.id,
    });
    if (!this.isRunInvalidated(generation)) {
      this.emitTeamProgress(run, `team.${role}.${phase}`, `${role} ${phase}`);
    }
  }

  private emitTeamProgress(run: DurableRunRecord, stage: string, message?: string): void {
    if (!run.teamTask) return;
    this.ensureProtocolFactory(run);
    this.emitProtocol(this.protocolFactory!.next({
      type: 'run.progress',
      payload: { stage, message, teamTask: run.teamTask },
    }));
  }

  private emitProtocol(event: AgentProtocolEvent): void {
    if (event.type === 'text.delta') {
      const payload = event.payload as { text?: unknown };
      if (typeof payload.text === 'string') this.liveOutput += payload.text;
    }
    this.recordReplayableProtocolEvent(event);
    this.emit({ type: 'agentEvent', event });
  }

  private ensureProtocolFactory(run: DurableRunRecord): void {
    if (this.protocolFactory && this.protocolRunId === run.id) {
      this.protocolRun = run;
      return;
    }
    this.protocolFactory = new AgentEventFactory(run.id, run.operationId);
    this.protocolRunId = run.id;
    this.protocolRun = run;
    this.emitProtocol(this.protocolFactory.next({
      type: 'run.started',
      payload: { userText: run.userText },
    }));
  }

  private recordReplayableProtocolEvent(event: AgentProtocolEvent): void {
    const run = this.protocolRun;
    if (!run || event.runId !== run.id || !REPLAYABLE_PROTOCOL_EVENT_TYPES.has(event.type)) return;
    const events = [...(run.events ?? []), event];
    run.events = events.slice(-MAX_REPLAYABLE_PROTOCOL_EVENTS);
  }

  private async replayHistory(generation = this.clearGeneration): Promise<void> {
    const messages = extractChatMessages(await this.session.getItems());
    const run = await this.store.getActive() ?? await this.store.getLast();
    const storedEvents = await this.store.getHistoryEvents();
    const events = mergeReplayableHistoryEvents(
      storedEvents,
      replayableHistoryEvents(run, messages.length),
    );
    if (this.isClearing(generation)) return;
    this.emit({ type: 'history', messages, events });
  }

  private async audit(type: AuditEventType, run: DurableRunRecord, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.auditSink) return;
    try {
      await this.auditSink.append({
        type,
        runId: run.id,
        operationId: run.operationId,
        traceId: run.id,
        metadata,
      });
    } catch (error) {
      this.writeLog(`[audit] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isLinearPlanIncompleteError(error: unknown): boolean {
    if (error instanceof AgentActionVerificationError) {
      return error.message.includes('线性计划尚未完成');
    }
    return error instanceof Error
      && error.name === 'AgentActionVerificationError'
      && error.message.includes('线性计划尚未完成');
  }

  private formatError(error: unknown): string {
    if (error instanceof MaxTurnsExceededError) {
      return `本轮模型往返超过 ${MAX_TURNS} 次上限，已自动停止。请重试或把需求拆细。`;
    }
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  private emit(event: RuntimeEvent): void {
    this.emitEvent(event);
  }

  private beginTransition(): number {
    this.transitioning = true;
    this.transitionDone = new Promise<void>((resolve) => {
      this.resolveTransitionDone = resolve;
    });
    return this.clearGeneration;
  }

  private endTransition(): void {
    this.transitioning = false;
    this.transitionController = undefined;
    this.resolveTransitionDone?.();
    this.resolveTransitionDone = undefined;
    this.transitionDone = undefined;
  }

  private isClearing(generation: number): boolean {
    return this.clearing || generation !== this.clearGeneration;
  }

  private isRunInvalidated(generation: number): boolean {
    return this.clearing || generation !== this.clearGeneration;
  }
}
