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
