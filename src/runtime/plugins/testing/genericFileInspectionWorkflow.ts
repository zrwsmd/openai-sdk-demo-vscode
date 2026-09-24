import type { Artifact } from "../../../protocol/results";
import type { CompletionGateResult } from "../../completionTypes";
import {
  getWorkflowStateSlot,
  type DeliveryWorkflowRuntimeState,
} from "../../workflow/runtimeState";
import type {
  DeliveryWorkflow,
  DeliveryWorkflowDescriptor,
  WorkflowDecisionContext,
  WorkflowDescriptor,
  WorkflowLocalMatch,
  WorkflowToolRecord,
} from "../../workflow/types";

export const GENERIC_FILE_INSPECTION_TOOL_NAMES = [
  "list_files",
  "read_file",
  "search_files",
] as const;

export const GENERIC_FILE_INSPECTION_WORKFLOW_ID = "generic_file_inspection";
export const GENERIC_FILE_INSPECTION_STATE_SERVICE =
  "generic.fileInspection.state";

export type GenericFileInspectionState = {
  inspectedTargets: Set<string>;
};

export function createGenericFileInspectionState(): GenericFileInspectionState {
  return { inspectedTargets: new Set<string>() };
}

export function getGenericFileInspectionState(
  state: DeliveryWorkflowRuntimeState,
): GenericFileInspectionState {
  return getWorkflowStateSlot(
    state,
    GENERIC_FILE_INSPECTION_STATE_SERVICE,
    createGenericFileInspectionState,
  );
}

function describeGenericFileInspection(): DeliveryWorkflowDescriptor {
  return {
    id: GENERIC_FILE_INSPECTION_WORKFLOW_ID,
    title: "Generic file inspection",
    stages: [{
      order: 1,
      id: "inspect_files",
      toolName: "list_files",
      title: "Inspect workspace files",
      description: "Inspect workspace files with read-only tools",
      successEvidence: "A read-only file tool returns a successful result",
      onFailure: "stop",
    }],
  };
}

function localMatch(
  context: WorkflowDecisionContext,
): WorkflowLocalMatch {
  const text = context.userText.trim();
  const asksInspection =
    /inspect|检查|查看|读取|搜索|分析/u.test(text);
  const mentionsFiles =
    /file|文件|workspace|工作区|目录|内容/u.test(text);
  if (!asksInspection || !mentionsFiles) {
    return {
      matched: false,
      confidence: 0,
      reason: "Local rules did not identify a generic file inspection request",
    };
  }
  return {
    matched: true,
    confidence: 0.9,
    reason: "Local rules identified a read-only generic file inspection request",
  };
}

export const GENERIC_FILE_INSPECTION_WORKFLOW: WorkflowDescriptor = {
  id: GENERIC_FILE_INSPECTION_WORKFLOW_ID,
  title: "Generic file inspection",
  description: "A domain-neutral read-only workflow for inspecting workspace files.",
  runtimeManaged: true,
  workflowRoute: GENERIC_FILE_INSPECTION_WORKFLOW_ID,
  businessToolNames: GENERIC_FILE_INSPECTION_TOOL_NAMES,
  describe: describeGenericFileInspection,
  createDeliveryContract: () => undefined,
  localMatch,
  createRuntime: (_contract, state) =>
    new GenericFileInspectionWorkflow(getGenericFileInspectionState(state)),
};

export class GenericFileInspectionWorkflow implements DeliveryWorkflow {
  readonly id = GENERIC_FILE_INSPECTION_WORKFLOW_ID;
  readonly title = GENERIC_FILE_INSPECTION_WORKFLOW.title;
  readonly stages = describeGenericFileInspection().stages;
  readonly businessToolNames = GENERIC_FILE_INSPECTION_TOOL_NAMES;
  readonly parallelToolCalls = true;
  readonly services: ReadonlyMap<string, unknown>;

  /** @deprecated Use businessToolNames. */
  get visibleToolNames(): readonly string[] {
    return this.businessToolNames;
  }

  constructor(readonly state: GenericFileInspectionState) {
    this.services = new Map([
      [GENERIC_FILE_INSPECTION_STATE_SERVICE, state],
    ]);
  }

  initialTool(options: { isResume: boolean }): string | undefined {
    return options.isResume ? undefined : "list_files";
  }

  instructions(): string {
    return (
      "\nThis is a read-only generic file inspection workflow. " +
      "Use only the exposed file inspection tools and do not modify files."
    );
  }

  chooseRepairTool(
    _gate: Exclude<CompletionGateResult, { passed: true }>,
    records: WorkflowToolRecord[],
    availableToolNames: Set<string>,
  ): string | undefined {
    if (!availableToolNames.has("read_file")) return undefined;
    const hasSuccessfulRead = records.some((record) =>
      record.name === "read_file" && record.result.ok,
    );
    return hasSuccessfulRead ? undefined : "read_file";
  }

  authoritativeMessage(_records: WorkflowToolRecord[]): string | undefined {
    return undefined;
  }

  hydrate(records: WorkflowToolRecord[]): void {
    for (const record of records) {
      if (!record.result.ok) continue;
      this.state.inspectedTargets.add(record.name);
      const data = record.result.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      for (const key of ["path", "file", "relativePath"] as const) {
        const value = (data as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) {
          this.state.inspectedTargets.add(value.trim());
        }
      }
    }
  }

  verifyRequiredAction(_call: WorkflowToolRecord): Artifact | undefined {
    return undefined;
  }
}
