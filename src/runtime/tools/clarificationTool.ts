import { tool } from '@openai/agents';
import { z } from 'zod';
import {
  CLARIFICATION_TOOL_NAME,
  summarizeClarificationResponse,
} from '../clarification';
import type { ToolBuildContext } from './toolBuildContext';

const optionSchema = z.object({
  id: z.string().min(1).describe('稳定的选项 id，用短英文或数字，不要包含空格'),
  label: z.string().min(1).describe('展示给用户看的选项文字'),
  description: z.string().optional().describe('该选项的简短说明，可省略'),
  value: z.string().optional().describe('选项对应的结构化值；复杂值请用 JSON 字符串'),
});

const stepSchema = z.object({
  id: z.string().min(1).describe('步骤答案的稳定字段名，例如 projectType 或 projectName'),
  title: z.string().optional().describe('该步骤的标题，可省略并沿用总标题'),
  question: z.string().min(1).describe('该步骤要问用户的问题'),
  details: z.string().optional().describe('该步骤的必要背景，可省略'),
  options: z.array(optionSchema).max(8).optional().describe('该步骤的候选选项'),
  allowCustom: z.boolean().optional().describe('该步骤是否允许自定义输入，默认允许'),
  customPlaceholder: z.string().optional().describe('该步骤自定义输入框提示'),
  required: z.boolean().optional().describe('该步骤是否必须回答，默认是'),
});

export function createClarificationTool(ctx: ToolBuildContext) {
  const { contract, failed, guardrails } = ctx;

  return tool({
    name: CLARIFICATION_TOOL_NAME,
    description:
      '当用户需求缺少关键选择或参数时，弹出澄清问题让用户选择或填写。' +
      '只用于补齐需求，不用于审批写文件、运行命令或设备操作。' +
      '如果只是能合理默认的普通细节，不要打断用户。' +
      '只有一个问题时使用 title/question/options；有多个彼此独立且都需要用户确认的问题时，' +
      '使用 steps 一次性提交步骤数组，运行时会逐步弹窗，每步只问一个问题，最终返回按 id 整理的 answers。' +
      '使用 steps 时，候选 options 必须放在对应步骤内；顶层 options 只用于单步骤请求。',
    parameters: z.object({
      kind: z.string().optional().describe('澄清类型，例如 general 或 plc_task_configuration'),
      title: z.string().optional().describe('单步骤弹窗标题；多步骤时可作为默认总标题'),
      question: z.string().optional().describe('单步骤要问的问题；使用 steps 时可省略'),
      details: z.string().optional().describe('必要背景或当前推断，可省略'),
      options: z.array(optionSchema).max(8).optional().describe('给用户的候选选项，可省略'),
      allowCustom: z.boolean().optional().describe('是否允许用户填写自定义答案，默认允许'),
      customPlaceholder: z.string().optional().describe('自定义输入框提示文字'),
      required: z.boolean().optional().describe('是否必须回答才能继续，默认是'),
      steps: z.array(stepSchema).min(1).max(16).optional().describe(
        '多个需要依次确认的步骤；每个步骤必须有唯一 id 和 question。已经明确的字段不要放进来。',
      ),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async (input, _context, details) => {
      const service = ctx.cfg.clarification;
      if (!service) {
        return failed(
          '当前宿主没有提供澄清弹窗能力，无法向用户追问。',
          'plan',
        );
      }
      const steps = input.steps ?? [];
      if (!steps.length && !input.question?.trim()) {
        return failed(
          '澄清请求缺少 question；多个问题请放入 steps。',
          'plan',
        );
      }
      if (new Set(steps.map((step) => step.id)).size !== steps.length) {
        return failed('澄清步骤 id 必须唯一。', 'plan');
      }
      try {
        const response = await service.request(
          {
            kind: input.kind ?? 'general',
            title: input.title ?? steps[0]?.title ?? '需要补充信息',
            question: input.question ?? steps[0]?.question ?? '请补充必要信息。',
            ...(input.details ? { details: input.details } : {}),
            ...(!steps.length && input.options?.length ? { options: input.options } : {}),
            allowCustom: input.allowCustom !== false,
            ...(input.customPlaceholder ? { customPlaceholder: input.customPlaceholder } : {}),
            required: input.required !== false,
            ...(steps.length ? {
              steps: steps.map((step) => ({
                id: step.id,
                ...(step.title ? { title: step.title } : {}),
                question: step.question,
                ...(step.details ? { details: step.details } : {}),
                ...(step.options?.length ? { options: step.options } : {}),
                allowCustom: step.allowCustom !== false,
                ...(step.customPlaceholder ? { customPlaceholder: step.customPlaceholder } : {}),
                required: step.required !== false,
              })),
            } : {}),
          },
          details?.signal,
        );
        return contract({
          ...response,
          summary: summarizeClarificationResponse(response),
        }, 'plan');
      } catch (error) {
        return failed(error, 'plan');
      }
    },
  });
}
