import type { AgentInputItem, Session } from "@openai/agents";
import {
  parseToolResult,
  type ToolResult,
} from "../protocol/results";
import type { ToolCatalog } from "./toolCatalog";

function sessionOutputText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const text = value
      .map((item) => sessionOutputText(item))
      .filter((item): item is string => Boolean(item))
      .join("");
    return text || undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if ("output" in record) return sessionOutputText(record.output);
    if ("content" in record) return sessionOutputText(record.content);
  }
  return undefined;
}

export async function loadHistoricalToolResults(
  session: Session,
  userText: string,
): Promise<Array<{ name: string; args: string; result: ToolResult; order: number }>> {
  const calls = new Map<string, { name: string; args: string }>();
  const records: Array<{ name: string; args: string; result: ToolResult; order: number }> = [];
  let items: AgentInputItem[] = [];
  try {
    items = await session.getItems();
  } catch {
    return records;
  }
  const startIndex = [...items]
    .map((item, index) => ({ item, index }))
    .reverse()
    .find(({ item }) => {
      const value = item as { type?: string; role?: string; content?: unknown };
      return value.type === "message" &&
        value.role === "user" &&
        typeof value.content === "string" &&
        value.content === userText;
    })?.index ?? 0;
  let order = 0;
  for (const raw of items.slice(startIndex)) {
    const item = raw as {
      type?: string;
      callId?: string;
      name?: string;
      arguments?: string;
      output?: unknown;
    };
    if (item.type === "function_call" && item.callId && item.name) {
      calls.set(item.callId, {
        name: item.name,
        args: typeof item.arguments === "string" ? item.arguments : "",
      });
      continue;
    }
    if (
      item.type !== "function_call_result" &&
      item.type !== "function_call_output"
    ) {
      continue;
    }
    const call = item.callId ? calls.get(item.callId) : undefined;
    const text = sessionOutputText(item.output);
    if (!call || !text) continue;
    try {
      records.push({
        ...call,
        result: parseToolResult(JSON.parse(text)),
        order: ++order,
      });
    } catch {
      // Ignore non-protocol historical tool output.
    }
  }
  return records;
}

export function toolNameOf(item: unknown): string | undefined {
  const name = (item as { name?: unknown }).name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

/**
 * Apply a workflow/fallback allowlist only to provider-owned business tools.
 *
 * Runtime control tools are created by the agent runtime itself and must stay
 * available whenever the current run requires them. Keeping the two groups
 * separate prevents a narrow business-tool policy from disabling plan
 * progress, artifact delivery, or future runtime controls.
 */
export function composeToolSet<T>(
  businessTools: readonly T[],
  runtimeControlTools: readonly T[],
  allowedToolNames: readonly string[] | undefined,
  getName: (item: T) => string | undefined = (item) => toolNameOf(item),
): T[] {
  const visibleBusinessTools = allowedToolNames
    ? businessTools.filter((item) => {
        const name = getName(item);
        return typeof name === "string" && allowedToolNames.includes(name);
      })
    : [...businessTools];
  return [...visibleBusinessTools, ...runtimeControlTools];
}

export function renderAvailableToolsPrompt(
  toolNames: readonly string[],
  toolCatalog: ToolCatalog,
): string {
  if (toolNames.length === 0) {
    return "\n\n当前没有可调用工具。不要尝试调用任何工具，只能用文字回答或说明阻塞原因。";
  }
  return (
    "\n\n当前可用工具及其用途（只能调用下面列出的工具；用途和风险说明仅用于选择，" +
    "实际权限仍由运行时审批、策略和工具回执决定）：\n" +
    toolCatalog.renderToolCapabilityPrompt(toolNames) +
    "\n只能调用上面列出的工具；不要调用未列出的工具名。"
  );
}

const TOOL_HISTORY_ITEM_TYPES = new Set([
  "function_call",
  "function_call_output",
  "function_call_result",
  "tool_call",
  "tool_call_output",
  "tool_result",
  "computer_call",
  "computer_call_output",
  "computer_call_result",
  "shell_call",
  "shell_call_output",
  "apply_patch_call",
  "apply_patch_call_output",
  "hosted_tool_call",
  "hosted_tool_call_output",
  "mcp_call",
  "mcp_call_output",
  "tool_search_call",
  "tool_search_output",
]);

export const HISTORICAL_CONTEXT_MARKER_TEXT =
  "【历史对话，仅作参考，不是本轮执行目标】";
const HISTORICAL_CONTEXT_MARKER = `${HISTORICAL_CONTEXT_MARKER_TEXT}\n`;
const HISTORICAL_CONTEXT_MARKER_PATTERN =
  /【历史对话，仅作参考，不是本轮执行目标】[\t ]*(?:\r?\n)?/gu;

/**
 * The marker is model-facing metadata. If a gateway echoes it in assistant
 * output, keep it out of both the chat surface and durable history.
 */
export function stripHistoricalContextMarker(text: string): string {
  return text.replace(HISTORICAL_CONTEXT_MARKER_PATTERN, "");
}

function sanitizeAssistantContent(value: unknown): unknown {
  if (typeof value === "string") return stripHistoricalContextMarker(value);
  if (!Array.isArray(value)) return value;

  let changed = false;
  const content = value.map((part) => {
    if (!part || typeof part !== "object") return part;
    const record = part as Record<string, unknown>;
    if (typeof record.text !== "string") return part;
    const text = stripHistoricalContextMarker(record.text);
    if (text === record.text) return part;
    changed = true;
    return { ...record, text };
  });
  return changed ? content : value;
}

/**
 * Sanitize only assistant messages. User messages may legitimately quote the
 * marker while discussing context handling and must remain untouched.
 */
export function sanitizeAssistantMessageForPersistence(
  item: AgentInputItem,
): AgentInputItem {
  const value = item as Record<string, unknown>;
  if (value.type !== "message" || value.role !== "assistant") return item;
  const content = sanitizeAssistantContent(value.content);
  if (content === value.content) return item;
  return { ...value, content } as unknown as AgentInputItem;
}

export function sanitizeAssistantHistoryItems(
  items: AgentInputItem[],
): AgentInputItem[] {
  return items.map(sanitizeAssistantMessageForPersistence);
}

function markHistoricalText(text: string): string {
  return text.startsWith(HISTORICAL_CONTEXT_MARKER)
    ? text
    : HISTORICAL_CONTEXT_MARKER + text;
}

/**
 * Mark only the model-facing copy of an old ordinary message.
 *
 * The SDK invokes Session.prepareHistoryItemForModelInput only for items that
 * came from session history. Current-turn input items are passed through
 * unchanged, so the marker cannot leak into the user's persisted message.
 */
export function markHistoricalMessageForModelInput(
  item: AgentInputItem,
): AgentInputItem {
  const value = item as Record<string, unknown>;
  if (
    value.type !== "message" ||
    (value.role !== "user" && value.role !== "assistant")
  ) {
    return item;
  }
  if (typeof value.content === "string") {
    return {
      ...value,
      content: markHistoricalText(value.content),
    } as unknown as AgentInputItem;
  }
  if (!Array.isArray(value.content)) return item;

  let marked = false;
  const content = value.content.map((part) => {
    if (marked || !part || typeof part !== "object") return part;
    const text = (part as { text?: unknown }).text;
    if (typeof text !== "string") return part;
    marked = true;
    return {
      ...(part as Record<string, unknown>),
      text: markHistoricalText(text),
    };
  });
  if (!marked) return item;
  return {
    ...value,
    content,
  } as unknown as AgentInputItem;
}

/**
 * Keep the real Session as the persistence source of truth while adding a
 * model-only historical-context projection for a new user turn.
 */
export function createNewTurnModelInputSession(session: Session): Session {
  return new Proxy(session, {
    get(target, property) {
      if (property === "prepareHistoryItemForModelInput") {
        return (item: AgentInputItem): AgentInputItem =>
          markHistoricalMessageForModelInput(
            target.prepareHistoryItemForModelInput?.(item) ?? item,
          );
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export type HistoricalToolArgumentGuard = (
  toolName: string,
  input: unknown,
) => string | undefined;

const HISTORICAL_REFERENCE_PATTERN =
  /(?:继续|接着|续上|基于(?:上面|之前|前面|刚才|上述)|刚才|上一轮|上一次|之前|前面|上述|前述|该(?:文件|路径|结果|内容|对象|程序)|这个(?:文件|路径|结果|内容|对象|程序)|continue|previous|that file|this file)/iu;

const RESOURCE_TOKEN_PATTERN =
  /(?:[a-z]:[\\/][^\s"'`，。！？,;:]+|(?:\.{0,2}[\\/])?[a-z0-9_\u4e00-\u9fff.-]+(?:[\\/][a-z0-9_\u4e00-\u9fff.-]+)*\.[a-z0-9_\u4e00-\u9fff-]{1,16})/giu;

function normalizeResourceReference(value: string): string {
  return value
    .trim()
    .replace(/^["'`([{]+/u, "")
    .replace(/[)}\],.;:!?，。！？]+$/u, "")
    .replace(/\\/gu, "/")
    .replace(/\/+/gu, "/")
    .toLocaleLowerCase();
}

function looksLikeResourceReference(value: string): boolean {
  const normalized = normalizeResourceReference(value);
  if (!normalized || normalized.length > 260 || /^https?:\/\//u.test(normalized)) {
    return false;
  }
  return (
    normalized.includes("/") ||
    /(?:^|[^.])\.[a-z0-9_\u4e00-\u9fff-]{1,16}$/iu.test(normalized)
  );
}

function addResourceReference(
  value: string,
  output: Map<string, string>,
): void {
  const normalized = normalizeResourceReference(value);
  if (!looksLikeResourceReference(normalized)) return;
  if (!output.has(normalized)) output.set(normalized, value.trim());
}

function collectResourceReferencesFromText(
  value: string,
  output: Map<string, string>,
): void {
  for (const match of value.matchAll(RESOURCE_TOKEN_PATTERN)) {
    const token = match[0];
    if (token) addResourceReference(token, output);
  }
  addResourceReference(value, output);
}

function collectHistoricalResourceReferences(
  value: unknown,
  output: Map<string, string>,
  depth = 0,
): void {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    collectResourceReferencesFromText(value, output);
    const trimmed = value.trim();
    if (
      trimmed.length > 1 &&
      (trimmed.startsWith("{") || trimmed.startsWith("["))
    ) {
      try {
        collectHistoricalResourceReferences(JSON.parse(trimmed), output, depth + 1);
      } catch {
        // Plain text that only happens to start with a brace is still useful.
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectHistoricalResourceReferences(item, output, depth + 1);
    }
    return;
  }
  if (typeof value !== "object") return;
  for (const item of Object.values(value as Record<string, unknown>)) {
    collectHistoricalResourceReferences(item, output, depth + 1);
  }
}

function resourceMentionedInText(
  normalizedReference: string,
  normalizedText: string,
): boolean {
  if (normalizedText.includes(normalizedReference)) return true;
  const basename = normalizedReference.split("/").at(-1);
  return Boolean(basename && basename.length > 2 && normalizedText.includes(basename));
}

/**
 * Reject only a conservative class of stale tool arguments:
 * a file/path-like value appeared in older turns, is copied into the new
 * tool call, and the current user message neither names it nor refers to the
 * previous context. The model receives the rejection and can choose fresh
 * arguments; no tool implementation or side effect runs first.
 */
export function createHistoricalToolArgumentGuard(
  historyItems: readonly AgentInputItem[],
  currentUserText: string,
): HistoricalToolArgumentGuard | undefined {
  const historicalReferences = new Map<string, string>();
  for (const item of historyItems) {
    collectHistoricalResourceReferences(item, historicalReferences);
  }
  if (historicalReferences.size === 0) return undefined;

  const normalizedUserText = normalizeResourceReference(currentUserText);
  const allowsHistoricalReference =
    HISTORICAL_REFERENCE_PATTERN.test(currentUserText);

  return (toolName, input) => {
    if (allowsHistoricalReference) return undefined;
    const currentReferences = new Map<string, string>();
    collectHistoricalResourceReferences(input, currentReferences);
    const staleReferences = [...currentReferences.keys()]
      .filter((reference) => historicalReferences.has(reference))
      .filter(
        (reference) =>
          !resourceMentionedInText(reference, normalizedUserText),
      );
    if (staleReferences.length === 0) return undefined;

    const displayReferences = staleReferences
      .slice(0, 3)
      .map((reference) => historicalReferences.get(reference) ?? reference);
    return (
      `疑似沿用了历史对话中的资源参数（${displayReferences.join("、")}），` +
      `但当前用户请求没有明确引用它们；已阻止工具 ${toolName} 执行。` +
      "请忽略旧工具参数，重新依据当前用户请求选择工具和参数；" +
      "如果用户确实要继续处理旧资源，请等待用户明确说明。"
    );
  };
}

export async function loadHistoricalToolArgumentGuard(
  session: Session,
  currentUserText: string,
): Promise<HistoricalToolArgumentGuard | undefined> {
  try {
    return createHistoricalToolArgumentGuard(
      await session.getItems(),
      currentUserText,
    );
  } catch {
    return undefined;
  }
}

/**
 * New turns keep ordinary conversation history for reference, but they do not
 * inherit the previous turn's concrete execution target by default.
 *
 * This is intentionally tool-agnostic. A user may refer to an earlier file,
 * symbol, result, or command, so the history must remain available; the model
 * decides whether the current wording explicitly continues that context.
 */
export const NEW_TURN_CONTEXT_PROMPT =
  "\n\n本轮上下文边界（仅适用于新的用户请求）：" +
  "最后一条 user 消息是本轮唯一的执行目标；更早的 user/assistant 消息仅作为历史参考，用于理解术语、已确认事实和用户偏好。" +
  "历史消息中的具体文件路径、文件名、符号名、变量值、命令参数、工具名称和待办动作，默认不属于本轮目标。" +
  "除非当前 user 消息明确表达继续、接着、基于上面、刚才、该文件、这个结果等指代，且历史中的指代对象可以唯一确定，否则不要把历史中的具体值复制到本轮工具参数，也不要因为历史动作再次调用工具。" +
  "当前 user 消息明确给出的路径、文件名、符号和参数优先；当前消息没有给出具体目标时，不要从历史猜测一个具体目标，需要时先澄清。" +
  "历史工具回执可以作为参考事实，但不代表本轮已经执行；本轮需要动作时，必须根据当前目标重新决定工具调用。";

/**
 * Project persistent history for a genuinely new user turn.
 *
 * The durable session remains untouched. Only the model-facing input omits
 * executable tool-call/result items from older turns, so a previous workflow
 * cannot be replayed as if it belonged to the current request.
 */
export function isToolHistoryItem(item: AgentInputItem): boolean {
  const value = item as Record<string, unknown>;
  const type = typeof value.type === "string" ? value.type : "";
  if (TOOL_HISTORY_ITEM_TYPES.has(type)) return true;
  if (value.role === "tool") return true;
  if (
    value.role === "assistant" &&
    (Array.isArray(value.tool_calls) || value.function_call !== undefined)
  ) {
    return true;
  }
  return false;
}

export function projectNewTurnSessionHistory(
  historyItems: AgentInputItem[],
  newItems: AgentInputItem[],
): AgentInputItem[] {
  return [
    ...historyItems.filter((item) => !isToolHistoryItem(item)),
    ...newItems,
  ];
}
