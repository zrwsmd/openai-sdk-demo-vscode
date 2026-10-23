import type { AgentInputItem } from "@openai/agents";
import type { AgentConfig } from "../agentConfig";
import {
  AgentDecisionService,
  type TaskDecisionHint,
  type TaskMcpServerChoice,
} from "../decision/agentDecision";
import {
  getDefaultWorkflowRegistry,
  type WorkflowRegistry,
} from "./registry";
import type { ToolCatalog } from "../toolCatalog";
import { inferCurrentActionIntent } from "../../policy/actionPolicy";
import { isReadOnlyInspectionRequest } from "../../policy/actionPolicy";
import type { CurrentActionIntent } from "../../policy/actionPolicy";
import { createWorkflowContract } from "./types";
import type {
  WorkflowDecision,
  WorkflowDecisionSignals,
  WorkflowDescriptor,
  WorkflowFallbackMode,
  WorkflowModelDecision,
  WorkflowToolNeedSignals,
} from "./types";

export type WorkflowModelClassifier = (
  cfg: AgentConfig,
  userText: string,
  signal: AbortSignal | undefined,
  history: AgentInputItem[],
  workflows: readonly WorkflowDescriptor[],
) => Promise<WorkflowModelDecision | undefined>;

export class WorkflowDecisionService {
  constructor(
    private readonly log: (line: string) => void = () => {},
    private readonly decisionService: AgentDecisionService = new AgentDecisionService(log),
    private readonly registry: WorkflowRegistry = getDefaultWorkflowRegistry(),
    private readonly toolCatalog?: ToolCatalog,
  ) {}

  async decide(
    cfg: AgentConfig,
    userText: string,
    signal?: AbortSignal,
    history: AgentInputItem[] = [],
    options: {
      modelClassifier?: WorkflowModelClassifier;
      mcpServerChoices?: readonly TaskMcpServerChoice[];
    } = {},
  ): Promise<WorkflowDecision> {
    const workflows = this.registry.list();
    const actionIntent = inferCurrentActionIntent(userText);
    const jevHint = await this.decisionService.taskHint(cfg.jev, userText, signal, {
      workflowChoices: workflows
        .map((workflow) => ({
          route: workflow.workflowRoute ?? workflow.id,
          title: workflow.title,
          description: workflow.description,
        })),
      mcpServerChoices: options.mcpServerChoices,
    });
    const localFallbackDecision = this.workflowFromLocalFallbackDetectors(
      userText,
      history,
      workflows,
      jevHint,
      actionIntent,
    );
    if (localFallbackDecision) return localFallbackDecision;
    const registeredWorkflowDecision = this.workflowFromRegisteredJevHint(
      jevHint,
      actionIntent,
      userText,
    );
    if (registeredWorkflowDecision) return registeredWorkflowDecision;

    const commandQueryDecision = this.workflowFromCommandQueryJevHint(jevHint, userText);
    if (commandQueryDecision) return commandQueryDecision;

    const localDecision = this.workflowFromLocalDetectors(
      userText,
      history,
      workflows,
      jevHint,
      actionIntent,
    );
    if (localDecision) return localDecision;

    const safeFallbackDecision = this.workflowFromSafeJevFallback(jevHint, userText);
    if (safeFallbackDecision) return safeFallbackDecision;
    const safeFallbackReasons = safeFallbackMissReasons(jevHint);
    if (safeFallbackReasons.length) {
      this.log(
        `[workflow] Jev safe fallback skipped: ${safeFallbackReasons.join(", ")}`,
      );
    }

    const modelDecision = await this.workflowFromModelClassifier(
      cfg,
      userText,
      signal,
      history,
      workflows,
      options.modelClassifier,
      jevHint,
      actionIntent,
    );
    if (modelDecision) return modelDecision;

    return this.fallbackFromHint(jevHint, userText);
  }

  private workflowFromRegisteredJevHint(
    hint: TaskDecisionHint,
    actionIntent: CurrentActionIntent,
    userText: string,
  ): WorkflowDecision | undefined {
    const workflow = this.registry.getByRoute(hint.workflow) ?? this.registry.get(hint.workflow);
    if (workflow && isWorkflowCompatibleWithAction(workflow, actionIntent, userText)) {
      const contract = createWorkflowContract(workflow, {
        source: "jev",
        reason: `Jev 高置信度识别为 ${workflow.title}(${hint.workflowConfidence.toFixed(2)})`,
      });
      this.log(
        `[workflow] Jev 命中 ${workflow.id}(${hint.workflowConfidence.toFixed(2)})，启用 workflow 路由`,
      );
      return {
        kind: "workflow",
        workflow,
        source: "jev",
        confidence: hint.workflowConfidence,
        reason: `Jev 高置信度识别为 ${workflow.title}`,
        signals: signalsFromHint(hint),
        ...(contract ? { contract } : {}),
      };
    }
    if (workflow) {
      this.log(
        isReadOnlyBlockedWorkflow(workflow, userText)
          ? `[workflow] 忽略 ${workflow.id}: 用户只要求校验/检查，不需要改动代码`
          : `[workflow] 忽略 ${workflow.id}: 当前动作 ${actionIntent} 不在该 workflow 的兼容范围内`,
      );
    }
    return undefined;
  }

  private workflowFromLocalFallbackDetectors(
    userText: string,
    history: AgentInputItem[],
    workflows: readonly WorkflowDescriptor[],
    hint: TaskDecisionHint,
    actionIntent: CurrentActionIntent,
  ): WorkflowDecision | undefined {
    for (const workflow of workflows) {
      const fallback = workflow.localFallback?.({ userText, history, actionIntent });
      if (!fallback) continue;
      const allowedTools = this.allowedToolsForFallback(fallback.mode, userText);
      this.log(
        `[workflow] local fallback ${fallback.mode}(${fallback.confidence.toFixed(2)})` +
          ` from ${workflow.id}: ${fallback.reason}` +
          (allowedTools?.length ? ` | tools=${allowedTools.join("|")}` : ""),
      );
      return {
        kind: "fallback",
        mode: fallback.mode,
        source: "local",
        confidence: fallback.confidence,
        reason: fallback.reason,
        signals: signalsFromHint(hint),
        allowedTools,
      };
    }
    return undefined;
  }

  private workflowFromCommandQueryJevHint(
    hint: TaskDecisionHint,
    userText: string,
  ): WorkflowDecision | undefined {
    // A high-confidence Jev action signal must not be discarded just because
    // the broad workflow label is a fallback such as general_chat. Keep the
    // command surface narrow: only capabilities explicitly classified for
    // command_query become visible, while tool approval/policy still applies.
    if (isSafeCommandQueryHint(hint)) {
      const mode: WorkflowFallbackMode = "command_query";
      const allowedTools = this.allowedToolsForFallback(mode, userText);
      const confidence = hint.toolNeeds.runCommand.confidence;
      const reason = "Jev 高置信度判断需要执行受控命令，进入命令/环境查询 fallback";
      this.log(
        `[workflow] Jev 命中 ${mode}(${confidence.toFixed(2)}): ${reason}` +
          (allowedTools?.length ? ` | tools=${allowedTools.join("|")}` : ""),
      );
      return {
        kind: "fallback",
        mode,
        source: "jev",
        confidence,
        reason,
        signals: signalsFromHint(hint),
        allowedTools,
      };
    }

    return undefined;
  }

  private workflowFromSafeJevFallback(
    hint: TaskDecisionHint,
    userText: string,
  ): WorkflowDecision | undefined {
    const mode = safeFallbackModeFromJevHint(hint);
    if (!mode) return undefined;

    const allowedTools = this.allowedToolsForFallback(mode, userText);
    const confidence = hint.workflowConfidence;
    const risk = `${hint.riskLevel}(conf=${hint.riskConfidence.toFixed(2)})`;
    const approval = `${hint.needsApproval.value}(conf=${hint.needsApproval.confidence.toFixed(2)})`;
    const reason =
      mode === "general_chat"
        ? "Jev 高置信度判断为普通问答，工具需求均明确为 no"
        : mode === "file_edit"
          ? "Jev 高置信度判断为工作区文件修改，风险未达高或极高"
          : "Jev 高置信度判断为文件只读查询，未检测到写入或命令执行需求";
    this.log(
      `[workflow] Jev safe fallback ${mode}(${confidence.toFixed(2)}): ${reason}` +
        ` | risk=${risk} approval=${approval}` +
        (allowedTools?.length ? ` | tools=${allowedTools.join("|")}` : ""),
    );
    return {
      kind: "fallback",
      mode,
      source: "jev",
      confidence,
      reason,
      signals: signalsFromHint(hint),
      allowedTools,
    };
  }

  private workflowFromLocalDetectors(
    userText: string,
    history: AgentInputItem[],
    workflows: readonly WorkflowDescriptor[],
    hint: TaskDecisionHint,
    actionIntent: CurrentActionIntent,
  ): WorkflowDecision | undefined {
    for (const workflow of workflows) {
      if (isReadOnlyBlockedWorkflow(workflow, userText)) {
        this.log(
          `[workflow] 忽略 local ${workflow.id}: 用户只要求校验/检查，不需要改动代码`,
        );
        continue;
      }
      const match = workflow.localMatch?.({ userText, history, actionIntent });
      if (!match?.matched) continue;
      const contract = createWorkflowContract(workflow, {
        source: "local",
        reason: match.reason,
      });
      this.log(
        `[workflow] local 命中 ${workflow.id}(${match.confidence.toFixed(2)}): ${match.reason}`,
      );
      return {
        kind: "workflow",
        workflow,
        source: "local",
        confidence: match.confidence,
        reason: match.reason,
        signals: signalsFromHint(hint),
        ...(contract ? { contract } : {}),
      };
    }
    return undefined;
  }

  private async workflowFromModelClassifier(
    cfg: AgentConfig,
    userText: string,
    signal: AbortSignal | undefined,
    history: AgentInputItem[],
    workflows: readonly WorkflowDescriptor[],
    classifier: WorkflowModelClassifier | undefined,
    hint: TaskDecisionHint,
    actionIntent: CurrentActionIntent,
  ): Promise<WorkflowDecision | undefined> {
    if (!classifier) return undefined;
    let decision: WorkflowModelDecision | undefined;
    try {
      decision = await classifier(cfg, userText, signal, history, workflows);
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.log(`[workflow] model classifier failed: ${detail}`);
      return undefined;
    }
    if (!decision) return undefined;
    if (decision.kind === "workflow") {
      const workflow = this.registry.get(decision.workflowId);
      if (!workflow) return undefined;
      if (!isWorkflowCompatibleWithAction(workflow, actionIntent, userText)) {
        this.log(
          isReadOnlyBlockedWorkflow(workflow, userText)
            ? `[workflow] 忽略模型 workflow ${workflow.id}: 用户只要求校验/检查，不需要改动代码`
            : `[workflow] 忽略模型 workflow ${workflow.id}: 当前动作 ${actionIntent} 不在兼容范围内`,
        );
        return undefined;
      }
      const contract = createWorkflowContract(workflow, {
        source: "model",
        reason: decision.reason,
      });
      this.log(
        `[workflow] model 命中 ${workflow.id}(${decision.confidence.toFixed(2)}): ${decision.reason}`,
      );
      return {
        kind: "workflow",
        workflow,
        source: "model",
        confidence: decision.confidence,
        reason: decision.reason,
        signals: signalsFromHint(hint),
        ...(contract ? { contract } : {}),
      };
    }
    // Fallback tool visibility is a runtime policy, not a model-provided
    // allowlist. Keep legacy classifier fields for compatibility, but do not
    // let them reintroduce the old risk-filtered surface.
    const allowedTools = this.allowedToolsForFallback(decision.mode, userText);
    this.log(
      `[workflow] model fallback ${decision.mode}(${decision.confidence.toFixed(2)}): ${decision.reason}` +
        (allowedTools?.length ? ` | tools=${allowedTools.join("|")}` : ""),
    );
    return {
      kind: "fallback",
      mode: decision.mode,
      source: "model",
      confidence: decision.confidence,
      reason: decision.reason,
      signals: signalsFromHint(hint),
      allowedTools,
    };
  }

  private fallbackFromHint(hint: TaskDecisionHint, userText: string): WorkflowDecision {
    const mode = fallbackModeFromHint(hint);
    const reason = fallbackReason(mode, hint);
    const allowedTools = this.allowedToolsForFallback(mode, userText);
    this.log(
      `[workflow] fallback ${mode}: ${reason}` +
        (allowedTools?.length ? ` | tools=${allowedTools.join("|")}` : ""),
    );
    return {
      kind: "fallback",
      mode,
      source: "fallback",
      confidence: 0,
      reason,
      signals: signalsFromHint(hint),
      allowedTools,
    };
  }

  private allowedToolsForFallback(
    mode: WorkflowFallbackMode,
    _userText?: string,
  ): readonly string[] | undefined {
    if (this.toolCatalog) {
      const fallbackVisible = this.toolCatalog
        .list()
        .filter((capability) => capability.fallbackModes?.length !== 0);
      const selected = mode === "blocked_high_risk" || mode === "needs_clarification"
        ? fallbackVisible
          .filter((capability) => capability.risk === "read" || capability.risk === "plan")
          .map((capability) => capability.name)
        : fallbackVisible.map((capability) => capability.name);
      return this.toolCatalog.orderToolNames(selected);
    }
    return allowedToolsForFallback(mode);
  }

}

function isWorkflowCompatibleWithAction(
  workflow: WorkflowDescriptor,
  actionIntent: CurrentActionIntent,
  userText: string,
): boolean {
  // 改动类工作流不接纯只读请求：用户只想校验、检查，不需要走提交和写盘。
  if (workflow.requiresCodeChange && isReadOnlyInspectionRequest(userText)) {
    return false;
  }
  const allowed = workflow.actionIntents;
  return !allowed || allowed.length === 0 || allowed.includes(actionIntent);
}

/** 被 requiresCodeChange 挡下来的工作流要单独说清楚原因，别混进"动作不兼容"。 */
function isReadOnlyBlockedWorkflow(
  workflow: WorkflowDescriptor,
  userText: string,
): boolean {
  return workflow.requiresCodeChange === true && isReadOnlyInspectionRequest(userText);
}

function signalsFromHint(hint: TaskDecisionHint): WorkflowDecisionSignals {
  return {
    delivery: hint.delivery,
    deliveryConfidence: hint.deliveryConfidence,
    orchestration: hint.orchestration,
    orchestrationConfidence: hint.orchestrationConfidence,
    riskLevel: hint.riskLevel,
    riskConfidence: hint.riskConfidence,
    toolNeeds: {
      readFile: {
        value: hint.toolNeeds.readFile.value,
        confidence: hint.toolNeeds.readFile.confidence,
      },
      writeFile: {
        value: hint.toolNeeds.writeFile.value,
        confidence: hint.toolNeeds.writeFile.confidence,
      },
      runCommand: {
        value: hint.toolNeeds.runCommand.value,
        confidence: hint.toolNeeds.runCommand.confidence,
      },
    },
    needsApproval: {
      value: hint.needsApproval.value,
      confidence: hint.needsApproval.confidence,
    },
    ...(hint.mcpServerNeeds && Object.keys(hint.mcpServerNeeds).length
      ? { mcpServerNeeds: hint.mcpServerNeeds }
      : {}),
  };
}

function fallbackModeFromHint(hint: TaskDecisionHint): WorkflowFallbackMode {
  if (hint.riskLevel === "critical" || hint.riskLevel === "high") {
    return "blocked_high_risk";
  }
  if (hint.toolNeeds.writeFile.value === "yes") return "file_edit";
  if (hint.toolNeeds.readFile.value === "yes") return "read_only";
  if (isSafeCommandQueryHint(hint)) return "command_query";
  if (hint.delivery === "required") return "needs_clarification";
  return "general_chat";
}

const MIN_SAFE_JEV_WORKFLOW_CONFIDENCE = 0.85;
const MIN_SAFE_JEV_TOOL_CONFIDENCE = 0.6;

/** 工具需求信号的登记表。新增信号只需要加在这里,主导性判断自动生效。 */
const TOOL_NEED_KEYS = ["readFile", "writeFile", "runCommand"] as const;
type ToolNeedKey = (typeof TOOL_NEED_KEYS)[number];

/**
 * 单信号定档的把握门槛。定档之后会连带跳过 delivery 判定、跳过 team 和 planner,
 * 判错的代价比多一次模型调用高,所以和 Jev 直接命中工作流用同一档。
 */
const MIN_DOMINANT_TOOL_CONFIDENCE = 0.85;

/**
 * 三个 yes 信号里把握最高的那个。并列或没有任何 yes 时返回 undefined:
 * 分不出主次的时候,就不该让某一个信号单独把档位定下来。
 */
function dominantToolNeed(
  toolNeeds: WorkflowToolNeedSignals,
): ToolNeedKey | undefined {
  let best: ToolNeedKey | undefined;
  let bestConfidence = Number.NEGATIVE_INFINITY;
  let tied = false;
  for (const key of TOOL_NEED_KEYS) {
    const signal = toolNeeds[key];
    if (signal.value !== "yes") continue;
    if (signal.confidence > bestConfidence) {
      best = key;
      bestConfidence = signal.confidence;
      tied = false;
    } else if (Math.abs(signal.confidence - bestConfidence) < 1e-9) {
      tied = true;
    }
  }
  return tied ? undefined : best;
}

/**
 * 一个工具需求信号能不能支撑某个档位。三条规则:
 * - yes: 必须是主导信号且把握过线。否则说明有更强的信号在指另一个方向,
 *   档位该由那个信号决定,这里必须让位。
 * - no: 直接不成立。
 * - uncertain: 不看主导性,只要没有更高把握的 yes 把方向带偏就放行。
 *   删除类请求 Jev 对 write_file 永远只给 uncertain,靠这条宽松规则才能落到 file_edit。
 */
function toolNeedDrivesFallback(
  hint: TaskDecisionHint,
  key: ToolNeedKey,
  minConfidence: number = MIN_DOMINANT_TOOL_CONFIDENCE,
): boolean {
  const signal = hint.toolNeeds[key];
  if (signal.value === "no") return false;
  if (signal.value === "yes") {
    return (
      signal.confidence >= minConfidence &&
      dominantToolNeed(hint.toolNeeds) === key
    );
  }
  // unknown 说明 Jev 根本没给出结论(未启用或没答),不能拿来定档。
  if (signal.value === "unknown") return false;
  let strongestOther = 0;
  for (const other of TOOL_NEED_KEYS) {
    if (other === key) continue;
    const candidate = hint.toolNeeds[other];
    if (candidate.value === "yes" && candidate.confidence > strongestOther) {
      strongestOther = candidate.confidence;
    }
  }
  return signal.confidence >= strongestOther;
}

function isSafeCommandQueryHint(hint: TaskDecisionHint): boolean {
  // 两条路径都要求把握过线:Jev 整体把这一档判死,或者 run_command 是主导信号。
  // 旧实现只看 run_command 是不是 yes,0.74 的 yes 就能把 read_file 0.94 的请求
  // 抢成命令档,模型于是拿着一份命令工具清单去猜用户要校验什么。
  const labelDrives =
    hint.workflow === "command_query" &&
    hint.workflowConfidence >= MIN_SAFE_JEV_WORKFLOW_CONFIDENCE;
  const signalDrives = toolNeedDrivesFallback(hint, "runCommand");
  return (
    (labelDrives || signalDrives) &&
    hint.delivery !== "required" &&
    hint.toolNeeds.writeFile.value === "no" &&
    hint.riskLevel !== "high" &&
    hint.riskLevel !== "critical"
  );
}

function hasConfidentToolNeed(
  signal: { value: "yes" | "no" | "unknown"; confidence: number },
  value: "yes" | "no",
): boolean {
  return signal.value === value && signal.confidence >= MIN_SAFE_JEV_TOOL_CONFIDENCE;
}

function safeFallbackModeFromJevHint(
  hint: TaskDecisionHint,
): WorkflowFallbackMode | undefined {
  // 创建、导出、删除这类动作，Jev 对 write_file 只给 uncertain（删除本来就不算写文件），
  // 用 delivery=not_required + run_command=no 的严格门槛会把它们全挡掉，
  // 于是落到模型分类器手里，被当成高风险拦成只读档。file_edit 只需要确认确实要动工作区文件。
  //
  // 两条路径任一成立即可，和 command_query 对称：Jev 的标签够硬，或者 write_file 是主导信号。
  // 后者是通用的让位规则：如果 read_file 0.94、write_file 0.7，说明用户在查文件而不是改文件，
  // 这时不该由 file_edit 接住，交给下游判。
  const fileEditByLabel =
    hint.workflow === "file_edit" &&
    hint.workflowConfidence >= MIN_SAFE_JEV_WORKFLOW_CONFIDENCE &&
    !hasConfidentToolNeed(hint.toolNeeds.writeFile, "no");
  const fileEditBySignal = toolNeedDrivesFallback(hint, "writeFile");
  if (
    (fileEditByLabel || fileEditBySignal) &&
    hint.orchestration !== "team" &&
    hint.riskLevel !== "high" &&
    hint.riskLevel !== "critical"
  ) {
    return "file_edit";
  }
  if (
    hint.workflowConfidence < MIN_SAFE_JEV_WORKFLOW_CONFIDENCE ||
    hint.delivery !== "not_required" ||
    hint.orchestration !== "single" ||
    !hasConfidentToolNeed(hint.toolNeeds.writeFile, "no") ||
    !hasConfidentToolNeed(hint.toolNeeds.runCommand, "no")
  ) {
    return undefined;
  }
  if (
    hint.workflow === "general_chat" &&
    hasConfidentToolNeed(hint.toolNeeds.readFile, "no")
  ) {
    return "general_chat";
  }
  // read_only 同样两条路径：标签硬，或者 read_file 是主导信号。
  const readByLabel =
    hint.workflow === "file_read" &&
    hasConfidentToolNeed(hint.toolNeeds.readFile, "yes");
  const readBySignal = toolNeedDrivesFallback(hint, "readFile");
  if (readByLabel || readBySignal) {
    return "read_only";
  }
  return undefined;
}

function safeFallbackMissReasons(hint: TaskDecisionHint): string[] {
  const reasons: string[] = [];
  if (hint.workflowConfidence < MIN_SAFE_JEV_WORKFLOW_CONFIDENCE) {
    reasons.push(
      `workflow_confidence=${hint.workflowConfidence.toFixed(2)}<${MIN_SAFE_JEV_WORKFLOW_CONFIDENCE.toFixed(2)}`,
    );
  }
  if (hint.delivery !== "not_required") {
    reasons.push(
      `delivery=${hint.delivery}(conf=${hint.deliveryConfidence.toFixed(2)})`,
    );
  }
  if (hint.orchestration !== "single") {
    reasons.push(
      `orchestration=${hint.orchestration}(conf=${hint.orchestrationConfidence.toFixed(2)})`,
    );
  }
  if (!hasConfidentToolNeed(hint.toolNeeds.writeFile, "no")) {
    reasons.push(
      `writeFile=${hint.toolNeeds.writeFile.value}(conf=${hint.toolNeeds.writeFile.confidence.toFixed(2)})`,
    );
  }
  if (!hasConfidentToolNeed(hint.toolNeeds.runCommand, "no")) {
    reasons.push(
      `runCommand=${hint.toolNeeds.runCommand.value}(conf=${hint.toolNeeds.runCommand.confidence.toFixed(2)})`,
    );
  }
  if (
    hint.workflow === "general_chat" &&
    !hasConfidentToolNeed(hint.toolNeeds.readFile, "no")
  ) {
    reasons.push(
      `readFile=${hint.toolNeeds.readFile.value}(conf=${hint.toolNeeds.readFile.confidence.toFixed(2)})`,
    );
  }
  if (
    hint.workflow === "file_read" &&
    !hasConfidentToolNeed(hint.toolNeeds.readFile, "yes")
  ) {
    reasons.push(
      `readFile=${hint.toolNeeds.readFile.value}(conf=${hint.toolNeeds.readFile.confidence.toFixed(2)})`,
    );
  }
  if (hint.workflow !== "general_chat" && hint.workflow !== "file_read") {
    reasons.push(`workflow=${hint.workflow}`);
  }
  // 主导信号是判断"该由谁定档"的关键,打出来才能解释为什么某个分支让位了。
  const dominant = dominantToolNeed(hint.toolNeeds);
  reasons.push(`dominant=${dominant ?? "none"}`);
  return reasons;
}

function fallbackReason(mode: WorkflowFallbackMode, hint: TaskDecisionHint): string {
  if (mode === "blocked_high_risk") {
    return `未命中已注册 workflow，但风险判断为 ${hint.riskLevel}，不自动执行副作用`;
  }
  if (mode === "needs_clarification") {
    return "未命中已注册 workflow，但请求可能需要交付物，需要先澄清交付类型";
  }
  if (mode === "command_query") {
    return "未命中已注册 workflow，但请求需要执行受控命令查询环境或工具状态";
  }
  if (mode === "file_edit") return "未命中已注册 workflow，降级为普通文件修改";
  if (mode === "read_only") return "未命中已注册 workflow，降级为只读工具任务";
  return "未命中已注册 workflow，降级为普通问答";
}

const STATIC_FALLBACK_BUSINESS_TOOLS = Object.freeze([
  "get_io_table",
  "read_plc_variables",
  "list_files",
  "read_file",
  "search_files",
  "write_file",
  "edit_file",
  "delete_file",
  "request_clarification",
  "run_command",
] as const);

const STATIC_SAFE_FALLBACK_BUSINESS_TOOLS = Object.freeze([
  "get_io_table",
  "read_plc_variables",
  "list_files",
  "read_file",
  "search_files",
  "request_clarification",
] as const);

function allowedToolsForFallback(mode: WorkflowFallbackMode): readonly string[] {
  return mode === "blocked_high_risk" || mode === "needs_clarification"
    ? STATIC_SAFE_FALLBACK_BUSINESS_TOOLS
    : STATIC_FALLBACK_BUSINESS_TOOLS;
}
