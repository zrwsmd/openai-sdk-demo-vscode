import {
  AgentEventFactory,
  type AgentEventSource,
  type AgentItemStatus,
  type AgentProtocolEvent,
  type AgentRunItemType,
  type AgentToolKind,
} from '../protocol/events';
import { parseToolResult } from '../protocol/results';

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

  async consume(stream: AsyncIterable<any>): Promise<AgentStreamAdapterResult> {
    let output = '';
    let summary = { inputTokens: 0, outputTokens: 0, requests: 0 };
    try {
      for await (const event of stream) {
        const text = this.handleEvent(event);
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

  private handleEvent(event: any): string {
    if (!event || typeof event !== 'object') return '';
    if (event.type === 'raw_model_stream_event') {
      return this.handleRawModelEvent(event.data);
    }
    if (event.type === 'agent_updated_stream_event') {
      const agentName = agentNameOf(event.agent);
      this.emit(this.currentAgent ? 'agent.updated' : 'agent.started', 'agent', { agentName });
      this.currentAgent = agentName;
      return '';
    }
    if (event.type === 'run_item_stream_event') {
      this.handleRunItemEvent(event);
      return '';
    }

    // These names are accepted as a convenience for hosts that expose the
    // provider stream directly instead of wrapping it in raw_model_stream_event.
    if (event.type === 'model' || event.type === 'response_started' || event.type === 'response_done') {
      return this.handleRawModelEvent(event.event ?? event.data ?? event);
    }

    // Never silently drop a provider event that is outside the known mapping.
    if (typeof event.type === 'string') {
      this.emitModelEvent(event);
    }
    return '';
  }

  private handleRawModelEvent(data: any): string {
    const raw = data?.type === 'model' && data.event ? data.event : data;
    const type = typeof raw?.type === 'string' ? raw.type : '';

    if (type === 'output_text_delta' || type === 'response.output_text.delta') {
      const text = typeof raw?.delta === 'string' ? raw.delta : '';
      if (!text) return '';
      if (!this.options.structuredOutput) {
        this.emit('text.delta', 'model', {
          text,
          itemId: itemIdOf(raw),
        });
      }
      return text;
    }

    const reasoningText = reasoningDeltaOf(raw);
    if (reasoningText !== undefined) {
      this.emit('reasoning.updated', 'model', {
        itemId: itemIdOf(raw),
        status: 'in_progress',
        characterCount: reasoningText.length,
        redacted: true,
      });
      return '';
    }

    if (type === 'response.reasoning_summary_text.delta') {
      const summary = stringValue(raw?.delta);
      this.emit('reasoning.updated', 'model', {
        itemId: itemIdOf(raw),
        status: 'in_progress',
        ...(summary ? { summary } : {}),
        characterCount: summary?.length ?? 0,
        redacted: false,
      });
      return '';
    }

    if (type === 'response.reasoning_summary_text.done') {
      const summary = safeSummaryText(raw);
      this.emit('reasoning.updated', 'model', {
        itemId: itemIdOf(raw),
        status: 'completed',
        ...(summary ? { summary } : {}),
        characterCount: summary?.length ?? 0,
        redacted: false,
      });
      return '';
    }

    if (type === 'response.reasoning_summary_part.added' || type === 'response.reasoning_summary_part.done') {
      const summary = safeSummaryText(raw?.part ?? raw);
      this.emit('reasoning.updated', 'model', {
        itemId: itemIdOf(raw),
        status: type.endsWith('.done') ? 'completed' : 'in_progress',
        ...(summary ? { summary } : {}),
        characterCount: summary?.length ?? 0,
        redacted: false,
      });
      return '';
    }

    if (type === 'response.reasoning_text.delta' || type === 'response.reasoning_text.done') {
      const text = stringValue(raw?.delta) ?? stringValue(raw?.text) ?? '';
      this.emit('reasoning.updated', 'model', {
        itemId: itemIdOf(raw),
        status: type.endsWith('.done') ? 'completed' : 'in_progress',
        characterCount: text.length,
        redacted: true,
      });
      return '';
    }

    if (type === 'response.function_call_arguments.delta' || type === 'response.function_call_arguments.done') {
      this.emitToolUpdate(raw, 'function', 'function_call', type.endsWith('.done') ? 'completed' : 'in_progress', {
        argumentsDelta: stringValue(raw?.delta) ?? stringValue(raw?.arguments),
      });
      return '';
    }

    if (type === 'response.mcp_call_arguments.delta' || type === 'response.mcp_call_arguments.done') {
      this.emitToolUpdate(raw, 'mcp', 'mcp_call', type.endsWith('.done') ? 'completed' : 'in_progress', {
        argumentsDelta: stringValue(raw?.delta) ?? stringValue(raw?.arguments),
      });
      return '';
    }

    if (type.startsWith('response.mcp_call.')) {
      this.emitToolUpdate(raw, 'mcp', 'mcp_call', responseEventStatus(type), {
        details: { providerEvent: type },
      });
      return '';
    }

    if (type.startsWith('response.web_search_call.')) {
      this.emitToolUpdate(raw, 'web_search', 'web_search_call', responseEventStatus(type), {
        details: { providerEvent: type },
      });
      return '';
    }

    if (type.startsWith('response.shell_call_command.')) {
      this.emitToolUpdate(raw, 'shell', 'shell_call', responseEventStatus(type), {
        commandsDelta: stringValue(raw?.delta) ?? stringValue(raw?.command),
      });
      return '';
    }

    if (type.startsWith('response.shell_call_output_content.')) {
      this.emitToolUpdate(raw, 'shell', 'shell_call_output', responseEventStatus(type), {
        outputDelta: stringValue(raw?.delta) ?? stringValue(raw?.text),
      });
      return '';
    }

    if (type === 'response.output_item.added' || type === 'response.output_item.done') {
      const item = raw?.item ?? {};
      this.emit('item.observed', 'model', {
        itemType: canonicalRawItemType(item),
        itemId: itemIdOf(item),
        callId: callIdOf(item),
        status: type.endsWith('.done') ? 'completed' : 'in_progress',
      });
      return '';
    }

    if (type === 'response.created' || type === 'response.completed' || type === 'response.incomplete'
      || type === 'response.failed' || type === 'response_started' || type === 'response_done') {
      this.emitModelEvent(raw);
      return '';
    }

    if (type) {
      this.emitModelEvent(raw);
    }
    return '';
  }

  private handleRunItemEvent(event: any): void {
    const item = event.item ?? {};
    const raw = item.rawItem ?? {};
    const itemType = canonicalItemTypeOf(item, raw);
    const eventName = typeof event.name === 'string' ? event.name : '';
    const itemId = itemIdOf(item);
    const callId = callIdOf(item);

    if (eventName === 'message_output_created' || item.type === 'message_output_item') {
      this.emit('item.observed', 'model', {
        itemType: 'message',
        itemId,
        status: 'completed',
      });
      return;
    }

    if (eventName === 'reasoning_item_created' || item.type === 'reasoning_item') {
      this.emit('reasoning.updated', 'model', {
        itemId,
        status: reasoningItemStatusOf(raw, item),
        characterCount: reasoningCharacterCountOf(raw),
        redacted: true,
      });
      return;
    }

    if (eventName === 'compaction_item_created' || item.type === 'compaction_item') {
      this.emit('context.compacted', 'runtime', {
        itemId,
        itemType: 'compaction',
        status: itemStatusOf(raw, item, 'completed'),
        createdBy: stringValue(raw.createdBy) ?? stringValue(raw.created_by),
      });
      return;
    }

    if (eventName === 'tool_search_called' || item.type === 'tool_search_call_item') {
      this.emitToolStarted(item, 'tool_search', 'tool_search_call', 'tool_search');
      return;
    }

    if (eventName === 'tool_search_output_created' || item.type === 'tool_search_output_item') {
      const name = this.toolNames.get(callId ?? '') ?? 'tool_search';
      const output = item.output ?? raw.output ?? raw.tools;
      this.emit('tool.completed', 'tool', {
        toolName: name,
        kind: 'tool_search',
        callId,
        itemId,
        itemType: 'tool_search_output',
        ok: true,
        summary: toolSearchSummary(output),
        details: toolSearchDetails(output),
        status: 'completed',
      });
      return;
    }

    if (eventName === 'tool_called' || item.type === 'tool_call_item') {
      const kind = toolKindOf(item);
      const name = displayToolName(item, kind);
      this.emitToolStarted(item, kind, itemType, name);
      return;
    }

    if (eventName === 'tool_output' || item.type === 'tool_call_output_item') {
      const kind = toolKindOf(item);
      const name = this.toolNames.get(callId ?? '') ?? displayToolName(item, kind);
      const output = item.output ?? raw.output;
      const summary = summarizeToolOutput(output, raw, kind);
      const parsed = kind === 'function' || kind === 'mcp' ? parseStructuredToolResult(output) : undefined;
      this.emit('tool.completed', sourceForTool(name, kind), {
        toolName: name,
        kind,
        callId,
        itemId,
        itemType,
        ok: toolOutputOk(output, raw, summary.ok),
        summary: summary.text,
        ...(parsed ? { result: parsed } : {}),
        serverId: serverIdOf(raw),
        details: toolDetailsOf(raw, output, kind),
        status: itemStatusOf(raw, item, 'completed'),
      });
      return;
    }

    if (eventName === 'tool_approval_requested' || item.type === 'tool_approval_item') {
      const kind = toolKindOf(item);
      const name = displayToolName(item, kind);
      const approvalId = callId ?? itemId ?? `${name}:approval`;
      this.emit('approval.requested', 'approval', {
        approvalId,
        toolName: name,
        args: argumentsOf(item),
        callId,
        itemId,
        itemType,
        kind,
        details: toolDetailsOf(raw, undefined, kind),
      });
      return;
    }

    if (eventName === 'handoff_requested' || item.type === 'handoff_call_item') {
      this.emit('handoff.started', 'handoff', {
        fromAgent: agentNameOf(item.agent),
        toAgent: targetAgentNameOf(item),
        itemId,
        itemType: 'handoff_call',
      });
      return;
    }

    if (eventName === 'handoff_occurred' || item.type === 'handoff_output_item') {
      this.emit('handoff.completed', 'handoff', {
        fromAgent: agentNameOf(item.sourceAgent),
        toAgent: agentNameOf(item.targetAgent),
        itemId,
        itemType: 'handoff_output',
      });
      return;
    }

    if (item.type === 'run_input_item' || itemType === 'input_item' || eventName === 'input_item_created') {
      this.emit('run.input', 'runtime', {
        itemId,
        inputId: stringValue(item.inputId)
          ?? stringValue(item.input_id)
          ?? stringValue(raw.id)
          ?? stringValue(raw.inputId)
          ?? stringValue(raw.input_id),
        itemType: 'input_item',
        status: itemStatusOf(raw, item),
      });
      return;
    }

    // A new SDK item should remain observable even before it gets a specialized
    // product event. Only safe metadata is forwarded here.
    this.emit('item.observed', itemObservedSource(itemType), {
      itemType,
      itemId,
      callId,
      status: itemStatusOf(raw, item),
      summary: safeItemSummary(item, raw),
    });
  }

  private emitToolStarted(item: any, kind: AgentToolKind, itemType: AgentRunItemType, fallbackName?: string): void {
    const raw = item?.rawItem ?? item ?? {};
    const name = displayToolName(item, kind, fallbackName);
    const callId = callIdOf(item);
    if (callId && name) this.toolNames.set(callId, name);
    this.emit('tool.started', sourceForTool(name, kind), {
      toolName: name,
      kind,
      callId,
      itemId: itemIdOf(item),
      itemType,
      arguments: argumentsOf(item),
      serverId: serverIdOf(raw),
      action: safeActionOf(raw),
      details: toolDetailsOf(raw, undefined, kind),
      status: 'in_progress',
    });
  }

  private emitToolUpdate(
    raw: any,
    kind: AgentToolKind,
    itemType: AgentRunItemType,
    status: AgentItemStatus,
    fields: {
      argumentsDelta?: string;
      commandsDelta?: string;
      outputDelta?: string;
      details?: unknown;
    },
  ): void {
    const callId = callIdOf(raw);
    const name = toolNameFromRaw(raw, kind);
    if (callId && name) this.toolNames.set(callId, name);
    this.emit('tool.updated', sourceForTool(name, kind), {
      toolName: name,
      kind,
      callId,
      itemId: itemIdOf(raw),
      itemType,
      status,
      ...withoutUndefined(fields),
    });
  }

  private emitModelEvent(raw: any): void {
    const eventType = typeof raw?.type === 'string' ? raw.type : 'unknown';
    const item = raw?.item ?? raw?.output_item;
    this.emit('model.event', 'model', {
      eventType,
      category: modelEventCategoryOf(eventType),
      itemType: item ? canonicalRawItemType(item) : modelEventItemTypeOf(eventType),
      itemId: itemIdOf(item ?? raw),
      callId: callIdOf(item ?? raw),
      status: responseEventStatusOrUndefined(eventType),
      summary: modelEventSummary(eventType),
    });
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
  return item?.toolName || item?.name || raw.name || raw.tool_name || raw.function?.name || 'tool';
}

function toolNameFromRaw(raw: any, kind: AgentToolKind): string {
  const name = toolNameOf(raw);
  return name !== 'tool' ? name : defaultToolName(kind);
}

function displayToolName(item: any, kind: AgentToolKind, fallbackName?: string): string {
  const name = toolNameOf(item);
  return name !== 'tool' ? name : fallbackName ?? defaultToolName(kind);
}

function defaultToolName(kind: AgentToolKind): string {
  switch (kind) {
    case 'computer':
      return 'computer';
    case 'shell':
      return 'shell';
    case 'web_search':
      return 'web_search';
    case 'tool_search':
      return 'tool_search';
    case 'apply_patch':
      return 'apply_patch';
    case 'mcp':
      return 'mcp';
    case 'function':
      return 'function';
    case 'hosted':
      return 'hosted_tool';
    default:
      return 'tool';
  }
}

function callIdOf(item: any): string | undefined {
  const raw = item?.rawItem ?? item ?? {};
  const value = item?.callId ?? item?.call_id ?? raw.callId ?? raw.call_id;
  return typeof value === 'string' && value ? value : undefined;
}

function itemIdOf(item: any): string | undefined {
  const raw = item?.rawItem ?? item ?? {};
  const value = item?.itemId ?? item?.item_id ?? item?.id ?? raw.itemId ?? raw.item_id ?? raw.id;
  return typeof value === 'string' && value ? value : undefined;
}

function argumentsOf(item: any): string {
  const raw = item?.rawItem ?? item ?? {};
  const value = item?.arguments
    ?? raw.arguments
    ?? raw.action
    ?? raw.actions
    ?? raw.operation
    ?? raw.patch;
  return serializeValue(value);
}

function targetAgentNameOf(item: any): string {
  const raw = item?.rawItem ?? {};
  return agentNameOf(item?.targetAgent) !== 'agent'
    ? agentNameOf(item.targetAgent)
    : typeof item?.toAgent === 'string' && item.toAgent
      ? item.toAgent
      : typeof raw.name === 'string' && raw.name ? raw.name : 'agent';
}

function serverIdOf(raw: any): string | undefined {
  const value = raw?.serverId ?? raw?.server_id ?? raw?.providerData?.serverId;
  return typeof value === 'string' && value ? value : undefined;
}

function sourceForTool(name: string, kind: AgentToolKind = 'unknown'): AgentEventSource {
  return kind === 'mcp' || name.includes('__') || name.startsWith('mcp_') ? 'mcp' : 'tool';
}

function canonicalItemTypeOf(item: any, raw: any): AgentRunItemType {
  const rawType = typeof raw?.type === 'string' ? raw.type : '';
  if (rawType) return canonicalRawItemType(raw);

  switch (item?.type) {
    case 'run_input_item':
      return 'input_item';
    case 'message_output_item':
      return 'message';
    case 'tool_call_item':
      return 'function_call';
    case 'tool_call_output_item':
      return 'function_call_result';
    case 'tool_search_call_item':
      return 'tool_search_call';
    case 'tool_search_output_item':
      return 'tool_search_output';
    case 'reasoning_item':
      return 'reasoning';
    case 'compaction_item':
      return 'compaction';
    case 'handoff_call_item':
      return 'handoff_call';
    case 'handoff_output_item':
      return 'handoff_output';
    case 'tool_approval_item':
      return 'tool_approval';
    default:
      return 'unknown';
  }
}

function canonicalRawItemType(raw: any): AgentRunItemType {
  const type = typeof raw?.type === 'string' ? raw.type : '';
  switch (type) {
    case 'input_item':
    case 'message':
    case 'program':
    case 'program_output':
    case 'function_call':
    case 'function_call_result':
    case 'hosted_tool_call':
    case 'tool_search_call':
    case 'tool_search_output':
    case 'computer_call':
    case 'computer_call_result':
    case 'shell_call':
    case 'shell_call_output':
    case 'apply_patch_call':
    case 'apply_patch_call_output':
    case 'reasoning':
    case 'compaction':
    case 'handoff_call':
    case 'handoff_output':
    case 'tool_approval':
      return type;
    case 'web_search_call':
      return 'web_search_call';
    case 'web_search_output':
      return 'web_search_output';
    case 'mcp_call':
      return 'mcp_call';
    case 'mcp_call_result':
      return 'mcp_call_result';
    default:
      return 'unknown';
  }
}

function toolKindOf(item: any): AgentToolKind {
  const raw = item?.rawItem ?? item ?? {};
  const type = canonicalRawItemType(raw);
  if (type === 'computer_call' || type === 'computer_call_result') return 'computer';
  if (type === 'shell_call' || type === 'shell_call_output') return 'shell';
  if (type === 'apply_patch_call' || type === 'apply_patch_call_output') return 'apply_patch';
  if (type === 'program' || type === 'program_output') return 'hosted';
  if (type === 'tool_search_call' || type === 'tool_search_output') return 'tool_search';
  if (type === 'web_search_call' || type === 'web_search_output') return 'web_search';
  if (type === 'mcp_call' || type === 'mcp_call_result') return 'mcp';

  const providerType = stringValue(raw?.providerData?.type);
  if (providerType?.includes('web_search')) return 'web_search';
  if (providerType?.includes('mcp')) return 'mcp';

  const name = toolNameOf(item);
  if (name.includes('__') || name.startsWith('mcp_')) return 'mcp';
  if (type === 'hosted_tool_call') return 'hosted';
  return 'function';
}

function itemStatusOf(raw: any, item: any, fallback?: AgentItemStatus): AgentItemStatus | undefined {
  const value = stringValue(raw?.status) ?? stringValue(item?.status);
  if (isAgentItemStatus(value)) return value;
  return fallback;
}

function reasoningItemStatusOf(raw: any, item: any): 'in_progress' | 'completed' | 'incomplete' {
  const status = itemStatusOf(raw, item, 'completed');
  return status === 'in_progress' ? 'in_progress' : status === 'incomplete' ? 'incomplete' : 'completed';
}

function responseEventStatus(type: string): AgentItemStatus {
  if (/failed|error/i.test(type)) return 'failed';
  if (/incomplete/i.test(type)) return 'incomplete';
  if (/completed|done/i.test(type)) return 'completed';
  if (/searching/i.test(type)) return 'searching';
  return 'in_progress';
}

function responseEventStatusOrUndefined(type: string): AgentItemStatus | undefined {
  return /failed|error|incomplete|completed|done|searching|in_progress|started|created|added|delta/i.test(type)
    ? responseEventStatus(type)
    : undefined;
}

function isAgentItemStatus(value: string | undefined): value is AgentItemStatus {
  return value === 'in_progress'
    || value === 'completed'
    || value === 'incomplete'
    || value === 'failed'
    || value === 'requested'
    || value === 'resolved'
    || value === 'searching';
}

function reasoningDeltaOf(raw: any): string | undefined {
  const direct = stringValue(raw?.reasoning_content) ?? stringValue(raw?.reasoning);
  if (direct !== undefined) return direct;
  const choiceDelta = raw?.choices?.[0]?.delta;
  return stringValue(choiceDelta?.reasoning_content) ?? stringValue(choiceDelta?.reasoning);
}

function safeSummaryText(value: any): string | undefined {
  if (typeof value === 'string') return value;
  return stringValue(value?.text)
    ?? stringValue(value?.summary)
    ?? stringValue(value?.delta)
    ?? stringValue(value?.part?.text)
    ?? stringValue(value?.part?.summary);
}

function reasoningCharacterCountOf(raw: any): number {
  const content = raw?.rawContent ?? raw?.content ?? raw?.summary;
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  return content.reduce((total: number, part: any) => {
    const text = stringValue(part?.text) ?? stringValue(part?.value);
    return total + (text?.length ?? 0);
  }, 0);
}

function safeActionOf(raw: any): unknown {
  if (raw?.action !== undefined) return raw.action;
  if (raw?.actions !== undefined) return raw.actions;
  if (raw?.operation !== undefined) return raw.operation;
  return undefined;
}

function toolDetailsOf(raw: any, output: unknown, kind: AgentToolKind): Record<string, unknown> | undefined {
  switch (kind) {
    case 'computer':
      return withoutUndefined({
        action: safeActionOf(raw),
        outputType: outputTypeOf(raw?.output ?? output),
      });
    case 'shell':
      return withoutUndefined({
        command: raw?.command,
        commands: raw?.commands ?? raw?.action?.commands,
        output: shellOutputSummary(raw?.output ?? output),
        outcome: raw?.outcome ?? raw?.output?.outcome,
      });
    case 'web_search':
      return withoutUndefined({
        providerEvent: raw?.providerData?.type ?? raw?.type,
        status: raw?.status,
      });
    case 'tool_search':
      return toolSearchDetails(raw?.output ?? raw?.tools ?? output);
    case 'apply_patch':
      return withoutUndefined({
        operation: raw?.operation ?? raw?.patch,
        status: raw?.status,
      });
    default:
      return undefined;
  }
}

function outputTypeOf(value: any): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((part) => typeof part?.type === 'string');
    return stringValue(first?.type);
  }
  return stringValue(value?.type);
}

function summarizeToolOutput(value: unknown, raw: any, kind: AgentToolKind): { ok: boolean; text: string } {
  if (kind === 'computer') return { ok: true, text: 'computer result received' };
  if (kind === 'shell') return summarize(shellOutputSummary(raw?.output ?? value));
  return summarize(value);
}

function toolOutputOk(value: unknown, raw: any, fallback: boolean): boolean {
  if (raw?.status === 'failed' || raw?.status === 'incomplete') return false;
  const output = raw?.output ?? value;
  const outcomes = Array.isArray(output)
    ? output.map((part) => part?.outcome)
    : [raw?.outcome ?? output?.outcome];
  for (const outcome of outcomes) {
    if (typeof outcome === 'string' && /timeout|fail|error/i.test(outcome)) return false;
    if (outcome?.type === 'timeout') return false;
    if (typeof outcome?.exitCode === 'number' && outcome.exitCode !== 0) return false;
    if (typeof outcome?.exit_code === 'number' && outcome.exit_code !== 0) return false;
  }
  return fallback;
}

function shellOutputSummary(value: unknown): string {
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) {
    const parts = value.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const stdout = stringValue(part.stdout);
        const stderr = stringValue(part.stderr);
        const outcome = part.outcome?.type === 'timeout'
          ? 'timeout'
          : typeof part.outcome?.exitCode === 'number'
            ? `exit ${part.outcome.exitCode}`
            : typeof part.outcome?.exit_code === 'number'
              ? `exit ${part.outcome.exit_code}`
              : undefined;
        return [stdout, stderr, outcome].filter(Boolean).join(' ');
      }
      return '';
    }).filter(Boolean);
    return parts.join('\n').slice(0, 500);
  }
  return toolOutputText(value).slice(0, 500);
}

function toolSearchSummary(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} tools loaded`;
  if (value && typeof value === 'object' && Array.isArray((value as { tools?: unknown[] }).tools)) {
    return `${(value as { tools: unknown[] }).tools.length} tools loaded`;
  }
  return 'tool search completed';
}

function toolSearchDetails(value: unknown): Record<string, unknown> | undefined {
  const count = Array.isArray(value)
    ? value.length
    : value && typeof value === 'object' && Array.isArray((value as { tools?: unknown[] }).tools)
      ? (value as { tools: unknown[] }).tools.length
      : undefined;
  return count === undefined ? undefined : { toolCount: count };
}

function safeItemSummary(item: any, raw: any): string | undefined {
  const status = stringValue(raw?.status) ?? stringValue(item?.status);
  if (status) return status;
  return undefined;
}

function itemObservedSource(itemType: AgentRunItemType): AgentEventSource {
  if (itemType === 'input_item' || itemType === 'compaction') return 'runtime';
  if (itemType === 'mcp_call' || itemType === 'mcp_call_result') return 'mcp';
  if (itemType === 'function_call' || itemType === 'function_call_result'
    || itemType === 'program' || itemType === 'program_output'
    || itemType === 'hosted_tool_call' || itemType === 'tool_search_call'
    || itemType === 'tool_search_output' || itemType === 'computer_call'
    || itemType === 'computer_call_result' || itemType === 'shell_call'
    || itemType === 'shell_call_output' || itemType === 'apply_patch_call'
    || itemType === 'apply_patch_call_output' || itemType === 'web_search_call'
    || itemType === 'web_search_output' || itemType === 'tool_approval') {
    return 'tool';
  }
  return 'model';
}

function modelEventCategoryOf(type: string): 'lifecycle' | 'text' | 'reasoning' | 'tool' | 'input' | 'output' | 'unknown' {
  if (/reasoning/i.test(type)) return 'reasoning';
  if (/function_call|mcp_call|shell_call|web_search|tool_search|hosted_tool|computer_call|apply_patch|tool/i.test(type)) {
    return 'tool';
  }
  if (/input/i.test(type)) return 'input';
  if (/output_text|refusal/i.test(type)) return 'text';
  if (/output|annotation|content_part/i.test(type)) return 'output';
  if (/created|completed|done|failed|incomplete|started/i.test(type)) return 'lifecycle';
  return 'unknown';
}

function modelEventItemTypeOf(type: string): AgentRunItemType | undefined {
  if (/function_call/i.test(type)) return 'function_call';
  if (/mcp_call/i.test(type)) return 'mcp_call';
  if (/shell_call/i.test(type)) return 'shell_call';
  if (/web_search/i.test(type)) return 'web_search_call';
  if (/computer_call/i.test(type)) return 'computer_call';
  if (/apply_patch/i.test(type)) return 'apply_patch_call';
  if (/reasoning/i.test(type)) return 'reasoning';
  if (/compaction/i.test(type)) return 'compaction';
  return undefined;
}

function modelEventSummary(type: string): string | undefined {
  if (type === 'response_started' || type === 'response.created') return 'model response started';
  if (type === 'response_done' || type === 'response.completed') return 'model response completed';
  if (type === 'response.failed') return 'model response failed';
  if (type === 'response.incomplete') return 'model response incomplete';
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function serializeValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
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
