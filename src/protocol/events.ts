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
    callId: z.string().optional(),
    arguments: z.string().optional(),
    risk: toolRiskSchema.optional(),
    effect: toolEffectSchema.optional(),
    serverId: z.string().optional(),
  }).passthrough(),
});

const toolCompleted = eventBase.extend({
  type: z.literal('tool.completed'),
  source: z.enum(['tool', 'mcp']),
  payload: z.object({
    toolName: z.string(),
    callId: z.string().optional(),
    ok: z.boolean(),
    summary: z.string(),
    result: toolResultSchema.optional(),
    durationMs: z.number().nonnegative().optional(),
    serverId: z.string().optional(),
  }).passthrough(),
});

const handoffStarted = eventBase.extend({
  type: z.literal('handoff.started'),
  source: z.literal('handoff'),
  payload: z.object({ fromAgent: z.string(), toAgent: z.string(), reason: z.string().optional() }).passthrough(),
});

const handoffCompleted = eventBase.extend({
  type: z.literal('handoff.completed'),
  source: z.literal('handoff'),
  payload: z.object({ fromAgent: z.string(), toAgent: z.string() }).passthrough(),
});

const approvalRequested = eventBase.extend({
  type: z.literal('approval.requested'),
  source: z.literal('approval'),
  payload: z.object({
    approvalId: z.string(),
    toolName: z.string(),
    args: z.string(),
    risk: toolRiskSchema.optional(),
    expiresAt: z.string().optional(),
  }).passthrough(),
});

const approvalResolved = eventBase.extend({
  type: z.literal('approval.resolved'),
  source: z.literal('approval'),
  payload: z.object({
    approvalId: z.string(),
    approved: z.boolean(),
    reason: z.string().optional(),
  }).passthrough(),
});

const usageUpdated = eventBase.extend({
  type: z.literal('usage.updated'),
  source: z.literal('runtime'),
  payload: usageSummarySchema,
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
