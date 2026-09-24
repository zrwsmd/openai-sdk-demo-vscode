import type { Tool } from "@openai/agents";
import type { ToolRisk } from "../../../tools/toolContract";
import { hashStContent } from "./stContentHash";
import type {
  BeforeEffectContext,
  BeforeEffectResult,
} from "../../tools/toolBuildContext";
import type { ToolProvider } from "../../toolRegistry";
import type { ToolCapability } from "../../toolCatalog";
import { createStGraphTools } from "./tools/dependencyTools";
import { createValidateStTools } from "./tools/validateStTool";
import { createStToolBuildContext } from "./stToolContext";

const ST_TOOL_RISKS: Readonly<Record<string, ToolRisk>> = {
  validate_st_code: "plan",
  export_st_program: "write",
  st_dependency_map: "plan",
  st_change_impact: "plan",
  st_symbol_references: "plan",
};

const ST_TOOL_CAPABILITIES: readonly ToolCapability[] = [
  {
    name: "validate_st_code",
    description: "校验 IEC 61131-3 Structured Text 代码并返回诊断。",
    domain: "structured_text",
    intents: ["校验 ST 代码", "检查 ST 语法", "分析 ST 诊断"],
    tags: ["structured_text", "validation", "analysis"],
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "export_st_program",
    description: "把 ST 程序导出为工作区文件。",
    domain: "structured_text",
    intents: ["导出 ST 程序", "保存 ST 程序"],
    tags: ["structured_text", "write", "export"],
    effect: "filesystem",
    fallbackModes: ["file_edit"],
  },
  {
    name: "st_dependency_map",
    description: "分析 ST 工作区文件之间的符号依赖关系。",
    domain: "structured_text",
    intents: ["分析 ST 依赖", "查看文件依赖", "分析引用关系"],
    tags: ["structured_text", "analysis", "dependencies"],
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "st_change_impact",
    description: "分析 ST 文件或符号变更可能影响的范围。",
    domain: "structured_text",
    intents: ["分析 ST 变更影响", "查看影响范围", "评估修改影响"],
    tags: ["structured_text", "analysis", "impact"],
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "st_symbol_references",
    description: "查询 ST 符号的声明位置和引用位置。",
    domain: "structured_text",
    intents: ["查找 ST 符号引用", "查看符号定义", "分析符号使用"],
    tags: ["structured_text", "analysis", "references"],
    effect: "none",
    fallbackModes: ["read_only"],
  },
];

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
    capabilities: ST_TOOL_CAPABILITIES,
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
