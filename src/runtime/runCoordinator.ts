import {
  runAgent,
  validateConfig,
  MaxTurnsExceededError,
  MAX_TURNS,
  type AgentRunOptions,
} from './agent';
import type { AgentInputItem, Session } from '@openai/agents';
import { extractChatMessages } from './session';
import type { DurableRunConfig, DurableRunRecord, RunStore } from './runStore';
import type { AuditEventType, AuditSink } from '../observability/audit';
import { AgentEventFactory, type AgentProtocolEvent } from '../protocol/events';
import { createAgentResult } from '../protocol/results';

export type RuntimeEvent =
  | { type: 'agentEvent'; event: AgentProtocolEvent }
  | ({ type: string } & Record<string, unknown>);

export interface RunCoordinatorDependencies {
  session: RecoverableSession;
  store: RunStore;
  emit: (event: RuntimeEvent) => void;
  log?: (line: string) => void;
  executeAgent?: typeof runAgent;
  audit?: AuditSink;
}

export interface RecoverableSession extends Session {
  getItems(limit?: number): Promise<AgentInputItem[]>;
  clearSession(): Promise<void>;
  truncate(length: number): Promise<void>;
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
  private readonly auditSink?: AuditSink;
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

  constructor(dependencies: RunCoordinatorDependencies) {
    this.session = dependencies.session;
    this.store = dependencies.store;
    this.emitEvent = dependencies.emit;
    this.writeLog = dependencies.log ?? (() => {});
    this.executeAgent = dependencies.executeAgent ?? runAgent;
    this.auditSink = dependencies.audit;
  }

  async initialize(): Promise<void> {
    if (this.initializeOperation) return this.initializeOperation;
    if (this.clearing && this.clearOperation) await this.clearOperation;
    this.initializeOperation = this.initializeInternal().finally(() => {
      this.initializeOperation = undefined;
    });
    return this.initializeOperation;
  }

  private async initializeInternal(): Promise<void> {
    const generation = this.clearGeneration;
    const active = await this.store.getActive();
    if (this.isClearing(generation)) return;
    if (active?.status === 'running') {
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
    this.emit({
      type: 'retryState',
      canRetry: !!last && last.status !== 'refused',
      canContinue: last?.status === 'paused' && last.canContinue === true,
    });
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
      const run = await this.store.begin(userText, config, (await this.session.getItems()).length);
      if (this.isClearing(generation)) return;
      await this.audit('run_started', run, { model: config.model });
      if (this.isClearing(generation)) return;
      this.emit({ type: 'user', text: userText, runId: run.id });
      this.writeLog(`[run:${run.id}] 用户: ${userText.slice(0, 120)}`);
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
      if (!run || run.id !== runId || run.status !== 'awaiting_approval' || !run.state) return;
      if (!run.approvals.some((approval) => approval.id === approvalId)) return;

      this.writeLog(`[run:${run.id}] 用户${approved ? '允许' : '拒绝'} ${approvalId}`);
      await this.audit('approval_decided', run, { approvalId, approved });
      run.status = 'running';
      await this.store.update(run);
      if (this.isClearing(generation)) return;
      await this.audit('run_resumed', run, { approvalId });
      if (this.isClearing(generation)) return;
      this.emit({ type: 'resumeStarted', runId: run.id, approvalId });
      this.ensureProtocolFactory(run);
      this.emitProtocol(this.protocolFactory!.next({
        type: 'approval.resolved',
        payload: { approvalId, approved, reason: approved ? undefined : 'user_rejected' },
      }));
      if (this.stopRequested) {
        this.stopRequested = false;
        await this.pausePending(run, false);
        return;
      }
      await this.execute(run, apiKey, {
        initialState: run.state,
        decisions: { [approvalId]: approved },
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
      const pending = await this.store.getActive();
      if (pending) await this.pausePending(pending, notify);
      return;
    }
    const run = await this.store.getActive();
    if (!run) return;
    await this.cancelPending(run, notify);
  }

  async continue(apiKey: string): Promise<void> {
    if (this.busy || this.transitioning || this.clearing) return;
    const generation = this.beginTransition();
    try {
      if (await this.store.getActive()) return;
      const previous = await this.store.getContinuable();
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
      if (!hasSdkState) {
        // An immediate stop can happen before the SDK has a serializable
        // RunState. The stopped turn was already rolled back, so claim a new
        // attempt in the same operation lineage; the effect journal prevents
        // completed or uncertain side effects from being duplicated.
        await this.session.truncate(previous.sessionItemCountBefore);
      }
      if (this.isClearing(generation)) return;
      const run = hasSdkState
        ? await this.store.resume(previous.id)
        : await this.store.begin(
          previous.userText,
          previous.config,
          previous.sessionItemCountBefore,
          previous.operationId,
        );
      if (this.isClearing(generation)) return;
      await this.audit('run_resumed', run, {
        resumedRunId: previous.id,
        strategy: hasSdkState ? 'sdk_state' : 'safe_restart',
      });
      if (this.isClearing(generation)) return;
      this.emit({
        type: 'resumeStarted',
        runId: run.id,
        continued: true,
        restartedFromBoundary: !hasSdkState,
        userText: run.userText,
      });
      await this.execute(run, apiKey, hasSdkState ? { initialState: run.state } : {});
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error), canRetry: true });
    } finally {
      this.endTransition();
    }
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
      );
      if (this.isClearing(generation)) return;
      await this.audit('retry_started', run, { previousRunId: previous.id });
      if (this.isClearing(generation)) return;
      this.emit({ type: 'user', text: run.userText, runId: run.id, retry: true });
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
      const result = await this.executeAgent(
        {
          ...run.config,
          apiKey,
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
          ...options,
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
            run.output = baseOutput + checkpoint.output;
            run.usage = checkpoint.usage;
            await this.store.update(run);
            await this.audit('checkpoint_saved', run, { approvalCount: checkpoint.approvals.length });
          },
        },
      );

      // clear() may have invalidated this run while the SDK was settling its
      // final promise. Its cleanup owns the final Session/RunStore state.
      if (this.isRunInvalidated(runGeneration)) return;
      run.output = result.output;
      run.result = result.result;
      run.usage = result.usage;
      run.approvals = result.approvals ?? [];
      const manuallyPaused = this.pauseRequested && result.status === 'cancelled';
      const resumable = manuallyPaused
        && typeof result.state === 'string'
        && result.state.length > 0;
      run.state = result.status === 'awaiting_approval' || resumable ? result.state : undefined;
      run.status = manuallyPaused ? 'paused' : result.status;
      run.canContinue = manuallyPaused;

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
      if (this.isRunInvalidated(runGeneration)) return;
      await this.session.truncate(run.sessionItemCountBefore);
      if (this.isRunInvalidated(runGeneration)) return;
      const manuallyPaused = cancelled && this.pauseRequested;
      run.status = manuallyPaused ? 'paused' : cancelled ? 'cancelled' : 'failed';
      run.state = undefined;
      run.approvals = [];
      run.error = cancelled ? undefined : this.formatError(error);
      run.result = cancelled
        ? createAgentResult({ status: 'cancelled', reason: 'aborted', usage: run.usage })
        : createAgentResult({
          status: 'failed',
          error: run.error ?? 'unknown_error',
          usage: run.usage,
        });
      run.canContinue = manuallyPaused;
      await this.store.update(run);
      if (this.isRunInvalidated(runGeneration)) return;
      if (manuallyPaused) {
        await this.audit('run_paused', run, { strategy: 'safe_restart' });
        this.writeLog(`[run:${run.id}] 已暂停，恢复策略=safe_restart`);
        this.emit({
          type: 'paused',
          canContinue: true,
          canRetry: true,
          resumeStrategy: 'safe_restart',
        });
      } else if (cancelled) {
        await this.audit('run_cancelled', run);
        this.writeLog(`[run:${run.id}] 已取消并回滚会话`);
        this.emit({ type: 'cancelled', canRetry: true });
        this.emitProtocol(this.protocolFactory!.next({
          type: 'run.cancelled',
          payload: { reason: 'aborted' },
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

  private emitProtocol(event: AgentProtocolEvent): void {
    if (event.type === 'text.delta') {
      const payload = event.payload as { text?: unknown };
      if (typeof payload.text === 'string') this.liveOutput += payload.text;
    }
    this.emit({ type: 'agentEvent', event });
  }

  private ensureProtocolFactory(run: DurableRunRecord): void {
    if (this.protocolFactory && this.protocolRunId === run.id) return;
    this.protocolFactory = new AgentEventFactory(run.id, run.operationId);
    this.protocolRunId = run.id;
    this.emitProtocol(this.protocolFactory.next({
      type: 'run.started',
      payload: { userText: run.userText },
    }));
  }

  private async replayHistory(generation = this.clearGeneration): Promise<void> {
    const messages = extractChatMessages(await this.session.getItems());
    if (this.isClearing(generation)) return;
    this.emit({ type: 'history', messages });
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
