import { Agent, Runner, type AgentInputItem } from '@openai/agents';
import { z } from 'zod';
import { buildModelAdapter } from './agent';
import type { AgentConfig } from './agentConfig';
import { estimateItemsTokens } from './contextTokenEstimator';

export const CONTEXT_SUMMARY_MARKER = '[plc-agent-context-summary:v1]';

export interface ContextManagedSession {
  getItems(limit?: number): Promise<AgentInputItem[]>;
  replaceItems(items: AgentInputItem[]): Promise<void>;
}

/** Legacy limits retained for old hosts and persisted run documents. */
export interface LegacyContextCompactionBudget {
  /** @deprecated Use maxInputTokens or the model context window instead. */
  maxItems?: number;
  /** @deprecated Use maxInputTokens or the model context window instead. */
  maxCharacters?: number;
  /** Retained in both modes to control how many recent items remain verbatim. */
  recentItems?: number;
  /** Retained in both modes to bound the summarizer input. */
  maxSummaryInputCharacters?: number;
}

/** Model-aware local compaction settings. */
export interface ContextCompactionBudget extends LegacyContextCompactionBudget {
  /** Explicit effective input-token ceiling; 0/unset uses the model profile. */
  maxInputTokens?: number;
}

export interface TokenEstimateCalibration {
  routeKey: string;
  factor: number;
  samples: number;
  updatedAt: string;
}

/** Model-route context metadata shared by local and provider-managed compaction. */
export interface ModelContextProfile {
  /** The model's total context window, consumed by the token-aware stage. */
  contextWindowTokens?: number;
  /** Input headroom reserved for the model's response. */
  reservedOutputTokens?: number;
  /** Extra input headroom kept as a safety margin. */
  safetyMarginTokens?: number;
  /** Automatically learned estimate correction for this model/API route. */
  tokenCalibration?: TokenEstimateCalibration;
  /** Local-compaction limits; token budget takes precedence when available. */
  compaction?: ContextCompactionBudget;
}

export const contextSummarySchema = z.object({
  summary: z.string().min(1),
  userPreferences: z.array(z.string()).default([]),
  durableFacts: z.array(z.string()).default([]),
  importantFiles: z.array(z.string()).default([]),
  openTasks: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
}).strict();

export type ContextSummary = z.infer<typeof contextSummarySchema>;

export type ContextSummarizer = (
  config: AgentConfig,
  olderItems: AgentInputItem[],
  recentItems: AgentInputItem[],
  signal?: AbortSignal,
  maxInputCharacters?: number,
) => Promise<ContextSummary>;

export interface ContextManagerOptions {
  /** New unified configuration entry point for context management. */
  modelContext?: ModelContextProfile;
  /** Legacy direct fields remain supported for callers and older tests. */
  /** @deprecated Use modelContext.compaction.maxInputTokens instead. */
  maxItems?: number;
  /** @deprecated Use modelContext.compaction.maxInputTokens instead. */
  maxCharacters?: number;
  /** Retained as a compaction-shaping option in both trigger modes. */
  recentItems?: number;
  /** Retained as a compaction-shaping option in both trigger modes. */
  maxSummaryInputCharacters?: number;
  signal?: AbortSignal;
  summarize?: ContextSummarizer;
}

export interface ResolvedContextCompactionPolicy {
  triggerMode: 'token_budget' | 'legacy_threshold';
  inputBudgetTokens?: number;
  legacy: Required<LegacyContextCompactionBudget>;
}

export interface ContextCompactionResult {
  compacted: boolean;
  beforeItems: number;
  afterItems: number;
  beforeCharacters: number;
  afterCharacters: number;
  beforeTokens?: number;
  afterTokens?: number;
  inputBudgetTokens?: number;
  triggerMode?: 'token_budget' | 'legacy_threshold';
  reason?: string;
  error?: string;
}

export const LEGACY_CONTEXT_COMPACTION_DEFAULTS: Required<LegacyContextCompactionBudget> = {
  maxItems: 48,
  maxCharacters: 80_000,
  recentItems: 16,
  maxSummaryInputCharacters: 60_000,
};

export async function ensureContextCompacted(
  session: ContextManagedSession,
  config: AgentConfig,
  options: ContextManagerOptions = {},
): Promise<ContextCompactionResult> {
  const items = await session.getItems();
  const beforeCharacters = estimateItemsCharacters(items);
  const modelContext = options.modelContext ?? config.modelContext;
  const policy = resolveContextCompactionPolicy(modelContext, options);
  const { inputBudgetTokens, triggerMode } = policy;
  const beforeTokens = inputBudgetTokens === undefined
    ? undefined
    : estimateItemsTokens(items, modelContext?.tokenCalibration);
  const { maxItems, maxCharacters } = policy.legacy;
  const tooManyItems = items.length > maxItems;
  const tooManyCharacters = beforeCharacters > maxCharacters;
  const tooManyTokens =
    inputBudgetTokens !== undefined &&
    beforeTokens !== undefined &&
    beforeTokens > inputBudgetTokens;
  const shouldCompact = inputBudgetTokens === undefined
    ? tooManyItems || tooManyCharacters
    : tooManyTokens;
  if (!shouldCompact) {
    return {
      compacted: false,
      beforeItems: items.length,
      afterItems: items.length,
      beforeCharacters,
      afterCharacters: beforeCharacters,
      beforeTokens,
      afterTokens: beforeTokens,
      inputBudgetTokens,
      triggerMode,
    };
  }

  const recentCount = Math.max(
    2,
    Math.min(items.length - 1, policy.legacy.recentItems),
  );
  const splitAt = Math.max(1, items.length - recentCount);
  const olderItems = items.slice(0, splitAt);
  const recentItems = items.slice(splitAt);
  if (!olderItems.length) {
    return {
      compacted: false,
      beforeItems: items.length,
      afterItems: items.length,
      beforeCharacters,
      afterCharacters: beforeCharacters,
      beforeTokens,
      afterTokens: beforeTokens,
      inputBudgetTokens,
      triggerMode,
      reason: 'history_contains_only_recent_items',
    };
  }

  try {
    const summarize = options.summarize ?? summarizeContextWithModel;
    const summary = await summarize(
      config,
      olderItems,
      recentItems,
      options.signal,
      policy.legacy.maxSummaryInputCharacters,
    );
    const compactedItems = [
      createSummaryItem(summary),
      ...recentItems,
    ];
    await session.replaceItems(compactedItems);
    const afterCharacters = estimateItemsCharacters(compactedItems);
    const afterTokens = inputBudgetTokens === undefined
      ? undefined
      : estimateItemsTokens(compactedItems, modelContext?.tokenCalibration);
    return {
      compacted: true,
      beforeItems: items.length,
      afterItems: compactedItems.length,
      beforeCharacters,
      afterCharacters,
      beforeTokens,
      afterTokens,
      inputBudgetTokens,
      triggerMode,
      reason: inputBudgetTokens === undefined
        ? [
          tooManyItems ? `items>${maxItems}` : '',
          tooManyCharacters ? `chars>${maxCharacters}` : '',
        ].filter(Boolean).join(',')
        : `tokens>${inputBudgetTokens}`,
    };
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) {
      return {
        compacted: false,
        beforeItems: items.length,
        afterItems: items.length,
        beforeCharacters,
        afterCharacters: beforeCharacters,
        beforeTokens,
        afterTokens: beforeTokens,
        inputBudgetTokens,
        triggerMode,
        reason: 'aborted',
      };
    }
    return {
      compacted: false,
      beforeItems: items.length,
      afterItems: items.length,
      beforeCharacters,
      afterCharacters: beforeCharacters,
      beforeTokens,
      afterTokens: beforeTokens,
      inputBudgetTokens,
      triggerMode,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

/**
 * Centralize the migration boundary between the token budget and the old
 * item/character thresholds. The old fields are intentionally still read,
 * but they cannot override a valid token budget.
 */
export function resolveContextCompactionPolicy(
  modelContext?: ModelContextProfile,
  options: Pick<
    ContextManagerOptions,
    'maxItems' | 'maxCharacters' | 'recentItems' | 'maxSummaryInputCharacters'
  > = {},
): ResolvedContextCompactionPolicy {
  const budget = modelContext?.compaction;
  const legacy = {
    maxItems: positiveIntegerOrDefault(
      options.maxItems ?? budget?.maxItems,
      LEGACY_CONTEXT_COMPACTION_DEFAULTS.maxItems,
    ),
    maxCharacters: positiveIntegerOrDefault(
      options.maxCharacters ?? budget?.maxCharacters,
      LEGACY_CONTEXT_COMPACTION_DEFAULTS.maxCharacters,
    ),
    recentItems: Math.max(
      2,
      positiveIntegerOrDefault(
        options.recentItems ?? budget?.recentItems,
        LEGACY_CONTEXT_COMPACTION_DEFAULTS.recentItems,
      ),
    ),
    maxSummaryInputCharacters: positiveIntegerOrDefault(
      options.maxSummaryInputCharacters ?? budget?.maxSummaryInputCharacters,
      LEGACY_CONTEXT_COMPACTION_DEFAULTS.maxSummaryInputCharacters,
    ),
  };
  const inputBudgetTokens = resolveInputTokenBudget(modelContext);
  return {
    triggerMode: inputBudgetTokens === undefined ? 'legacy_threshold' : 'token_budget',
    inputBudgetTokens,
    legacy,
  };
}

/**
 * Resolve the effective local input budget.
 *
 * An explicit compaction max wins when it is below the model-derived ceiling.
 * Invalid/insufficient model headroom returns undefined so old item/character
 * thresholds remain the safe compatibility path.
 */
export function resolveInputTokenBudget(
  profile?: ModelContextProfile,
): number | undefined {
  if (!profile) return undefined;

  const explicit = positiveInteger(profile.compaction?.maxInputTokens);
  const contextWindow = positiveInteger(profile.contextWindowTokens);
  let derived: number | undefined;
  if (contextWindow !== undefined) {
    const reservedOutput = nonNegativeInteger(profile.reservedOutputTokens);
    const safetyMargin = nonNegativeInteger(profile.safetyMarginTokens);
    const available = contextWindow - reservedOutput - safetyMargin;
    if (available <= 0) return undefined;
    derived = available;
  }

  if (explicit === undefined) return derived;
  if (derived === undefined) return explicit;
  return Math.min(explicit, derived);
}

export async function summarizeContextWithModel(
  config: AgentConfig,
  olderItems: AgentInputItem[],
  recentItems: AgentInputItem[],
  signal?: AbortSignal,
  maxInputCharacters = LEGACY_CONTEXT_COMPACTION_DEFAULTS.maxSummaryInputCharacters,
): Promise<ContextSummary> {
  signal?.throwIfAborted();
  const adapter = buildModelAdapter(config);
  const summarizer = new Agent({
    name: 'PLC Context Summarizer',
    model: adapter.model,
    outputType: contextSummarySchema,
    instructions:
      '你是长对话上下文压缩器，只做摘要，不执行工具。' +
      '把较早历史压缩成后续任务仍需要的事实、约束、用户偏好、重要文件、未完成事项和风险。' +
      '不要发明历史里没有的信息；不要保留寒暄、重复内容或已经无关的细节。' +
      '最近若干条原文会被完整保留，因此只摘要更早历史，并在摘要中承接已有的历史压缩摘要。' +
      '必须严格返回 schema，不要输出 markdown。',
  });
  const input = [
    {
      type: 'message',
      role: 'user',
      content: [
        '请压缩以下较早会话历史，供后续 PLC/工作区 Agent 继续使用。',
        '',
        '较早历史：',
        serializeItemsForSummary(olderItems, maxInputCharacters),
        '',
        '以下最近历史会被原样保留，你只需避免与它重复：',
        serializeItemsForSummary(recentItems, Math.min(12_000, Math.floor(maxInputCharacters / 4))),
      ].join('\n'),
    } as unknown as AgentInputItem,
  ];
  const tracingDisabled = !(adapter.provider === 'openai' && adapter.apiFormat === 'responses' && !config.baseUrl.trim());
  const result = await new Runner({ tracingDisabled }).run(summarizer, input, {
    stream: false,
    maxTurns: 1,
    signal,
  });
  return contextSummarySchema.parse(result.finalOutput);
}

export function createSummaryItem(summary: ContextSummary): AgentInputItem {
  return {
    type: 'message',
    role: 'system',
    content: renderContextSummary(summary),
  } as unknown as AgentInputItem;
}

export function renderContextSummary(summary: ContextSummary): string {
  const lines = [
    CONTEXT_SUMMARY_MARKER,
    '以下是较早会话历史的压缩摘要。它替代被压缩的原始消息；最近消息仍保留原文。',
    '',
    `总体摘要：${summary.summary}`,
    renderList('用户偏好/约束', summary.userPreferences),
    renderList('已确认事实', summary.durableFacts),
    renderList('重要文件/产物', summary.importantFiles),
    renderList('未完成事项', summary.openTasks),
    renderList('风险/注意点', summary.risks),
  ].filter((line) => line !== undefined && line !== '');
  return lines.join('\n');
}

export function estimateItemsCharacters(items: AgentInputItem[]): number {
  return items.reduce((total, item) => total + serializeItem(item).length, 0);
}

function renderList(title: string, values: string[]): string {
  const entries = values.map((value) => value.trim()).filter(Boolean);
  if (!entries.length) return `${title}：无`;
  return `${title}：\n${entries.map((entry) => `- ${entry}`).join('\n')}`;
}

function serializeItemsForSummary(items: AgentInputItem[], maxCharacters: number): string {
  const text = items
    .map((item, index) => `#${index + 1} ${serializeItemForTranscript(item)}`)
    .join('\n');
  return middleClip(text, maxCharacters);
}

function serializeItemForTranscript(item: AgentInputItem): string {
  const value = item as Record<string, unknown>;
  const type = typeof value.type === 'string' ? value.type : 'unknown';
  if (type === 'message' || typeof value.role === 'string') {
    const role = typeof value.role === 'string' ? value.role : 'unknown';
    return `${role}: ${middleClip(messageText(value.content), 4_000)}`;
  }
  if (type === 'function_call') {
    return `tool_call ${String(value.name ?? 'tool')}: ${middleClip(String(value.arguments ?? ''), 2_000)}`;
  }
  if (type === 'function_call_result') {
    return `tool_result ${String(value.name ?? 'tool')}: ${middleClip(messageText(value.output), 2_000)}`;
  }
  return `${type}: ${middleClip(serializeItem(item), 2_000)}`;
}

function serializeItem(item: AgentInputItem): string {
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function messageText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string') return text;
      }
      return serializeUnknown(part);
    }).join('');
  }
  return serializeUnknown(value);
}

function serializeUnknown(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function middleClip(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) return value;
  const half = Math.max(1, Math.floor((maxCharacters - 40) / 2));
  return `${value.slice(0, half)}\n...[中间省略 ${value.length - half * 2} 字符]...\n${value.slice(-half)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function positiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function nonNegativeInteger(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}
