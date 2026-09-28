import type { DeliveryContract } from "./deliveryContract";
import {
  createDeliveryWorkflowRuntimeState,
  type DeliveryWorkflowRuntimeState,
} from "./workflow/runtimeState";
import type {
  WorkflowDescriptor,
  WorkflowRuntimeContext,
  WorkflowStage,
  WorkflowToolRecord,
} from "./workflow/types";
import {
  getDefaultWorkflowRegistry,
  type WorkflowRegistry,
} from "./workflow/registry";
import {
  adaptDeliveryWorkflow,
  asDeliveryDescription,
  type AdaptedWorkflowRuntime,
  type DeliveryWorkflow,
  type DeliveryWorkflowDescriptor,
} from "./workflow/deliveryCompatibility";
import {
  createWorkflowRuntime as createGenericWorkflowRuntime,
  describeWorkflow as describeGenericWorkflow,
  getWorkflowDescriptor as getGenericWorkflowDescriptor,
  isRuntimeManagedWorkflow as isGenericRuntimeManagedWorkflow,
} from "./workflow/runtime";

export {
  createDeliveryWorkflowRuntimeState,
  type DeliveryWorkflowRuntimeState,
} from "./workflow/runtimeState";

export type {
  DeliveryWorkflow,
  DeliveryWorkflowDescriptor,
} from "./workflow/deliveryCompatibility";
export type { WorkflowStage, WorkflowToolRecord } from "./workflow/types";

/**
 * @deprecated Use `workflow/runtime.createWorkflowRuntime` for generic
 * workflows. This name remains as a Delivery compatibility facade.
 */
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
  if (!description) return undefined;
  return asDeliveryDescription(description);
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
