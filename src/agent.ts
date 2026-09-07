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
}

/** UI 关心的事件:正文增量 / 工具调用提示 */
export type AgentEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string };

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

  return [getIoTable, validateStCode, exportStProgram];
}

const SYSTEM_PROMPT =
  '你是工控行业的 PLC 编程助手，精通 IEC 61131-3。' +
  '编写程序前先调用 get_io_table 查询变量表，只使用表中已有的变量名。' +
  '生成 ST 代码后必须调用 validate_st_code 校验；如有错误要自行修正后重新校验，' +
  '直到通过为止，最后把通过校验的代码展示给用户。' +
  '当用户明确要求"导出/保存为文件"时，调用 export_st_program。用中文回答。';

// ---------- 模型构建(网关适配:chat_completions 协议) ----------

const modelCache = new Map<string, OpenAIChatCompletionsModel>();

function buildModel(cfg: AgentConfig): string | OpenAIChatCompletionsModel {
  if (!cfg.baseUrl) return cfg.model; // 无网关:走官方默认(Responses API)
  const key = `${cfg.baseUrl}|${cfg.apiKey}|${cfg.model}`;
  let m = modelCache.get(key);
  if (!m) {
    const client = new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey });
    m = new OpenAIChatCompletionsModel(client, cfg.model);
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
  const agent = new Agent({
    name: 'PLC 编程助手',
    model: buildModel(cfg),
    instructions: SYSTEM_PROMPT,
    tools: buildTools(cfg),
  });

  const runner = new Runner();
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  let output = '';

  const pump = async (stream: StreamedRunResult<any, any>): Promise<void> => {
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
          const raw = event.item.rawItem as { name?: string } | undefined;
          onEvent({ type: 'tool', name: raw?.name ?? 'tool' });
        }
      }
    }
    for (const resp of stream.rawResponses ?? []) {
      usage.requests += 1;
      usage.inputTokens += resp.usage?.inputTokens ?? 0;
      usage.outputTokens += resp.usage?.outputTokens ?? 0;
    }
  };

  let stream = await runner.run(agent, userText, { stream: true, maxTurns: MAX_TURNS, session });
  await pump(stream);

  // 审批中断循环:可能有多个待批工具,逐个问;全部处理完后带 state 续跑,直到没有新中断
  let pending: RunToolApprovalItem[] = stream.interruptions ?? [];
  let guard = 0;
  while (pending.length && guard++ < MAX_TURNS) {
    for (const item of pending) {
      const raw = item.rawItem as { name?: string; arguments?: string };
      const ok = await requestApproval(raw?.name ?? 'tool', raw?.arguments ?? '');
      if (ok) stream.state.approve(item);
      else stream.state.reject(item);
    }
    stream = await runner.run(agent, stream.state, { stream: true, maxTurns: MAX_TURNS, session });
    await pump(stream);
    pending = stream.interruptions ?? [];
  }

  return { output, usage };
}

export function validateConfig(cfg: AgentConfig): string | null {
  if (!cfg.apiKey) return '尚未配置 API Key:点击输入框右下角的 ⚙ 齿轮,在设置面板里填写 Base URL / API Key / Model(配置一次即可)';
  return null;
}
