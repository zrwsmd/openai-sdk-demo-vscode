/**
 * PLC Agent 内核 —— 与 VSCode 完全解耦(纯 Node 逻辑,可单测、可搬到任何宿主)
 *
 * 从 CLI 版 main.mjs 移植:同样的工具、同样的系统提示词、同样的流式事件。
 * 已接入的 SDK 能力:流式 + 工具调用 + maxTurns + usage 汇总 + Session 会话持久化
 * + needsApproval 工具审批(危险工具先经 UI 允许再执行)。
 */

import {
  Agent,
  Runner,
  MaxTurnsExceededError,
  RunState,
  type RunToolApprovalItem,
  type AgentInputItem,
  type Session,
  type SessionInputCallback,
  type StreamedRunResult,
  type AgentOutputType,
} from "@openai/agents";
import { toolResult, type ToolRisk } from "../tools/toolContract";
import { DefaultActionPolicy } from "../policy/actionPolicy";
import type { RequiredAgentTool } from "../policy/actionPolicy";
import {
  workspaceScopeFromRoots,
} from "../workspace/workspaceScope";
import {
  createIndustrialAgentTeam,
} from "../orchestration/agentRoles";
import {
  createToolResult,
  createAgentResult,
  type AgentResult,
  type ApprovalRequest as ProtocolApprovalRequest,
  type Artifact,
  type ToolResult,
  type UsageSummary,
} from "../protocol/results";
import { AgentStreamAdapter } from "./streaming";
import type { AgentEventFactory, AgentProtocolEvent } from "../protocol/events";
import {
  industrialAgentOutputDefinition,
  industrialFinalArtifactOutputSchema,
  type IndustrialAgentOutput,
  projectAgentOutput,
} from "./output";
import {
  officialResponsesCompactionSettings,
  promptCacheModelSettings,
} from "./modelAdapter";
import {
  renderTaskPlan,
  type TaskPlan,
  type TaskPlanProgress,
} from "./taskPlan";
import {
  type TeamTask,
} from "../orchestration/teamTask";
import {
  evaluateCompletionGate,
  type CompletionGateResult,
} from "./completionGate";
import {
  renderDeliveryContract,
  type DeliveryContract,
  type DeliveryEvidence,
} from "./deliveryContract";
import {
  createWorkflowRuntime,
  getWorkflowDescriptor,
} from "./workflow/runtime";
import { createWorkflowRuntimeState } from "./workflow/runtimeState";
import {
  commandToolResult,
  getDefaultToolRegistry,
  type DiagnosticSideReporter,
  type RuntimeToolCallGuard,
  type ToolRegistry,
} from "./toolRegistry";
import type { AgentConfig } from "./agentConfig";
import { PipelineStageRuntime } from "./pipeline/stageRuntime";
import { AgentDecisionService } from "./decision/agentDecision";
import {
  buildCompletionEvidenceSummaries,
  compactCompletionDecisionText,
} from "./decision/completionEvidence";
import { resolveWorkflowBusinessToolPolicy } from "./workflow/types";
import type { WorkflowRegistry } from "./workflow/registry";
import {
  runFinalOutputFinalizer,
  synthesizeStructuredFailure,
} from "./finalOutputFinalizer";
import {
  agentLog,
  buildModelAdapter,
  EmptyGatewayResponseError,
  GatewayGuardedModel,
  makeLoggingFetch,
} from "./modelGateway";
import {
  coerceIndustrialAgentOutput,
  isInvalidFinalOutputTypeError,
  tryParseJsonLikeOutput,
} from "./teamAgent";
import {
  AgentActionVerificationError,
  attachResumableAgentState,
  getResumableAgentState,
  isAgentCancellationError,
  isRetryableAgentError,
} from "./agentErrors";
import { verifyWorkspaceWrite } from "./workspaceWriteVerification";
import {
  createArtifactDeliveryTool,
  createPlanProgressTool,
  type MutableTaskPlanRef,
} from "./agentRuntimeTools";
import {
  composeToolSet,
  createNewTurnModelInputSession,
  HISTORICAL_CONTEXT_MARKER_TEXT,
  loadHistoricalToolArgumentGuard,
  loadHistoricalToolResults,
  NEW_TURN_CONTEXT_PROMPT,
  projectNewTurnSessionHistory,
  renderAvailableToolsPrompt,
  stripHistoricalContextMarker,
  toolNameOf,
} from "./agentHistory";

export {
  buildModelAdapter,
  EmptyGatewayResponseError,
  GatewayGuardedModel,
  makeLoggingFetch,
  createPromptCacheFingerprint,
  formatPromptCacheFingerprint,
  sanitizeChatCompletionRequestBody,
  setAgentLogger,
  summarizeNonStreamChatCompletionResponse,
} from "./modelGateway";
export type {
  GatewayParallelToolCallsSupport,
  GatewayStructuredToolChoiceSupport,
} from "./modelGateway";
export {
  classifyDeliveryContract,
  classifyWorkflowDecision,
  isSimpleSingleTurnRequest,
  planTask,
} from "./taskPreparation";
export {
  planTeamTask,
  reviewTeamTask,
  routeTeamTask,
  verifyTeamTask,
} from "./teamAgent";
export {
  AgentActionVerificationError,
  getResumableAgentState,
  isRetryableAgentError,
} from "./agentErrors";
export { verifyWorkspaceWrite } from "./workspaceWriteVerification";
export {
  composeToolSet,
  createHistoricalToolArgumentGuard,
  createNewTurnModelInputSession,
  isToolHistoryItem,
  loadHistoricalToolArgumentGuard,
  markHistoricalMessageForModelInput,
  projectNewTurnSessionHistory,
  sanitizeAssistantMessageForPersistence,
  stripHistoricalContextMarker,
} from "./agentHistory";

export { inferRequiredTool } from "../policy/actionPolicy";
export type { RequiredAgentTool } from "../policy/actionPolicy";
export type { AgentConfig } from "./agentConfig";
export { commandToolResult };
export { validateConfig } from "./agentConfig";

// 超轮次异常透传给 UI 层做友好提示
export { MaxTurnsExceededError };

/** UI 关心的事件:正文增量 / 工具调用提示 / 工具执行结果 */
/**
 * 需要用户批准的工具被调用时,内核通过它向 UI 请求决定(宿主实现:发审批卡片,等点击)。
 */
export type ApprovalRequest = ProtocolApprovalRequest;

export type AgentRunStatus =
  | "completed"
  | "failed"
  | "awaiting_approval"
  | "cancelled"
  | "refused";

export interface AgentRunCheckpoint {
  state: string;
  approvals: ApprovalRequest[];
  output: string;
  usage: TurnUsage;
}

export interface AgentRunOptions {
  /** Resume a serialized SDK RunState instead of starting from userText. */
  initialState?: string;
  /**
   * Keep prior tool-call/result items when restarting the same task from a
   * durable boundary. New user turns omit those items by default.
   */
  preserveToolHistory?: boolean;
  /** Decisions keyed by ApprovalRequest.id, used when resuming a checkpoint. */
  decisions?: Record<string, boolean>;
  /** Cancels model streaming and cooperative tool execution. */
  signal?: AbortSignal;
  /** Called whenever a resumable state is available or changes. */
  onCheckpoint?: (checkpoint: AgentRunCheckpoint) => Promise<void> | void;
  /** Durable linear plan selected by the model before execution. */
  taskPlan?: TaskPlan;
  /** V3 serial Team contract. The executor still uses this same run/session. */
  teamTask?: TeamTask;
  /** Runtime delivery contract selected before execution. */
  deliveryContract?: DeliveryContract;
  /** Registered workflow selected before execution. */
  workflowId?: string;
  /** Registry used to resolve the selected workflow. */
  workflowRegistry?: WorkflowRegistry;
  /** Registry used to assemble core and plugin-provided tools. */
  toolRegistry?: ToolRegistry;
  /** Optional tool allowlist selected by workflow fallback routing. */
  allowedToolNames?: readonly string[];
  /**
   * Supplemental instruction supplied while resuming a paused run. It refines
   * presentation or execution preferences without replacing the original
   * task, workflow, or delivery contract.
   */
  resumeInstruction?: string;
  /** Persists validated step transitions outside the SDK session. */
  onPlanProgress?: (progress: TaskPlanProgress) => Promise<void> | void;
  /** Stable event envelope shared by the host, UI, tracing and future MCP tools. */
  protocol: {
    runId: string;
    operationId?: string;
    eventFactory?: AgentEventFactory;
    onEvent: (event: AgentProtocolEvent) => void;
  };
}

export interface AgentRunResult {
  /** Canonical result consumed by hosts, persistence and protocol adapters. */
  result: AgentResult<IndustrialAgentOutput>;
  /** Projection of result.output.message for the chat/session surface. */
  output: string;
  usage: TurnUsage;
  status: AgentRunStatus;
  state?: string;
  approvals?: ApprovalRequest[];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
function canonicalToolArguments(raw: string): string {
  try {
    return stableJson(JSON.parse(raw));
  } catch {
    return raw.trim();
  }
}
function duplicateApprovalKey(request: Pick<ApprovalRequest, "name" | "args">): string {
  return `${request.name}\u0000${canonicalToolArguments(request.args)}`;
}

const BASE_AGENT_PROMPT =
  "你是工控行业的 PLC 编程助手，精通 IEC 61131-3。" +
  "你必须只依据用户请求、上下文和真实工具回执工作，不得声称未完成的动作已经完成。" +
  "只能调用当前可用工具列表中的工具；不要调用未列出的工具名。" +
  "任何工具执行完成后，无论成功还是失败，都必须用一两句中文向用户确认执行结果，" +
  "不允许调用完工具不给结论就结束。回答要简洁，用中文。";

const GENERAL_WORKSPACE_PROMPT =
  "\n\n普通任务工具使用规则：" +
  "如果当前可用工具列表中包含 get_io_table，且你需要依据真实 I/O 表编写 PLC 程序，可以先调用它查询变量表；" +
  "如果用户明确允许模拟变量，或该工具不可用，不要为了查询 I/O 表阻塞。" +
  "生成或修改代码、配置或其他交付内容时，如果当前 workflow 或交付契约要求验证工具，必须先按其约束调用验证工具；" +
  "如有错误要根据工具诊断修正后重新验证，直到达到该 workflow 声明的成功条件。" +
  "warning 不阻断交付，但要在最终答复里说明。" +
  '用户要求生成代码时，默认把最终代码保存到当前工作区；只有用户明确说"不要保存/只展示/不要写文件"时才不落盘。' +
  "当前工作区落盘时，如果 write_file 或 edit_file 可用，必须调用合适的文件工具；不要只用文字声称已经写入。" +
  "需要查看目录、读文件、搜索代码或执行命令时，只能在对应工具出现在当前可用工具列表时调用。" +
  "当用户明确要求把内容写入工作区文件时，必须调用 write_file；当用户要求局部修改、替换或编辑已有文件时，优先调用 edit_file；" +
  "只有收到工具成功回执后，才能在最终结果中报告写入完成。";

const WORKFLOW_EXECUTION_PROMPT =
  "\n\n当前请求由运行时 workflow 接管。必须严格按照 workflow 阶段、交付契约和工具回执执行。" +
  "当前可用工具列表是唯一可调用工具集合；不要调用列表之外的工具，也不要用旧流程假设补工具。" +
  "如果缺少资料查询工具，基于用户请求、上下文和用户允许的模拟变量继续完成；确实无法继续时如实说明阻塞原因。";

const GENERIC_PLAN_SYSTEM_PROMPT =
  "你是通用任务执行助手，处理用户提出的文件、代码、命令、数据、PLC 或其他可用工具任务。" +
  "只在用户目标需要时调用相应工具，不要臆造额外领域步骤。" +
  "写文件、运行命令和设备写入必须经过现有审批、策略与审计约束；工具失败时如实处理。" +
  "最终答复必须基于真实工具回执和计划步骤结果，不得声称未完成的动作已经完成。";

// ---------- 模型构建(网关适配:chat_completions 协议) ----------

// Gateway construction, negotiation and diagnostics live in modelGateway.ts.

// ---------- 一轮对话:流式执行 + 会话持久化 + 审批中断/恢复 ----------

/** 本轮 token 用量(从模型响应的 usage 汇总;网关不返回 usage 字段时全为 0) */
/** Protocol usage alias shared by runtime and run store. */
export type TurnUsage = UsageSummary;

/** 单次用户消息允许的最大模型往返轮数,防止工具死循环烧额度 */
export const MAX_TURNS = 10;
const MAX_COMPLETION_GATE_RETRIES = 3;

export async function runAgent(
  cfg: AgentConfig,
  session: Session,
  userText: string,
  options: AgentRunOptions,
): Promise<AgentRunResult> {
  const actionPolicy = cfg.actionPolicy ?? new DefaultActionPolicy();
  const requiredTool = actionPolicy.requiredToolFor(userText);
  const workspace = workspaceScopeFromRoots(
    cfg.workspaceRoot,
    cfg.workspaceRoots,
  );
  const modelAdapter = buildModelAdapter(cfg);
  const model = modelAdapter.model;
  const promptCacheSettings = promptCacheModelSettings(cfg);
  if (cfg.promptCache?.enabled) {
    agentLog(
      promptCacheSettings
        ? `[prompt-cache] enabled ttl=${cfg.promptCache.ttl ?? "30m"} provider=${modelAdapter.provider} apiFormat=${modelAdapter.apiFormat}`
        : `[prompt-cache] enabled but skipped provider=${modelAdapter.provider} apiFormat=${modelAdapter.apiFormat}`,
    );
  }
  const workflowState = createWorkflowRuntimeState();
  const toolRegistry = options.toolRegistry ?? getDefaultToolRegistry();
  const registeredToolRisks = toolRegistry.riskMap();
  const registeredToolEvidence = toolRegistry.evidenceMap();
  const toolRisk = (name: string): ToolRisk =>
    name === "deliver_artifact" || name === "report_plan_progress"
      ? "plan"
      : registeredToolRisks[name] ?? "execute";
  const workflowDescriptor = getWorkflowDescriptor(
    options.workflowId,
    options.deliveryContract,
    options.workflowRegistry,
  );
  const workflowVisibilityContext = {
    userText,
    contract: options.deliveryContract,
    state: workflowState,
    toolCatalog: toolRegistry.getToolCatalog(),
  };
  const workflowRuntime = createWorkflowRuntime(
    options.workflowId,
    options.deliveryContract,
    workflowState,
    options.workflowRegistry,
    workflowVisibilityContext,
  );
  const isolateHistoricalToolChain =
    !options.initialState && !options.preserveToolHistory;
  const historicalToolArgumentGuard = isolateHistoricalToolChain
    ? await loadHistoricalToolArgumentGuard(session, userText)
    : undefined;
  const workflowBusinessToolPolicy = workflowRuntime || workflowDescriptor
    ? resolveWorkflowBusinessToolPolicy(
        [workflowRuntime, workflowDescriptor],
        workflowVisibilityContext,
      )
    : undefined;
  let workflowCompleted = false;
  let workflowCompletionLogged = false;
  const workflowToolNames =
    workflowBusinessToolPolicy?.mode === "allow_list"
      ? new Set(workflowBusinessToolPolicy.names ?? [])
      : undefined;
  const completedWorkflowToolRejection = (toolName: string): string | undefined => {
    if (!workflowRuntime || !workflowCompleted) return undefined;
    if (workflowToolNames && !workflowToolNames.has(toolName)) {
      return undefined;
    }
    return `运行时工作流“${workflowRuntime.title}”已经完成，禁止再次调用 ${toolName} 以避免重复副作用；请直接基于已完成的工具回执给出最终总结。`;
  };
  let historicalArgumentRejectionLogged = false;
  const runtimeToolGuard: RuntimeToolCallGuard | undefined =
    workflowRuntime || historicalToolArgumentGuard
      ? (toolName, input) => {
          const historicalReason = historicalToolArgumentGuard?.(toolName, input);
          if (historicalReason) {
            if (!historicalArgumentRejectionLogged) {
              historicalArgumentRejectionLogged = true;
              agentLog(`[context] ${historicalReason}`);
            }
            return historicalReason;
          }
          return completedWorkflowToolRejection(toolName);
        }
      : undefined;
  const pipelineStageRuntime = new PipelineStageRuntime(workflowRuntime?.pipelinePlan);
  // Keep the existing structured contract for Responses and Anthropic.
  // Plain OpenAI Chat Completions conversations can stream text directly.
  const textStreamingMode =
    modelAdapter.provider === "openai" &&
    modelAdapter.apiFormat === "chat_completions" &&
    cfg.orchestration !== "team" &&
    options.teamTask === undefined &&
    options.taskPlan === undefined &&
    options.deliveryContract?.requiresDeliverable !== true &&
    requiredTool === undefined;
  const structuredMode = !textStreamingMode;
  const requiresInlineFinalArtifact =
    options.deliveryContract?.requiresDeliverable === true &&
    options.deliveryContract.deliverables.some(
      (deliverable) =>
        deliverable.required &&
        deliverable.acceptableEvidence.length > 0 &&
        deliverable.acceptableEvidence.every(
          (evidence) => evidence === "final_artifact",
        ),
    );
  // Delivery-contract turns need runtime repair authority. Some compatible
  // gateways redact malformed final output and throw before CompletionGate can
  // force validation/write tools, so those turns parse final text locally.
  // Ordinary action turns keep the old SDK-level structured response format.
  const sdkStructuredOutputType: AgentOutputType | undefined =
    options.deliveryContract?.requiresDeliverable === true
      ? undefined
      : industrialAgentOutputDefinition.schema;
  if (model instanceof GatewayGuardedModel) model.resetEmptyStreak(); // 熔断计数每轮用户消息重新计
  let activePlan = options.taskPlan ? structuredClone(options.taskPlan) : undefined;
  const activePlanRef: MutableTaskPlanRef = {
    get value() {
      return activePlan;
    },
    set value(value) {
      activePlan = value;
    },
  };
  const planProgressTool = createPlanProgressTool(
    activePlanRef,
    options.onPlanProgress,
  );
  const artifactDeliveryTool = createArtifactDeliveryTool(
    requiresInlineFinalArtifact,
  );
  const toolEvidence: Record<string, readonly DeliveryEvidence[]> = {
    ...registeredToolEvidence,
    ...(artifactDeliveryTool
      ? { deliver_artifact: ["final_artifact"] }
      : {}),
  };
  const reportDiagnostics: DiagnosticSideReporter = (report) => {
    if (!options.protocol.eventFactory) return;
    options.protocol.onEvent(
      options.protocol.eventFactory.next({
        type: "run.progress",
        payload: {
          stage: "diagnostics.report",
          message: report.summary,
          report,
        },
      }),
    );
  };
  const registeredTools = toolRegistry.createTools({
    cfg,
    userText,
    workflowContract: options.deliveryContract,
    workflow: workflowRuntime,
    diagnosticReporter: reportDiagnostics,
    runtimeToolGuard,
  }).filter((item) => {
    if (!workflowBusinessToolPolicy || workflowBusinessToolPolicy.mode === "allow_all") {
      return true;
    }
    if (workflowBusinessToolPolicy.mode === "deny_all") {
      return false;
    }
    const name = toolNameOf(item);
    return typeof name === "string" &&
      workflowBusinessToolPolicy.names?.includes(name) === true;
  });
  const allowedBusinessToolNames = workflowBusinessToolPolicy
    ? workflowBusinessToolPolicy.mode === "allow_list"
      ? workflowBusinessToolPolicy.names ?? []
      : workflowBusinessToolPolicy.mode === "deny_all"
        ? []
        : undefined
    : options.allowedToolNames;
  const tools = toolRegistry.orderTools(
    composeToolSet(
      registeredTools,
      [
        ...(planProgressTool ? [planProgressTool] : []),
        ...(artifactDeliveryTool ? [artifactDeliveryTool] : []),
      ],
      allowedBusinessToolNames,
    ),
  );
  const availableToolNameList = tools
    .map(toolNameOf)
    .filter((name): name is string => typeof name === "string");
  const availableToolNames = new Set(availableToolNameList);
  const availableToolsPrompt = renderAvailableToolsPrompt(
    availableToolNameList,
    toolRegistry.getToolCatalog(),
  );
  const executionInstructions = (
    activePlan
      ? BASE_AGENT_PROMPT +
        availableToolsPrompt +
        "\n\n" +
        GENERIC_PLAN_SYSTEM_PROMPT +
        "\n\n当前请求使用通用线性计划，不要把它强行改写成某一种领域场景；以计划目标和用户原始要求为准。" +
        "你正在执行一个已经批准的通用线性计划。必须严格按步骤顺序工作。" +
        "开始每一步前调用 report_plan_progress(stepId, started)。完成前必须检查本步骤的完成标准与真实工具回执或已确认输入是否一致，再调用 report_plan_progress(stepId, completed, verification)。" +
        "verification.evidence 必须具体说明观察到的证据；证据不足、工具失败或结果不符合标准时，填写 verdict=retry（继续修正）或 revise（换一种完成当前步骤的办法），并提供 issue 与 nextAction。" +
        "只有 verdict=passed 会推进步骤；收到未通过的工具回执后必须继续处理当前步骤，不能跳到下一步或给最终答复。" +
        "前一步未完成时不得开始后一步；所有步骤完成前不得给出最终答复。计划如下：\n" +
        renderTaskPlan(activePlan)
      : options.teamTask
        ? BASE_AGENT_PROMPT +
          availableToolsPrompt +
          "\n\n" +
          GENERIC_PLAN_SYSTEM_PROMPT +
          "\n\n你是 Team 的 executor。只能在下列已审查计划范围内执行；仍必须遵守工具审批、工作区限制和真实工具回执。" +
          "不要自行扩大目标或跳过验证条件。\n已审查计划：" + options.teamTask.planSummary +
          "\n完成标准：" + (options.teamTask.verificationCriteria.join("；") || "结果满足用户请求且可由真实证据验证")
        : workflowRuntime
          ? BASE_AGENT_PROMPT + availableToolsPrompt + WORKFLOW_EXECUTION_PROMPT
          : BASE_AGENT_PROMPT + availableToolsPrompt + GENERAL_WORKSPACE_PROMPT
  ) + (isolateHistoricalToolChain
    ? NEW_TURN_CONTEXT_PROMPT
    : "\n\n当前是同一任务的恢复执行。可以参考并继续使用该任务已有的工具回执，但不要引入无关任务的工具调用。");
  const deliveryInstructions = options.deliveryContract?.requiresDeliverable
    ? "\n\n本轮存在运行时交付契约。你最终必须提供可验证交付证据,否则系统不会允许结束。\n" +
      renderDeliveryContract(options.deliveryContract) +
      "\n如果直接在聊天中交付代码、文档、报告、数据或文本,必须同时把完整交付内容放入最终输出 artifacts[].content；message 只做摘要或也可展示同一内容。" +
      "如果通过工具交付,必须等待对应工具成功回执。不能只承诺将要生成、将要写入或稍后继续。" +
      (workflowRuntime
        ? workflowRuntime.instructions()
        : "\n契约要求工作区落盘时，必须调用 write_file 写入当前工作区；只有 write_file 成功并完成回读校验后才能声称已保存。") +
      "契约列出的验证工具必须实际调用并依据成功回执完成；不要用文字描述代替工具调用。" +
      (requiresInlineFinalArtifact
        ? "\n本轮至少有一个交付物只能用 final_artifact 验收。优先调用 deliver_artifact 提交完整内容；也可以同时把内容放入最终 JSON 的 artifacts 数组。无论采用哪种方式，交付内容必须完整，不能只放摘要、计划或口头承诺。"
        : "")
    : "";
  const workflowInstructions =
    workflowRuntime && !options.deliveryContract?.requiresDeliverable
      ? "\n\n当前 workflow 运行约束：" + workflowRuntime.instructions()
      : "";
  let runtimeCompletionRepairInstruction = "";
  let runtimeActionReminderInstruction = "";
  const buildAgent = (forcedTool?: string) => {
    const availableForcedTool =
      forcedTool && availableToolNames.has(forcedTool) ? forcedTool : undefined;
    const modelSettings = {
      parallelToolCalls: workflowRuntime?.parallelToolCalls ?? true,
      ...(officialResponsesCompactionSettings(cfg) ?? {}),
      ...(promptCacheSettings ?? {}),
      ...(availableForcedTool && !(model instanceof GatewayGuardedModel)
        ? { toolChoice: availableForcedTool }
        : {}),
    };
    const runtimeInstructions = [
      options.resumeInstruction?.trim()
        ? "本轮是从暂停断点继续。以下是用户对同一任务的补充指令，" +
          "只能作为表达方式、约束或执行偏好的增量；不得用它替换原始用户目标、workflow 或交付契约：\n" +
          options.resumeInstruction.trim()
        : "",
      runtimeCompletionRepairInstruction
        ? "运行时完成验收未通过。你必须继续处理,不能直接结束:\n" +
          runtimeCompletionRepairInstruction
        : "",
      runtimeActionReminderInstruction
        ? "运行时动作提醒：上一轮模型没有执行用户明确要求的动作。" +
          "请根据当前用户请求和当前可用工具实际完成动作；如果确实无法执行，说明具体原因。" +
          "\n" +
          runtimeActionReminderInstruction
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const instructions =
      executionInstructions +
      deliveryInstructions +
      workflowInstructions +
      (runtimeInstructions ? `\n\n${runtimeInstructions}` : "");
    // The legacy native handoff team remains available for direct callers.
    // Coordinated V3 runs always provide teamTask and use this controlled
    // executor, so their durable graph remains the source of truth.
    if (cfg.orchestration === "team" && !options.teamTask) {
      const team = createIndustrialAgentTeam(model, tools, {
        executorStructuredOutput: true,
        executorModelSettings: modelSettings,
      });
      // Explicit side effects bypass planning and enter the controlled executor.
      return requiredTool ? team.executor : team.planner;
    }
    return new Agent({
      name: "PLC 编程助手",
      model,
      instructions,
      tools,
      modelSettings,
      ...(structuredMode && sdkStructuredOutputType
        ? { outputType: sdkStructuredOutputType }
        : {}),
    });
  };
  const initialWorkflowTool = workflowRuntime?.initialTool({
    isResume: Boolean(options.initialState),
  });
  const availableInitialWorkflowTool =
    initialWorkflowTool && availableToolNames.has(initialWorkflowTool)
      ? initialWorkflowTool
      : undefined;
  if (initialWorkflowTool && !availableInitialWorkflowTool) {
    agentLog(
      `[workflow] 跳过不可用的初始强制工具: ${initialWorkflowTool}`,
    );
  }
  if (availableInitialWorkflowTool && model instanceof GatewayGuardedModel) {
    model.requireToolOnce(availableInitialWorkflowTool);
  }
  let agent = buildAgent(availableInitialWorkflowTool);

  const tracingDisabled = !(
    modelAdapter.provider === "openai" &&
    modelAdapter.apiFormat === "responses" &&
    !cfg.baseUrl.trim()
  );
  const runner = new Runner({
    tracingDisabled,
    toolExecution: { maxFunctionToolConcurrency: null },
    // A model can occasionally replay a stale tool call from an older turn.
    // Let the SDK return a model-visible error so the current turn can recover
    // instead of failing the whole run before valid calls are processed.
    toolNotFoundBehavior: "return_error_to_model",
    toolErrorFormatter: ({ kind, toolName, defaultMessage }) => {
      if (kind !== "tool_not_found") return defaultMessage;
      const available = availableToolNameList.join("、") || "无";
      return `${defaultMessage} 当前本轮可用工具仅限：${available}。请忽略历史工具调用，只处理当前用户请求。`;
    },
  });
  let newTurnHistoryProjectionUsed = false;
  const runnerSession = isolateHistoricalToolChain
    ? createNewTurnModelInputSession(session)
    : session;
  const sessionInputCallback: SessionInputCallback | undefined =
    !isolateHistoricalToolChain
    ? undefined
    : async (historyItems, newItems) => {
        if (newTurnHistoryProjectionUsed) {
          return [...historyItems, ...newItems];
        }
        newTurnHistoryProjectionUsed = true;
        const projected = projectNewTurnSessionHistory(historyItems, newItems);
        const removed = historyItems.length + newItems.length - projected.length;
        if (removed > 0) {
          agentLog(`[context] 新请求隔离旧工具链: 移除模型输入条目 ${removed} 个`);
        }
        return projected;
      };
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  let output = "";
  let structuredOutput: IndustrialAgentOutput | undefined;
  let finalizerRequired = false;
  let terminalFailureOutput: IndustrialAgentOutput | undefined;
  let rawStreamText = "";
  let visibleStreamText = "";

  const sanitizeStreamDelta = (text: string): string => {
    rawStreamText += text;
    const sanitized = stripHistoricalContextMarker(rawStreamText);
    let holdLength = 0;
    for (
      let length = Math.min(HISTORICAL_CONTEXT_MARKER_TEXT.length, sanitized.length);
      length > 0;
      length -= 1
    ) {
      if (
        sanitized.endsWith(HISTORICAL_CONTEXT_MARKER_TEXT.slice(0, length)) &&
        !rawStreamText.endsWith(HISTORICAL_CONTEXT_MARKER_TEXT)
      ) {
        holdLength = length;
        break;
      }
    }
    const ready = sanitized.slice(0, sanitized.length - holdLength);
    const delta = ready.startsWith(visibleStreamText)
      ? ready.slice(visibleStreamText.length)
      : ready;
    visibleStreamText = ready;
    return delta;
  };

  const sanitizeAssistantOutput = (
    value: IndustrialAgentOutput,
  ): IndustrialAgentOutput => ({
    ...value,
    message: stripHistoricalContextMarker(value.message),
  });

  // callId → 工具名:tool_call_output_item 在 chat_completions 转换下不一定带 name,靠调用时的映射回填
  const toolNameByCallId = new Map<string, string>();
  const toolCalls = new Map<string, { name: string; args: string; order: number }>();
  const toolResults = new Map<
    string,
    { name: string; args: string; result: ToolResult; order: number }
  >();
  let toolCallOrder = 0;

  const recordToolCall = (
    name: string,
    callId: string | undefined,
    args: string,
  ): void => {
    const key = callId || `${name}:${toolCalls.size}`;
    toolCalls.set(key, { name, args, order: ++toolCallOrder });
  };

  const syntheticToolFailureResult = (
    name: string,
    args: string,
    payload: Record<string, unknown>,
  ): ToolResult | undefined => {
    if (payload.ok !== false || payload.result !== undefined) return undefined;
    const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
    const details = payload.details;
    const detailText = typeof details === "string" ? details.trim() : "";
    const error = summary || detailText || "工具执行失败";
    let parsedArguments: unknown;
    try {
      parsedArguments = args ? JSON.parse(args) : undefined;
    } catch {
      parsedArguments = undefined;
    }
    const invalidInput = /(?:InvalidToolInputError|Invalid JSON input for tool|Invalid input for tool)/i.test(error);
    return createToolResult({
      ok: false,
      data: {
        rawArguments: args || null,
        parsedArguments: parsedArguments ?? null,
        argumentsWereJson: parsedArguments !== undefined,
        source: "sdk_tool_completed",
      },
      error,
      diagnostics: [
        {
          code: invalidInput ? "invalid_tool_input" : "tool_failed",
          message: invalidInput
            ? `${name} 工具参数格式错误，工具实现未执行：${error}`
            : error,
          severity: "error",
          details: {
            rawArguments: args || null,
            parsedArguments: parsedArguments ?? null,
          },
        },
      ],
      effect: "none",
      risk: toolRisk(name),
      metadata: {
        synthetic: true,
        source: "sdk_tool_completed",
      },
    });
  };

  const recordToolResult = (
    name: string,
    callId: string | undefined,
    result: ToolResult | undefined,
  ): void => {
    if (!result) return;
    const key =
      callId && toolCalls.has(callId)
        ? callId
        : [...toolCalls.keys()]
            .reverse()
            .find(
              (candidate) =>
                !toolResults.has(candidate) &&
                (name === "tool" || toolCalls.get(candidate)?.name === name),
            );
    const call = key ? toolCalls.get(key) : undefined;
    if (key && call)
      toolResults.set(key, {
        ...call,
        name: name === "tool" ? call.name : name,
        result,
      });
  };

  const forceNextWorkflowToolAfterResult = (
    name: string,
    result: ToolResult | undefined,
  ): void => {
    if (workflowCompleted) return;
    const decision = pipelineStageRuntime.nextToolAfterResult(
      name,
      result,
      availableToolNames,
    );
    if (!decision || !(model instanceof GatewayGuardedModel)) return;
    model.requireToolOnce(decision.toolName);
    agentLog(`[workflow] ${decision.reason}`);
  };

  const observeProtocolEvent = (event: AgentProtocolEvent): void => {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === "text.delta") {
      if (typeof payload.text === "string") output += payload.text;
      return;
    }
    if (event.type === "tool.started") {
      const name =
        typeof payload.toolName === "string" ? payload.toolName : "tool";
      const callId =
        typeof payload.callId === "string" ? payload.callId : undefined;
      const args =
        typeof payload.arguments === "string" ? payload.arguments : "";
      if (callId) toolNameByCallId.set(callId, name);
      recordToolCall(name, callId, args);
      return;
    }
    if (event.type === "tool.completed") {
      const callId =
        typeof payload.callId === "string" ? payload.callId : undefined;
      const name =
        typeof payload.toolName === "string"
          ? payload.toolName
          : (toolNameByCallId.get(callId ?? "") ?? "tool");
      const key =
        callId && toolCalls.has(callId)
          ? callId
          : [...toolCalls.keys()]
              .reverse()
              .find(
                (candidate) =>
                  !toolResults.has(candidate) &&
                  (name === "tool" || toolCalls.get(candidate)?.name === name),
              );
      const call = key ? toolCalls.get(key) : undefined;
      const result = payload.result as ToolResult | undefined;
      const recordedResult =
        result ?? syntheticToolFailureResult(name, call?.args ?? "", payload);
      recordToolResult(name, callId, recordedResult);
      refreshWorkflowCompletion();
      forceNextWorkflowToolAfterResult(name, recordedResult);
    }
  };

  const verifyRequiredActions = async (): Promise<Artifact[]> => {
    const verificationTool = workflowRuntime?.requiredActionTool ?? requiredTool;
    if (!verificationTool) return [];
    const verified: Artifact[] = [];
    const calls = [...toolResults.values()].filter(
      (call) => call.name === verificationTool,
    );
    for (const call of calls) {
      if (!call.result.ok) continue;
      if (workflowRuntime) {
        const artifact = workflowRuntime.completionAdapter?.collectActionArtifact?.(call);
        if (artifact) verified.push(artifact);
        continue;
      }
      if (verificationTool !== "write_file") continue;
      let args: { path?: unknown; content?: unknown };
      try {
        args = JSON.parse(call.args) as { path?: unknown; content?: unknown };
      } catch {
        continue;
      }
      if (typeof args.path !== "string" || typeof args.content !== "string")
        continue;
      verified.push(await verifyWorkspaceWrite(workspace, args.path, args.content));
    }
    const successful = calls.some((call) => call.result.ok);
    if (!calls.length) {
      // ActionPolicy is a soft hint for ordinary turns. A missing hint call
      // must not turn a status question or a model choice into a hard error.
      // Workflow contracts keep their own strict evidence path below.
      if (!workflowRuntime) return [];
      throw new AgentActionVerificationError(
        `用户明确要求执行 ${verificationTool}，但本轮没有调用该工具`,
      );
    }
    if (!successful) return verified;
    if (verificationTool === "write_file" && !verified.length) {
      throw new AgentActionVerificationError(
        workflowRuntime
          ? "工具 write_file 返回成功，但当前 workflow 要求的写入证据未通过校验"
          : "工具 write_file 返回成功，但本轮没有完成文件回读校验",
      );
    }
    return verified;
  };

  const deliveredArtifactsFromTools = (): Artifact[] => {
    const artifacts: Artifact[] = [];
    for (const call of toolResults.values()) {
      if (call.name !== "deliver_artifact" || !call.result.ok) continue;
      const data =
        call.result.data && typeof call.result.data === "object"
          ? call.result.data as Record<string, unknown>
          : {};
      const value =
        data.artifact && typeof data.artifact === "object"
          ? data.artifact as Record<string, unknown>
          : data;
      const kind = value.kind;
      const name = value.name;
      const content = value.content;
      const uri = value.uri;
      if (
        kind !== "file" &&
        kind !== "code" &&
        kind !== "report" &&
        kind !== "data" &&
        kind !== "unknown"
      ) {
        continue;
      }
      if (typeof name !== "string" || !name.trim()) continue;
      const hasContent = typeof content === "string" && content.trim().length > 0;
      const hasUri = typeof uri === "string" && uri.trim().length > 0;
      if (!hasContent && !hasUri) continue;
      artifacts.push({
        kind,
        name: name.trim(),
        ...(hasUri ? { uri: (uri as string).trim() } : {}),
        ...(typeof value.mimeType === "string" && value.mimeType.trim()
          ? { mimeType: value.mimeType.trim() }
          : {}),
        ...(hasContent ? { content: content as string } : {}),
      });
    }
    return artifacts;
  };

  const fallbackRequiredToolMessage = (): string | undefined => {
    if (!requiredTool) return undefined;
    const call = [...toolResults.values()]
      .reverse()
      .find((item) => item.name === requiredTool);
    if (!call) return undefined;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.args) as Record<string, unknown>;
    } catch {
      args = {};
    }
    if (!call.result.ok) {
      const errorText = typeof call.result.error === "string"
        ? call.result.error.trim()
        : "";
      const diagnostics = Array.isArray(call.result.diagnostics)
        ? call.result.diagnostics
        : [];
      const diagnosticMessage = diagnostics.find((item): item is { message: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { message?: unknown }).message === "string" &&
        Boolean((item as { message: string }).message.trim()),
      )?.message.trim();
      const error = errorText
        || diagnosticMessage
        || "工具执行失败";
      if (requiredTool === "read_file") {
        const pathValue = typeof args.path === "string" ? args.path : "目标文件";
        return `读取 ${pathValue} 失败：${error}`;
      }
      if (requiredTool === "write_file" || requiredTool === "edit_file") {
        const pathValue = typeof args.path === "string" ? args.path : "目标文件";
        return `${requiredTool === "edit_file" ? "修改" : "写入"} ${pathValue} 失败：${error}`;
      }
      if (requiredTool === "run_command") {
        const data = call.result.data && typeof call.result.data === "object"
          ? call.result.data as Record<string, unknown>
          : {};
        const commandOutput = typeof data.output === "string" && data.output.trim()
          ? `\n${data.output.trim().slice(0, 1_000)}`
          : "";
        return `命令执行失败：${error}${commandOutput}`;
      }
      return `${requiredTool} 执行失败：${error}`;
    }
    const data = call.result.data && typeof call.result.data === "object"
      ? call.result.data as Record<string, unknown>
      : {};
    const toolSummary =
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim()
        : typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : undefined;
    if (toolSummary) return toolSummary;
    if (requiredTool === "read_file") {
      const pathValue = typeof args.path === "string" ? args.path : "目标文件";
      const totalLines = typeof data.totalLines === "number" ? ` · ${data.totalLines} 行` : "";
      const content = typeof data.content === "string" ? data.content : "";
      if (content && content.length <= 2_000) {
        return `已读取 ${pathValue}${totalLines}，内容如下：\n${content}`;
      }
      return `已读取 ${pathValue}${totalLines}${content ? "，内容较长，请查看上方工具执行详情。" : "。"}`;
    }
    if (requiredTool === "write_file" || requiredTool === "edit_file") {
      const file = typeof data.file === "string"
        ? data.file
        : typeof args.path === "string" ? args.path : "目标文件";
      if (requiredTool === "edit_file") {
        const changed = data.changed === true ? "已修改" : "内容无变化";
        return `${changed} ${file}${typeof data.editsApplied === "number" ? ` · ${data.editsApplied} 处编辑` : ""}，具体 diff 请查看上方工具结果。`;
      }
      const bytes = typeof data.bytes === "number" ? ` · ${data.bytes} 字节` : "";
      return `已写入 ${file}${bytes}。`;
    }
    if (requiredTool === "run_command") {
      const exitCode = typeof data.exitCode === "number" || data.exitCode === null
        ? `退出码 ${data.exitCode}`
        : "命令已执行";
      const commandOutput = typeof data.output === "string" && data.output.trim()
        ? `，输出：${data.output.trim().slice(0, 1_000)}`
        : "";
      return `${exitCode}${commandOutput}`;
    }
    const file = typeof data.file === "string" ? data.file : undefined;
    return file
      ? `${requiredTool} 已完成：${file}。`
      : `${requiredTool} 已执行成功。`;
  };

  const isInternalToolArtifactComplaint = (message: string): boolean => {
    const text = message.trim();
    if (!text) return false;
    return /Tool call ["'][^"']+["'].*no available artifacts/is.test(text) ||
      /tool returned an empty dict or a non-dict value/is.test(text) ||
      /unexpected response format.*tool implementation/is.test(text);
  };

  const hasAttemptedRequiredAction = (): boolean => {
    if (!requiredTool) return true;
    return [...toolResults.values()].some((call) => call.name === requiredTool);
  };

  const assertPlanCompleted = (): void => {
    if (activePlan && activePlan.status !== "completed") {
      const pending = activePlan.steps.find((step) => step.status !== "completed");
      throw new AgentActionVerificationError(
        `线性计划尚未完成${pending ? `: ${pending.id} ${pending.title}` : ""}`,
      );
    }
  };

  let completionGateRetries = 0;
  const runCompletionGate = (
    finalMessage: string,
    artifacts: Artifact[] = [],
  ): CompletionGateResult =>
    evaluateCompletionGate({
      userText,
      finalMessage,
      requiredTool,
       toolResults: [
         ...historicalToolResults,
         ...toolResults.values(),
       ],
      artifacts: [...artifacts, ...deliveredArtifactsFromTools()],
      deliveryContract: options.deliveryContract,
      workflowAdapter: workflowRuntime?.completionAdapter,
      toolEvidence,
    });

  const workflowToolRecords = () => [
    ...historicalToolResults,
    ...toolResults.values(),
  ];

  const deliveredWorkflowArtifacts = (): Artifact[] => {
    if (!workflowRuntime) return [];
    const artifacts: Artifact[] = [];
    for (const call of workflowToolRecords()) {
      if (!call.result.ok) continue;
      const artifact = workflowRuntime.completionAdapter?.collectActionArtifact?.(call);
      if (artifact) artifacts.push(artifact);
    }
    return artifacts;
  };

  const refreshWorkflowCompletion = (): void => {
    if (!workflowRuntime || workflowCompleted) return;
    if (!deliveredWorkflowArtifacts().length) return;
    workflowCompleted = true;
    if (!workflowCompletionLogged) {
      workflowCompletionLogged = true;
      agentLog(
        `[workflow] ${workflowRuntime.title} 已完成，后续 workflow 工具调用将被阻止以避免重复执行`,
      );
    }
  };

  const decisionService = cfg.decisionService ?? new AgentDecisionService(agentLog);
  const reviewCompletionGateDecision = async (
    finalMessage: string,
    artifacts: Artifact[],
    gate: CompletionGateResult,
  ): Promise<void> => {
    if (gate.passed && options.deliveryContract?.requiresDeliverable !== true) return;
    try {
      const records = workflowToolRecords();
      const evidence = buildCompletionEvidenceSummaries({
        records,
        gate,
        artifacts,
        deliveredArtifacts: deliveredArtifactsFromTools(),
        deliveryContract: options.deliveryContract,
        workflow: workflowRuntime,
        authoritativeMessage: authoritativeWorkflowMessage(),
        extractors: workflowRuntime?.evidenceExtractors,
      });
      await decisionService.completionGateHint(
        cfg.jev,
        {
          userText: compactCompletionDecisionText(userText, 1_200),
          finalMessage: compactCompletionDecisionText(finalMessage, 1_200),
          rulePassed: gate.passed,
          deliveryRequired: options.deliveryContract?.requiresDeliverable === true,
          issueSummaries: gate.passed
            ? []
            : gate.issues.slice(0, 6).map((issue) =>
                compactCompletionDecisionText(`${issue.toolName}: ${issue.summary}`, 500),
              ),
          toolSummaries: evidence.toolSummaries,
          artifactSummaries: evidence.artifactSummaries,
        },
        options.signal,
      );
      if (!gate.passed) {
        await decisionService.diagnosticRecoveryHint(
          cfg.jev,
          {
            userText: compactCompletionDecisionText(userText, 1_200),
            failureReason: compactCompletionDecisionText(gate.reason, 1_200),
            issues: gate.issues.slice(0, 8).map((issue) =>
              compactCompletionDecisionText(
                `${issue.toolName}(${issue.targetKey}) risk=${issue.risk} effect=${issue.effect}: ${issue.summary}`,
                700,
              ),
            ),
            repairInstruction: compactCompletionDecisionText(gate.repairInstruction, 1_500),
          },
          options.signal,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      agentLog(`[jev] advisory skipped: ${message}`);
    }
  };

  const authoritativeWorkflowMessage = (): string | undefined =>
    workflowRuntime?.completionAdapter?.finalMessage?.(workflowToolRecords());

  const fallbackDeliveryMessage = (): string | undefined => {
    const authoritative = authoritativeWorkflowMessage();
    if (authoritative) return authoritative;
    const records = [
      ...historicalToolResults,
      ...toolResults.values(),
    ].filter((record) => record.result.ok).reverse();
    const write = records.find((record) => record.name === "write_file");
    if (write) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(write.args) as Record<string, unknown>;
      } catch {
        args = {};
      }
      const data = write.result.data && typeof write.result.data === "object"
        ? write.result.data as Record<string, unknown>
        : {};
      const file = typeof data.file === "string"
        ? data.file
        : typeof args.path === "string" ? args.path : "目标文件";
      const bytes = typeof data.bytes === "number" ? ` · ${data.bytes} 字节` : "";
      return `已写入 ${file}${bytes}。`;
    }
    const artifact = deliveredArtifactsFromTools()[0];
    if (artifact) return `已生成 ${artifact.name}。`;
    if (options.deliveryContract?.requiresDeliverable === true) {
      return "已完成本轮交付。";
    }
    return undefined;
  };

  const isInvalidStructuredOutputText = (value: string): boolean => {
    const trimmed = stripHistoricalContextMarker(value).trim();
    if (!trimmed) return false;
    const candidate = tryParseJsonLikeOutput(trimmed);
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      !Array.isArray(candidate)
    ) {
      return true;
    }
    return /^\s*(?:```(?:json)?\s*)?\{[\s\S]*\}(?:\s*```)?\s*$/i.test(trimmed);
  };

  const synthesizeStructuredOutputFromEvidence = (): IndustrialAgentOutput | undefined => {
    const rawOutput = output.trim();
    const usableModelMessage = rawOutput &&
      !isInvalidStructuredOutputText(rawOutput)
      ? rawOutput
      : undefined;
    const message = authoritativeWorkflowMessage() ||
      usableModelMessage ||
      fallbackRequiredToolMessage() ||
      fallbackDeliveryMessage();
    if (!message) return undefined;
    const gate = runCompletionGate(message);
    if (!gate.passed) return undefined;
    return {
      message,
      diagnostics: [],
      artifacts: [],
      data: null,
    };
  };

  const toProtocolArtifacts = (
    artifacts: readonly IndustrialAgentOutput["artifacts"][number][],
  ): Artifact[] => artifacts.map((artifact) => ({
    kind: artifact.kind,
    name: artifact.name,
    ...(artifact.uri === null ? {} : { uri: artifact.uri }),
    ...(artifact.mimeType === null ? {} : { mimeType: artifact.mimeType }),
    ...(artifact.content === null ? {} : { content: artifact.content }),
  }));

  const synthesizeStructuredFailureFromEvidence = (
    gate?: CompletionGateResult,
  ): IndustrialAgentOutput =>
    synthesizeStructuredFailure({
      gate,
      records: workflowToolRecords(),
      artifacts: toProtocolArtifacts(structuredOutput?.artifacts ?? []),
      deliveredArtifacts: deliveredArtifactsFromTools(),
    });

  const finalizeStructuredOutputFromRuntime = async (): Promise<IndustrialAgentOutput | undefined> => {
    const protocolArtifacts = toProtocolArtifacts(structuredOutput?.artifacts ?? []);
    const gate = runCompletionGate(output, protocolArtifacts);
      const evidence = buildCompletionEvidenceSummaries({
      records: workflowToolRecords(),
      gate,
      artifacts: protocolArtifacts,
      deliveredArtifacts: deliveredArtifactsFromTools(),
      deliveryContract: options.deliveryContract,
      workflow: workflowRuntime,
      authoritativeMessage: authoritativeWorkflowMessage(),
      extractors: workflowRuntime?.evidenceExtractors,
    });
    const finalized = await runFinalOutputFinalizer({
      model,
      tracingDisabled,
      userText,
      currentMessage: output,
      gate,
      records: workflowToolRecords(),
      evidence,
      artifacts: protocolArtifacts,
      deliveredArtifacts: deliveredArtifactsFromTools(),
      signal: options.signal,
      log: agentLog,
    });
    if (finalized.usage) {
      usage.inputTokens += finalized.usage.inputTokens;
      usage.outputTokens += finalized.usage.outputTokens;
      usage.requests += finalized.usage.requests;
    }
    return finalized.output;
  };

  const failedAgentRunResult = (
    failure: IndustrialAgentOutput,
  ): AgentRunResult => {
    const projected = projectAgentOutput(
      industrialAgentOutputDefinition,
      failure,
    );
    const error = failure.message.trim() || "本轮未完成";
    const result = createAgentResult({
      status: "failed",
      error,
      output: failure,
      usage,
      diagnostics: projected.diagnostics,
      artifacts: projected.artifacts,
    });
    return { result, output: failure.message, usage, status: "failed" };
  };

  const chooseCompletionRepairTool = (
    gate: Exclude<CompletionGateResult, { passed: true }>,
  ): string | undefined => {
    refreshWorkflowCompletion();
    if (workflowCompleted) return undefined;
    const workflowRepairTool = workflowRuntime?.completionAdapter?.selectRepairTool?.(
      gate,
      workflowToolRecords(),
      availableToolNames,
    );
    if (workflowRepairTool) return workflowRepairTool;

    // Contract-named verification tools are the first repair dependency.
    const verificationIssue = gate.issues.find(
      (issue) => issue.toolName === "delivery_verification",
    );
    if (verificationIssue) {
      try {
        const parsed = JSON.parse(verificationIssue.args) as {
          tool?: unknown;
        };
        if (
          typeof parsed.tool === "string" &&
          availableToolNames.has(parsed.tool)
        ) {
          return parsed.tool;
        }
      } catch {
        // Continue with the contract evidence fallback below.
      }
    }

    const deliveryIssue = gate.issues.find(
      (issue) => issue.toolName === "delivery_contract",
    );
    if (deliveryIssue) {
      try {
        const deliverable = JSON.parse(deliveryIssue.args) as {
          acceptableEvidence?: unknown;
          workspacePersistence?: unknown;
        };
        const evidence = Array.isArray(deliverable.acceptableEvidence)
          ? deliverable.acceptableEvidence.filter(
              (value): value is DeliveryEvidence =>
                value === "final_artifact" ||
                value === "successful_tool" ||
                value === "successful_write" ||
                value === "successful_export",
            )
          : [];
        const preferredEvidence: DeliveryEvidence[] =
          deliverable.workspacePersistence === "required"
            ? ["successful_write", ...evidence]
            : evidence;
        for (const requiredEvidence of preferredEvidence) {
          const providerTool = Object.entries(toolEvidence).find(
            ([name, capabilities]) =>
              availableToolNames.has(name) &&
              capabilities.includes(requiredEvidence),
          )?.[0];
          if (providerTool) return providerTool;
        }
      } catch {
        // The completion gate already reports the malformed contract evidence.
      }
    }

    return requiredTool && availableToolNames.has(requiredTool)
      ? requiredTool
      : undefined;
  };

  const continueAfterCompletionGateFailure = (
    currentState: RunState<any, any>,
    gate: Exclude<CompletionGateResult, { passed: true }>,
  ): void => {
    if (completionGateRetries >= MAX_COMPLETION_GATE_RETRIES) {
      terminalFailureOutput = synthesizeStructuredFailureFromEvidence(gate);
      agentLog(`[completion_gate] 已达到最大修复次数，返回结构化失败结果: ${gate.reason}`);
      return;
    }
    completionGateRetries += 1;
    runtimeCompletionRepairInstruction = gate.repairInstruction;
    const forcedRepairTool = chooseCompletionRepairTool(gate);
    const availableForcedRepairTool =
      forcedRepairTool && availableToolNames.has(forcedRepairTool)
        ? forcedRepairTool
        : undefined;
    if (forcedRepairTool && !availableForcedRepairTool) {
      agentLog(
        `[completion_gate] 跳过不可用的修复工具: ${forcedRepairTool}`,
      );
    }
    agentLog(
      `[completion_gate] retry ${completionGateRetries}/${MAX_COMPLETION_GATE_RETRIES}: ${gate.reason}` +
        (availableForcedRepairTool
          ? ` | force_tool=${availableForcedRepairTool}`
          : ""),
    );
    if (options.protocol.eventFactory) {
      options.protocol.onEvent(
        options.protocol.eventFactory.next({
          type: "run.progress",
          payload: {
            stage: "completion_gate.retry",
            message: gate.reason,
            repairInstruction: gate.repairInstruction,
            issues: gate.issues,
            attempt: completionGateRetries,
            maxAttempts: MAX_COMPLETION_GATE_RETRIES,
          },
        }),
      );
    }
    if (availableForcedRepairTool && model instanceof GatewayGuardedModel) {
      model.requireToolOnce(availableForcedRepairTool);
    }
    agent = buildAgent(availableForcedRepairTool);
    // Once the SDK has settled a final assistant output, changing that same
    // RunState into a new tool turn can make its completed-tool ledger diverge
    // from generated item history. Restart this repair turn from the durable
    // session instead; the repair instruction and prior tool results remain
    // available without mutating a completed SDK state.
    state = undefined;
    structuredOutput = undefined;
    output = "";
  };

  const effectToolKeyByCallId = new Map<string, string>();
  const visibleEffectCallIdByKey = new Map<string, string>();
  const suppressedEffectCallIds = new Set<string>();
  const visibleApprovalIdByKey = new Map<string, string>();
  const suppressedApprovalIds = new Set<string>();
  const protocolPayloadString = (
    payload: Record<string, unknown>,
    key: string,
  ): string | undefined => {
    const value = payload[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };
  const shouldDedupeEffectTool = (toolName: string): boolean => {
    const risk = toolRisk(toolName);
    return risk === "write" || risk === "execute";
  };
  const protocolToolDuplicateKey = (
    payload: Record<string, unknown>,
  ): string | undefined => {
    const toolName = protocolPayloadString(payload, "toolName");
    if (!toolName || !shouldDedupeEffectTool(toolName)) return undefined;
    return duplicateApprovalKey({
      name: toolName,
      args: protocolPayloadString(payload, "args")
        ?? protocolPayloadString(payload, "arguments")
        ?? "",
    });
  };
  const shouldSuppressProtocolEvent = (event: AgentProtocolEvent): boolean => {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === "tool.started") {
      const toolName = protocolPayloadString(payload, "toolName");
      if (toolName && completedWorkflowToolRejection(toolName)) return true;
      if (pipelineStageRuntime.shouldSuppressStarted({
        toolName,
        args: protocolPayloadString(payload, "args") ??
          protocolPayloadString(payload, "arguments") ??
          "",
        callId: protocolPayloadString(payload, "callId"),
        itemId: protocolPayloadString(payload, "itemId"),
      })) return true;
      const duplicateKey = protocolToolDuplicateKey(payload);
      if (!duplicateKey) return false;
      const callId =
        protocolPayloadString(payload, "callId") ??
        protocolPayloadString(payload, "itemId") ??
        `${duplicateKey}:anonymous`;
      const existingCallId = visibleEffectCallIdByKey.get(duplicateKey);
      if (existingCallId && existingCallId !== callId) {
        suppressedEffectCallIds.add(callId);
        return true;
      }
      visibleEffectCallIdByKey.set(duplicateKey, callId);
      effectToolKeyByCallId.set(callId, duplicateKey);
      return false;
    }
    if (event.type === "approval.requested") {
      const approvalId = protocolPayloadString(payload, "approvalId");
      const callId = protocolPayloadString(payload, "callId");
      const toolName = protocolPayloadString(payload, "toolName");
      if (toolName && completedWorkflowToolRejection(toolName)) {
        if (approvalId) suppressedApprovalIds.add(approvalId);
        if (callId) suppressedEffectCallIds.add(callId);
        return true;
      }
      const duplicateKey = protocolToolDuplicateKey(payload);
      if (!duplicateKey || !approvalId) return false;
      if (callId && suppressedEffectCallIds.has(callId)) {
        suppressedApprovalIds.add(approvalId);
        return true;
      }
      const existingApprovalId = visibleApprovalIdByKey.get(duplicateKey);
      if (existingApprovalId && existingApprovalId !== approvalId) {
        suppressedApprovalIds.add(approvalId);
        if (callId) suppressedEffectCallIds.add(callId);
        return true;
      }
      visibleApprovalIdByKey.set(duplicateKey, approvalId);
      return false;
    }
    if (event.type === "approval.resolved") {
      const approvalId = protocolPayloadString(payload, "approvalId");
      return !!approvalId && suppressedApprovalIds.has(approvalId);
    }
    if (event.type === "tool.completed") {
      const callId = protocolPayloadString(payload, "callId");
      const toolName = protocolPayloadString(payload, "toolName");
      if (toolName && completedWorkflowToolRejection(toolName)) return true;
      if (pipelineStageRuntime.shouldSuppressCompleted(callId)) return true;
      if (callId && suppressedEffectCallIds.has(callId)) return true;
      if (callId) {
        const duplicateKey = effectToolKeyByCallId.get(callId);
        if (duplicateKey && visibleEffectCallIdByKey.get(duplicateKey) === callId) {
          visibleEffectCallIdByKey.delete(duplicateKey);
        }
      }
    }
    return false;
  };

  // 空回复熔断:按"本轮结束"处理(工具回执已透出,不必再向用户抛错)
  const protocolAdapter = new AgentStreamAdapter({
    runId: options.protocol.runId,
    operationId: options.protocol.operationId,
    structuredOutput: structuredMode,
    eventFactory: options.protocol.eventFactory,
    emit: (event) => {
      let visibleEvent = event;
      if (event.type === "text.delta") {
        const payload = event.payload as Record<string, unknown>;
        const text = typeof payload.text === "string" ? payload.text : "";
        const delta = sanitizeStreamDelta(text);
        if (!delta) return;
        visibleEvent = {
          ...event,
          payload: { ...payload, text: delta },
        };
      }
      if (shouldSuppressProtocolEvent(visibleEvent)) return;
      observeProtocolEvent(visibleEvent);
      options.protocol.onEvent(visibleEvent);
    },
  });

  const pump = async (
    stream: StreamedRunResult<any, any>,
  ): Promise<"done" | "empty-bailed" | "cancelled"> => {
    rawStreamText = "";
    visibleStreamText = "";
    let bailed = false;
    let cancelled = false;
    let salvagedInvalidFinalOutput = false;
    try {
      await protocolAdapter.consume(stream);
    } catch (e) {
      if (
        isAgentCancellationError(e) ||
        options.signal?.aborted ||
        stream.cancelled
      ) {
        cancelled = true;
      } else if (e instanceof EmptyGatewayResponseError) {
        bailed = true;
      } else if (structuredMode && isInvalidFinalOutputTypeError(e)) {
        salvagedInvalidFinalOutput = true;
        finalizerRequired = true;
      } else {
        throw e;
      }
    }
    if (!cancelled && !bailed) {
      // Session persistence and finalOutput settlement can finish after the
      // last streamed event. Await completed before reading settled summaries.
      try {
        await stream.completed;
      } catch (e) {
        if (
          isAgentCancellationError(e) ||
          options.signal?.aborted ||
          stream.cancelled
        ) {
          cancelled = true;
        } else if (e instanceof EmptyGatewayResponseError) {
          bailed = true;
        } else if (structuredMode && isInvalidFinalOutputTypeError(e)) {
          salvagedInvalidFinalOutput = true;
          finalizerRequired = true;
        } else {
          throw e;
        }
      }
    }
    usage.inputTokens = stream.state.usage.inputTokens;
    usage.outputTokens = stream.state.usage.outputTokens;
    usage.requests = stream.state.usage.requests;
    const interrupted = stream.state.getInterruptions().length > 0;
    if (
      !bailed &&
      !cancelled &&
      !interrupted &&
      !stream.cancelled &&
      stream.finalOutput !== undefined
    ) {
      if (structuredMode) {
        const finalOutput =
          typeof stream.finalOutput === "string"
            ? stripHistoricalContextMarker(stream.finalOutput)
            : stream.finalOutput;
        const candidate = tryParseJsonLikeOutput(finalOutput);
        const parsed = industrialAgentOutputDefinition.schema.safeParse(candidate);
        if (parsed.success) {
          structuredOutput = sanitizeAssistantOutput(
            parsed.data as IndustrialAgentOutput,
          );
        } else {
          finalizerRequired = true;
          structuredOutput =
            typeof finalOutput === "string" &&
            !isInvalidStructuredOutputText(finalOutput)
              ? coerceIndustrialAgentOutput(finalOutput)
              : undefined;
          if (!structuredOutput) {
            salvagedInvalidFinalOutput = true;
            agentLog(
              "[output] 最终输出不符合 schema，等待运行时根据工具账本完成验收",
            );
          } else {
            structuredOutput = sanitizeAssistantOutput(structuredOutput);
            agentLog(
              "[output] 最终输出不符合 schema，已保留正文并交给运行时完成验收继续处理",
            );
          }
        }
        if (structuredOutput) {
          output = projectAgentOutput(
            industrialAgentOutputDefinition,
            structuredOutput,
          ).text;
        }
      } else if (typeof stream.finalOutput === "string") {
        output = stripHistoricalContextMarker(stream.finalOutput);
      }
    }
    if (
      structuredMode &&
      salvagedInvalidFinalOutput &&
      !structuredOutput &&
      output.trim()
    ) {
      finalizerRequired = true;
      const invalidStructuredText = isInvalidStructuredOutputText(output);
      if (!invalidStructuredText) {
        structuredOutput = coerceIndustrialAgentOutput(output) ?? {
          message: stripHistoricalContextMarker(output),
          diagnostics: [],
          artifacts: [],
          data: null,
        };
        structuredOutput = sanitizeAssistantOutput(structuredOutput);
        output = structuredOutput.message;
        agentLog(
          "[output] 最终输出不符合 schema，已保留正文并交给运行时完成验收继续处理",
        );
      } else {
        agentLog(
          "[output] 最终输出疑似非法结构化 JSON，不保留为正文，交给运行时根据工具账本完成验收",
        );
      }
    }

    if (cancelled) return "cancelled";
    return bailed ? "empty-bailed" : "done";
  };

  const checkpoint = async (
    state: RunState<any, any>,
    approvals: ApprovalRequest[],
  ) => {
    await options.onCheckpoint?.({
      state: state.toString(),
      approvals,
      output,
      usage: { ...usage },
    });
  };

  const approvalId = (item: RunToolApprovalItem, index: number) => {
    const raw = item.rawItem as { name?: string; callId?: string };
    return raw.callId ?? `${raw.name ?? "tool"}:${index}`;
  };

  const decisions = new Map(Object.entries(options.decisions ?? {}));
  type ApprovalResolution = {
    unresolved: ApprovalRequest[];
    refused: ApprovalRequest[];
  };
  const resolveApprovals = async (
    state: RunState<any, any>,
    pending: RunToolApprovalItem[],
  ): Promise<ApprovalResolution> => {
    const requests = pending.map((item, index) => {
      const raw = item.rawItem as { name?: string; arguments?: string };
      return {
        id: approvalId(item, index),
        name: raw.name ?? "tool",
        args: raw.arguments ?? "",
      };
    });
    const duplicateKeys = requests.map(duplicateApprovalKey);
    const firstIndexByKey = new Map<string, number>();
    const decisionByKey = new Map<string, boolean>();
    for (let index = 0; index < requests.length; index++) {
      const key = duplicateKeys[index];
      if (!firstIndexByKey.has(key)) firstIndexByKey.set(key, index);
      const decision = decisions.get(requests[index].id);
      if (decision !== undefined && !decisionByKey.has(key)) {
        decisionByKey.set(key, decision);
      }
    }
    const unresolved: ApprovalRequest[] = [];
    const refused: ApprovalRequest[] = [];
    const unresolvedKeys = new Set<string>();
    const refusedKeys = new Set<string>();
    for (let index = 0; index < pending.length; index++) {
      const item = pending[index];
      const request = requests[index];
      const duplicateKey = duplicateKeys[index];
      const firstIndex = firstIndexByKey.get(duplicateKey) ?? index;
      const isDuplicate = firstIndex !== index;
      // On a durable resume the SDK may emit only tool output after approval.
      // Seed the call index from the persisted approval so verification still
      // has the original tool arguments.
      recordToolCall(request.name, request.id, request.args);
      toolNameByCallId.set(request.id, request.name);
      const completedWorkflowRejection = completedWorkflowToolRejection(request.name);
      if (completedWorkflowRejection) {
        state.reject(item, { message: completedWorkflowRejection });
        agentLog(
          `[workflow] 已拒绝交付完成后的重复工具调用: ${request.name}`,
        );
        continue;
      }
      let decision = decisions.get(request.id);
      if (decision !== undefined) decisions.delete(request.id);
      if (decision === undefined) decision = decisionByKey.get(duplicateKey);
      if (decision === undefined) {
        if (!unresolvedKeys.has(duplicateKey)) {
          unresolved.push(request);
          unresolvedKeys.add(duplicateKey);
        }
      } else if (decision && isDuplicate) {
        state.reject(item, {
          message: "运行时已折叠同批重复的相同工具调用；只执行第一条。",
        });
      } else if (decision) {
        state.approve(item);
      } else {
        state.reject(item, { message: "用户拒绝了该工具调用。" });
        if (!refusedKeys.has(duplicateKey)) {
          refused.push(requests[firstIndex] ?? request);
          refusedKeys.add(duplicateKey);
        }
      }
    }
    return { unresolved, refused };
  };

  let state: RunState<any, any> | undefined;
  if (options.initialState) {
    state = await RunState.fromString(agent, options.initialState);
    state.clearTrace();
    usage.requests = state.usage.requests;
    usage.inputTokens = state.usage.inputTokens;
    usage.outputTokens = state.usage.outputTokens;
  }
  const historicalToolResults = options.initialState
    ? await loadHistoricalToolResults(session, userText)
    : [];
  if (options.initialState) {
    workflowRuntime?.completionAdapter?.restore?.(historicalToolResults);
    refreshWorkflowCompletion();
  }

  // Approval checkpoints are first-class results. The host persists the
  // checkpoint and resumes the same SDK RunState with explicit decisions.
  let approvalRounds = 0;
  let actionReminderUsed = false;
  while (true) {
    if (approvalRounds++ >= MAX_TURNS)
      throw new MaxTurnsExceededError("审批恢复次数超过上限");
    if (state) {
      const pending = state.getInterruptions();
      if (pending.length) {
        const resolution = await resolveApprovals(state, pending);
        if (resolution.refused.length) {
          const reason = `用户拒绝了工具调用: ${resolution.refused
            .map((request) => request.name)
            .join(", ")}`;
          const result = createAgentResult<IndustrialAgentOutput>({
            status: "refused",
            reason,
            usage,
          });
          return {
            result,
            output,
            usage,
            status: "refused",
          };
        }
        const unresolved = resolution.unresolved;
        if (unresolved.length) {
          await checkpoint(state, unresolved);
          const result = createAgentResult<IndustrialAgentOutput>({
            status: "awaiting_approval",
            state: state.toString(),
            approvals: unresolved,
            usage,
          });
          return {
            result,
            output,
            usage,
            status: "awaiting_approval",
            state: state.toString(),
            approvals: unresolved,
          };
        }
      }
    }

    const stream = await runner.run(agent, state ?? userText, {
      stream: true,
      maxTurns: MAX_TURNS,
      session: runnerSession,
      ...(sessionInputCallback ? { sessionInputCallback } : {}),
      signal: options.signal,
    });
    let outcome: "done" | "empty-bailed" | "cancelled";
    try {
      outcome = await pump(stream);
    } catch (error) {
      let serializedState: string | undefined;
      try {
        serializedState = stream.state.toString();
      } catch {
        // Fall back to a boundary restart when this provider state cannot be
        // serialized after an error.
      }
      attachResumableAgentState(error, serializedState);
      throw error;
    }
    state = stream.state;

    // A gateway may complete a successful action without a final text turn.
    // Keep the existing action result fallback for that explicit empty-response
    // path; normal completed turns must still pass schema validation above.
    if (
      structuredMode &&
      !structuredOutput &&
      outcome === "empty-bailed" &&
      model instanceof GatewayGuardedModel &&
      requiredTool !== undefined
    ) {
      structuredOutput = {
        message: output,
        diagnostics: [],
        artifacts: [],
        data: null,
      };
    }

    if (
      outcome === "cancelled" ||
      options.signal?.aborted ||
      stream.cancelled
    ) {
      let resumableState: string | undefined;
      try {
        resumableState = state?.toString();
      } catch {
        // A provider may abort before the SDK can serialize a usable state.
      }
      return {
        result: createAgentResult({
          status: "cancelled",
          reason: "aborted",
          usage,
        }),
        output,
        usage,
        status: "cancelled",
        state: resumableState,
      };
    }
    if (
      requiredTool &&
      !hasAttemptedRequiredAction() &&
      !actionReminderUsed &&
      !options.initialState &&
      !activePlan &&
      !options.teamTask &&
      !workflowRuntime &&
      availableToolNames.has(requiredTool) &&
      !state.getInterruptions().length
    ) {
      actionReminderUsed = true;
      runtimeActionReminderInstruction =
        `用户请求中的动作意图可能需要 ${requiredTool}。` +
        "请先判断当前请求是否确实要求执行该动作；如果要求，就调用对应工具，" +
        "不要只重复说明或假设动作已经完成。";
      agentLog(
        `[action] ${requiredTool} 未被调用，发送一次普通动作提醒，不强制 toolChoice`,
      );
      agent = buildAgent();
      state = undefined;
      structuredOutput = undefined;
      finalizerRequired = false;
      output = "";
      continue;
    }
    if (outcome === "empty-bailed" || !state.getInterruptions().length) {
      if (!structuredMode) {
        assertPlanCompleted();
        const gate = runCompletionGate(output);
        await reviewCompletionGateDecision(output, [], gate);
        if (!gate.passed) {
          continueAfterCompletionGateFailure(state, gate);
          continue;
        }
        const canonicalOutput: IndustrialAgentOutput = {
          message: output,
          diagnostics: [],
          artifacts: [],
          data: null,
        };
        const projected = projectAgentOutput(
          industrialAgentOutputDefinition,
          canonicalOutput,
        );
        const result = createAgentResult({
          status: "completed",
          output: canonicalOutput,
          usage,
          diagnostics: projected.diagnostics,
          artifacts: projected.artifacts,
        });
        return {
          result,
          output,
          usage,
          status: "completed",
        };
      }
      const needsFinalizer = finalizerRequired || !structuredOutput;
      if (needsFinalizer) {
        const hadInvalidFinalOutput = finalizerRequired;
        const finalized = await finalizeStructuredOutputFromRuntime();
        finalizerRequired = false;
        if (finalized) {
          structuredOutput = sanitizeAssistantOutput(finalized);
          output = structuredOutput.message;
        } else if (hadInvalidFinalOutput) {
          structuredOutput = undefined;
        }
      }
      if (!structuredOutput) {
        structuredOutput = synthesizeStructuredOutputFromEvidence();
        if (structuredOutput) {
          output = structuredOutput.message;
        }
      }
      if (!structuredOutput) {
        const fallbackMessage = fallbackRequiredToolMessage();
        if (requiredTool && hasAttemptedRequiredAction() && fallbackMessage) {
          structuredOutput = {
            message: fallbackMessage,
            diagnostics: [],
            artifacts: [],
            data: null,
          };
        }
      }
      if (!structuredOutput) {
        return failedAgentRunResult(synthesizeStructuredFailureFromEvidence());
      }
      assertPlanCompleted();
      const authoritativeMessage = authoritativeWorkflowMessage();
      const fallbackMessage = fallbackRequiredToolMessage();
      structuredOutput = sanitizeAssistantOutput(structuredOutput);
      const rawMessage = structuredOutput.message.trim()
        ? structuredOutput.message
        : "";
      const message = stripHistoricalContextMarker(authoritativeMessage ?? (
        rawMessage && !isInternalToolArtifactComplaint(rawMessage)
          ? rawMessage
          : fallbackMessage ?? structuredOutput.message
      ));
      const structuredProjection = projectAgentOutput(
        industrialAgentOutputDefinition,
        structuredOutput,
      );
      const deliveredArtifacts = deliveredArtifactsFromTools();
      const gate = runCompletionGate(message, structuredProjection.artifacts);
      await reviewCompletionGateDecision(message, structuredProjection.artifacts, gate);
      if (!gate.passed) {
        continueAfterCompletionGateFailure(state, gate);
        if (terminalFailureOutput) return failedAgentRunResult(terminalFailureOutput);
        continue;
      }
      const verifiedArtifacts = await verifyRequiredActions();
      const canonicalOutput: IndustrialAgentOutput = {
        ...structuredOutput,
        message,
        artifacts: [
          ...structuredOutput.artifacts,
          ...deliveredArtifacts.map((artifact) => ({
            kind: artifact.kind,
            name: artifact.name,
            uri: artifact.uri ?? null,
            mimeType: artifact.mimeType ?? null,
            content: artifact.content ?? null,
          })),
          ...verifiedArtifacts.map((artifact) => ({
            kind: artifact.kind,
            name: artifact.name,
            uri: artifact.uri ?? null,
            mimeType: artifact.mimeType ?? null,
            content: artifact.content ?? null,
          })),
        ],
      };
      const projected = projectAgentOutput(
        industrialAgentOutputDefinition,
        canonicalOutput,
      );
      const result = createAgentResult({
        status: "completed",
        output: canonicalOutput,
        usage,
        diagnostics: projected.diagnostics,
        artifacts: projected.artifacts,
      });
      return {
        result,
        output: canonicalOutput.message,
        usage,
        status: "completed",
      };
    }
  }
}
