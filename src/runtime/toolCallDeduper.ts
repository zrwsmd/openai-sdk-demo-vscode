import type {
  ToolEffect,
  ToolResult,
  ToolRisk,
} from "../protocol/results";

export interface ToolCallCapability {
  risk?: ToolRisk;
  effect?: ToolEffect;
}

export interface ToolCallDeduperEvent {
  toolName?: string;
  args?: string;
  callId?: string;
  itemId?: string;
  ok?: boolean;
  result?: ToolResult;
}

export type ToolCallCapabilityLookup = (
  toolName: string,
) => ToolCallCapability | undefined;

export type ToolCallDeduperLogger = (message: string) => void;

function stableJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function canonicalArguments(value: unknown): string {
  if (typeof value === "string") {
    try {
      return stableJson(JSON.parse(value));
    } catch {
      return value.trim();
    }
  }
  return stableJson(value ?? {});
}

function callIdOf(event: ToolCallDeduperEvent): string | undefined {
  return event.callId ?? event.itemId;
}

/**
 * Converges a model replay of an already successful pure read.
 *
 * This ledger is intentionally scoped to one run. It never reuses a result
 * from a previous user turn, because the workspace or PLC state may have
 * changed outside the agent. Effectful tools invalidate the read ledger.
 */
export class ToolCallDeduper {
  private readonly completedReadKeys = new Set<string>();
  private readonly activeReadCallIdByKey = new Map<string, string>();
  private readonly keyByCallId = new Map<string, string>();
  private readonly suppressedCallIds = new Set<string>();
  private readonly loggedKeys = new Set<string>();

  constructor(
    private readonly capabilityFor: ToolCallCapabilityLookup,
    private readonly log: ToolCallDeduperLogger,
  ) {}

  /**
   * Runs before the actual tool implementation. Returning a string lets the
   * existing input guardrail send a recoverable message back to the model.
   */
  guard(toolName: string, input: unknown): string | undefined {
    this.invalidateFor(toolName);
    const key = this.readKey(toolName, input);
    if (!key || !this.completedReadKeys.has(key)) return undefined;
    this.logDuplicate(toolName, key, "guard");
    return (
      `工具 ${toolName} 已经使用相同参数成功执行过；` +
      "请直接使用已有工具回执继续当前请求，不要重复调用。"
    );
  }

  /**
   * Filters the visible protocol event before it reaches the UI and ledger.
   * The model still receives the guardrail result through the SDK internals.
   */
  shouldSuppressStarted(event: ToolCallDeduperEvent): boolean {
    const toolName = event.toolName;
    if (!toolName) return false;
    this.invalidateFor(toolName);
    const key = this.readKey(toolName, event.args);
    const callId = callIdOf(event);
    if (!key || !callId) return false;

    const existingCallId =
      this.completedReadKeys.has(key)
        ? key
        : this.activeReadCallIdByKey.get(key);
    if (existingCallId && existingCallId !== callId) {
      this.suppressedCallIds.add(callId);
      this.keyByCallId.set(callId, key);
      this.logDuplicate(toolName, key, "event");
      return true;
    }
    this.activeReadCallIdByKey.set(key, callId);
    this.keyByCallId.set(callId, key);
    return false;
  }

  /**
   * Records a successful pure read and hides the matching rejected duplicate.
   */
  shouldSuppressCompleted(event: ToolCallDeduperEvent): boolean {
    const callId = callIdOf(event);
    if (!callId) return false;
    if (this.suppressedCallIds.has(callId)) {
      this.suppressedCallIds.delete(callId);
      this.keyByCallId.delete(callId);
      return true;
    }

    const key = this.keyByCallId.get(callId);
    if (!key) return false;
    this.keyByCallId.delete(callId);
    if (this.activeReadCallIdByKey.get(key) === callId) {
      this.activeReadCallIdByKey.delete(key);
    }
    if (event.result?.ok === true || event.ok === true) {
      this.completedReadKeys.add(key);
    }
    return false;
  }

  private capability(toolName: string): ToolCallCapability {
    return this.capabilityFor(toolName) ?? {};
  }

  private isPureRead(toolName: string): boolean {
    const capability = this.capability(toolName);
    return capability.risk === "read" && capability.effect === "none";
  }

  private invalidatesReadLedger(toolName: string): boolean {
    const capability = this.capability(toolName);
    return capability.risk === "write" || capability.risk === "execute";
  }

  private invalidateFor(toolName: string): void {
    if (!this.invalidatesReadLedger(toolName)) return;
    this.completedReadKeys.clear();
    this.activeReadCallIdByKey.clear();
    this.keyByCallId.clear();
  }

  private readKey(toolName: string, args: unknown): string | undefined {
    if (!this.isPureRead(toolName)) return undefined;
    return `${toolName}\u0000${canonicalArguments(args)}`;
  }

  private logDuplicate(toolName: string, key: string, source: string): void {
    const logKey = `${source}\u0000${key}`;
    if (this.loggedKeys.has(logKey)) return;
    this.loggedKeys.add(logKey);
    const args = key.slice(key.indexOf("\u0000") + 1).slice(0, 240);
    this.log(`[tool-dedupe] 已收敛重复只读调用 source=${source} tool=${toolName} args=${args}`);
  }
}
