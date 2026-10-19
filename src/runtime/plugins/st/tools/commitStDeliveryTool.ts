import { tool } from "@openai/agents";
import { z } from "zod";
import type { StToolBuildContext } from "../stToolContext";

/**
 * A delivery commit is an explicit workflow decision. It does not write a
 * file; it acknowledges one already-persisted, validated ST target as the
 * artifact that may satisfy the delivery contract.
 */
export function createStDeliveryCommitTool(ctx: StToolBuildContext) {
  const {
    contract,
    failed,
    guard,
    guardrails,
    validationService,
    resolveWorkspacePath,
    requiresStRuntimeProgram,
  } = ctx;

  return tool({
    name: "commit_st_delivery",
    description:
      "提交最终选定的 .st 交付候选，参数必须来自最近一次 validate_st_code 成功回执。" +
      "默认的可运行 ST 交付必须包含 PROGRAM 主入口；只有明确的复用库交付才允许没有 PROGRAM。" +
      "这个工具本身不写文件：写入前调用时会登记路径和 contentHash，运行时只允许随后写入完全匹配的内容；" +
      "写入成功后运行时自动生成正式 deliveryCommit。若旧流程在写入后再次调用本工具，会返回已有正式 commit。",
    parameters: z.object({
      path: z.string().min(1).describe("最终要写入的 .st 文件路径"),
      contentHash: z.string().min(1).describe("最近一次 validate_st_code 成功回执中的 contentHash"),
    }).strict(),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path, contentHash }) =>
      guard(
        async () => {
          if (!validationService) {
            return failed(
              "当前没有活动的 ST 交付 workflow，不能创建正式交付 commit。",
              "plan",
            );
          }
          if (
            requiresStRuntimeProgram &&
            !validationService.hasValidatedProgram(contentHash)
          ) {
            return failed(
              "当前 ST 交付候选没有 PROGRAM 主入口，不能作为可运行 PLC 交付提交。" +
                "请保留 FUNCTION_BLOCK、FUNCTION、TYPE 等复用声明，并补充一个 PROGRAM 主入口后重新校验。",
              "plan",
              "none",
            );
          }
          const target = await resolveWorkspacePath(path, { targetKind: "file" });
          const commit = validationService.recordDeliveryCommit({
            path: target.relativePath,
            workspaceRoot: target.root,
            contentHash,
          });
          if (commit) {
            return contract(
              {
                deliveryCommit: commit,
                summary: `已确认正式交付 ${commit.path}。`,
              },
              "plan",
              "none",
            );
          }
          const authorization = validationService.authorizeDelivery({
            path: target.relativePath,
            workspaceRoot: target.root,
            contentHash,
          });
          if (!authorization) {
            return failed(
              "正式交付候选被拒绝：path 和 contentHash 必须来自最近一次成功的 validate_st_code，" +
              "且内容必须先通过校验。",
              "plan",
            );
          }
          // Keep old callers working: if a previous implementation already
          // persisted the target, the same explicit commit can finalize it
          // after authorization without requiring another write.
          const persistedCommit = validationService.recordDeliveryCommit({
            path: target.relativePath,
            workspaceRoot: target.root,
            contentHash,
          });
          if (persistedCommit) {
            return contract(
              {
                deliveryCommit: persistedCommit,
                summary: `已确认正式交付 ${persistedCommit.path}。`,
              },
              "plan",
              "none",
            );
          }
          return contract(
            {
              deliveryAuthorization: authorization,
              summary: `已登记最终交付候选 ${authorization.path}；下一步只允许写入同一份 contentHash。`,
            },
            "plan",
            "none",
          );
        },
        "plan",
        "none",
      ),
  });
}
