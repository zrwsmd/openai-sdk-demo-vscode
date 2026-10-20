import type { Tool } from "@openai/agents";
import { hashStContent } from "./stContentHash";
import { agentLog } from "../../modelGateway";
import type {
  BeforeEffectContext,
  BeforeEffectResult,
} from "../../tools/toolBuildContext";
import type { ToolProvider } from "../../toolRegistry";
import type { ToolCapability } from "../../toolCatalog";
import { createStGraphTools } from "./tools/dependencyTools";
import { createStLibraryTools } from "./tools/libraryTools";
import { createPlcRuntimeTools } from "./tools/plcRuntimeTools";
import { createValidateStTools } from "./tools/validateStTool";
import { createStDeliveryCommitTool } from "./tools/commitStDeliveryTool";
import { createStToolBuildContext } from "./stToolContext";
import { preparePlcRuntimeConfigSync } from "../../../plc/plcRuntimeConfigSync";
import {
  type StPersistedWriteSource,
} from "./stValidationRuntimeService";
import { isStWorkspaceDeliveryContract } from "./stDeliveryContract";

const ST_TOOL_CAPABILITIES: readonly ToolCapability[] = [
  {
    name: "validate_st_code",
    description: "校验 IEC 61131-3 Structured Text 代码并返回诊断。",
    domain: "structured_text",
    intents: ["校验 ST 代码", "检查 ST 语法", "分析 ST 诊断"],
    tags: ["structured_text", "validation", "analysis"],
    risk: "plan",
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "commit_st_delivery",
    description: "确认已校验并成功写入的 ST 文件为本轮正式交付物。",
    domain: "structured_text",
    intents: ["确认 ST 正式交付", "提交 ST 交付", "完成 ST 交付"],
    tags: ["structured_text", "delivery", "commit"],
    risk: "plan",
    effect: "none",
    evidence: ["delivery_commit"],
    fallbackModes: [],
  },
  {
    name: "export_st_program",
    description: "把 ST 程序导出为工作区文件。",
    domain: "structured_text",
    intents: ["导出 ST 程序", "保存 ST 程序"],
    tags: ["structured_text", "write", "export"],
    risk: "write",
    effect: "filesystem",
    evidence: ["successful_export", "successful_write"],
    fallbackModes: ["file_edit"],
  },
  {
    name: "st_dependency_map",
    description: "分析 ST 工作区文件之间的符号依赖关系。",
    domain: "structured_text",
    intents: ["分析 ST 依赖", "查看文件依赖", "分析引用关系"],
    tags: ["structured_text", "analysis", "dependencies"],
    risk: "plan",
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "st_change_impact",
    description: "分析 ST 文件或符号变更可能影响的范围。",
    domain: "structured_text",
    intents: ["分析 ST 变更影响", "查看影响范围", "评估修改影响"],
    tags: ["structured_text", "analysis", "impact"],
    risk: "plan",
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "st_symbol_references",
    description: "查询 ST 符号的声明位置和引用位置。",
    domain: "structured_text",
    intents: ["查找 ST 符号引用", "查看符号定义", "分析符号使用"],
    tags: ["structured_text", "analysis", "references"],
    risk: "plan",
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "st_library_symbol",
    description: "查询 IEC 61131-3 标准库符号(功能块/函数/类型)的接口定义。",
    domain: "structured_text",
    intents: ["查询标准库符号", "查看功能块引脚", "查看函数接口"],
    tags: ["structured_text", "library", "analysis"],
    risk: "plan",
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "audit_plc_runtime_config",
    description: "检查 plc-runtime.json 与工作区 ST PROGRAM 的任务绑定一致性。",
    domain: "structured_text",
    intents: [
      "检查 PLC 任务组态",
      "检查 plc-runtime.json",
      "检查任务周期绑定",
      "编译前组态检查",
      "查看 PROGRAM 任务绑定",
    ],
    tags: ["structured_text", "plc_runtime", "configuration", "analysis"],
    risk: "read",
    effect: "none",
    fallbackModes: ["read_only"],
  },
];

function fileBeforeEffect(
  context: ReturnType<typeof createStToolBuildContext>,
  validateStContentBeforeWrite: ReturnType<typeof createValidateStTools>["validateStContentBeforeWrite"],
  requireDeliveryAuthorization: boolean,
): (request: BeforeEffectContext) => Promise<BeforeEffectResult | undefined> {
  return async ({ input, signal, toolName }) => {
    if (!input || typeof input !== "object") return undefined;
    const args = input as Record<string, unknown>;
    const path = typeof args.path === "string" ? args.path : "";
    const workspaceRoot = typeof args.workspaceRoot === "string" ? args.workspaceRoot : "";
    const content = typeof args.content === "string" ? args.content : undefined;
    const persistedWriteSource: StPersistedWriteSource =
      toolName === "edit_file"
        ? "edit_file"
        : toolName === "export_st_program"
          ? "export_st_program"
          : "write_file";
    const contentAlreadyValidated = content === undefined
      ? false
      : context.validationService?.canWriteContent(content) ??
        context.validatedStContent.has(hashStContent(content));
    if (!path.toLowerCase().endsWith(".st") || content === undefined) {
      return undefined;
    }
    const contentHash = hashStContent(content);
    if (requireDeliveryAuthorization) {
      const authorization = context.validationService?.checkDeliveryAuthorization({
        path,
        workspaceRoot,
        contentHash,
      });
      if (!authorization?.accepted) {
        const message =
          "当前 ST 内容尚未被选为正式交付候选；请先用 commit_st_delivery 提交最终候选的 path 和 contentHash，" +
          "校验草稿本身不会产生文件写入。";
        agentLog(
          `[st-delivery] rejected target=${path} tool=${toolName} ` +
          `contentHash=${contentHash.slice(0, 12)} reason=missing_or_mismatched_authorization`,
        );
        return {
          ok: false,
          error: message,
          failureData: {
            suppliedContentHash: contentHash,
            deliveryAuthorization: authorization?.authorization,
          },
          diagnostics: [{
            code: "st_delivery_authorization_required",
            message,
            severity: "error" as const,
            path,
          }],
          risk: "write",
        };
      }
      if (
        context.requiresStRuntimeProgram &&
        !context.validationService?.hasValidatedProgram(contentHash)
      ) {
        const message =
          "当前 ST 交付候选没有 PROGRAM 主入口，不能写入可运行 PLC 交付。" +
          "请补充 PROGRAM 主入口并重新校验；FUNCTION_BLOCK、FUNCTION、TYPE 等只能作为复用声明。";
        agentLog(
          `[st-delivery] rejected target=${path} tool=${toolName} ` +
          `contentHash=${contentHash.slice(0, 12)} reason=missing_program_entry`,
        );
        return {
          ok: false,
          error: message,
          failureData: {
            suppliedContentHash: contentHash,
            reason: "missing_program_entry",
          },
          diagnostics: [{
            code: "st_delivery_program_entry_required",
            message,
            severity: "error" as const,
            path,
          }],
          risk: "plan",
        };
      }
    }

    const receiptData: Record<string, unknown> = {};
    if (
      context.requiresStValidation &&
      !contentAlreadyValidated
    ) {
      const validation = await validateStContentBeforeWrite(content, path, signal);
      if (!validation.ok) {
        return {
          ok: false,
          error: "ST 写入内容与最近一次通过校验的草稿不一致，且写入前重新校验未通过。",
          failureData: {
            suppliedContentHash: validation.contentHash,
            lastValidatedContentHash: context.validationService?.lastValidatedContentHash ??
              [...context.validatedStContent].at(-1),
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
      Object.assign(receiptData, {
        preWriteValidation: {
          errorCount: validation.counts.error,
          warningCount: validation.counts.warning,
          infoCount: validation.counts.info,
          validatedContentHash: validation.contentHash,
          summary: validation.summary,
        },
      });
    }

    const commitPersistedWrite = () => {
      if (!context.validationService) return undefined;
      const persistedWrite = context.validationService.recordSuccessfulWrite({
        path,
        workspaceRoot,
        content,
        contentHash,
        source: persistedWriteSource,
        requireDeliveryAuthorization,
      });
      if (!persistedWrite) return undefined;
      const deliveryCommit = requireDeliveryAuthorization
        ? context.validationService.recordDeliveryCommit({
            path,
            workspaceRoot,
            contentHash,
          })
        : undefined;
      return { persistedWrite, deliveryCommit };
    };

    const persistenceReceipt = () => {
      if (!context.validationService) {
        return {
          ok: true as const,
          receiptData: {},
        };
      }
      const persisted = commitPersistedWrite();
      if (!persisted) {
        return {
          ok: false as const,
          error: requireDeliveryAuthorization
            ? "ST 文件已经写入，但正式交付授权未能生成 delivery commit。"
            : "ST 文件已经写入，但运行时没有记录到有效的 ST 持久化回执。",
          risk: "write" as const,
          diagnostics: [{
            code: "st_delivery_commit_missing",
            message: requireDeliveryAuthorization
              ? "ST 文件写入后没有生成正式 delivery commit。"
              : "ST 文件写入后没有生成持久化回执。",
            severity: "error" as const,
            path,
          }],
        };
      }
      if (requireDeliveryAuthorization && !persisted.deliveryCommit) {
        return {
          ok: false as const,
          error: "ST 文件已经写入，但正式交付 commit 未生成。",
          risk: "write" as const,
          diagnostics: [{
            code: "st_delivery_commit_missing",
            message: "ST 文件已经写入，但正式交付 commit 未生成。",
            severity: "error" as const,
            path,
          }],
        };
      }
      return {
        ok: true as const,
        receiptData: {
          stPersistence: {
            status: "persisted",
            path,
            workspaceRoot,
            contentHash,
            source: persistedWriteSource,
          },
          ...(persisted.deliveryCommit
            ? { deliveryCommit: persisted.deliveryCommit }
            : {}),
        },
      };
    };

    try {
      const syncPlan = await preparePlcRuntimeConfigSync({
        workspaceRoot,
        source: path,
        content,
        userRequest: context.userText,
        modelConfig: context.cfg,
        clarification: context.cfg.clarification,
        signal,
      });
      if (!syncPlan) {
        return {
          ok: true,
          receiptData,
          afterEffect: async () => persistenceReceipt(),
        };
      }
      return {
        ok: true,
        receiptData: {
          ...receiptData,
          plcRuntimeConfig: {
            status: "pending",
            action: syncPlan.action,
            file: syncPlan.filePath,
            deviceId: syncPlan.deviceId,
            taskName: syncPlan.taskName,
            programName: syncPlan.programName,
            source: syncPlan.source,
            ...(syncPlan.periodMs === undefined ? {} : { periodMs: syncPlan.periodMs }),
          },
        },
        afterEffect: async () => {
          try {
            await syncPlan.commit();
            const persisted = persistenceReceipt();
            if (!persisted.ok) return persisted;
            return {
              ok: true,
              receiptData: {
                plcRuntimeConfig: {
                  status: "updated",
                  action: syncPlan.action,
                  file: syncPlan.filePath,
                  deviceId: syncPlan.deviceId,
                  taskName: syncPlan.taskName,
                  programName: syncPlan.programName,
                  source: syncPlan.source,
                  ...(syncPlan.periodMs === undefined ? {} : { periodMs: syncPlan.periodMs }),
                },
                ...persisted.receiptData,
              },
            };
          } catch (error) {
            return {
              ok: false,
              error: `ST 文件已写入，但 PLC 任务组态更新失败: ${error instanceof Error ? error.message : String(error)}`,
              risk: "write",
              diagnostics: [{
                code: "plc_runtime_config_update_failed",
                message: "ST 文件已写入，但 plc-runtime.json 更新失败。",
                severity: "error" as const,
                details: { file: syncPlan.filePath },
              }],
            };
          }
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: message,
        risk: "plan",
        diagnostics: [{
          code: "plc_runtime_config_required",
          message,
          severity: "error" as const,
          path,
        }],
      };
    }
  };
}

export function createStToolProvider(): ToolProvider {
  return {
    id: "st",
    capabilities: ST_TOOL_CAPABILITIES,
    createTools(context): readonly Tool[] {
      const stContext = createStToolBuildContext(context);
      const validationTools = createValidateStTools(stContext);
      const deliveryCommitTool = createStDeliveryCommitTool(stContext);
      const isWorkspaceDelivery =
        context.workflow?.id === "st_workspace_delivery" ||
        isStWorkspaceDeliveryContract(context.workflowContract);
      const graphTools = createStGraphTools(stContext);
      const libraryTools = createStLibraryTools(stContext);
      const plcRuntimeTools = createPlcRuntimeTools(stContext);
      context.registerBeforeEffect(
        {
          effect: "filesystem",
          resourceKind: "file",
        },
        fileBeforeEffect(
          stContext,
          validationTools.validateStContentBeforeWrite,
          isWorkspaceDelivery,
        ),
      );
      return [
        validationTools.validateStCode,
        ...(isWorkspaceDelivery ? [deliveryCommitTool] : []),
        validationTools.exportStProgram,
        graphTools.stDependencyMap,
        graphTools.stChangeImpact,
        graphTools.stSymbolReferences,
        libraryTools.stLibrarySymbol,
        plcRuntimeTools.auditPlcRuntimeConfig,
      ];
    },
  };
}
