import {
  createStCodeDeliveryContract,
  inferDeliveryContractFromUserText,
  isStWorkspaceDeliveryContract,
} from "../deliveryContract";
import type { DeliveryWorkflowDescriptor } from "../deliveryWorkflow";
import {
  ST_WORKSPACE_DELIVERY_PIPELINE_PLAN,
  ST_WORKSPACE_DELIVERY_STAGES,
} from "../pipeline/stWorkspaceDeliveryPlan";
import type {
  WorkflowDecisionContext,
  WorkflowDescriptor,
  WorkflowLocalMatch,
} from "./types";

function describeStWorkspaceDelivery(): DeliveryWorkflowDescriptor {
  return {
    id: ST_WORKSPACE_DELIVERY_PIPELINE_PLAN.id,
    title: "ST 代码交付",
    stages: ST_WORKSPACE_DELIVERY_STAGES
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(({ order, id, toolName, title, description, successEvidence, onFailure }) => ({
        order,
        id,
        ...(toolName ? { toolName } : {}),
        title,
        description,
        successEvidence,
        onFailure,
      })),
  };
}

function stWorkspaceDeliveryLocalMatch(
  context: WorkflowDecisionContext,
): WorkflowLocalMatch {
  const inferred = inferDeliveryContractFromUserText(context.userText);
  if (inferred && isStWorkspaceDeliveryContract(inferred)) {
    return {
      matched: true,
      confidence: 0.92,
      reason: "本地规则识别为需要落盘的 ST/PLC 程序交付",
    };
  }
  return {
    matched: false,
    confidence: 0,
    reason: "本地规则未识别为 ST/PLC 程序交付",
  };
}

export const ST_WORKSPACE_DELIVERY_WORKFLOW: WorkflowDescriptor = {
  id: "st_workspace_delivery",
  title: "ST 代码交付",
  description: "生成、修复、校验并保存 IEC 61131-3 ST/PLC 程序源码。",
  runtimeManaged: true,
  workflowRoute: "st_delivery",
  visibleToolNames: ["validate_st_code", "write_file"],
  pipelinePlan: ST_WORKSPACE_DELIVERY_PIPELINE_PLAN,
  describe: describeStWorkspaceDelivery,
  matchesDeliveryContract: isStWorkspaceDeliveryContract,
  createDeliveryContract: (options = {}) =>
    createStCodeDeliveryContract({
      reason: options.reason ??
        "识别为 ST 代码交付，运行时按固定流水线校验并保存到当前工作区",
      workspacePersistence: "required",
    }),
  localMatch: stWorkspaceDeliveryLocalMatch,
};

const WORKFLOWS: readonly WorkflowDescriptor[] = [
  ST_WORKSPACE_DELIVERY_WORKFLOW,
];

export function listWorkflows(): readonly WorkflowDescriptor[] {
  return WORKFLOWS;
}

export function getWorkflow(id: string | undefined): WorkflowDescriptor | undefined {
  if (!id) return undefined;
  return WORKFLOWS.find((workflow) => workflow.id === id);
}

export function getWorkflowByRoute(route: string | undefined): WorkflowDescriptor | undefined {
  if (!route) return undefined;
  return WORKFLOWS.find((workflow) => workflow.workflowRoute === route);
}
