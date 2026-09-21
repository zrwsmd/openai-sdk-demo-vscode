import type { DeliveryContract } from "./deliveryContract";
import {
  createDeliveryWorkflowRuntimeState,
  type DeliveryWorkflowRuntimeState,
} from "./workflow/runtimeState";
import { listWorkflows } from "./workflow/registry";
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

export function createDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
): DeliveryWorkflow | undefined {
  const matched = getDeliveryWorkflowDescriptor(contract);
  return matched?.createRuntime?.(contract, state);
}

export function describeDeliveryWorkflow(
  contract: DeliveryContract | undefined,
): DeliveryWorkflowDescriptor | undefined {
  return getDeliveryWorkflowDescriptor(contract)?.describe();
}

export function getDeliveryWorkflowDescriptor(
  contract: DeliveryContract | undefined,
): WorkflowDescriptor | undefined {
  if (!contract) return undefined;
  return listWorkflows()
    .find((workflow) => workflow.matchesDeliveryContract?.(contract) === true);
}

export function isRuntimeManagedDeliveryWorkflow(
  contract: DeliveryContract | undefined,
): boolean {
  return getDeliveryWorkflowDescriptor(contract)?.runtimeManaged === true;
}
