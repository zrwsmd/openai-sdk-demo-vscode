import { z } from 'zod';
import {
  type Artifact,
  type Diagnostic,
} from '../protocol/results';

// The wire protocol intentionally allows forward-compatible fields, but the
// model-facing Structured Outputs schema must be closed at every object node.
// Keep this boundary separate so protocol/MCP payloads can evolve without
// making the provider reject the Agent output schema.
const industrialDiagnosticSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'blocking']),
  path: z.string().nullable(),
}).strict();

const industrialArtifactSchema = z.object({
  kind: z.enum(['file', 'code', 'report', 'data', 'unknown']),
  name: z.string().min(1),
  uri: z.string().nullable(),
  mimeType: z.string().nullable(),
  content: z.string().nullable(),
}).strict();

const outputDataSchema = z.object({}).strict().nullable();

/**
 * The product-level final output contract used by the industrial Agent.
 * `message` remains suitable for the chat surface while diagnostics and
 * artifacts give non-UI hosts typed data to consume.
 * Tool-specific payloads are emitted through protocol tool results; keep the
 * final `data` field closed so strict provider schemas do not accept unknown
 * untyped branches.
 */
export const industrialAgentOutputSchema = z.object({
  message: z.string(),
  diagnostics: z.array(industrialDiagnosticSchema),
  artifacts: z.array(industrialArtifactSchema),
  data: outputDataSchema,
});

export type IndustrialAgentOutput = z.infer<typeof industrialAgentOutputSchema>;

export class AgentOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentOutputValidationError';
  }
}

export function parseIndustrialAgentOutput(value: unknown): IndustrialAgentOutput {
  try {
    return industrialAgentOutputSchema.parse(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new AgentOutputValidationError(`Agent 最终输出不符合 IndustrialAgentOutput Schema: ${detail}`);
  }
}

export interface AgentOutputDefinition<TOutput = unknown> {
  schema: z.ZodObject<any>;
  toText: (output: TOutput) => string;
  toProtocol: (output: TOutput) => {
    diagnostics: Diagnostic[];
    artifacts: Artifact[];
  };
}

export const industrialAgentOutputDefinition: AgentOutputDefinition<IndustrialAgentOutput> = {
  schema: industrialAgentOutputSchema,
  toText: (output) => output.message,
  toProtocol: (output) => ({
    diagnostics: output.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
      ...(diagnostic.path === null ? {} : { path: diagnostic.path }),
    })),
    artifacts: output.artifacts.map((artifact) => ({
      kind: artifact.kind,
      name: artifact.name,
      ...(artifact.uri === null ? {} : { uri: artifact.uri }),
      ...(artifact.mimeType === null ? {} : { mimeType: artifact.mimeType }),
      ...(artifact.content === null ? {} : { content: artifact.content }),
    })),
  }),
};

export function projectAgentOutput<TOutput>(
  definition: AgentOutputDefinition<TOutput>,
  output: TOutput,
): { text: string; diagnostics: Diagnostic[]; artifacts: Artifact[] } {
  const projected = definition.toProtocol(output);
  return {
    text: definition.toText(output),
    diagnostics: projected.diagnostics,
    artifacts: projected.artifacts,
  };
}
