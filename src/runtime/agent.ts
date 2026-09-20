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
  tool,
  OpenAIChatCompletionsModel,
  MaxTurnsExceededError,
  RunState,
  defineToolInputGuardrail,
  ToolGuardrailFunctionOutputFactory,
  type RunToolApprovalItem,
  type AgentInputItem,
  type Session,
  type StreamedRunResult,
  type AgentOutputType,
} from "@openai/agents";
import { z } from "zod";
import OpenAI from "openai";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  listFiles,
  readFileRange,
  writeFileText,
  searchText,
  runCommand,
} from "../tools/workspaceTools";
import { EffectRecoveryRequiredError } from "./errors";
import {
  DefaultToolPolicy,
  type ToolPolicy,
  type ToolPolicyOverrides,
  toolResult,
  type ToolRisk,
} from "../tools/toolContract";
import { DefaultActionPolicy, type ActionPolicy } from "../policy/actionPolicy";
import type { RequiredAgentTool } from "../policy/actionPolicy";
import {
  WorkspaceScope,
  workspaceScopeFromRoots,
} from "../workspace/workspaceScope";
import { MockPlcAdapter, type PlcAdapter } from "../plc/plcAdapter";
import { FallbackStAnalyzer } from "../analysis/fallbackStAnalyzer";
import { collectWorkspaceStContext } from "../analysis/workspaceStContext";
import {
  countStDiagnostics,
  isStValidationFailure,
  toProtocolDiagnostics,
  type StAnalyzer,
  type StAnalyzerToolOptions,
  type StDiagnostic,
  type StTarget,
} from "../analysis/stAnalyzer";
import type { AuditEvent } from "../observability/audit";
import {
  createIndustrialAgentTeam,
  type IndustrialAgentMode,
} from "../orchestration/agentRoles";
import {
  createToolResult,
  createAgentResult,
  type AgentResult,
  type ApprovalRequest as ProtocolApprovalRequest,
  type Artifact,
  type ToolResult,
  type UsageSummary,
  parseToolResult,
} from "../protocol/results";
import { AgentStreamAdapter } from "./streaming";
import type { AgentEventFactory, AgentProtocolEvent } from "../protocol/events";
import {
  industrialAgentOutputDefinition,
  industrialFinalArtifactOutputSchema,
  type IndustrialAgentOutput,
  projectAgentOutput,
  AgentOutputValidationError,
} from "./output";
import {
  createModelAdapter,
  type AgentApiFormat,
  type AgentProvider,
  type ModelAdapter,
} from "./modelAdapter";
import {
  createTaskPlan,
  renderTaskPlan,
  taskPlanDecisionSchema,
  type TaskPlan,
  type TaskPlanProgress,
  updateTaskPlan,
} from "./taskPlan";
import {
  createTeamTask,
  teamPlannerReportSchema,
  teamReviewReportSchema,
  teamRouteDecisionSchema,
  teamVerificationReportSchema,
  type TeamTask,
  type TeamPlannerReport,
  type TeamReviewReport,
  type TeamVerificationReport,
} from "../orchestration/teamTask";
import {
  evaluateCompletionGate,
  type CompletionGateResult,
} from "./completionGate";
import {
  createDeliveryContract,
  deliveryContractDecisionSchema,
  inferDeliveryContractFromUserText,
  renderDeliveryContract,
  type DeliveryContract,
} from "./deliveryContract";
import {
  createDeliveryWorkflow,
  createDeliveryWorkflowRuntimeState,
  createStValidationState,
  hashStContent,
  type DeliveryWorkflow,
  type StValidationState,
} from "./deliveryWorkflow";
import {
  compressDiagnostics,
  repairPacketToProtocolDiagnostics,
  type DiagnosticRepairPacket,
} from "./diagnosticCompression";

export { inferRequiredTool } from "../policy/actionPolicy";
export type { RequiredAgentTool } from "../policy/actionPolicy";

// 超轮次异常透传给 UI 层做友好提示
export { MaxTurnsExceededError };

const TOOL_RISK_BY_NAME: Record<string, ToolRisk> = {
  get_io_table: "read",
  read_plc_variables: "read",
  validate_st_code: "plan",
  deliver_artifact: "plan",
  list_files: "read",
  read_file: "read",
  search_files: "read",
  export_st_program: "write",
  write_file: "write",
  run_command: "execute",
};

export interface AgentConfig {
  /** OpenAI 兼容网关地址(带 /v1),空 = 官方 API */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Provider identity. The first supported provider is OpenAI. */
  provider?: AgentProvider;
  /** Explicit API wire format; omitted/auto preserves the historical route. */
  apiFormat?: AgentApiFormat | "auto";
  /** export_st_program 工具的落盘目录 */
  exportDir: string;
  /** 当前工作区根目录(文件类工具的作用域边界),空 = 未打开工作区 */
  workspaceRoot: string;
  /** Host-authorized workspace roots. Relative paths use workspaceRoot. */
  workspaceRoots?: string[];
  /** Host-owned effect journal. It may return a previously committed result. */
  executeEffect?: <T>(
    toolName: string,
    input: unknown,
    execute: () => Promise<T>,
  ) => Promise<T>;
  /** Policy is host-owned and must be enforced before side effects. */
  policy?: ToolPolicy;
  policyContext?: ToolPolicyOverrides;
  plcAdapter?: PlcAdapter;
  /**
   * ST 校验端口。宿主注入;缺省用内置简易校验,
   * 这样内核脱离宿主(CLI/边缘/单测)仍然可运行。
   */
  stAnalyzer?: StAnalyzer;
  stAnalyzerOptions?: StAnalyzerToolOptions;
  audit?: (event: Omit<AuditEvent, "id" | "timestamp">) => void | Promise<void>;
  orchestration?: IndustrialAgentMode;
  actionPolicy?: ActionPolicy;
}

/** UI 关心的事件:正文增量 / 工具调用提示 / 工具执行结果 */
/**
 * 需要用户批准的工具被调用时,内核通过它向 UI 请求决定(宿主实现:发审批卡片,等点击)。
 */
export type ApprovalRequest = ProtocolApprovalRequest;

export type AgentRunStatus =
  | "completed"
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

// ---------- 工具(策略/审计/设备适配器由宿主注入,工具合同保持稳定) ----------

type ToolEffect = "none" | "filesystem" | "process" | "device";

interface DiagnosticSideReport {
  toolName: string;
  phase: string;
  summary: string;
  counts: {
    error: number;
    warning: number;
    info: number;
  };
  validationTarget: {
    path: string;
    complete: boolean;
    totalLines: number;
    totalBytes: number;
    contentHash: string;
  };
  diagnostics: StDiagnostic[];
  repairPacket?: DiagnosticRepairPacket;
}

type DiagnosticSideReporter = (report: DiagnosticSideReport) => void;

function toolArguments(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
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

function audit(
  cfg: AgentConfig,
  event: Omit<AuditEvent, "id" | "timestamp">,
): void {
  void Promise.resolve(cfg.audit?.(event)).catch(() => undefined);
}

function buildToolGuardrails(cfg: AgentConfig, policy: ToolPolicy) {
  const context = {
    workspaceRoot: cfg.workspaceRoot,
    workspaceRoots: cfg.workspaceRoots,
    ...cfg.policyContext,
  };
  const input = defineToolInputGuardrail({
    name: "industrial-tool-policy",
    run: async ({ toolCall }) => {
      const call = toolCall as { name?: string; arguments?: string };
      const name = call.name ?? "unknown_tool";
      const decision = policy.evaluate(
        name,
        toolArguments(call.arguments),
        context,
      );
      audit(cfg, {
        type: "guardrail_evaluated",
        toolName: name,
        risk: decision.risk,
        decision: decision.allowed ? "allow" : "deny",
        metadata: {
          requiresApproval: decision.requiresApproval,
          reason: decision.reason,
        },
      });
      return decision.allowed
        ? ToolGuardrailFunctionOutputFactory.allow(decision)
        : ToolGuardrailFunctionOutputFactory.rejectContent(
            decision.reason ?? "工具调用被工控安全策略拒绝。",
            decision,
          );
    },
  });
  // toolResult() validates and serializes every local result at construction
  // time. Do not parse it again here after the SDK has normalized it into
  // provider text parts; that second parse rejects valid SDK output shapes.
  return { input: [input], output: [] };
}

/**
 * 宽容整数参数 schema。
 * 背景:兼容网关模型常把整数写成字符串("1000"),或用 "None"/null 表示"未提供"。
 * z.coerce.number() 会把 "None" 转成 NaN,而 zod 拒绝 NaN,SDK 校验层直接抛
 * InvalidToolInputError(execute 根本不会被调用)。所以 schema 用并集放行这些形态,
 * 真正的解析统一放在 execute(parseOptionalInt)。
 */
const optionalIntParam = z.union([z.number(), z.string(), z.null()]).optional();
const optionalStringParam = z.union([z.string(), z.null()]).optional();
const optionalBooleanParam = z.union([z.boolean(), z.string(), z.null()]).optional();

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? value : undefined;
}

function parseOptionalInt(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    // 只接受纯数字字符串;"None"/"null"/空串等一律视为未提供
    return /^\d+$/.test(trimmed) && Number(trimmed) > 0
      ? Number(trimmed)
      : undefined;
  }
  return undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "none" || normalized === "null" || normalized === "undefined") {
      return undefined;
    }
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return undefined;
}

export function commandToolResult(
  command: string,
  result: { exitCode: number | null; output: string },
): string {
  if (result.exitCode === 0) {
    return toolResult({
      ok: true,
      data: result,
      effect: "process",
      risk: "execute",
    });
  }
  const isTimeout = result.exitCode === null;
  const message = isTimeout
    ? "命令超时或被终止，未取得成功退出码。"
    : `命令执行失败，退出码 ${result.exitCode}。`;
  return toolResult({
    ok: false,
    data: result,
    error: message,
    diagnostics: [
      {
        code: isTimeout ? "command_timeout" : "command_nonzero_exit",
        message,
        severity: "error",
        details: { command, exitCode: result.exitCode },
      },
    ],
    effect: "process",
    risk: "execute",
    metadata: { exitCode: result.exitCode },
  });
}

function sessionOutputText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const text = value
      .map((item) => sessionOutputText(item))
      .filter((item): item is string => Boolean(item))
      .join("");
    return text || undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if ("output" in record) return sessionOutputText(record.output);
    if ("content" in record) return sessionOutputText(record.content);
  }
  return undefined;
}

async function loadValidatedStContent(
  session: Session,
  userText: string,
): Promise<Set<string>> {
  const validated = new Set<string>();
  const calls = new Map<string, { name: string }>();
  let items: AgentInputItem[] = [];
  try {
    items = await session.getItems();
  } catch {
    return validated;
  }
  const startIndex = [...items]
    .map((item, index) => ({ item, index }))
    .reverse()
    .find(({ item }) => {
      const value = item as { type?: string; role?: string; content?: unknown };
      return value.type === "message" &&
        value.role === "user" &&
        typeof value.content === "string" &&
        value.content === userText;
    })?.index ?? 0;
  for (const raw of items.slice(startIndex)) {
    const item = raw as {
      type?: string;
      callId?: string;
      name?: string;
      output?: unknown;
    };
    if (item.type === "function_call" && item.callId && item.name) {
      calls.set(item.callId, { name: item.name });
      continue;
    }
    if (
      item.type !== "function_call_result" &&
      item.type !== "function_call_output"
    ) {
      continue;
    }
    const call = item.callId ? calls.get(item.callId) : undefined;
    if (call?.name !== "validate_st_code") continue;
    const text = sessionOutputText(item.output);
    if (!text) continue;
    try {
      const result = JSON.parse(text) as {
        ok?: unknown;
        data?: { errorCount?: unknown; validatedContentHash?: unknown };
      };
      if (
        result.ok === true &&
        result.data?.errorCount === 0 &&
        typeof result.data.validatedContentHash === "string"
      ) {
        validated.add(result.data.validatedContentHash);
      }
    } catch {
      // Ignore non-protocol historical tool output.
    }
  }
  return validated;
}

async function loadHistoricalToolResults(
  session: Session,
  userText: string,
): Promise<Array<{ name: string; args: string; result: ToolResult; order: number }>> {
  const calls = new Map<string, { name: string; args: string }>();
  const records: Array<{ name: string; args: string; result: ToolResult; order: number }> = [];
  let items: AgentInputItem[] = [];
  try {
    items = await session.getItems();
  } catch {
    return records;
  }
  const startIndex = [...items]
    .map((item, index) => ({ item, index }))
    .reverse()
    .find(({ item }) => {
      const value = item as { type?: string; role?: string; content?: unknown };
      return value.type === "message" &&
        value.role === "user" &&
        typeof value.content === "string" &&
        value.content === userText;
    })?.index ?? 0;
  let order = 0;
  for (const raw of items.slice(startIndex)) {
    const item = raw as {
      type?: string;
      callId?: string;
      name?: string;
      arguments?: string;
      output?: unknown;
    };
    if (item.type === "function_call" && item.callId && item.name) {
      calls.set(item.callId, {
        name: item.name,
        args: typeof item.arguments === "string" ? item.arguments : "",
      });
      continue;
    }
    if (
      item.type !== "function_call_result" &&
      item.type !== "function_call_output"
    ) {
      continue;
    }
    const call = item.callId ? calls.get(item.callId) : undefined;
    const text = sessionOutputText(item.output);
    if (!call || !text) continue;
    try {
      records.push({
        ...call,
        result: parseToolResult(JSON.parse(text)),
        order: ++order,
      });
    } catch {
      // Ignore non-protocol historical tool output.
    }
  }
  return records;
}

function buildTools(
  cfg: AgentConfig,
  deliveryContract?: DeliveryContract,
  deliveryWorkflow?: DeliveryWorkflow,
  stValidationState: StValidationState = createStValidationState(),
  diagnosticReporter?: DiagnosticSideReporter,
) {
  const policy = cfg.policy ?? new DefaultToolPolicy();
  const plc = cfg.plcAdapter ?? new MockPlcAdapter();
  const stAnalyzer = cfg.stAnalyzer ?? new FallbackStAnalyzer();
  const stToolOptions = cfg.stAnalyzerOptions ?? {};
  const requiresStValidation = deliveryContract?.deliverables.some(
    (deliverable) =>
      deliverable.required &&
      deliverable.requiredVerificationTools?.includes("validate_st_code"),
  ) === true;
  const inlineStValidation = deliveryWorkflow?.validationInputMode === "inline_code";
  const workflowToolNames = deliveryWorkflow?.visibleToolNames
    ? new Set(deliveryWorkflow.visibleToolNames)
    : undefined;
  const validatedStContent = stValidationState.hashes;
  /**
   * 解析校验目标与上下文:目标优先用工作区真实文件(跨文件解析最准),
   * 只有裸代码才落到系统临时目录下的虚拟 URI(桥只把它当 URI,不读盘)。
   */
  const resolveStValidationInput = async (
    filePath: string | undefined,
    code: string | undefined,
    loadWorkspaceContext: boolean | undefined,
  ) => {
    if (!filePath && !code) throw new Error("必须提供 code 或 path 之一");
    let target: StTarget;
    let label: string;
    let excludePaths: string[] = [];
    let complete = true;
    let totalLines = code ? code.split(/\r?\n/).length : 0;
    let totalBytes = code ? Buffer.byteLength(code, "utf8") : 0;
    let contentHash = "";
    if (filePath) {
      const resolved = workspace.resolve(filePath);
      // Validation must always use the complete file. read_file intentionally
      // supports bounded/partial reads for large files, but a validator must
      // never silently accept only the first page of a source file.
      const read = await readFileRange(
        resolved.root,
        resolved.relativePath,
        1,
        Number.MAX_SAFE_INTEGER,
      );
      target = { path: resolved.absolutePath, text: read.text };
      label = resolved.relativePath.split(path.sep).join("/");
      excludePaths = [resolved.relativePath];
      complete = read.complete;
      totalLines = read.totalLines;
      totalBytes = read.totalBytes;
      contentHash = read.fileContentHash;
    } else {
      const digest = hashStContent(code!).slice(0, 12);
      target = {
        path: path.join(os.tmpdir(), "plc-agent-st", `${digest}.st`),
        text: code!,
      };
      label = "<inline st code>";
      contentHash = hashStContent(code!);
    }
    const useContext =
      (loadWorkspaceContext ?? stToolOptions.loadWorkspaceContext !== false) &&
      !!workspace.primaryRoot;
    const collected = useContext
      ? await collectWorkspaceStContext(workspace, {
          maxFiles: stToolOptions.maxContextFiles,
          maxFileBytes: stToolOptions.maxFileBytes,
          excludePaths,
        })
      : { files: [] as StTarget[], truncated: false, skipped: 0 };
    return {
      target,
      label,
      context: collected.files,
      contextTruncated: collected.truncated,
      contextSkipped: collected.skipped,
      complete,
      totalLines,
      totalBytes,
      contentHash,
    };
  };
  const workspace = workspaceScopeFromRoots(
    cfg.workspaceRoot,
    cfg.workspaceRoots,
  );
  const guardrails = buildToolGuardrails(cfg, policy);
  const withEffect = <T>(
    toolName: string,
    input: unknown,
    risk: ToolRisk,
    execute: () => Promise<T>,
  ) => {
    audit(cfg, { type: "tool_requested", toolName, risk });
    const run = () => execute();
    return cfg.executeEffect ? cfg.executeEffect(toolName, input, run) : run();
  };
  const contract = <T>(data: T, risk: ToolRisk, effect: ToolEffect = "none") =>
    toolResult({ ok: true, data, effect, risk });
  const failed = (
    error: unknown,
    risk: ToolRisk,
    effect: ToolEffect = "none",
  ) =>
    toolResult({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      effect,
      risk,
    });
  const getIoTable = tool({
    name: "get_io_table",
    description: "查询当前 PLC 项目的 I/O 变量表。",
    parameters: z.object({}),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async () => {
      try {
        return contract(
          { adapter: plc.id, variables: await plc.getIoTable() },
          "read",
        );
      } catch (error) {
        return failed(error, "read");
      }
    },
  });

  const readPlcVariables = tool({
    name: "read_plc_variables",
    description:
      "从已配置的 PLC 适配器读取指定变量的当前值，只读且不改变设备状态。",
    parameters: z.object({
      names: z.array(z.string()).min(1).describe("要读取的 PLC 变量名"),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async ({ names }) => {
      try {
        return contract(
          { adapter: plc.id, variables: await plc.readVariables(names) },
          "read",
        );
      } catch (error) {
        return failed(error, "read");
      }
    },
  });

  const validateStCodeParameters = inlineStValidation
    ? z.object({
        code: z.string().min(1).describe("当前完整 ST 草稿；必须包含完整 PROGRAM ... END_PROGRAM"),
        loadWorkspaceContext: optionalBooleanParam.describe(
          '是否把工作区其它 .st 一起解析；优先传 true/false，兼容 "True"/"False" 字符串',
        ),
      })
    : z.object({
        code: optionalStringParam.describe("完整 ST 源码(PROGRAM ... END_PROGRAM);不使用时可省略或传 null"),
        path: optionalStringParam.describe("工作区内的 .st 文件路径,优先于 code;不使用时可省略或传 null"),
        loadWorkspaceContext: optionalBooleanParam.describe(
          '是否把工作区其它 .st 一起解析(跨文件 GVL/FB 引用需要);优先传 true/false,兼容 "True"/"False" 字符串',
        ),
      });
  const validateStCode = tool({
    name: "validate_st_code",
    description: inlineStValidation
      ? "校验内存中的完整 IEC 61131-3 ST 草稿。当前处于固定交付流水线的草稿阶段，只能传 code；不要传 path，也不要在校验成功前调用 write_file、export_st_program 或 run_command。errorCount=0 才算通过，warning 只作提示。" +
        "校验成功后运行时会锁定这份源码，下一步只能把完全相同的源码交给 write_file。"
      :
      "用 ST 语言服务器(st-analyze)校验 IEC 61131-3 ST 代码,返回带行列号的诊断。" +
      "优先用 path 校验工作区里的真实 .st 文件,只有裸代码才用 code。" +
      "结果里 errorCount=0 才算通过校验;warningCount 只作提示,不阻断交付。" +
      "path 校验始终读取完整文件;返回的 validatedContentHash 是本次实际校验内容的哈希。" +
      "不要因为 read_file 界面里的摘要省略号就重写文件,只有 data.truncated=true 才表示本次读取确实是分段结果。" +
      "该校验器不覆盖全部语义(例如内置 FB 参数类型),不要把它当成可上机运行的证明。",
    parameters: validateStCodeParameters,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: (input, _context, details) =>
      guard(async () => {
        const code = "code" in input ? parseOptionalString(input.code) : undefined;
        const p = "path" in input ? parseOptionalString(input.path) : undefined;
        const loadWorkspaceContext = parseOptionalBoolean(input.loadWorkspaceContext);
        const validationInput = await resolveStValidationInput(
          p,
          code,
          loadWorkspaceContext,
        );
        const result = await stAnalyzer.verify(
          {
            workspaceRoot: workspace.primaryRoot,
            targets: [validationInput.target],
            context: validationInput.context,
            ...(stToolOptions.maxDiagnostics ? { options: { maxDiagnostics: stToolOptions.maxDiagnostics } } : {}),
          },
          { signal: details?.signal },
        );
        const counts = countStDiagnostics(result);
        const diagnostics = (result.results[0]?.diagnostics ?? []).map((diagnostic: StDiagnostic) => ({
          ...diagnostic,
          path: validationInput.label,
        }));
        const validationFailed = isStValidationFailure(result);
        const summary = [
          `引擎=${result.engine.id}`,
          `error=${counts.error}`,
          `warning=${counts.warning}`,
          `上下文文件=${result.contextLoaded}`,
        ].join(" ");
        const validatedHash = hashStContent(validationInput.target.text);
        const repairPacket = validationFailed
          ? compressDiagnostics({
              toolName: "validate_st_code",
              phase: "st_validation",
              instruction:
                "ST 校验失败。只根据这些压缩诊断和代码片段做最小修改；保持无关代码不变，修改后必须再次调用 validate_st_code 校验完整草稿。",
              diagnostics,
              sources: [{
                path: validationInput.label,
                text: validationInput.target.text,
              }],
              sourceHash: validatedHash,
            })
          : undefined;
        const protocolDiagnostics = repairPacket
          ? repairPacketToProtocolDiagnostics(repairPacket)
          : toProtocolDiagnostics(diagnostics);
        if (!validationFailed) {
          validatedStContent.add(validatedHash);
          if (!p) deliveryWorkflow?.recordSuccessfulValidation?.(
            validationInput.target.text,
            validatedHash,
          );
        }
        audit(cfg, {
          type: "tool_completed",
          toolName: "validate_st_code",
          risk: "plan",
          ok: !validationFailed,
          summary,
          metadata: {
            errorCount: counts.error,
            warningCount: counts.warning,
            infoCount: counts.info,
            validationTarget: {
              path: validationInput.label,
              complete: validationInput.complete,
              totalLines: validationInput.totalLines,
              totalBytes: validationInput.totalBytes,
              contentHash: validationInput.contentHash || validatedHash,
            },
            diagnostics,
            ...(repairPacket
              ? {
                  repairPacketSummary: {
                    totalDiagnostics: repairPacket.totalDiagnostics,
                    duplicateCount: repairPacket.duplicateCount,
                    omittedCount: repairPacket.omittedCount,
                    truncated: repairPacket.truncated,
                  },
                }
              : {}),
          },
        });
        if (validationFailed) {
          diagnosticReporter?.({
            toolName: "validate_st_code",
            phase: "st_validation",
            summary,
            counts,
            validationTarget: {
              path: validationInput.label,
              complete: validationInput.complete,
              totalLines: validationInput.totalLines,
              totalBytes: validationInput.totalBytes,
              contentHash: validationInput.contentHash || validatedHash,
            },
            diagnostics,
            ...(repairPacket ? { repairPacket } : {}),
          });
        }
        return toolResult({
          ok: !validationFailed,
          data: {
            engine: result.engine.id,
            errorCount: counts.error,
            warningCount: counts.warning,
            infoCount: counts.info,
            validatedContentHash: validationFailed ? undefined : validatedHash,
            validationTarget: {
              path: validationInput.label,
              complete: validationInput.complete,
              totalLines: validationInput.totalLines,
              totalBytes: validationInput.totalBytes,
              contentHash: validationInput.contentHash || validatedHash,
            },
            diagnostics: repairPacket ? repairPacket.diagnostics : diagnostics,
            ...(repairPacket
              ? {
                  repairPacket,
                  diagnosticCompression: {
                    enabled: true,
                    originalDiagnosticsInAudit: true,
                    totalDiagnostics: repairPacket.totalDiagnostics,
                    duplicateCount: repairPacket.duplicateCount,
                    omittedCount: repairPacket.omittedCount,
                    truncated: repairPacket.truncated,
                  },
                }
              : {}),
            context: {
              files: result.contextLoaded,
              truncated: validationInput.contextTruncated,
              ...(validationInput.contextSkipped ? { skipped: validationInput.contextSkipped } : {}),
            },
            elapsedMs: result.elapsedMs,
            analyzer: {
              ...(result.engine.detail ? { detail: result.engine.detail } : {}),
              ...(result.engine.fallbackReason ? { fallbackReason: result.engine.fallbackReason } : {}),
            },
            summary,
          },
          ...(validationFailed
            ? {
                error: `ST 校验未通过(${counts.error} 个 error);warning 只提示,不阻断。`,
              }
            : {}),
          diagnostics: protocolDiagnostics,
          effect: "none",
          risk: "plan",
        });
      }, "plan"),
  });

  const validateStContentBeforeWrite = async (
    content: string,
    targetLabel: string,
    signal?: AbortSignal,
  ) => {
    const validationInput = await resolveStValidationInput(
      undefined,
      content,
      stToolOptions.loadWorkspaceContext,
    );
    const result = await stAnalyzer.verify(
      {
        workspaceRoot: workspace.primaryRoot,
        targets: [validationInput.target],
        context: validationInput.context,
        ...(stToolOptions.maxDiagnostics ? { options: { maxDiagnostics: stToolOptions.maxDiagnostics } } : {}),
      },
      { signal },
    );
    const counts = countStDiagnostics(result);
    const diagnostics = (result.results[0]?.diagnostics ?? []).map((diagnostic: StDiagnostic) => ({
      ...diagnostic,
      path: targetLabel,
    }));
    const validationFailed = isStValidationFailure(result);
    const contentHash = hashStContent(content);
    const summary = [
      `引擎=${result.engine.id}`,
      `error=${counts.error}`,
      `warning=${counts.warning}`,
      `上下文文件=${result.contextLoaded}`,
    ].join(" ");
    const repairPacket = validationFailed
      ? compressDiagnostics({
          toolName: "write_file",
          phase: "st_pre_write_validation",
          instruction:
            "写入前 ST 校验失败。只根据这些压缩诊断和代码片段做最小修改；修复后必须重新校验并写入同一份完整内容。",
          diagnostics,
          sources: [{ path: targetLabel, text: content }],
          sourceHash: contentHash,
        })
      : undefined;
    if (!validationFailed) {
      validatedStContent.add(contentHash);
      deliveryWorkflow?.recordSuccessfulValidation?.(content, contentHash);
    }
    audit(cfg, {
      type: "tool_completed",
      toolName: "write_file.pre_validate_st_code",
      risk: "plan",
      ok: !validationFailed,
      summary,
      metadata: {
        errorCount: counts.error,
        warningCount: counts.warning,
        infoCount: counts.info,
        validationTarget: {
          path: targetLabel,
          complete: true,
          totalLines: content.split(/\r?\n/).length,
          totalBytes: Buffer.byteLength(content, "utf8"),
          contentHash,
        },
        diagnostics,
        ...(repairPacket
          ? {
              repairPacketSummary: {
                totalDiagnostics: repairPacket.totalDiagnostics,
                duplicateCount: repairPacket.duplicateCount,
                omittedCount: repairPacket.omittedCount,
                truncated: repairPacket.truncated,
              },
            }
          : {}),
      },
    });
    if (validationFailed) {
      diagnosticReporter?.({
        toolName: "write_file",
        phase: "st_pre_write_validation",
        summary,
        counts,
        validationTarget: {
          path: targetLabel,
          complete: true,
          totalLines: content.split(/\r?\n/).length,
          totalBytes: Buffer.byteLength(content, "utf8"),
          contentHash,
        },
        diagnostics,
        ...(repairPacket ? { repairPacket } : {}),
      });
    }
    return {
      ok: !validationFailed,
      contentHash,
      counts,
      diagnostics,
      protocolDiagnostics: repairPacket
        ? repairPacketToProtocolDiagnostics(repairPacket)
        : toProtocolDiagnostics(diagnostics),
      repairPacket,
      summary,
      engine: result.engine,
      elapsedMs: result.elapsedMs,
      contextLoaded: result.contextLoaded,
    };
  };

  // 会往磁盘写文件 → needsApproval:SDK 在真正执行前中断,由 UI 批准/拒绝
  const exportStProgram = tool({
    name: "export_st_program",
    description:
      '把一段完整的 IEC 61131-3 ST 程序导出为 .st 文件保存到本地(用户要求"导出/保存/落地文件"时使用)。',
    parameters: z.object({
      code: z.string().describe("完整 ST 源码(PROGRAM ... END_PROGRAM)"),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ code }) =>
      withEffect("export_st_program", { code }, "write", async () => {
        if (requiresStValidation && !validatedStContent.has(hashStContent(code))) {
          return toolResult({
            ok: false,
            error: "ST 代码在导出前必须先通过 validate_st_code，且必须校验当前这份完整代码。",
            diagnostics: [{
              code: "st_validation_required",
              message: "未找到当前代码对应的 validate_st_code 成功回执(errorCount=0)。",
              severity: "error",
            }],
            effect: "none",
            risk: "plan",
          });
        }
        const m = /PROGRAM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(code);
        const name = m?.[1] ?? `program_${Date.now()}`;
        await fs.mkdir(cfg.exportDir, { recursive: true });
        const file = path.join(cfg.exportDir, `${name}.st`);
        await fs.writeFile(file, code, "utf8");
        return contract({
          file,
          bytes: Buffer.byteLength(code, "utf8"),
          contentHash: hashStContent(code),
        }, "write", "filesystem");
      }),
  });

  // ---- 通用工作区文件工具(作用域锁定在当前工作区根目录) ----
  const guard = (
    fn: () => Promise<string>,
    risk: ToolRisk,
    effect: ToolEffect = "none",
  ): Promise<string> =>
    fn().catch((e: unknown) => {
      if (e instanceof EffectRecoveryRequiredError) throw e;
      return failed(e, risk, effect);
    });

  const listFilesTool = tool({
    name: "list_files",
    description:
      "列出当前工作区内的文件(相对根目录,自动跳过 node_modules/.git/dist 等)。参数 dir 为相对子目录,默认根目录。",
    parameters: z.object({
      dir: z.string().optional().describe("相对子目录,留空表示工作区根"),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ dir }) =>
      guard(
        async () =>
          contract(
            { files: await listFiles(workspace.primaryRoot, dir ?? ".") },
            "read",
          ),
        "read",
      ),
  });

  const readFileTool = tool({
    name: "read_file",
    description:
      "读取已授权工作区内一个文本文件的内容。相对路径默认使用当前工作区，也可使用其他已授权工作区的绝对路径。可用 startLine/endLine 分段读大文件(缺省读全文)。" +
      "结果 data.complete/data.truncated 明确表示是否完整读取；data.fileContentHash 是完整文件哈希。" +
      "界面可能只展示 content 的摘要，摘要省略不代表文件被截断。",
    parameters: z.object({
      path: z.string().describe("相对工作区的文件路径"),
      startLine: optionalIntParam.describe(
        "起始行(1 起),整数;不需要分段时省略,不要传 null/None",
      ),
      endLine: optionalIntParam.describe(
        "结束行(含),整数;不需要分段时省略,不要传 null/None",
      ),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p, startLine, endLine }) =>
      guard(async () => {
        const target = workspace.resolve(p);
        // 宽容解析:数字字符串("1000")→数字;"None"/null/非法值→视为未提供(startLine 回退 1,endLine 读到末尾)
        const s = parseOptionalInt(startLine) ?? 1;
        const e = parseOptionalInt(endLine);
        const r = await readFileRange(target.root, target.relativePath, s, e);
        return contract({
          path: target.relativePath,
          content: r.text,
          totalLines: r.totalLines,
          startLine: r.startLine,
          endLine: r.endLine,
          returnedLines: r.returnedLines,
          totalBytes: r.totalBytes,
          returnedBytes: r.returnedBytes,
          complete: r.complete,
          truncated: r.truncated,
          fileContentHash: r.fileContentHash,
          returnedContentHash: r.returnedContentHash,
        }, "read");
      }, "read"),
  });

  const searchFilesTool = tool({
    name: "search_files",
    description:
      '在工作区文件里做文本搜索,返回 "相对路径:行号: 内容"。支持 glob 文件名过滤(如 *.st)与 isRegex 正则。',
    parameters: z.object({
      text: z.string().describe("要搜索的字面量或正则"),
      glob: z.string().optional().describe("按文件名过滤,如 *.st"),
      isRegex: z.boolean().optional().describe("是否按正则解析 text"),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ text, glob, isRegex }) =>
      guard(
        async () =>
          contract(
            {
              matches: await searchText(workspace.primaryRoot, text, {
                glob,
                isRegex,
              }),
            },
            "read",
          ),
        "read",
      ),
  });

  const writeFileTool = tool({
    name: "write_file",
    description:
      "把文本内容写入已授权工作区内的文件(会覆盖)。相对路径默认使用当前工作区，也可使用其他已授权工作区的绝对路径。属于写操作,执行前需要用户在界面批准。",
    parameters: z.object({
      path: z.string().describe("相对工作区的文件路径"),
      content: z.string().describe("要写入的完整文本内容"),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p, content }, _context, details) =>
      guard(
        async () => {
          const target = workspace.resolve(p);
          let preWriteValidation:
            | Awaited<ReturnType<typeof validateStContentBeforeWrite>>
            | undefined;
          if (
            requiresStValidation &&
            target.relativePath.toLowerCase().endsWith(".st") &&
            !(deliveryWorkflow?.canWriteContent
              ? deliveryWorkflow.canWriteContent(content)
              : validatedStContent.has(hashStContent(content)))
          ) {
            preWriteValidation = await validateStContentBeforeWrite(
              content,
              target.relativePath,
              details?.signal,
            );
            if (!preWriteValidation.ok) {
              return toolResult({
                ok: false,
                error: "ST 写入内容与最近一次通过校验的草稿不一致，且写入前重新校验未通过。",
                data: {
                  suppliedContentHash: preWriteValidation.contentHash,
                  lastValidatedContentHash: deliveryWorkflow?.canWriteContent
                    ? undefined
                    : [...validatedStContent].at(-1),
                  errorCount: preWriteValidation.counts.error,
                  warningCount: preWriteValidation.counts.warning,
                  diagnostics: preWriteValidation.repairPacket
                    ? preWriteValidation.repairPacket.diagnostics
                    : preWriteValidation.diagnostics,
                  ...(preWriteValidation.repairPacket
                    ? { repairPacket: preWriteValidation.repairPacket }
                    : {}),
                },
                diagnostics: preWriteValidation.protocolDiagnostics.length
                  ? preWriteValidation.protocolDiagnostics
                  : [{
                      code: "st_pre_write_validation_failed",
                      message: "写入内容未通过 ST 预写校验。",
                      severity: "error",
                      path: target.relativePath,
                    }],
                effect: "none",
                risk: "plan",
              });
            }
          }
          return withEffect(
            "write_file",
            {
              path: target.relativePath,
              workspaceRoot: target.root,
              content,
            },
            "write",
            async () =>
              contract(
                {
                  ...(await writeFileText(
                    target.root,
                    target.relativePath,
                    content,
                  )),
                  contentHash: hashStContent(content),
                  ...(preWriteValidation
                    ? {
                        preWriteValidation: {
                          errorCount: preWriteValidation.counts.error,
                          warningCount: preWriteValidation.counts.warning,
                          infoCount: preWriteValidation.counts.info,
                          validatedContentHash: preWriteValidation.contentHash,
                          summary: preWriteValidation.summary,
                        },
                      }
                    : {}),
                },
                "write",
                "filesystem",
              ),
          );
        },
        "write",
        "filesystem",
      ),
  });

  const runCommandTool = tool({
    name: "run_command",
    description:
      "在工作区根目录执行一条 shell 命令(60 秒超时,输出截断)。属于危险操作,执行前需要用户批准。" +
      "Windows 宿主使用 cmd.exe 语法;不要在组合命令里使用 PowerShell 专属的 `$null`、`;` 或管道重定向写法。需要 PowerShell 时显式执行 powershell -NoProfile -Command \"...\"。",
    parameters: z.object({ command: z.string().describe("要执行的命令行") }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ command }, _context, details) =>
      guard(
        () =>
          withEffect("run_command", { command }, "execute", async () =>
            commandToolResult(
              command,
              await runCommand(
                workspace.primaryRoot,
                command,
                60_000,
                details?.signal,
              ),
            ),
          ),
        "execute",
        "process",
      ),
  });

  const allTools = [
    getIoTable,
    readPlcVariables,
    validateStCode,
    exportStProgram,
    listFilesTool,
    readFileTool,
    searchFilesTool,
    writeFileTool,
    runCommandTool,
  ];
  if (workflowToolNames) {
    // Workflow deliveries are host-owned state machines. Only expose the tools
    // that the active pipeline stage can use, so unrelated tools cannot bypass
    // the validate/write contract.
    return allTools.filter((item) => {
      const name = (item as unknown as { name?: unknown }).name;
      return typeof name === "string" && workflowToolNames.has(name);
    });
  }
  return allTools;
}

const SYSTEM_PROMPT =
  "你是工控行业的 PLC 编程助手，精通 IEC 61131-3。" +
  "编写程序前先调用 get_io_table 查询变量表，只使用表中已有的变量名。" +
  "生成 ST 代码后必须调用 validate_st_code 校验；如有错误要自行修正后重新校验，" +
  "直到工具回执显示 errorCount=0 为止(warning 不阻断交付,但要在最终答复里说明)," +
    "最后把通过校验的代码展示给用户。" +
  '用户要求生成代码时，默认按运行时交付契约调用 write_file 把最终代码保存到当前工作区；只有用户明确说"不要保存/只展示/不要写文件"时才不落盘。' +
  '当前工作区落盘使用 write_file，不要把 export_st_program 当成当前工作区保存的替代。' +
  "你还可以操作当前打开的工作区：用 list_files 看目录、read_file 读文件、" +
  "search_files 搜索代码、write_file 写文件、run_command 执行命令" +
  "（write_file 和 run_command 会先征求用户批准）。" +
  "当用户明确要求把内容写入或修改工作区文件时，必须调用 write_file，不能只用文字声称已经写入；" +
  "只有收到工具成功回执后，才能在最终结果中报告写入完成。" +
  "任何工具执行完成后，无论成功还是失败，都必须用一两句中文向用户确认执行结果，" +
  "不允许调用完工具不给结论就结束。回答要简洁，用中文。";

const GENERIC_PLAN_SYSTEM_PROMPT =
  "你是通用任务执行助手，处理用户提出的文件、代码、命令、数据、PLC 或其他可用工具任务。" +
  "只在用户目标需要时调用相应工具，不要臆造额外领域步骤。" +
  "写文件、运行命令和设备写入必须经过现有审批、策略与审计约束；工具失败时如实处理。" +
  "最终答复必须基于真实工具回执和计划步骤结果，不得声称未完成的动作已经完成。";

// ---------- 模型构建(网关适配:chat_completions 协议) ----------

/** 网关连续返回空 completion(无任何内容/工具)时抛出,用于截停 SDK 的无限重试 */
export class EmptyGatewayResponseError extends Error {
  constructor() {
    super(
      '模型连续返回空响应:网关在收到工具结果(或首次请求)后返回了"空内容完成"。已自动停止重试。',
    );
    this.name = "EmptyGatewayResponseError";
  }
}

export class AgentActionVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentActionVerificationError";
  }
}

const AGENT_RUN_STATE_FIELD = 'agentRunState';

function attachResumableAgentState(error: unknown, state: string | undefined): void {
  if (!state || !error || (typeof error !== 'object' && typeof error !== 'function')) return;
  try {
    Object.defineProperty(error, AGENT_RUN_STATE_FIELD, {
      value: state,
      configurable: true,
      enumerable: false,
    });
  } catch {
    // Some third-party errors are frozen. The coordinator will use its safe
    // restart fallback when the state cannot be attached.
  }
}

/** Returns the SDK RunState captured at the point a streamed run failed. */
export function getResumableAgentState(error: unknown): string | undefined {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return undefined;
  const value = (error as Record<string, unknown>)[AGENT_RUN_STATE_FIELD];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Transient provider failures may continue from RunState or a safe boundary. */
export function isRetryableAgentError(error: unknown): boolean {
  if (
    error instanceof MaxTurnsExceededError ||
    error instanceof EmptyGatewayResponseError ||
    error instanceof AgentActionVerificationError ||
    error instanceof AgentOutputValidationError ||
    error instanceof EffectRecoveryRequiredError
  ) {
    return false;
  }

  const statuses: number[] = [];
  const names: string[] = [];
  const codes: string[] = [];
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && depth < 6; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    if (typeof current === 'string') {
      messages.push(current);
      break;
    }
    if (typeof current !== 'object' && typeof current !== 'function') {
      messages.push(String(current));
      break;
    }
    const item = current as Record<string, unknown>;
    for (const candidate of [item.status, item.statusCode, (item.response as Record<string, unknown> | undefined)?.status]) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) statuses.push(candidate);
    }
    if (typeof item.name === 'string') names.push(item.name);
    if (typeof item.code === 'string') codes.push(item.code);
    if (typeof item.message === 'string') messages.push(item.message);
    current = item.cause ?? item.error;
  }

  if (statuses.some((status) => status === 408 || status === 409 || status === 425 || status === 429 || status >= 500)) {
    return true;
  }
  if (statuses.some((status) => status === 400 || status === 401 || status === 403 || status === 404 || status === 422)) {
    return false;
  }
  if (names.some((name) => /^(?:APIConnectionError|APIConnectionTimeoutError|ModelTimeoutError)$/i.test(name))) {
    return true;
  }
  if (codes.some((code) => /^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT_TIMEOUT)$/i.test(code))) {
    return true;
  }
  const text = messages.join(' ');
  return /\b(?:408|409|425|429|5\d\d)\b|gateway\s+(?:is\s+)?unavailable|connection\s+(?:error|failed|reset|refused)|network\s+error|fetch\s+failed|timed?\s*out/i.test(text);
}

function isAgentCancellationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.name === "APIUserAbortError" ||
    error.constructor.name === "APIUserAbortError" ||
    error.message === "Request was aborted."
  );
}

export async function verifyWorkspaceWrite(
  workspaceRoot: string | WorkspaceScope,
  relativePath: string,
  expectedContent: string,
): Promise<Artifact> {
  const scope =
    workspaceRoot instanceof WorkspaceScope
      ? workspaceRoot
      : new WorkspaceScope(workspaceRoot ? [workspaceRoot] : []);
  const file = scope.resolve(relativePath).absolutePath;
  const actual = await fs.readFile(file, "utf8").catch(() => undefined);
  if (actual !== expectedContent) {
    throw new AgentActionVerificationError(
      `工具 write_file 返回成功，但文件校验失败: ${relativePath}`,
    );
  }
  return {
    kind: "file",
    name: path.basename(file),
    uri: file,
    mimeType: "text/plain",
    metadata: { bytes: Buffer.byteLength(actual) },
  };
}

/**
 * 带"空回复熔断"的 chat_completions 模型。
 *
 * 背景:部分 OpenAI 兼容网关(尤其套壳推理模型)会返回 `finish_reason=stop` 但 content 为空的
 * completion;SDK 把这种响应当作"未完成"而反复重发同一请求,直到烧满 maxTurns。时间轴上的
 * 看门狗追不上响应飞快的网关(实测 10 连发仅 84ms),所以在模型层同步归因:
 * 一次响应若既无内容增量、最终 output 也为空 → 记 1 次空回复;连续 2 次即抛错截停。
 */
export type GatewayStructuredToolChoiceSupport =
  | "unknown"
  | "supported"
  | "unsupported";

export type GatewayParallelToolCallsSupport =
  | "unknown"
  | "supported"
  | "unsupported";

export class GatewayGuardedModel extends OpenAIChatCompletionsModel {
  private emptyStreak = 0;
  private requiredToolOnce?: string;
  private structuredToolChoiceSupport: GatewayStructuredToolChoiceSupport =
    "unknown";
  private parallelToolCallsSupport: GatewayParallelToolCallsSupport = "unknown";

  /** 每轮用户消息开始时清零,避免跨轮误伤 */
  resetEmptyStreak(): void {
    this.emptyStreak = 0;
    this.requiredToolOnce = undefined;
  }

  requireToolOnce(toolName: string): void {
    this.requiredToolOnce = toolName;
  }

  get structuredToolChoiceCapability(): GatewayStructuredToolChoiceSupport {
    return this.structuredToolChoiceSupport;
  }

  get parallelToolCallsCapability(): GatewayParallelToolCallsSupport {
    return this.parallelToolCallsSupport;
  }

  private async *streamWithCapabilityNegotiation(
    effectiveRequest: any,
    fallbackRequest: any,
    shouldNegotiate: boolean,
    requiredTool?: string,
  ): AsyncGenerator<any> {
    if (!shouldNegotiate) {
      let sawEvent = false;
      try {
        for await (const ev of super.getStreamedResponse(
          effectiveRequest,
        ) as AsyncIterable<any>) {
          sawEvent = true;
          if (
            this.parallelToolCallsSupport === "unknown" &&
            hasParallelToolCalls(effectiveRequest)
          ) {
            this.parallelToolCallsSupport = "supported";
            agentLog("[capability] gateway supports parallel_tool_calls");
          }
          yield ev;
        }
      } catch (error) {
        if (!sawEvent && isParallelToolCallsConflict(error)) {
          this.parallelToolCallsSupport = "unsupported";
          agentLog(
            "[capability] gateway rejected parallel_tool_calls; retrying without it",
          );
          for await (const ev of super.getStreamedResponse(
            withoutParallelToolCalls(effectiveRequest),
          ) as AsyncIterable<any>) {
            yield ev;
          }
          return;
        }
        throw error;
      }
      return;
    }

    let sawEvent = false;
    let sawRequiredTool = false;
    const bufferedEvents: any[] = [];
    try {
      for await (const ev of super.getStreamedResponse(
        effectiveRequest,
      ) as AsyncIterable<any>) {
        sawEvent = true;
        if (
          this.parallelToolCallsSupport === "unknown" &&
          hasParallelToolCalls(effectiveRequest)
        ) {
          this.parallelToolCallsSupport = "supported";
          agentLog("[capability] gateway supports parallel_tool_calls");
        }
        if (!sawRequiredTool) {
          bufferedEvents.push(ev);
          sawRequiredTool =
            requiredTool !== undefined &&
            hasRequiredToolCallEvent(ev, requiredTool);
          if (sawRequiredTool) {
            for (const bufferedEvent of bufferedEvents) yield bufferedEvent;
            bufferedEvents.length = 0;
          }
        } else {
          yield ev;
        }
      }

      if (!sawRequiredTool) {
        this.structuredToolChoiceSupport = "unsupported";
        agentLog(
          "[capability] gateway accepted response_format + tool_choice but did not produce the required tool call; retrying without response_format",
        );
        for await (const ev of super.getStreamedResponse(
          fallbackRequest,
        ) as AsyncIterable<any>) {
          yield ev;
        }
        return;
      }

      if (sawEvent && this.structuredToolChoiceSupport === "unknown") {
        this.structuredToolChoiceSupport = "supported";
        agentLog("[capability] gateway supports response_format + tool_choice");
      }
      for (const bufferedEvent of bufferedEvents) yield bufferedEvent;
    } catch (error) {
      if (
        !sawEvent &&
        isParallelToolCallsConflict(error)
      ) {
        this.parallelToolCallsSupport = "unsupported";
        agentLog(
          "[capability] gateway rejected parallel_tool_calls; retrying without it",
        );
        for await (const ev of this.streamWithCapabilityNegotiation(
          withoutParallelToolCalls(effectiveRequest),
          withoutParallelToolCalls(fallbackRequest),
          shouldNegotiate,
          requiredTool,
        ) as AsyncIterable<any>) {
          yield ev;
        }
        return;
      }
      if (
        !shouldNegotiate ||
        sawEvent ||
        !isStructuredToolChoiceConflict(error)
      ) {
        throw error;
      }
      this.structuredToolChoiceSupport = "unsupported";
      agentLog(
        "[capability] gateway rejected response_format + tool_choice; retrying tool request without response_format",
      );
      for await (const ev of super.getStreamedResponse(
        fallbackRequest,
      ) as AsyncIterable<any>) {
        yield ev;
      }
    }
  }

  async *getStreamedResponse(request: any): AsyncGenerator<any> {
    const requiredTool = this.requiredToolOnce;
    this.requiredToolOnce = undefined;
    const forcedRequest = requiredTool
      ? {
          ...request,
          modelSettings: {
            ...(request.modelSettings ?? {}),
            toolChoice: requiredTool,
          },
        }
      : request;
    const shouldNegotiate = Boolean(
      requiredTool && hasStructuredOutput(request.outputType),
    );
    const structuredEffectiveRequest =
      shouldNegotiate && this.structuredToolChoiceSupport === "unsupported"
        ? withoutStructuredOutput(forcedRequest)
        : forcedRequest;
    const effectiveRequest =
      this.parallelToolCallsSupport === "unsupported"
        ? withoutParallelToolCalls(structuredEffectiveRequest)
        : structuredEffectiveRequest;
    const fallbackRequest =
      this.parallelToolCallsSupport === "unsupported"
        ? withoutParallelToolCalls(withoutStructuredOutput(forcedRequest))
        : withoutStructuredOutput(forcedRequest);
    let sawOutput = false;
    for await (const ev of this.streamWithCapabilityNegotiation(
      effectiveRequest,
      fallbackRequest,
      shouldNegotiate,
      requiredTool,
    ) as AsyncIterable<any>) {
      // chat_completions 下 SDK 只透出 response_started/model/output_text_delta,没有终结的
      // model_response 事件,所以直接看原始 chunk 的 delta:有正文或 tool_calls 就不算空回复
      if (ev?.type === "output_text_delta") sawOutput = true;
      const delta =
        ev?.event?.choices?.[0]?.delta ?? ev?.providerData?.choices?.[0]?.delta;
      if (delta && (delta.content || delta.tool_calls)) sawOutput = true;
      const out = ev?.response?.output;
      if (Array.isArray(out) && out.length > 0) sawOutput = true;
      yield ev;
    }
    this.emptyStreak = sawOutput ? 0 : this.emptyStreak + 1;
    if (this.emptyStreak >= 2) {
      this.emptyStreak = 0;
      throw new EmptyGatewayResponseError();
    }
  }
}

function hasStructuredOutput(outputType: unknown): boolean {
  return (
    outputType !== undefined && outputType !== null && outputType !== "text"
  );
}

function withoutStructuredOutput(request: any): any {
  return {
    ...request,
    outputType: "text",
  };
}

function hasParallelToolCalls(request: any): boolean {
  return request?.modelSettings?.parallelToolCalls === true;
}

function withoutParallelToolCalls(request: any): any {
  const { parallelToolCalls: _parallelToolCalls, ...modelSettings } =
    request?.modelSettings ?? {};
  return {
    ...request,
    modelSettings,
  };
}

function hasRequiredToolCallEvent(
  event: any,
  requiredTool: string,
): boolean {
  const raw = event?.event ?? event?.data;
  const choices = Array.isArray(raw?.choices) ? raw.choices : [];
  for (const choice of choices) {
    const toolCalls = Array.isArray(choice?.delta?.tool_calls)
      ? choice.delta.tool_calls
      : [];
    if (
      toolCalls.some(
        (call: any) =>
          call?.function?.name === requiredTool || call?.name === requiredTool,
      )
    ) {
      return true;
    }
  }

  const output = event?.response?.output ?? event?.data?.response?.output;
  return (
    Array.isArray(output) &&
    output.some(
      (item: any) =>
        (item?.type === "function_call" || item?.type === "tool_call") &&
        item?.name === requiredTool,
    )
  );
}

function isStructuredToolChoiceConflict(error: unknown): boolean {
  const value = error as {
    status?: unknown;
    message?: unknown;
    error?: { message?: unknown; code?: unknown };
    body?: { error?: { message?: unknown; code?: unknown } };
    response?: { data?: { error?: { message?: unknown; code?: unknown } } };
  };
  const status = typeof value?.status === "number" ? value.status : undefined;
  const text = [
    value?.message,
    value?.error?.message,
    value?.error?.code,
    value?.body?.error?.message,
    value?.body?.error?.code,
    value?.response?.data?.error?.message,
    value?.response?.data?.error?.code,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  if (status !== undefined && status !== 400 && status !== 422) return false;
  const mentionsFormat =
    /response[_ ]?format|json[_ -]?schema|structured output/.test(text);
  const mentionsToolChoice =
    /tool[_ ]?choice|function call|tool call|tools/.test(text);
  const describesConflict =
    /not supported|unsupported|cannot|can't|invalid|incompatible|conflict|not allowed|does not allow|only/.test(
      text,
    );
  return mentionsFormat && mentionsToolChoice && describesConflict;
}

function isParallelToolCallsConflict(error: unknown): boolean {
  const value = error as {
    status?: unknown;
    message?: unknown;
    error?: { message?: unknown; code?: unknown };
    body?: { error?: { message?: unknown; code?: unknown } };
    response?: { data?: { error?: { message?: unknown; code?: unknown } } };
  };
  const status = typeof value?.status === "number" ? value.status : undefined;
  const text = [
    value?.message,
    value?.error?.message,
    value?.error?.code,
    value?.body?.error?.message,
    value?.body?.error?.code,
    value?.response?.data?.error?.message,
    value?.response?.data?.error?.code,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  if (status !== undefined && status !== 400 && status !== 422) return false;
  const mentionsParallelTools =
    /parallel[_ -]?tool[_ -]?calls|parallel tool calls/.test(text);
  const describesConflict =
    /not supported|unsupported|unknown|unrecognized|invalid|not allowed|does not allow|extra fields|unexpected/.test(
      text,
    );
  return mentionsParallelTools && describesConflict;
}

// ---------- 网关原始报文诊断(写入 "PLC Agent" 输出面板) ----------
// 排查"模型不返回总结"这类问题:把每次发给网关的消息结构、每次响应 SSE 的解析摘要
// (正文/推理/工具调用字符数、finish_reason、错误体)全部留痕,复现一次即可定位。
let agentLog: (line: string) => void = () => {};
export function setAgentLogger(fn: (line: string) => void): void {
  agentLog = fn;
}

function summarizeOutgoing(body: unknown): string {
  try {
    const j = (typeof body === "string" ? JSON.parse(body) : body) as {
      model?: string;
      stream?: boolean;
      messages?: {
        role: string;
        content?: unknown;
        tool_calls?: { function?: { name?: string } }[];
      }[];
      tools?: { function?: { name?: string } }[];
      tool_choice?: unknown;
      parallel_tool_calls?: unknown;
      response_format?: { type?: string; json_schema?: { name?: string } };
    };
    const chain = (j.messages ?? [])
      .map((m) =>
        m.role === "assistant" && m.tool_calls?.length
          ? `assistant(tool_calls:${m.tool_calls.map((t) => t.function?.name).join("|")})`
          : `${m.role}(len=${typeof m.content === "string" ? m.content.length : "-"})`,
      )
      .join(" ");
    const tools =
      (j.tools ?? [])
        .map((tool) => tool.function?.name)
        .filter(Boolean)
        .join("|") || "-";
    const choice =
      typeof j.tool_choice === "string"
        ? j.tool_choice
        : j.tool_choice
          ? JSON.stringify(j.tool_choice)
          : "-";
    const format = j.response_format?.type
      ? `${j.response_format.type}${j.response_format.json_schema?.name ? `:${j.response_format.json_schema.name}` : ""}`
      : "-";
    const parallel =
      typeof j.parallel_tool_calls === "boolean"
        ? String(j.parallel_tool_calls)
        : "-";
    return `${j.model} stream=${j.stream} tools=${tools} choice=${choice} parallel=${parallel} format=${format} ${chain}`.slice(
      0,
      900,
    );
  } catch {
    return "(请求体无法解析)";
  }
}

function makeLoggingFetch(): unknown {
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const isChat = url.includes("/chat/completions");
    if (isChat) agentLog(`[req] ${summarizeOutgoing(init?.body)}`);
    const resp = await fetch(input as never, init as never);
    if (!isChat || !resp.body) return resp;
    const [userSide, tap] = resp.body.tee(); // 原样透传给 SDK,旁路只做解析统计
    void (async () => {
      let text = "";
      try {
        const reader = tap.getReader();
        for (;;) {
          const r = await reader.read();
          if (r.done) break;
          text += new TextDecoder().decode(r.value, { stream: true });
        }
      } catch (e) {
        agentLog(`[resp] 旁路读取异常: ${e}`);
        return;
      }
      let contentChars = 0;
      let reasoningChars = 0;
      let toolCallDeltas = 0;
      let finish = "-";
      let errorLine = "";
      // 收集模型实际生成的工具参数分片,按 index 重组,定位畸形 JSON 的确切原文
      const toolCallArgs = new Map<
        number,
        { id?: string; name?: string; args: string }
      >();
      for (const line of text.split("\n")) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload) as {
            error?: unknown;
            choices?: {
              finish_reason?: string | null;
              delta?: {
                content?: unknown;
                reasoning_content?: unknown;
                reasoning?: unknown;
                tool_calls?: {
                  index?: unknown;
                  id?: unknown;
                  function?: { name?: unknown; arguments?: unknown };
                }[];
              };
            }[];
          };
          if (j.error) {
            errorLine = JSON.stringify(j.error).slice(0, 300);
            continue;
          }
          const c = j.choices?.[0];
          if (c?.finish_reason) finish = c.finish_reason;
          const d = c?.delta ?? {};
          if (typeof d.content === "string") contentChars += d.content.length;
          const rz = (d.reasoning_content ?? d.reasoning) as string | undefined;
          if (typeof rz === "string") reasoningChars += rz.length;
          if (Array.isArray(d.tool_calls)) {
            toolCallDeltas += d.tool_calls.length;
            for (const tc of d.tool_calls) {
              const idx = typeof tc?.index === "number" ? tc.index : 0;
              const cur = toolCallArgs.get(idx) ?? { args: "" };
              if (typeof tc?.id === "string" && tc.id) cur.id = tc.id;
              if (typeof tc?.function?.name === "string" && tc.function.name)
                cur.name = tc.function.name;
              if (typeof tc?.function?.arguments === "string")
                cur.args += tc.function.arguments;
              toolCallArgs.set(idx, cur);
            }
          }
        } catch {
          /* 非 JSON 行忽略 */
        }
      }
      agentLog(
        `[resp] HTTP ${resp.status} 正文=${contentChars}字符 推理=${reasoningChars}字符 工具增量=${toolCallDeltas} finish=${finish}${errorLine ? " ERROR=" + errorLine : ""}`,
      );
      if (toolCallArgs.size > 0) {
        // 打印重组后的工具参数原文,定位 InvalidToolInputError 的畸形处
        for (const [idx, call] of toolCallArgs) {
          const snippet =
            call.args.length > 500 ? call.args.slice(0, 500) + "…" : call.args;
          agentLog(
            `[toolargs] #${idx} name=${call.name ?? "?"} id=${call.id ?? "-"} args=${JSON.stringify(snippet)}`,
          );
        }
      }
      if (contentChars === 0 && reasoningChars === 0 && toolCallDeltas === 0) {
        agentLog(
          `[resp] 空完成原文(尾部): ${text.slice(-500).replace(/\n/g, "⏎")}`,
        );
      }
    })();
    return new Response(userSide, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  };
}

// The OpenAI client is configuration-only. Keep it reusable, but never cache
// GatewayGuardedModel because its watchdog/capability state belongs to a run.
const openAIClientCache = new Map<string, OpenAI>();

function buildChatCompletionsModel(cfg: AgentConfig): GatewayGuardedModel {
  const key = JSON.stringify([cfg.baseUrl, cfg.apiKey]);
  let client = openAIClientCache.get(key);
  if (!client) {
    client = new OpenAI({
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
      fetch: makeLoggingFetch() as never,
    });
    openAIClientCache.set(key, client);
  }
  return new GatewayGuardedModel(client, cfg.model);
}

// ---------- 一轮对话:流式执行 + 会话持久化 + 审批中断/恢复 ----------

/** 本轮 token 用量(从模型响应的 usage 汇总;网关不返回 usage 字段时全为 0) */
/** Protocol usage alias shared by runtime and run store. */
export type TurnUsage = UsageSummary;

/** 单次用户消息允许的最大模型往返轮数,防止工具死循环烧额度 */
export const MAX_TURNS = 10;
const MAX_COMPLETION_GATE_RETRIES = 3;

export function buildModelAdapter(cfg: AgentConfig): ModelAdapter {
  return createModelAdapter(cfg, {
    fetchImpl: makeLoggingFetch() as typeof fetch,
    createChatCompletionsModel: () => {
      // Keep the existing guarded gateway implementation unchanged. An
      // explicit Chat Completions selection without a custom endpoint uses
      // the SDK model directly and is outside the gateway watchdog path.
      if (!cfg.baseUrl) {
        const client = new OpenAI({
          apiKey: cfg.apiKey,
          fetch: makeLoggingFetch() as never,
        });
        return new OpenAIChatCompletionsModel(client, cfg.model);
      }
      return buildChatCompletionsModel(cfg);
    },
  });
}

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
  const adapter = buildModelAdapter(cfg);
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
  const tracingDisabled = !(adapter.provider === "openai" && adapter.apiFormat === "responses" && !cfg.baseUrl.trim());
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
): Promise<DeliveryContract | undefined> {
  const inferred = inferDeliveryContractFromUserText(userText);
  if (inferred) return inferred;
  const adapter = buildModelAdapter(cfg);
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
      "如果交付物是 ST 代码，必须设置 workspaceFileExtension=.st，并在 requiredVerificationTools 中包含 validate_st_code；这是运行时强制验证依据，不是可选建议。" +
      "若用户没有指定文件名，交付说明里要求模型在当前工作区根目录选择一个清晰的 .st 文件名。" +
      "必须严格返回 schema,不要输出 markdown。",
    outputType: deliveryContractDecisionSchema,
  });
  const tracingDisabled = !(adapter.provider === "openai" && adapter.apiFormat === "responses" && !cfg.baseUrl.trim());
  const input: string | AgentInputItem[] = history.length
    ? [...history, { type: "message", role: "user", content: userText }]
    : userText;
  const result = await new Runner({ tracingDisabled }).run(classifier, input, {
    stream: false,
    maxTurns: 1,
    signal,
  });
  return createDeliveryContract(result.finalOutput);
}

function isSimpleSingleTurnRequest(userText: string): boolean {
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

function teamTracingDisabled(cfg: AgentConfig, adapter: ModelAdapter): boolean {
  return !(adapter.provider === "openai" && adapter.apiFormat === "responses" && !cfg.baseUrl.trim());
}

const TEAM_ROLE_REPAIR_ATTEMPTS = 1;

function stringifyForPrompt(value: unknown, maxLength = 4_000): string {
  const text = typeof value === "string"
    ? value
    : JSON.stringify(value, null, 2) ?? String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function tryParseJsonLikeOutput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const firstObject = unfenced.indexOf("{");
    const lastObject = unfenced.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      try {
        return JSON.parse(unfenced.slice(firstObject, lastObject + 1));
      } catch {
        return value;
      }
    }
    return value;
  }
}

function formatZodIssues(error: z.ZodError, maxIssues = 8): string {
  return error.issues
    .slice(0, maxIssues)
    .map((issue) => {
      const pathText = issue.path.length ? issue.path.join(".") : "<root>";
      return `${pathText}: ${issue.message}`;
    })
    .join("; ");
}

function parseSchemaOutput<T>(
  schema: z.ZodType<T>,
  rawOutput: unknown,
): { ok: true; value: T } | { ok: false; issues: string; raw: string } {
  const candidate = tryParseJsonLikeOutput(rawOutput);
  const parsed = schema.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: formatZodIssues(parsed.error),
    raw: stringifyForPrompt(rawOutput),
  };
}

function teamRoleSchemaInstruction(name: string): string {
  switch (name) {
    case "协作任务路由器":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: route('single'|'team'), goal(string), reason(string), planSummary(string), reviewFocus(string[]), verificationCriteria(string[])。",
      ].join("\n");
    case "Team Planner":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: planSummary(string), reviewFocus(string[]), verificationCriteria(string[]), executionGraph(optional object)。",
        "executionGraph.nodes 每项必须包含 id,title,objective,dependsOn,completionCriteria,suggestedTools,effect,resources,parallelSafe,priority。",
      ].join("\n");
    case "Team Reviewer":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: approved(boolean), summary(string), findings(string[]), requiredChanges(string[])。",
      ].join("\n");
    case "Team Verifier":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: passed(boolean), summary(string), evidence(string[]), gaps(string[]), decision(optional 'pass'|'retry'|'ask_user'|'revise')。",
      ].join("\n");
    default:
      return "只返回符合本角色 schema 的 JSON 对象，不要 markdown、代码块或解释文字。";
  }
}

function appendTeamRoleRepairInput(
  input: string | AgentInputItem[],
  repairPrompt: string,
): string | AgentInputItem[] {
  if (typeof input === "string") return `${input}\n\n${repairPrompt}`;
  return [...input, { type: "message", role: "user", content: repairPrompt }];
}

function teamRoleTextDelta(event: any): string {
  const raw = event?.type === "raw_model_stream_event"
    ? event.data
    : event?.event ?? event?.data ?? event;
  if (!raw || typeof raw !== "object") return "";
  if (
    (raw.type === "output_text_delta" ||
      raw.type === "response.output_text.delta") &&
    typeof raw.delta === "string"
  ) {
    return raw.delta;
  }
  const delta = raw.choices?.[0]?.delta ?? raw.providerData?.choices?.[0]?.delta;
  return typeof delta?.content === "string" ? delta.content : "";
}

async function runTeamRoleRawOutput(
  runner: Runner,
  role: Agent<any, any>,
  input: string | AgentInputItem[],
  signal?: AbortSignal,
): Promise<unknown> {
  const stream = await runner.run(role, input, {
    stream: true,
    maxTurns: 1,
    signal,
  });
  let text = "";
  try {
    for await (const event of stream) {
      text += teamRoleTextDelta(event);
    }
  } catch (error) {
    if (!(error instanceof MaxTurnsExceededError) || !text.trim()) throw error;
  }
  try {
    await stream.completed;
  } catch (error) {
    if (!(error instanceof MaxTurnsExceededError) || !text.trim()) throw error;
  }
  return typeof stream.finalOutput === "string" && stream.finalOutput.trim()
    ? stream.finalOutput
    : text;
}

function asPlainFinalMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  const candidate = tryParseJsonLikeOutput(value);
  if (candidate && typeof candidate === "object") {
    const message = (candidate as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
}

function coerceIndustrialAgentOutput(value: unknown): IndustrialAgentOutput | undefined {
  const candidate = tryParseJsonLikeOutput(value);
  const parsed = industrialAgentOutputDefinition.schema.safeParse(candidate);
  if (parsed.success) return parsed.data as IndustrialAgentOutput;
  const message = asPlainFinalMessage(value);
  return message
    ? { message, diagnostics: [], artifacts: [], data: null }
    : undefined;
}

function isInvalidFinalOutputTypeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: unknown; message?: unknown };
  const name = typeof value.name === "string" ? value.name : "";
  const message = typeof value.message === "string" ? value.message : "";
  return name === "ModelBehaviorError" &&
    /Invalid output type|final assistant output/i.test(message);
}

async function runTeamRole<T>(
  cfg: AgentConfig,
  name: string,
  instructions: string,
  outputType: z.ZodType<T>,
  input: string | AgentInputItem[],
  signal?: AbortSignal,
): Promise<T> {
  const adapter = buildModelAdapter(cfg);
  const role = new Agent({
    name,
    model: adapter.model,
    instructions:
      instructions +
      "\n\n结构化输出要求:\n" +
      teamRoleSchemaInstruction(name) +
      "\n如果上一轮被指出 schema 错误,只修正 JSON 结构并重新返回完整对象。",
    // Team role schemas can contain a bounded execution graph. The gateway's
    // small default output cap can cut that JSON in the middle and surface as
    // a misleading "output did not match schema" error.
    modelSettings: { maxTokens: 8_000 },
  });
  const runner = new Runner({ tracingDisabled: teamTracingDisabled(cfg, adapter) });
  let currentInput = input;
  let lastIssues = "";
  let lastRaw = "";
  for (let attempt = 0; attempt <= TEAM_ROLE_REPAIR_ATTEMPTS; attempt += 1) {
    const rawOutput = await runTeamRoleRawOutput(runner, role, currentInput, signal);
    const parsed = parseSchemaOutput(outputType, rawOutput);
    if (parsed.ok) return parsed.value;
    lastIssues = parsed.issues;
    lastRaw = parsed.raw;
    if (attempt < TEAM_ROLE_REPAIR_ATTEMPTS) {
      agentLog(
        `[team] ${name} 结构化输出未通过 schema，要求模型按字段错误修正: ${lastIssues}`,
      );
      currentInput = appendTeamRoleRepairInput(
        input,
        "上一轮结构化输出没有通过 schema 校验。请根据下面的字段级错误自查并重试,只返回完整 JSON 对象。\n" +
          `schema错误: ${lastIssues}\n` +
          `上一轮原始输出: ${lastRaw}`,
      );
    }
  }
  throw new AgentOutputValidationError(
    `${name} 结构化输出不符合 schema: ${lastIssues || "未知错误"}；raw=${lastRaw || "无"}`,
  );
}

/**
 * Model-selected Team routing. It has no tools or side effects; an unavailable
 * router is intentionally allowed to fall back to the existing single path.
 */
export async function routeTeamTask(
  cfg: AgentConfig,
  userText: string,
  signal?: AbortSignal,
  history: AgentInputItem[] = [],
): Promise<TeamTask | undefined> {
  const input: string | AgentInputItem[] = history.length
    ? [...history, { type: "message", role: "user", content: userText }]
    : userText;
  const decision = await runTeamRole(
    cfg,
    "协作任务路由器",
    "你是任务复杂度路由器，不执行工具。只在任务确实需要独立规划、审查、执行和结果验证四个职责协作时选择 team。" +
      "普通问答、解释、一次性读取、简单改写或单一已知操作必须选择 single。" +
      "team 时给出可执行的 planSummary、审查重点和可验证的完成标准；single 时三个字段给出简短说明或空数组。" +
      "必须严格返回 schema，不要输出 markdown。",
    teamRouteDecisionSchema,
    input,
    signal,
  );
  return createTeamTask(decision, userText);
}

export async function planTeamTask(
  cfg: AgentConfig,
  task: TeamTask,
  signal?: AbortSignal,
): Promise<TeamPlannerReport> {
  return runTeamRole(
    cfg,
    "Team Planner",
    "Return executionGraph with 1-12 DAG nodes. Every node must include dependsOn, completionCriteria, suggestedTools, effect, resources, parallelSafe and priority (0-100). Only read-only or no-effect nodes may set parallelSafe=true; file writes, commands and device writes must remain serial. Set bounded maxParallelism, budget, task timeoutMs, nodeTimeoutMs and maxRetries when the task warrants them. " +
    "你是协作任务的规划角色，不执行工具。把给定目标整理成执行角色可直接遵循的紧凑计划，" +
      "通常使用 1 到 4 个节点，只有存在真实依赖时才增加节点；每个字段保持简洁，不重复解释同一要求。" +
      "列出审查重点和可观察的验证标准。若路由初稿里包含审查反馈，必须针对反馈修订计划。" +
      "不要增加用户未要求的副作用，必须严格返回 schema。",
    teamPlannerReportSchema,
    `目标：${task.goal}\n路由初稿：${task.planSummary}`,
    signal,
  );
}

export async function reviewTeamTask(
  cfg: AgentConfig,
  task: TeamTask,
  signal?: AbortSignal,
): Promise<TeamReviewReport> {
  return runTeamRole(
    cfg,
    "Team Reviewer",
    "你是只读审查角色，不执行工具。审查计划是否超出用户目标、遗漏安全/审批约束，或缺少完成条件。" +
      "必须尊重用户明确给出的范围约束；用户已允许模拟、占位或明确说不需要的内容，不能再作为阻断性问题。" +
      "只有不存在阻断性问题才 approved=true。所有 requiredChanges 必须可操作，必须严格返回 schema。",
    teamReviewReportSchema,
    `目标：${task.goal}\n计划：${task.planSummary}\n审查重点：${task.reviewFocus.join('；') || '范围、风险、审批与证据'}`,
    signal,
  );
}

export async function verifyTeamTask(
  cfg: AgentConfig,
  task: TeamTask,
  executorSummary: string,
  evidence: string[],
  signal?: AbortSignal,
): Promise<TeamVerificationReport> {
  return runTeamRole(
    cfg,
    "Team Verifier",
    "你是只读结果验证角色，不执行工具。仅依据给定执行结果与证据，判断是否满足目标和验证标准。" +
      "证据不足、执行失败或结果不完整时 passed=false；不要猜测成功。" +
      "不通过时 decision 选择 retry（重试已有节点）、revise（只调整尚未开始的节点）或 ask_user（需要用户补充决定），并填写 retryNodeIds、revisedGraph 或 userQuestion；通过时 decision=pass。必须严格返回 schema。",
    teamVerificationReportSchema,
    `目标：${task.goal}\n计划：${task.planSummary}\n验证标准：${task.verificationCriteria.join('；') || '结果满足用户请求且有真实证据'}\n执行结果：${executorSummary}\n证据：${evidence.join('；') || '无额外证据'}`,
    signal,
  );
}

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
  const workflowState = createDeliveryWorkflowRuntimeState();
  const stValidationState = workflowState.stValidation;
  const deliveryWorkflow = createDeliveryWorkflow(
    options.deliveryContract,
    workflowState,
  );
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
  const planProgressTool = activePlan
    ? tool({
        name: "report_plan_progress",
        description:
          "报告通用线性计划中一个步骤的开始或完成。完成步骤时必须基于本步骤实际工具回执提交自检结论；只有 verdict=passed 才会推进下一步。retry 或 revise 会保留当前步骤，并把纠正方向返回给你。此工具不执行外部副作用。",
        parameters: z.object({
          stepId: z.string().describe("计划中的步骤 ID，例如 step-1"),
          phase: z.enum(["started", "completed"]),
          note: z.string().optional().describe("简短说明本步骤的实际进展或完成依据"),
          verification: z.object({
            verdict: z.enum(["passed", "retry", "revise"]),
            evidence: z.string().describe("基于真实工具回执、文件内容或已确认输入的具体证据，不能只说‘已完成’"),
            issue: z.string().optional().describe("未通过时发现的具体问题"),
            nextAction: z.string().optional().describe("未通过时下一次要执行的修正动作"),
          }).optional().describe("仅在 phase=completed 时提供；没有实际证据时选择 retry 或 revise"),
        }),
        execute: async (progress) => {
          activePlan = updateTaskPlan(activePlan!, progress as TaskPlanProgress);
          await options.onPlanProgress?.(progress as TaskPlanProgress);
          const verification = progress.verification;
          const advanced = progress.phase !== "completed" || verification?.verdict === "passed";
          if (!advanced) {
            return toolResult({
              ok: false,
              error: "步骤自检未通过，计划未推进。请根据 issue 和 nextAction 继续修正当前步骤，取得新的真实证据后再报告完成。",
              data: {
                stepId: progress.stepId,
                phase: progress.phase,
                planStatus: activePlan.status,
                verification,
              },
              effect: "none",
              risk: "plan",
            });
          }
          return toolResult({
            ok: true,
            data: {
              stepId: progress.stepId,
              phase: progress.phase,
              planStatus: activePlan.status,
              verification,
            },
            effect: "none",
            risk: "plan",
          });
        },
      })
    : undefined;
  const artifactDeliveryTool = requiresInlineFinalArtifact
    ? tool({
        name: "deliver_artifact",
        description:
          "提交本轮用户要求的内联交付物。适用于代码、文档、报告、数据或配置等内容；必须填写完整内容，不能只写摘要或计划。文档/说明/Markdown 优先使用 kind=report；代码优先使用 kind=code；只有泛文件交付才使用 kind=file。该工具不修改文件、不执行命令，只把内容登记为最终交付证据。",
        parameters: z.object({
          kind: z.enum(["file", "code", "report", "data", "unknown"]),
          name: z.string().min(1).describe("交付物名称"),
          mimeType: z.string().optional().describe("可选 MIME 类型"),
          content: z.string().min(1).describe("完整交付内容，不能省略"),
        }),
        execute: async ({ kind, name, mimeType, content }) =>
          toolResult({
            ok: true,
            data: {
              artifact: {
                kind,
                name,
                ...(mimeType?.trim() ? { mimeType: mimeType.trim() } : {}),
                content,
              },
            },
            effect: "none",
            risk: "plan",
          }),
      })
    : undefined;
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
  const tools = [
    ...buildTools(
      cfg,
      options.deliveryContract,
      deliveryWorkflow,
      stValidationState,
      reportDiagnostics,
    ),
    ...(planProgressTool ? [planProgressTool] : []),
    ...(artifactDeliveryTool ? [artifactDeliveryTool] : []),
  ];
  const availableToolNames = new Set(
    tools
      .map((item) => (item as unknown as { name?: unknown }).name)
      .filter((name): name is string => typeof name === "string" && name.length > 0),
  );
  const executionInstructions = activePlan
    ? GENERIC_PLAN_SYSTEM_PROMPT +
      "\n\n当前请求使用通用线性计划，不要把它强行改写成某一种 PLC/ST 场景；以计划目标和用户原始要求为准。" +
      "你正在执行一个已经批准的通用线性计划。必须严格按步骤顺序工作。" +
      "开始每一步前调用 report_plan_progress(stepId, started)。完成前必须检查本步骤的完成标准与真实工具回执或已确认输入是否一致，再调用 report_plan_progress(stepId, completed, verification)。" +
      "verification.evidence 必须具体说明观察到的证据；证据不足、工具失败或结果不符合标准时，填写 verdict=retry（继续修正）或 revise（换一种完成当前步骤的办法），并提供 issue 与 nextAction。" +
      "只有 verdict=passed 会推进步骤；收到未通过的工具回执后必须继续处理当前步骤，不能跳到下一步或给最终答复。" +
      "前一步未完成时不得开始后一步；所有步骤完成前不得给出最终答复。计划如下：\n" +
      renderTaskPlan(activePlan)
    : options.teamTask
      ? GENERIC_PLAN_SYSTEM_PROMPT +
        "\n\n你是 Team 的 executor。只能在下列已审查计划范围内执行；仍必须遵守工具审批、工作区限制和真实工具回执。" +
        "不要自行扩大目标或跳过验证条件。\n已审查计划：" + options.teamTask.planSummary +
        "\n完成标准：" + (options.teamTask.verificationCriteria.join("；") || "结果满足用户请求且可由真实证据验证")
      : SYSTEM_PROMPT;
  const deliveryInstructions = options.deliveryContract?.requiresDeliverable
    ? "\n\n本轮存在运行时交付契约。你最终必须提供可验证交付证据,否则系统不会允许结束。\n" +
      renderDeliveryContract(options.deliveryContract) +
      "\n如果直接在聊天中交付代码、文档、报告、数据或文本,必须同时把完整交付内容放入最终输出 artifacts[].content；message 只做摘要或也可展示同一内容。" +
      "如果通过工具交付,必须等待对应工具成功回执。不能只承诺将要生成、将要写入或稍后继续。" +
      (deliveryWorkflow
        ? deliveryWorkflow.instructions()
        : "\n契约要求工作区落盘时，必须调用 write_file 写入当前工作区；只有 write_file 成功并完成回读校验后才能声称已保存。") +
      "契约列出的验证工具必须实际调用并依据成功回执完成；不要用文字描述代替工具调用。" +
      (requiresInlineFinalArtifact
        ? "\n本轮至少有一个交付物只能用 final_artifact 验收。优先调用 deliver_artifact 提交完整内容；也可以同时把内容放入最终 JSON 的 artifacts 数组。无论采用哪种方式，交付内容必须完整，不能只放摘要、计划或口头承诺。"
        : "")
    : "";
  let runtimeCompletionRepairInstruction = "";
  const buildAgent = (forcedTool?: string) => {
    const modelSettings = {
      parallelToolCalls: deliveryWorkflow?.parallelToolCalls ?? true,
      ...(forcedTool && !(model instanceof GatewayGuardedModel)
        ? { toolChoice: forcedTool }
        : {}),
    };
    const instructions = runtimeCompletionRepairInstruction
      ? executionInstructions +
        deliveryInstructions +
        "\n\n运行时完成验收未通过。你必须继续处理,不能直接结束:\n" +
        runtimeCompletionRepairInstruction
      : executionInstructions + deliveryInstructions;
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
  const initialWorkflowTool = deliveryWorkflow?.initialTool({
    isResume: Boolean(options.initialState),
  });
  if (initialWorkflowTool && model instanceof GatewayGuardedModel) {
    model.requireToolOnce(initialWorkflowTool);
  }
  let agent = buildAgent(initialWorkflowTool);

  const tracingDisabled = !(
    modelAdapter.provider === "openai" &&
    modelAdapter.apiFormat === "responses" &&
    !cfg.baseUrl.trim()
  );
  const runner = new Runner({
    tracingDisabled,
    toolExecution: { maxFunctionToolConcurrency: null },
  });
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  let output = "";
  let structuredOutput: IndustrialAgentOutput | undefined;

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
      risk: TOOL_RISK_BY_NAME[name] ?? "execute",
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
      recordToolResult(
        name,
        callId,
        result ?? syntheticToolFailureResult(name, call?.args ?? "", payload),
      );
    }
  };

  const verifyRequiredActions = async (): Promise<Artifact[]> => {
    const verificationTool = deliveryWorkflow?.requiredActionTool ?? requiredTool;
    if (!verificationTool) return [];
    const verified: Artifact[] = [];
    const calls = [...toolResults.values()].filter(
      (call) => call.name === verificationTool,
    );
    for (const call of calls) {
      if (!call.result.ok) continue;
      if (deliveryWorkflow) {
        const artifact = deliveryWorkflow.verifyRequiredAction(call);
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
      throw new AgentActionVerificationError(
        `用户明确要求执行 ${verificationTool}，但本轮没有调用该工具`,
      );
    }
    if (!successful) return verified;
    if (verificationTool === "write_file" && !verified.length) {
      throw new AgentActionVerificationError(
        deliveryWorkflow
          ? "工具 write_file 返回成功，但写入回执的 contentHash 与最近一次 validate_st_code 通过的完整草稿不一致"
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
      if (requiredTool === "write_file") {
        const pathValue = typeof args.path === "string" ? args.path : "目标文件";
        return `写入 ${pathValue} 失败：${error}`;
      }
      if (requiredTool === "export_st_program") {
        return `导出失败：${error}`;
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
    if (requiredTool === "read_file") {
      const pathValue = typeof args.path === "string" ? args.path : "目标文件";
      const totalLines = typeof data.totalLines === "number" ? ` · ${data.totalLines} 行` : "";
      const content = typeof data.content === "string" ? data.content : "";
      if (content && content.length <= 2_000) {
        return `已读取 ${pathValue}${totalLines}，内容如下：\n${content}`;
      }
      return `已读取 ${pathValue}${totalLines}${content ? "，内容较长，请查看上方工具执行详情。" : "。"}`;
    }
    if (requiredTool === "write_file") {
      const file = typeof data.file === "string"
        ? data.file
        : typeof args.path === "string" ? args.path : "目标文件";
      const bytes = typeof data.bytes === "number" ? ` · ${data.bytes} 字节` : "";
      return `已写入 ${file}${bytes}。`;
    }
    if (requiredTool === "export_st_program") {
      const file = typeof data.file === "string" ? data.file : ".st 文件";
      return `已导出 ${file}。`;
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
    return undefined;
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
    });

  const workflowToolRecords = () => [
    ...historicalToolResults,
    ...toolResults.values(),
  ];

  const authoritativeWorkflowMessage = (): string | undefined =>
    deliveryWorkflow?.authoritativeMessage(workflowToolRecords());

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

  const synthesizeStructuredOutputFromEvidence = (): IndustrialAgentOutput | undefined => {
    const message = authoritativeWorkflowMessage() ||
      output.trim() ||
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

  const chooseCompletionRepairTool = (
    gate: Exclude<CompletionGateResult, { passed: true }>,
  ): string | undefined => {
    const workflowRepairTool = deliveryWorkflow?.chooseRepairTool(
      gate,
      workflowToolRecords(),
      availableToolNames,
    );
    if (workflowRepairTool) return workflowRepairTool;

    // Verification is the first dependency in a delivery workflow. Once a
    // contract says a validator is required, force that named tool instead of
    // hoping the model will remember it from a repair paragraph.
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
        // Continue with the delivery evidence fallback below.
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
        const acceptableEvidence = Array.isArray(deliverable.acceptableEvidence)
          ? deliverable.acceptableEvidence.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        if (
          (deliverable.workspacePersistence === "required" ||
            acceptableEvidence.includes("successful_write")) &&
          availableToolNames.has("write_file")
        ) {
          return "write_file";
        }
        if (
          acceptableEvidence.includes("successful_export") &&
          availableToolNames.has("export_st_program")
        ) {
          return "export_st_program";
        }
        if (
          acceptableEvidence.includes("final_artifact") &&
          availableToolNames.has("deliver_artifact")
        ) {
          return "deliver_artifact";
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
      throw new AgentActionVerificationError(
        `运行时完成验收仍未通过: ${gate.reason}`,
      );
    }
    completionGateRetries += 1;
    runtimeCompletionRepairInstruction = gate.repairInstruction;
    const forcedRepairTool = chooseCompletionRepairTool(gate);
    agentLog(
      `[completion_gate] retry ${completionGateRetries}/${MAX_COMPLETION_GATE_RETRIES}: ${gate.reason}` +
        (forcedRepairTool ? ` | force_tool=${forcedRepairTool}` : ""),
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
    if (forcedRepairTool && model instanceof GatewayGuardedModel) {
      model.requireToolOnce(forcedRepairTool);
    }
    agent = buildAgent(forcedRepairTool);
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
    const risk = TOOL_RISK_BY_NAME[toolName];
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
      if (shouldSuppressProtocolEvent(event)) return;
      observeProtocolEvent(event);
      options.protocol.onEvent(event);
    },
  });

  const pump = async (
    stream: StreamedRunResult<any, any>,
  ): Promise<"done" | "empty-bailed" | "cancelled"> => {
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
        const candidate = tryParseJsonLikeOutput(stream.finalOutput);
        const parsed = industrialAgentOutputDefinition.schema.safeParse(candidate);
        if (parsed.success) {
          structuredOutput = parsed.data as IndustrialAgentOutput;
        } else {
          structuredOutput = coerceIndustrialAgentOutput(stream.finalOutput);
          if (!structuredOutput) {
            salvagedInvalidFinalOutput = true;
            agentLog(
              "[output] 最终输出不符合 schema，等待运行时根据工具账本完成验收",
            );
          } else {
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
        output = stream.finalOutput;
      }
    }
    if (
      structuredMode &&
      salvagedInvalidFinalOutput &&
      !structuredOutput &&
      output.trim()
    ) {
      structuredOutput = coerceIndustrialAgentOutput(output) ?? {
        message: output,
        diagnostics: [],
        artifacts: [],
        data: null,
      };
      output = structuredOutput.message;
      agentLog(
        "[output] 最终输出不符合 schema，已保留正文并交给运行时完成验收继续处理",
      );
    }
    if (
      structuredMode &&
      salvagedInvalidFinalOutput &&
      !structuredOutput
    ) {
      structuredOutput = synthesizeStructuredOutputFromEvidence();
      if (structuredOutput) {
        output = structuredOutput.message;
        agentLog(
          "[output] 最终输出不符合 schema，已根据工具账本合成完成结果",
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
    for (const hash of await loadValidatedStContent(session, userText)) {
      stValidationState.hashes.add(hash);
    }
    deliveryWorkflow?.hydrate(historicalToolResults);
  }

  // Approval checkpoints are first-class results. The host persists the
  // checkpoint and resumes the same SDK RunState with explicit decisions.
  let approvalRounds = 0;
  let forcedToolFallbackUsed = false;
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
      session,
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
      !forcedToolFallbackUsed &&
      (outcome === "empty-bailed" || !state.getInterruptions().length)
    ) {
      forcedToolFallbackUsed = true;
      if (model instanceof GatewayGuardedModel) {
        model.requireToolOnce(requiredTool);
      }
      agent = buildAgent(requiredTool);
      state.setCurrentAgent(agent);
      state._currentStep = { type: "next_step_run_again" };
      state._noActiveAgentRun = true;
      structuredOutput = undefined;
      output = "";
      continue;
    }
    if (outcome === "empty-bailed" || !state.getInterruptions().length) {
      if (!structuredMode) {
        assertPlanCompleted();
        const gate = runCompletionGate(output);
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
      if (!structuredOutput) {
        structuredOutput = synthesizeStructuredOutputFromEvidence();
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
          throw new AgentOutputValidationError(
            "Agent 未返回符合 Schema 的最终结构化结果",
          );
        }
      }
      assertPlanCompleted();
      const authoritativeMessage = authoritativeWorkflowMessage();
      const fallbackMessage = fallbackRequiredToolMessage();
      const rawMessage = structuredOutput.message.trim()
        ? structuredOutput.message
        : "";
      const message = authoritativeMessage ?? (
        rawMessage && !isInternalToolArtifactComplaint(rawMessage)
          ? rawMessage
          : fallbackMessage ?? structuredOutput.message
      );
      const structuredProjection = projectAgentOutput(
        industrialAgentOutputDefinition,
        structuredOutput,
      );
      const deliveredArtifacts = deliveredArtifactsFromTools();
      const gate = runCompletionGate(message, structuredProjection.artifacts);
      if (!gate.passed) {
        continueAfterCompletionGateFailure(state, gate);
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

export function validateConfig(cfg: AgentConfig): string | null {
  if (!cfg.apiKey)
    return "尚未配置 API Key:点击输入框右下角的 ⚙ 齿轮,在设置面板里填写 Base URL / API Key / Model(配置一次即可)";
  return null;
}
