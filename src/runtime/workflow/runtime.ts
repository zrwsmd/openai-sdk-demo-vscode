import type {
  NormalizedWorkflowRuntime,
  WorkflowContract,
  WorkflowDescriptor,
  WorkflowRuntimeContext,
  WorkflowState,
} from "./types";
import {
  describeWorkflowDescriptor,
  normalizeWorkflowRuntime,
} from "./types";
import {
  getDefaultWorkflowRegistry,
  type WorkflowRegistry,
} from "./registry";

/**
 * Generic workflow runtime entrypoints.
 *
 * This module only knows the generic workflow protocol and registry.
 */
export function createWorkflowRuntime(
  workflowId: string | undefined,
  contract: WorkflowContract | undefined,
  state: WorkflowState,
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

export function describeWorkflow(
  workflowId: string | undefined,
  contract: WorkflowContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): ReturnType<typeof describeWorkflowDescriptor> | undefined {
  const workflow = getWorkflowDescriptor(workflowId, contract, registry);
  return workflow ? describeWorkflowDescriptor(workflow) : undefined;
}

export function getWorkflowDescriptor(
  workflowId: string | undefined,
  contract: WorkflowContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): WorkflowDescriptor | undefined {
  const selected = registry.get(workflowId);
  if (selected) return selected;
  return registry.findByContract(contract);
}

export function isRuntimeManagedWorkflow(
  workflowId: string | undefined,
  contract: WorkflowContract | undefined,
  registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
): boolean {
  return getWorkflowDescriptor(workflowId, contract, registry)?.runtimeManaged === true;
}
