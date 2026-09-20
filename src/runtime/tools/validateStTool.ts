import { tool } from "@openai/agents";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readFileRange } from "../../tools/workspaceTools";
import { toolResult } from "../../tools/toolContract";
import { collectWorkspaceStContext } from "../../analysis/workspaceStContext";
import {
  countStDiagnostics,
  isStValidationFailure,
  toProtocolDiagnostics,
  type StDiagnostic,
  type StTarget,
} from "../../analysis/stAnalyzer";
import type { Diagnostic } from "../../protocol/results";
import { hashStContent } from "../deliveryWorkflow";
import {
  compressDiagnostics,
  repairPacketToProtocolDiagnostics,
  type DiagnosticRepairPacket,
} from "../diagnosticCompression";
import {
  optionalBooleanParam,
  optionalStringParam,
  parseOptionalBoolean,
  parseOptionalString,
  type ToolBuildContext,
} from "./toolBuildContext";

export interface StPreWriteValidationResult {
  ok: boolean;
  contentHash: string;
  counts: {
    error: number;
    warning: number;
    info: number;
  };
  diagnostics: StDiagnostic[];
  protocolDiagnostics: Diagnostic[];
  repairPacket?: DiagnosticRepairPacket;
  summary: string;
  engine: unknown;
  elapsedMs: number;
  contextLoaded: number;
}

export type ValidateStContentBeforeWrite = (
  content: string,
  targetLabel: string,
  signal?: AbortSignal,
) => Promise<StPreWriteValidationResult>;

export function createValidateStTools(ctx: ToolBuildContext) {
  const {
    audit,
    cfg,
    contract,
    deliveryWorkflow,
    diagnosticReporter,
    guard,
    guardrails,
    inlineStValidation,
    requiresStValidation,
    stAnalyzer,
    stToolOptions,
    stValidationCache,
    validatedStContent,
    workspace,
    withEffect,
  } = ctx;

  const resolveStValidationInput = async (
    filePath: string | undefined,
    code: string | undefined,
    loadWorkspaceContext: boolean | undefined,
  ) => {
    if (!filePath && !code) throw new Error("必须提供 code 或 path 之一");
    let target: StTarget;
    let label: string;
    let excludePaths: string[] = [];
    let complete = true;
    let totalLines = code ? code.split(/\r?\n/).length : 0;
    let totalBytes = code ? Buffer.byteLength(code, "utf8") : 0;
    let contentHash = "";
    if (filePath) {
      const resolved = workspace.resolve(filePath);
      const read = await readFileRange(
        resolved.root,
        resolved.relativePath,
        1,
        Number.MAX_SAFE_INTEGER,
      );
      target = { path: resolved.absolutePath, text: read.text };
      label = resolved.relativePath.split(path.sep).join("/");
      excludePaths = [resolved.relativePath];
      complete = read.complete;
      totalLines = read.totalLines;
      totalBytes = read.totalBytes;
      contentHash = read.fileContentHash;
    } else {
      const digest = hashStContent(code!).slice(0, 12);
      target = {
        path: path.join(os.tmpdir(), "plc-agent-st", `${digest}.st`),
        text: code!,
      };
      label = "<inline st code>";
      contentHash = hashStContent(code!);
    }
    const useContext =
      (loadWorkspaceContext ?? stToolOptions.loadWorkspaceContext !== false) &&
      !!workspace.primaryRoot;
    const collected = useContext
      ? await collectWorkspaceStContext(workspace, {
          maxFiles: stToolOptions.maxContextFiles,
          maxFileBytes: stToolOptions.maxFileBytes,
          excludePaths,
        })
      : { files: [] as StTarget[], truncated: false, skipped: 0 };
    return {
      target,
      label,
      context: collected.files,
      contextTruncated: collected.truncated,
      contextSkipped: collected.skipped,
      complete,
      totalLines,
      totalBytes,
      contentHash,
    };
  };

  const validateStCodeParameters = inlineStValidation
    ? z.object({
        code: z.string().min(1).describe("当前完整 ST 草稿；必须包含完整 PROGRAM ... END_PROGRAM"),
        loadWorkspaceContext: optionalBooleanParam.describe(
          '是否把工作区其它 .st 一起解析；优先传 true/false，兼容 "True"/"False" 字符串',
        ),
      })
    : z.object({
        code: optionalStringParam.describe("完整 ST 源码(PROGRAM ... END_PROGRAM);不使用时可省略或传 null"),
        path: optionalStringParam.describe("工作区内的 .st 文件路径,优先于 code;不使用时可省略或传 null"),
        loadWorkspaceContext: optionalBooleanParam.describe(
          '是否把工作区其它 .st 一起解析(跨文件 GVL/FB 引用需要);优先传 true/false,兼容 "True"/"False" 字符串',
        ),
      });

  const validateStCode = tool({
    name: "validate_st_code",
    description: inlineStValidation
      ? "校验内存中的完整 IEC 61131-3 ST 草稿。当前处于固定交付流水线的草稿阶段，只能传 code；不要传 path，也不要在校验成功前调用 write_file、export_st_program 或 run_command。errorCount=0 才算通过，warning 只作提示。" +
        "校验成功后运行时会锁定这份源码，下一步只能把完全相同的源码交给 write_file。"
      :
      "用 ST 语言服务器(st-analyze)校验 IEC 61131-3 ST 代码,返回带行列号的诊断。" +
      "优先用 path 校验工作区里的真实 .st 文件,只有裸代码才用 code。" +
      "结果里 errorCount=0 才算通过校验;warningCount 只作提示,不阻断交付。" +
      "path 校验始终读取完整文件;返回的 validatedContentHash 是本次实际校验内容的哈希。" +
      "不要因为 read_file 界面里的摘要省略号就重写文件,只有 data.truncated=true 才表示本次读取确实是分段结果。" +
      "该校验器不覆盖全部语义(例如内置 FB 参数类型),不要把它当成可上机运行的证明。",
    parameters: validateStCodeParameters,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: (input, _context, details) =>
      guard(async () => {
        const code = "code" in input ? parseOptionalString(input.code) : undefined;
        const p = "path" in input ? parseOptionalString(input.path) : undefined;
        const loadWorkspaceContext = parseOptionalBoolean(input.loadWorkspaceContext);
        const validationInput = await resolveStValidationInput(
          p,
          code,
          loadWorkspaceContext,
        );
        const validationCacheKey = inlineStValidation
          ? [
              "validate_st_code",
              validationInput.contentHash || hashStContent(validationInput.target.text),
              loadWorkspaceContext === undefined ? "default" : String(loadWorkspaceContext),
            ].join(":")
          : undefined;
        const cachedValidation = validationCacheKey
          ? stValidationCache.get(validationCacheKey)
          : undefined;
        if (cachedValidation) return cachedValidation;

        const runValidation = (async (): Promise<string> => {
          const result = await stAnalyzer.verify(
            {
              workspaceRoot: workspace.primaryRoot,
              targets: [validationInput.target],
              context: validationInput.context,
              ...(stToolOptions.maxDiagnostics ? { options: { maxDiagnostics: stToolOptions.maxDiagnostics } } : {}),
            },
            { signal: details?.signal },
          );
          const counts = countStDiagnostics(result);
          const diagnostics = (result.results[0]?.diagnostics ?? []).map((diagnostic: StDiagnostic) => ({
            ...diagnostic,
            path: validationInput.label,
          }));
          const validationFailed = isStValidationFailure(result);
          const summary = [
            `引擎=${result.engine.id}`,
            `error=${counts.error}`,
            `warning=${counts.warning}`,
            `上下文文件=${result.contextLoaded}`,
          ].join(" ");
          const validatedHash = hashStContent(validationInput.target.text);
          const repairPacket = validationFailed
            ? compressDiagnostics({
                toolName: "validate_st_code",
                phase: "st_validation",
                instruction:
                  "ST 校验失败。只根据这些压缩诊断和代码片段做最小修改；保持无关代码不变，修改后必须再次调用 validate_st_code 校验完整草稿。",
                diagnostics,
                sources: [{
                  path: validationInput.label,
                  text: validationInput.target.text,
                }],
                sourceHash: validatedHash,
              })
            : undefined;
          const protocolDiagnostics = repairPacket
            ? repairPacketToProtocolDiagnostics(repairPacket)
            : toProtocolDiagnostics(diagnostics);
          if (!validationFailed) {
            validatedStContent.add(validatedHash);
            if (!p) deliveryWorkflow?.recordSuccessfulValidation?.(
              validationInput.target.text,
              validatedHash,
            );
          }
          audit({
            type: "tool_completed",
            toolName: "validate_st_code",
            risk: "plan",
            ok: !validationFailed,
            summary,
            metadata: {
              errorCount: counts.error,
              warningCount: counts.warning,
              infoCount: counts.info,
              validationTarget: {
                path: validationInput.label,
                complete: validationInput.complete,
                totalLines: validationInput.totalLines,
                totalBytes: validationInput.totalBytes,
                contentHash: validationInput.contentHash || validatedHash,
              },
              diagnostics,
              ...(repairPacket
                ? {
                    repairPacketSummary: {
                      totalDiagnostics: repairPacket.totalDiagnostics,
                      duplicateCount: repairPacket.duplicateCount,
                      omittedCount: repairPacket.omittedCount,
                      truncated: repairPacket.truncated,
                    },
                  }
                : {}),
            },
          });
          if (validationFailed) {
            diagnosticReporter?.({
              toolName: "validate_st_code",
              phase: "st_validation",
              summary,
              counts,
              validationTarget: {
                path: validationInput.label,
                complete: validationInput.complete,
                totalLines: validationInput.totalLines,
                totalBytes: validationInput.totalBytes,
                contentHash: validationInput.contentHash || validatedHash,
              },
              diagnostics,
              ...(repairPacket ? { repairPacket } : {}),
            });
          }
          return toolResult({
            ok: !validationFailed,
            data: {
              engine: result.engine.id,
              errorCount: counts.error,
              warningCount: counts.warning,
              infoCount: counts.info,
              validatedContentHash: validationFailed ? undefined : validatedHash,
              validationTarget: {
                path: validationInput.label,
                complete: validationInput.complete,
                totalLines: validationInput.totalLines,
                totalBytes: validationInput.totalBytes,
                contentHash: validationInput.contentHash || validatedHash,
              },
              diagnostics: repairPacket ? repairPacket.diagnostics : diagnostics,
              ...(repairPacket
                ? {
                    repairPacket,
                    diagnosticCompression: {
                      enabled: true,
                      originalDiagnosticsInAudit: true,
                      totalDiagnostics: repairPacket.totalDiagnostics,
                      duplicateCount: repairPacket.duplicateCount,
                      omittedCount: repairPacket.omittedCount,
                      truncated: repairPacket.truncated,
                    },
                  }
                : {}),
              context: {
                files: result.contextLoaded,
                truncated: validationInput.contextTruncated,
                ...(validationInput.contextSkipped ? { skipped: validationInput.contextSkipped } : {}),
              },
              elapsedMs: result.elapsedMs,
              analyzer: {
                ...(result.engine.detail ? { detail: result.engine.detail } : {}),
                ...(result.engine.fallbackReason ? { fallbackReason: result.engine.fallbackReason } : {}),
              },
              summary,
            },
            ...(validationFailed
              ? {
                  error: `ST 校验未通过(${counts.error} 个 error);warning 只提示,不阻断。`,
                }
              : {}),
            diagnostics: protocolDiagnostics,
            effect: "none",
            risk: "plan",
          });
        })();
        if (validationCacheKey) stValidationCache.set(validationCacheKey, runValidation);
        try {
          return await runValidation;
        } catch (error) {
          if (validationCacheKey) stValidationCache.delete(validationCacheKey);
          throw error;
        }
      }, "plan"),
  });

  const validateStContentBeforeWrite: ValidateStContentBeforeWrite = async (
    content,
    targetLabel,
    signal,
  ) => {
    const validationInput = await resolveStValidationInput(
      undefined,
      content,
      stToolOptions.loadWorkspaceContext,
    );
    const result = await stAnalyzer.verify(
      {
        workspaceRoot: workspace.primaryRoot,
        targets: [validationInput.target],
        context: validationInput.context,
        ...(stToolOptions.maxDiagnostics ? { options: { maxDiagnostics: stToolOptions.maxDiagnostics } } : {}),
      },
      { signal },
    );
    const counts = countStDiagnostics(result);
    const diagnostics = (result.results[0]?.diagnostics ?? []).map((diagnostic: StDiagnostic) => ({
      ...diagnostic,
      path: targetLabel,
    }));
    const validationFailed = isStValidationFailure(result);
    const contentHash = hashStContent(content);
    const summary = [
      `引擎=${result.engine.id}`,
      `error=${counts.error}`,
      `warning=${counts.warning}`,
      `上下文文件=${result.contextLoaded}`,
    ].join(" ");
    const repairPacket = validationFailed
      ? compressDiagnostics({
          toolName: "write_file",
          phase: "st_pre_write_validation",
          instruction:
            "写入前 ST 校验失败。只根据这些压缩诊断和代码片段做最小修改；修复后必须重新校验并写入同一份完整内容。",
          diagnostics,
          sources: [{ path: targetLabel, text: content }],
          sourceHash: contentHash,
        })
      : undefined;
    if (!validationFailed) {
      validatedStContent.add(contentHash);
      deliveryWorkflow?.recordSuccessfulValidation?.(content, contentHash);
    }
    audit({
      type: "tool_completed",
      toolName: "write_file.pre_validate_st_code",
      risk: "plan",
      ok: !validationFailed,
      summary,
      metadata: {
        errorCount: counts.error,
        warningCount: counts.warning,
        infoCount: counts.info,
        validationTarget: {
          path: targetLabel,
          complete: true,
          totalLines: content.split(/\r?\n/).length,
          totalBytes: Buffer.byteLength(content, "utf8"),
          contentHash,
        },
        diagnostics,
        ...(repairPacket
          ? {
              repairPacketSummary: {
                totalDiagnostics: repairPacket.totalDiagnostics,
                duplicateCount: repairPacket.duplicateCount,
                omittedCount: repairPacket.omittedCount,
                truncated: repairPacket.truncated,
              },
            }
          : {}),
      },
    });
    if (validationFailed) {
      diagnosticReporter?.({
        toolName: "write_file",
        phase: "st_pre_write_validation",
        summary,
        counts,
        validationTarget: {
          path: targetLabel,
          complete: true,
          totalLines: content.split(/\r?\n/).length,
          totalBytes: Buffer.byteLength(content, "utf8"),
          contentHash,
        },
        diagnostics,
        ...(repairPacket ? { repairPacket } : {}),
      });
    }
    return {
      ok: !validationFailed,
      contentHash,
      counts,
      diagnostics,
      protocolDiagnostics: repairPacket
        ? repairPacketToProtocolDiagnostics(repairPacket)
        : toProtocolDiagnostics(diagnostics),
      repairPacket,
      summary,
      engine: result.engine,
      elapsedMs: result.elapsedMs,
      contextLoaded: result.contextLoaded,
    };
  };

  const exportStProgram = tool({
    name: "export_st_program",
    description:
      '把一段完整的 IEC 61131-3 ST 程序导出为 .st 文件保存到本地(用户要求"导出/保存/落地文件"时使用)。',
    parameters: z.object({
      code: z.string().describe("完整 ST 源码(PROGRAM ... END_PROGRAM)"),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ code }) =>
      withEffect("export_st_program", { code }, "write", async () => {
        if (requiresStValidation && !validatedStContent.has(hashStContent(code))) {
          return toolResult({
            ok: false,
            error: "ST 代码在导出前必须先通过 validate_st_code，且必须校验当前这份完整代码。",
            diagnostics: [{
              code: "st_validation_required",
              message: "未找到当前代码对应的 validate_st_code 成功回执(errorCount=0)。",
              severity: "error",
            }],
            effect: "none",
            risk: "plan",
          });
        }
        const m = /PROGRAM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(code);
        const name = m?.[1] ?? `program_${Date.now()}`;
        await fs.mkdir(cfg.exportDir, { recursive: true });
        const file = path.join(cfg.exportDir, `${name}.st`);
        await fs.writeFile(file, code, "utf8");
        return contract({
          file,
          bytes: Buffer.byteLength(code, "utf8"),
          contentHash: hashStContent(code),
        }, "write", "filesystem");
      }),
  });

  return {
    validateStCode,
    validateStContentBeforeWrite,
    exportStProgram,
  };
}
