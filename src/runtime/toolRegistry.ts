import type { Tool } from "@openai/agents";
import type { ToolRisk } from "../tools/toolContract";
import type { DeliveryEvidence } from "./deliveryContract";
import type { AgentConfig } from "./agentConfig";
import {
  commandToolResult,
  createToolBuildContext,
  type BeforeEffectHook,
  type DiagnosticSideReporter,
  type RuntimeToolCallGuard,
  type ToolBuildContext,
} from "./tools/toolBuildContext";
import { createCoreToolProvider } from "./tools/coreToolProvider";
import type { WorkflowContract, WorkflowRuntime } from "./workflow/types";

export { commandToolResult };
export type {
  BeforeEffectContext,
  BeforeEffectHook,
  BeforeEffectResult,
  DiagnosticSideReporter,
  RuntimeDiagnosticReport,
  RuntimeToolCallGuard,
} from "./tools/toolBuildContext";

export type ToolProviderContext = ToolBuildContext;

export interface ToolProvider {
  id: string;
  riskByTool?: Readonly<Record<string, ToolRisk>>;
  evidenceByTool?: Readonly<Record<string, readonly DeliveryEvidence[]>>;
  createTools(context: ToolProviderContext): readonly Tool[];
}

export class ToolRegistry {
  private readonly providers = new Map<string, ToolProvider>();
  private readonly risks = new Map<string, ToolRisk>();
  private readonly evidence = new Map<string, Set<DeliveryEvidence>>();

  constructor(initial: readonly ToolProvider[] = []) {
    this.registerMany(initial);
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  register(provider: ToolProvider): this {
    if (!provider.id.trim()) throw new Error("Tool provider id must not be empty");
    if (this.providers.has(provider.id)) {
      throw new Error(`Tool provider already registered: ${provider.id}`);
    }
    for (const [toolName, risk] of Object.entries(provider.riskByTool ?? {})) {
      const existing = this.risks.get(toolName);
      if (existing && existing !== risk) {
        throw new Error(`Conflicting risk registration for tool ${toolName}`);
      }
    }
    this.providers.set(provider.id, provider);
    for (const [toolName, risk] of Object.entries(provider.riskByTool ?? {})) {
      this.risks.set(toolName, risk);
    }
    for (const [toolName, evidence] of Object.entries(provider.evidenceByTool ?? {})) {
      const registered = this.evidence.get(toolName) ?? new Set<DeliveryEvidence>();
      for (const item of evidence) registered.add(item);
      this.evidence.set(toolName, registered);
    }
    return this;
  }

  registerMany(providers: readonly ToolProvider[]): this {
    for (const provider of providers) this.register(provider);
    return this;
  }

  list(): readonly ToolProvider[] {
    return [...this.providers.values()];
  }

  getRisk(toolName: string): ToolRisk | undefined {
    return this.risks.get(toolName);
  }

  riskMap(): Readonly<Record<string, ToolRisk>> {
    return Object.fromEntries(this.risks);
  }

  evidenceMap(): Readonly<Record<string, readonly DeliveryEvidence[]>> {
    return Object.fromEntries(
      [...this.evidence].map(([name, evidence]) => [name, [...evidence]]),
    );
  }

  toolsForEvidence(evidence: DeliveryEvidence): readonly string[] {
    return [...this.evidence]
      .filter(([, values]) => values.has(evidence))
      .map(([name]) => name);
  }

  createTools(options: {
    cfg: AgentConfig;
    workflowContract?: WorkflowContract;
    workflow?: WorkflowRuntime;
    diagnosticReporter?: DiagnosticSideReporter;
    runtimeToolGuard?: RuntimeToolCallGuard;
  }): Tool[] {
    const hooks = new Map<string, BeforeEffectHook[]>();
    const beforeEffectsFor = (toolName: string) => hooks.get(toolName) ?? [];
    const registerBeforeEffect = (toolName: string, hook: BeforeEffectHook) => {
      const registered = hooks.get(toolName) ?? [];
      registered.push(hook);
      hooks.set(toolName, registered);
    };
    const context = createToolBuildContext(options.cfg, {
      workflowContract: options.workflowContract,
      workflow: options.workflow,
      diagnosticReporter: options.diagnosticReporter,
      runtimeToolGuard: options.runtimeToolGuard,
      riskByTool: this.riskMap(),
      beforeEffectsFor,
      registerBeforeEffect,
    });
    const tools = this.list().flatMap((provider) => [...provider.createTools(context)]);
    const names = new Set<string>();
    for (const runtimeTool of tools) {
      const name = (runtimeTool as { name?: unknown }).name;
      if (typeof name !== "string") continue;
      if (names.has(name)) throw new Error(`Tool already provided: ${name}`);
      names.add(name);
    }
    return tools;
  }
}

let defaultToolRegistry = new ToolRegistry([createCoreToolProvider()]);

export function getDefaultToolRegistry(): ToolRegistry {
  return defaultToolRegistry;
}

export function setDefaultToolRegistry(registry: ToolRegistry): void {
  defaultToolRegistry = registry;
}

/** @deprecated Inject ToolRegistry and call createTools(). */
export function buildTools(
  cfg: AgentConfig,
  deliveryContract?: WorkflowContract,
  workflow?: WorkflowRuntime,
  _legacyState?: unknown,
  diagnosticReporter?: DiagnosticSideReporter,
  runtimeToolGuard?: RuntimeToolCallGuard,
): Tool[] {
  return defaultToolRegistry.createTools({
    cfg,
    workflowContract: deliveryContract,
    workflow,
    diagnosticReporter,
    runtimeToolGuard,
  });
}
