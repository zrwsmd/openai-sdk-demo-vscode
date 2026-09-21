import type { AgentInputItem } from "@openai/agents";
import type { DeliveryContract } from "../deliveryContract";
import type { DeliveryWorkflowDescriptor } from "../deliveryWorkflow";
import type { PipelineStagePlan } from "../pipeline/stagePlan";

export type WorkflowId = string;

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
