import type { Artifact } from "../../../protocol/results";
import type { CompletionGateResult } from "../../completionGate";
import type {
  DeliveryWorkflow,
  DeliveryWorkflowDescriptor,
  WorkflowDecisionContext,
  WorkflowDescriptor,
  WorkflowToolRecord,
} from "../../workflow/types";

export const ST_INSPECTION_TOOL_NAMES = [
  "st_dependency_map",
  "st_change_impact",
  "st_symbol_references",
] as const;

const ST_INSPECTION_WORKFLOW_ID = "st_inspection";
const ST_INSPECTION_KEYWORDS =
  /依赖关系|依赖图|引用关系|引用图|调用关系|调用图|影响面|影响范围|波及|dependency|dependencies|reference graph|call graph|change impact/i;

function describeStInspection(): DeliveryWorkflowDescriptor {
  return {
    id: ST_INSPECTION_WORKFLOW_ID,
    title: "ST 工作区依赖分析",
    stages: [
      {
        order: 1,
        id: "inspect_st_dependencies",
        toolName: "st_dependency_map",
        title: "分析 ST 文件依赖",
        description: "读取工作区 ST 文件并解析文件与符号之间的依赖关系",
        successEvidence: "st_dependency_map 返回工作区依赖摘要或目标文件依赖明细",
        onFailure: "stop",
      },
    ],
  };
}

function stInspectionLocalMatch(
  context: WorkflowDecisionContext,
): { matched: boolean; confidence: number; reason: string } {
  const hasStSignal =
    /\.st\b|st\s*(文件|工程|项目|代码)|\bplc\b|结构化文本|structured\s*text/i.test(
      context.userText,
    );
  if (!hasStSignal || !ST_INSPECTION_KEYWORDS.test(context.userText)) {
    return {
      matched: false,
      confidence: 0,
      reason: "本地规则未识别为 ST 依赖分析请求",
    };
  }
  return {
    matched: true,
    confidence: 0.91,
    reason: "本地规则识别为只读 ST 工作区依赖/影响分析",
  };
}

export const ST_INSPECTION_WORKFLOW: WorkflowDescriptor = {
  id: ST_INSPECTION_WORKFLOW_ID,
  title: "ST 工作区依赖分析",
  description:
    "只读分析当前工作区中 ST 文件、功能块、类型和符号之间的依赖关系及变更影响面，不生成或保存代码。",
  runtimeManaged: true,
  workflowRoute: ST_INSPECTION_WORKFLOW_ID,
  visibleToolNames: ST_INSPECTION_TOOL_NAMES,
  describe: describeStInspection,
  createDeliveryContract: () => undefined,
  localMatch: stInspectionLocalMatch,
  createRuntime: () => new StInspectionWorkflow(),
};

/**
 * Inspection reuses the generic runtime workflow lifecycle but has no
 * delivery contract and no side-effect stage.
 */
export class StInspectionWorkflow implements DeliveryWorkflow {
  readonly id = ST_INSPECTION_WORKFLOW_ID;
  readonly title = ST_INSPECTION_WORKFLOW.title;
  readonly stages = describeStInspection().stages;
  readonly visibleToolNames = ST_INSPECTION_TOOL_NAMES;
  readonly parallelToolCalls = false;

  initialTool(options: { isResume: boolean }): string | undefined {
    return options.isResume ? undefined : "st_dependency_map";
  }

  instructions(): string {
    return (
      "\n本轮是只读 ST 工作区依赖分析，不是代码交付任务。" +
      "优先调用 st_dependency_map 获取整个工作区的真实依赖图；" +
      "只有用户明确要求某个文件的变更影响面时，才调用 st_change_impact。" +
      "当用户问的是某个具体符号（变量 / 功能块 / 类型）在哪声明、被哪些行引用时，调用 st_symbol_references；" +
      "它给的是符号级明细，包含同一文件内的本地变量引用，这是 st_dependency_map 给不出的。" +
      "禁止调用 validate_st_code、write_file、export_st_program 或其他未暴露工具。" +
      "不要编造 ST 草稿，也不要修改工作区文件。"
    );
  }

  chooseRepairTool(
    _gate: Exclude<CompletionGateResult, { passed: true }>,
    _records: WorkflowToolRecord[],
    _availableToolNames: Set<string>,
  ): string | undefined {
    return undefined;
  }

  authoritativeMessage(_records: WorkflowToolRecord[]): string | undefined {
    return undefined;
  }

  hydrate(_records: WorkflowToolRecord[]): void {
    // Inspection has no mutable workflow state to restore.
  }

  verifyRequiredAction(_call: WorkflowToolRecord): Artifact | undefined {
    return undefined;
  }
}
