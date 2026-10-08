import { tool, type Tool } from "@openai/agents";
import { z } from "zod";
import { toolResult } from "../tools/toolContract";
import {
  updateTaskPlan,
  type TaskPlan,
  type TaskPlanProgress,
} from "./taskPlan";

export interface MutableTaskPlanRef {
  value: TaskPlan | undefined;
}

export function createPlanProgressTool(
  planRef: MutableTaskPlanRef,
  onPlanProgress?: (progress: TaskPlanProgress) => Promise<void> | void,
): Tool | undefined {
  if (!planRef.value) return undefined;
  return tool({
    name: "report_plan_progress",
    description:
      "报告通用线性计划中一个步骤的开始或完成。完成步骤时必须基于本步骤实际工具回执提交自检结论；只有 verdict=passed 才会推进下一步。retry 或 revise 会保留当前步骤，并把纠正方向返回给你。此工具不执行外部副作用。",
    parameters: z.object({
      stepId: z.string().describe("计划中的步骤 ID，例如 step-1"),
      phase: z.enum(["started", "completed"]),
      note: z.string().optional().describe("简短说明本步骤的实际进展或完成依据"),
      verification: z.object({
        verdict: z.enum(["passed", "retry", "revise"]),
        evidence: z.string().describe("基于真实工具回执、文件内容或已确认输入的具体证据，不能只说‘已完成’"),
        issue: z.string().optional().describe("未通过时发现的具体问题"),
        nextAction: z.string().optional().describe("未通过时下一次要执行的修正动作"),
      }).optional().describe("仅在 phase=completed 时提供；没有实际证据时选择 retry 或 revise"),
    }),
    execute: async (progress) => {
      planRef.value = updateTaskPlan(planRef.value!, progress as TaskPlanProgress);
      await onPlanProgress?.(progress as TaskPlanProgress);
      const verification = progress.verification;
      const advanced =
        progress.phase !== "completed" ||
        verification?.verdict === "passed";
      if (!advanced) {
        return toolResult({
          ok: false,
          error: "步骤自检未通过，计划未推进。请根据 issue 和 nextAction 继续修正当前步骤，取得新的真实证据后再报告完成。",
          data: {
            stepId: progress.stepId,
            phase: progress.phase,
            planStatus: planRef.value.status,
            verification,
          },
          effect: "none",
          risk: "plan",
        });
      }
      return toolResult({
        ok: true,
        data: {
          stepId: progress.stepId,
          phase: progress.phase,
          planStatus: planRef.value.status,
          verification,
        },
        effect: "none",
        risk: "plan",
      });
    },
  });
}

export function createArtifactDeliveryTool(
  enabled: boolean,
): Tool | undefined {
  if (!enabled) return undefined;
  return tool({
    name: "deliver_artifact",
    description:
      "提交本轮用户要求的内联交付物。适用于代码、文档、报告、数据或配置等内容；必须填写完整内容，不能只写摘要或计划。文档/说明/Markdown 优先使用 kind=report；代码优先使用 kind=code；只有泛文件交付才使用 kind=file。该工具不修改文件、不执行命令，只把内容登记为最终交付证据。",
    parameters: z.object({
      kind: z.enum(["file", "code", "report", "data", "unknown"]),
      name: z.string().min(1).describe("交付物名称"),
      mimeType: z.string().optional().describe("可选 MIME 类型"),
      content: z.string().min(1).describe("完整交付内容，不能省略"),
    }),
    execute: async ({ kind, name, mimeType, content }) =>
      toolResult({
        ok: true,
        data: {
          artifact: {
            kind,
            name,
            ...(mimeType?.trim() ? { mimeType: mimeType.trim() } : {}),
            content,
          },
        },
        effect: "none",
        risk: "plan",
      }),
  });
}
