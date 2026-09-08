import { z } from 'zod';

/** Shared wire version for tool and agent results. */
export const RESULT_PROTOCOL_VERSION = 1 as const;

export const toolRiskSchema = z.enum(['read', 'plan', 'write', 'execute']);
export type ToolRisk = z.infer<typeof toolRiskSchema>;

export const toolEffectSchema = z.enum(['none', 'filesystem', 'process', 'device']);
export type ToolEffect = z.infer<typeof toolEffectSchema>;

export const diagnosticSeveritySchema = z.enum(['info', 'warning', 'error', 'blocking']);
export type DiagnosticSeverity = z.infer<typeof diagnosticSeveritySchema>;

export const diagnosticSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  severity: diagnosticSeveritySchema,
  path: z.string().optional(),
  details: z.unknown().optional(),
}).passthrough();
export type Diagnostic = z.infer<typeof diagnosticSchema>;

export const artifactSchema = z.object({
  kind: z.enum(['file', 'code', 'report', 'data', 'unknown']),
  name: z.string().min(1),
  uri: z.string().optional(),
  mimeType: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();
export type Artifact = z.infer<typeof artifactSchema>;

export const approvalRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  args: z.string(),
  risk: toolRiskSchema.optional(),
  expiresAt: z.string().optional(),
}).passthrough();
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

export const usageSummarySchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
}).passthrough();
export type UsageSummary = z.infer<typeof usageSummarySchema>;

export const toolResultSchema = z.object({
  protocolVersion: z.literal(RESULT_PROTOCOL_VERSION).default(RESULT_PROTOCOL_VERSION),
  ok: z.boolean(),
  data: z.unknown().optional(),
  diagnostics: z.array(diagnosticSchema).default([]),
  error: z.string().optional(),
  effect: toolEffectSchema,
  risk: toolRiskSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();
export type ToolResult<T = unknown> = Omit<z.infer<typeof toolResultSchema>, 'data'> & { data?: T };

export interface ToolResultInput<T = unknown> {
  ok: boolean;
  data?: T;
  diagnostics?: Diagnostic[];
  error?: string;
  effect: ToolEffect;
  risk: ToolRisk;
  metadata?: Record<string, unknown>;
}

const agentResultCommon = {
  protocolVersion: z.literal(RESULT_PROTOCOL_VERSION).default(RESULT_PROTOCOL_VERSION),
  output: z.unknown().optional(),
  usage: usageSummarySchema.optional(),
  diagnostics: z.array(diagnosticSchema).default([]),
  artifacts: z.array(artifactSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

export const agentResultSchema = z.discriminatedUnion('status', [
  z.object({ ...agentResultCommon, status: z.literal('completed') }).passthrough(),
  z.object({
    ...agentResultCommon,
    status: z.literal('awaiting_approval'),
    state: z.string().min(1),
    approvals: z.array(approvalRequestSchema).min(1),
  }).passthrough(),
  z.object({ ...agentResultCommon, status: z.literal('cancelled'), reason: z.string().optional() }).passthrough(),
  z.object({ ...agentResultCommon, status: z.literal('failed'), error: z.string().min(1) }).passthrough(),
  z.object({ ...agentResultCommon, status: z.literal('refused'), reason: z.string().min(1) }).passthrough(),
]);

export type AgentResultStatus = z.infer<typeof agentResultSchema>['status'];
type AgentResultBase<T> = {
  protocolVersion: typeof RESULT_PROTOCOL_VERSION;
  output?: T;
  usage?: UsageSummary;
  diagnostics: Diagnostic[];
  artifacts: Artifact[];
  metadata?: Record<string, unknown>;
};
export type AgentResult<T = unknown> = AgentResultBase<T> & (
  | { status: 'completed' }
  | { status: 'awaiting_approval'; state: string; approvals: ApprovalRequest[] }
  | { status: 'cancelled'; reason?: string }
  | { status: 'failed'; error: string }
  | { status: 'refused'; reason: string }
);

type AgentResultInputBase<T> = Omit<AgentResultBase<T>, 'protocolVersion' | 'diagnostics' | 'artifacts'> & {
  diagnostics?: Diagnostic[];
  artifacts?: Artifact[];
};
export type AgentResultInput<T = unknown> = AgentResultInputBase<T> & (
  | { status: 'completed' }
  | { status: 'awaiting_approval'; state: string; approvals: ApprovalRequest[] }
  | { status: 'cancelled'; reason?: string }
  | { status: 'failed'; error: string }
  | { status: 'refused'; reason: string }
);

export function createToolResult<T>(result: ToolResultInput<T>): ToolResult<T> {
  return toolResultSchema.parse(result) as ToolResult<T>;
}

export function parseToolResult<T = unknown>(value: unknown): ToolResult<T> {
  return toolResultSchema.parse(value) as ToolResult<T>;
}

export function createAgentResult<T>(result: AgentResultInput<T>): AgentResult<T> {
  return agentResultSchema.parse(result) as AgentResult<T>;
}

export function parseAgentResult<T = unknown>(value: unknown): AgentResult<T> {
  return agentResultSchema.parse(value) as AgentResult<T>;
}
