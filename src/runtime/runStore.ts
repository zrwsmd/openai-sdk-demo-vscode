import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ApprovalRequest, TurnUsage } from './agent';
import { EffectRecoveryRequiredError } from './errors';
import { parseAgentResult, type AgentResult } from '../protocol/results';
import { parseAgentEvent, type AgentProtocolEvent } from '../protocol/events';
import type { ToolPolicyOverrides } from '../tools/toolContract';
import {
  isAgentApiFormat,
  isAgentProvider,
  type AgentApiFormat,
  type AgentProvider,
} from './modelAdapter';
import { parseTaskPlan, type TaskPlan } from './taskPlan';
import { parseTeamTask, type TeamTask } from '../orchestration/teamTask';
import type { IndustrialAgentMode } from '../orchestration/agentRoles';
import type { StAnalyzerSettings } from '../analysis/stAnalyzer';

export type DurableRunStatus =
  | 'running'
  | 'awaiting_approval'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'refused'
  | 'failed';

export type DurableRunResumeStage = 'routing' | 'planning' | 'execution';

export interface DurableRunConfig {
  baseUrl: string;
  model: string;
  /** Resolved provider/format are persisted so retry uses the same endpoint. */
  provider?: AgentProvider;
  apiFormat?: AgentApiFormat;
  exportDir: string;
  workspaceRoot: string;
  workspaceRoots?: string[];
  /** Host-configured policy limits persisted with the run for safe resume/retry. */
  policyContext?: ToolPolicyOverrides;
  orchestration?: IndustrialAgentMode;
  /** 纯数据 ST 校验设置,随 run 持久化,重试/续跑用同一套校验器配置。 */
  stAnalyzerSettings?: StAnalyzerSettings;
}

export interface DurableRunRecord {
  schemaVersion: 1;
  id: string;
  /** Stable across retries; scopes side-effect idempotency. */
  operationId: string;
  userText: string;
  status: DurableRunStatus;
  config: DurableRunConfig;
  sessionItemCountBefore: number;
  state?: string;
  /** True only when the SDK state can resume this exact run. */
  canContinue: boolean;
  /** Coordinator-level checkpoint used when the SDK has not started a turn. */
  resumeStage?: DurableRunResumeStage;
  /** Generic linear plan produced before execution, when the task needs one. */
  plan?: TaskPlan;
  /** V3 team contract and serial role progress for complex tasks. */
  teamTask?: TeamTask;
  approvals: ApprovalRequest[];
  /** Canonical structured result. Absent only while the run is still active. */
  result?: AgentResult<unknown>;
  /** Derived message projection used for session/UI recovery. */
  output: string;
  /** Replayable UI protocol events for restoring tool/approval cards. */
  events?: AgentProtocolEvent[];
  usage: TurnUsage;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

interface EffectRecord {
  status: 'pending' | 'completed' | 'uncertain';
  operationId: string;
  toolName: string;
  fingerprint: string;
  result?: unknown;
  error?: string;
  updatedAt: string;
}

/** On-disk schema. Legacy v1 documents do not yet contain attempt counters. */
interface StoreDocument {
  schemaVersion: 1;
  active?: DurableRunRecord;
  last?: DurableRunRecord;
  /** Replayable UI protocol events across completed chat turns. */
  historyEvents?: AgentProtocolEvent[];
  effects: Record<string, EffectRecord>;
  /** Per-attempt occurrence counters let an intentional duplicate execute twice. */
  effectAttempts?: Record<string, Record<string, number>>;
}

const EMPTY_USAGE: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
const MAX_HISTORY_EVENTS = 1_000;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function mergeHistoryEvents(
  existing: AgentProtocolEvent[],
  next: AgentProtocolEvent[],
): AgentProtocolEvent[] {
  if (!next.length) return existing.slice(-MAX_HISTORY_EVENTS);
  const byId = new Map(existing.map((event) => [event.eventId, event]));
  const merged = [...existing];
  for (const event of next) {
    if (byId.has(event.eventId)) continue;
    byId.set(event.eventId, event);
    merged.push(event);
  }
  return merged.slice(-MAX_HISTORY_EVENTS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export class RunAlreadyActiveError extends Error {
  constructor() {
    super('已有运行中的任务，不能同时启动另一轮');
    this.name = 'RunAlreadyActiveError';
  }
}

export interface RunStore {
  getActive(): Promise<DurableRunRecord | undefined>;
  getLast(): Promise<DurableRunRecord | undefined>;
  getHistoryEvents(): Promise<AgentProtocolEvent[]>;
  getContinuable(): Promise<DurableRunRecord | undefined>;
  begin(
    userText: string,
    config: DurableRunConfig,
    sessionItemCountBefore: number,
    operationId?: string,
    plan?: TaskPlan,
    teamTask?: TeamTask,
  ): Promise<DurableRunRecord>;
  resume(runId: string): Promise<DurableRunRecord>;
  update(run: DurableRunRecord): Promise<void>;
  clearRuns(): Promise<void>;
  executeEffect<T>(
    attemptId: string,
    operationId: string,
    toolName: string,
    input: unknown,
    execute: () => Promise<T>,
  ): Promise<T>;
}

/**
 * Durable lifecycle and side-effect journal for one chat workspace.
 *
 * RunState and conversation history deliberately live in separate files: a
 * checkpoint is execution state, while a Session is user-visible memory. The
 * serialized write queue also gives the UI host a single consistency boundary.
 */
/**
 * 只做类型校验,放行未知字段:旧版本 runs.json 反序列化不能因为
 * 新增可选字段而被拒(读不出来等于"运行状态损坏",会阻塞恢复)。
 */
function isStAnalyzerSettings(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.launches !== undefined) {
    if (!Array.isArray(value.launches)) return false;
    for (const launch of value.launches) {
      if (
        !isRecord(launch) ||
        typeof launch.exe !== 'string' ||
        !launch.exe ||
        !Array.isArray(launch.args) ||
        launch.args.some((arg) => typeof arg !== 'string') ||
        typeof launch.cwd !== 'string' ||
        (launch.env !== undefined && !isRecord(launch.env))
      ) {
        return false;
      }
    }
  }
  for (const key of ['timeoutMs', 'maxDiagnostics', 'maxContextFiles', 'maxFileBytes'] as const) {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      return false;
    }
  }
  if (value.loadWorkspaceContext !== undefined && typeof value.loadWorkspaceContext !== 'boolean') {
    return false;
  }
  return true;
}

export class JsonRunStore implements RunStore {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async readDocument(): Promise<StoreDocument> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<StoreDocument>;
      if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1) {
        throw new Error('unsupported run store schema');
      }
      if (parsed.active !== undefined) {
        this.assertRunRecord(parsed.active, 'active');
        // v1 stores created before checkpoint continuation did not have this
        // field; normalize them in memory so every caller sees a boolean.
        parsed.active.canContinue = parsed.active.canContinue === true;
        parsed.active.events ??= [];
      }
      if (parsed.last !== undefined) {
        this.assertRunRecord(parsed.last, 'last');
        parsed.last.canContinue = parsed.last.canContinue === true;
        parsed.last.events ??= [];
      }
      const effects = parsed.effects ?? {};
      const effectAttempts = parsed.effectAttempts ?? {};
      if (!isRecord(effects)) throw new Error('invalid effects journal');
      if (!isRecord(effectAttempts)) throw new Error('invalid effect attempt journal');
      for (const [key, value] of Object.entries(effects)) this.assertEffectRecord(value, key);
      for (const value of Object.values(effectAttempts)) {
        if (!isRecord(value) || Object.values(value).some((count) => !Number.isSafeInteger(count) || (count as number) < 0)) {
          throw new Error('invalid effect attempt counter');
        }
      }
      const historyEvents = Array.isArray(parsed.historyEvents)
        ? parsed.historyEvents.map((event) => parseAgentEvent(event))
        : [];
      return {
        schemaVersion: 1,
        active: parsed.active,
        last: parsed.last,
        historyEvents,
        effects,
        effectAttempts,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { schemaVersion: 1, effects: {}, effectAttempts: {} };
      }
      throw new Error(
        `运行状态存储损坏，已停止以避免重复执行工具: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private assertRunRecord(value: unknown, field: string): asserts value is DurableRunRecord {
    const run = value as Partial<DurableRunRecord> | undefined;
    const statuses: DurableRunStatus[] = ['running', 'awaiting_approval', 'paused', 'completed', 'cancelled', 'refused', 'failed'];
    if (
      !run ||
      run.schemaVersion !== 1 ||
      typeof run.id !== 'string' ||
      typeof run.operationId !== 'string' ||
      typeof run.userText !== 'string' ||
      !statuses.includes(run.status as DurableRunStatus) ||
      !run.config ||
      typeof run.config.baseUrl !== 'string' ||
      typeof run.config.model !== 'string' ||
      (run.config.provider !== undefined && !isAgentProvider(run.config.provider)) ||
      (run.config.apiFormat !== undefined && !isAgentApiFormat(run.config.apiFormat)) ||
      (run.config.provider === 'anthropic' && run.config.apiFormat !== 'messages') ||
      (run.config.provider === 'openai' && run.config.apiFormat === 'messages') ||
      typeof run.config.exportDir !== 'string' ||
      typeof run.config.workspaceRoot !== 'string' ||
      (run.config.workspaceRoots !== undefined &&
        (!Array.isArray(run.config.workspaceRoots) || run.config.workspaceRoots.some((root) => typeof root !== 'string'))) ||
      (run.config.policyContext !== undefined &&
        (!isRecord(run.config.policyContext) ||
          (run.config.policyContext.allowedCommands !== undefined &&
            (!Array.isArray(run.config.policyContext.allowedCommands) ||
              run.config.policyContext.allowedCommands.some((command) => typeof command !== 'string'))) ||
          (run.config.policyContext.allowedDevices !== undefined &&
            (!Array.isArray(run.config.policyContext.allowedDevices) ||
              run.config.policyContext.allowedDevices.some((device) => typeof device !== 'string'))) ||
          (run.config.policyContext.dryRun !== undefined && typeof run.config.policyContext.dryRun !== 'boolean'))) ||
      (run.config.orchestration !== undefined && !['auto', 'single', 'team'].includes(run.config.orchestration)) ||
      (run.config.stAnalyzerSettings !== undefined && !isStAnalyzerSettings(run.config.stAnalyzerSettings)) ||
      !Number.isSafeInteger(run.sessionItemCountBefore) ||
      (run.state !== undefined && typeof run.state !== 'string') ||
      (run.resumeStage !== undefined && !['routing', 'planning', 'execution'].includes(run.resumeStage)) ||
      (run.canContinue !== undefined && typeof run.canContinue !== 'boolean') ||
      (run.status === 'paused' && run.canContinue !== true) ||
      (run.canContinue === true && run.status !== 'paused') ||
      !Array.isArray(run.approvals) ||
      run.approvals.some(
        (approval) =>
          !approval ||
          typeof approval.id !== 'string' ||
          typeof approval.name !== 'string' ||
          typeof approval.args !== 'string',
      ) ||
      typeof run.output !== 'string' ||
      (run.events !== undefined && !Array.isArray(run.events)) ||
      !run.usage ||
      !Number.isFinite(run.usage.inputTokens) ||
      !Number.isFinite(run.usage.outputTokens) ||
      !Number.isFinite(run.usage.requests) ||
      typeof run.createdAt !== 'string' ||
      typeof run.updatedAt !== 'string'
    ) {
      throw new Error(`invalid ${field} run record`);
    }
    if (run.events !== undefined) {
      try {
        run.events = run.events.map((event) => parseAgentEvent(event));
      } catch {
        throw new Error(`invalid ${field} protocol events`);
      }
    }
    if (run.result !== undefined) {
      try {
        parseAgentResult(run.result);
      } catch {
        throw new Error(`invalid ${field} result`);
      }
    }
    if (run.plan !== undefined) {
      try {
        parseTaskPlan(run.plan);
      } catch {
        throw new Error(`invalid ${field} task plan`);
      }
    }
    if (run.teamTask !== undefined) {
      try {
        parseTeamTask(run.teamTask);
      } catch {
        throw new Error(`invalid ${field} team task`);
      }
    }
  }

  private assertEffectRecord(value: unknown, key: string): asserts value is EffectRecord {
    const effect = value as Partial<EffectRecord> | undefined;
    if (
      !effect ||
      !['pending', 'completed', 'uncertain'].includes(effect.status ?? '') ||
      typeof effect.toolName !== 'string' ||
      typeof effect.fingerprint !== 'string' ||
      typeof effect.updatedAt !== 'string'
    ) {
      throw new Error(`invalid effect record ${key}`);
    }
    // Legacy schema-v1 effects can infer their operation id from the map key.
    if (typeof effect.operationId !== 'string') {
      effect.operationId = key.split(':', 1)[0];
    }
  }

  private async persistDocument(document: StoreDocument): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(document), 'utf8');
    await fs.rename(temp, this.filePath);
  }

  private mutate<T>(fn: (document: StoreDocument) => Promise<T> | T): Promise<T> {
    const operation = this.writeChain.then(async () => {
      const document = await this.readDocument();
      const result = await fn(document);
      await this.persistDocument(document);
      return result;
    });
    this.writeChain = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async getActive(): Promise<DurableRunRecord | undefined> {
    await this.writeChain;
    return (await this.readDocument()).active;
  }

  async getLast(): Promise<DurableRunRecord | undefined> {
    await this.writeChain;
    return (await this.readDocument()).last;
  }

  async getHistoryEvents(): Promise<AgentProtocolEvent[]> {
    await this.writeChain;
    return [...((await this.readDocument()).historyEvents ?? [])];
  }

  async getContinuable(): Promise<DurableRunRecord | undefined> {
    await this.writeChain;
    const last = (await this.readDocument()).last;
    return last?.status === 'paused' && last.canContinue === true ? last : undefined;
  }

  async begin(
    userText: string,
    config: DurableRunConfig,
    sessionItemCountBefore: number,
    operationId: string = randomUUID(),
    plan?: TaskPlan,
    teamTask?: TeamTask,
  ): Promise<DurableRunRecord> {
    const now = new Date().toISOString();
    const run: DurableRunRecord = {
      schemaVersion: 1,
      id: randomUUID(),
      operationId,
      userText,
      status: 'running',
      config,
      sessionItemCountBefore,
      approvals: [],
      canContinue: false,
      plan,
      teamTask,
      output: '',
      events: [],
      usage: { ...EMPTY_USAGE },
      createdAt: now,
      updatedAt: now,
    };
    await this.mutate((document) => {
      if (document.active) throw new RunAlreadyActiveError();
      document.active = run;
      document.last = run;
      (document.effectAttempts ??= {})[run.id] = {};
    });
    return run;
  }

  async resume(runId: string): Promise<DurableRunRecord> {
    return this.mutate((document) => {
      if (document.active) throw new RunAlreadyActiveError();
      const previous = document.last;
      if (
        !previous ||
        previous.id !== runId ||
        previous.status !== 'paused' ||
        previous.canContinue !== true ||
        !previous.state
      ) {
        throw new Error('没有可续跑的任务断点');
      }
      const resumed: DurableRunRecord = {
        ...previous,
        status: 'running',
        canContinue: false,
        approvals: [],
        result: undefined,
        error: undefined,
        updatedAt: new Date().toISOString(),
      };
      document.active = resumed;
      document.last = resumed;
      return resumed;
    });
  }

  async update(run: DurableRunRecord): Promise<void> {
    const next = { ...run, updatedAt: new Date().toISOString() };
    await this.mutate((document) => {
      if (document.active && document.active.id !== run.id) {
        throw new Error(`运行状态冲突: ${run.id} 不能覆盖当前任务 ${document.active.id}`);
      }
      if (!document.active && (next.status === 'running' || next.status === 'awaiting_approval')) {
        throw new Error(`运行状态冲突: 终态任务 ${run.id} 不能重新激活`);
      }
      document.last = next;
      document.active = next.status === 'running' || next.status === 'awaiting_approval' ? next : undefined;
      document.historyEvents = mergeHistoryEvents(document.historyEvents ?? [], next.events ?? []);
    });
  }

  async clearRuns(): Promise<void> {
    await this.mutate((document) => {
      delete document.active;
      delete document.last;
      document.historyEvents = [];
      // Keep effect history as an audit trail. A future database store can
      // apply an explicit retention policy instead of coupling it to chat UI.
      document.effectAttempts = {};
    });
  }

  /**
   * Executes an exact side effect once within an operation lineage. A crash
   * after execution but before commit remains `pending`; later retries refuse
   * to guess, preventing an unsafe duplicate command.
   */
  async executeEffect<T>(
    attemptId: string,
    operationId: string,
    toolName: string,
    input: unknown,
    execute: () => Promise<T>,
  ): Promise<T> {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ toolName, input: stableValue(input) }))
      .digest('hex');
    const cached = await this.mutate((document) => {
      const unsafePrior = Object.values(document.effects).find(
        (effect) =>
          effect.operationId === operationId &&
          effect.fingerprint === fingerprint &&
          effect.status !== 'completed',
      );
      if (unsafePrior) {
        throw new EffectRecoveryRequiredError(
          `工具 ${toolName} 的上次执行结果不确定，为避免重复副作用已阻止自动重试`,
        );
      }

      const attempts = (document.effectAttempts ??= {});
      const attempt = attempts[attemptId] ?? {};
      attempts[attemptId] = attempt;
      const occurrence = attempt[fingerprint] ?? 0;
      const key = `${operationId}:${fingerprint}:${occurrence}`;
      const legacyKey = `${operationId}:${fingerprint}`;
      const existing = document.effects[key] ?? (occurrence === 0 ? document.effects[legacyKey] : undefined);
      attempt[fingerprint] = occurrence + 1;
      if (existing?.status === 'completed') return { found: true, key, result: existing.result as T };
      if (existing) {
        throw new EffectRecoveryRequiredError(
          `工具 ${toolName} 的上次执行结果不确定，为避免重复副作用已阻止自动重试`,
        );
      }
      document.effects[key] = {
        status: 'pending',
        operationId,
        toolName,
        fingerprint,
        updatedAt: new Date().toISOString(),
      };
      return { found: false, key, result: undefined as T | undefined };
    });
    if (cached.found) return cached.result as T;
    try {
      const result = await execute();
      await this.mutate((document) => {
        document.effects[cached.key] = {
          status: 'completed',
          operationId,
          toolName,
          fingerprint,
          result,
          updatedAt: new Date().toISOString(),
        };
      });
      return result;
    } catch (error) {
      await this.mutate((document) => {
        document.effects[cached.key] = {
          status: 'uncertain',
          operationId,
          toolName,
          fingerprint,
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        };
      });
      throw error;
    }
  }
}
