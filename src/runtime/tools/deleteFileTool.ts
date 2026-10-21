import { tool } from "@openai/agents";
import { z } from "zod";
import { deleteFileText } from "../../tools/workspaceTools";
import type { ToolBuildContext } from "./toolBuildContext";
import { beforeEffectFailureResult } from "./toolBuildContext";

/**
 * 删除工作区里的单个文件。
 *
 * 为什么要有这个工具:删除以前只能走 run_command,而 Remove-Item、del、rm
 * 在命令风险分类里是 blocked,不管什么权限模式都直接拒绝。模型只能改成
 * `node -e "...rmSync..."` 绕开命令拦截,那条路既不过审批也不进效果账本,
 * 反而比直说"删这个文件"更危险。
 */
export function createDeleteFileTool(ctx: ToolBuildContext) {
  const {
    contract,
    runBeforeEffects,
    runAfterEffects,
    guard,
    guardrails,
    workspace,
    resolveWorkspacePath,
    withEffect,
  } = ctx;

  return tool({
    name: "delete_file",
    description:
      "删除已授权工作区内的一个文件。路径规则和 write_file 一致:相对路径使用当前首选工作区,也可使用其他已授权工作区的绝对路径。" +
      "只删单个文件,不删目录;文件本来就不存在时返回 existed=false,不算失败。" +
      "属于写操作,执行前需要用户在界面批准。",
    parameters: z.object({
      path: z.string().describe("相对工作区的文件路径"),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p }, _context, details) =>
      guard(
        async () => {
          const target = await resolveWorkspacePath(p, {
            targetKind: "file",
            enforceUserTarget: true,
            signal: details?.signal,
          });
          const beforeEffect = await runBeforeEffects({
            toolName: "delete_file",
            input: {
              path: target.relativePath,
              workspaceRoot: target.root,
            },
            workspace,
            effect: "filesystem",
            resourceKind: "file",
            signal: details?.signal,
          });
          if (!beforeEffect.ok && beforeEffect.failure) {
            return beforeEffectFailureResult(beforeEffect.failure);
          }
          return withEffect(
            "delete_file",
            {
              path: target.relativePath,
              workspaceRoot: target.root,
            },
            "write",
            async () => {
              const deleted = await deleteFileText(target.root, target.relativePath);
              const afterEffect = await runAfterEffects(beforeEffect);
              if (!afterEffect.ok && afterEffect.failure) {
                return beforeEffectFailureResult(afterEffect.failure);
              }
              return contract(
                {
                  ...deleted,
                  ...afterEffect.receiptData,
                },
                "write",
                "filesystem",
              );
            },
          );
        },
        "write",
        "filesystem",
      ),
  });
}
