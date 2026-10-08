import {
  Agent,
  Runner,
  type AgentInputItem,
} from "@openai/agents";
import { z } from "zod";
import { agentLog, buildModelAdapter } from "./modelGateway";
import type { AgentConfig } from "./agentConfig";
import {
  createTaskPlan,
  taskPlanDecisionSchema,
  type TaskPlan,
} from "./taskPlan";
import {
  deliveryContractDecisionSchema,
  normalizeWorkflowContract,
  type DeliveryContract,
} from "./deliveryContract";
import { AgentDecisionService } from "./decision/agentDecision";
import type {
  WorkflowDecisionSignals,
  WorkflowDescriptor,
  WorkflowFallbackMode,
  WorkflowModelDecision,
} from "./workflow/types";

/**
 * Ask the model whether the request needs a bounded linear workflow.
 * This planner has no tools and cannot mutate the workspace; callers may
 * safely fall back to the existing single-agent path if planning fails.
 */
export async function planTask(
  cfg: AgentConfig,
  userText: string,
  signal?: AbortSignal,
  history: AgentInputItem[] = [],
): Promise<TaskPlan | undefined> {
  if (isSimpleSingleTurnRequest(userText)) return undefined;
  const adapter = buildModelAdapter(cfg, "planner");
  const planner = new Agent({
    name: "通用任务规划器",
    model: adapter.model,
    instructions:
      "你是通用任务规划器，不执行任何工具，也不输出领域专用方案。" +
      "判断用户目标是否包含两个或以上有先后关系、需要分别确认完成的动作。" +
      "单一问答、解释、改写或一次性操作返回 requiresPlan=false。" +
      "多个彼此独立、可在同一轮并行完成的一次性查询也返回 requiresPlan=false，例如查看 git 和 Java 版本、读取几个文件、查询几个变量。" +
      "只有上一步结果会决定下一步动作、需要跨步骤验证或有真实先后依赖时才返回 requiresPlan=true。" +
      "需要多步时只生成 2 到 8 个线性步骤，每一步都必须是可执行目标，并给出清晰完成标准。" +
      "不要臆造用户没有提出的动作；suggestedTools 只填写通用工具名或空数组。" +
      "必须严格返回 schema，不要输出 markdown。",
    outputType: taskPlanDecisionSchema,
  });
  const tracingDisabled = !(
    adapter.provider === "openai" &&
    adapter.apiFormat === "responses" &&
    !cfg.baseUrl.trim()
  );
  const plannerInput: string | AgentInputItem[] = history.length
    ? [
        ...history,
        { type: "message", role: "user", content: userText },
      ]
    : userText;
  const result = await new Runner({ tracingDisabled }).run(planner, plannerInput, {
    stream: false,
    maxTurns: 1,
    signal,
  });
  return createTaskPlan(result.finalOutput, userText);
}

export async function classifyDeliveryContract(
  cfg: AgentConfig,
  userText: string,
  signal?: AbortSignal,
  history: AgentInputItem[] = [],
  decisionSignals?: WorkflowDecisionSignals,
): Promise<DeliveryContract | undefined> {
  const decisionService = cfg.decisionService ?? new AgentDecisionService(agentLog);
  const reusedWorkflowSignals = decisionSignals !== undefined;
  const hint = decisionSignals ?? await decisionService.taskHint(cfg.jev, userText, signal);
  if (reusedWorkflowSignals) {
    const confidence = typeof hint.deliveryConfidence === "number"
      ? hint.deliveryConfidence.toFixed(2)
      : "unknown";
    agentLog(
      `[delivery] 复用 Workflow Jev 信号 delivery=${hint.delivery}` +
        `(conf=${confidence})，不重复请求 Jev`,
    );
  }
  if (hint.delivery === "not_required") {
    agentLog(
      `[delivery] Jev 高置信度判断无需交付物(${hint.deliveryConfidence.toFixed(2)})，跳过交付契约模型判定`,
    );
    return normalizeWorkflowContract({
      requiresDeliverable: false,
      reason: "Jev 判断本轮是问答、查询或只读操作，不要求交付物",
      deliverables: [],
    });
  }
  if (hint.delivery === "required") {
    agentLog(
      `[delivery] Jev 判断需要交付物(${hint.deliveryConfidence.toFixed(2)})，继续使用完整交付契约判定`,
    );
  }
  const adapter = buildModelAdapter(cfg, "delivery_classifier");
  const classifier = new Agent({
    name: "交付契约判定器",
    model: adapter.model,
    instructions:
      "你只做任务交付契约判定,不执行用户任务,不调用工具,不输出正文答案。" +
      "判断用户本轮是否要求产生、修改、保存或导出一个可交付结果。" +
      "可交付结果包括代码、文件、文档、报告、数据、项目、配置、方案文本等；普通问答、解释、读取、查询或只要状态信息不算强制交付。" +
      "如果用户说继续、接着、为什么停了等,必须结合历史判断是否仍在追一个未交付的结果。" +
      "requiresDeliverable=true 时列出 1 到 8 个必需交付物；每个交付物必须能用 artifacts 或成功工具回执验证。" +
      "不要默认把程序说明、运行说明、变量说明或使用说明列为独立必需交付物；只有用户明确要求文档、说明书、报告或使用指南时才列出这类交付物。" +
      "当用户强调重点看代码、主要看生成代码或变量模拟即可时，通常只需要代码交付物，不要额外制造说明文档交付物。" +
      "直接在聊天中生成的内容也必须要求 final_artifact 作为证据；不要把普通 message 当成可验收证据。" +
      "写入/保存/导出类任务可接受 successful_write 或 successful_export；其他工具型交付可接受 successful_tool。" +
      "用户要求生成代码时，默认 workspacePersistence=required；只有用户明确要求只展示、不要保存或不要写文件时才设置 not_required。" +
      "必须严格返回 schema,不要输出 markdown。",
    outputType: deliveryContractDecisionSchema,
  });
  const tracingDisabled = !(
    adapter.provider === "openai" &&
    adapter.apiFormat === "responses" &&
    !cfg.baseUrl.trim()
  );
  const input: string | AgentInputItem[] = history.length
    ? [...history, { type: "message", role: "user", content: userText }]
    : userText;
  const result = await new Runner({ tracingDisabled }).run(classifier, input, {
    stream: false,
    maxTurns: 1,
    signal,
  });
  return normalizeWorkflowContract(result.finalOutput);
}

const workflowFallbackModeSchema = z.enum([
  "general_chat",
  "read_only",
  "file_edit",
  "command_query",
  "needs_clarification",
  "blocked_high_risk",
]);

const workflowClassifierOutputSchema = z.object({
  kind: z.enum(["workflow", "fallback"]),
  workflowId: z.string().optional(),
  fallbackMode: workflowFallbackModeSchema.optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
}).strict();

export async function classifyWorkflowDecision(
  cfg: AgentConfig,
  userText: string,
  signal: AbortSignal | undefined,
  history: AgentInputItem[] = [],
  workflows: readonly WorkflowDescriptor[] = [],
): Promise<WorkflowModelDecision | undefined> {
  if (!workflows.length) return undefined;
  const adapter = buildModelAdapter(cfg, "workflow_classifier");
  const workflowList = workflows
    .map((workflow) =>
      `- ${workflow.id}: ${workflow.title}; ${workflow.description}; runtimeManaged=${workflow.runtimeManaged}`,
    )
    .join("\n");
  const classifier = new Agent({
    name: "Workflow 路由判定器",
    model: adapter.model,
    instructions:
      "你只做 workflow 路由判定，不执行用户任务，不调用工具，不生成代码。" +
      "你必须在已注册 workflow 和 fallback mode 之间选择一个。" +
      "只有用户目标明确属于某个已注册 workflow 时才选择 workflow；不确定时选择 fallback。" +
      "不要根据某个具体行业词硬猜 workflow，必须看用户是否在请求该 workflow 的交付或操作。" +
      "fallbackMode 可选: general_chat 普通问答；read_only 只读文件/状态；file_edit 普通文件修改；command_query 执行受控命令查询环境或工具状态；" +
      "needs_clarification 有交付倾向但交付类型不明确；blocked_high_risk 高风险副作用需先停止或审批。" +
      "已注册 workflow:\n" +
      workflowList +
      "\n必须严格返回 schema，不要输出 markdown。",
    outputType: workflowClassifierOutputSchema,
  });
  const tracingDisabled = !(
    adapter.provider === "openai" &&
    adapter.apiFormat === "responses" &&
    !cfg.baseUrl.trim()
  );
  const input: string | AgentInputItem[] = history.length
    ? [...history, { type: "message", role: "user", content: userText }]
    : userText;
  const result = await new Runner({ tracingDisabled }).run(classifier, input, {
    stream: false,
    maxTurns: 1,
    signal,
  });
  const parsed = workflowClassifierOutputSchema.parse(result.finalOutput);
  if (parsed.confidence < 0.72) return undefined;
  if (parsed.kind === "workflow") {
    const workflowId = parsed.workflowId?.trim();
    if (!workflowId || !workflows.some((workflow) => workflow.id === workflowId)) {
      return undefined;
    }
    return {
      kind: "workflow",
      workflowId,
      confidence: parsed.confidence,
      reason: parsed.reason,
    };
  }
  const mode = parsed.fallbackMode as WorkflowFallbackMode | undefined;
  if (!mode) return undefined;
  return {
    kind: "fallback",
    mode,
    confidence: parsed.confidence,
    reason: parsed.reason,
  };
}

export function isSimpleSingleTurnRequest(userText: string): boolean {
  const text = userText.trim();
  if (!text || text.length > 160) return false;
  const hasMutationIntent =
    /写入|修改|改成|保存|导出|删除|安装|升级|生成|创建|修复|提交|commit|install|upgrade|delete|write|save|export/i.test(text);
  if (hasMutationIntent) return false;
  const asksVersion =
    /版本|version/i.test(text) &&
    /查看|看一下|查询|检查|显示|获取|show|check|get/i.test(text);
  if (asksVersion) return true;
  const asksSimpleRead =
    /^(读取|查看|列出|搜索|查询|检查|显示|获取)/.test(text) &&
    !/然后|之后|再|接着|最后|并保存|并写入|导出|修改/.test(text);
  return asksSimpleRead;
}
