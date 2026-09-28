import type { Artifact } from "../../protocol/results";
import type {
  CompletionGateResult,
  CompletionGateWorkflowAdapter,
} from "../completionTypes";
import type {
  NormalizedWorkflowRuntime,
  WorkflowDescription,
  WorkflowCompletionAdapter,
  WorkflowDescriptor,
  WorkflowRuntime,
  WorkflowRuntimeContext,
  WorkflowStage,
  WorkflowToolRecord,
} from "./types";
import { normalizeWorkflowRuntime } from "./types";
import type { DeliveryWorkflowRuntimeState } from "./runtimeState";
import type { DeliveryContract } from "../deliveryContract";
import {
  getDefaultWorkflowRegistry,
  type WorkflowRegistry,
} from "./registry";
import {
  createWorkflowRuntime as createGenericWorkflowRuntime,
  describeWorkflow as describeGenericWorkflow,
  getWorkflowDescriptor as getGenericWorkflowDescriptor,
  isRuntimeManagedWorkflow as isGenericRuntimeManagedWorkflow,
} from "./runtime";

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

/**
 * Creates a legacy-compatible Delivery runtime from the generic runtime
 * entrypoint. New code should call `workflow/runtime.createWorkflowRuntime`
 * and use a generic completion adapter directly.
 */
export function createDeliveryWorkflowRuntime(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
  context?: Omit<WorkflowRuntimeContext, "contract" | "state">,
): AdaptedWorkflowRuntime | undefined {
  const runtime = createGenericWorkflowRuntime(
    workflowId,
    contract,
    state,
    registry,
    context,
  );
  return runtime ? adaptDeliveryWorkflow(runtime) : undefined;
}

/** @deprecated Use `createDeliveryWorkflowRuntime`. */
export function createWorkflowRuntime(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
  context?: Omit<WorkflowRuntimeContext, "contract" | "state">,
): AdaptedWorkflowRuntime | undefined {
  return createDeliveryWorkflowRuntime(
    workflowId,
    contract,
    state,
    registry,
    context,
  );
}

export function createDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): DeliveryWorkflow | undefined {
  return createDeliveryWorkflowRuntime(undefined, contract, state, registry);
}

export function describeDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): DeliveryWorkflowDescriptor | undefined {
  const description = describeGenericWorkflow(undefined, contract, registry);
  return description ? asDeliveryDescription(description) : undefined;
}

/** @deprecated Use `workflow/runtime.describeWorkflow`. */
export function describeWorkflow(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): ReturnType<typeof describeGenericWorkflow> {
  return describeGenericWorkflow(workflowId, contract, registry);
}

export function getDeliveryWorkflowDescriptor(
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): WorkflowDescriptor | undefined {
  return getGenericWorkflowDescriptor(undefined, contract, registry);
}

/** @deprecated Use `workflow/runtime.getWorkflowDescriptor`. */
export function getWorkflowDescriptor(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): WorkflowDescriptor | undefined {
  return getGenericWorkflowDescriptor(workflowId, contract, registry);
}

export function isRuntimeManagedDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): boolean {
  return isGenericRuntimeManagedWorkflow(undefined, contract, registry);
}

/** @deprecated Use `workflow/runtime.isRuntimeManagedWorkflow`. */
export function isRuntimeManagedWorkflow(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): boolean {
  return isGenericRuntimeManagedWorkflow(workflowId, contract, registry);
}
