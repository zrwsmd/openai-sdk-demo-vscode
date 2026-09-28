import type { AgentInputItem } from "@openai/agents";
import type { Artifact, ToolResult } from "../../protocol/results";
import type {
  CompletionGateResult,
  CompletionGateWorkflowAdapter,
} from "../completionTypes";
import type { DeliveryContract } from "../deliveryContract";
import type { PipelineStagePlan } from "../pipeline/stagePlan";
import type { WorkflowRuntimeState } from "./runtimeState";
import type { RuntimeServiceContainer } from "../services";
import type { ToolEvidenceExtractor } from "../decision/completionEvidence";
import type { ToolCatalog, ToolFallbackMode } from "../toolCatalog";

export type WorkflowId = string;

/** Generic names used by the workflow runtime. */
export type WorkflowContract = DeliveryContract;
export type WorkflowState = WorkflowRuntimeState;

export interface WorkflowRuntimeContext {
  readonly contract?: WorkflowContract;
  readonly state: WorkflowState;
  readonly services?: RuntimeServiceContainer;
  readonly userText?: string;
  readonly history?: readonly AgentInputItem[];
  readonly toolCatalog?: ToolCatalog;
}

export type WorkflowToolRecord = {
  name: string;
  args: string;
  result: ToolResult;
  order?: number;
};

export type WorkflowStage = {
  order: number;
  id: string;
  toolName?: string;
  title: string;
  description: string;
  successEvidence: string;
  onFailure: "retry" | "revise_draft" | "stop";
};

export interface WorkflowDescription {
  id: string;
  title: string;
  description?: string;
  stages?: readonly WorkflowStage[];
  [key: string]: unknown;
}

export type WorkflowBusinessToolAccess =
  | "allow_list"
  | "allow_all"
  | "deny_all";

export interface WorkflowBusinessToolPolicy {
  readonly mode: WorkflowBusinessToolAccess;
  readonly names?: readonly string[];
}

export interface WorkflowToolVisibilityContext {
  readonly userText: string;
  readonly history?: readonly AgentInputItem[];
  readonly contract?: WorkflowContract;
  readonly state: WorkflowState;
  readonly toolCatalog: ToolCatalog;
}

export type WorkflowBusinessToolPolicyResolver = (
  context: WorkflowToolVisibilityContext,
) => WorkflowBusinessToolPolicy;

export interface WorkflowToolPolicySource {
  readonly businessToolNames?: readonly string[];
  readonly resolveBusinessToolPolicy?: WorkflowBusinessToolPolicyResolver;
  readonly defaultBusinessToolAccess?: Exclude<WorkflowBusinessToolAccess, "allow_list">;
  /** @deprecated Use businessToolNames. */
  readonly visibleToolNames?: readonly string[];
}

/**
 * This policy covers provider-owned business tools only.
 *
 * Runtime-control tools such as plan progress and inline artifact delivery
 * are assembled by the Agent runtime in a separate channel and are not
 * filtered by this business-tool policy.
 */
export interface WorkflowToolPolicy extends WorkflowToolPolicySource {
  readonly pipelinePlan?: PipelineStagePlan;
  readonly parallelToolCalls?: boolean;
}

export interface WorkflowCompletionAdapter extends CompletionGateWorkflowAdapter {
  selectRepairTool?(
    gate: Exclude<CompletionGateResult, { passed: true }>,
    records: WorkflowToolRecord[],
    availableToolNames: Set<string>,
  ): string | undefined;
  finalMessage?(records: WorkflowToolRecord[]): string | undefined;
  restore?(records: WorkflowToolRecord[]): void;
  collectActionArtifact?(call: WorkflowToolRecord): Artifact | undefined;
}

export interface WorkflowRuntime extends WorkflowToolPolicy {
  readonly id: string;
  readonly title: string;
  readonly stages?: readonly WorkflowStage[];
  readonly services?: RuntimeServiceContainer;
  readonly completionAdapter?: WorkflowCompletionAdapter;
  readonly evidenceExtractors?: readonly ToolEvidenceExtractor[];
  readonly requiredActionTool?: string;
  initialTool?(options: { isResume: boolean }): string | undefined;
  instructions?(): string;
}

export type NormalizedWorkflowRuntime = Omit<
  WorkflowRuntime,
  | "stages"
  | "parallelToolCalls"
  | "initialTool"
  | "instructions"
> & {
  readonly stages: readonly WorkflowStage[];
  readonly parallelToolCalls: boolean;
  initialTool(options: { isResume: boolean }): string | undefined;
  instructions(): string;
};

/**
 * Converts optional plugin capabilities into the stable shape used by the
 * runtime. Delivery plugins keep their existing behavior; lightweight
 * workflows can implement only the capabilities they need.
 */
export function normalizeWorkflowRuntime(
  runtime: WorkflowRuntime,
): NormalizedWorkflowRuntime {
  const completionAdapter = runtime.completionAdapter;
  return {
    ...runtime,
    stages: runtime.stages ? [...runtime.stages] : [],
    parallelToolCalls: runtime.parallelToolCalls ?? true,
    initialTool: (options) => runtime.initialTool?.(options),
    instructions: () => runtime.instructions?.() ?? "",
    completionAdapter: {
      collectArtifacts: (records) => completionAdapter?.collectArtifacts?.(records) ?? [],
      collectIssues: (context) => completionAdapter?.collectIssues?.(context) ?? [],
      resolveIssue: (issue, context) => completionAdapter?.resolveIssue?.(issue, context),
      hasSuccessfulVerification: (toolName, context) =>
        completionAdapter?.hasSuccessfulVerification?.(toolName, context),
      selectRepairTool: (gate, records, availableToolNames) =>
        completionAdapter?.selectRepairTool?.(gate, records, availableToolNames),
      finalMessage: (records) => completionAdapter?.finalMessage?.(records),
      restore: (records) => completionAdapter?.restore?.(records),
      collectActionArtifact: (call) =>
        completionAdapter?.collectActionArtifact?.(call),
    },
  };
}

export type WorkflowDecisionSource =
  | "jev"
  | "local"
  | "model"
  | "fallback";

export type WorkflowFallbackMode = ToolFallbackMode;

export interface WorkflowDecisionContext {
  userText: string;
  history?: AgentInputItem[];
}

export interface WorkflowLocalMatch {
  matched: boolean;
  confidence: number;
  reason: string;
}

export interface WorkflowDecisionSignals {
  delivery: "required" | "not_required" | "unknown";
  deliveryConfidence: number;
  orchestration: "single" | "team" | "unknown";
  orchestrationConfidence: number;
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  riskConfidence: number;
}

export interface WorkflowDescriptor {
  id: WorkflowId;
  title: string;
  description: string;
  runtimeManaged: boolean;
  workflowRoute?: string;
  businessToolNames?: readonly string[];
  resolveBusinessToolPolicy?: WorkflowBusinessToolPolicyResolver;
  defaultBusinessToolAccess?: Exclude<WorkflowBusinessToolAccess, "allow_list">;
  /** @deprecated Use businessToolNames. */
  visibleToolNames?: readonly string[];
  pipelinePlan?: PipelineStagePlan;
  describe?(): WorkflowDescription;
  /** Generic contract hooks. */
  matchesContract?(contract: WorkflowContract | undefined): boolean;
  createContract?(options?: {
    reason?: string;
    source?: WorkflowDecisionSource;
  }): WorkflowContract | undefined;
  /** Compatibility hooks used by the current delivery runtime. */
  matchesDeliveryContract?(contract: DeliveryContract | undefined): boolean;
  createDeliveryContract(options?: {
    reason?: string;
    source?: WorkflowDecisionSource;
  }): DeliveryContract | undefined;
  localMatch?(context: WorkflowDecisionContext): WorkflowLocalMatch;
  createRuntime?(
    contract: WorkflowContract | undefined,
    state: WorkflowState,
    context?: WorkflowRuntimeContext,
  ): WorkflowRuntime | undefined;
}

export function describeWorkflowDescriptor(
  workflow: WorkflowDescriptor,
): WorkflowDescription {
  return workflow.describe?.() ?? {
    id: workflow.id,
    title: workflow.title,
    description: workflow.description,
  };
}

export function createWorkflowContract(
  workflow: WorkflowDescriptor,
  options: {
    reason?: string;
    source?: WorkflowDecisionSource;
  } = {},
): WorkflowContract | undefined {
  return (workflow.createContract ?? workflow.createDeliveryContract)?.(options);
}

function normalizedToolNames(names: readonly string[] | undefined): readonly string[] {
  return [
    ...new Set(
      (names ?? [])
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeBusinessToolPolicy(
  policy: WorkflowBusinessToolPolicy,
): WorkflowBusinessToolPolicy {
  if (policy.mode !== "allow_list") {
    return { mode: policy.mode };
  }
  return {
    mode: "allow_list",
    names: normalizedToolNames(policy.names),
  };
}

/**
 * Resolve the business-tool channel from the most specific workflow source.
 *
 * A runtime may override its descriptor policy. If no source declares a
 * policy, business tools are denied by default instead of being implicitly
 * exposed. Runtime-control tools are intentionally outside this result.
 */
export function resolveWorkflowBusinessToolPolicy(
  sources: readonly (WorkflowToolPolicySource | undefined)[],
  context: WorkflowToolVisibilityContext,
): WorkflowBusinessToolPolicy {
  for (const source of sources) {
    if (source?.resolveBusinessToolPolicy) {
      return normalizeBusinessToolPolicy(source.resolveBusinessToolPolicy(context));
    }
  }
  let defaultAccess: Exclude<WorkflowBusinessToolAccess, "allow_list"> | undefined;
  for (const source of sources) {
    if (!source) continue;
    if (source.businessToolNames !== undefined) {
      return {
        mode: "allow_list",
        names: normalizedToolNames(source.businessToolNames),
      };
    }
    if (source.visibleToolNames !== undefined) {
      return {
        mode: "allow_list",
        names: normalizedToolNames(source.visibleToolNames),
      };
    }
    if (source.defaultBusinessToolAccess !== undefined && defaultAccess === undefined) {
      defaultAccess = source.defaultBusinessToolAccess;
    }
  }
  return { mode: defaultAccess ?? "deny_all" };
}

export interface WorkflowSelectedDecision {
  kind: "workflow";
  workflow: WorkflowDescriptor;
  source: WorkflowDecisionSource;
  confidence: number;
  reason: string;
  signals: WorkflowDecisionSignals;
  deliveryContract?: DeliveryContract;
}

export interface WorkflowFallbackDecision {
  kind: "fallback";
  mode: WorkflowFallbackMode;
  source: WorkflowDecisionSource;
  confidence: number;
  reason: string;
  signals: WorkflowDecisionSignals;
  allowedTools?: readonly string[];
}

export type WorkflowDecision = WorkflowSelectedDecision | WorkflowFallbackDecision;

export type WorkflowModelDecision =
  | {
      kind: "workflow";
      workflowId: WorkflowId;
      confidence: number;
      reason: string;
    }
  | {
      kind: "fallback";
      mode: WorkflowFallbackMode;
      confidence: number;
      reason: string;
      allowedTools?: readonly string[];
    };
