import {
  setDefaultWorkflowRegistry,
  WorkflowRegistry,
} from "../runtime/workflow/registry";
import { ST_INSPECTION_WORKFLOW } from "../runtime/workflows/stInspectionWorkflow";
import { ST_WORKSPACE_DELIVERY_WORKFLOW } from "../runtime/workflows/stWorkspaceDeliveryWorkflow";

/**
 * Application composition root for the built-in workflow plugins.
 *
 * The runtime registry itself is domain-neutral; this host decides which
 * plugins are available in the VS Code extension.
 */
export function createAppWorkflowRegistry(): WorkflowRegistry {
  const registry = new WorkflowRegistry([
    ST_WORKSPACE_DELIVERY_WORKFLOW,
    ST_INSPECTION_WORKFLOW,
  ]);
  setDefaultWorkflowRegistry(registry);
  return registry;
}
