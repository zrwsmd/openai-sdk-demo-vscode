import { AgentEventFactory, type AgentProtocolEvent, type AgentEventSource } from '../protocol/events';
import { parseToolResult, type ToolResult } from '../protocol/results';

export interface AgentStreamAdapterOptions {
  runId: string;
  operationId?: string;
  initialSequence?: number;
  /** Structured output is parsed at completion; do not expose JSON chunks as text. */
  structuredOutput?: boolean;
  eventFactory?: AgentEventFactory;
  emit?: (event: AgentProtocolEvent) => void;
}

export interface AgentStreamAdapterResult {
  output: string;
  usage: { inputTokens: number; outputTokens: number; requests: number };
}

export type AgentStreamLegacyEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; callId?: string; args?: string }
  | { type: 'tool_result'; name: string; ok: boolean; summary: string; callId?: string; result?: ToolResult };

export interface AgentStreamAdapterHooks {
  onLegacyEvent?: (event: AgentStreamLegacyEvent) => void;
}

/**
 * Converts the Agents SDK stream into the product protocol.
 *
 * The adapter deliberately accepts an async iterable instead of a concrete
 * StreamedRunResult so it can be tested with scripted events and reused by a
 * future MCP/CLI host without coupling those hosts to SDK internals.
 */
export class AgentStreamAdapter {
  private readonly options: AgentStreamAdapterOptions;
  private readonly factory: AgentEventFactory;
  private readonly toolNames = new Map<string, string>();
  private currentAgent?: string;

  constructor(options: AgentStreamAdapterOptions) {
    this.options = options;
    this.factory = options.eventFactory ?? new AgentEventFactory(options.runId, options.operationId, options.initialSequence ?? 0);
  }

  get nextSequence(): number {
    return this.factory.nextSequence;
  }

  async consume(stream: AsyncIterable<any>, hooks: AgentStreamAdapterHooks = {}): Promise<AgentStreamAdapterResult> {
    let output = '';
    let summary = { inputTokens: 0, outputTokens: 0, requests: 0 };
    try {
      for await (const event of stream) {
        const text = this.handleEvent(event, hooks);
        if (text) output += text;
      }
    } finally {
      // The SDK may terminate a stream with a provider-specific error after
      // updating RunState. Usage is still useful for recovery/diagnostics, so
      // publish it even when iteration throws.
      const state = (stream as { state?: { usage?: Record<string, unknown> } }).state;
      const usage = state?.usage ?? {};
      summary = {
        inputTokens: numberValue(usage.inputTokens),
        outputTokens: numberValue(usage.outputTokens),
        requests: numberValue(usage.requests),
      };
      this.emit('usage.updated', 'runtime', summary);
    }
    return { output, usage: summary };
  }

  private handleEvent(event: any, hooks: AgentStreamAdapterHooks): string {
    if (!event || typeof event !== 'object') return '';
    if (event.type === 'raw_model_stream_event') {
      return this.handleRawModelEvent(event.data, hooks);
    }
    if (event.type === 'agent_updated_stream_event') {
      const agentName = agentNameOf(event.agent);
      this.emit(this.currentAgent ? 'agent.updated' : 'agent.started', 'agent', { agentName });
      this.currentAgent = agentName;
      return '';
    }
    if (event.type === 'run_item_stream_event') {
      this.handleRunItemEvent(event, hooks);
    }
    return '';
  }

  private handleRawModelEvent(data: any, hooks: AgentStreamAdapterHooks): string {
    const type = data?.type;
    if (type !== 'output_text_delta' && type !== 'response.output_text.delta') return '';
    const text = typeof data?.delta === 'string' ? data.delta : '';
    if (!text) return '';
    if (this.options.structuredOutput) return text;
    this.emit('text.delta', 'model', { text, itemId: data.itemId ?? data.item_id });
    hooks.onLegacyEvent?.({ type: 'delta', text });
    return text;
  }

  private handleRunItemEvent(event: any, hooks: AgentStreamAdapterHooks): void {
    const item = event.item ?? {};
    const raw = item.rawItem ?? {};
    const itemType = item.type;
    const eventName = event.name;
    if (eventName === 'tool_called' || itemType === 'tool_call_item') {
      const name = toolNameOf(item);
      const callId = callIdOf(item);
      if (callId && name) this.toolNames.set(callId, name);
      this.emit('tool.started', sourceForTool(name), {
        toolName: name,
        callId,
        arguments: argumentsOf(item),
        serverId: serverIdOf(raw),
      });
      hooks.onLegacyEvent?.({
        type: 'tool',
        name,
        callId,
        args: argumentsOf(item),
      });
      return;
    }
    if (eventName === 'tool_output' || itemType === 'tool_call_output_item') {
      const callId = callIdOf(item);
      const name = toolNameOf(item) || this.toolNames.get(callId ?? '') || 'tool';
      const output = item.output;
      const summary = summarize(output);
      const parsed = parseStructuredToolResult(output);
      this.emit('tool.completed', sourceForTool(name), {
        toolName: name,
        callId,
        ok: summary.ok,
        summary: summary.text,
        ...(parsed ? { result: parsed } : {}),
        serverId: serverIdOf(raw),
      });
      hooks.onLegacyEvent?.({
        type: 'tool_result',
        name,
        ok: summary.ok,
        summary: summary.text,
        callId,
        result: parsed as ToolResult | undefined,
      });
      return;
    }
    if (eventName === 'tool_approval_requested' || itemType === 'tool_approval_item') {
      const name = toolNameOf(item);
      const approvalId = callIdOf(item) || `${name}:approval`;
      this.emit('approval.requested', 'approval', {
        approvalId,
        toolName: name,
        args: argumentsOf(item),
      });
      return;
    }
    if (eventName === 'handoff_requested' || itemType === 'handoff_call_item') {
      this.emit('handoff.started', 'handoff', {
        fromAgent: agentNameOf(item.agent),
        toAgent: targetAgentNameOf(item),
      });
      return;
    }
    if (eventName === 'handoff_occurred' || itemType === 'handoff_output_item') {
      this.emit('handoff.completed', 'handoff', {
        fromAgent: agentNameOf(item.sourceAgent),
        toAgent: agentNameOf(item.targetAgent),
      });
    }
  }

  private emit(type: AgentProtocolEvent['type'], source: AgentEventSource, payload: unknown): void {
    const event = this.factory.next({
      type,
      source,
      payload,
    });
    this.options.emit?.(event);
  }
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function agentNameOf(value: any): string {
  return typeof value?.name === 'string' && value.name ? value.name : 'agent';
}

function toolNameOf(item: any): string {
  const raw = item?.rawItem ?? item ?? {};
  return item?.toolName || item?.name || raw.name || raw.function?.name || 'tool';
}

function callIdOf(item: any): string | undefined {
  const raw = item?.rawItem ?? item ?? {};
  const value = item?.callId ?? item?.call_id ?? raw.callId ?? raw.call_id;
  return typeof value === 'string' && value ? value : undefined;
}

function argumentsOf(item: any): string {
  const raw = item?.rawItem ?? item ?? {};
  const value = item?.arguments ?? raw.arguments ?? '';
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}

function targetAgentNameOf(item: any): string {
  const raw = item?.rawItem ?? {};
  return agentNameOf(item?.targetAgent) !== 'agent'
    ? agentNameOf(item.targetAgent)
    : typeof raw.name === 'string' && raw.name ? raw.name : 'agent';
}

function serverIdOf(raw: any): string | undefined {
  const value = raw?.serverId ?? raw?.server_id ?? raw?.providerData?.serverId;
  return typeof value === 'string' && value ? value : undefined;
}

function sourceForTool(name: string): AgentEventSource {
  return name.includes('__') || name.startsWith('mcp_') ? 'mcp' : 'tool';
}

function summarize(value: unknown): { ok: boolean; text: string } {
  const flat = toolOutputText(value);
  let ok = true;
  try {
    const parsed = JSON.parse(flat) as { ok?: boolean; error?: unknown };
    ok = parsed?.ok !== false && parsed?.error === undefined;
  } catch {
    ok = !/reject|denied|error|拒绝|失败|错误|未返回|不允许/i.test(flat);
  }
  return { ok, text: flat.length > 200 ? `${flat.slice(0, 200)}…` : flat };
}

function parseStructuredToolResult(value: unknown): unknown | undefined {
  try {
    const flat = toolOutputText(value);
    return parseToolResult(JSON.parse(flat));
  } catch {
    return undefined;
  }
}

function toolOutputText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
      return JSON.stringify(part ?? '');
    }).join('');
  }
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text;
  }
  return JSON.stringify(value ?? '');
}
