import path from "node:path";
import type { Artifact, ToolResult } from "../../../protocol/results";
import type {
  CompletionGateIssue,
  CompletionGateResult,
  CompletionGateWorkflowContext,
} from "../../completionTypes";
import {
  ST_WORKSPACE_DELIVERY_PIPELINE_PLAN,
  ST_WORKSPACE_DELIVERY_STAGES,
} from "./stWorkspaceDeliveryPlan";
import { hashStContent } from "./stContentHash";
import {
  getStValidationRuntimeService,
  StValidationRuntimeService,
  type StValidationInputMode,
  type StValidationState,
} from "./stValidationRuntimeService";
export {
  createStValidationState,
  getStValidationState,
  ST_TOOL_STATE_SERVICE,
  ST_VALIDATION_RUNTIME_SERVICE,
  identifyStDraft,
  identifyStDeclarations,
  identifyStUnits,
  type StDraftIdentity,
  type StDeclaration,
  type StUnit,
  type StValidationCandidate,
  type StValidationCandidateSource,
  type StValidatedDraft,
  type StValidationInputMode,
  type StValidationState,
} from "./stValidationRuntimeService";
import type {
  WorkflowCompletionAdapter,
  WorkflowContract,
  WorkflowDecisionContext,
  WorkflowDescription,
  WorkflowDescriptor,
  WorkflowLocalMatch,
  WorkflowRuntime,
  WorkflowToolRecord,
} from "../../workflow/types";
import {
  createStCodeDeliveryContract,
  inferStDeliveryContractFromUserText,
  isStCodeDeliveryContract,
  isStWorkspaceDeliveryContract,
} from "./stDeliveryContract";
import { ST_TOOL_EVIDENCE_EXTRACTORS } from "./stCompletionEvidence";

export const ST_WORKSPACE_DELIVERY_PRIMARY_TOOL_NAMES = [
  "validate_st_code",
  "write_file",
  "commit_st_delivery",
] as const;

export const ST_WORKSPACE_DELIVERY_AUXILIARY_TOOL_NAMES = [
  "st_dependency_map",
  "st_change_impact",
  "st_symbol_references",
  "st_library_symbol",
] as const;

export const ST_WORKSPACE_DELIVERY_TOOL_NAMES = [
  ...ST_WORKSPACE_DELIVERY_PRIMARY_TOOL_NAMES,
  ...ST_WORKSPACE_DELIVERY_AUXILIARY_TOOL_NAMES,
] as const;

function describeStWorkspaceDelivery(): WorkflowDescription {
  return {
    id: ST_WORKSPACE_DELIVERY_PIPELINE_PLAN.id,
    title: "ST 代码交付",
    stages: ST_WORKSPACE_DELIVERY_STAGES.slice()
      .sort((a, b) => a.order - b.order)
      .map(
        ({
          order,
          id,
          toolName,
          title,
          description,
          successEvidence,
          onFailure,
        }) => ({
          order,
          id,
          ...(toolName ? { toolName } : {}),
          title,
          description,
          successEvidence,
          onFailure,
        }),
      ),
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
  businessToolNames: ST_WORKSPACE_DELIVERY_TOOL_NAMES,
  pipelinePlan: ST_WORKSPACE_DELIVERY_PIPELINE_PLAN,
  describe: describeStWorkspaceDelivery,
  matchesContract: isStWorkspaceDeliveryContract,
  createContract: (options = {}) =>
    createStCodeDeliveryContract({
      reason:
        options.reason ??
        "识别为 ST 代码交付，运行时按固定流水线校验并保存到当前工作区",
      workspacePersistence: "required",
    }),
  localMatch: stWorkspaceDeliveryLocalMatch,
  createRuntime: (contract, state) =>
    isStWorkspaceDeliveryContract(contract)
      ? new StWorkspaceDeliveryWorkflow(
          contract,
          getStValidationRuntimeService(state),
        )
      : undefined,
};

export class StWorkspaceDeliveryWorkflow implements WorkflowRuntime {
  readonly id = ST_WORKSPACE_DELIVERY_WORKFLOW.id;
  readonly title = ST_WORKSPACE_DELIVERY_WORKFLOW.title;

  readonly stages = ST_WORKSPACE_DELIVERY_STAGES;
  readonly pipelinePlan = ST_WORKSPACE_DELIVERY_PIPELINE_PLAN;

  readonly businessToolNames = ST_WORKSPACE_DELIVERY_TOOL_NAMES;
  readonly parallelToolCalls = false;
  readonly requiredActionTool = "commit_st_delivery";
  readonly services: ReadonlyMap<string, unknown>;
  readonly evidenceExtractors = ST_TOOL_EVIDENCE_EXTRACTORS;
  readonly completionAdapter: WorkflowCompletionAdapter;

  /** @deprecated Use businessToolNames. */
  get visibleToolNames(): readonly string[] {
    return this.businessToolNames;
  }

  get validationInputMode(): StValidationInputMode {
    return this.validationService.validationInputMode;
  }

  constructor(
    private readonly contract: WorkflowContract | undefined,
    validation: StValidationState | StValidationRuntimeService,
  ) {
    this.validationService =
      validation instanceof StValidationRuntimeService
        ? validation
        : new StValidationRuntimeService(validation);
    this.state = this.validationService.state;
    this.services = new Map<string, unknown>([
      ["st.validationState", this.state],
      ["st.validationRuntime", this.validationService],
    ]);
    this.completionAdapter = {
      selectRepairTool: (gate, records, availableToolNames) =>
        this.selectRepairTool(gate, records, availableToolNames),
      collectArtifacts: (records) => this.collectArtifacts(records),
      resolveIssue: (issue, context) => this.resolveIssue(issue, context),
      hasSuccessfulVerification: (toolName, context) =>
        this.hasSuccessfulVerification(toolName, context),
      finalMessage: (records) => this.finalMessage(records),
      restore: (records) => this.restore(records),
      collectActionArtifact: (call) => this.collectActionArtifact(call),
    };
  }

  readonly state: StValidationState;
  readonly validationService: StValidationRuntimeService;

  initialTool(_options: { isResume: boolean }): string | undefined {
    return undefined;
  }

  instructions(): string {
    return (
      "\n本轮 .st 工作区交付由运行时按固定流水线执行：" +
      "主交付链路是 validate_st_code -> write_file -> commit_st_delivery。" +
      "编写草稿前最多做少量必要查询；如不确定标准库功能块/函数/类型的接口，可调用 st_library_symbol。" +
      "只有当用户明确要求分析现有工作区关系、或 validate_st_code 诊断指向未知工作区符号时，才调用 st_dependency_map、st_change_impact、st_symbol_references。" +
      "这些查询工具只作为只读辅助证据，不能替代校验或写入阶段。" +
      "一旦调用过 validate_st_code 且未通过，必须立刻修改内存中的完整草稿并再次调用 validate_st_code；不要继续查询无关辅助工具。" +
      "严格禁止臆造外部/标准库功能块、函数或类型；凡是用户没有提供定义、工作区符号查询没有确认、且不属于你刚刚从 st_library_symbol 命中的标准库符号，都不得生成。" +
      "使用标准库符号时，必须按 st_library_symbol 返回的 inputs/outputs/usage 精确填写输入输出参数名、方向和类型；matchCount=0 或查询不可用时，不得用同名符号硬写代码，应改用已确认的工作区符号或向用户说明缺少库定义。" +
      "如果 validate_st_code 对未知可调用对象、参数名或类型给出诊断，必须优先用 st_library_symbol 或 st_symbol_references 核对后再修改草稿。" +
      "形成完整草稿后，调用 validate_st_code 的 code 参数校验完整内存草稿；" +
      "code 必须是完整 ST 源码，不要传文件路径、工具错误回执、JSON 包装或摘要。" +
      "校验失败时只根据诊断修改草稿并再次校验；errorCount=0 之前禁止写文件。" +
      "校验失败后的修正版必须继续围绕首轮草稿的 PROGRAM 名称工作；不要为了试验语法生成 Probe、Demo 等无关临时程序。" +
      "校验成功后运行时锁定这份源码，下一步只能单独调用 write_file，" +
      "且 content 必须与刚通过校验的源码完全一致。" +
      "write_file 成功后必须调用 commit_st_delivery，提交成功写入的 .st 路径和 contentHash，" +
      "只有 commit_st_delivery 返回 deliveryCommit 才算本轮正式交付完成。" +
      "不要并行调用工具，也不要调用当前 workflow 未暴露的工具。"
    );
  }

  private selectRepairTool(
    _gate: Exclude<CompletionGateResult, { passed: true }>,
    records: WorkflowToolRecord[],
    availableToolNames: Set<string>,
  ): string | undefined {
    if (
      !availableToolNames.has("validate_st_code") ||
      !availableToolNames.has("write_file") ||
      !availableToolNames.has("commit_st_delivery")
    ) {
      return undefined;
    }
    if (!hasSuccessfulStValidation(records, this.validationService)) {
      return "validate_st_code";
    }
    if (!hasValidatedStWrite(records, Number.NEGATIVE_INFINITY, this.validationService)) {
      return "write_file";
    }
    if (!hasStDeliveryCommit(records, this.validationService)) {
      return "commit_st_delivery";
    }
    return undefined;
  }

  private collectArtifacts(records: WorkflowToolRecord[]): Artifact[] {
    return records
      .map((record) => this.collectActionArtifact(record))
      .filter((artifact): artifact is Artifact => artifact !== undefined);
  }

  private resolveIssue(
    issue: CompletionGateIssue,
    context: CompletionGateWorkflowContext,
  ): boolean | undefined {
    if (!isStCodeDeliveryContract(context.deliveryContract)) return undefined;
    const laterRecords = context.records.filter(
      (record) => (record.order ?? 0) > issue.order,
    );
    if (issue.toolName === "validate_st_code") {
      return laterRecords.some(
        (record) =>
          hasSuccessfulStValidationRecord(record, this.validationService) ||
          hasSuccessfulStPreWriteValidation(record, this.validationService),
      );
    }
    if (issue.toolName === "write_file") {
      return hasValidatedStWrite(
        context.records,
        issue.order,
        this.validationService,
      );
    }
    if (issue.toolName === "export_st_program") {
      return hasValidatedStExport(
        context.records,
        issue.order,
        this.validationService,
      );
    }
    if (issue.toolName === "delivery_verification") {
      return hasStDeliveryCommit(
        context.records,
        this.validationService,
      );
    }
    return undefined;
  }

  private hasSuccessfulVerification(
    toolName: string,
    context: CompletionGateWorkflowContext,
  ): boolean | undefined {
    if (toolName !== "validate_st_code") return undefined;
    return context.records.some(
      (record) =>
        hasSuccessfulStValidationRecord(record, this.validationService) ||
        hasSuccessfulStPreWriteValidation(record, this.validationService),
    );
  }

  private finalMessage(records: WorkflowToolRecord[]): string | undefined {
    if (!isStCodeDeliveryContract(this.contract)) return undefined;
    const commit = this.validationService.getDeliveryCommits().at(-1);
    if (!commit || !hasStDeliveryCommit(records, this.validationService)) {
      return undefined;
    }
    return `已完成正式交付：${commit.path}；已确认内容通过 ST 校验并成功写入（commit=${commit.commitId}）。`;
  }

  private restore(records: WorkflowToolRecord[]): void {
    this.validationService.restore(records);
  }

  private collectActionArtifact(
    call: WorkflowToolRecord,
  ): Artifact | undefined {
    if (call.name === "commit_st_delivery" && call.result.ok) {
      const data = resultData(call.result);
      const rawCommit = data.deliveryCommit;
      if (
        !rawCommit ||
        typeof rawCommit !== "object" ||
        Array.isArray(rawCommit)
      ) {
        return undefined;
      }
      const commit = rawCommit as Record<string, unknown>;
      const file = typeof commit.path === "string" ? commit.path : undefined;
      const contentHash =
        typeof commit.contentHash === "string" ? commit.contentHash : undefined;
      if (
        !file ||
        !contentHash ||
        !file.toLowerCase().endsWith(".st") ||
        !this.validationService.hasDeliveryCommit(file, contentHash)
      ) {
        return undefined;
      }
      const persisted = this.validationService
        .getPersistedWrites()
        .find((write) =>
          write.contentHash === contentHash &&
          write.path.toLowerCase() === file.toLowerCase(),
        );
      return {
        kind: "file",
        name: path.basename(file),
        uri: file,
        mimeType: "text/plain",
        metadata: {
          contentHash,
          commitId: typeof commit.commitId === "string" ? commit.commitId : undefined,
          declarations: persisted?.declarations ?? [],
        },
      };
    }
    return undefined;
  }
}

function parseArgs(args: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function resultData(result: ToolResult): Record<string, unknown> {
  return result.data &&
    typeof result.data === "object" &&
    !Array.isArray(result.data)
    ? (result.data as Record<string, unknown>)
    : {};
}

function successfulStValidationHashes(
  records: WorkflowToolRecord[],
  validationService?: StValidationRuntimeService,
): Set<string> {
  const validationHashes = new Set<string>();
  for (const record of records) {
    if (!record.result.ok) continue;
    const data = resultData(record.result);
    if (record.name === "write_file") {
      const content = parseArgs(record.args).content;
      if (
        validationService &&
        typeof content === "string" &&
        !validationService.checkDraftIdentity(content).accepted
      ) {
        continue;
      }
      const hash = preWriteValidationHash(data);
      if (hash) validationHashes.add(hash);
      continue;
    }
    if (record.name !== "validate_st_code") continue;
    const code = parseArgs(record.args).code;
    if (
      validationService &&
      typeof code === "string" &&
      !validationService.checkDraftIdentity(code).accepted
    ) {
      continue;
    }
    if (data.errorCount !== 0) continue;
    const target = data.validationTarget;
    const targetHash =
      target && typeof target === "object" && !Array.isArray(target)
        ? (target as Record<string, unknown>).contentHash
        : undefined;
    const hash =
      typeof data.validatedContentHash === "string"
        ? data.validatedContentHash
        : typeof targetHash === "string"
          ? targetHash
          : undefined;
    if (hash) validationHashes.add(hash);
  }
  return validationHashes;
}

function hasSuccessfulStValidation(
  records: WorkflowToolRecord[],
  validationService?: StValidationRuntimeService,
): boolean {
  return successfulStValidationHashes(records, validationService).size > 0;
}

function hasSuccessfulStValidationRecord(
  record: WorkflowToolRecord,
  validationService?: StValidationRuntimeService,
): boolean {
  if (record.name !== "validate_st_code" || !record.result.ok) return false;
  const code = parseArgs(record.args).code;
  if (
    validationService &&
    typeof code === "string" &&
    !validationService.checkDraftIdentity(code).accepted
  ) {
    return false;
  }
  return resultData(record.result).errorCount === 0;
}

function hasSuccessfulStPreWriteValidation(
  record: WorkflowToolRecord,
  validationService?: StValidationRuntimeService,
): boolean {
  if (record.name !== "write_file" || !record.result.ok) return false;
  const content = parseArgs(record.args).content;
  if (
    validationService &&
    typeof content === "string" &&
    !validationService.checkDraftIdentity(content).accepted
  ) {
    return false;
  }
  const data = resultData(record.result);
  const preWriteHash = preWriteValidationHash(data);
  return (
    typeof data.contentHash === "string" && preWriteHash === data.contentHash
  );
}

function hasValidatedStExport(
  records: WorkflowToolRecord[],
  afterOrder = Number.NEGATIVE_INFINITY,
  validationService?: StValidationRuntimeService,
): boolean {
  const validationHashes = new Set<string>();
  const ordered = records
    .map((record, index) => ({ ...record, order: record.order ?? index + 1 }))
    .sort((a, b) => a.order - b.order);
  for (const record of ordered) {
    const validatedHash = successfulValidationHashForRecord(
      record,
      validationService,
    );
    if (validatedHash) validationHashes.add(validatedHash);
    if (
      record.order <= afterOrder ||
      record.name !== "export_st_program" ||
      !record.result.ok
    ) {
      continue;
    }
    const data = resultData(record.result);
    const args = parseArgs(record.args);
    const code = typeof args.code === "string" ? args.code : undefined;
    if (
      validationService &&
      typeof code === "string" &&
      !validationService.checkDraftIdentity(code).accepted
    ) {
      continue;
    }
    const file = typeof data.file === "string" ? data.file : undefined;
    const hash =
      typeof data.contentHash === "string"
        ? data.contentHash
        : code
          ? hashStContent(code)
          : undefined;
    if (
      file?.toLowerCase().endsWith(".st") &&
      hash &&
      validationHashes.has(hash)
    ) {
      return true;
    }
  }
  return false;
}

function hasValidatedStWrite(
  records: WorkflowToolRecord[],
  afterOrder = Number.NEGATIVE_INFINITY,
  validationService?: StValidationRuntimeService,
): boolean {
  const validationHashes = new Set<string>();
  const ordered = records
    .map((record, index) => ({ ...record, order: record.order ?? index + 1 }))
    .sort((a, b) => a.order - b.order);
  for (const record of ordered) {
    const validatedHash = successfulValidationHashForRecord(
      record,
      validationService,
    );
    if (validatedHash) validationHashes.add(validatedHash);
    if (
      record.order <= afterOrder ||
      record.name !== "write_file" ||
      !record.result.ok
    ) {
      continue;
    }
    const data = resultData(record.result);
    const content = parseArgs(record.args).content;
    if (
      validationService &&
      typeof content === "string" &&
      !validationService.checkDraftIdentity(content).accepted
    ) {
      continue;
    }
    if (
      typeof data.file === "string" &&
      data.file.toLowerCase().endsWith(".st") &&
      typeof data.contentHash === "string" &&
      validationHashes.has(data.contentHash)
    ) {
      return true;
    }
  }
  return false;
}

function hasStDeliveryCommit(
  records: WorkflowToolRecord[],
  validationService?: StValidationRuntimeService,
): boolean {
  if (!validationService) return false;
  return records.some((record) => {
    if (record.name !== "commit_st_delivery" || !record.result.ok) return false;
    const data = resultData(record.result);
    const commit = data.deliveryCommit;
    if (!commit || typeof commit !== "object" || Array.isArray(commit)) {
      return false;
    }
    const value = commit as Record<string, unknown>;
    const path = typeof value.path === "string" ? value.path : undefined;
    const contentHash =
      typeof value.contentHash === "string" ? value.contentHash : undefined;
    return !!path &&
      !!contentHash &&
      validationService.hasDeliveryCommit(path, contentHash);
  });
}

function successfulValidationHashForRecord(
  record: WorkflowToolRecord,
  validationService?: StValidationRuntimeService,
): string | undefined {
  if (!record.result.ok) return undefined;
  const data = resultData(record.result);
  if (record.name === "validate_st_code" && data.errorCount === 0) {
    const code = parseArgs(record.args).code;
    if (
      validationService &&
      typeof code === "string" &&
      !validationService.checkDraftIdentity(code).accepted
    ) {
      return undefined;
    }
    const target = data.validationTarget;
    const targetHash =
      target && typeof target === "object" && !Array.isArray(target)
        ? (target as Record<string, unknown>).contentHash
        : undefined;
    return typeof data.validatedContentHash === "string"
      ? data.validatedContentHash
      : typeof targetHash === "string"
        ? targetHash
        : undefined;
  }
  if (record.name === "write_file") {
    const content = parseArgs(record.args).content;
    if (
      validationService &&
      typeof content === "string" &&
      !validationService.checkDraftIdentity(content).accepted
    ) {
      return undefined;
    }
    const preWriteHash = preWriteValidationHash(data);
    if (
      typeof data.contentHash === "string" &&
      preWriteHash === data.contentHash
    ) {
      return preWriteHash;
    }
  }
  return undefined;
}

function preWriteValidationHash(
  data: Record<string, unknown>,
): string | undefined {
  const preWrite = data.preWriteValidation;
  if (!preWrite || typeof preWrite !== "object" || Array.isArray(preWrite))
    return undefined;
  const value = preWrite as Record<string, unknown>;
  if (value.errorCount !== 0) return undefined;
  return typeof value.validatedContentHash === "string"
    ? value.validatedContentHash
    : undefined;
}
