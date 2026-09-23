import type { AgentInputItem } from "@openai/agents";
import type { AgentConfig } from "../agentConfig";
import {
  AgentDecisionService,
  type TaskDecisionHint,
} from "../decision/agentDecision";
import {
  getDefaultWorkflowRegistry,
  type WorkflowRegistry,
} from "./registry";
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
  ) {}

  async decide(
    cfg: AgentConfig,
    userText: string,
    signal?: AbortSignal,
    history: AgentInputItem[] = [],
    options: { modelClassifier?: WorkflowModelClassifier } = {},
  ): Promise<WorkflowDecision> {
    const workflows = this.registry.list();
    const jevHint = await this.decisionService.taskHint(cfg.jev, userText, signal);
    const jevDecision = this.workflowFromJevHint(jevHint);
    if (jevDecision) return jevDecision;

    const localDecision = this.workflowFromLocalDetectors(userText, history, workflows, jevHint);
    if (localDecision) return localDecision;

    const modelDecision = await this.workflowFromModelClassifier(
      cfg,
      userText,
      signal,
      history,
      workflows,
      options.modelClassifier,
      jevHint,
    );
    if (modelDecision) return modelDecision;

    return this.fallbackFromHint(jevHint);
  }

  private workflowFromJevHint(hint: TaskDecisionHint): WorkflowDecision | undefined {
    const workflow = this.registry.getByRoute(hint.workflow);
    if (!workflow) return undefined;
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
      ...(contract ? { deliveryContract: contract } : {}),
    };
  }

  private workflowFromLocalDetectors(
    userText: string,
    history: AgentInputItem[],
    workflows: readonly WorkflowDescriptor[],
    hint: TaskDecisionHint,
  ): WorkflowDecision | undefined {
    for (const workflow of workflows) {
      const match = workflow.localMatch?.({ userText, history });
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
        ...(contract ? { deliveryContract: contract } : {}),
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
        ...(contract ? { deliveryContract: contract } : {}),
      };
    }
    this.log(
      `[workflow] model fallback ${decision.mode}(${decision.confidence.toFixed(2)}): ${decision.reason}`,
    );
    return {
      kind: "fallback",
      mode: decision.mode,
      source: "model",
      confidence: decision.confidence,
      reason: decision.reason,
      signals: signalsFromHint(hint),
      allowedTools: decision.allowedTools ?? allowedToolsForFallback(decision.mode),
    };
  }

  private fallbackFromHint(hint: TaskDecisionHint): WorkflowDecision {
    const mode = fallbackModeFromHint(hint);
    const reason = fallbackReason(mode, hint);
    this.log(`[workflow] fallback ${mode}: ${reason}`);
    return {
      kind: "fallback",
      mode,
      source: "fallback",
      confidence: 0,
      reason,
      signals: signalsFromHint(hint),
      allowedTools: allowedToolsForFallback(mode),
    };
  }
}

function signalsFromHint(hint: TaskDecisionHint): WorkflowDecisionSignals {
  return {
    delivery: hint.delivery,
    deliveryConfidence: hint.deliveryConfidence,
    orchestration: hint.orchestration,
    orchestrationConfidence: hint.orchestrationConfidence,
    riskLevel: hint.riskLevel,
    riskConfidence: hint.riskConfidence,
  };
}

function fallbackModeFromHint(hint: TaskDecisionHint): WorkflowFallbackMode {
  if (hint.riskLevel === "critical" || hint.riskLevel === "high") {
    return "blocked_high_risk";
  }
  if (hint.toolNeeds.writeFile.value === "yes") return "file_edit";
  if (hint.toolNeeds.readFile.value === "yes") return "read_only";
  if (hint.delivery === "required") return "needs_clarification";
  return "general_chat";
}

function fallbackReason(mode: WorkflowFallbackMode, hint: TaskDecisionHint): string {
  if (mode === "blocked_high_risk") {
    return `未命中已注册 workflow，但风险判断为 ${hint.riskLevel}，不自动执行副作用`;
  }
  if (mode === "needs_clarification") {
    return "未命中已注册 workflow，但请求可能需要交付物，需要先澄清交付类型";
  }
  if (mode === "file_edit") return "未命中已注册 workflow，降级为普通文件修改";
  if (mode === "read_only") return "未命中已注册 workflow，降级为只读工具任务";
  return "未命中已注册 workflow，降级为普通问答";
}

function allowedToolsForFallback(mode: WorkflowFallbackMode): readonly string[] | undefined {
  if (mode === "read_only") return ["list_files", "read_file", "search_files"];
  if (mode === "file_edit") return ["list_files", "read_file", "search_files", "write_file"];
  return [];
}
