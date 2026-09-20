import path from "node:path";
import { createHash } from "node:crypto";
import type { Artifact, ToolResult } from "../protocol/results";
import type { CompletionGateResult } from "./completionGate";
import {
  isStCodeDeliveryContract,
  isStWorkspaceDeliveryContract,
  type DeliveryContract,
} from "./deliveryContract";

export type WorkflowToolRecord = {
  name: string;
  args: string;
  result: ToolResult;
  order?: number;
};

export type WorkflowStage = {
  order: number;
  id: string;
  toolName?: string;
  title: string;
  description: string;
  successEvidence: string;
  onFailure: "retry" | "revise_draft" | "stop";
};

export type DeliveryWorkflowDescriptor = {
  id: string;
  title: string;
  stages: Array<{
    order: number;
    id: string;
    toolName?: string;
    title: string;
    description: string;
    successEvidence: string;
    onFailure: WorkflowStage["onFailure"];
  }>;
};

export type StValidatedDraft = {
  hash: string;
  content: string;
};

export type StValidationState = {
  hashes: Set<string>;
  lastSuccessful?: StValidatedDraft;
};

export type DeliveryWorkflowRuntimeState = {
  stValidation: StValidationState;
};

export function createStValidationState(): StValidationState {
  return { hashes: new Set<string>() };
}

export function createDeliveryWorkflowRuntimeState(): DeliveryWorkflowRuntimeState {
  return { stValidation: createStValidationState() };
}

export function hashStContent(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

export interface DeliveryWorkflow {
  readonly id: string;
  readonly title: string;
  readonly stages: WorkflowStage[];
  readonly visibleToolNames?: readonly string[];
  readonly parallelToolCalls: boolean;
  readonly validationInputMode?: "inline_code" | "path_or_code";
  readonly requiredActionTool?: string;
  initialTool(options: { isResume: boolean }): string | undefined;
  instructions(): string;
  recordSuccessfulValidation?(content: string, hash: string): void;
  canWriteContent?(content: string): boolean;
  chooseRepairTool(
    gate: Exclude<CompletionGateResult, { passed: true }>,
    records: WorkflowToolRecord[],
    availableToolNames: Set<string>,
  ): string | undefined;
  authoritativeMessage(records: WorkflowToolRecord[]): string | undefined;
  hydrate(records: WorkflowToolRecord[]): void;
  verifyRequiredAction(call: WorkflowToolRecord): Artifact | undefined;
}

export function createDeliveryWorkflow(
  contract: DeliveryContract | undefined,
  state: DeliveryWorkflowRuntimeState,
): DeliveryWorkflow | undefined {
  if (isStWorkspaceDeliveryContract(contract)) {
    return new StWorkspaceDeliveryWorkflow(contract, state.stValidation);
  }
  return undefined;
}

export function describeDeliveryWorkflow(
  contract: DeliveryContract | undefined,
): DeliveryWorkflowDescriptor | undefined {
  const workflow = createDeliveryWorkflow(
    contract,
    createDeliveryWorkflowRuntimeState(),
  );
  if (!workflow) return undefined;
  return {
    id: workflow.id,
    title: workflow.title,
    stages: workflow.stages
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

export class StWorkspaceDeliveryWorkflow implements DeliveryWorkflow {
  readonly id = "st_workspace_delivery";
  readonly title = "ST 代码交付";

  readonly stages: WorkflowStage[] = [
    {
      order: 1,
      id: "validate_draft",
      toolName: "validate_st_code",
      title: "校验 ST 草稿",
      description: "校验内存中的完整 ST 草稿",
      successEvidence: "validate_st_code 返回 errorCount=0，并记录源码哈希",
      onFailure: "revise_draft",
    },
    {
      order: 2,
      id: "persist_final_st",
      toolName: "write_file",
      title: "写入 ST 文件",
      description: "把通过校验的同一份 ST 源码写入工作区",
      successEvidence: "write_file 返回的 contentHash 与校验哈希一致",
      onFailure: "retry",
    },
  ];

  readonly visibleToolNames = ["validate_st_code", "write_file"] as const;
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
      "校验失败时只根据诊断修改草稿并再次校验；errorCount=0 之前禁止写文件。" +
      "校验成功后运行时锁定这份源码，下一步只能单独调用 write_file，" +
      "且 content 必须与刚通过校验的源码完全一致。" +
      "不要调用 path 校验、read_file、export_st_program 或 run_command，不要并行调用工具。";
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
      if (record.name !== "validate_st_code" || !record.result.ok) continue;
      const data = resultData(record.result);
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
    if (record.name !== "validate_st_code" || !record.result.ok) continue;
    const data = resultData(record.result);
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
  if (!validationHashes.size) return false;
  return records.some((record) => {
    if (record.name !== "write_file" || !record.result.ok) return false;
    const data = resultData(record.result);
    return typeof data.file === "string" &&
      data.file.toLowerCase().endsWith(".st") &&
      typeof data.contentHash === "string" &&
      validationHashes.has(data.contentHash);
  });
}
