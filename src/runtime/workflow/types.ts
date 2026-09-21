import type { AgentInputItem } from "@openai/agents";
import type { Artifact, ToolResult } from "../../protocol/results";
import type { CompletionGateResult } from "../completionGate";
import type { DeliveryContract } from "../deliveryContract";
import type { PipelineStagePlan } from "../pipeline/stagePlan";
import type { DeliveryWorkflowRuntimeState } from "./runtimeState";

export type WorkflowId = string;

export type WorkflowToolRecord = {
  name: string;
  args: string;
  result: ToolResult;
  order?: number;
};

export type WorkflowStage = {
  order: number;
  id: string;
  toolName?: string;
  title: string;
  description: string;
  successEvidence: string;
  onFailure: "retry" | "revise_draft" | "stop";
};

export type DeliveryWorkflowDescriptor = {
  id: string;
  title: string;
  stages: Array<{
    order: number;
    id: string;
    toolName?: string;
    title: string;
    description: string;
    successEvidence: string;
    onFailure: WorkflowStage["onFailure"];
  }>;
};

export interface DeliveryWorkflow {
  readonly id: string;
  readonly title: string;
  readonly stages: WorkflowStage[];
  readonly pipelinePlan?: PipelineStagePlan;
  readonly visibleToolNames?: readonly string[];
  readonly parallelToolCalls: boolean;
  readonly validationInputMode?: "inline_code" | "path_or_code";
  readonly requiredActionTool?: string;
  initialTool(options: { isResume: boolean }): string | undefined;
  instructions(): string;
  recordSuccessfulValidation?(content: string, hash: string): void;
  canWriteContent?(content: string): boolean;
  chooseRepairTool(
    gate: Exclude<CompletionGateResult, { passed: true }>,
    records: WorkflowToolRecord[],
    availableToolNames: Set<string>,
  ): string | undefined;
  authoritativeMessage(records: WorkflowToolRecord[]): string | undefined;
  hydrate(records: WorkflowToolRecord[]): void;
  verifyRequiredAction(call: WorkflowToolRecord): Artifact | undefined;
}

export type WorkflowDecisionSource =
  | "jev"
  | "local"
  | "model"
  | "fallback";

export type WorkflowFallbackMode =
  | "general_chat"
  | "read_only"
  | "file_edit"
  | "needs_clarification"
  | "blocked_high_risk";

export interface WorkflowDecisionContext {
  userText: string;
  history?: AgentInputItem[];
}

export interface WorkflowLocalMatch {
  matched: boolean;
  confidence: number;
  reason: string;
}

export interface WorkflowDescriptor {
  id: WorkflowId;
  title: string;
  description: string;
  runtimeManaged: boolean;
  workflowRoute?: string;
  visibleToolNames?: readonly string[];
  pipelinePlan?: PipelineStagePlan;
  describe(): DeliveryWorkflowDescriptor;
  matchesDeliveryContract?(contract: DeliveryContract | undefined): boolean;
  createDeliveryContract(options?: {
    reason?: string;
    source?: WorkflowDecisionSource;
  }): DeliveryContract | undefined;
  localMatch?(context: WorkflowDecisionContext): WorkflowLocalMatch;
  createRuntime?(
    contract: DeliveryContract | undefined,
    state: DeliveryWorkflowRuntimeState,
  ): DeliveryWorkflow | undefined;
}

export interface WorkflowSelectedDecision {
  kind: "workflow";
  workflow: WorkflowDescriptor;
  source: WorkflowDecisionSource;
  confidence: number;
  reason: string;
  deliveryContract?: DeliveryContract;
}

export interface WorkflowFallbackDecision {
  kind: "fallback";
  mode: WorkflowFallbackMode;
  source: WorkflowDecisionSource;
  confidence: number;
  reason: string;
  allowedTools?: readonly string[];
}

export type WorkflowDecision = WorkflowSelectedDecision | WorkflowFallbackDecision;

export type WorkflowModelDecision =
  | {
      kind: "workflow";
      workflowId: WorkflowId;
      confidence: number;
      reason: string;
    }
  | {
      kind: "fallback";
      mode: WorkflowFallbackMode;
      confidence: number;
      reason: string;
      allowedTools?: readonly string[];
    };
