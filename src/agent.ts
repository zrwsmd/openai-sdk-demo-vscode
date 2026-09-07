/**
 * PLC Agent 内核 —— 与 VSCode 完全解耦(纯 Node 逻辑,可单测、可搬到任何宿主)
 *
 * 从 CLI 版 main.mjs 移植:同样的两个工具、同样的系统提示词、同样的流式事件。
 * 做成熟 agent 时主要演进这个文件:换真工具、加护栏、加多代理等。
 */

import {
  Agent,
  Runner,
  tool,
  setTracingDisabled,
  OpenAIChatCompletionsModel,
  MaxTurnsExceededError,
} from '@openai/agents';

// 超轮次异常透传给 UI 层做友好提示
export { MaxTurnsExceededError };
import { z } from 'zod';
import OpenAI from 'openai';

// 网关场景必须关闭 tracing:轨迹上传 OpenAI 官方服务会失败刷屏。
// 必须在模块加载时调用,运行时设置无效。
setTracingDisabled(true);

export interface AgentConfig {
  /** OpenAI 兼容网关地址(带 /v1),空 = 官方 API */
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** UI 关心的事件:正文增量 / 工具调用提示 */
export type AgentEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string };

/** 会话历史条目(SDK 的 input list 结构,这里不深入其类型) */
export type ChatHistory = unknown[];

// ---------- 工具(演示用假实现,成熟化时替换内脏即可,接口不变) ----------

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

const SYSTEM_PROMPT =
  '你是工控行业的 PLC 编程助手，精通 IEC 61131-3。' +
  '编写程序前先调用 get_io_table 查询变量表，只使用表中已有的变量名。' +
  '生成 ST 代码后必须调用 validate_st_code 校验；如有错误要自行修正后重新校验，' +
  '直到通过为止，最后把通过校验的代码展示给用户。用中文回答。';

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

// ---------- 一轮对话:流式执行,通过 onEvent 回调吐增量 ----------

/** 本轮 token 用量(从模型响应的 usage 汇总;网关不返回 usage 字段时全为 0) */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  requests: number; // 本轮调用模型的次数(含工具调用往返)
}

/** 单次用户消息允许的最大模型往返轮数,防止工具死循环烧额度 */
export const MAX_TURNS = 10;

export async function runAgentTurn(
  cfg: AgentConfig,
  history: ChatHistory,
  onEvent: (ev: AgentEvent) => void,
): Promise<{ history: ChatHistory; output: string; usage: TurnUsage }> {
  const agent = new Agent({
    name: 'PLC 编程助手',
    model: buildModel(cfg),
    instructions: SYSTEM_PROMPT,
    tools: [getIoTable, validateStCode],
  });

  const runner = new Runner();
  const stream = await runner.run(agent, history as never, { stream: true, maxTurns: MAX_TURNS });

  let output = '';
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

  // 流结束后从各次模型响应里汇总 usage
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  for (const resp of stream.rawResponses ?? []) {
    usage.requests += 1;
    usage.inputTokens += resp.usage?.inputTokens ?? 0;
    usage.outputTokens += resp.usage?.outputTokens ?? 0;
  }

  return { history: stream.history as ChatHistory, output, usage };
}

export function validateConfig(cfg: AgentConfig): string | null {
  if (!cfg.apiKey) return '尚未配置 API Key:点击输入框右下角的 ⚙ 齿轮,在设置面板里填写 Base URL / API Key / Model(配置一次即可)';
  return null;
}
