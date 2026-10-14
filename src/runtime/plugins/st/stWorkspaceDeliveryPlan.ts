import type { ToolResult } from "../../../protocol/results";
import { hashStContent } from "./stContentHash";
import type { WorkflowStage } from "../../workflow/types";
import type {
  PipelineStagePlan,
  PipelineToolEventInput,
} from "../../pipeline/stagePlan";

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
    id: "commit_delivery",
    toolName: "commit_st_delivery",
    title: "选择正式交付候选",
    description: "提交最终 ST 路径和内容哈希，授权后续只写入这一份候选",
    successEvidence: "commit_st_delivery 返回 deliveryAuthorization",
    onFailure: "retry",
  },
  {
    order: 3,
    id: "persist_final_st",
    toolName: "write_file",
    title: "写入并完成 ST 交付",
    description: "把已授权且通过校验的同一份 ST 源码写入工作区",
    successEvidence: "write_file 返回 stPersistence 和 deliveryCommit",
    onFailure: "retry",
  },
];

export const ST_WORKSPACE_DELIVERY_PIPELINE_PLAN: PipelineStagePlan = {
  id: "st_workspace_delivery",
  resultTransitions: [
    {
      fromToolName: "validate_st_code",
      toToolName: "commit_st_delivery",
      reason: "validate_st_code 通过，下一轮先提交最终候选: commit_st_delivery",
      canTransition: isSuccessfulStValidation,
    },
    {
      fromToolName: "validate_st_code",
      toToolName: "validate_st_code",
      reason: "validate_st_code 未通过，下一轮强制继续修正并重新校验完整草稿",
      canTransition: isFailedStValidation,
    },
    {
      fromToolName: "commit_st_delivery",
      toToolName: "write_file",
      reason: "commit_st_delivery 已登记最终候选，下一轮只允许写入匹配内容: write_file",
      canTransition: isSuccessfulStAuthorization,
    },
  ],
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

function isFailedStValidation(result: ToolResult): boolean {
  return !isSuccessfulStValidation(result);
}

function isSuccessfulStAuthorization(result: ToolResult): boolean {
  if (!result.ok) return false;
  const data = result.data && typeof result.data === "object"
    ? result.data as Record<string, unknown>
    : {};
  const authorization = data.deliveryAuthorization;
  return authorization !== undefined &&
    typeof authorization === "object" &&
    authorization !== null &&
    !Array.isArray(authorization) &&
    typeof (authorization as Record<string, unknown>).path === "string" &&
    typeof (authorization as Record<string, unknown>).contentHash === "string";
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
