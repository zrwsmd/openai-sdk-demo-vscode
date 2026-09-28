import { tool } from "@openai/agents";
import { z } from "zod";
import {
  applyPreparedFileEdit,
  prepareFileEdit,
} from "../../tools/workspaceTools";
import type { ToolBuildContext } from "./toolBuildContext";
import { beforeEffectFailureResult } from "./toolBuildContext";

const editOperationSchema = z.object({
  oldText: z.string().min(1).describe("要精确匹配的原文片段"),
  newText: z.string().describe("替换后的文本,可以是空字符串"),
  replaceAll: z.boolean().optional().describe("是否替换全部匹配;默认只允许唯一匹配"),
}).strict();

export function createEditFileTool(ctx: ToolBuildContext) {
  const {
    contract,
    guardrails,
    guard,
    runBeforeEffects,
    workspace,
    withEffect,
  } = ctx;

  return tool({
    name: "edit_file",
    description:
      "编辑已存在的工作区文本文件。使用精确 oldText 替换为 newText，支持一次提交多个编辑；工具会在实际改动后返回 unified diff。匹配不唯一时必须缩小 oldText 或明确 replaceAll=true。属于写操作，执行前需要用户在界面批准。",
    parameters: z.object({
      path: z.string().describe("相对工作区的文件路径"),
      edits: z.array(editOperationSchema).min(1).max(32).describe("按顺序执行的精确文本替换列表"),
    }).strict(),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p, edits }, _context, details) =>
      guard(
        async () => {
          details?.signal?.throwIfAborted();
          const target = workspace.resolve(p);
          const prepared = await prepareFileEdit(
            target.root,
            target.relativePath,
            edits,
          );
          const beforeEffect = await runBeforeEffects({
            toolName: "edit_file",
            input: {
              path: target.relativePath,
              workspaceRoot: target.root,
              edits,
              content: prepared.content,
              previousContent: prepared.originalContent,
              diff: prepared.result.diff,
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
            "edit_file",
            {
              path: target.relativePath,
              workspaceRoot: target.root,
              edits,
            },
            "write",
            async () =>
              contract(
                {
                  ...(await applyPreparedFileEdit(prepared)),
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
