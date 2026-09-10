import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { toolEffectSchema, toolResultSchema, toolRiskSchema, usageSummarySchema } from './results';

/** Increment when the wire shape changes incompatibly. */
export const AGENT_PROTOCOL_VERSION = 1 as const;

export const agentEventSourceSchema = z.enum([
  'runtime',
  'model',
  'agent',
  'tool',
  'handoff',
  'approval',
  // Reserved for the later MCP adapter. It is part of the protocol now so
  // consumers do not need a second event envelope when MCP is introduced.
  'mcp',
]);

export type AgentEventSource = z.infer<typeof agentEventSourceSchema>;

export const agentToolKindSchema = z.enum([
  'function',
  'hosted',
  'mcp',
  'computer',
  'shell',
  'web_search',
  'tool_search',
  'apply_patch',
  'unknown',
]);

export type AgentToolKind = z.infer<typeof agentToolKindSchema>;

/**
 * Provider-neutral item names. The adapter maps SDK wrapper names and
 * provider-specific names into this smaller vocabulary.
 */
export const agentRunItemTypeSchema = z.enum([
  'input_item',
  'message',
  'program',
  'program_output',
  'function_call',
  'function_call_result',
  'hosted_tool_call',
  'web_search_call',
  'web_search_output',
  'mcp_call',
  'mcp_call_result',
  'tool_search_call',
  'tool_search_output',
  'computer_call',
  'computer_call_result',
  'shell_call',
  'shell_call_output',
  'apply_patch_call',
  'apply_patch_call_output',
  'reasoning',
  'compaction',
  'handoff_call',
  'handoff_output',
  'tool_approval',
  'unknown',
]);

export type AgentRunItemType = z.infer<typeof agentRunItemTypeSchema>;

export const agentItemStatusSchema = z.enum([
  'in_progress',
  'completed',
  'incomplete',
  'failed',
  'requested',
  'resolved',
  'searching',
]);

export type AgentItemStatus = z.infer<typeof agentItemStatusSchema>;

const modelEventCategorySchema = z.enum([
  'lifecycle',
  'text',
  'reasoning',
  'tool',
  'input',
  'output',
  'unknown',
]);

const eventBase = z.object({
  protocolVersion: z.literal(AGENT_PROTOCOL_VERSION),
  eventId: z.string().min(1),
  runId: z.string().min(1),
  operationId: z.string().min(1).optional(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.string().min(1),
  source: agentEventSourceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  providerData: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const runStarted = eventBase.extend({
  type: z.literal('run.started'),
  source: z.literal('runtime'),
  payload: z.object({ userText: z.string() }).passthrough(),
});

const runProgress = eventBase.extend({
  type: z.literal('run.progress'),
  source: z.literal('runtime'),
  payload: z.object({ stage: z.string(), message: z.string().optional() }).passthrough(),
});

const runCompleted = eventBase.extend({
  type: z.literal('run.completed'),
  source: z.literal('runtime'),
  payload: z.object({ result: z.unknown().optional() }).passthrough(),
});

const runFailed = eventBase.extend({
  type: z.literal('run.failed'),
  source: z.literal('runtime'),
  payload: z.object({ error: z.string(), code: z.string().optional() }).passthrough(),
});

const runCancelled = eventBase.extend({
  type: z.literal('run.cancelled'),
  source: z.literal('runtime'),
  payload: z.object({ reason: z.string().optional() }).passthrough(),
});

const agentStarted = eventBase.extend({
  type: z.literal('agent.started'),
  source: z.literal('agent'),
  payload: z.object({ agentName: z.string() }).passthrough(),
});

const agentUpdated = eventBase.extend({
  type: z.literal('agent.updated'),
  source: z.literal('agent'),
  payload: z.object({ agentName: z.string(), reason: z.string().optional() }).passthrough(),
});

const textDelta = eventBase.extend({
  type: z.literal('text.delta'),
  source: z.enum(['model', 'agent']),
  payload: z.object({ text: z.string(), itemId: z.string().optional() }).passthrough(),
});

const toolStarted = eventBase.extend({
  type: z.literal('tool.started'),
  source: z.enum(['tool', 'mcp']),
  payload: z.object({
    toolName: z.string(),
    kind: agentToolKindSchema.optional(),
    callId: z.string().optional(),
    itemId: z.string().optional(),
    itemType: agentRunItemTypeSchema.optional(),
    arguments: z.string().optional(),
    risk: toolRiskSchema.optional(),
    effect: toolEffectSchema.optional(),
    serverId: z.string().optional(),
    action: z.unknown().optional(),
    details: z.unknown().optional(),
    status: agentItemStatusSchema.optional(),
  }).passthrough(),
});

const toolCompleted = eventBase.extend({
  type: z.literal('tool.completed'),
  source: z.enum(['tool', 'mcp']),
  payload: z.object({
    toolName: z.string(),
    kind: agentToolKindSchema.optional(),
    callId: z.string().optional(),
    itemId: z.string().optional(),
    itemType: agentRunItemTypeSchema.optional(),
    ok: z.boolean(),
    summary: z.string(),
    result: toolResultSchema.optional(),
    durationMs: z.number().nonnegative().optional(),
    serverId: z.string().optional(),
    details: z.unknown().optional(),
    status: agentItemStatusSchema.optional(),
  }).passthrough(),
});

const handoffStarted = eventBase.extend({
  type: z.literal('handoff.started'),
  source: z.literal('handoff'),
  payload: z.object({
    fromAgent: z.string(),
    toAgent: z.string(),
    reason: z.string().optional(),
    itemId: z.string().optional(),
    itemType: agentRunItemTypeSchema.optional(),
  }).passthrough(),
});

const handoffCompleted = eventBase.extend({
  type: z.literal('handoff.completed'),
  source: z.literal('handoff'),
  payload: z.object({
    fromAgent: z.string(),
    toAgent: z.string(),
    itemId: z.string().optional(),
    itemType: agentRunItemTypeSchema.optional(),
  }).passthrough(),
});

const approvalRequested = eventBase.extend({
  type: z.literal('approval.requested'),
  source: z.literal('approval'),
  payload: z.object({
    approvalId: z.string(),
    toolName: z.string(),
    args: z.string(),
    callId: z.string().optional(),
    itemId: z.string().optional(),
    itemType: agentRunItemTypeSchema.optional(),
    kind: agentToolKindSchema.optional(),
    risk: toolRiskSchema.optional(),
    expiresAt: z.string().optional(),
    details: z.unknown().optional(),
  }).passthrough(),
});

const approvalResolved = eventBase.extend({
  type: z.literal('approval.resolved'),
  source: z.literal('approval'),
  payload: z.object({
    approvalId: z.string(),
    approved: z.boolean(),
    reason: z.string().optional(),
    callId: z.string().optional(),
    itemId: z.string().optional(),
  }).passthrough(),
});

const usageUpdated = eventBase.extend({
  type: z.literal('usage.updated'),
  source: z.literal('runtime'),
  payload: usageSummarySchema,
});

const reasoningUpdated = eventBase.extend({
  type: z.literal('reasoning.updated'),
  source: z.literal('model'),
  payload: z.object({
    itemId: z.string().optional(),
    status: z.enum(['in_progress', 'completed', 'incomplete']),
    summary: z.string().optional(),
    characterCount: z.number().int().nonnegative(),
    /** True when the payload intentionally omits hidden reasoning content. */
    redacted: z.boolean(),
  }).passthrough(),
});

const toolUpdated = eventBase.extend({
  type: z.literal('tool.updated'),
  source: z.enum(['tool', 'mcp']),
  payload: z.object({
    toolName: z.string(),
    kind: agentToolKindSchema.optional(),
    callId: z.string().optional(),
    itemId: z.string().optional(),
    itemType: agentRunItemTypeSchema.optional(),
    status: z.string(),
    argumentsDelta: z.string().optional(),
    commandsDelta: z.string().optional(),
    outputDelta: z.string().optional(),
    details: z.unknown().optional(),
  }).passthrough(),
});

const runInput = eventBase.extend({
  type: z.literal('run.input'),
  source: z.literal('runtime'),
  payload: z.object({
    itemId: z.string().optional(),
    inputId: z.string().optional(),
    itemType: agentRunItemTypeSchema,
    status: agentItemStatusSchema.optional(),
    summary: z.string().optional(),
  }).passthrough(),
});

const contextCompacted = eventBase.extend({
  type: z.literal('context.compacted'),
  source: z.literal('runtime'),
  payload: z.object({
    itemId: z.string().optional(),
    itemType: z.literal('compaction'),
    status: agentItemStatusSchema.optional(),
    createdBy: z.string().optional(),
  }).passthrough(),
});

const itemObserved = eventBase.extend({
  type: z.literal('item.observed'),
  source: z.enum(['runtime', 'model', 'tool', 'mcp']),
  payload: z.object({
    itemType: agentRunItemTypeSchema,
    itemId: z.string().optional(),
    callId: z.string().optional(),
    status: z.string().optional(),
    summary: z.string().optional(),
  }).passthrough(),
});

const modelEvent = eventBase.extend({
  type: z.literal('model.event'),
  source: z.literal('model'),
  payload: z.object({
    eventType: z.string().min(1),
    category: modelEventCategorySchema,
    itemType: agentRunItemTypeSchema.optional(),
    itemId: z.string().optional(),
    callId: z.string().optional(),
    status: z.string().optional(),
    summary: z.string().optional(),
  }).passthrough(),
});

/** The stable, host/UI-facing event union. SDK raw events are adapted into it. */
export const agentEventSchema = z.discriminatedUnion('type', [
  runStarted,
  runProgress,
  runCompleted,
  runFailed,
  runCancelled,
  agentStarted,
  agentUpdated,
  textDelta,
  toolStarted,
  toolCompleted,
  handoffStarted,
  handoffCompleted,
  approvalRequested,
  approvalResolved,
  usageUpdated,
  reasoningUpdated,
  toolUpdated,
  runInput,
  contextCompacted,
  itemObserved,
  modelEvent,
]);

export type AgentProtocolEvent = z.infer<typeof agentEventSchema>;
export type AgentProtocolEventType = AgentProtocolEvent['type'];

export interface AgentEventInput {
  type: AgentProtocolEventType;
  runId: string;
  operationId?: string;
  sequence: number;
  source?: AgentEventSource;
  eventId?: string;
  timestamp?: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  providerData?: Record<string, unknown>;
}

const defaultSource: Record<AgentProtocolEventType, AgentEventSource> = {
  'run.started': 'runtime',
  'run.progress': 'runtime',
  'run.completed': 'runtime',
  'run.failed': 'runtime',
  'run.cancelled': 'runtime',
  'agent.started': 'agent',
  'agent.updated': 'agent',
  'text.delta': 'model',
  'tool.started': 'tool',
  'tool.completed': 'tool',
  'handoff.started': 'handoff',
  'handoff.completed': 'handoff',
  'approval.requested': 'approval',
  'approval.resolved': 'approval',
  'usage.updated': 'runtime',
  'reasoning.updated': 'model',
  'tool.updated': 'tool',
  'run.input': 'runtime',
  'context.compacted': 'runtime',
  'item.observed': 'model',
  'model.event': 'model',
};

/** Build and validate a protocol event at the boundary where it is emitted. */
export function createAgentEvent(input: AgentEventInput): AgentProtocolEvent {
  return agentEventSchema.parse({
    protocolVersion: AGENT_PROTOCOL_VERSION,
    eventId: input.eventId ?? randomUUID(),
    runId: input.runId,
    operationId: input.operationId,
    sequence: input.sequence,
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.type,
    source: input.source ?? defaultSource[input.type],
    payload: input.payload,
    metadata: input.metadata,
    providerData: input.providerData,
  });
}

export function parseAgentEvent(value: unknown): AgentProtocolEvent {
  return agentEventSchema.parse(value);
}

export type AgentEventDraft = Omit<AgentEventInput, 'runId' | 'operationId' | 'sequence'>;

/** Owns monotonic sequence allocation for one durable run. */
export class AgentEventFactory {
  private sequence: number;

  constructor(
    private readonly runId: string,
    private readonly operationId?: string,
    initialSequence = 0,
  ) {
    if (!Number.isSafeInteger(initialSequence) || initialSequence < 0) {
      throw new Error('initialSequence must be a non-negative safe integer');
    }
    this.sequence = initialSequence;
  }

  next(input: AgentEventDraft): AgentProtocolEvent {
    const event = createAgentEvent({
      ...input,
      runId: this.runId,
      operationId: this.operationId,
      sequence: this.sequence,
    } as AgentEventInput);
    this.sequence += 1;
    return event;
  }

  get nextSequence(): number {
    return this.sequence;
  }
}
