import {
  OpenAIChatCompletionsModel,
} from "@openai/agents";
import OpenAI from "openai";
import type { AgentConfig } from "./agentConfig";
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
    return `${j.model} stream=${j.stream} tools=${tools} choice=${choice} parallel=${parallel} format=${format} ${chain}`.slice(
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
  const choice = Array.isArray(parsed.choices) && isJsonRecord(parsed.choices[0])
    ? parsed.choices[0]
    : undefined;
  const message = isJsonRecord(choice?.message) ? choice.message : undefined;
  const finish = typeof choice?.finish_reason === "string" ? choice.finish_reason : "-";
  const contentChars = message ? stringLength(message.content) : 0;
  const reasoningChars = message ? collectNonStreamReasoningChars(message) : 0;
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
    `${errorLine ? " ERROR=" + errorLine : ""}`;
  const emptyTail =
    !errorLine && contentChars === 0 && reasoningChars === 0 && rawToolCalls.length === 0
      ? text.slice(-500).replace(/\n/g, "⏎")
      : undefined;
  return { summary, toolArgs, emptyTail };
}

export function makeLoggingFetch(): unknown {
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const isChat = url.includes("/chat/completions");
    const sanitized = sanitizeChatCompletionRequestBody(init?.body);
    const requestInit = sanitized.repaired > 0
      ? { ...(init ?? {}), body: sanitized.body as RequestInit["body"] }
      : init;
    if (sanitized.repaired > 0) {
      agentLog(
        `[req-sanitize] 已修复非法工具参数 count=${sanitized.repaired} tools=${sanitized.toolNames.join(",") || "?"}，已用 {} 继续请求`,
      );
    }
    if (isChat) agentLog(`[req] ${summarizeOutgoing(requestInit?.body)}`);
    const resp = await fetch(input as never, requestInit as never);
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
        agentLog(nonStream.summary);
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
        `[resp] HTTP ${resp.status} 正文=${contentChars}字符 推理=${reasoningChars}字符 工具增量=${toolCallDeltas} finish=${finish}${errorLine ? " ERROR=" + errorLine : ""}`,
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

export function buildChatCompletionsModel(cfg: AgentConfig): GatewayGuardedModel {
  const key = JSON.stringify([cfg.baseUrl, cfg.apiKey]);
  let client = openAIClientCache.get(key);
  if (!client) {
    client = new OpenAI({
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
      fetch: makeLoggingFetch() as never,
    });
    openAIClientCache.set(key, client);
  }
  return new GatewayGuardedModel(client, cfg.model);
}

export function buildModelAdapter(
  cfg: AgentConfig,
  usageScope = "main_agent",
): ModelAdapter {
  return createModelAdapter({ ...cfg, usageScope }, {
    fetchImpl: makeLoggingFetch() as typeof fetch,
    createChatCompletionsModel: () => {
      // Keep the existing guarded gateway implementation unchanged. An
      // explicit Chat Completions selection without a custom endpoint uses
      // the SDK model directly and is outside the gateway watchdog path.
      if (!cfg.baseUrl) {
        const client = new OpenAI({
          apiKey: cfg.apiKey,
          fetch: makeLoggingFetch() as never,
        });
        return new OpenAIChatCompletionsModel(client, cfg.model);
      }
      return buildChatCompletionsModel(cfg);
    },
  });
}
