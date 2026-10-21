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
import type { CurrentActionIntent } from "../../policy/actionPolicy";
import { createWorkflowContract } from "./types";
import type {
  WorkflowDecision,
  WorkflowDecisionSignals,
  WorkflowDescriptor,
  WorkflowFallbackMode,
  WorkflowModelDecision,
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
  ): WorkflowDecision | undefined {
    const workflow = this.registry.getByRoute(hint.workflow) ?? this.registry.get(hint.workflow);
    if (workflow && isWorkflowCompatibleWithAction(workflow, actionIntent)) {
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
        `[workflow] 忽略 ${workflow.id}: 当前动作 ${actionIntent} 不在该 workflow 的兼容范围内`,
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
      if (!isWorkflowCompatibleWithAction(workflow, actionIntent)) {
        this.log(
          `[workflow] 忽略模型 workflow ${workflow.id}: 当前动作 ${actionIntent} 不在兼容范围内`,
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
): boolean {
  const allowed = workflow.actionIntents;
  return !allowed || allowed.length === 0 || allowed.includes(actionIntent);
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

function isSafeCommandQueryHint(hint: TaskDecisionHint): boolean {
  return (
    (hint.workflow === "command_query" || hint.toolNeeds.runCommand.value === "yes") &&
    hint.delivery !== "required" &&
    hint.toolNeeds.writeFile.value === "no" &&
    hint.riskLevel !== "high" &&
    hint.riskLevel !== "critical"
  );
}

const MIN_SAFE_JEV_WORKFLOW_CONFIDENCE = 0.85;
const MIN_SAFE_JEV_TOOL_CONFIDENCE = 0.6;

function hasConfidentToolNeed(
  signal: { value: "yes" | "no" | "unknown"; confidence: number },
  value: "yes" | "no",
): boolean {
  return signal.value === value && signal.confidence >= MIN_SAFE_JEV_TOOL_CONFIDENCE;
}

function safeFallbackModeFromJevHint(
  hint: TaskDecisionHint,
): WorkflowFallbackMode | undefined {
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
  if (
    hint.workflow === "file_read" &&
    hasConfidentToolNeed(hint.toolNeeds.readFile, "yes")
  ) {
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
