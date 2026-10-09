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

export function createClarificationTool(ctx: ToolBuildContext) {
  const { contract, failed, guardrails } = ctx;

  return tool({
    name: CLARIFICATION_TOOL_NAME,
    description:
      '当用户需求缺少关键选择或参数时，弹出澄清问题让用户选择或填写。' +
      '只用于补齐需求，不用于审批写文件、运行命令或设备操作。' +
      '如果只是能合理默认的普通细节，不要打断用户。',
    parameters: z.object({
      kind: z.string().optional().describe('澄清类型，例如 general 或 plc_task_configuration'),
      title: z.string().min(1).describe('弹窗标题，简短说明要确认的主题'),
      question: z.string().min(1).describe('要问用户的问题'),
      details: z.string().optional().describe('必要背景或当前推断，可省略'),
      options: z.array(optionSchema).max(8).optional().describe('给用户的候选选项，可省略'),
      allowCustom: z.boolean().optional().describe('是否允许用户填写自定义答案，默认允许'),
      customPlaceholder: z.string().optional().describe('自定义输入框提示文字'),
      required: z.boolean().optional().describe('是否必须回答才能继续，默认是'),
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
      try {
        const response = await service.request(
          {
            kind: input.kind ?? 'general',
            title: input.title,
            question: input.question,
            ...(input.details ? { details: input.details } : {}),
            ...(input.options?.length ? { options: input.options } : {}),
            allowCustom: input.allowCustom !== false,
            ...(input.customPlaceholder ? { customPlaceholder: input.customPlaceholder } : {}),
            required: input.required !== false,
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
