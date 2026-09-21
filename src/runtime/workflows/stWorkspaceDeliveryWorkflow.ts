import path from "node:path";
import type { Artifact, ToolResult } from "../../protocol/results";
import type { CompletionGateResult } from "../completionGate";
import type { DeliveryContract } from "../deliveryContract";
import {
  ST_WORKSPACE_DELIVERY_PIPELINE_PLAN,
  ST_WORKSPACE_DELIVERY_STAGES,
} from "../pipeline/stWorkspaceDeliveryPlan";
import { hashStContent } from "../stContentHash";
import { getWorkflowStateSlot, type DeliveryWorkflowRuntimeState } from "../workflow/runtimeState";
import type {
  DeliveryWorkflow,
  DeliveryWorkflowDescriptor,
  WorkflowDecisionContext,
  WorkflowDescriptor,
  WorkflowLocalMatch,
  WorkflowToolRecord,
} from "../workflow/types";
import {
  createStCodeDeliveryContract,
  inferStDeliveryContractFromUserText,
  isStCodeDeliveryContract,
  isStWorkspaceDeliveryContract,
} from "./stDeliveryContract";

export type StValidatedDraft = {
  hash: string;
  content: string;
};

export type StValidationState = {
  hashes: Set<string>;
  lastSuccessful?: StValidatedDraft;
};

export const ST_WORKSPACE_DELIVERY_TOOL_NAMES = [
  "validate_st_code",
  "write_file",
] as const;

const ST_WORKSPACE_DELIVERY_STATE_KEY = "st_workspace_delivery.validation";

export function createStValidationState(): StValidationState {
  return { hashes: new Set<string>() };
}

export function getStValidationState(
  state: DeliveryWorkflowRuntimeState,
): StValidationState {
  return getWorkflowStateSlot(
    state,
    ST_WORKSPACE_DELIVERY_STATE_KEY,
    createStValidationState,
  );
}

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
  const inferred = inferStDeliveryContractFromUserText(context.userText);
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
  visibleToolNames: ST_WORKSPACE_DELIVERY_TOOL_NAMES,
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
  createRuntime: (contract, state) =>
    isStWorkspaceDeliveryContract(contract)
      ? new StWorkspaceDeliveryWorkflow(contract, getStValidationState(state))
      : undefined,
};

export class StWorkspaceDeliveryWorkflow implements DeliveryWorkflow {
  readonly id = ST_WORKSPACE_DELIVERY_WORKFLOW.id;
  readonly title = ST_WORKSPACE_DELIVERY_WORKFLOW.title;

  readonly stages = ST_WORKSPACE_DELIVERY_STAGES;
  readonly pipelinePlan = ST_WORKSPACE_DELIVERY_PIPELINE_PLAN;

  readonly visibleToolNames = ST_WORKSPACE_DELIVERY_TOOL_NAMES;
  readonly parallelToolCalls = false;
  readonly validationInputMode = "inline_code" as const;
  readonly requiredActionTool = "write_file";

  constructor(
    private readonly contract: DeliveryContract | undefined,
    readonly state: StValidationState,
  ) {}

  initialTool(options: { isResume: boolean }): string | undefined {
    return options.isResume ? undefined : "validate_st_code";
  }

  instructions(): string {
    return "\n本轮 .st 工作区交付由运行时按固定流水线执行：" +
      "先调用 validate_st_code 的 code 参数校验完整内存草稿；" +
      "code 必须是完整 ST 源码，不要传文件路径、工具错误回执、JSON 包装或摘要。" +
      "校验失败时只根据诊断修改草稿并再次校验；errorCount=0 之前禁止写文件。" +
      "校验成功后运行时锁定这份源码，下一步只能单独调用 write_file，" +
      "且 content 必须与刚通过校验的源码完全一致。" +
      "不要并行调用工具，也不要调用当前 workflow 未暴露的工具。";
  }

  recordSuccessfulValidation(content: string, hash: string): void {
    this.state.hashes.add(hash);
    this.state.lastSuccessful = { hash, content };
  }

  canWriteContent(content: string): boolean {
    return this.state.lastSuccessful?.hash === hashStContent(content);
  }

  chooseRepairTool(
    _gate: Exclude<CompletionGateResult, { passed: true }>,
    records: WorkflowToolRecord[],
    availableToolNames: Set<string>,
  ): string | undefined {
    if (!availableToolNames.has("validate_st_code") || !availableToolNames.has("write_file")) {
      return undefined;
    }
    if (!hasSuccessfulStValidation(records)) return "validate_st_code";
    if (!hasValidatedStWrite(records)) return "write_file";
    return undefined;
  }

  authoritativeMessage(records: WorkflowToolRecord[]): string | undefined {
    if (!isStCodeDeliveryContract(this.contract)) return undefined;
    const validationHashes = successfulStValidationHashes(records);
    if (!validationHashes.size) return undefined;

    for (const record of [...records].reverse()) {
      if (record.name !== "write_file" && record.name !== "export_st_program") continue;
      if (!record.result.ok) continue;
      const args = parseArgs(record.args);
      const data = resultData(record.result);
      const file = typeof data.file === "string"
        ? data.file
        : typeof args.path === "string" ? args.path : undefined;
      const content = record.name === "write_file"
        ? typeof args.content === "string" ? args.content : undefined
        : typeof args.code === "string" ? args.code : undefined;
      const recordedHash = typeof data.contentHash === "string"
        ? data.contentHash
        : typeof content === "string" ? hashStContent(content) : undefined;
      if (!file?.toLowerCase().endsWith(".st") || !recordedHash) continue;
      if (!validationHashes.has(recordedHash)) continue;
      const operation = record.name === "export_st_program" ? "导出" : "写入";
      return `已完成：${operation} ${file}；内容与 validate_st_code 通过校验的完整代码一致（errorCount=0）。read_file 的省略号只是界面摘要，不代表文件被截断。`;
    }
    return undefined;
  }

  hydrate(records: WorkflowToolRecord[]): void {
    for (const record of records) {
      const data = resultData(record.result);
      if (record.name === "validate_st_code" && record.result.ok) {
        if (data.errorCount !== 0) continue;
        const args = parseArgs(record.args);
        const code = typeof args.code === "string" && args.code.trim()
          ? args.code
          : undefined;
        const hash = typeof data.validatedContentHash === "string"
          ? data.validatedContentHash
          : code ? hashStContent(code) : undefined;
        if (!code || !hash) continue;
        this.recordSuccessfulValidation(code, hash);
        continue;
      }
      if (record.name === "write_file" && record.result.ok) {
        const args = parseArgs(record.args);
        const content = typeof args.content === "string" ? args.content : undefined;
        const hash = preWriteValidationHash(data);
        if (content && hash === hashStContent(content)) this.recordSuccessfulValidation(content, hash);
      }
    }
  }

  verifyRequiredAction(call: WorkflowToolRecord): Artifact | undefined {
    if (call.name !== "write_file" || !call.result.ok) return undefined;
    const args = parseArgs(call.args);
    if (typeof args.path !== "string" || typeof args.content !== "string") {
      return undefined;
    }
    const data = resultData(call.result);
    const writtenHash = typeof data.contentHash === "string"
      ? data.contentHash
      : hashStContent(args.content);
    const expected = this.state.lastSuccessful;
    if (!expected || !args.path.toLowerCase().endsWith(".st") ||
      writtenHash !== expected.hash || hashStContent(args.content) !== expected.hash) {
      return undefined;
    }
    const file = typeof data.file === "string" ? data.file : args.path;
    const bytes = typeof data.bytes === "number"
      ? data.bytes
      : Buffer.byteLength(args.content, "utf8");
    return {
      kind: "file",
      name: path.basename(file),
      uri: file,
      mimeType: "text/plain",
      metadata: { bytes, contentHash: expected.hash },
    };
  }
}

function parseArgs(args: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function resultData(result: ToolResult): Record<string, unknown> {
  return result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
}

function successfulStValidationHashes(records: WorkflowToolRecord[]): Set<string> {
  const validationHashes = new Set<string>();
  for (const record of records) {
    if (!record.result.ok) continue;
    const data = resultData(record.result);
    if (record.name === "write_file") {
      const hash = preWriteValidationHash(data);
      if (hash) validationHashes.add(hash);
      continue;
    }
    if (record.name !== "validate_st_code") continue;
    if (data.errorCount !== 0) continue;
    const target = data.validationTarget;
    const targetHash = target && typeof target === "object" && !Array.isArray(target)
      ? (target as Record<string, unknown>).contentHash
      : undefined;
    const hash = typeof data.validatedContentHash === "string"
      ? data.validatedContentHash
      : typeof targetHash === "string" ? targetHash : undefined;
    if (hash) validationHashes.add(hash);
  }
  return validationHashes;
}

function hasSuccessfulStValidation(records: WorkflowToolRecord[]): boolean {
  return successfulStValidationHashes(records).size > 0;
}

function hasValidatedStWrite(records: WorkflowToolRecord[]): boolean {
  const validationHashes = successfulStValidationHashes(records);
  return records.some((record) => {
    if (record.name !== "write_file" || !record.result.ok) return false;
    const data = resultData(record.result);
    const preWriteHash = preWriteValidationHash(data);
    if (
      typeof data.file === "string" &&
      data.file.toLowerCase().endsWith(".st") &&
      typeof data.contentHash === "string" &&
      preWriteHash === data.contentHash
    ) {
      return true;
    }
    if (!validationHashes.size) return false;
    return typeof data.file === "string" &&
      data.file.toLowerCase().endsWith(".st") &&
      typeof data.contentHash === "string" &&
      validationHashes.has(data.contentHash);
  });
}

function preWriteValidationHash(data: Record<string, unknown>): string | undefined {
  const preWrite = data.preWriteValidation;
  if (!preWrite || typeof preWrite !== "object" || Array.isArray(preWrite)) return undefined;
  const value = preWrite as Record<string, unknown>;
  if (value.errorCount !== 0) return undefined;
  return typeof value.validatedContentHash === "string"
    ? value.validatedContentHash
    : undefined;
}
