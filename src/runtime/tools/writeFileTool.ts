import { tool } from "@openai/agents";
import { z } from "zod";
import { writeFileText } from "../../tools/workspaceTools";
import { toolResult } from "../../tools/toolContract";
import { hashContent } from "../contentHash";
import type { ToolBuildContext } from "./toolBuildContext";

export function createWriteFileTool(ctx: ToolBuildContext) {
  const {
    contract,
    beforeEffectsFor,
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
          const receiptData: Record<string, unknown> = {};
          for (const beforeEffect of beforeEffectsFor("write_file")) {
            const result = await beforeEffect({
              toolName: "write_file",
              input: {
                path: target.relativePath,
                workspaceRoot: target.root,
                content,
              },
              workspace,
              signal: details?.signal,
            });
            if (!result) continue;
            if (!result.ok) {
              return toolResult({
                ok: false,
                error: result.error ?? "写入前检查未通过。",
                ...(result.failureData !== undefined
                  ? { data: result.failureData }
                  : {}),
                ...(result.diagnostics
                  ? { diagnostics: [...result.diagnostics] }
                  : {}),
                ...(result.metadata ? { metadata: result.metadata } : {}),
                effect: "none",
                risk: result.risk ?? "plan",
              });
            }
            Object.assign(receiptData, result.receiptData ?? {});
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
                  ...receiptData,
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
