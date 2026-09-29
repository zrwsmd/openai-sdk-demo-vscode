import OpenAI from 'openai';
import type {
  AgentInputItem,
  OpenAIResponsesCompactionArgs,
  Session,
  SessionHistoryRewriteArgs,
  SessionHistoryTransactionArgs,
} from '@openai/agents';
import {
  OpenAIResponsesCompactionSession,
  type OpenAIResponsesCompactionDecisionContext,
  type OpenAIResponsesCompactionSessionOptions,
} from '@openai/agents-openai';
import {
  ensureContextCompacted,
  estimateItemsCharacters,
  resolveContextCompactionPolicy,
  type ContextCompactionResult,
  type ContextManagerOptions,
  type ModelContextProfile,
} from './contextManager';
import type { AgentConfig } from './agentConfig';
import { estimateItemsTokens } from './contextTokenEstimator';
import {
  supportsOfficialResponsesCompactionModel,
  usesOfficialOpenAIResponses,
} from './modelAdapter';

export interface RecoverableContextSession extends Session {
  replaceItems(items: AgentInputItem[]): Promise<void>;
  truncate(length: number): Promise<void>;
}

export type ContextSessionMode = 'local' | 'official_responses';

export interface ContextSessionOptions {
  getSignal?: () => AbortSignal | undefined;
  log?: (line: string) => void;
  /**
   * The coordinator injects its compactor so tests and hosts can retain their
   * existing summary policy without coupling this decorator to RunCoordinator.
   */
  compact?: (
    session: RecoverableContextSession,
    config: AgentConfig,
    options?: ContextManagerOptions,
  ) => Promise<ContextCompactionResult>;
  client?: OpenAIResponsesCompactionSessionOptions['client'];
}

export interface ContextCheckpointResult {
  compacted: boolean;
  beforeItems: number;
  afterItems: number;
  beforeCharacters: number;
  afterCharacters: number;
  error?: string;
  mode: ContextSessionMode;
}

export interface ManagedContextSession {
  readonly session: Session;
  readonly mode: ContextSessionMode;
  runInitialCheckpoint(): Promise<ContextCheckpointResult>;
  /**
   * Restore the history at the beginning of the current SDK turn. This is
   * intentionally a no-op for the official decorator because its underlying
   * session remains the source of truth and the coordinator's normal boundary
   * rollback handles it.
   */
  restoreTurnBoundary(): Promise<void>;
}

/**
 * Local checkpoint wrapper. The SDK sees a normal Session, while every
 * persisted append gets a best-effort context check. The queue prevents a
 * slow summary request from racing the next history mutation.
 */
class ContextCheckpointSession implements Session {
  private checkpointQueue: Promise<void> = Promise.resolve();
  private turnBoundary: AgentInputItem[];

  prepareHistoryItemForModelInput?: Session['prepareHistoryItemForModelInput'];
  prepareHistoryItemsForPersistenceComparison?: Session['prepareHistoryItemsForPersistenceComparison'];
  preserveReasoningItemIdsForPersistence?: Session['preserveReasoningItemIdsForPersistence'];
  replaceHistoryWithCompaction?: Session['replaceHistoryWithCompaction'];
  applyHistoryMutations?: (args: SessionHistoryRewriteArgs) => Promise<void> | void;
  applyHistoryTransaction?: (args: SessionHistoryTransactionArgs) => Promise<void> | void;

  constructor(
    private readonly inner: RecoverableContextSession,
    private readonly checkpoint: () => Promise<ContextCompactionResult>,
    private readonly log: (line: string) => void,
  ) {
    this.turnBoundary = [];
    if (inner.prepareHistoryItemForModelInput) {
      this.prepareHistoryItemForModelInput = (item) => inner.prepareHistoryItemForModelInput!(item);
    }
    if (inner.prepareHistoryItemsForPersistenceComparison) {
      this.prepareHistoryItemsForPersistenceComparison = (items) =>
        inner.prepareHistoryItemsForPersistenceComparison!(items);
    }
    if (inner.preserveReasoningItemIdsForPersistence) {
      this.preserveReasoningItemIdsForPersistence = () =>
        inner.preserveReasoningItemIdsForPersistence!();
    }
    if (inner.replaceHistoryWithCompaction) {
      this.replaceHistoryWithCompaction = (items) =>
        inner.replaceHistoryWithCompaction!(items);
    }
    if (typeof (inner as RecoverableContextSession & {
      applyHistoryMutations?: (args: SessionHistoryRewriteArgs) => Promise<void> | void;
    }).applyHistoryMutations === 'function') {
      this.applyHistoryMutations = (args) =>
        (inner as RecoverableContextSession & {
          applyHistoryMutations: (args: SessionHistoryRewriteArgs) => Promise<void> | void;
        }).applyHistoryMutations(args);
    }
    if (typeof (inner as RecoverableContextSession & {
      applyHistoryTransaction?: (args: SessionHistoryTransactionArgs) => Promise<void> | void;
    }).applyHistoryTransaction === 'function') {
      this.applyHistoryTransaction = (args) =>
        (inner as RecoverableContextSession & {
          applyHistoryTransaction: (args: SessionHistoryTransactionArgs) => Promise<void> | void;
        }).applyHistoryTransaction(args);
    }
  }

  async initializeTurnBoundary(): Promise<void> {
    this.turnBoundary = await this.inner.getItems();
  }

  async acceptCurrentHistoryAsTurnBoundary(): Promise<void> {
    this.turnBoundary = await this.inner.getItems();
  }

  async runCheckpoint(): Promise<ContextCompactionResult> {
    return this.checkpoint();
  }

  async restoreTurnBoundary(): Promise<void> {
    await this.inner.replaceItems(this.turnBoundary.map((item) => ({ ...item })));
  }

  async getSessionId(): Promise<string> {
    return this.inner.getSessionId();
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    return this.inner.getItems(limit);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    await this.inner.addItems(items);
    if (!items.length) return;
    const pending = this.checkpointQueue.then(async () => {
      try {
        const result = await this.checkpoint();
        if (result.compacted) {
          this.log(
            `[context] 单轮中途检查已压缩历史: items ${result.beforeItems}->${result.afterItems}, ` +
              `chars ${result.beforeCharacters}->${result.afterCharacters}`,
          );
        } else if (result.error) {
          this.log(`[context] 单轮中途检查失败，保留当前历史继续: ${result.error}`);
        }
      } catch (error) {
        this.log(
          `[context] 单轮中途检查异常，保留当前历史继续: ${
            error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          }`,
        );
      }
    });
    this.checkpointQueue = pending.then(() => undefined, () => undefined);
    await pending;
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    return this.inner.popItem();
  }

  async clearSession(): Promise<void> {
    await this.inner.clearSession();
  }
}

/**
 * Older persisted sessions may contain assistant messages as plain strings.
 * Responses compaction expects assistant content parts, so normalize only the
 * view used for the compaction request while keeping the durable store shape
 * unchanged.
 */
class ResponsesCompactionInputSession implements Session {
  constructor(private readonly inner: RecoverableContextSession) {}

  async getSessionId(): Promise<string> {
    return this.inner.getSessionId();
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const items = await this.inner.getItems(limit);
    return items.map(normalizeResponsesCompactionItem);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    await this.inner.addItems(items);
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    return this.inner.popItem();
  }

  async clearSession(): Promise<void> {
    await this.inner.clearSession();
  }
}

class BestEffortOpenAIResponsesCompactionSession extends OpenAIResponsesCompactionSession {
  constructor(
    options: OpenAIResponsesCompactionSessionOptions,
    private readonly log: (line: string) => void,
  ) {
    super(options);
  }

  override async runCompaction(
    args?: OpenAIResponsesCompactionArgs,
  ): Promise<Awaited<ReturnType<OpenAIResponsesCompactionSession['runCompaction']>>> {
    try {
      return await super.runCompaction(args);
    } catch (error) {
      this.log(
        `[context] 官方 Responses 压缩失败，保留本地历史继续: ${
          error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        }`,
      );
      return null;
    }
  }
}

function normalizeResponsesCompactionItem(item: AgentInputItem): AgentInputItem {
  const value = item as Record<string, unknown>;
  if (value.type !== 'message' || value.role !== 'assistant' || !value.content) {
    return item;
  }
  if (typeof value.content !== 'string') return item;
  return {
    ...value,
    content: [{ type: 'output_text', text: value.content }],
  } as unknown as AgentInputItem;
}

function defaultLog(): void {}

function shouldTriggerContextCompaction(
  items: AgentInputItem[],
  profile?: ModelContextProfile,
): boolean {
  const policy = resolveContextCompactionPolicy(profile);
  if (policy.inputBudgetTokens !== undefined) {
    return estimateItemsTokens(items, profile?.tokenCalibration) > policy.inputBudgetTokens;
  }
  return items.length > policy.legacy.maxItems ||
    estimateItemsCharacters(items) > policy.legacy.maxCharacters;
}

function emptyCheckpointResult(
  items: AgentInputItem[],
  mode: ContextSessionMode,
  error?: string,
): ContextCheckpointResult {
  const characters = estimateItemsCharacters(items);
  return {
    compacted: false,
    beforeItems: items.length,
    afterItems: items.length,
    beforeCharacters: characters,
    afterCharacters: characters,
    error,
    mode,
  };
}

export async function createManagedContextSession(
  underlying: RecoverableContextSession,
  config: AgentConfig,
  options: ContextSessionOptions = {},
): Promise<ManagedContextSession> {
  const log = options.log ?? defaultLog;
  const localCompactor = options.compact ?? ensureContextCompacted;
  const getSignal = options.getSignal ?? (() => undefined);

  const officialResponses = usesOfficialOpenAIResponses(config);
  if (officialResponses && !supportsOfficialResponsesCompactionModel(config.model)) {
    log(`[context] 模型 ${config.model} 不支持官方 Responses 压缩，回退本地压缩`);
  }

  if (officialResponses && supportsOfficialResponsesCompactionModel(config.model)) {
    try {
      const client = options.client ?? new OpenAI({ apiKey: config.apiKey });
      const official = new BestEffortOpenAIResponsesCompactionSession(
        {
          client,
          underlyingSession: new ResponsesCompactionInputSession(underlying),
          model: config.model as OpenAI.ResponsesModel,
          compactionMode: 'input',
          shouldTriggerCompaction: ({ sessionItems }: OpenAIResponsesCompactionDecisionContext) =>
            shouldTriggerContextCompaction(sessionItems, config.modelContext),
        },
        log,
      );
      let turnBoundary = await underlying.getItems();
      return {
        session: official,
        mode: 'official_responses',
        async runInitialCheckpoint(): Promise<ContextCheckpointResult> {
          const before = await underlying.getItems();
          if (!shouldTriggerContextCompaction(before, config.modelContext)) {
            turnBoundary = before.map((item) => ({ ...item }));
            return emptyCheckpointResult(before, 'official_responses');
          }
          await official.runCompaction();
          const after = await underlying.getItems();
          turnBoundary = after.map((item) => ({ ...item }));
          return {
            compacted: !sameItems(before, after),
            beforeItems: before.length,
            afterItems: after.length,
            beforeCharacters: estimateItemsCharacters(before),
            afterCharacters: estimateItemsCharacters(after),
            mode: 'official_responses',
          };
        },
        async restoreTurnBoundary(): Promise<void> {
          await underlying.replaceItems(turnBoundary.map((item) => ({ ...item })));
        },
      };
    } catch (error) {
      log(
        `[context] 官方 Responses 会话装饰器不可用，回退本地压缩: ${
          error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        }`,
      );
    }
  }

  const local = new ContextCheckpointSession(
    underlying,
    async () => localCompactor(
      underlying,
      config,
      {
        modelContext: config.modelContext,
        signal: getSignal(),
      },
    ),
    log,
  );
  await local.initializeTurnBoundary();
  return {
    session: local,
    mode: 'local',
    async runInitialCheckpoint(): Promise<ContextCheckpointResult> {
      const result = await runLocalCheckpoint(local, 'local');
      await local.acceptCurrentHistoryAsTurnBoundary();
      return result;
    },
    restoreTurnBoundary(): Promise<void> {
      return local.restoreTurnBoundary();
    },
  };
}

async function runLocalCheckpoint(
  session: ContextCheckpointSession,
  mode: ContextSessionMode,
): Promise<ContextCheckpointResult> {
  const result = await session.runCheckpoint();
  const after = await session.getItems();
  return {
    compacted: result.compacted,
    beforeItems: result.beforeItems,
    afterItems: result.afterItems,
    beforeCharacters: result.beforeCharacters,
    afterCharacters: result.afterCharacters,
    error: result.error,
    mode,
  };
}

function sameItems(left: AgentInputItem[], right: AgentInputItem[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
