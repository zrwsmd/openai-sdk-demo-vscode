import {
  runAgent,
  validateConfig,
  MaxTurnsExceededError,
  MAX_TURNS,
  type AgentEvent,
  type AgentRunOptions,
} from './agent';
import type { AgentInputItem, Session } from '@openai/agents';
import { extractChatMessages } from './session';
import type { DurableRunConfig, DurableRunRecord, RunStore } from './runStore';
import type { AuditEventType, AuditSink } from '../observability/audit';

export type RuntimeEvent =
  | ({ type: AgentEvent['type']; runId: string } & Record<string, unknown>)
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
  private liveOutput = '';
  private stopRequested = false;

  constructor(dependencies: RunCoordinatorDependencies) {
    this.session = dependencies.session;
    this.store = dependencies.store;
    this.emitEvent = dependencies.emit;
    this.writeLog = dependencies.log ?? (() => {});
    this.executeAgent = dependencies.executeAgent ?? runAgent;
    this.auditSink = dependencies.audit;
  }

  async initialize(): Promise<void> {
    const active = await this.store.getActive();
    if (active?.status === 'running') {
      if (this.busy || this.transitioning) {
        await this.replayHistory();
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
      active.status = 'failed';
      active.error = '扩展进程在运行期间中断，本轮已回滚，可以安全重试。';
      await this.store.update(active);
      await this.replayHistory();
      this.emit({ type: 'runRecovered', message: active.error, canRetry: true });
      return;
    }
    await this.replayHistory();
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
    this.emit({ type: 'retryState', canRetry: !!last });
  }

  async start(userText: string, config: DurableRunConfig, apiKey: string): Promise<void> {
    if (this.busy || this.transitioning) return;
    this.transitioning = true;
    try {
      if (await this.store.getActive()) return;
      const error = validateConfig({ ...config, apiKey });
      if (error) {
        this.emit({ type: 'error', message: error });
        return;
      }
      const run = await this.store.begin(userText, config, (await this.session.getItems()).length);
      await this.audit('run_started', run, { model: config.model });
      this.emit({ type: 'user', text: userText, runId: run.id });
      this.writeLog(`[run:${run.id}] 用户: ${userText.slice(0, 120)}`);
      if (this.stopRequested) {
        this.stopRequested = false;
        await this.cancelPending(run, false);
        return;
      }
      await this.execute(run, apiKey);
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error) });
    } finally {
      this.transitioning = false;
    }
  }

  async approve(runId: string, approvalId: string, approved: boolean, apiKey: string): Promise<void> {
    if (this.busy || this.transitioning || !runId || !approvalId) return;
    this.transitioning = true;
    try {
      const run = await this.store.getActive();
      if (!run || run.id !== runId || run.status !== 'awaiting_approval' || !run.state) return;
      if (!run.approvals.some((approval) => approval.id === approvalId)) return;

      this.writeLog(`[run:${run.id}] 用户${approved ? '允许' : '拒绝'} ${approvalId}`);
      await this.audit('approval_decided', run, { approvalId, approved });
      run.status = 'running';
      await this.store.update(run);
      await this.audit('run_resumed', run, { approvalId });
      this.emit({ type: 'resumeStarted', runId: run.id, approvalId });
      if (this.stopRequested) {
        this.stopRequested = false;
        await this.cancelPending(run, false);
        return;
      }
      await this.execute(run, apiKey, {
        initialState: run.state,
        decisions: { [approvalId]: approved },
      });
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error), canRetry: true });
    } finally {
      this.transitioning = false;
    }
  }

  async stop(notify = true): Promise<void> {
    if (this.controller) {
      const done = this.activeDone;
      this.controller.abort();
      if (notify) this.emit({ type: 'stopping' });
      await done;
      return;
    }
    if (this.transitioning) {
      this.stopRequested = true;
      const pending = await this.store.getActive();
      if (pending) await this.cancelPending(pending, notify);
      return;
    }
    const run = await this.store.getActive();
    if (!run) return;
    await this.cancelPending(run, notify);
  }

  private async cancelPending(run: DurableRunRecord, notify: boolean): Promise<void> {
    // Rollback first: an intervening crash leaves the record active and startup
    // safely repeats this idempotent truncation.
    await this.session.truncate(run.sessionItemCountBefore);
    run.status = 'cancelled';
    run.state = undefined;
    run.approvals = [];
    await this.store.update(run);
    await this.audit('run_cancelled', run);
    if (notify) {
      this.emit({ type: 'cancelled', canRetry: true });
      this.emit({ type: 'idle' });
    }
  }

  async retry(apiKey: string): Promise<void> {
    if (this.busy || this.transitioning) return;
    this.transitioning = true;
    try {
      if (await this.store.getActive()) return;
      const previous = await this.store.getLast();
      if (!previous) return;
      if (validateConfig({ ...previous.config, apiKey })) {
        this.emit({ type: 'error', message: '重试失败：当前没有可用的 API Key。' });
        return;
      }
      await this.session.truncate(previous.sessionItemCountBefore);
      await this.replayHistory();
      const run = await this.store.begin(
        previous.userText,
        previous.config,
        previous.sessionItemCountBefore,
        previous.operationId,
      );
      await this.audit('retry_started', run, { previousRunId: previous.id });
      this.emit({ type: 'user', text: run.userText, runId: run.id, retry: true });
      this.writeLog(`[run:${run.id}] 重试 operation=${run.operationId}`);
      await this.execute(run, apiKey);
    } catch (error) {
      this.emit({ type: 'error', message: this.formatError(error) });
    } finally {
      this.transitioning = false;
    }
  }

  async clear(): Promise<void> {
    await this.stop(false);
    await this.session.clearSession();
    await this.store.clearRuns();
    this.emit({ type: 'cleared' });
  }

  private async execute(
    run: DurableRunRecord,
    apiKey: string,
    options: Pick<AgentRunOptions, 'initialState' | 'decisions'> = {},
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;
    this.activeDone = new Promise<void>((resolve) => {
      this.resolveActiveDone = resolve;
    });
    this.liveOutput = '';
    if (this.stopRequested) {
      this.stopRequested = false;
      await this.cancelPending(run, false);
      this.controller = undefined;
      this.busy = false;
      this.resolveActiveDone?.();
      this.resolveActiveDone = undefined;
      this.activeDone = undefined;
      this.emit({ type: 'idle' });
      return;
    }
    this.emit({ type: 'busy', runId: run.id });

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
        (event) => this.forwardAgentEvent(run.id, event),
        {
          ...options,
          signal: controller.signal,
          onCheckpoint: async (checkpoint) => {
            run.status = 'awaiting_approval';
            run.state = checkpoint.state;
            run.approvals = checkpoint.approvals;
            run.output = baseOutput + checkpoint.output;
            run.usage = checkpoint.usage;
            await this.store.update(run);
            await this.audit('checkpoint_saved', run, { approvalCount: checkpoint.approvals.length });
          },
        },
      );

      run.output = baseOutput + result.output;
      run.usage = result.usage;
      run.approvals = result.approvals ?? [];
      run.state = result.state;
      run.status = result.status;

      // Session rollback must happen before the run becomes terminal. If the
      // host crashes between these writes, startup still sees an active run.
      if (result.status === 'cancelled') await this.session.truncate(run.sessionItemCountBefore);
      await this.store.update(run);

      if (result.status === 'awaiting_approval') {
        await this.audit('approval_requested', run, { approvals: run.approvals });
        this.writeLog(`[run:${run.id}] 已持久化审批断点 (${run.approvals.length} 项)`);
        this.emit({ type: 'awaitingApproval', runId: run.id, approvals: run.approvals });
      } else if (result.status === 'cancelled') {
        await this.audit('run_cancelled', run);
        this.writeLog(`[run:${run.id}] 已取消并回滚会话`);
        this.emit({ type: 'cancelled', canRetry: true });
      } else {
        await this.audit('run_completed', run, { usage: result.usage });
        this.writeLog(
          `[run:${run.id}] 完成: 文本 ${run.output.length} 字符 | tokens ${result.usage.inputTokens}/${result.usage.outputTokens} | 模型调用 ${result.usage.requests} 次`,
        );
        this.emit({ type: 'done', usage: result.usage, canRetry: true });
      }
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      await this.session.truncate(run.sessionItemCountBefore);
      run.status = cancelled ? 'cancelled' : 'failed';
      run.state = undefined;
      run.approvals = [];
      run.error = cancelled ? undefined : this.formatError(error);
      await this.store.update(run);
      if (cancelled) {
        await this.audit('run_cancelled', run);
        this.writeLog(`[run:${run.id}] 已取消并回滚会话`);
        this.emit({ type: 'cancelled', canRetry: true });
      } else {
        await this.audit('run_failed', run, { error: run.error });
        this.writeLog(`[run:${run.id}] 出错: ${run.error}`);
        this.emit({ type: 'error', message: run.error, canRetry: true });
      }
    } finally {
      if (this.controller === controller) this.controller = undefined;
      this.busy = false;
      this.resolveActiveDone?.();
      this.resolveActiveDone = undefined;
      this.activeDone = undefined;
      this.liveOutput = '';
      this.emit({ type: 'idle' });
    }
  }

  private forwardAgentEvent(runId: string, event: AgentEvent): void {
    if (event.type === 'delta') {
      this.liveOutput += event.text;
      this.emit({ type: 'delta', text: event.text, runId });
    } else if (event.type === 'tool') this.emit({ type: 'tool', name: event.name, runId });
    else {
      this.writeLog(`[run:${runId}] ${event.name} -> ${event.ok ? 'ok' : 'fail'}: ${event.summary.slice(0, 300)}`);
      this.emit({ ...event, type: 'toolResult', runId });
    }
  }

  private async replayHistory(): Promise<void> {
    this.emit({ type: 'history', messages: extractChatMessages(await this.session.getItems()) });
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
}
