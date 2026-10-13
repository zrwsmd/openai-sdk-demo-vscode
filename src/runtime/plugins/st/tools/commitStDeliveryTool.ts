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
    workspace,
  } = ctx;

  return tool({
    name: "commit_st_delivery",
    description:
      "确认一个已经通过 ST 校验并成功写入工作区的 .st 文件为本轮正式交付物。" +
      "只接受刚刚 write_file/edit_file/export_st_program 成功回执中的路径和 contentHash；" +
      "不会再次写文件，也不能替代校验或写入。",
    parameters: z.object({
      path: z.string().min(1).describe("成功写入回执中的 .st 文件路径"),
      contentHash: z.string().min(1).describe("成功写入回执中的 contentHash"),
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
          const target = workspace.resolve(path);
          const commit = validationService.recordDeliveryCommit({
            path: target.relativePath,
            workspaceRoot: target.root,
            contentHash,
          });
          if (!commit) {
            return failed(
              "正式交付 commit 被拒绝：必须先成功校验并实际写入同一份 .st 内容，" +
                "且 path 与 contentHash 必须来自成功写入回执。",
              "plan",
            );
          }
          return contract(
            {
              deliveryCommit: commit,
              summary: `已确认正式交付 ${commit.path}。`,
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
