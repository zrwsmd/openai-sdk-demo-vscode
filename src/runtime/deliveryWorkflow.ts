import type { DeliveryContract } from "./deliveryContract";
import {
  createDeliveryWorkflowRuntimeState,
  type DeliveryWorkflowRuntimeState,
} from "./workflow/runtimeState";
import {
  getDefaultWorkflowRegistry,
  type WorkflowRegistry,
} from "./workflow/registry";
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
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): DeliveryWorkflow | undefined {
  const matched = getWorkflowDescriptor(workflowId, contract, registry);
  return matched?.createRuntime?.(contract, state);
}

export function createDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): DeliveryWorkflow | undefined {
  return createWorkflowRuntime(undefined, contract, state, registry);
}

export function describeDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): DeliveryWorkflowDescriptor | undefined {
  return describeWorkflow(undefined, contract, registry);
}

export function describeWorkflow(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): DeliveryWorkflowDescriptor | undefined {
  return getWorkflowDescriptor(workflowId, contract, registry)?.describe();
}

export function getDeliveryWorkflowDescriptor(
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): WorkflowDescriptor | undefined {
  return getWorkflowDescriptor(undefined, contract, registry);
}

export function getWorkflowDescriptor(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): WorkflowDescriptor | undefined {
  const selected = registry.get(workflowId);
  if (selected) return selected;
  return registry.findByContract(contract);
}

export function isRuntimeManagedDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): boolean {
  return isRuntimeManagedWorkflow(undefined, contract, registry);
}

export function isRuntimeManagedWorkflow(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): boolean {
  return getWorkflowDescriptor(workflowId, contract, registry)?.runtimeManaged === true;
}
