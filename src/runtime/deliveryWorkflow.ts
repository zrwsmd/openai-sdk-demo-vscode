import type { DeliveryContract } from "./deliveryContract";
import {
  createDeliveryWorkflowRuntimeState,
  type DeliveryWorkflowRuntimeState,
} from "./workflow/runtimeState";
import { getWorkflow, listWorkflows } from "./workflow/registry";
import type {
  DeliveryWorkflow,
  DeliveryWorkflowDescriptor,
  WorkflowDescriptor,
  WorkflowStage,
  WorkflowToolRecord,
} from "./workflow/types";

export {
  createDeliveryWorkflowRuntimeState,
  type DeliveryWorkflowRuntimeState,
} from "./workflow/runtimeState";

export type {
  DeliveryWorkflow,
  DeliveryWorkflowDescriptor,
  WorkflowStage,
  WorkflowToolRecord,
} from "./workflow/types";

export function createWorkflowRuntime(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
): DeliveryWorkflow | undefined {
  const matched = getWorkflowDescriptor(workflowId, contract);
  return matched?.createRuntime?.(contract, state);
}

export function createDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
): DeliveryWorkflow | undefined {
  return createWorkflowRuntime(undefined, contract, state);
}

export function describeDeliveryWorkflow(
  contract: DeliveryContract | undefined,
): DeliveryWorkflowDescriptor | undefined {
  return describeWorkflow(undefined, contract);
}

export function describeWorkflow(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
): DeliveryWorkflowDescriptor | undefined {
  return getWorkflowDescriptor(workflowId, contract)?.describe();
}

export function getDeliveryWorkflowDescriptor(
  contract: DeliveryContract | undefined,
): WorkflowDescriptor | undefined {
  return getWorkflowDescriptor(undefined, contract);
}

export function getWorkflowDescriptor(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
): WorkflowDescriptor | undefined {
  const selected = getWorkflow(workflowId);
  if (selected) return selected;
  if (!contract) return undefined;
  return listWorkflows()
    .find((workflow) => workflow.matchesDeliveryContract?.(contract) === true);
}

export function isRuntimeManagedDeliveryWorkflow(
  contract: DeliveryContract | undefined,
): boolean {
  return isRuntimeManagedWorkflow(undefined, contract);
}

export function isRuntimeManagedWorkflow(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
): boolean {
  return getWorkflowDescriptor(workflowId, contract)?.runtimeManaged === true;
}
