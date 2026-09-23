import { FallbackStAnalyzer } from "../../analysis/fallbackStAnalyzer";
import type {
  StAnalyzer,
  StAnalyzerToolOptions,
} from "../../analysis/stAnalyzer";
import {
  ST_TOOL_STATE_SERVICE,
  type StValidationState,
} from "./stWorkspaceDeliveryWorkflow";
import type { ToolBuildContext } from "../tools/toolBuildContext";
import type { WorkflowRuntime } from "../workflow/types";

export interface StToolBuildContext extends ToolBuildContext {
  deliveryWorkflow?: WorkflowRuntime;
  stAnalyzer: StAnalyzer;
  stToolOptions: StAnalyzerToolOptions;
  requiresStValidation: boolean;
  inlineStValidation: boolean;
  stValidationState: StValidationState;
  validatedStContent: Set<string>;
  stValidationCache: Map<string, Promise<string>>;
}

export function createStToolBuildContext(
  context: ToolBuildContext,
): StToolBuildContext {
  const state = context.workflow?.services?.get(ST_TOOL_STATE_SERVICE) as
    | StValidationState
    | undefined;
  const stValidationState = state ?? { hashes: new Set<string>() };

  return {
    ...context,
    deliveryWorkflow: context.workflow,
    stAnalyzer: context.cfg.stAnalyzer ?? new FallbackStAnalyzer(),
    stToolOptions: context.cfg.stAnalyzerOptions ?? {},
    requiresStValidation:
      context.workflowContract?.deliverables.some(
        (deliverable) =>
          deliverable.required &&
          deliverable.requiredVerificationTools?.includes("validate_st_code"),
      ) === true,
    inlineStValidation: context.workflow?.validationInputMode === "inline_code",
    stValidationState,
    validatedStContent: stValidationState.hashes,
    stValidationCache: new Map<string, Promise<string>>(),
  };
}
