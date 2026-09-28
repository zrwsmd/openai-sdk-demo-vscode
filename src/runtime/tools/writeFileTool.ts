import { tool } from "@openai/agents";
import { z } from "zod";
import { writeFileText } from "../../tools/workspaceTools";
import { hashContent } from "../contentHash";
import type { ToolBuildContext } from "./toolBuildContext";
import { beforeEffectFailureResult } from "./toolBuildContext";

export function createWriteFileTool(ctx: ToolBuildContext) {
  const {
    contract,
    runBeforeEffects,
    guard,
    guardrails,
    workspace,
    withEffect,
  } = ctx;

  return tool({
    name: "write_file",
    description:
      "把文本内容写入已授权工作区内的文件(会覆盖)。相对路径默认使用当前工作区，也可使用其他已授权工作区的绝对路径。属于写操作,执行前需要用户在界面批准。",
    parameters: z.object({
      path: z.string().describe("相对工作区的文件路径"),
      content: z.string().describe("要写入的完整文本内容"),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p, content }, _context, details) =>
      guard(
        async () => {
          const target = workspace.resolve(p);
          const beforeEffect = await runBeforeEffects({
            toolName: "write_file",
            input: {
              path: target.relativePath,
              workspaceRoot: target.root,
              content,
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
            "write_file",
            {
              path: target.relativePath,
              workspaceRoot: target.root,
              content,
            },
            "write",
            async () =>
              contract(
                {
                  ...(await writeFileText(
                    target.root,
                    target.relativePath,
                    content,
                  )),
                  contentHash: hashContent(content),
                  ...beforeEffect.receiptData,
                },
                "write",
                "filesystem",
              ),
          );
        },
        "write",
        "filesystem",
      ),
  });
}
