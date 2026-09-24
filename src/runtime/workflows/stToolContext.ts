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

export const ST_ANALYZER_SERVICE = "st.analyzer";
export const ST_ANALYZER_OPTIONS_SERVICE = "st.analyzerOptions";

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
  const stAnalyzer =
    context.services.get(ST_ANALYZER_SERVICE) as StAnalyzer | undefined;
  const stToolOptions =
    context.services.get(ST_ANALYZER_OPTIONS_SERVICE) as
      | StAnalyzerToolOptions
      | undefined;

  return {
    ...context,
    deliveryWorkflow: context.workflow,
    stAnalyzer: stAnalyzer ?? new FallbackStAnalyzer(),
    stToolOptions: stToolOptions ?? {},
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
