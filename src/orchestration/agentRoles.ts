import { Agent, type Model, type Tool } from '@openai/agents';
import { z } from 'zod';
import { toolResult } from '../tools/toolContract';

export type IndustrialAgentMode = 'single' | 'team';

export const plcReviewReportSchema = z.object({
  approved: z.boolean(),
  summary: z.string(),
  findings: z.array(z.string()),
  requiredChanges: z.array(z.string()),
});

export type PlcReviewReport = z.infer<typeof plcReviewReportSchema>;

/**
 * Role boundaries for the industrial workflow. The planner owns the
 * conversation, the reviewer is a bounded read-only sub-agent tool, and only
 * the executor receives tools that can interact with the workspace or devices.
 */
export function createIndustrialAgentTeam(model: string | Model, tools: Tool[]) {
  const reviewer = new Agent({
    name: 'PLC Safety Reviewer',
    handoffDescription: '检查 PLC 方案的互锁、急停、故障复位和 IEC 61131-3 正确性。',
    model,
    outputType: plcReviewReportSchema,
    instructions:
      '你是只读安全审查角色。检查传入的 PLC 方案中的互锁、急停、故障态、边沿与定时器语义。' +
      '不得执行工具或假定现场状态。必须只返回符合 schema 的审查报告；approved 只有在没有阻断性风险时才为 true。',
  });
  const reviewerTool = reviewer.asTool({
    toolName: 'review_plc_plan',
    toolDescription: '对 PLC 程序或控制方案做只读安全审查，返回结构化风险和必改项。',
    customOutputExtractor: async ({ finalOutput }) =>
      toolResult({ ok: true, data: finalOutput, effect: 'none', risk: 'plan' }),
  });
  const executor = new Agent({
    name: 'PLC Controlled Executor',
    handoffDescription: '在策略、审批与审计约束下执行工作区或 PLC 工具。',
    model,
    tools,
    instructions:
      '你是受控执行角色。只执行已给出的具体步骤；写文件、运行命令或设备写入必须经过审批。' +
      '所有结论必须基于结构化工具结果，工具失败时立即停止相关动作。',
  });
  const planner = Agent.create({
    name: 'PLC Workflow Planner',
    handoffDescription: '拆解工控需求并协调安全审查与受控执行。',
    model,
    tools: [reviewerTool],
    handoffs: [executor],
    instructions:
      '你是工控任务规划角色。先确认目标和已知现场信息，再形成步骤；' +
      '涉及 PLC 程序或控制逻辑时先调用 review_plc_plan 获取结构化审查报告；' +
      '只有审查通过并且用户目标需要实际操作时，才把控制权交给受控执行角色。' +
      '不得绕过策略、审批或审计。',
  });
  return { planner, reviewer, reviewerTool, executor };
}
