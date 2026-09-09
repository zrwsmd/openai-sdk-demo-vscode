import { z } from 'zod';
import {
  artifactSchema,
  diagnosticSchema,
  type Artifact,
  type Diagnostic,
} from '../protocol/results';

/** Output modes are serializable so a durable run can be resumed safely. */
export type AgentOutputMode = 'text' | 'structured';

/**
 * The product-level final output contract used by the industrial Agent.
 * `message` remains suitable for the chat surface while diagnostics and
 * artifacts give non-UI hosts typed data to consume.
 */
export const industrialAgentOutputSchema = z.object({
  message: z.string(),
  diagnostics: z.array(diagnosticSchema).default([]),
  artifacts: z.array(artifactSchema).default([]),
  data: z.unknown().optional(),
});

export type IndustrialAgentOutput = z.infer<typeof industrialAgentOutputSchema>;

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
    diagnostics: output.diagnostics,
    artifacts: output.artifacts,
  }),
};

export function getAgentOutputDefinition(mode: AgentOutputMode = 'text'): AgentOutputDefinition<any> | undefined {
  return mode === 'structured' ? industrialAgentOutputDefinition : undefined;
}

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
