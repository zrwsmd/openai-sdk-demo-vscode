import type { ToolResult } from "../../protocol/results";

export type PipelineToolEventInput = {
  toolName?: string;
  args?: string;
  callId?: string;
  itemId?: string;
};

export type PipelineResultTransition = {
  fromToolName: string;
  toToolName: string;
  reason: string;
  canTransition(result: ToolResult): boolean;
};

export type PipelineToolFingerprintRule = {
  toolName: string;
  fingerprint(event: PipelineToolEventInput): string | undefined;
};

export type PipelineStagePlan = {
  id: string;
  resultTransitions?: readonly PipelineResultTransition[];
  duplicateToolFingerprints?: readonly PipelineToolFingerprintRule[];
};
