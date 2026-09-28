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
  NormalizedWorkflowRuntime,
  WorkflowDescriptor,
  WorkflowRuntimeContext,
  WorkflowStage,
  WorkflowToolRecord,
} from "./workflow/types";
import {
  describeWorkflowDescriptor,
  normalizeWorkflowRuntime,
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
  context?: Omit<WorkflowRuntimeContext, "contract" | "state">,
): NormalizedWorkflowRuntime | undefined {
  const matched = getWorkflowDescriptor(workflowId, contract, registry);
  const runtime = matched?.createRuntime?.(contract, state, {
    ...context,
    contract,
    state,
  });
  return runtime ? normalizeWorkflowRuntime(runtime) : undefined;
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
  const description = describeWorkflow(undefined, contract, registry);
  if (!description) return undefined;
  return {
    ...description,
    stages: [...(description.stages ?? [])] as DeliveryWorkflowDescriptor["stages"],
  };
}

export function describeWorkflow(
  workflowId: string | undefined,
  contract: DeliveryContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): ReturnType<typeof describeWorkflowDescriptor> | undefined {
  const workflow = getWorkflowDescriptor(workflowId, contract, registry);
  return workflow ? describeWorkflowDescriptor(workflow) : undefined;
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
