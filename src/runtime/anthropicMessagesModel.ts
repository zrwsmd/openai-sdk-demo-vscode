import Anthropic from '@anthropic-ai/sdk';
import type { Model } from '@openai/agents';

type Message = Anthropic.Message;
type MessageCreateParamsBase = Anthropic.MessageCreateParams;
type MessageCreateParamsNonStreaming = Anthropic.MessageCreateParamsNonStreaming;
type MessageCreateParamsStreaming = Anthropic.MessageCreateParamsStreaming;
type MessageParam = Anthropic.MessageParam;
type RawMessageStreamEvent = Anthropic.RawMessageStreamEvent;

type ModelRequest = Parameters<Model['getResponse']>[0];
type ModelResponse = Awaited<ReturnType<Model['getResponse']>>;
type ModelStream = ReturnType<Model['getStreamedResponse']>;
type ModelStreamEvent = ModelStream extends AsyncIterable<infer Event> ? Event : never;
type AgentInputItem = Exclude<ModelRequest['input'], string>[number];

const DEFAULT_MAX_TOKENS = 4096;

/**
 * Native Anthropic Messages adapter for the Agents SDK Model interface.
 *
 * The rest of the runtime only sees ModelRequest/ModelResponse and the
 * provider-neutral stream events. Anthropic-specific roles, tool blocks and
 * SSE events stay inside this file.
 */
export class AnthropicMessagesModel implements Model {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    const params = buildRequest(this.model, request, false);
    const message = await this.client.messages.create(
      params as MessageCreateParamsNonStreaming,
      request.signal ? { signal: request.signal } : undefined,
    );
    return messageToModelResponse(message);
  }

  async *getStreamedResponse(
    request: ModelRequest,
  ): AsyncIterable<ModelStreamEvent> {
    const params = buildRequest(this.model, request, true);
    const stream = await this.client.messages.create(
      params as MessageCreateParamsStreaming,
      request.signal ? { signal: request.signal } : undefined,
    );
    yield* streamToModelEvents(
      stream as unknown as AsyncIterable<RawMessageStreamEvent>,
      request,
    );
  }
}

export interface AnthropicMessagesModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

export function createAnthropicMessagesModel(
  config: AnthropicMessagesModelConfig,
): AnthropicMessagesModel {
  const baseUrl = normalizeAnthropicBaseUrl(config.baseUrl);
  const client = new Anthropic({
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    apiKey: config.apiKey,
    ...(config.fetchImpl ? { fetch: config.fetchImpl as never } : {}),
  });
  return new AnthropicMessagesModel(client, config.model);
}

function buildRequest(
  model: string,
  request: ModelRequest,
  stream: boolean,
): MessageCreateParamsBase {
  const input = toAnthropicInput(
    request.input,
    request.systemInstructions,
  );
  const tools = toAnthropicTools(request.tools, request.handoffs);
  const toolChoice = toAnthropicToolChoice(
    request.modelSettings.toolChoice,
    tools.length > 0,
  );
  const outputConfig = toAnthropicOutputConfig(request.outputType);
  const maxTokens = positiveInteger(request.modelSettings.maxTokens)
    ?? DEFAULT_MAX_TOKENS;
  const temperature = finiteNumber(request.modelSettings.temperature);
  const topP = finiteNumber(request.modelSettings.topP);

  return {
    model,
    max_tokens: maxTokens,
    messages: input.messages,
    stream,
    ...(input.system ? { system: input.system } : {}),
    ...(tools.length ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(outputConfig ? { output_config: outputConfig } : {}),
    ...(temperature === undefined ? {} : { temperature }),
    ...(topP === undefined ? {} : { top_p: topP }),
  } as MessageCreateParamsBase;
}

function toAnthropicInput(
  input: ModelRequest['input'],
  systemInstructions?: string,
): { system?: string; messages: MessageParam[] } {
  const items: AgentInputItem[] = typeof input === 'string'
    ? [{ type: 'message', role: 'user', content: input } as AgentInputItem]
    : input;
  const messages: MessageParam[] = [];
  const systemParts = [
    typeof systemInstructions === 'string' ? systemInstructions.trim() : '',
  ].filter(Boolean);

  for (const item of items) {
    const value = item as Record<string, unknown>;
    const type = typeof value.type === 'string' ? value.type : '';

    if (type === 'message' || typeof value.role === 'string') {
      const role = value.role;
      if (role === 'system') {
        const text = messageText(value.content);
        if (text) systemParts.push(text);
        continue;
      }
      if (role === 'user' || role === 'assistant') {
        appendMessage(
          messages,
          role,
          messageContent(value.content, role),
        );
        continue;
      }
    }

    if (type === 'function_call') {
      appendMessage(messages, 'assistant', [{
        type: 'tool_use',
        id: stringValue(value.callId) ?? `toolu_${messages.length}`,
        name: stringValue(value.name) ?? 'tool',
        input: parseJsonObject(value.arguments),
      }] as never);
      continue;
    }

    if (type === 'function_call_result') {
      const result = toolResultText(value.output);
      appendMessage(messages, 'user', [{
        type: 'tool_result',
        tool_use_id: stringValue(value.callId) ?? `toolu_${messages.length}`,
        content: result.text,
        ...(result.isError ? { is_error: true } : {}),
      }] as never);
      continue;
    }

    if (type === 'reasoning' || type === 'compaction') {
      // Anthropic thinking blocks require provider signatures. The adapter does
      // not enable thinking, so provider-neutral reasoning history is omitted.
      continue;
    }

    throw new Error(`Anthropic Messages 不支持输入项: ${type || 'unknown'}`);
  }

  if (messages.length === 0) {
    messages.push({ role: 'user', content: '' });
  }
  return {
    ...(systemParts.length ? { system: systemParts.join('\n\n') } : {}),
    messages,
  };
}

function messageContent(
  content: unknown,
  role: 'user' | 'assistant',
): unknown[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  if (!Array.isArray(content)) {
    throw new Error(`Anthropic Messages 的 ${role} 消息内容不是文本`);
  }

  const blocks: unknown[] = [];
  for (const part of content) {
    const value = part as Record<string, unknown>;
    const type = stringValue(value.type);
    if (type === 'input_text' || type === 'output_text') {
      blocks.push({ type: 'text', text: stringValue(value.text) ?? '' });
      continue;
    }
    if (type === 'refusal') {
      blocks.push({ type: 'text', text: stringValue(value.refusal) ?? '' });
      continue;
    }
    if (type === 'input_image' && role === 'user') {
      blocks.push(toAnthropicImage(value.image));
      continue;
    }
    throw new Error(`Anthropic Messages 不支持消息内容: ${type || 'unknown'}`);
  }
  return blocks;
}

function toAnthropicImage(image: unknown): unknown {
  if (typeof image !== 'string') {
    if (isRecord(image) && typeof image.id === 'string') {
      return {
        type: 'image',
        source: { type: 'file', file_id: image.id },
      };
    }
    throw new Error('Anthropic Messages 图片输入缺少 URL 或 data URL');
  }
  if (image.startsWith('data:')) {
    const match = /^data:([^;,]+);base64,(.+)$/i.exec(image);
    if (!match) {
      throw new Error('Anthropic Messages 只支持 base64 data URL 图片');
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: match[1],
        data: match[2],
      },
    };
  }
  if (/^https?:\/\//i.test(image)) {
    return {
      type: 'image',
      source: { type: 'url', url: image },
    };
  }
  throw new Error('Anthropic Messages 图片输入必须是 URL 或 base64 data URL');
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      const value = part as Record<string, unknown>;
      return stringValue(value.text) ?? stringValue(value.refusal) ?? '';
    })
    .join('');
}

function appendMessage(
  messages: MessageParam[],
  role: 'user' | 'assistant',
  content: unknown[],
): void {
  const filtered = content.filter(Boolean);
  if (!filtered.length) return;
  const last = messages[messages.length - 1];
  if (last?.role === role && Array.isArray(last.content)) {
    last.content.push(...filtered as never[]);
    return;
  }
  messages.push({ role, content: filtered as never[] });
}

function toAnthropicTools(
  serializedTools: unknown,
  handoffs: unknown,
): unknown[] {
  const tools: unknown[] = [];
  for (const raw of Array.isArray(serializedTools) ? serializedTools : []) {
    const tool = raw as Record<string, unknown>;
    if (tool.type !== 'function') {
      throw new Error(
        `Anthropic Messages 暂不支持 Agents 工具类型: ${String(tool.type ?? 'unknown')}`,
      );
    }
    tools.push({
      name: stringValue(tool.name) ?? 'tool',
      ...(stringValue(tool.description)
        ? { description: tool.description }
        : {}),
      input_schema: isRecord(tool.parameters)
        ? tool.parameters
        : { type: 'object', properties: {}, additionalProperties: false },
      ...(tool.strict === true ? { strict: true } : {}),
    });
  }
  for (const raw of Array.isArray(handoffs) ? handoffs : []) {
    const handoff = raw as Record<string, unknown>;
    tools.push({
      name: stringValue(handoff.toolName) ?? 'handoff',
      ...(stringValue(handoff.toolDescription)
        ? { description: handoff.toolDescription }
        : {}),
      input_schema: isRecord(handoff.inputJsonSchema)
        ? handoff.inputJsonSchema
        : { type: 'object', properties: {}, additionalProperties: false },
    });
  }
  return tools;
}

function toAnthropicToolChoice(
  choice: unknown,
  hasTools: boolean,
): unknown | undefined {
  if (!hasTools || choice === undefined || choice === 'auto') return undefined;
  if (choice === 'required') return { type: 'any' };
  if (choice === 'none') return { type: 'none' };
  if (typeof choice === 'string' && choice) {
    return { type: 'tool', name: choice };
  }
  return undefined;
}

function toAnthropicOutputConfig(outputType: unknown): unknown | undefined {
  if (!isRecord(outputType) || outputType.type !== 'json_schema') {
    return undefined;
  }
  if (!isRecord(outputType.schema)) {
    throw new Error('Anthropic Messages 结构化输出缺少 JSON Schema');
  }
  return {
    format: {
      type: 'json_schema',
      schema: outputType.schema,
    },
  };
}

function messageToModelResponse(message: Message): ModelResponse {
  const output = contentToAgentOutput(message.content);
  return {
    usage: usageFromAnthropic(message.usage),
    output,
    responseId: message.id,
    providerData: { provider: 'anthropic', message },
  } as ModelResponse;
}

function contentToAgentOutput(content: unknown): unknown[] {
  const output: unknown[] = [];
  const text: unknown[] = [];
  for (const raw of Array.isArray(content) ? content : []) {
    const block = raw as Record<string, unknown>;
    if (block.type === 'text' && typeof block.text === 'string') {
      text.push({ type: 'output_text', text: block.text });
      continue;
    }
    if (block.type === 'tool_use') {
      output.push({
        type: 'function_call',
        callId: stringValue(block.id) ?? `toolu_${output.length}`,
        name: stringValue(block.name) ?? 'tool',
        arguments: JSON.stringify(block.input ?? {}),
        status: 'completed',
      });
    }
  }
  if (text.length) {
    output.unshift({
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: text,
    });
  }
  return output;
}

async function* streamToModelEvents(
  stream: AsyncIterable<RawMessageStreamEvent>,
  request: ModelRequest,
): AsyncIterable<ModelStreamEvent> {
  const blocks = new Map<number, StreamBlockState>();
  let started = false;
  let message: Record<string, unknown> | undefined;
  let stopReason: unknown = null;
  let stopSequence: unknown = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const rawEvent of stream) {
    const event = rawEvent as unknown as Record<string, unknown>;
    const type = stringValue(event.type);

    if (type === 'message_start') {
      const startMessage = isRecord(event.message) ? event.message : {};
      message = { ...startMessage };
      const usage = isRecord(startMessage.usage) ? startMessage.usage : {};
      inputTokens = anthropicInputTokens(usage);
      if (!started) {
        started = true;
        yield {
          type: 'response_started',
          providerData: { provider: 'anthropic', event },
        } as ModelStreamEvent;
      }
      continue;
    }

    if (type === 'content_block_start') {
      const index = integerValue(event.index) ?? blocks.size;
      const block = isRecord(event.content_block) ? event.content_block : {};
      const state: StreamBlockState = {
        type: stringValue(block.type) ?? 'unknown',
        id: stringValue(block.id),
        name: stringValue(block.name),
        initialInput: block.input,
        text: stringValue(block.text) ?? '',
        inputJson: '',
      };
      blocks.set(index, state);
      if (state.type === 'tool_use' && state.id) {
        yield modelEvent({
          type: 'response.output_item.added',
          item: {
            type: 'function_call',
            call_id: state.id,
            name: state.name ?? 'tool',
          },
        });
      }
      continue;
    }

    if (type === 'content_block_delta') {
      const index = integerValue(event.index) ?? 0;
      const state = blocks.get(index) ?? {
        type: 'unknown',
        text: '',
        inputJson: '',
      };
      blocks.set(index, state);
      const delta = isRecord(event.delta) ? event.delta : {};
      const deltaType = stringValue(delta.type);

      if (deltaType === 'text_delta') {
        const text = stringValue(delta.text) ?? '';
        state.text += text;
        if (text) {
          yield {
            type: 'output_text_delta',
            itemId: state.id ?? `text_${index}`,
            delta: text,
            providerData: { provider: 'anthropic', event },
          } as ModelStreamEvent;
        }
        continue;
      }

      if (deltaType === 'input_json_delta') {
        const partial = stringValue(delta.partial_json) ?? '';
        state.inputJson += partial;
        if (state.id) {
          yield modelEvent({
            type: 'response.function_call_arguments.delta',
            call_id: state.id,
            item_id: state.id,
            name: state.name ?? 'tool',
            delta: partial,
          });
        }
        continue;
      }

      if (deltaType === 'thinking_delta') {
        const thinking = stringValue(delta.thinking) ?? '';
        if (thinking) {
          yield modelEvent({
            type: 'response.reasoning_text.delta',
            item_id: state.id ?? `reasoning_${index}`,
            delta: thinking,
          });
        }
        continue;
      }

      yield modelEvent({
        type: `anthropic.${deltaType ?? 'content_block_delta'}`,
        item_id: state.id ?? `block_${index}`,
      });
      continue;
    }

    if (type === 'content_block_stop') {
      const index = integerValue(event.index) ?? 0;
      const state = blocks.get(index);
      if (state?.type === 'tool_use' && state.id) {
        yield modelEvent({
          type: 'response.function_call_arguments.done',
          call_id: state.id,
          item_id: state.id,
          name: state.name ?? 'tool',
          arguments: streamToolArguments(state),
        });
      }
      continue;
    }

    if (type === 'message_delta') {
      const delta = isRecord(event.delta) ? event.delta : {};
      stopReason = delta.stop_reason ?? stopReason;
      stopSequence = delta.stop_sequence ?? stopSequence;
      const usage = isRecord(event.usage) ? event.usage : {};
      outputTokens = numberValue(usage.output_tokens) ?? outputTokens;
      continue;
    }

    if (type) {
      yield modelEvent({
        type: `anthropic.${type}`,
        ...(type === 'message_stop' ? { status: 'completed' } : {}),
      });
    }
  }

  if (!started) {
    yield {
      type: 'response_started',
      providerData: { provider: 'anthropic' },
    } as ModelStreamEvent;
  }

  const finalMessage = {
    ...(message ?? {}),
    id: stringValue(message?.id) ?? `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [...blocks.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([, block]) => streamBlockToContent(block)),
    stop_reason: stopReason,
    stop_sequence: stopSequence,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  } as Message;
  const usage = usageFromAnthropic(finalMessage.usage);
  const output = contentToAgentOutput(finalMessage.content);
  yield {
    type: 'response_done',
    response: {
      id: finalMessage.id,
      output,
      usage,
      providerData: { provider: 'anthropic', message: finalMessage },
    },
    providerData: { provider: 'anthropic', message: finalMessage },
  } as ModelStreamEvent;

  void request;
}

interface StreamBlockState {
  type: string;
  id?: string;
  name?: string;
  initialInput?: unknown;
  text: string;
  inputJson: string;
}

function streamBlockToContent(block: StreamBlockState): unknown[] {
  if (block.type === 'text') {
    return block.text ? [{ type: 'text', text: block.text }] : [];
  }
  if (block.type === 'tool_use') {
    return [{
      type: 'tool_use',
      id: block.id ?? `toolu_${Date.now()}`,
      name: block.name ?? 'tool',
      input: parseJsonObject(streamToolArguments(block)),
    }];
  }
  return [];
}

function streamToolArguments(block: StreamBlockState): string {
  if (block.inputJson) return block.inputJson;
  return JSON.stringify(block.initialInput ?? {});
}

function modelEvent(event: Record<string, unknown>): ModelStreamEvent {
  return { type: 'model', event } as ModelStreamEvent;
}

function toolResultText(output: unknown): { text: string; isError: boolean } {
  const text = serializeValue(output);
  let isError = false;
  try {
    const parsed = JSON.parse(text) as { ok?: unknown };
    isError = parsed?.ok === false;
  } catch {
    isError = false;
  }
  return { text, isError };
}

function usageFromAnthropic(usage: unknown): ModelResponse['usage'] {
  const value = isRecord(usage) ? usage : {};
  const inputTokens = anthropicInputTokens(value);
  const outputTokens = numberValue(value.output_tokens) ?? 0;
  const totalTokens = inputTokens + outputTokens;
  return {
    requests: 1,
    inputTokens,
    outputTokens,
    totalTokens,
    inputTokensDetails: [],
    outputTokensDetails: [],
    requestUsageEntries: [{
      inputTokens,
      outputTokens,
      totalTokens,
      endpoint: 'messages.create',
    }],
  } as unknown as ModelResponse['usage'];
}

function anthropicInputTokens(value: Record<string, unknown>): number {
  return (
    (numberValue(value.input_tokens) ?? 0)
    + (numberValue(value.cache_creation_input_tokens) ?? 0)
    + (numberValue(value.cache_read_input_tokens) ?? 0)
  );
}

function normalizeAnthropicBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (isRecord(parsed)) return parsed;
    } catch {
      // The Agents SDK validates tool arguments after the model response.
    }
  }
  return {};
}

function serializeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === 'string') return part;
      if (isRecord(part) && typeof part.text === 'string') return part.text;
      return JSON.stringify(part ?? '');
    }).join('');
  }
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : undefined;
}

function integerValue(value: unknown): number | undefined {
  const number = numberValue(value);
  return number === undefined ? undefined : number;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const number = numberValue(value);
  return number !== undefined && number > 0 ? number : undefined;
}
