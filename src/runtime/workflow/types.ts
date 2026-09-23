import type { AgentInputItem } from "@openai/agents";
import type { Artifact, ToolResult } from "../../protocol/results";
import type { CompletionGateResult } from "../completionGate";
import type { DeliveryContract } from "../deliveryContract";
import type { PipelineStagePlan } from "../pipeline/stagePlan";
import type { DeliveryWorkflowRuntimeState } from "./runtimeState";

export type WorkflowId = string;

/**
 * Generic names used by the workflow runtime.
 *
 * The DeliveryWorkflow aliases below remain available during the migration so
 * existing plugins and persisted-run callers do not need to change at once.
 */
export type WorkflowContract = DeliveryContract;
export type WorkflowState = DeliveryWorkflowRuntimeState;

export interface WorkflowRuntimeContext {
  readonly contract?: WorkflowContract;
  readonly state: WorkflowState;
  readonly services?: ReadonlyMap<string, unknown>;
}

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

export type WorkflowDescription = DeliveryWorkflowDescriptor;

export interface WorkflowToolPolicy {
  readonly visibleToolNames?: readonly string[];
  readonly pipelinePlan?: PipelineStagePlan;
  readonly parallelToolCalls: boolean;
}

export interface WorkflowCompletionAdapter {
  chooseRepairTool(
    gate: Exclude<CompletionGateResult, { passed: true }>,
    records: WorkflowToolRecord[],
    availableToolNames: Set<string>,
  ): string | undefined;
  authoritativeMessage(records: WorkflowToolRecord[]): string | undefined;
  hydrate(records: WorkflowToolRecord[]): void;
  verifyRequiredAction(call: WorkflowToolRecord): Artifact | undefined;
}

export interface WorkflowRuntime extends WorkflowToolPolicy, WorkflowCompletionAdapter {
  readonly id: string;
  readonly title: string;
  readonly stages: WorkflowStage[];
  readonly services?: ReadonlyMap<string, unknown>;
  readonly validationInputMode?: "inline_code" | "path_or_code";
  readonly requiredActionTool?: string;
  initialTool(options: { isResume: boolean }): string | undefined;
  instructions(): string;
  recordSuccessfulValidation?(content: string, hash: string): void;
  canWriteContent?(content: string): boolean;
}

/** @deprecated Use WorkflowRuntime in new code. */
export type DeliveryWorkflow = WorkflowRuntime;

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

export interface WorkflowDecisionSignals {
  delivery: "required" | "not_required" | "unknown";
  deliveryConfidence: number;
  orchestration: "single" | "team" | "unknown";
  orchestrationConfidence: number;
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  riskConfidence: number;
}

export interface WorkflowDescriptor {
  id: WorkflowId;
  title: string;
  description: string;
  runtimeManaged: boolean;
  workflowRoute?: string;
  visibleToolNames?: readonly string[];
  pipelinePlan?: PipelineStagePlan;
  describe(): WorkflowDescription;
  /** Generic contract hooks. */
  matchesContract?(contract: WorkflowContract | undefined): boolean;
  createContract?(options?: {
    reason?: string;
    source?: WorkflowDecisionSource;
  }): WorkflowContract | undefined;
  /** Compatibility hooks used by the current delivery runtime. */
  matchesDeliveryContract?(contract: DeliveryContract | undefined): boolean;
  createDeliveryContract(options?: {
    reason?: string;
    source?: WorkflowDecisionSource;
  }): DeliveryContract | undefined;
  localMatch?(context: WorkflowDecisionContext): WorkflowLocalMatch;
  createRuntime?(
    contract: WorkflowContract | undefined,
    state: WorkflowState,
    context?: WorkflowRuntimeContext,
  ): WorkflowRuntime | undefined;
}

export function createWorkflowContract(
  workflow: WorkflowDescriptor,
  options: {
    reason?: string;
    source?: WorkflowDecisionSource;
  } = {},
): WorkflowContract | undefined {
  return (workflow.createContract ?? workflow.createDeliveryContract)?.(options);
}

export interface WorkflowSelectedDecision {
  kind: "workflow";
  workflow: WorkflowDescriptor;
  source: WorkflowDecisionSource;
  confidence: number;
  reason: string;
  signals: WorkflowDecisionSignals;
  deliveryContract?: DeliveryContract;
}

export interface WorkflowFallbackDecision {
  kind: "fallback";
  mode: WorkflowFallbackMode;
  source: WorkflowDecisionSource;
  confidence: number;
  reason: string;
  signals: WorkflowDecisionSignals;
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
