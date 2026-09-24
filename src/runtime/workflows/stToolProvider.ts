import type { Tool } from "@openai/agents";
import type { ToolRisk } from "../../tools/toolContract";
import { hashStContent } from "../stContentHash";
import type {
  BeforeEffectContext,
  BeforeEffectResult,
} from "../tools/toolBuildContext";
import type { ToolProvider } from "../toolRegistry";
import { createStGraphTools } from "../tools/dependencyTools";
import { createValidateStTools } from "../tools/validateStTool";
import { createStToolBuildContext } from "./stToolContext";

const ST_TOOL_RISKS: Readonly<Record<string, ToolRisk>> = {
  validate_st_code: "plan",
  export_st_program: "write",
  st_dependency_map: "plan",
  st_change_impact: "plan",
  st_symbol_references: "plan",
};

function writeFileBeforeEffect(
  context: ReturnType<typeof createStToolBuildContext>,
  validateStContentBeforeWrite: ReturnType<typeof createValidateStTools>["validateStContentBeforeWrite"],
): (request: BeforeEffectContext) => Promise<BeforeEffectResult | undefined> {
  return async ({ input, signal }) => {
    if (!input || typeof input !== "object") return undefined;
    const args = input as Record<string, unknown>;
    const path = typeof args.path === "string" ? args.path : "";
    const content = typeof args.content === "string" ? args.content : undefined;
    if (
      !context.requiresStValidation ||
      !path.toLowerCase().endsWith(".st") ||
      content === undefined ||
      (context.deliveryWorkflow?.canWriteContent
        ? context.deliveryWorkflow.canWriteContent(content)
        : context.validatedStContent.has(hashStContent(content)))
    ) {
      return undefined;
    }

    const validation = await validateStContentBeforeWrite(content, path, signal);
    if (!validation.ok) {
      return {
        ok: false,
        error: "ST 写入内容与最近一次通过校验的草稿不一致，且写入前重新校验未通过。",
        failureData: {
          suppliedContentHash: validation.contentHash,
          lastValidatedContentHash: context.deliveryWorkflow?.canWriteContent
            ? undefined
            : [...context.validatedStContent].at(-1),
          errorCount: validation.counts.error,
          warningCount: validation.counts.warning,
          diagnostics: validation.repairPacket
            ? validation.repairPacket.diagnostics
            : validation.diagnostics,
          ...(validation.repairPacket
            ? { repairPacket: validation.repairPacket }
            : {}),
        },
        diagnostics: validation.protocolDiagnostics.length
          ? validation.protocolDiagnostics
          : [{
              code: "st_pre_write_validation_failed",
              message: "写入内容未通过 ST 预写校验。",
              severity: "error" as const,
              path,
            }],
        risk: "plan",
      };
    }

    return {
      ok: true,
      receiptData: {
        preWriteValidation: {
          errorCount: validation.counts.error,
          warningCount: validation.counts.warning,
          infoCount: validation.counts.info,
          validatedContentHash: validation.contentHash,
          summary: validation.summary,
        },
      },
    };
  };
}

export function createStToolProvider(): ToolProvider {
  return {
    id: "st",
    riskByTool: ST_TOOL_RISKS,
    evidenceByTool: {
      export_st_program: ["successful_export", "successful_write"],
    },
    createTools(context): readonly Tool[] {
      const stContext = createStToolBuildContext(context);
      const validationTools = createValidateStTools(stContext);
      const graphTools = createStGraphTools(stContext);
      context.registerBeforeEffect(
        "write_file",
        writeFileBeforeEffect(
          stContext,
          validationTools.validateStContentBeforeWrite,
        ),
      );
      return [
        validationTools.validateStCode,
        validationTools.exportStProgram,
        graphTools.stDependencyMap,
        graphTools.stChangeImpact,
        graphTools.stSymbolReferences,
      ];
    },
  };
}
