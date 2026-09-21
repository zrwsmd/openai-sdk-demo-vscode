import { ST_WORKSPACE_DELIVERY_WORKFLOW } from "../workflows/stWorkspaceDeliveryWorkflow";
import type { WorkflowDescriptor } from "./types";

const WORKFLOWS: readonly WorkflowDescriptor[] = [
  ST_WORKSPACE_DELIVERY_WORKFLOW,
];

export function listWorkflows(): readonly WorkflowDescriptor[] {
  return WORKFLOWS;
}

export function getWorkflow(id: string | undefined): WorkflowDescriptor | undefined {
  if (!id) return undefined;
  return WORKFLOWS.find((workflow) => workflow.id === id);
}

export function getWorkflowByRoute(route: string | undefined): WorkflowDescriptor | undefined {
  if (!route) return undefined;
  return WORKFLOWS.find((workflow) => workflow.workflowRoute === route);
}
