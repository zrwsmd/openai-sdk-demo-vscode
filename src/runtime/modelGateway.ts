import {
  OpenAIChatCompletionsModel,
} from "@openai/agents";
import OpenAI from "openai";
import { createHash } from "node:crypto";
import type { AgentConfig, PromptCacheSettings } from "./agentConfig";
import {
  createModelAdapter,
  type ModelAdapter,
} from "./modelAdapter";

/**
 * Chat Completions gateways are allowed to differ in optional capabilities.
 * Keep the negotiation state on each model instance because it belongs to one
 * agent run, while the underlying OpenAI client remains reusable.
 */
export type GatewayStructuredToolChoiceSupport =
  | "unknown"
  | "supported"
  | "unsupported";

export type GatewayParallelToolCallsSupport =
  | "unknown"
  | "supported"
  | "unsupported";

/** 网关连续返回空 completion(无任何内容/工具)时抛出,用于截停 SDK 的无限重试 */
export class EmptyGatewayResponseError extends Error {
  constructor() {
    super(
      '模型连续返回空响应:网关在收到工具结果(或首次请求)后返回了"空内容完成"。已自动停止重试。',
    );
    this.name = "EmptyGatewayResponseError";
  }
}

let logger: (line: string) => void = () => {};

export function agentLog(line: string): void {
  logger(line);
}

export function setAgentLogger(fn: (line: string) => void): void {
  logger = fn;
}

/**
 * 带"空回复熔断"的 chat_completions 模型。
 *
 * 背景:部分 OpenAI 兼容网关(尤其套壳推理模型)会返回 `finish_reason=stop` 但 content 为空的
 * completion;SDK 把这种响应当作"未完成"而反复重发同一请求,直到烧满 maxTurns。时间轴上的
 * 看门狗追不上响应飞快的网关(实测 10 连发仅 84ms),所以在模型层同步归因:
 * 一次响应若既无内容增量、最终 output 也为空 → 记 1 次空回复;连续 2 次即抛错截停。
 */
export class GatewayGuardedModel extends OpenAIChatCompletionsModel {
  private emptyStreak = 0;
  private requiredToolOnce?: string;
  private structuredToolChoiceSupport: GatewayStructuredToolChoiceSupport =
    "unknown";
  private parallelToolCallsSupport: GatewayParallelToolCallsSupport = "unknown";

  /** 每轮用户消息开始时清零,避免跨轮误伤 */
  resetEmptyStreak(): void {
    this.emptyStreak = 0;
    this.requiredToolOnce = undefined;
  }

  requireToolOnce(toolName: string): void {
    this.requiredToolOnce = toolName;
  }

  get structuredToolChoiceCapability(): GatewayStructuredToolChoiceSupport {
    return this.structuredToolChoiceSupport;
  }

  get parallelToolCallsCapability(): GatewayParallelToolCallsSupport {
    return this.parallelToolCallsSupport;
  }

  private async *streamWithCapabilityNegotiation(
    effectiveRequest: any,
    fallbackRequest: any,
    shouldNegotiate: boolean,
    requiredTool?: string,
  ): AsyncGenerator<any> {
    if (!shouldNegotiate) {
      let sawEvent = false;
      try {
        for await (const ev of super.getStreamedResponse(
          effectiveRequest,
        ) as AsyncIterable<any>) {
          sawEvent = true;
          if (
            this.parallelToolCallsSupport === "unknown" &&
            hasParallelToolCalls(effectiveRequest)
          ) {
            this.parallelToolCallsSupport = "supported";
            agentLog("[capability] gateway supports parallel_tool_calls");
          }
          yield ev;
        }
      } catch (error) {
        if (!sawEvent && isParallelToolCallsConflict(error)) {
          this.parallelToolCallsSupport = "unsupported";
          agentLog(
            "[capability] gateway rejected parallel_tool_calls; retrying without it",
          );
          for await (const ev of super.getStreamedResponse(
            withoutParallelToolCalls(effectiveRequest),
          ) as AsyncIterable<any>) {
            yield ev;
          }
          return;
        }
        throw error;
      }
      return;
    }

    let sawEvent = false;
    let sawRequiredTool = false;
    const bufferedEvents: any[] = [];
    try {
      for await (const ev of super.getStreamedResponse(
        effectiveRequest,
      ) as AsyncIterable<any>) {
        sawEvent = true;
        if (
          this.parallelToolCallsSupport === "unknown" &&
          hasParallelToolCalls(effectiveRequest)
        ) {
          this.parallelToolCallsSupport = "supported";
          agentLog("[capability] gateway supports parallel_tool_calls");
        }
        if (!sawRequiredTool) {
          bufferedEvents.push(ev);
          sawRequiredTool =
            requiredTool !== undefined &&
            hasRequiredToolCallEvent(ev, requiredTool);
          if (sawRequiredTool) {
            for (const bufferedEvent of bufferedEvents) yield bufferedEvent;
            bufferedEvents.length = 0;
          }
        } else {
          yield ev;
        }
      }

      if (!sawRequiredTool) {
        this.structuredToolChoiceSupport = "unsupported";
        agentLog(
          "[capability] gateway accepted response_format + tool_choice but did not produce the required tool call; retrying without response_format",
        );
        for await (const ev of super.getStreamedResponse(
          fallbackRequest,
        ) as AsyncIterable<any>) {
          yield ev;
        }
        return;
      }

      if (sawEvent && this.structuredToolChoiceSupport === "unknown") {
        this.structuredToolChoiceSupport = "supported";
        agentLog("[capability] gateway supports response_format + tool_choice");
      }
      for (const bufferedEvent of bufferedEvents) yield bufferedEvent;
    } catch (error) {
      if (!sawEvent && isParallelToolCallsConflict(error)) {
        this.parallelToolCallsSupport = "unsupported";
        agentLog(
          "[capability] gateway rejected parallel_tool_calls; retrying without it",
        );
        for await (const ev of this.streamWithCapabilityNegotiation(
          withoutParallelToolCalls(effectiveRequest),
          withoutParallelToolCalls(fallbackRequest),
          shouldNegotiate,
          requiredTool,
        ) as AsyncIterable<any>) {
          yield ev;
        }
        return;
      }
      if (
        !shouldNegotiate ||
        sawEvent ||
        !isStructuredToolChoiceConflict(error)
      ) {
        throw error;
      }
      this.structuredToolChoiceSupport = "unsupported";
      agentLog(
        "[capability] gateway rejected response_format + tool_choice; retrying tool request without response_format",
      );
      for await (const ev of super.getStreamedResponse(
        fallbackRequest,
      ) as AsyncIterable<any>) {
        yield ev;
      }
    }
  }

  async *getStreamedResponse(request: any): AsyncGenerator<any> {
    const requiredTool = this.requiredToolOnce;
    this.requiredToolOnce = undefined;
    const forcedRequest = requiredTool
      ? {
          ...request,
          modelSettings: {
            ...(request.modelSettings ?? {}),
            toolChoice: requiredTool,
          },
        }
      : request;
    const shouldNegotiate = Boolean(
      requiredTool && hasStructuredOutput(request.outputType),
    );
    const structuredEffectiveRequest =
      shouldNegotiate && this.structuredToolChoiceSupport === "unsupported"
        ? withoutStructuredOutput(forcedRequest)
        : forcedRequest;
    const effectiveRequest =
      this.parallelToolCallsSupport === "unsupported"
        ? withoutParallelToolCalls(structuredEffectiveRequest)
        : structuredEffectiveRequest;
    const fallbackRequest =
      this.parallelToolCallsSupport === "unsupported"
        ? withoutParallelToolCalls(withoutStructuredOutput(forcedRequest))
        : withoutStructuredOutput(forcedRequest);
    let sawOutput = false;
    for await (const ev of this.streamWithCapabilityNegotiation(
      effectiveRequest,
      fallbackRequest,
      shouldNegotiate,
      requiredTool,
    ) as AsyncIterable<any>) {
      // chat_completions 下 SDK 只透出 response_started/model/output_text_delta,没有终结的
      // model_response 事件,所以直接看原始 chunk 的 delta:有正文或 tool_calls 就不算空回复
      if (ev?.type === "output_text_delta") sawOutput = true;
      const delta =
        ev?.event?.choices?.[0]?.delta ?? ev?.providerData?.choices?.[0]?.delta;
      if (delta && (delta.content || delta.tool_calls)) sawOutput = true;
      const out = ev?.response?.output;
      if (Array.isArray(out) && out.length > 0) sawOutput = true;
      yield ev;
    }
    this.emptyStreak = sawOutput ? 0 : this.emptyStreak + 1;
    if (this.emptyStreak >= 2) {
      this.emptyStreak = 0;
      throw new EmptyGatewayResponseError();
    }
  }
}

function hasStructuredOutput(outputType: unknown): boolean {
  return (
    outputType !== undefined && outputType !== null && outputType !== "text"
  );
}

function withoutStructuredOutput(request: any): any {
  return {
    ...request,
    outputType: "text",
  };
}

function hasParallelToolCalls(request: any): boolean {
  return request?.modelSettings?.parallelToolCalls === true;
}

function withoutParallelToolCalls(request: any): any {
  const { parallelToolCalls: _parallelToolCalls, ...modelSettings } =
    request?.modelSettings ?? {};
  return {
    ...request,
    modelSettings,
  };
}

function hasRequiredToolCallEvent(
  event: any,
  requiredTool: string,
): boolean {
  const raw = event?.event ?? event?.data;
  const choices = Array.isArray(raw?.choices) ? raw.choices : [];
  for (const choice of choices) {
    const toolCalls = Array.isArray(choice?.delta?.tool_calls)
      ? choice.delta.tool_calls
      : [];
    if (
      toolCalls.some(
        (call: any) =>
          call?.function?.name === requiredTool || call?.name === requiredTool,
      )
    ) {
      return true;
    }
  }

  const output = event?.response?.output ?? event?.data?.response?.output;
  return (
    Array.isArray(output) &&
    output.some(
      (item: any) =>
        (item?.type === "function_call" || item?.type === "tool_call") &&
        item?.name === requiredTool,
    )
  );
}

function isStructuredToolChoiceConflict(error: unknown): boolean {
  const value = error as {
    status?: unknown;
    message?: unknown;
    error?: { message?: unknown; code?: unknown };
    body?: { error?: { message?: unknown; code?: unknown } };
    response?: { data?: { error?: { message?: unknown; code?: unknown } } };
  };
  const status = typeof value?.status === "number" ? value.status : undefined;
  const text = [
    value?.message,
    value?.error?.message,
    value?.error?.code,
    value?.body?.error?.message,
    value?.body?.error?.code,
    value?.response?.data?.error?.message,
    value?.response?.data?.error?.code,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  if (status !== undefined && status !== 400 && status !== 422) return false;
  const mentionsFormat =
    /response[_ ]?format|json[_ -]?schema|structured output/.test(text);
  const mentionsToolChoice =
    /tool[_ ]?choice|function call|tool call|tools/.test(text);
  const describesConflict =
    /not supported|unsupported|cannot|can't|invalid|incompatible|conflict|not allowed|does not allow|only/.test(
      text,
    );
  return mentionsFormat && mentionsToolChoice && describesConflict;
}

function isParallelToolCallsConflict(error: unknown): boolean {
  const value = error as {
    status?: unknown;
    message?: unknown;
    error?: { message?: unknown; code?: unknown };
    body?: { error?: { message?: unknown; code?: unknown } };
    response?: { data?: { error?: { message?: unknown; code?: unknown } } };
  };
  const status = typeof value?.status === "number" ? value.status : undefined;
  const text = [
    value?.message,
    value?.error?.message,
    value?.error?.code,
    value?.body?.error?.message,
    value?.body?.error?.code,
    value?.response?.data?.error?.message,
    value?.response?.data?.error?.code,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  if (status !== undefined && status !== 400 && status !== 422) return false;
  const mentionsParallelTools =
    /parallel[_ -]?tool[_ -]?calls|parallel tool calls/.test(text);
  const describesConflict =
    /not supported|unsupported|unknown|unrecognized|invalid|not allowed|does not allow|extra fields|unexpected/.test(
      text,
    );
  return mentionsParallelTools && describesConflict;
}

// ---------- 网关原始报文诊断(写入 "PLC Agent" 输出面板) ----------
// 排查"模型不返回总结"这类问题:把每次发给网关的消息结构、每次响应 SSE 的解析摘要
// (正文/推理/工具调用字符数、finish_reason、错误体)全部留痕,复现一次即可定位。
function requestBodyText(body: unknown): string | undefined {
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
  if (ArrayBuffer.isView(body)) {
    return new TextDecoder().decode(
      new Uint8Array(body.buffer as ArrayBuffer, body.byteOffset, body.byteLength),
    );
  }
  return undefined;
}

function summarizeOutgoing(body: unknown): string {
  try {
    const text = requestBodyText(body);
    const j = (text !== undefined ? JSON.parse(text) : body) as {
      model?: string;
      stream?: boolean;
      messages?: {
        role: string;
        content?: unknown;
        tool_calls?: { function?: { name?: string } }[];
      }[];
      tools?: { function?: { name?: string } }[];
      tool_choice?: unknown;
      parallel_tool_calls?: unknown;
      response_format?: { type?: string; json_schema?: { name?: string } };
      prompt_cache_options?: { ttl?: string; mode?: string };
      prompt_cache_retention?: string | null;
    };
    const chain = (j.messages ?? [])
      .map((m) =>
        m.role === "assistant" && m.tool_calls?.length
          ? `assistant(tool_calls:${m.tool_calls.map((t) => t.function?.name).join("|")})`
          : `${m.role}(len=${typeof m.content === "string" ? m.content.length : "-"})`,
      )
      .join(" ");
    const tools =
      (j.tools ?? [])
        .map((tool) => tool.function?.name)
        .filter(Boolean)
        .join("|") || "-";
    const choice =
      typeof j.tool_choice === "string"
        ? j.tool_choice
        : j.tool_choice
          ? JSON.stringify(j.tool_choice)
          : "-";
    const format = j.response_format?.type
      ? `${j.response_format.type}${j.response_format.json_schema?.name ? `:${j.response_format.json_schema.name}` : ""}`
      : "-";
    const parallel =
      typeof j.parallel_tool_calls === "boolean"
        ? String(j.parallel_tool_calls)
        : "-";
    const promptCache = j.prompt_cache_options
      ? `${j.prompt_cache_options.mode ?? "implicit"}/${j.prompt_cache_options.ttl ?? "-"}`
      : j.prompt_cache_retention
        ? `retention/${j.prompt_cache_retention}`
        : "-";
    return `${j.model} stream=${j.stream} tools=${tools} choice=${choice} parallel=${parallel} format=${format} cache=${promptCache} ${chain}`.slice(
      0,
      900,
    );
  } catch {
    return "(请求体无法解析)";
  }
}

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeToolArguments(raw: unknown): {
  value: string;
  repaired: boolean;
} {
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isJsonRecord(parsed)) return { value: raw, repaired: false };
    } catch {
      // A provider may leave a partial argument string after a failed stream.
    }
  }
  return { value: "{}", repaired: true };
}

/**
 * Prevent malformed function-call history from poisoning the next
 * OpenAI-compatible request. This is intentionally independent of tools and
 * workflows: every function call must carry a JSON object on the wire.
 */
export function sanitizeChatCompletionRequestBody(body: unknown): {
  body: unknown;
  repaired: number;
  toolNames: string[];
} {
  const text = requestBodyText(body);
  if (text === undefined) {
    return { body, repaired: 0, toolNames: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { body, repaired: 0, toolNames: [] };
  }
  if (!isJsonRecord(parsed)) return { body, repaired: 0, toolNames: [] };

  let repaired = 0;
  const toolNames: string[] = [];
  let next = parsed;

  const messages = parsed.messages;
  if (Array.isArray(messages)) {
    let nextMessages: unknown[] | undefined;
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
      const message = messages[messageIndex];
      if (!isJsonRecord(message) || !Array.isArray(message.tool_calls)) continue;

      let nextCalls: unknown[] | undefined;
      for (let callIndex = 0; callIndex < message.tool_calls.length; callIndex += 1) {
        const call = message.tool_calls[callIndex];
        if (!isJsonRecord(call) || !isJsonRecord(call.function)) continue;

        const normalized = normalizeToolArguments(call.function.arguments);
        if (!normalized.repaired) continue;
        repaired += 1;
        const name = typeof call.function.name === "string" && call.function.name
          ? call.function.name
          : "?";
        toolNames.push(name);
        nextCalls ??= message.tool_calls.slice();
        nextCalls[callIndex] = {
          ...call,
          function: { ...call.function, arguments: normalized.value },
        };
      }

      if (nextCalls) {
        nextMessages ??= messages.slice();
        nextMessages[messageIndex] = { ...message, tool_calls: nextCalls };
      }
    }
    if (nextMessages) next = { ...next, messages: nextMessages };
  }

  // Also cover Responses-style function_call history when this shared fetch
  // is used by an adapter that sends `input` instead of `messages`.
  const input = parsed.input;
  if (Array.isArray(input)) {
    let nextInput: unknown[] | undefined;
    for (let itemIndex = 0; itemIndex < input.length; itemIndex += 1) {
      const item = input[itemIndex];
      if (!isJsonRecord(item) || item.type !== "function_call") continue;
      const normalized = normalizeToolArguments(item.arguments);
      if (!normalized.repaired) continue;
      repaired += 1;
      const name = typeof item.name === "string" && item.name ? item.name : "?";
      toolNames.push(name);
      nextInput ??= input.slice();
      nextInput[itemIndex] = { ...item, arguments: normalized.value };
    }
    if (nextInput) next = { ...next, input: nextInput };
  }

  return repaired === 0
    ? { body, repaired: 0, toolNames: [] }
    : { body: JSON.stringify(next), repaired, toolNames };
}

function chatRequestUsesStream(body: unknown): boolean {
  const text = requestBodyText(body);
  if (text === undefined) return true;
  try {
    const parsed = JSON.parse(text) as unknown;
    return isJsonRecord(parsed) ? parsed.stream === true : true;
  } catch {
    return true;
  }
}

type ToolArgumentLog = { id?: string; name?: string; args: string };

function stringLength(value: unknown): number {
  return typeof value === "string" ? value.length : 0;
}

function previewResponseValue(value: unknown, limit = 800): string {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\s+/g, " ").slice(0, limit);
}

function collectNonStreamReasoningChars(message: JsonRecord): number {
  const providerFields = isJsonRecord(message.provider_specific_fields)
    ? message.provider_specific_fields
    : undefined;
  const reasoning =
    message.reasoning_content ??
    message.reasoning ??
    providerFields?.reasoning_content ??
    providerFields?.reasoning;
  return stringLength(reasoning);
}

function finiteUsageNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/u.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
  }
  return undefined;
}

type UsageMetric = {
  present: boolean;
  value: number;
};

function usageMetricSources(usage: JsonRecord): JsonRecord[] {
  const sources = [usage];
  for (const key of [
    "prompt_tokens_details",
    "input_tokens_details",
    "cache_details",
    "cache_usage",
    "prompt_cache",
    "prompt_cache_details",
  ]) {
    const value = usage[key];
    if (isJsonRecord(value)) sources.push(value);
  }
  return sources;
}

function readUsageMetric(
  sources: readonly JsonRecord[],
  keys: readonly string[],
): UsageMetric {
  let present = false;
  for (const source of sources) {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      present = true;
      const value = finiteUsageNumber(source[key]);
      if (value !== undefined) return { present: true, value };
    }
  }
  return { present, value: 0 };
}

function cacheUsageSnapshot(usage: unknown): {
  present: boolean;
  inputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  totalInputTokens: number;
} {
  if (!isJsonRecord(usage)) {
    return {
      present: false,
      inputTokens: 0,
      cachedTokens: 0,
      cacheWriteTokens: 0,
      totalInputTokens: 0,
    };
  }

  const sources = usageMetricSources(usage);
  const promptTokens = readUsageMetric([usage], ["prompt_tokens"]);
  const inputTokensMetric = readUsageMetric([usage], ["input_tokens"]);
  const cachedMetric = readUsageMetric(sources, [
    "cache_read_input_tokens",
    "cached_tokens",
    "cache_read_tokens",
    "prompt_cache_hit_tokens",
  ]);
  const uncachedMetric = readUsageMetric(sources, [
    "prompt_cache_miss_tokens",
    "cache_miss_tokens",
    "uncached_tokens",
  ]);
  const cacheWriteMetric = readUsageMetric(sources, [
    "cache_creation_input_tokens",
    "cache_write_input_tokens",
    "cache_creation_tokens",
    "cache_write_tokens",
    "prompt_cache_write_tokens",
  ]);
  const directAnthropicCacheFields = readUsageMetric([usage], [
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
    "cache_write_input_tokens",
  ]).present;
  const inputTokens = promptTokens.present
    ? promptTokens.value
    : inputTokensMetric.present
      ? inputTokensMetric.value
      : uncachedMetric.value;
  const totalInputTokens = promptTokens.present
    ? promptTokens.value
    : uncachedMetric.present
      ? uncachedMetric.value + cachedMetric.value + cacheWriteMetric.value
      : inputTokensMetric.present
      ? directAnthropicCacheFields
        ? inputTokensMetric.value + cachedMetric.value + cacheWriteMetric.value
        : inputTokensMetric.value
      : cachedMetric.value + cacheWriteMetric.value;

  return {
    present: cachedMetric.present || cacheWriteMetric.present || uncachedMetric.present,
    inputTokens,
    cachedTokens: cachedMetric.value,
    cacheWriteTokens: cacheWriteMetric.value,
    totalInputTokens,
  };
}

function cacheUsageState(snapshot: {
  present: boolean;
  inputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  totalInputTokens: number;
}): "hit" | "write" | "miss" | "unknown" {
  if (!snapshot.present) return "unknown";
  if (snapshot.cachedTokens > 0) return "hit";
  if (snapshot.cacheWriteTokens > 0) return "write";
  return "miss";
}

function formatCacheUsageSnapshot(snapshot: {
  present: boolean;
  inputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  totalInputTokens: number;
}): string {
  if (!snapshot.present) return "cache=unreported,state=unknown";
  const denominator = snapshot.totalInputTokens > 0
    ? snapshot.totalInputTokens
    : snapshot.inputTokens;
  const hitRate = denominator > 0
    ? `${((snapshot.cachedTokens / denominator) * 100).toFixed(1)}%`
    : "-";
  const totalSuffix = snapshot.totalInputTokens !== snapshot.inputTokens
    ? `,total:${snapshot.totalInputTokens}`
    : "";
  return (
    `cache=cached:${snapshot.cachedTokens},write:${snapshot.cacheWriteTokens}` +
    `,input:${snapshot.inputTokens},hit:${hitRate},state=${cacheUsageState(snapshot)}` +
    totalSuffix
  );
}

function cacheUsageSuffix(usage: unknown): string {
  const snapshot = cacheUsageSnapshot(usage);
  return snapshot.present ? ` ${formatCacheUsageSnapshot(snapshot)}` : "";
}

/**
 * The agent keeps stable instructions before this marker and puts
 * request/run-specific context after it. The marker is intentionally
 * human-readable because it is part of the model-facing system prompt.
 */
export const PROMPT_CACHE_DYNAMIC_MARKER =
  "\n\n当前请求动态上下文（以下内容可能随本轮状态变化）：";

export interface PromptCacheFingerprint {
  prefix: string;
  full: string;
  system: string;
  systemPrefix: string;
  systemDynamic: string;
  toolset: string;
  tools: number;
  messages: number;
  prefixMessages: number;
}

function canonicalFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalFingerprintValue(item));
  }
  if (isJsonRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalFingerprintValue(value[key])]),
    );
  }
  return value;
}

function fingerprintValue(value: unknown): string {
  const serialized = JSON.stringify(canonicalFingerprintValue(value)) ?? "null";
  return createHash("sha256").update(serialized, "utf8").digest("hex").slice(0, 12);
}

function textFromPromptValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const text = value
      .map((item) => textFromPromptValue(item))
      .filter((item): item is string => item !== undefined)
      .join("");
    return text || undefined;
  }
  if (!isJsonRecord(value)) return undefined;
  if (typeof value.text === "string") return value.text;
  if ("content" in value) return textFromPromptValue(value.content);
  return undefined;
}

export function createPromptCacheFingerprint(body: unknown): PromptCacheFingerprint | undefined {
  const text = requestBodyText(body);
  if (text === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
  if (!isJsonRecord(parsed)) return undefined;

  const tools = Array.isArray(parsed.tools) ? parsed.tools : [];
  const system = parsed.system ?? parsed.instructions ?? null;
  const messages = Array.isArray(parsed.messages)
    ? parsed.messages
    : Array.isArray(parsed.input)
      ? parsed.input
      : parsed.input === undefined
        ? []
        : [parsed.input];
  const explicitSystem = parsed.system ?? parsed.instructions;
  const systemMessages = messages.filter((message) =>
    isJsonRecord(message) &&
    (message.role === "system" || message.role === "developer"),
  );
  const systemValue = explicitSystem !== undefined
    ? explicitSystem
    : systemMessages;
  const systemText = textFromPromptValue(systemValue) ?? "";
  const dynamicMarkerIndex = systemText.indexOf(PROMPT_CACHE_DYNAMIC_MARKER);
  const systemPrefixValue = dynamicMarkerIndex >= 0
    ? systemText.slice(0, dynamicMarkerIndex)
    : systemValue;
  const systemDynamicValue = dynamicMarkerIndex >= 0
    ? systemText.slice(dynamicMarkerIndex + PROMPT_CACHE_DYNAMIC_MARKER.length)
    : null;
  const prefixMessages = messages.length > 0
    ? messages.slice(0, -1)
    : [];
  const stablePrefix = { tools, system: systemValue };

  return {
    prefix: fingerprintValue({
      ...stablePrefix,
      messages: prefixMessages,
    }),
    full: fingerprintValue({
      ...stablePrefix,
      messages,
    }),
    system: fingerprintValue(systemValue),
    systemPrefix: fingerprintValue(systemPrefixValue),
    systemDynamic: fingerprintValue(systemDynamicValue),
    toolset: fingerprintValue(tools),
    tools: tools.length,
    messages: messages.length,
    prefixMessages: prefixMessages.length,
  };
}

export function formatPromptCacheFingerprint(
  fingerprint: PromptCacheFingerprint,
): string {
  return (
    `prefix=${fingerprint.prefix} full=${fingerprint.full}` +
    ` system=${fingerprint.system} systemPrefix=${fingerprint.systemPrefix}` +
    ` systemDynamic=${fingerprint.systemDynamic}` +
    ` toolset=${fingerprint.toolset} tools=${fingerprint.tools}` +
    ` messages=${fingerprint.messages} prefixMessages=${fingerprint.prefixMessages}`
  );
}

export function summarizeNonStreamChatCompletionResponse(
  status: number,
  text: string,
): { summary: string; toolArgs: ToolArgumentLog[]; emptyTail?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return {
      summary: `[resp] HTTP ${status} 非流式响应无法解析`,
      toolArgs: [],
      emptyTail: text.slice(-500).replace(/\n/g, "⏎"),
    };
  }
  if (!isJsonRecord(parsed)) {
    return {
      summary: `[resp] HTTP ${status} 非流式响应不是 JSON 对象`,
      toolArgs: [],
      emptyTail: text.slice(-500).replace(/\n/g, "⏎"),
    };
  }

  const errorLine = parsed.error ? JSON.stringify(parsed.error).slice(0, 300) : "";
  const cacheSuffix = cacheUsageSuffix(
    parsed.usage ??
      (isJsonRecord(parsed.response) ? parsed.response.usage : undefined) ??
      parsed.usage_metadata,
  );
  const choice = Array.isArray(parsed.choices) && isJsonRecord(parsed.choices[0])
    ? parsed.choices[0]
    : undefined;
  const message = isJsonRecord(choice?.message) ? choice.message : undefined;
  const finish = typeof choice?.finish_reason === "string" ? choice.finish_reason : "-";
  const contentChars = message ? stringLength(message.content) : 0;
  const reasoningChars = message ? collectNonStreamReasoningChars(message) : 0;
  const outputPreview = message ? previewResponseValue(message.content) : "";
  const refusalPreview = message ? previewResponseValue(message.refusal, 240) : "";
  const rawToolCalls = message && Array.isArray(message.tool_calls)
    ? message.tool_calls
    : [];
  const toolArgs: ToolArgumentLog[] = [];
  for (const toolCall of rawToolCalls) {
    if (!isJsonRecord(toolCall) || !isJsonRecord(toolCall.function)) continue;
    const rawArgs = toolCall.function.arguments;
    toolArgs.push({
      id: typeof toolCall.id === "string" ? toolCall.id : undefined,
      name: typeof toolCall.function.name === "string"
        ? toolCall.function.name
        : undefined,
      args: typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs ?? null),
    });
  }

  const summary =
    `[resp] HTTP ${status} 非流式 正文=${contentChars}字符 ` +
    `推理=${reasoningChars}字符 工具调用=${rawToolCalls.length} finish=${finish}` +
    cacheSuffix +
    `${errorLine ? " ERROR=" + errorLine : ""}`;
  if (outputPreview || refusalPreview) {
    agentLog(
      `[resp-debug] 非流式输出 preview=${JSON.stringify(outputPreview)}` +
        `${refusalPreview ? ` refusal=${JSON.stringify(refusalPreview)}` : ""}`,
    );
  }
  const emptyTail =
    !errorLine && contentChars === 0 && reasoningChars === 0 && rawToolCalls.length === 0
      ? text.slice(-500).replace(/\n/g, "⏎")
      : undefined;
  return { summary, toolArgs, emptyTail };
}

type PromptCacheSupport = "unknown" | "supported" | "unsupported";

const PROMPT_CACHE_CAPABILITY_CACHE_LIMIT = 64;
const promptCacheCapabilityCache = new Map<string, PromptCacheSupport>();

function promptCacheCapabilityKey(input: string | URL, body: unknown): string {
  const url = String(input);
  const route = url.includes("/responses") ? "responses" : "chat_completions";
  let gateway = url;
  try {
    const parsedUrl = new URL(url);
    const endpoint = route === "responses" ? "/responses" : "/chat/completions";
    const endpointIndex = parsedUrl.pathname.lastIndexOf(endpoint);
    const basePath = endpointIndex >= 0
      ? parsedUrl.pathname.slice(0, endpointIndex)
      : parsedUrl.pathname;
    gateway = `${parsedUrl.origin}${basePath}`;
  } catch {
    gateway = url.replace(/\/(?:chat\/completions|responses)\/?$/, "");
  }

  let model = "?";
  const text = requestBodyText(body);
  if (text !== undefined) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (isJsonRecord(parsed) && typeof parsed.model === "string" && parsed.model.trim()) {
        model = parsed.model.trim();
      }
    } catch {
      /* 能力 key 不应阻断真实请求 */
    }
  }
  return `${gateway}|${route}|${model}`;
}

function rememberedPromptCacheSupport(key: string): PromptCacheSupport {
  return promptCacheCapabilityCache.get(key) ?? "unknown";
}

function rememberPromptCacheSupport(
  key: string,
  support: PromptCacheSupport,
): void {
  promptCacheCapabilityCache.delete(key);
  promptCacheCapabilityCache.set(key, support);
  while (promptCacheCapabilityCache.size > PROMPT_CACHE_CAPABILITY_CACHE_LIMIT) {
    const oldest = promptCacheCapabilityCache.keys().next().value;
    if (typeof oldest !== "string") break;
    promptCacheCapabilityCache.delete(oldest);
  }
}

interface LoggingFetchOptions {
  promptCache?: PromptCacheSettings;
}

function injectPromptCacheOptions(
  body: unknown,
  settings: PromptCacheSettings | undefined,
): { body: unknown; applied: boolean } {
  if (!settings?.enabled) return { body, applied: false };
  const text = requestBodyText(body);
  if (text === undefined) return { body, applied: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { body, applied: false };
  }
  if (!isJsonRecord(parsed)) {
    return { body, applied: false };
  }
  if (parsed.prompt_cache_options !== undefined) {
    return { body, applied: true };
  }
  return {
    body: JSON.stringify({
      ...parsed,
      prompt_cache_options: {
        ttl: settings.ttl ?? "30m",
      },
    }),
    applied: true,
  };
}

function withoutPromptCacheOptions(body: unknown): unknown {
  const text = requestBodyText(body);
  if (text === undefined) return body;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return body;
  }
  if (!isJsonRecord(parsed)) return body;
  const {
    prompt_cache_options: _promptCacheOptions,
    prompt_cache_retention: _promptCacheRetention,
    ...rest
  } = parsed;
  return JSON.stringify(rest);
}

function isPromptCacheConflictResponse(
  status: number,
  responseText: string,
): boolean {
  if (status !== 400 && status !== 422) return false;
  const text = responseText.toLowerCase();
  const mentionsCache =
    /prompt[_ -]?cache|cache[_ -]?(option|retention)|cached[_ -]?tokens/.test(
      text,
    );
  const describesConflict =
    /not supported|unsupported|unknown|unrecognized|invalid|not allowed|does not allow|extra fields|unexpected|additional properties/.test(
      text,
    );
  return mentionsCache && describesConflict;
}

export function makeLoggingFetch(options: LoggingFetchOptions = {}): unknown {
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const isChat = url.includes("/chat/completions");
    const isOpenAIRequest = isChat || url.includes("/responses");
    const capabilityKey = promptCacheCapabilityKey(input, init?.body);
    let promptCacheSupport = rememberedPromptCacheSupport(capabilityKey);
    const cachePrepared = isOpenAIRequest && promptCacheSupport !== "unsupported"
      ? injectPromptCacheOptions(init?.body, options.promptCache)
      : { body: init?.body, applied: false };
    const sanitized = sanitizeChatCompletionRequestBody(cachePrepared.body);
    const requestInit = sanitized.repaired > 0
      ? { ...(init ?? {}), body: sanitized.body as RequestInit["body"] }
      : cachePrepared.body !== init?.body
        ? { ...(init ?? {}), body: cachePrepared.body as RequestInit["body"] }
        : init;
    let promptFingerprint = cachePrepared.applied
      ? createPromptCacheFingerprint(requestInit?.body)
      : undefined;
    if (sanitized.repaired > 0) {
      agentLog(
        `[req-sanitize] 已修复非法工具参数 count=${sanitized.repaired} tools=${sanitized.toolNames.join(",") || "?"}，已用 {} 继续请求`,
      );
    }
    if (isChat) {
      agentLog(`[req] ${summarizeOutgoing(requestInit?.body)}`);
      if (promptFingerprint) {
        agentLog(`[prompt-cache] ${formatPromptCacheFingerprint(promptFingerprint)}`);
      }
    }
    if (cachePrepared.applied && promptCacheSupport !== "unknown") {
      agentLog(
        `[prompt-cache] 复用网关能力 route=${capabilityKey} state=${promptCacheSupport}`,
      );
    }
    let resp = await fetch(input as never, requestInit as never);
    let cacheAppliedForResponse = cachePrepared.applied;
    if (
      isOpenAIRequest &&
      cachePrepared.applied &&
      promptCacheSupport === "unknown" &&
      (resp.status === 400 || resp.status === 422)
    ) {
      const errorText = await resp.clone().text().catch(() => "");
      if (isPromptCacheConflictResponse(resp.status, errorText)) {
        promptCacheSupport = "unsupported";
        rememberPromptCacheSupport(capabilityKey, promptCacheSupport);
        cacheAppliedForResponse = false;
        agentLog(
          `[prompt-cache] 网关不支持 prompt_cache_options，status=${resp.status}，本次及后续请求自动关闭并重试`,
        );
        const fallbackBody = withoutPromptCacheOptions(requestInit?.body);
        const fallbackInit = {
          ...(requestInit ?? {}),
          body: fallbackBody as RequestInit["body"],
        };
        agentLog(`[req] ${summarizeOutgoing(fallbackBody)}`);
        promptFingerprint = createPromptCacheFingerprint(fallbackBody);
        if (promptFingerprint) {
          agentLog(`[prompt-cache] ${formatPromptCacheFingerprint(promptFingerprint)}`);
        }
        resp = await fetch(input as never, fallbackInit as never);
      }
    } else if (isOpenAIRequest && cachePrepared.applied && resp.ok) {
      if (promptCacheSupport !== "supported") {
        promptCacheSupport = "supported";
        rememberPromptCacheSupport(capabilityKey, promptCacheSupport);
        agentLog("[prompt-cache] 网关已接受 prompt_cache_options");
      }
    }
    if (!isChat || !resp.body) return resp;
    const contentType = (resp.headers.get("content-type") ?? "").toLowerCase();
    const requestUsesStream = contentType.includes("text/event-stream")
      || (!contentType.includes("application/json") && chatRequestUsesStream(requestInit?.body));
    const [userSide, tap] = resp.body.tee();
    void (async () => {
      let text = "";
      try {
        const reader = tap.getReader();
        for (;;) {
          const r = await reader.read();
          if (r.done) break;
          text += new TextDecoder().decode(r.value, { stream: true });
        }
      } catch (e) {
        agentLog(`[resp] 旁路读取异常: ${e}`);
        return;
      }
      const trimmed = text.trim();
      const looksLikeJsonObject = trimmed.startsWith("{");
      const looksLikeSse = trimmed.startsWith("data:") || trimmed.includes("\ndata:") || contentType.includes("text/event-stream");
      if (!requestUsesStream || (looksLikeJsonObject && !looksLikeSse)) {
        const nonStream = summarizeNonStreamChatCompletionResponse(resp.status, text);
        agentLog(
          nonStream.summary +
            (cacheAppliedForResponse && !nonStream.summary.includes(" cache=")
              ? " cache=unreported,state=unknown"
              : "") +
            (promptFingerprint
              ? ` prefix=${promptFingerprint.prefix} full=${promptFingerprint.full}`
              : ""),
        );
        for (const [idx, call] of nonStream.toolArgs.entries()) {
          const snippet =
            call.args.length > 500 ? call.args.slice(0, 500) + "…" : call.args;
          agentLog(
            `[toolargs] #${idx} name=${call.name ?? "?"} id=${call.id ?? "-"} args=${JSON.stringify(snippet)}`,
          );
        }
        if (nonStream.emptyTail) {
          agentLog(`[resp] 非流式空完成原文(尾部): ${nonStream.emptyTail}`);
        }
        return;
      }
      let contentChars = 0;
      let reasoningChars = 0;
      let toolCallDeltas = 0;
      let finish = "-";
      let errorLine = "";
      let cacheUsageSeen = false;
      let inputTokens = 0;
      let cachedTokens = 0;
      let cacheWriteTokens = 0;
      let totalInputTokens = 0;
      const toolCallArgs = new Map<
        number,
        { id?: string; name?: string; args: string }
      >();
      for (const line of text.split("\n")) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload) as {
            error?: unknown;
            usage?: unknown;
            response?: { usage?: unknown };
            choices?: {
              finish_reason?: string | null;
              delta?: {
                content?: unknown;
                reasoning_content?: unknown;
                reasoning?: unknown;
                tool_calls?: {
                  index?: unknown;
                  id?: unknown;
                  function?: { name?: unknown; arguments?: unknown };
                }[];
              };
            }[];
          };
          if (j.error) {
            errorLine = JSON.stringify(j.error).slice(0, 300);
            continue;
          }
          const cache = cacheUsageSnapshot(j.usage ?? j.response?.usage);
          if (cache.present) {
            cacheUsageSeen = true;
            inputTokens = Math.max(inputTokens, cache.inputTokens);
            cachedTokens = Math.max(cachedTokens, cache.cachedTokens);
            cacheWriteTokens = Math.max(cacheWriteTokens, cache.cacheWriteTokens);
            totalInputTokens = Math.max(totalInputTokens, cache.totalInputTokens);
          }
          const c = j.choices?.[0];
          if (c?.finish_reason) finish = c.finish_reason;
          const d = c?.delta ?? {};
          if (typeof d.content === "string") contentChars += d.content.length;
          const rz = (d.reasoning_content ?? d.reasoning) as string | undefined;
          if (typeof rz === "string") reasoningChars += rz.length;
          if (Array.isArray(d.tool_calls)) {
            toolCallDeltas += d.tool_calls.length;
            for (const tc of d.tool_calls) {
              const idx = typeof tc?.index === "number" ? tc.index : 0;
              const cur = toolCallArgs.get(idx) ?? { args: "" };
              if (typeof tc?.id === "string" && tc.id) cur.id = tc.id;
              if (typeof tc?.function?.name === "string" && tc.function.name)
                cur.name = tc.function.name;
              if (typeof tc?.function?.arguments === "string")
                cur.args += tc.function.arguments;
              toolCallArgs.set(idx, cur);
            }
          }
        } catch {
          /* 非 JSON 行忽略 */
        }
      }
      agentLog(
        `[resp] HTTP ${resp.status} 正文=${contentChars}字符 推理=${reasoningChars}字符 工具增量=${toolCallDeltas} finish=${finish}` +
          `${
            cacheUsageSeen
              ? ` ${formatCacheUsageSnapshot({
                  present: true,
                  inputTokens,
                  cachedTokens,
                  cacheWriteTokens,
                  totalInputTokens,
                })}`
              : cacheAppliedForResponse
                ? " cache=unreported,state=unknown"
                : ""
          }` +
          (promptFingerprint
            ? ` prefix=${promptFingerprint.prefix} full=${promptFingerprint.full}`
            : "") +
          `${errorLine ? " ERROR=" + errorLine : ""}`,
      );
      if (toolCallArgs.size > 0) {
        for (const [idx, call] of toolCallArgs) {
          const snippet =
            call.args.length > 500 ? call.args.slice(0, 500) + "…" : call.args;
          agentLog(
            `[toolargs] #${idx} name=${call.name ?? "?"} id=${call.id ?? "-"} args=${JSON.stringify(snippet)}`,
          );
        }
      }
      if (contentChars === 0 && reasoningChars === 0 && toolCallDeltas === 0) {
        agentLog(
          `[resp] 流式空完成原文(尾部): ${text.slice(-500).replace(/\n/g, "⏎")}`,
        );
      }
    })();
    return new Response(userSide, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  };
}

// The OpenAI client is configuration-only. Keep it reusable, but never cache
// GatewayGuardedModel because its watchdog/capability state belongs to a run.
const openAIClientCache = new Map<string, OpenAI>();

export function buildChatCompletionsModel(
  cfg: AgentConfig,
  promptCache: PromptCacheSettings | undefined,
): GatewayGuardedModel {
  const key = JSON.stringify([
    cfg.baseUrl,
    cfg.apiKey,
    promptCache?.enabled === true,
    promptCache?.ttl ?? "30m",
  ]);
  let client = openAIClientCache.get(key);
  if (!client) {
    client = new OpenAI({
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
      fetch: makeLoggingFetch({ promptCache }) as never,
    });
    openAIClientCache.set(key, client);
  }
  return new GatewayGuardedModel(client, cfg.model);
}

export function buildModelAdapter(
  cfg: AgentConfig,
  usageScope = "main_agent",
): ModelAdapter {
  const promptCache =
    usageScope === "main_agent" ? cfg.promptCache : undefined;
  return createModelAdapter({ ...cfg, usageScope }, {
    fetchImpl: makeLoggingFetch({
      promptCache,
    }) as typeof fetch,
    createChatCompletionsModel: () => {
      // Keep the existing guarded gateway implementation unchanged. An
      // explicit Chat Completions selection without a custom endpoint uses
      // the SDK model directly and is outside the gateway watchdog path.
      if (!cfg.baseUrl) {
        const client = new OpenAI({
          apiKey: cfg.apiKey,
          fetch: makeLoggingFetch({ promptCache }) as never,
        });
        return new OpenAIChatCompletionsModel(client, cfg.model);
      }
      return buildChatCompletionsModel(cfg, promptCache);
    },
  });
}
