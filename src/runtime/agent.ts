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
  setTracingDisabled,
  OpenAIChatCompletionsModel,
  MaxTurnsExceededError,
  RunState,
  defineToolInputGuardrail,
  defineToolOutputGuardrail,
  ToolGuardrailFunctionOutputFactory,
  type RunToolApprovalItem,
  type Session,
  type StreamedRunResult,
} from '@openai/agents';
import { z } from 'zod';
import OpenAI from 'openai';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listFiles, readFileRange, writeFileText, searchText, runCommand } from '../tools/workspaceTools';
import { EffectRecoveryRequiredError } from './errors';
import { DefaultToolPolicy, type ToolPolicy, toolResult, type ToolRisk } from '../tools/toolContract';
import { MockPlcAdapter, type PlcAdapter } from '../plc/plcAdapter';
import type { AuditEvent } from '../observability/audit';
import { createIndustrialAgentTeam, type IndustrialAgentMode } from '../orchestration/agentRoles';
import { parseToolResult, type ApprovalRequest as ProtocolApprovalRequest, type UsageSummary } from '../protocol/results';
import { AgentStreamAdapter } from './streaming';
import type { AgentEventFactory, AgentProtocolEvent } from '../protocol/events';
import {
  getAgentOutputDefinition,
  projectAgentOutput,
  type AgentOutputMode,
} from './output';
import type { Artifact, Diagnostic } from '../protocol/results';

// 网关场景必须关闭 tracing:轨迹上传 OpenAI 官方服务会失败刷屏。
// 必须在模块加载时调用,运行时设置无效。
setTracingDisabled(true);

// 超轮次异常透传给 UI 层做友好提示
export { MaxTurnsExceededError };

export interface AgentConfig {
  /** OpenAI 兼容网关地址(带 /v1),空 = 官方 API */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** export_st_program 工具的落盘目录 */
  exportDir: string;
  /** 当前工作区根目录(文件类工具的作用域边界),空 = 未打开工作区 */
  workspaceRoot: string;
  /** Host-owned effect journal. It may return a previously committed result. */
  executeEffect?: <T>(toolName: string, input: unknown, execute: () => Promise<T>) => Promise<T>;
  /** Policy is host-owned and must be enforced before side effects. */
  policy?: ToolPolicy;
  policyContext?: { allowedCommands?: string[]; allowedDevices?: string[]; dryRun?: boolean };
  plcAdapter?: PlcAdapter;
  audit?: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void | Promise<void>;
  orchestration?: IndustrialAgentMode;
  /** Text is the compatibility default; structured uses the SDK outputType contract. */
  outputMode?: AgentOutputMode;
}

/** UI 关心的事件:正文增量 / 工具调用提示 / 工具执行结果 */
export type AgentEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string }
  /** 工具真正执行完(或被拒绝)的回执。UI 必须渲染它:部分网关在工具结果回喂后模型返回空文本 */
  | { type: 'tool_result'; name: string; ok: boolean; summary: string };

/**
 * 需要用户批准的工具被调用时,内核通过它向 UI 请求决定(宿主实现:发审批卡片,等点击)。
 */
export type ApprovalRequester = (toolName: string, args: string) => Promise<boolean>;

/** Stable, UI-safe description of a pending approval checkpoint. */
/** Backward-compatible alias; the protocol owns the serialized shape. */
export type ApprovalRequest = ProtocolApprovalRequest;

export type AgentRunStatus = 'completed' | 'awaiting_approval' | 'cancelled';

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
  /** Omit for a durable external approval flow; provide for the legacy inline flow. */
  requestApproval?: ApprovalRequester;
  /** Called whenever a resumable state is available or changes. */
  onCheckpoint?: (checkpoint: AgentRunCheckpoint) => Promise<void> | void;
  /** Stable event envelope shared by the host, UI, tracing and future MCP tools. */
  protocol?: {
    runId: string;
    operationId?: string;
    eventFactory?: AgentEventFactory;
    onEvent: (event: AgentProtocolEvent) => void;
  };
}

export interface AgentRunResult {
  output: string;
  usage: TurnUsage;
  status: AgentRunStatus;
  state?: string;
  approvals?: ApprovalRequest[];
  structuredOutput?: unknown;
  diagnostics?: Diagnostic[];
  artifacts?: Artifact[];
}

// ---------- 工具(策略/审计/设备适配器由宿主注入,工具合同保持稳定) ----------

type ToolEffect = 'none' | 'filesystem' | 'process' | 'device';

function toolArguments(raw: string | undefined): unknown {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return raw; }
}

function audit(cfg: AgentConfig, event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
  void Promise.resolve(cfg.audit?.(event)).catch(() => undefined);
}

function buildToolGuardrails(cfg: AgentConfig, policy: ToolPolicy) {
  const context = { workspaceRoot: cfg.workspaceRoot, ...cfg.policyContext };
  const input = defineToolInputGuardrail({
    name: 'industrial-tool-policy',
    run: async ({ toolCall }) => {
      const call = toolCall as { name?: string; arguments?: string };
      const name = call.name ?? 'unknown_tool';
      const decision = policy.evaluate(name, toolArguments(call.arguments), context);
      audit(cfg, {
        type: 'guardrail_evaluated', toolName: name, risk: decision.risk,
        decision: decision.allowed ? 'allow' : 'deny',
        metadata: { requiresApproval: decision.requiresApproval, reason: decision.reason },
      });
      return decision.allowed
        ? ToolGuardrailFunctionOutputFactory.allow(decision)
        : ToolGuardrailFunctionOutputFactory.rejectContent(decision.reason ?? '工具调用被工控安全策略拒绝。', decision);
    },
  });
  const output = defineToolOutputGuardrail({
    name: 'structured-tool-output',
    run: async ({ toolCall, output: result }) => {
      const name = (toolCall as { name?: string }).name ?? 'tool';
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      try {
        const parsed = parseToolResult(JSON.parse(text));
        audit(cfg, {
          type: 'tool_completed',
          toolName: name,
          risk: String(parsed.risk),
          ok: parsed.ok === true,
        });
        return ToolGuardrailFunctionOutputFactory.allow();
      } catch {
        audit(cfg, { type: 'tool_completed', toolName: name, decision: 'deny', ok: false, summary: '非结构化工具结果' });
        return ToolGuardrailFunctionOutputFactory.rejectContent('工具未返回约定的结构化结果，已拒绝将其用于后续决策。');
      }
    },
  });
  return { input: [input], output: [output] };
}

function buildTools(cfg: AgentConfig) {
  const policy = cfg.policy ?? new DefaultToolPolicy();
  const plc = cfg.plcAdapter ?? new MockPlcAdapter();
  const guardrails = buildToolGuardrails(cfg, policy);
  const withEffect = <T>(toolName: string, input: unknown, risk: ToolRisk, execute: () => Promise<T>) => {
    audit(cfg, { type: 'tool_requested', toolName, risk });
    const run = () => execute();
    return cfg.executeEffect ? cfg.executeEffect(toolName, input, run) : run();
  };
  const contract = <T>(data: T, risk: ToolRisk, effect: ToolEffect = 'none') =>
    toolResult({ ok: true, data, effect, risk });
  const failed = (error: unknown, risk: ToolRisk, effect: ToolEffect = 'none') =>
    toolResult({ ok: false, error: error instanceof Error ? error.message : String(error), effect, risk });
  const getIoTable = tool({
    name: 'get_io_table',
    description: '查询当前 PLC 项目的 I/O 变量表。',
    parameters: z.object({}),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async () => {
      try { return contract({ adapter: plc.id, variables: await plc.getIoTable() }, 'read'); }
      catch (error) { return failed(error, 'read'); }
    },
  });

  const readPlcVariables = tool({
    name: 'read_plc_variables',
    description: '从已配置的 PLC 适配器读取指定变量的当前值，只读且不改变设备状态。',
    parameters: z.object({ names: z.array(z.string()).min(1).describe('要读取的 PLC 变量名') }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async ({ names }) => {
      try { return contract({ adapter: plc.id, variables: await plc.readVariables(names) }, 'read'); }
      catch (error) { return failed(error, 'read'); }
    },
  });

  const validateStCode = tool({
    name: 'validate_st_code',
    description: '校验一段 IEC 61131-3 ST 代码，返回校验结果。参数 code 为完整 ST 源码。',
    parameters: z.object({ code: z.string().describe('完整 ST 源码') }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async ({ code }) => {
      if (!code.toUpperCase().includes('END_PROGRAM')) {
        return toolResult({ ok: false, data: { errors: ['缺少 END_PROGRAM 结束标记'] }, effect: 'none', risk: 'plan' });
      }
      if (code.includes('TON') && !code.includes('T#')) {
        return toolResult({ ok: false, data: { errors: ['使用了 TON 但未发现时间字面量(如 T#5s)'] }, effect: 'none', risk: 'plan' });
      }
      return contract({ errors: [] }, 'plan');
    },
  });

  // 会往磁盘写文件 → needsApproval:SDK 在真正执行前中断,由 UI 批准/拒绝
  const exportStProgram = tool({
    name: 'export_st_program',
    description:
      '把一段完整的 IEC 61131-3 ST 程序导出为 .st 文件保存到本地(用户要求"导出/保存/落地文件"时使用)。',
    parameters: z.object({
      code: z.string().describe('完整 ST 源码(PROGRAM ... END_PROGRAM)'),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ code }) => withEffect('export_st_program', { code }, 'write', async () => {
      const m = /PROGRAM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(code);
      const name = m?.[1] ?? `program_${Date.now()}`;
      await fs.mkdir(cfg.exportDir, { recursive: true });
      const file = path.join(cfg.exportDir, `${name}.st`);
      await fs.writeFile(file, code, 'utf8');
      return contract({ file }, 'write', 'filesystem');
    }),
  });

  // ---- 通用工作区文件工具(作用域锁定在当前工作区根目录) ----
  const guard = (fn: () => Promise<string>, risk: ToolRisk, effect: ToolEffect = 'none'): Promise<string> =>
    fn().catch((e: unknown) => {
      if (e instanceof EffectRecoveryRequiredError) throw e;
      return failed(e, risk, effect);
    });

  const listFilesTool = tool({
    name: 'list_files',
    description: '列出当前工作区内的文件(相对根目录,自动跳过 node_modules/.git/dist 等)。参数 dir 为相对子目录,默认根目录。',
    parameters: z.object({ dir: z.string().optional().describe('相对子目录,留空表示工作区根') }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ dir }) =>
      guard(async () => contract({ files: await listFiles(cfg.workspaceRoot, dir ?? '.') }, 'read'), 'read'),
  });

  const readFileTool = tool({
    name: 'read_file',
    description: '读取工作区内一个文本文件的内容。可用 startLine/endLine 分段读大文件(缺省读前 4000 行)。',
    parameters: z.object({
      path: z.string().describe('相对工作区的文件路径'),
      startLine: z.number().optional().describe('起始行(1 起)'),
      endLine: z.number().optional().describe('结束行(含)'),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p, startLine, endLine }) =>
      guard(async () => {
        const r = await readFileRange(cfg.workspaceRoot, p, startLine, endLine);
        return contract({ totalLines: r.totalLines, content: r.text }, 'read');
      }, 'read'),
  });

  const searchFilesTool = tool({
    name: 'search_files',
    description: '在工作区文件里做文本搜索,返回 "相对路径:行号: 内容"。支持 glob 文件名过滤(如 *.st)与 isRegex 正则。',
    parameters: z.object({
      text: z.string().describe('要搜索的字面量或正则'),
      glob: z.string().optional().describe('按文件名过滤,如 *.st'),
      isRegex: z.boolean().optional().describe('是否按正则解析 text'),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ text, glob, isRegex }) =>
      guard(async () => contract({ matches: await searchText(cfg.workspaceRoot, text, { glob, isRegex }) }, 'read'), 'read'),
  });

  const writeFileTool = tool({
    name: 'write_file',
    description: '把文本内容写入工作区内的文件(会覆盖)。属于写操作,执行前需要用户在界面批准。',
    parameters: z.object({
      path: z.string().describe('相对工作区的文件路径'),
      content: z.string().describe('要写入的完整文本内容'),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p, content }) =>
      guard(
        () => withEffect('write_file', { path: p, content }, 'write', async () =>
          contract(await writeFileText(cfg.workspaceRoot, p, content), 'write', 'filesystem'),
        ),
        'write',
        'filesystem',
      ),
  });

  const runCommandTool = tool({
    name: 'run_command',
    description: '在工作区根目录执行一条 shell 命令(60 秒超时,输出截断)。属于危险操作,执行前需要用户批准。',
    parameters: z.object({ command: z.string().describe('要执行的命令行') }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ command }, _context, details) =>
      guard(
        () => withEffect('run_command', { command }, 'execute', async () =>
          contract(await runCommand(cfg.workspaceRoot, command, 60_000, details?.signal), 'execute', 'process'),
        ),
        'execute',
        'process',
      ),
  });

  return [getIoTable, readPlcVariables, validateStCode, exportStProgram, listFilesTool, readFileTool, searchFilesTool, writeFileTool, runCommandTool];
}

const SYSTEM_PROMPT =
  '你是工控行业的 PLC 编程助手，精通 IEC 61131-3。' +
  '编写程序前先调用 get_io_table 查询变量表，只使用表中已有的变量名。' +
  '生成 ST 代码后必须调用 validate_st_code 校验；如有错误要自行修正后重新校验，' +
  '直到通过为止，最后把通过校验的代码展示给用户。' +
  '当用户明确要求"导出/保存为文件"时，调用 export_st_program。' +
  '你还可以操作当前打开的工作区：用 list_files 看目录、read_file 读文件、' +
  'search_files 搜索代码、write_file 写文件、run_command 执行命令' +
  '（write_file 和 run_command 会先征求用户批准）。' +
  '任何工具执行完成后，无论成功还是失败，都必须用一两句中文向用户确认执行结果，' +
  '不允许调用完工具不给结论就结束。回答要简洁，用中文。';

// ---------- 模型构建(网关适配:chat_completions 协议) ----------

/** 网关连续返回空 completion(无任何内容/工具)时抛出,用于截停 SDK 的无限重试 */
export class EmptyGatewayResponseError extends Error {
  constructor() {
    super('模型连续返回空响应:网关在收到工具结果(或首次请求)后返回了"空内容完成"。已自动停止重试。');
    this.name = 'EmptyGatewayResponseError';
  }
}

/**
 * 带"空回复熔断"的 chat_completions 模型。
 *
 * 背景:部分 OpenAI 兼容网关(尤其套壳推理模型)会返回 `finish_reason=stop` 但 content 为空的
 * completion;SDK 把这种响应当作"未完成"而反复重发同一请求,直到烧满 maxTurns。时间轴上的
 * 看门狗追不上响应飞快的网关(实测 10 连发仅 84ms),所以在模型层同步归因:
 * 一次响应若既无内容增量、最终 output 也为空 → 记 1 次空回复;连续 2 次即抛错截停。
 */
class GatewayGuardedModel extends OpenAIChatCompletionsModel {
  private emptyStreak = 0;

  /** 每轮用户消息开始时清零,避免跨轮误伤 */
  resetEmptyStreak(): void {
    this.emptyStreak = 0;
  }

  async *getStreamedResponse(request: any): AsyncGenerator<any> {
    let sawOutput = false;
    for await (const ev of super.getStreamedResponse(request) as AsyncIterable<any>) {
      // chat_completions 下 SDK 只透出 response_started/model/output_text_delta,没有终结的
      // model_response 事件,所以直接看原始 chunk 的 delta:有正文或 tool_calls 就不算空回复
      if (ev?.type === 'output_text_delta') sawOutput = true;
      const delta = ev?.event?.choices?.[0]?.delta ?? ev?.providerData?.choices?.[0]?.delta;
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

// ---------- 网关原始报文诊断(写入 "PLC Agent" 输出面板) ----------
// 排查"模型不返回总结"这类问题:把每次发给网关的消息结构、每次响应 SSE 的解析摘要
// (正文/推理/工具调用字符数、finish_reason、错误体)全部留痕,复现一次即可定位。
let agentLog: (line: string) => void = () => {};
export function setAgentLogger(fn: (line: string) => void): void {
  agentLog = fn;
}

function summarizeOutgoing(body: unknown): string {
  try {
    const j = (typeof body === 'string' ? JSON.parse(body) : body) as {
      model?: string;
      stream?: boolean;
      messages?: { role: string; content?: unknown; tool_calls?: { function?: { name?: string } }[] }[];
    };
    const chain = (j.messages ?? [])
      .map((m) =>
        m.role === 'assistant' && m.tool_calls?.length
          ? `assistant(tool_calls:${m.tool_calls.map((t) => t.function?.name).join('|')})`
          : `${m.role}(len=${typeof m.content === 'string' ? m.content.length : '-'})`,
      )
      .join(' ');
    return `${j.model} stream=${j.stream} ${chain}`.slice(0, 600);
  } catch {
    return '(请求体无法解析)';
  }
}

function makeLoggingFetch(): unknown {
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const isChat = url.includes('/chat/completions');
    if (isChat) agentLog(`[req] ${summarizeOutgoing(init?.body)}`);
    const resp = await fetch(input as never, init as never);
    if (!isChat || !resp.body) return resp;
    const [userSide, tap] = resp.body.tee(); // 原样透传给 SDK,旁路只做解析统计
    void (async () => {
      let text = '';
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
      let finish = '-';
      let errorLine = '';
      for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload) as {
            error?: unknown;
            choices?: { finish_reason?: string | null; delta?: Record<string, unknown> }[];
          };
          if (j.error) { errorLine = JSON.stringify(j.error).slice(0, 300); continue; }
          const c = j.choices?.[0];
          if (c?.finish_reason) finish = c.finish_reason;
          const d = c?.delta ?? {};
          if (typeof d.content === 'string') contentChars += d.content.length;
          const rz = (d.reasoning_content ?? d.reasoning) as string | undefined;
          if (typeof rz === 'string') reasoningChars += rz.length;
          if (Array.isArray(d.tool_calls)) toolCallDeltas += d.tool_calls.length;
        } catch { /* 非 JSON 行忽略 */ }
      }
      agentLog(
        `[resp] HTTP ${resp.status} 正文=${contentChars}字符 推理=${reasoningChars}字符 工具增量=${toolCallDeltas} finish=${finish}${errorLine ? ' ERROR=' + errorLine : ''}`,
      );
      if (contentChars === 0 && reasoningChars === 0 && toolCallDeltas === 0) {
        agentLog(`[resp] 空完成原文(尾部): ${text.slice(-500).replace(/\n/g, '⏎')}`);
      }
    })();
    return new Response(userSide, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  };
}

const modelCache = new Map<string, GatewayGuardedModel>();

function buildModel(cfg: AgentConfig): string | GatewayGuardedModel {
  if (!cfg.baseUrl) return cfg.model; // 无网关:走官方默认(Responses API)
  const key = `${cfg.baseUrl}|${cfg.apiKey}|${cfg.model}`;
  let m = modelCache.get(key);
  if (!m) {
    const client = new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey, fetch: makeLoggingFetch() as never });
    m = new GatewayGuardedModel(client, cfg.model);
    modelCache.set(key, m);
  }
  return m;
}

// ---------- 一轮对话:流式执行 + 会话持久化 + 审批中断/恢复 ----------

/** 本轮 token 用量(从模型响应的 usage 汇总;网关不返回 usage 字段时全为 0) */
/** Backward-compatible protocol alias used by runtime/run store. */
export type TurnUsage = UsageSummary;

/** 单次用户消息允许的最大模型往返轮数,防止工具死循环烧额度 */
export const MAX_TURNS = 10;

/**
 * 跑完一整轮用户消息:
 * - 历史由 session 自动读写(不再手工传 history 数组)
 * - 遇到 needsApproval 工具 → requestApproval 等 UI 决定 → approve/reject 后带 state 续跑
 * - 超 MAX_TURNS 轮抛 MaxTurnsExceededError
 */
export async function runAgentTurn(
  cfg: AgentConfig,
  session: Session,
  userText: string,
  onEvent: (ev: AgentEvent) => void,
  requestApproval: ApprovalRequester,
): Promise<Pick<AgentRunResult, 'output' | 'usage' | 'structuredOutput' | 'diagnostics' | 'artifacts'>> {
  const result = await runAgent(cfg, session, userText, onEvent, {
    requestApproval,
  });
  return {
    output: result.output,
    usage: result.usage,
    structuredOutput: result.structuredOutput,
    diagnostics: result.diagnostics,
    artifacts: result.artifacts,
  };
}

/**
 * Product-facing execution entry point. The returned `state` is an SDK-native
 * RunState snapshot and is safe to persist with the host's run store. A state
 * is only returned for a pending approval; completed and cancelled runs cannot
 * be resumed as if they were still active.
 */
export async function runAgent(
  cfg: AgentConfig,
  session: Session,
  userText: string,
  onEvent: (ev: AgentEvent) => void,
  options: AgentRunOptions = {},
): Promise<AgentRunResult> {
  const model = buildModel(cfg);
  if (model instanceof GatewayGuardedModel) model.resetEmptyStreak(); // 熔断计数每轮用户消息重新计
  const tools = buildTools(cfg);
  const outputDefinition = getAgentOutputDefinition(cfg.outputMode);
  const agent = cfg.orchestration === 'team'
    ? createIndustrialAgentTeam(model, tools, outputDefinition).planner
    : new Agent({
      name: 'PLC 编程助手',
      model,
      instructions: SYSTEM_PROMPT,
      tools,
      ...(outputDefinition ? { outputType: outputDefinition.schema } : {}),
    });

  const runner = new Runner();
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  let output = '';
  let structuredOutput: unknown;
  let diagnostics: Diagnostic[] | undefined;
  let artifacts: Artifact[] | undefined;

  // callId → 工具名:tool_call_output_item 在 chat_completions 转换下不一定带 name,靠调用时的映射回填
  const toolNameByCallId = new Map<string, string>();

  const summarizeToolOutput = (out: unknown): { ok: boolean; summary: string } => {
    const flat = Array.isArray(out)
      ? out.map((p) => (typeof p === 'string' ? p : (p as { text?: string })?.text ?? '')).join('')
      : typeof out === 'string'
        ? out
        : JSON.stringify(out ?? '');
    let ok = true;
    try {
      const parsed = JSON.parse(flat) as { ok?: boolean; error?: unknown } | unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as { ok?: boolean; error?: unknown };
        ok = obj.ok !== false && obj.error === undefined;
      }
    } catch {
      // 非 JSON(如 SDK 的拒绝文案 "user rejected tool call")
      ok = !/reject|denied/i.test(flat);
    }
    const summary = flat.length > 200 ? flat.slice(0, 200) + '…' : flat;
    return { ok, summary };
  };

  const legacyPump = async (stream: StreamedRunResult<any, any>): Promise<'done' | 'empty-bailed'> => {
    let bailed = false;
    try {
      for await (const event of stream) {
        if (event.type === 'raw_model_stream_event') {
          if (event.data.type === 'output_text_delta') {
            const delta = event.data.delta ?? '';
            if (delta) {
              output += delta;
              onEvent({ type: 'delta', text: delta });
            }
          }
        } else if (event.type === 'run_item_stream_event') {
          if (event.item.type === 'tool_call_item') {
            const raw = event.item.rawItem as { name?: string; callId?: string } | undefined;
            if (raw?.callId && raw.name) toolNameByCallId.set(raw.callId, raw.name);
            onEvent({ type: 'tool', name: raw?.name ?? 'tool' });
          } else if (event.item.type === 'tool_call_output_item') {
            // 工具已执行完(或审批被拒),把回执透出给 UI —— 即使随后模型不再返回文本,用户也能看到成败
            const raw = event.item.rawItem as { name?: string; callId?: string } | undefined;
            const name = raw?.name || toolNameByCallId.get(raw?.callId ?? '') || 'tool';
            const { ok, summary } = summarizeToolOutput((event.item as { output?: unknown }).output);
            onEvent({ type: 'tool_result', name, ok, summary });
          }
        }
      }
    } catch (e) {
      // 空回复熔断:按"本轮结束"处理(工具回执已透出,不必再向用户抛错)
      if (!(e instanceof EmptyGatewayResponseError)) throw e;
      bailed = true;
    }
    // RunState owns aggregate usage and survives serialization. Reading it here
    // avoids double-counting raw responses after a durable resume.
    usage.requests = stream.state.usage.requests;
    usage.inputTokens = stream.state.usage.inputTokens;
    usage.outputTokens = stream.state.usage.outputTokens;
    return bailed ? 'empty-bailed' : 'done';
  };

  const protocolAdapter = options.protocol
    ? new AgentStreamAdapter({
      runId: options.protocol.runId,
      operationId: options.protocol.operationId,
      eventFactory: options.protocol.eventFactory,
      emit: options.protocol.onEvent,
    })
    : undefined;

  const pump = async (stream: StreamedRunResult<any, any>): Promise<'done' | 'empty-bailed'> => {
    if (!protocolAdapter) return legacyPump(stream);
    let bailed = false;
    try {
      const adapted = await protocolAdapter.consume(stream, {
        onLegacyEvent: (event) => {
          if (event.type === 'delta') {
            output += event.text;
            onEvent({ type: 'delta', text: event.text });
          } else if (event.type === 'tool') {
            onEvent({ type: 'tool', name: event.name });
          } else {
            onEvent({ type: 'tool_result', name: event.name, ok: event.ok, summary: event.summary });
          }
        },
      });
      usage.inputTokens = adapted.usage.inputTokens;
      usage.outputTokens = adapted.usage.outputTokens;
      usage.requests = adapted.usage.requests;
    } catch (e) {
      if (!(e instanceof EmptyGatewayResponseError)) throw e;
      bailed = true;
      usage.requests = stream.state.usage.requests;
      usage.inputTokens = stream.state.usage.inputTokens;
      usage.outputTokens = stream.state.usage.outputTokens;
    }
    if (outputDefinition && stream.finalOutput !== undefined) {
      structuredOutput = stream.finalOutput;
      const projected = projectAgentOutput(outputDefinition, stream.finalOutput);
      output = projected.text;
      diagnostics = projected.diagnostics;
      artifacts = projected.artifacts;
    }
    return bailed ? 'empty-bailed' : 'done';
  };

  const checkpoint = async (state: RunState<any, any>, approvals: ApprovalRequest[]) => {
    await options.onCheckpoint?.({
      state: state.toString(),
      approvals,
      output,
      usage: { ...usage },
    });
  };

  const approvalId = (item: RunToolApprovalItem, index: number) => {
    const raw = item.rawItem as { name?: string; callId?: string };
    return raw.callId ?? `${raw.name ?? 'tool'}:${index}`;
  };

  const decisions = new Map(Object.entries(options.decisions ?? {}));
  const resolveApprovals = async (
    state: RunState<any, any>,
    pending: RunToolApprovalItem[],
  ): Promise<ApprovalRequest[]> => {
    const requests = pending.map((item, index) => {
      const raw = item.rawItem as { name?: string; arguments?: string };
      return {
        id: approvalId(item, index),
        name: raw.name ?? 'tool',
        args: raw.arguments ?? '',
      };
    });
    const unresolved: ApprovalRequest[] = [];
    for (let index = 0; index < pending.length; index++) {
      const item = pending[index];
      const request = requests[index];
      let decision = decisions.get(request.id);
      if (decision !== undefined) decisions.delete(request.id);
      if (decision === undefined && options.requestApproval) {
        decision = await options.requestApproval(request.name, request.args);
      }
      if (decision === undefined) {
        unresolved.push(request);
      } else if (decision) {
        state.approve(item);
      } else {
        state.reject(item, { message: '用户拒绝了该工具调用。' });
      }
    }
    return unresolved;
  };

  let state: RunState<any, any> | undefined;
  if (options.initialState) {
    state = await RunState.fromString(agent, options.initialState);
    state.clearTrace();
    usage.requests = state.usage.requests;
    usage.inputTokens = state.usage.inputTokens;
    usage.outputTokens = state.usage.outputTokens;
  }

  // Approval checkpoints are first-class results. Inline callers can still
  // provide requestApproval for backwards compatibility, while the product
  // host normally persists this checkpoint and resumes later with decisions.
  let approvalRounds = 0;
  while (true) {
    if (approvalRounds++ >= MAX_TURNS) throw new MaxTurnsExceededError('审批恢复次数超过上限');
    if (state) {
      const pending = state.getInterruptions();
      if (pending.length) {
        const unresolved = await resolveApprovals(state, pending);
        if (unresolved.length) {
          await checkpoint(state, unresolved);
          return { output, usage, status: 'awaiting_approval', state: state.toString(), approvals: unresolved };
        }
      }
    }

    const stream = await runner.run(agent, state ?? userText, {
      stream: true,
      maxTurns: MAX_TURNS,
      session,
      signal: options.signal,
    });
    const outcome = await pump(stream);
    state = stream.state;

    if (options.signal?.aborted || stream.cancelled) {
      return { output, usage, status: 'cancelled', structuredOutput, diagnostics, artifacts };
    }
    if (outcome === 'empty-bailed' || !state.getInterruptions().length) {
      return { output, usage, status: 'completed', structuredOutput, diagnostics, artifacts };
    }
  }
}

export function validateConfig(cfg: AgentConfig): string | null {
  if (!cfg.apiKey) return '尚未配置 API Key:点击输入框右下角的 ⚙ 齿轮,在设置面板里填写 Base URL / API Key / Model(配置一次即可)';
  return null;
}
