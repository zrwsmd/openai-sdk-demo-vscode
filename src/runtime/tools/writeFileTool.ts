import { tool } from "@openai/agents";
import { z } from "zod";
import { writeFileText } from "../../tools/workspaceTools";
import { toolResult } from "../../tools/toolContract";
import { hashStContent } from "../deliveryWorkflow";
import type { ToolBuildContext } from "./toolBuildContext";
import type { ValidateStContentBeforeWrite } from "./validateStTool";

export function createWriteFileTool(
  ctx: ToolBuildContext,
  validateStContentBeforeWrite: ValidateStContentBeforeWrite,
) {
  const {
    contract,
    deliveryWorkflow,
    guard,
    guardrails,
    requiresStValidation,
    validatedStContent,
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
          let preWriteValidation:
            | Awaited<ReturnType<ValidateStContentBeforeWrite>>
            | undefined;
          if (
            requiresStValidation &&
            target.relativePath.toLowerCase().endsWith(".st") &&
            !(deliveryWorkflow?.canWriteContent
              ? deliveryWorkflow.canWriteContent(content)
              : validatedStContent.has(hashStContent(content)))
          ) {
            preWriteValidation = await validateStContentBeforeWrite(
              content,
              target.relativePath,
              details?.signal,
            );
            if (!preWriteValidation.ok) {
              return toolResult({
                ok: false,
                error: "ST 写入内容与最近一次通过校验的草稿不一致，且写入前重新校验未通过。",
                data: {
                  suppliedContentHash: preWriteValidation.contentHash,
                  lastValidatedContentHash: deliveryWorkflow?.canWriteContent
                    ? undefined
                    : [...validatedStContent].at(-1),
                  errorCount: preWriteValidation.counts.error,
                  warningCount: preWriteValidation.counts.warning,
                  diagnostics: preWriteValidation.repairPacket
                    ? preWriteValidation.repairPacket.diagnostics
                    : preWriteValidation.diagnostics,
                  ...(preWriteValidation.repairPacket
                    ? { repairPacket: preWriteValidation.repairPacket }
                    : {}),
                },
                diagnostics: preWriteValidation.protocolDiagnostics.length
                  ? preWriteValidation.protocolDiagnostics
                  : [{
                      code: "st_pre_write_validation_failed",
                      message: "写入内容未通过 ST 预写校验。",
                      severity: "error",
                      path: target.relativePath,
                    }],
                effect: "none",
                risk: "plan",
              });
            }
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
                  contentHash: hashStContent(content),
                  ...(preWriteValidation
                    ? {
                        preWriteValidation: {
                          errorCount: preWriteValidation.counts.error,
                          warningCount: preWriteValidation.counts.warning,
                          infoCount: preWriteValidation.counts.info,
                          validatedContentHash: preWriteValidation.contentHash,
                          summary: preWriteValidation.summary,
                        },
                      }
                    : {}),
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
