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
  type RunToolApprovalItem,
  type Session,
  type StreamedRunResult,
} from '@openai/agents';
import { z } from 'zod';
import OpenAI from 'openai';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listFiles, readFileRange, writeFileText, searchText, runCommand } from './workspaceTools';

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

// ---------- 工具(演示用假实现,成熟化时替换内脏即可,接口不变) ----------

function buildTools(cfg: AgentConfig) {
  const getIoTable = tool({
    name: 'get_io_table',
    description: '查询当前 PLC 项目的 I/O 变量表。',
    parameters: z.object({}),
    execute: async () => {
      const ioTable = [
        { name: 'Start_Btn', addr: '%IX0.0', type: 'BOOL', comment: '启动按钮' },
        { name: 'Stop_Btn', addr: '%IX0.1', type: 'BOOL', comment: '停止按钮' },
        { name: 'Motor_Main', addr: '%QX0.0', type: 'BOOL', comment: '主接触器' },
        { name: 'Motor_Star', addr: '%QX0.1', type: 'BOOL', comment: '星形接触器' },
        { name: 'Motor_Delta', addr: '%QX0.2', type: 'BOOL', comment: '三角形接触器' },
      ];
      return JSON.stringify(ioTable, null, 2);
    },
  });

  const validateStCode = tool({
    name: 'validate_st_code',
    description: '校验一段 IEC 61131-3 ST 代码，返回校验结果。参数 code 为完整 ST 源码。',
    parameters: z.object({ code: z.string().describe('完整 ST 源码') }),
    execute: async ({ code }) => {
      if (!code.toUpperCase().includes('END_PROGRAM')) {
        return JSON.stringify({ ok: false, errors: ['缺少 END_PROGRAM 结束标记'] });
      }
      if (code.includes('TON') && !code.includes('T#')) {
        return JSON.stringify({ ok: false, errors: ['使用了 TON 但未发现时间字面量(如 T#5s)'] });
      }
      return JSON.stringify({ ok: true, errors: [] });
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
    execute: async ({ code }) => {
      const m = /PROGRAM\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(code);
      const name = m?.[1] ?? `program_${Date.now()}`;
      await fs.mkdir(cfg.exportDir, { recursive: true });
      const file = path.join(cfg.exportDir, `${name}.st`);
      await fs.writeFile(file, code, 'utf8');
      return JSON.stringify({ ok: true, file });
    },
  });

  // ---- 通用工作区文件工具(作用域锁定在当前工作区根目录) ----
  const guard = (fn: () => Promise<string>): Promise<string> =>
    fn().catch((e: unknown) =>
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
    );

  const listFilesTool = tool({
    name: 'list_files',
    description: '列出当前工作区内的文件(相对根目录,自动跳过 node_modules/.git/dist 等)。参数 dir 为相对子目录,默认根目录。',
    parameters: z.object({ dir: z.string().optional().describe('相对子目录,留空表示工作区根') }),
    execute: ({ dir }) =>
      guard(async () => JSON.stringify({ ok: true, files: await listFiles(cfg.workspaceRoot, dir ?? '.') })),
  });

  const readFileTool = tool({
    name: 'read_file',
    description: '读取工作区内一个文本文件的内容。可用 startLine/endLine 分段读大文件(缺省读前 4000 行)。',
    parameters: z.object({
      path: z.string().describe('相对工作区的文件路径'),
      startLine: z.number().optional().describe('起始行(1 起)'),
      endLine: z.number().optional().describe('结束行(含)'),
    }),
    execute: ({ path: p, startLine, endLine }) =>
      guard(async () => {
        const r = await readFileRange(cfg.workspaceRoot, p, startLine, endLine);
        return JSON.stringify({ ok: true, totalLines: r.totalLines, content: r.text });
      }),
  });

  const searchFilesTool = tool({
    name: 'search_files',
    description: '在工作区文件里做文本搜索,返回 "相对路径:行号: 内容"。支持 glob 文件名过滤(如 *.st)与 isRegex 正则。',
    parameters: z.object({
      text: z.string().describe('要搜索的字面量或正则'),
      glob: z.string().optional().describe('按文件名过滤,如 *.st'),
      isRegex: z.boolean().optional().describe('是否按正则解析 text'),
    }),
    execute: ({ text, glob, isRegex }) =>
      guard(async () => JSON.stringify({ ok: true, matches: await searchText(cfg.workspaceRoot, text, { glob, isRegex }) })),
  });

  const writeFileTool = tool({
    name: 'write_file',
    description: '把文本内容写入工作区内的文件(会覆盖)。属于写操作,执行前需要用户在界面批准。',
    parameters: z.object({
      path: z.string().describe('相对工作区的文件路径'),
      content: z.string().describe('要写入的完整文本内容'),
    }),
    needsApproval: true,
    execute: ({ path: p, content }) =>
      guard(async () => JSON.stringify({ ok: true, ...(await writeFileText(cfg.workspaceRoot, p, content)) })),
  });

  const runCommandTool = tool({
    name: 'run_command',
    description: '在工作区根目录执行一条 shell 命令(60 秒超时,输出截断)。属于危险操作,执行前需要用户批准。',
    parameters: z.object({ command: z.string().describe('要执行的命令行') }),
    needsApproval: true,
    execute: ({ command }) =>
      guard(async () => JSON.stringify({ ok: true, ...(await runCommand(cfg.workspaceRoot, command)) })),
  });

  return [getIoTable, validateStCode, exportStProgram, listFilesTool, readFileTool, searchFilesTool, writeFileTool, runCommandTool];
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

const modelCache = new Map<string, GatewayGuardedModel>();

function buildModel(cfg: AgentConfig): string | GatewayGuardedModel {
  if (!cfg.baseUrl) return cfg.model; // 无网关:走官方默认(Responses API)
  const key = `${cfg.baseUrl}|${cfg.apiKey}|${cfg.model}`;
  let m = modelCache.get(key);
  if (!m) {
    const client = new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey });
    m = new GatewayGuardedModel(client, cfg.model);
    modelCache.set(key, m);
  }
  return m;
}

// ---------- 一轮对话:流式执行 + 会话持久化 + 审批中断/恢复 ----------

/** 本轮 token 用量(从模型响应的 usage 汇总;网关不返回 usage 字段时全为 0) */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  requests: number; // 本轮调用模型的次数(含工具调用往返与审批恢复后的往返)
}

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
): Promise<{ output: string; usage: TurnUsage }> {
  const model = buildModel(cfg);
  if (model instanceof GatewayGuardedModel) model.resetEmptyStreak(); // 熔断计数每轮用户消息重新计
  const agent = new Agent({
    name: 'PLC 编程助手',
    model,
    instructions: SYSTEM_PROMPT,
    tools: buildTools(cfg),
  });

  const runner = new Runner();
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  let output = '';

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

  const pump = async (stream: StreamedRunResult<any, any>): Promise<'done' | 'empty-bailed'> => {
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
    for (const resp of stream.rawResponses ?? []) {
      usage.requests += 1;
      usage.inputTokens += resp.usage?.inputTokens ?? 0;
      usage.outputTokens += resp.usage?.outputTokens ?? 0;
    }
    return bailed ? 'empty-bailed' : 'done';
  };

  let stream = await runner.run(agent, userText, { stream: true, maxTurns: MAX_TURNS, session });
  let outcome = await pump(stream);

  // 审批中断循环:可能有多个待批工具,逐个问;全部处理完后带 state 续跑,直到没有新中断
  let pending: RunToolApprovalItem[] = outcome === 'empty-bailed' ? [] : stream.interruptions ?? [];
  let guard = 0;
  while (pending.length && guard++ < MAX_TURNS) {
    for (const item of pending) {
      const raw = item.rawItem as { name?: string; arguments?: string };
      const ok = await requestApproval(raw?.name ?? 'tool', raw?.arguments ?? '');
      if (ok) stream.state.approve(item);
      else stream.state.reject(item);
    }
    stream = await runner.run(agent, stream.state, { stream: true, maxTurns: MAX_TURNS, session });
    outcome = await pump(stream);
    if (outcome === 'empty-bailed') break;
    pending = stream.interruptions ?? [];
  }

  return { output, usage };
}

export function validateConfig(cfg: AgentConfig): string | null {
  if (!cfg.apiKey) return '尚未配置 API Key:点击输入框右下角的 ⚙ 齿轮,在设置面板里填写 Base URL / API Key / Model(配置一次即可)';
  return null;
}
