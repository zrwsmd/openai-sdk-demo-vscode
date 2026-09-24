import type { Artifact, ToolResult } from "../protocol/results";
import type {
  DeliveryContract,
  DeliveryEvidence,
} from "./deliveryContract";

export interface CompletionGateToolRecord {
  name: string;
  args: string;
  result: ToolResult;
  order?: number;
}

export interface CompletionGateIssue {
  toolName: string;
  args: string;
  targetKey: string;
  target?: string;
  order: number;
  risk: ToolResult["risk"];
  effect: ToolResult["effect"];
  summary: string;
  requiresRepair: boolean;
}

export type CompletionGateResult =
  | { passed: true }
  | {
      passed: false;
      reason: string;
      repairInstruction: string;
      issues: CompletionGateIssue[];
    };

export interface CompletionGateWorkflowContext {
  userText: string;
  finalMessage: string;
  deliveryContract?: DeliveryContract;
  records: (CompletionGateToolRecord & { order: number })[];
  artifacts: Artifact[];
}

export interface CompletionGateWorkflowAdapter {
  collectArtifacts?(
    records: CompletionGateToolRecord[],
  ): Artifact[];
  collectIssues?(
    context: CompletionGateWorkflowContext,
  ): readonly CompletionGateIssue[];
  resolveIssue?(
    issue: CompletionGateIssue,
    context: CompletionGateWorkflowContext,
  ): boolean | undefined;
  hasSuccessfulVerification?(
    toolName: string,
    context: CompletionGateWorkflowContext,
  ): boolean | undefined;
}

export interface CompletionGateInput {
  userText: string;
  finalMessage: string;
  toolResults: CompletionGateToolRecord[];
  requiredTool?: string;
  artifacts?: Artifact[];
  deliveryContract?: DeliveryContract;
  workflowAdapter?: CompletionGateWorkflowAdapter;
  toolEvidence?: Readonly<Record<string, readonly DeliveryEvidence[]>>;
}
