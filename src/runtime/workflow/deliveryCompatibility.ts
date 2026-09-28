import type { Artifact } from "../../protocol/results";
import type {
  CompletionGateResult,
  CompletionGateWorkflowAdapter,
} from "../completionTypes";
import type {
  NormalizedWorkflowRuntime,
  WorkflowDescription,
  WorkflowCompletionAdapter,
  WorkflowRuntime,
  WorkflowStage,
  WorkflowToolRecord,
} from "./types";
import { normalizeWorkflowRuntime } from "./types";

/**
 * Legacy Delivery runtime shape.
 *
 * This type is intentionally outside the public generic WorkflowRuntime
 * contract. Existing delivery plugins can keep implementing it while the
 * runtime consumes the generic completionAdapter channel.
 */
export interface DeliveryWorkflow
  extends WorkflowRuntime, CompletionGateWorkflowAdapter {
  readonly stages: readonly WorkflowStage[];
  readonly parallelToolCalls: boolean;
  readonly validationInputMode?: "inline_code" | "path_or_code";
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

export type AdaptedWorkflowRuntime = NormalizedWorkflowRuntime & DeliveryWorkflow;

export type DeliveryWorkflowDescriptor = WorkflowDescription & {
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

function hasLegacyDeliveryMethods(
  runtime: WorkflowRuntime,
): runtime is DeliveryWorkflow {
  const candidate = runtime as Partial<DeliveryWorkflow>;
  return (
    typeof candidate.chooseRepairTool === "function" ||
    typeof candidate.authoritativeMessage === "function" ||
    typeof candidate.hydrate === "function" ||
    typeof candidate.verifyRequiredAction === "function"
  );
}

/**
 * Adapts the old flat Delivery methods into the generic completion adapter.
 *
 * Generic workflows can provide `completionAdapter` directly. Legacy
 * delivery workflows are detected only here, outside the generic protocol.
 */
export function adaptDeliveryWorkflow(
  runtime: WorkflowRuntime,
): AdaptedWorkflowRuntime {
  const legacy = hasLegacyDeliveryMethods(runtime) ? runtime : undefined;
  const existing = runtime.completionAdapter;
  const completionAdapter: WorkflowCompletionAdapter = {
    collectArtifacts: (records) =>
      existing?.collectArtifacts?.(records) ??
      legacy?.collectArtifacts?.(records) ??
      [],
    collectIssues: (context) =>
      existing?.collectIssues?.(context) ??
      legacy?.collectIssues?.(context) ??
      [],
    resolveIssue: (issue, context) =>
      existing?.resolveIssue?.(issue, context) ??
      legacy?.resolveIssue?.(issue, context),
    hasSuccessfulVerification: (toolName, context) =>
      existing?.hasSuccessfulVerification?.(toolName, context) ??
      legacy?.hasSuccessfulVerification?.(toolName, context),
    selectRepairTool: (gate, records, availableToolNames) =>
      existing?.selectRepairTool?.(gate, records, availableToolNames) ??
      legacy?.chooseRepairTool(gate, records, availableToolNames),
    finalMessage: (records) =>
      existing?.finalMessage?.(records) ??
      legacy?.authoritativeMessage(records),
    restore: (records) => {
      existing?.restore?.(records);
      legacy?.hydrate(records);
    },
    collectActionArtifact: (call) =>
      existing?.collectActionArtifact?.(call) ??
      legacy?.verifyRequiredAction(call),
  };

  const normalized = normalizeWorkflowRuntime({
    ...runtime,
    completionAdapter,
    initialTool: runtime.initialTool
      ? (options) => runtime.initialTool?.(options)
      : undefined,
    instructions: runtime.instructions
      ? () => runtime.instructions?.() ?? ""
      : undefined,
  });
  return {
    ...normalized,
    chooseRepairTool: (gate, records, availableToolNames) =>
      normalized.completionAdapter?.selectRepairTool?.(
        gate,
        records,
        availableToolNames,
      ),
    authoritativeMessage: (records) =>
      normalized.completionAdapter?.finalMessage?.(records),
    hydrate: (records) => {
      normalized.completionAdapter?.restore?.(records);
    },
    verifyRequiredAction: (call) =>
      normalized.completionAdapter?.collectActionArtifact?.(call),
  };
}

export function asDeliveryDescription(
  description: WorkflowDescription,
): DeliveryWorkflowDescriptor {
  return {
    ...description,
    stages: [...(description.stages ?? [])] as DeliveryWorkflowDescriptor["stages"],
  };
}
