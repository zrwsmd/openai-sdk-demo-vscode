import type { WorkflowContract, WorkflowDescriptor } from "./types";

/**
 * Runtime registry for workflow plugins.
 *
 * The registry deliberately has no built-in domain imports. Hosts assemble a
 * registry and register the plugins they want to expose.
 */
export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDescriptor>();

  constructor(initial: readonly WorkflowDescriptor[] = []) {
    this.registerMany(initial);
  }

  register(workflow: WorkflowDescriptor): this {
    if (!workflow.id.trim()) {
      throw new Error("Workflow id must not be empty");
    }
    if (this.workflows.has(workflow.id)) {
      throw new Error(`Workflow already registered: ${workflow.id}`);
    }
    this.workflows.set(workflow.id, workflow);
    return this;
  }

  registerMany(workflows: readonly WorkflowDescriptor[]): this {
    for (const workflow of workflows) this.register(workflow);
    return this;
  }

  list(): readonly WorkflowDescriptor[] {
    return [...this.workflows.values()];
  }

  get(id: string | undefined): WorkflowDescriptor | undefined {
    if (!id) return undefined;
    return this.workflows.get(id);
  }

  getByRoute(route: string | undefined): WorkflowDescriptor | undefined {
    if (!route) return undefined;
    return this.list().find((workflow) => workflow.workflowRoute === route);
  }

  findByContract(contract: WorkflowContract | undefined): WorkflowDescriptor | undefined {
    if (!contract) return undefined;
    return this.list().find((workflow) =>
      (workflow.matchesContract?.(contract) ??
        workflow.matchesDeliveryContract?.(contract)) === true,
    );
  }
}

/**
 * Compatibility default used by older host entry points. New runtime code
 * should pass a WorkflowRegistry explicitly.
 */
let defaultWorkflowRegistry = new WorkflowRegistry();

export function getDefaultWorkflowRegistry(): WorkflowRegistry {
  return defaultWorkflowRegistry;
}

export function setDefaultWorkflowRegistry(registry: WorkflowRegistry): void {
  defaultWorkflowRegistry = registry;
}

/** @deprecated Prefer an injected WorkflowRegistry instance. */
export function listWorkflows(
  registry: WorkflowRegistry = defaultWorkflowRegistry,
): readonly WorkflowDescriptor[] {
  return registry.list();
}

/** @deprecated Prefer registry.get(). */
export function getWorkflow(
  id: string | undefined,
  registry: WorkflowRegistry = defaultWorkflowRegistry,
): WorkflowDescriptor | undefined {
  return registry.get(id);
}

/** @deprecated Prefer registry.getByRoute(). */
export function getWorkflowByRoute(
  route: string | undefined,
  registry: WorkflowRegistry = defaultWorkflowRegistry,
): WorkflowDescriptor | undefined {
  return registry.getByRoute(route);
}
