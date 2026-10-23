import type { AgentInputItem, Session } from "@openai/agents";
import {
  parseToolResult,
  type ToolResult,
  type ToolRisk,
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
  const orderedToolNames = toolCatalog.orderToolNames(toolNames);
  if (orderedToolNames.length === 0) {
    return "\n\n当前没有可调用工具。不要尝试调用任何工具，只能用文字回答或说明阻塞原因。";
  }
  return (
    "\n\n当前可用工具及其用途（只能调用下面列出的工具；用途和风险说明仅用于选择，" +
    "实际权限仍由运行时审批、策略和工具回执决定）：\n" +
    toolCatalog.renderToolCapabilityPrompt(orderedToolNames) +
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

export interface HistoricalToolArgumentGuard {
  (toolName: string, input: unknown): string | undefined;
  /** Resources explicitly supplied or selected by the user during this run. */
  allowConfirmedResources(value: unknown): void;
}

/** Host-authored context facts may be reused without being treated as stale model output. */
export const TRUSTED_CONTEXT_PROVIDER_DATA_KEY = "plcAgentTrustedContext";

const HISTORICAL_REFERENCE_PATTERN =
  /(?:继续|接着|续上|基于(?:上面|之前|前面|刚才|上述)|刚才|上一轮|上一次|之前|前面|上述|前述|该(?:文件|路径|结果|内容|对象|程序|资源|目标|记录|项目|任务)|这个(?:文件|路径|结果|内容|对象|程序|资源|目标|记录|项目|任务)|那(?:个|条|份|项|组|笔)|它们?|这些(?:资源|目标|记录|项目|任务|文件|对象)|那些(?:资源|目标|记录|项目|任务|文件|对象)|同一(?:个|项|条)|continue|previous|that|those|them|it|the same)/iu;

/**
 * 只读工具可以在“最近且唯一的目标”上承接自然语言追问；写入/执行风险
 * 工具还要求当前请求明确表达操作意图。删除的自然承接规则见下方。
 */
const IMPLICIT_HISTORY_READ_TOOLS = new Set([
  "read_file",
  "search_files",
  "list_files",
]);
/** Asking the user has no side effect; its response is what authorizes later use. */
const HISTORY_GUARD_EXEMPT_TOOLS = new Set(["request_clarification"]);
/**
 * 这些字段装的是查询条件，不是路径。search_files 的 text 是要搜的字，
 * 不是文件；glob 仍然是路径筛选，照常检查。
 */
const IGNORED_RESOURCE_ARGUMENT_FIELDS: Record<string, ReadonlySet<string>> = {
  search_files: new Set(["text"]),
};
/**
 * 识别自然追问和明确只读请求；语气词本身不构成追问依据。
 */
const IMPLICIT_FOLLOW_UP_PATTERN =
  /(?:[?？]|吗|呢|多少|哪些|哪个|哪一|分别|为什么|为何|如何|怎么|是否|有没有|能否|可否|是不是|是什么|有啥|请(?:查看|读取|检查|分析|确认|看看|读一下|打开)|帮我(?:查看|读取|检查|分析|确认|看看|读一下|打开)|(?:这个|该|刚才|上面|前面|上一轮|那个|那些|它们?)(?:文件|程序|结果|内容|工程|配置|代码|资源|目标|记录|项目|任务)?|(?:看看|读一下|分析一下|解释一下|说明一下))/iu;
/**
 * “删掉吧”“清理掉”这种整句就是一个删除动作、没有带任何新资源名的说法，
 * 本身就是对上一轮目标的承接。要求用户把文件名再念一遍没有意义 —— 实际
 * 后果是模型被拦两次后，改成“扫目录里所有 .ps1 再删”这种不含文件名的写法
 * 绕过去，比直接删更危险。所以只放行删除类动词，且目标必须全部落在最近两轮。
 */
const DESTRUCTIVE_FOLLOW_UP_PATTERN =
  /(?:删掉|删除|删了|清理掉|清理|清掉|移除|去掉|干掉)/u;
const MUTATING_ACTION_SOURCE =
  "(?:创建|新建|写入|保存|修改|编辑|改|改名|重命名|修复|替换|更新|删除|删|清理|移除|运行|执行|测试|构建|编译|导出|部署|提交|create|write|save|modify|edit|rename|fix|replace|update|delete|remove|run|execute|test|build|compile|export|deploy|commit)";
const MUTATING_REQUEST_PATTERN = new RegExp(
  `(?:^(?:(?:请(?!问)|帮我|麻烦|直接|现在|继续|接着|然后|再)\\s*)*${MUTATING_ACTION_SOURCE}|(?:请(?!问)|帮我|麻烦|直接|继续|接着|再|能不能|可以|可不可以).{0,8}${MUTATING_ACTION_SOURCE}|(?:把|将).{0,24}${MUTATING_ACTION_SOURCE}|${MUTATING_ACTION_SOURCE}(?:一下|一下吧|吧|成|为))`,
  "iu",
);
const NEGATED_MUTATING_ACTION_PATTERN = new RegExp(
  `(?:不要|不必|不需要|无需|别|不能|禁止|停止|不想|不(?:再|会|用|打算|准备|应|该|必|需|能|要)|没(?:有|必要|能|打算|准备)?|未(?:曾|能|打算|准备)?|无法|don't|do not|must not|cannot|stop).{0,8}${MUTATING_ACTION_SOURCE}`,
  "iu",
);
const EXISTING_TARGET_MUTATION_PATTERN =
  /(?:修改|编辑|改|改名|重命名|修复|替换|更新|删除|删|清理|移除|rename|modify|edit|fix|replace|update|delete|remove)/iu;
const NEW_TARGET_ACTION_PATTERN = /(?:创建|新建|另建|create|new\s+(?:a\s+)?(?:file|project|record|task|resource|item|object))/iu;
const CONTEXTUAL_TARGET_CUE_PATTERN =
  /(?:它们?|这(?:个|条|份|项|组|笔)|那(?:个|条|份|项|组|笔)|该|刚才|上一轮|上一次|之前|前面|同一|对象|目标|资源|实体|记录|文件|项目|任务|配置|代码|it|them|this|that|those|same|previous|last|object|target|resource|entity|record|file|project|task|item)/iu;
const RESOURCE_ARGUMENT_KEY_PATTERN =
  /(?:^|[_-])?(?:id|key|path|file|directory|dir|uri|url|target|resource|entity|record|name|slug|ref)$/iu;
const MAX_IMPLICIT_HISTORY_TURN_AGE = 2;

/**
 * 只有这些词出现在开头时才尝试拆成“动词 + 文件名”。是否真的削掉请求词，
 * 由后半段是否像文件或目录路径决定，这样无空格的“读取日志.txt”也能识别。
 */
const LEADING_REQUEST_WORD_PATTERN =
  /^(?:(?:上一轮|上一次|刚才|之前|前面|上述|前述)的?)?(?:读取|查看|打开|列出|列一下|搜索|查找|分析|检查|总结|导入|导出|保存|加载|修改|编辑|写入|更新|确认|读一下|看一下|看看)/u;

/**
 * 两段：绝对路径，和带扩展名的文件。不带扩展名的相对目录（`src/runtime`）
 * 故意不放进正则——ST 程序里的 `speed/2` 也会被当成路径。目录靠下面
 * “整串就是一个路径”的那条补上。
 */
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

/**
 * 正则片段允许中文（中文文件名很常见），代价是它会把紧挨着的中文句子一起吞进来：
 * “读取yy.txt并总结”整句会被当成一个路径。这里先尝试削开头的请求动词，
 * 只在剩余部分整体仍像资源引用时采用，再削掉尾部粘上的中文句子。
 */
function trimResourceToken(token: string): string {
  let value = token;
  const requestWord = value.match(LEADING_REQUEST_WORD_PATTERN);
  if (requestWord) {
    const rest = value.slice(requestWord[0].length);
    if (looksLikeResourceReference(rest)) value = rest;
  }
  const trailing = value.match(/[\u4e00-\u9fff]+$/u);
  if (trailing) {
    const rest = value.slice(0, value.length - trailing[0].length);
    if (/[a-z0-9]$/iu.test(rest)) value = rest;
  }
  return value;
}

function addResourceReference(
  value: string,
  output: Map<string, string>,
): void {
  const normalized = normalizeResourceReference(value);
  if (!looksLikeResourceReference(normalized)) return;
  const reference = `path:${normalized}`;
  if (!output.has(reference)) output.set(reference, value.trim());
}

function resourceReferenceKind(key: string): "path" | "id" | "resource" {
  const normalized = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
  if (/(?:path|file|directory|dir)$/u.test(normalized)) return "path";
  if (/id$/u.test(normalized)) return "id";
  return "resource";
}

function addStructuredResourceReference(
  key: string,
  value: unknown,
  output: Map<string, string>,
): void {
  if (!RESOURCE_ARGUMENT_KEY_PATTERN.test(key)) return;
  if (typeof value !== "string" && typeof value !== "number") return;
  const display = String(value).trim();
  if (!display || display.length > 260) return;
  const normalized = normalizeResourceReference(display);
  if (!normalized) return;
  const kind = resourceReferenceKind(key);
  // Path fields can be written differently as a relative path and as a
  // resource value by another tool, so keep their path identity stable.
  const reference = `${kind}:${normalized}`;
  if (!output.has(reference)) output.set(reference, display);
}

function collectStructuredResourceReferences(
  value: unknown,
  output: Map<string, string>,
  depth = 0,
): void {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        collectStructuredResourceReferences(JSON.parse(trimmed), output, depth + 1);
      } catch {
        // Not every tool serializes its arguments as JSON.
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStructuredResourceReferences(item, output, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    addStructuredResourceReference(key, item, output);
    collectStructuredResourceReferences(item, output, depth + 1);
  }
}

function collectResourceReferencesFromText(
  value: string,
  output: Map<string, string>,
): void {
  for (const match of value.matchAll(RESOURCE_TOKEN_PATTERN)) {
    const token = match[0];
    if (!token) continue;
    addResourceReference(trimResourceToken(token), output);
  }
  // 整个字符串就是一个路径时也收下：目录参数（`src/runtime`）没有扩展名，
  // 正则匹配不到。带空白的字符串是句子，不能整句当路径——这正是之前
  // “上一轮读取 yy.txt”被当成文件名的原因。
  const trimmed = value.trim();
  if (
    trimmed &&
    !/\s/u.test(trimmed) &&
    !trimmed.startsWith("{") &&
    !trimmed.startsWith("[")
  ) {
    addResourceReference(trimResourceToken(trimmed), output);
  }
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
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    addStructuredResourceReference(key, item, output);
    collectHistoricalResourceReferences(item, output, depth + 1);
  }
}

function referenceValue(reference: string): string {
  const separator = reference.indexOf(":");
  return separator >= 0 ? reference.slice(separator + 1) : reference;
}

function addConfirmedScalar(value: unknown, output: Set<string>): void {
  if (typeof value !== "string" && typeof value !== "number") return;
  const text = String(value);
  const normalized = normalizeResourceReference(text);
  if (!normalized || normalized.length > 260) return;
  output.add(normalized);
  const structured = new Map<string, string>();
  collectStructuredResourceReferences(text, structured);
  for (const reference of structured.keys()) output.add(reference);
  const pathReferences = new Map<string, string>();
  collectResourceReferencesFromText(text, pathReferences);
  for (const reference of pathReferences.keys()) output.add(reference);
}

function collectConfirmedResourceReferences(value: unknown, output: Set<string>): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;
  addConfirmedScalar(record.value, output);
  addConfirmedScalar(record.customText, output);
  if (record.fields && typeof record.fields === "object") {
    const references = new Map<string, string>();
    collectHistoricalResourceReferences(record.fields, references);
    for (const reference of references.keys()) output.add(reference);
    for (const fieldValue of Object.values(record.fields as Record<string, unknown>)) {
      addConfirmedScalar(fieldValue, output);
    }
  }
  if (record.answers && typeof record.answers === "object") {
    for (const answer of Object.values(record.answers as Record<string, unknown>)) {
      collectConfirmedResourceReferences(answer, output);
    }
  }
}

interface HistoricalReferenceRecord {
  display: string;
  /** 从 1 开始的用户轮次；工具调用和回执归属于它前面的 user 轮次。 */
  turnIndex: number;
  evidence: "mentioned" | "attempted" | "observed";
  observedTurnIndex?: number;
}

interface HistoricalReferenceRecords {
  /** 所有历史引用，用来识别模型是否复制了旧参数。 */
  records: Map<string, HistoricalReferenceRecord>;
  /** 最近对话和工具调用/回执中出现的目标；回执证据等级与普通提及分开记录。 */
  activeRecords: Map<string, HistoricalReferenceRecord>;
  currentTurnIndex: number;
}

function isUserMessage(item: unknown): item is { type?: string; role?: string; content?: unknown } {
  const value = item as { type?: string; role?: string };
  return value.type === "message" && value.role === "user";
}

function isActiveReferenceItem(item: unknown): boolean {
  const value = item as { type?: string; role?: string };
  if (value.type === "message") {
    return value.role === "user" || value.role === "assistant";
  }
  return value.type === "function_call" ||
    value.type === "tool_call" ||
    value.type === "mcp_call" ||
    value.type === "shell_call" ||
    value.type === "apply_patch_call";
}

function isTrustedContextItem(item: unknown): boolean {
  const value = item as { providerData?: unknown };
  if (!value.providerData || typeof value.providerData !== "object") return false;
  return (value.providerData as Record<string, unknown>)[TRUSTED_CONTEXT_PROVIDER_DATA_KEY] === true;
}

function historicalToolResult(item: unknown): { ok: boolean; data?: unknown } | undefined {
  const value = item as { output?: unknown };
  const text = sessionOutputText(value.output);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as { ok?: unknown; data?: unknown };
    if (typeof parsed?.ok !== "boolean") return undefined;
    return { ok: parsed.ok, ...(parsed.data !== undefined ? { data: parsed.data } : {}) };
  } catch {
    return undefined;
  }
}

function setHistoricalReference(
  records: Map<string, HistoricalReferenceRecord>,
  reference: string,
  display: string,
  turnIndex: number,
  evidence: HistoricalReferenceRecord["evidence"],
): void {
  const existing = records.get(reference);
  const evidenceRank = { mentioned: 0, attempted: 1, observed: 2 };
  const strongestEvidence = existing && evidenceRank[existing.evidence] > evidenceRank[evidence]
    ? existing.evidence
    : evidence;
  records.set(reference, {
    display,
    turnIndex,
    evidence: strongestEvidence,
    ...((evidence === "observed" ? turnIndex : existing?.observedTurnIndex) !== undefined
      ? { observedTurnIndex: evidence === "observed" ? turnIndex : existing?.observedTurnIndex }
      : {}),
  });
}

function historicalReferenceRecords(
  historyItems: readonly AgentInputItem[],
  currentUserText: string,
): HistoricalReferenceRecords {
  // 当前 user 消息不属于历史目标。真实运行时它通常已经写入 session，
  // 直接调用 createHistoricalToolArgumentGuard 的测试则可能没有这一项。
  const currentUserIndex = [...historyItems]
    .map((item, index) => ({ item, index }))
    .reverse()
    .find(({ item }) => isUserMessage(item) &&
      typeof item.content === "string" && item.content === currentUserText)
    ?.index ?? historyItems.length;
  const records = new Map<string, HistoricalReferenceRecord>();
  const activeRecords = new Map<string, HistoricalReferenceRecord>();
  const pendingCalls = new Map<string, { references: Map<string, string>; turnIndex: number }>();
  let turnIndex = 0;
  for (let index = 0; index < currentUserIndex; index += 1) {
    const item = historyItems[index];
    if (isUserMessage(item)) turnIndex += 1;
    if (isTrustedContextItem(item)) continue;

    const itemValue = item as { type?: string; callId?: string; arguments?: unknown; output?: unknown };
    if (["function_call", "tool_call", "mcp_call", "shell_call", "apply_patch_call"].includes(itemValue.type ?? "")) {
      const references = new Map<string, string>();
      collectStructuredResourceReferences(itemValue.arguments, references);
      collectHistoricalResourceReferences(itemValue.arguments, references);
      for (const [reference, display] of references) {
        setHistoricalReference(records, reference, display, turnIndex, "attempted");
        setHistoricalReference(activeRecords, reference, display, turnIndex, "attempted");
      }
      if (itemValue.callId) pendingCalls.set(itemValue.callId, { references, turnIndex });
      continue;
    }
    if (["function_call_result", "function_call_output", "tool_result", "tool_call_output"].includes(itemValue.type ?? "")) {
      const result = historicalToolResult(item);
      if (!result?.ok) continue;
      const references = new Map<string, string>();
      const call = itemValue.callId ? pendingCalls.get(itemValue.callId) : undefined;
      for (const [reference, display] of call?.references ?? []) references.set(reference, display);
      collectStructuredResourceReferences(result.data, references);
      collectHistoricalResourceReferences(result.data, references);
      const resultTurn = call?.turnIndex ?? turnIndex;
      for (const [reference, display] of references) {
        setHistoricalReference(records, reference, display, resultTurn, "observed");
        setHistoricalReference(activeRecords, reference, display, resultTurn, "observed");
      }
      continue;
    }

    const references = new Map<string, string>();
    collectHistoricalResourceReferences(item, references);
    for (const [normalized, display] of references) {
      setHistoricalReference(records, normalized, display, turnIndex, "mentioned");
    }
    if (isActiveReferenceItem(item)) {
      for (const [normalized, display] of references) {
        setHistoricalReference(activeRecords, normalized, display, turnIndex, "mentioned");
      }
    }
  }
  return { records, activeRecords, currentTurnIndex: turnIndex + 1 };
}

function isImplicitFollowUp(currentUserText: string): boolean {
  return IMPLICIT_FOLLOW_UP_PATTERN.test(currentUserText.trim());
}

/** 工具参数里去掉“不是路径”的字段（目前只有 search_files 的 text）。 */
function omitIgnoredArgumentFields(
  input: unknown,
  fields: ReadonlySet<string>,
): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = input as Record<string, unknown>;
  if (!Object.keys(value).some((key) => fields.has(key))) return input;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!fields.has(key)) result[key] = item;
  }
  return result;
}

function resourceMentionedInText(
  normalizedReference: string,
  normalizedText: string,
): boolean {
  const value = normalizedReference.slice(normalizedReference.indexOf(":") + 1);
  if (normalizedText.includes(value)) return true;
  const basename = value.split("/").at(-1);
  return Boolean(basename && basename.length > 2 && normalizedText.includes(basename));
}

function isAbsoluteReference(reference: string): boolean {
  return /^[a-z]:\//u.test(reference) || reference.startsWith("//");
}

/**
 * 同一个文件会有两种写法：工作区相对路径和绝对路径。
 *
 * 历史里一处记成相对路径、一处记成绝对路径，其实是同一个文件，不能算成两个候选。
 * 判据是短的必须不是绝对路径，且长的以「/短」结尾——相对路径都是相对工作区根写的，
 * 这个关系成立。
 */
function isSameFileReference(left: string, right: string): boolean {
  if (left === right) return true;
  const [leftKind, leftValue] = left.split(/:(.*)/su, 2);
  const [rightKind, rightValue] = right.split(/:(.*)/su, 2);
  if (leftKind !== rightKind || leftKind !== "path") return false;
  const shorter = leftValue.length <= rightValue.length ? leftValue : rightValue;
  const longer = shorter === leftValue ? rightValue : leftValue;
  if (isAbsoluteReference(shorter)) return false;
  return longer.endsWith(`/${shorter}`);
}

/** 把指向同一文件的写法归成一组，每组保留原始写法。 */
function groupSameFileReferences(references: readonly string[]): string[][] {
  const groups: string[][] = [];
  for (const reference of references) {
    const group = groups.find((items) =>
      items.some((item) => isSameFileReference(item, reference)),
    );
    if (group) group.push(reference);
    else groups.push([reference]);
  }
  return groups;
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
  getToolRisk: (toolName: string) => ToolRisk = () => "execute",
): HistoricalToolArgumentGuard | undefined {
  const { records: historicalReferences, activeRecords, currentTurnIndex } =
    historicalReferenceRecords(historyItems, currentUserText);
  if (historicalReferences.size === 0) return undefined;

  const normalizedUserText = normalizeResourceReference(currentUserText);
  const currentUserReferences = new Map<string, string>();
  collectResourceReferencesFromText(currentUserText, currentUserReferences);
  const recentReferences = new Set(
    [...activeRecords.entries()]
      .filter(([, record]) => currentTurnIndex - record.turnIndex <= MAX_IMPLICIT_HISTORY_TURN_AGE)
      .map(([reference]) => reference),
  );
  // 同一个文件的相对写法和绝对写法算一个候选，否则会被当成"目标不唯一"。
  const recentReferenceGroups = groupSameFileReferences([...recentReferences]);
  const observedRecentReferences = new Set(
    [...activeRecords.entries()]
      .filter(([, record]) =>
        record.observedTurnIndex !== undefined &&
        currentTurnIndex - record.observedTurnIndex <= MAX_IMPLICIT_HISTORY_TURN_AGE,
      )
      .map(([reference]) => reference),
  );
  const explicitContinuation = HISTORICAL_REFERENCE_PATTERN.test(currentUserText);
  const requestsMutation = MUTATING_REQUEST_PATTERN.test(currentUserText) &&
    !NEGATED_MUTATING_ACTION_PATTERN.test(currentUserText);
  const mutatesExistingTarget = EXISTING_TARGET_MUTATION_PATTERN.test(currentUserText) &&
    !NEW_TARGET_ACTION_PATTERN.test(currentUserText) &&
    CONTEXTUAL_TARGET_CUE_PATTERN.test(currentUserText) &&
    currentUserReferences.size === 0 &&
    !NEGATED_MUTATING_ACTION_PATTERN.test(currentUserText);
  const confirmedReferences = new Set<string>();

  const guard: HistoricalToolArgumentGuard = (toolName, input) => {
    if (HISTORY_GUARD_EXEMPT_TOOLS.has(toolName)) return undefined;
    const ignoredFields = IGNORED_RESOURCE_ARGUMENT_FIELDS[toolName];
    const currentReferences = new Map<string, string>();
    collectHistoricalResourceReferences(
      ignoredFields ? omitIgnoredArgumentFields(input, ignoredFields) : input,
      currentReferences,
    );
    const staleReferences = [...currentReferences.keys()]
      .filter((reference) => historicalReferences.has(reference))
      .filter((reference) =>
        !confirmedReferences.has(reference) &&
        !confirmedReferences.has(referenceValue(reference)),
      )
      .filter(
        (reference) =>
          !resourceMentionedInText(reference, normalizedUserText),
      );
    if (staleReferences.length === 0) return undefined;

    // 承接只限最近两轮内唯一的资源；陈旧历史目标必须由本轮重新明确指定。
    // "唯一"按文件算：相对写法和绝对写法指向同一个文件时算一个。
    const hasUniqueRecentTarget = recentReferenceGroups.length === 1;
    const isSideEffectTool = ["write", "execute"].includes(getToolRisk(toolName));
    const canContinueExplicitly = explicitContinuation &&
      hasUniqueRecentTarget &&
      staleReferences.every((reference) => recentReferences.has(reference)) &&
      (!isSideEffectTool || (
        requestsMutation && staleReferences.every((reference) => observedRecentReferences.has(reference))
      ));
    // Natural-language references are resolved against the immediately recent
    // successful tool evidence. The action still has to mutate an existing
    // target; a request to create a new object cannot inherit the old target.
    const canContinueExistingTargetMutation = isSideEffectTool &&
      mutatesExistingTarget &&
      hasUniqueRecentTarget &&
      staleReferences.every((reference) =>
        recentReferences.has(reference) && observedRecentReferences.has(reference),
      );
    const canContinueImplicitly = IMPLICIT_HISTORY_READ_TOOLS.has(toolName) &&
      currentUserReferences.size === 0 &&
      isImplicitFollowUp(currentUserText) &&
      hasUniqueRecentTarget &&
      staleReferences.length === 1 &&
      recentReferences.has(staleReferences[0]);
    // 删除类承接不要求目标唯一：上一轮产出两个临时脚本、用户说“删掉吧”，
    // 指的就是这两个。但每一个旧目标都必须在最近两轮里出现过。
    const canContinueDestructively =
      DESTRUCTIVE_FOLLOW_UP_PATTERN.test(currentUserText) &&
      requestsMutation &&
      currentUserReferences.size === 0 &&
      staleReferences.length > 0 &&
      staleReferences.every((reference) =>
        recentReferences.has(reference) && observedRecentReferences.has(reference),
      );
    if (
      canContinueExplicitly ||
      canContinueExistingTargetMutation ||
      canContinueImplicitly ||
      canContinueDestructively
    ) {
      return undefined;
    }

    const isFollowUp = explicitContinuation || isImplicitFollowUp(currentUserText);
    // 按文件分组之后再判歧义：两种写法指向同一个文件时不该打扰用户。
    const ambiguousRecentTargets = isFollowUp && recentReferenceGroups.length > 1
      ? recentReferenceGroups
        .map((group) => group.reduce((longest, item) => (item.length > longest.length ? item : longest)))
        .slice(0, 5)
      : [];
    if (ambiguousRecentTargets.length > 0) {
      const choices = ambiguousRecentTargets
        .map((reference) => activeRecords.get(reference)?.display ?? reference);
      return (
        `当前请求可能在承接历史上下文，但最近有多个候选资源（${choices.join("、")}），` +
        `无法确定 ${toolName} 应使用哪一个。不要重试当前工具；请先调用 request_clarification，` +
        "让用户选择目标，再使用本轮确认的资源参数继续。"
      );
    }

    const displayReferences = staleReferences
      .slice(0, 3)
      .map((reference) => historicalReferences.get(reference)?.display ?? reference);
    const unverifiedReferences = staleReferences.filter((reference) => !observedRecentReferences.has(reference));
    return (
      `疑似沿用了历史对话中的资源参数（${displayReferences.join("、")}），` +
      `但当前用户请求没有明确引用或唯一承接它们；已阻止工具 ${toolName} 执行。` +
      "如果这是全新的目标，请忽略旧参数并按当前请求重新选择；" +
      (unverifiedReferences.length
        ? "这些候选只在历史文本或未成功的工具调用中出现，尚无成功工具回执证明目标；先用只读工具确认目标，或让用户选择/补充目标。"
        : "") +
      (hasUniqueRecentTarget
        // 唯一但未核验的候选应先用只读工具确认；只有多个候选才需要用户选择。
        ? "最近只有一个候选目标，不要调用 request_clarification；先按当前请求用只读工具核验目标，再继续。"
        : "如果这是对话追问但目标不唯一，请调用 request_clarification 让用户选择。") +
      (isSideEffectTool
        ? "写入、编辑和执行类工具还必须有当前请求明确表达的操作意图。"
        : "")
    );
  };
  guard.allowConfirmedResources = (value) => {
    collectConfirmedResourceReferences(value, confirmedReferences);
  };
  return guard;
}

export async function loadHistoricalToolArgumentGuard(
  session: Session,
  currentUserText: string,
  getToolRisk?: (toolName: string) => ToolRisk,
): Promise<HistoricalToolArgumentGuard | undefined> {
  try {
    return createHistoricalToolArgumentGuard(
      await session.getItems(),
      currentUserText,
      getToolRisk,
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
  "当前消息是在追问最近且唯一的活动资源时，只读工具可以承接该资源；写入、删除、执行类工具还必须同时有当前消息明确表达的操作意图和可唯一确定的历史目标。若有多个候选目标，先调用 request_clarification 让用户选择，不要反复重试旧参数。" +
  "当前 user 消息明确给出的路径、文件名、符号和参数优先；当前消息没有给出具体目标时，不要从历史猜测一个具体目标，需要时先澄清。" +
  "历史工具调用参数只是曾尝试使用的目标；只有成功工具回执才能证明工具实际确认过该目标，助手文字本身不能替代工具证据。" +
  "当本轮自然语言承接最近且唯一、已有成功回执确认的目标，并明确要求修改、重命名、删除等既有对象操作时，可以沿用该目标；如果目标只是被提及或工具调用失败，先用只读工具确认或向用户澄清。" +
  "历史工具回执可以作为参考事实，但不代表本轮已经执行；本轮需要动作时，必须根据当前目标重新决定工具调用。" +
  "如果当前用户是在追问上一轮为什么这样处理、某个配置为什么没有变化或当前状态如何形成，可以引用历史对话中已经明确陈述的事实来解释原因；本轮没有工具调用不等于不能解释历史状态。" +
  "回答这类历史原因时，应明确这是根据之前对话或已确认记录得出的解释，不能把历史记录冒充成本轮刚刚完成的工具执行、文件写入、校验通过或交付证据。";

/**
 * Build a small, model-readable copy of the ordinary conversation before the
 * current user turn. It is intentionally separate from the completion
 * evidence ledger: this context can explain why an earlier state exists, but
 * it can never prove that the current turn performed an action.
 */
export function buildHistoricalExplanationContext(
  historyItems: readonly AgentInputItem[],
  currentUserText: string,
  maxCharacters = 8_000,
): string {
  const currentUserIndex = [...historyItems]
    .map((item, index) => ({ item, index }))
    .reverse()
    .find(({ item }) => {
      const value = item as {
        type?: string;
        role?: string;
        content?: unknown;
      };
      return value.type === "message" &&
        value.role === "user" &&
        typeof value.content === "string" &&
        value.content === currentUserText;
    })?.index;

  const candidates = historyItems
    .slice(0, currentUserIndex ?? historyItems.length)
    .filter((item) => {
      const value = item as { type?: string; role?: string };
      return value.type === "message" &&
        (value.role === "user" || value.role === "assistant");
    })
    .map((item) => {
      const value = item as {
        role?: string;
        content?: unknown;
      };
      let text = sessionOutputText(value.content)?.trim() ?? "";
      if (value.role === "assistant") {
        const trimmed = text.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            const parsed = JSON.parse(trimmed) as {
              message?: unknown;
            };
            if (typeof parsed.message === "string") {
              text = parsed.message.trim();
            }
          } catch {
            // Keep non-JSON assistant text as-is.
          }
        }
      }
      text = stripHistoricalContextMarker(text);
      if (!text) return undefined;
      return `${value.role === "user" ? "用户" : "助手"}：${text}`;
    })
    .filter((item): item is string => Boolean(item));

  if (candidates.length === 0) return "";
  const full = candidates.slice(-12).join("\n");
  if (full.length <= maxCharacters) return full;
  return `…${full.slice(-(Math.max(1, maxCharacters) - 1))}`;
}

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

const MAX_STRUCTURED_UNWRAP_DEPTH = 4;

/**
 * Project history for the auxiliary classifiers (task plan, delivery contract,
 * workflow route, team route).
 *
 * Those roles only pick a route; they must not imitate the main agent. Durable
 * history stores each finished turn as the raw `IndustrialAgentOutput` JSON, so
 * feeding it verbatim gives the model a much stronger pattern than the schema
 * instruction in its prompt and it answers in the agent's shape instead — which
 * then fails validation. Unwrapping it back to the plain message text keeps the
 * conversation (so "it" still has a referent) without the format contamination.
 */
export function projectHistoryForClassifier(
  items: readonly AgentInputItem[],
): AgentInputItem[] {
  return items.map(unwrapStructuredAssistantMessage);
}

function unwrapStructuredAssistantMessage(item: AgentInputItem): AgentInputItem {
  const value = item as Record<string, unknown>;
  if (value.role !== "assistant") return item;
  if (typeof value.content === "string") {
    const text = unwrapStructuredOutputText(value.content);
    if (text === value.content) return item;
    return { ...value, content: text } as unknown as AgentInputItem;
  }
  if (!Array.isArray(value.content)) return item;

  let changed = false;
  const content = value.content.map((part) => {
    if (!part || typeof part !== "object") return part;
    const record = part as Record<string, unknown>;
    if (typeof record.text !== "string") return part;
    const text = unwrapStructuredOutputText(record.text);
    if (text === record.text) return part;
    changed = true;
    return { ...record, text };
  });
  if (!changed) return item;
  return { ...value, content } as unknown as AgentInputItem;
}

function unwrapStructuredOutputText(text: string, depth = 0): string {
  if (depth >= MAX_STRUCTURED_UNWRAP_DEPTH) return text;
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return text;
  }
  if (Array.isArray(parsed)) {
    // SDK content parts: pull the text out and unwrap whatever it holds.
    const parts = parsed
      .map((part) => (part && typeof part === "object"
        ? (part as { text?: unknown }).text
        : undefined))
      .filter((entry): entry is string => typeof entry === "string");
    if (!parts.length) return text;
    return unwrapStructuredOutputText(parts.join(""), depth + 1);
  }
  const message = (parsed as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) {
    return unwrapStructuredOutputText(message, depth + 1);
  }
  return text;
}
