import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ApprovalRequest, TurnUsage } from './agent';
import { EffectRecoveryRequiredError } from './errors';
import { parseAgentResult, type AgentResult } from '../protocol/results';
import type { ToolPolicyOverrides } from '../tools/toolContract';
import {
  isAgentApiFormat,
  isAgentProvider,
  type AgentApiFormat,
  type AgentProvider,
} from './modelAdapter';

export type DurableRunStatus =
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled'
  | 'refused'
  | 'failed';

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
  orchestration?: 'single' | 'team';
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
  approvals: ApprovalRequest[];
  /** Canonical structured result. Absent only while the run is still active. */
  result?: AgentResult<unknown>;
  /** Derived message projection used for session/UI recovery. */
  output: string;
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
  effects: Record<string, EffectRecord>;
  /** Per-attempt occurrence counters let an intentional duplicate execute twice. */
  effectAttempts?: Record<string, Record<string, number>>;
}

const EMPTY_USAGE: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };

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
  begin(
    userText: string,
    config: DurableRunConfig,
    sessionItemCountBefore: number,
    operationId?: string,
  ): Promise<DurableRunRecord>;
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
export class JsonRunStore implements RunStore {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async readDocument(): Promise<StoreDocument> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<StoreDocument>;
      if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1) {
        throw new Error('unsupported run store schema');
      }
      if (parsed.active !== undefined) this.assertRunRecord(parsed.active, 'active');
      if (parsed.last !== undefined) this.assertRunRecord(parsed.last, 'last');
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
      return {
        schemaVersion: 1,
        active: parsed.active,
        last: parsed.last,
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
    const statuses: DurableRunStatus[] = ['running', 'awaiting_approval', 'completed', 'cancelled', 'refused', 'failed'];
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
      (run.config.orchestration !== undefined && !['single', 'team'].includes(run.config.orchestration)) ||
      !Number.isSafeInteger(run.sessionItemCountBefore) ||
      !Array.isArray(run.approvals) ||
      run.approvals.some(
        (approval) =>
          !approval ||
          typeof approval.id !== 'string' ||
          typeof approval.name !== 'string' ||
          typeof approval.args !== 'string',
      ) ||
      typeof run.output !== 'string' ||
      !run.usage ||
      !Number.isFinite(run.usage.inputTokens) ||
      !Number.isFinite(run.usage.outputTokens) ||
      !Number.isFinite(run.usage.requests) ||
      typeof run.createdAt !== 'string' ||
      typeof run.updatedAt !== 'string'
    ) {
      throw new Error(`invalid ${field} run record`);
    }
    if (run.result !== undefined) {
      try {
        parseAgentResult(run.result);
      } catch {
        throw new Error(`invalid ${field} result`);
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

  async begin(
    userText: string,
    config: DurableRunConfig,
    sessionItemCountBefore: number,
    operationId: string = randomUUID(),
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
      output: '',
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
    });
  }

  async clearRuns(): Promise<void> {
    await this.mutate((document) => {
      delete document.active;
      delete document.last;
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
