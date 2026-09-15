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
} from "@openai/agents";
import { z } from "zod";
import OpenAI from "openai";
import { promises as fs } from "node:fs";
import path from "node:path";
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
import type { AuditEvent } from "../observability/audit";
import {
  createIndustrialAgentTeam,
  type IndustrialAgentMode,
} from "../orchestration/agentRoles";
import {
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
  parseIndustrialAgentOutput,
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

export { inferRequiredTool } from "../policy/actionPolicy";
export type { RequiredAgentTool } from "../policy/actionPolicy";

// 超轮次异常透传给 UI 层做友好提示
export { MaxTurnsExceededError };

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

function toolArguments(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
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

function buildTools(cfg: AgentConfig) {
  const policy = cfg.policy ?? new DefaultToolPolicy();
  const plc = cfg.plcAdapter ?? new MockPlcAdapter();
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

  const validateStCode = tool({
    name: "validate_st_code",
    description:
      "校验一段 IEC 61131-3 ST 代码，返回校验结果。参数 code 为完整 ST 源码。",
    parameters: z.object({ code: z.string().describe("完整 ST 源码") }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async ({ code }) => {
      if (!code.toUpperCase().includes("END_PROGRAM")) {
        return toolResult({
          ok: false,
          data: { errors: ["缺少 END_PROGRAM 结束标记"] },
          effect: "none",
          risk: "plan",
        });
      }
      if (code.includes("TON") && !code.includes("T#")) {
        return toolResult({
          ok: false,
          data: { errors: ["使用了 TON 但未发现时间字面量(如 T#5s)"] },
          effect: "none",
          risk: "plan",
        });
      }
      return contract({ errors: [] }, "plan");
    },
  });

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
        const m = /PROGRAM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(code);
        const name = m?.[1] ?? `program_${Date.now()}`;
        await fs.mkdir(cfg.exportDir, { recursive: true });
        const file = path.join(cfg.exportDir, `${name}.st`);
        await fs.writeFile(file, code, "utf8");
        return contract({ file }, "write", "filesystem");
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
      "读取已授权工作区内一个文本文件的内容。相对路径默认使用当前工作区，也可使用其他已授权工作区的绝对路径。可用 startLine/endLine 分段读大文件(缺省读全文)。",
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
        return contract({ totalLines: r.totalLines, content: r.text }, "read");
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
    execute: ({ path: p, content }) =>
      guard(
        async () => {
          const target = workspace.resolve(p);
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
                await writeFileText(target.root, target.relativePath, content),
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
      "在工作区根目录执行一条 shell 命令(60 秒超时,输出截断)。属于危险操作,执行前需要用户批准。",
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
  // Keep the full tool surface even when a required side-effect is inferred.
  // toolChoice / requireToolOnce still forces that tool on the first model
  // call; hiding the rest would block get_io_table / validate_st_code / etc.
  return allTools;
}

const SYSTEM_PROMPT =
  "你是工控行业的 PLC 编程助手，精通 IEC 61131-3。" +
  "编写程序前先调用 get_io_table 查询变量表，只使用表中已有的变量名。" +
  "生成 ST 代码后必须调用 validate_st_code 校验；如有错误要自行修正后重新校验，" +
  "直到通过为止，最后把通过校验的代码展示给用户。" +
  '当用户明确要求"导出/保存为文件"时，调用 export_st_program。' +
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

export class GatewayGuardedModel extends OpenAIChatCompletionsModel {
  private emptyStreak = 0;
  private requiredToolOnce?: RequiredAgentTool;
  private structuredToolChoiceSupport: GatewayStructuredToolChoiceSupport =
    "unknown";

  /** 每轮用户消息开始时清零,避免跨轮误伤 */
  resetEmptyStreak(): void {
    this.emptyStreak = 0;
    this.requiredToolOnce = undefined;
  }

  requireToolOnce(toolName: RequiredAgentTool): void {
    this.requiredToolOnce = toolName;
  }

  get structuredToolChoiceCapability(): GatewayStructuredToolChoiceSupport {
    return this.structuredToolChoiceSupport;
  }

  private async *streamWithCapabilityNegotiation(
    effectiveRequest: any,
    fallbackRequest: any,
    shouldNegotiate: boolean,
    requiredTool?: RequiredAgentTool,
  ): AsyncGenerator<any> {
    if (!shouldNegotiate) {
      for await (const ev of super.getStreamedResponse(
        effectiveRequest,
      ) as AsyncIterable<any>) {
        yield ev;
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
    const effectiveRequest =
      shouldNegotiate && this.structuredToolChoiceSupport === "unsupported"
        ? withoutStructuredOutput(forcedRequest)
        : forcedRequest;
    let sawOutput = false;
    for await (const ev of this.streamWithCapabilityNegotiation(
      effectiveRequest,
      withoutStructuredOutput(forcedRequest),
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

function hasRequiredToolCallEvent(
  event: any,
  requiredTool: RequiredAgentTool,
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
    return `${j.model} stream=${j.stream} tools=${tools} choice=${choice} format=${format} ${chain}`.slice(
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

function buildModelAdapter(cfg: AgentConfig): ModelAdapter {
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
  const adapter = buildModelAdapter(cfg);
  const planner = new Agent({
    name: "通用任务规划器",
    model: adapter.model,
    instructions:
      "你是通用任务规划器，不执行任何工具，也不输出领域专用方案。" +
      "判断用户目标是否包含两个或以上有先后关系、需要分别确认完成的动作。" +
      "单一问答、解释、改写或一次性操作返回 requiresPlan=false。" +
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
  // Keep the existing structured contract for Responses and Anthropic.
  // Plain OpenAI Chat Completions conversations can stream text directly.
  const textStreamingMode =
    modelAdapter.provider === "openai" &&
    modelAdapter.apiFormat === "chat_completions" &&
    cfg.orchestration !== "team" &&
    options.taskPlan === undefined &&
    requiredTool === undefined;
  const structuredMode = !textStreamingMode;
  if (model instanceof GatewayGuardedModel) model.resetEmptyStreak(); // 熔断计数每轮用户消息重新计
  let activePlan = options.taskPlan ? structuredClone(options.taskPlan) : undefined;
  const planProgressTool = activePlan
    ? tool({
        name: "report_plan_progress",
        description: "报告通用线性计划中一个步骤的开始或完成。只能按计划顺序调用，不执行外部副作用。",
        parameters: z.object({
          stepId: z.string().describe("计划中的步骤 ID，例如 step-1"),
          phase: z.enum(["started", "completed"]),
          note: z.string().optional().describe("简短说明本步骤的实际进展或完成依据"),
        }),
        execute: async (progress) => {
          activePlan = updateTaskPlan(activePlan!, progress as TaskPlanProgress);
          await options.onPlanProgress?.(progress as TaskPlanProgress);
          return toolResult({
            ok: true,
            data: {
              stepId: progress.stepId,
              phase: progress.phase,
              planStatus: activePlan.status,
            },
            effect: "none",
            risk: "plan",
          });
        },
      })
    : undefined;
  const tools = [
    ...buildTools(cfg),
    ...(planProgressTool ? [planProgressTool] : []),
  ];
  const executionInstructions = activePlan
    ? GENERIC_PLAN_SYSTEM_PROMPT +
      "\n\n当前请求使用通用线性计划，不要把它强行改写成某一种 PLC/ST 场景；以计划目标和用户原始要求为准。" +
      "你正在执行一个已经批准的通用线性计划。必须严格按步骤顺序工作。" +
      "开始每一步前调用 report_plan_progress(stepId, started)；达到该步完成标准后调用 report_plan_progress(stepId, completed)。" +
      "前一步未完成时不得开始后一步；所有步骤完成前不得给出最终答复。计划如下：\n" +
      renderTaskPlan(activePlan)
    : SYSTEM_PROMPT;
  const buildAgent = (forcedTool?: RequiredAgentTool) => {
    const forceToolChoice =
      forcedTool && !(model instanceof GatewayGuardedModel)
        ? { toolChoice: forcedTool }
        : undefined;
    if (cfg.orchestration === "team") {
      const team = createIndustrialAgentTeam(model, tools, {
        executorStructuredOutput: true,
        executorModelSettings: forceToolChoice,
      });
      // Explicit side effects bypass planning and enter the controlled executor.
      return requiredTool ? team.executor : team.planner;
    }
    return new Agent({
      name: "PLC 编程助手",
      model,
      instructions: executionInstructions,
      tools,
      ...(forceToolChoice ? { modelSettings: forceToolChoice } : {}),
      // Gateway capability negotiation happens inside GatewayGuardedModel;
      // Ordinary conversation stays text-native so the UI can receive
      // text.delta events; action turns keep the canonical schema.
      ...(structuredMode
        ? { outputType: industrialAgentOutputDefinition.schema }
        : {}),
    });
  };
  let agent = buildAgent();

  const tracingDisabled = !(
    modelAdapter.provider === "openai" &&
    modelAdapter.apiFormat === "responses" &&
    !cfg.baseUrl.trim()
  );
  const runner = new Runner({ tracingDisabled });
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  let output = "";
  let structuredOutput: IndustrialAgentOutput | undefined;

  // callId → 工具名:tool_call_output_item 在 chat_completions 转换下不一定带 name,靠调用时的映射回填
  const toolNameByCallId = new Map<string, string>();
  const toolCalls = new Map<string, { name: string; args: string }>();
  const toolResults = new Map<
    string,
    { name: string; args: string; result: ToolResult }
  >();

  const recordToolCall = (
    name: string,
    callId: string | undefined,
    args: string,
  ): void => {
    const key = callId || `${name}:${toolCalls.size}`;
    toolCalls.set(key, { name, args });
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
      recordToolResult(name, callId, payload.result as ToolResult | undefined);
    }
  };

  const verifyRequiredActions = async (): Promise<Artifact[]> => {
    if (!requiredTool) return [];
    const verified: Artifact[] = [];
    for (const call of toolResults.values()) {
      if (call.name !== requiredTool || !call.result.ok) continue;
      // Every required side-effect must have a successful structured tool
      // result. File writes additionally get a read-back byte-for-byte check.
      if (requiredTool !== "write_file") continue;
      let args: { path?: unknown; content?: unknown };
      try {
        args = JSON.parse(call.args) as { path?: unknown; content?: unknown };
      } catch {
        continue;
      }
      if (typeof args.path !== "string" || typeof args.content !== "string")
        continue;
      verified.push(
        await verifyWorkspaceWrite(workspace, args.path, args.content),
      );
    }
    const successful = [...toolResults.values()].some(
      (call) => call.name === requiredTool && call.result.ok,
    );
    if (!successful || (requiredTool === "write_file" && !verified.length)) {
      throw new AgentActionVerificationError(
        `用户明确要求执行 ${requiredTool}，但本轮没有成功执行并确认该工具`,
      );
    }
    return verified;
  };

  const hasSuccessfulRequiredAction = (): boolean => {
    if (!requiredTool) return true;
    return [...toolResults.values()].some(
      (call) => call.name === requiredTool && call.result.ok,
    );
  };

  const assertPlanCompleted = (): void => {
    if (activePlan && activePlan.status !== "completed") {
      const pending = activePlan.steps.find((step) => step.status !== "completed");
      throw new AgentActionVerificationError(
        `线性计划尚未完成${pending ? `: ${pending.id} ${pending.title}` : ""}`,
      );
    }
  };

  // 空回复熔断:按"本轮结束"处理(工具回执已透出,不必再向用户抛错)
  const protocolAdapter = new AgentStreamAdapter({
    runId: options.protocol.runId,
    operationId: options.protocol.operationId,
    structuredOutput: structuredMode,
    eventFactory: options.protocol.eventFactory,
    emit: (event) => {
      observeProtocolEvent(event);
      options.protocol.onEvent(event);
    },
  });

  const pump = async (
    stream: StreamedRunResult<any, any>,
  ): Promise<"done" | "empty-bailed" | "cancelled"> => {
    let bailed = false;
    let cancelled = false;
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
        structuredOutput = parseIndustrialAgentOutput(stream.finalOutput);
        const projected = projectAgentOutput(
          industrialAgentOutputDefinition,
          structuredOutput,
        );
        output = projected.text;
      } else if (typeof stream.finalOutput === "string") {
        output = stream.finalOutput;
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
    const unresolved: ApprovalRequest[] = [];
    const refused: ApprovalRequest[] = [];
    for (let index = 0; index < pending.length; index++) {
      const item = pending[index];
      const request = requests[index];
      // On a durable resume the SDK may emit only tool output after approval.
      // Seed the call index from the persisted approval so verification still
      // has the original tool arguments.
      recordToolCall(request.name, request.id, request.args);
      toolNameByCallId.set(request.id, request.name);
      let decision = decisions.get(request.id);
      if (decision !== undefined) decisions.delete(request.id);
      if (decision === undefined) {
        unresolved.push(request);
      } else if (decision) {
        state.approve(item);
      } else {
        state.reject(item, { message: "用户拒绝了该工具调用。" });
        refused.push(request);
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
      !hasSuccessfulRequiredAction() &&
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
        throw new AgentOutputValidationError(
          "Agent 未返回符合 Schema 的最终结构化结果",
        );
      }
      assertPlanCompleted();
      const verifiedArtifacts = await verifyRequiredActions();
      const canonicalOutput: IndustrialAgentOutput = {
        ...structuredOutput,
        artifacts: [
          ...structuredOutput.artifacts,
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
        output: structuredOutput.message,
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
