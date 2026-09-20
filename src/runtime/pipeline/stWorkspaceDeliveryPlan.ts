import type { ToolResult } from "../../protocol/results";
import { hashStContent } from "../stContentHash";
import type { WorkflowStage } from "../deliveryWorkflow";
import type {
  PipelineStagePlan,
  PipelineToolEventInput,
} from "./stagePlan";

export const ST_WORKSPACE_DELIVERY_STAGES: WorkflowStage[] = [
  {
    order: 1,
    id: "validate_draft",
    toolName: "validate_st_code",
    title: "校验 ST 草稿",
    description: "校验内存中的完整 ST 草稿",
    successEvidence: "validate_st_code 返回 errorCount=0，并记录源码哈希",
    onFailure: "revise_draft",
  },
  {
    order: 2,
    id: "persist_final_st",
    toolName: "write_file",
    title: "写入 ST 文件",
    description: "把通过校验的同一份 ST 源码写入工作区",
    successEvidence: "write_file 返回的 contentHash 与校验哈希一致",
    onFailure: "retry",
  },
];

export const ST_WORKSPACE_DELIVERY_PIPELINE_PLAN: PipelineStagePlan = {
  id: "st_workspace_delivery",
  resultTransitions: [{
    fromToolName: "validate_st_code",
    toToolName: "write_file",
    reason: "validate_st_code 通过，下一轮强制工具: write_file",
    canTransition: isSuccessfulStValidation,
  }],
  duplicateToolFingerprints: [{
    toolName: "validate_st_code",
    fingerprint: stValidationFingerprint,
  }],
};

function isSuccessfulStValidation(result: ToolResult): boolean {
  if (!result.ok) return false;
  const data = result.data && typeof result.data === "object"
    ? result.data as Record<string, unknown>
    : {};
  return data.errorCount === 0 &&
    typeof data.validatedContentHash === "string";
}

function stValidationFingerprint(
  event: PipelineToolEventInput,
): string | undefined {
  const rawArgs = event.args ?? "";
  try {
    const parsed = JSON.parse(rawArgs) as {
      code?: unknown;
      path?: unknown;
      loadWorkspaceContext?: unknown;
    };
    if (typeof parsed.code === "string" && parsed.code.length > 0) {
      return [
        "validate_st_code",
        "code",
        hashStContent(parsed.code),
        String(parsed.loadWorkspaceContext ?? "default"),
      ].join(":");
    }
    if (typeof parsed.path === "string" && parsed.path.length > 0) {
      return [
        "validate_st_code",
        "path",
        parsed.path,
        String(parsed.loadWorkspaceContext ?? "default"),
      ].join(":");
    }
  } catch {
    // Fall back to the raw argument hash below.
  }
  return rawArgs ? `validate_st_code:args:${hashStContent(rawArgs)}` : undefined;
}
