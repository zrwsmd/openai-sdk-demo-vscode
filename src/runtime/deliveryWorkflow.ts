/**
 * Legacy Delivery compatibility facade.
 *
 * New runtime code must import generic Workflow APIs from `workflow/runtime`
 * and generic/legacy adapters from `workflow/deliveryCompatibility`.
 * This file remains only so existing host integrations importing the old
 * module path continue to work.
 */

export {
  createDeliveryWorkflow,
  createDeliveryWorkflowRuntime,
  createWorkflowRuntime,
  describeDeliveryWorkflow,
  describeWorkflow,
  getDeliveryWorkflowDescriptor,
  getWorkflowDescriptor,
  isRuntimeManagedDeliveryWorkflow,
  isRuntimeManagedWorkflow,
} from "./workflow/deliveryCompatibility";

export {
  createDeliveryWorkflowRuntimeState,
  createWorkflowRuntimeState,
  type DeliveryWorkflowRuntimeState,
  type WorkflowRuntimeState,
} from "./workflow/runtimeState";

export type {
  AdaptedWorkflowRuntime,
  DeliveryWorkflow,
  DeliveryWorkflowDescriptor,
} from "./workflow/deliveryCompatibility";

export type {
  WorkflowStage,
  WorkflowToolRecord,
} from "./workflow/types";
