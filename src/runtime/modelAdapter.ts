import {
  OpenAIResponsesModel,
  type Model,
} from '@openai/agents';
import OpenAI from 'openai';
import { createAnthropicMessagesModel } from './anthropicMessagesModel';

/**
 * Provider and wire-format are separate dimensions on purpose.
 *
 * A third-party gateway can expose an OpenAI wire format, while the same
 * provider may eventually expose more than one API. The agent runtime only
 * consumes the Model returned by this boundary.
 */
export const AGENT_PROVIDER_OPENAI = 'openai' as const;
export const AGENT_PROVIDER_ANTHROPIC = 'anthropic' as const;
export const AGENT_API_FORMAT_AUTO = 'auto' as const;
export const AGENT_API_FORMAT_CHAT_COMPLETIONS = 'chat_completions' as const;
export const AGENT_API_FORMAT_RESPONSES = 'responses' as const;
export const AGENT_API_FORMAT_MESSAGES = 'messages' as const;

export type AgentProvider =
  | typeof AGENT_PROVIDER_OPENAI
  | typeof AGENT_PROVIDER_ANTHROPIC;
export type AgentApiFormat =
  | typeof AGENT_API_FORMAT_CHAT_COMPLETIONS
  | typeof AGENT_API_FORMAT_RESPONSES
  | typeof AGENT_API_FORMAT_MESSAGES;
export type AgentApiFormatSetting = AgentApiFormat | typeof AGENT_API_FORMAT_AUTO;

export interface ModelAdapterConfig {
  provider?: AgentProvider;
  apiFormat?: AgentApiFormatSetting;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ModelAdapter {
  readonly provider: AgentProvider;
  readonly apiFormat: AgentApiFormat;
  readonly model: string | Model;
}

export interface ResolvedModelRoute {
  provider: AgentProvider;
  apiFormat: AgentApiFormat;
}

export interface ModelAdapterFactoryOptions {
  fetchImpl?: typeof fetch;
  createChatCompletionsModel: () => string | Model;
}

export function isAgentApiFormat(value: unknown): value is AgentApiFormat {
  return (
    value === AGENT_API_FORMAT_CHAT_COMPLETIONS ||
    value === AGENT_API_FORMAT_RESPONSES ||
    value === AGENT_API_FORMAT_MESSAGES
  );
}

export function isAgentProvider(value: unknown): value is AgentProvider {
  return value === AGENT_PROVIDER_OPENAI || value === AGENT_PROVIDER_ANTHROPIC;
}

export function isAgentApiFormatSetting(
  value: unknown,
): value is AgentApiFormatSetting {
  return value === AGENT_API_FORMAT_AUTO || isAgentApiFormat(value);
}

export function resolveProvider(value: unknown): AgentProvider {
  if (value === undefined || value === null || value === AGENT_PROVIDER_OPENAI) {
    return AGENT_PROVIDER_OPENAI;
  }
  if (value === AGENT_PROVIDER_ANTHROPIC) {
    return AGENT_PROVIDER_ANTHROPIC;
  }
  throw new Error(`不支持的模型 provider: ${String(value)}`);
}

/**
 * Preserve the original behavior for old configurations:
 * - custom base URL => OpenAI-compatible Chat Completions
 * - no base URL => official OpenAI Responses
 */
export function resolveApiFormat(
  baseUrl: string,
  value?: AgentApiFormatSetting,
  provider: AgentProvider = AGENT_PROVIDER_OPENAI,
): AgentApiFormat {
  if (value === AGENT_API_FORMAT_CHAT_COMPLETIONS) {
    assertProviderFormat(provider, AGENT_API_FORMAT_CHAT_COMPLETIONS);
    return AGENT_API_FORMAT_CHAT_COMPLETIONS;
  }
  if (value === AGENT_API_FORMAT_RESPONSES) {
    assertProviderFormat(provider, AGENT_API_FORMAT_RESPONSES);
    return AGENT_API_FORMAT_RESPONSES;
  }
  if (value === AGENT_API_FORMAT_MESSAGES) {
    assertProviderFormat(provider, AGENT_API_FORMAT_MESSAGES);
    return AGENT_API_FORMAT_MESSAGES;
  }
  if (value === undefined || value === AGENT_API_FORMAT_AUTO) {
    const format = provider === AGENT_PROVIDER_ANTHROPIC
      ? AGENT_API_FORMAT_MESSAGES
      : baseUrl.trim()
        ? AGENT_API_FORMAT_CHAT_COMPLETIONS
        : AGENT_API_FORMAT_RESPONSES;
    assertProviderFormat(provider, format);
    return format;
  }
  throw new Error(`不支持的 API format: ${String(value)}`);
}

export function resolveModelRoute(
  config: ModelAdapterConfig,
): ResolvedModelRoute {
  const provider = resolveProvider(config.provider);
  return {
    provider,
    apiFormat: resolveApiFormat(config.baseUrl, config.apiFormat, provider),
  };
}

export function createModelAdapter(
  config: ModelAdapterConfig,
  options: ModelAdapterFactoryOptions,
): ModelAdapter {
  const route = resolveModelRoute(config);
  if (route.apiFormat === AGENT_API_FORMAT_MESSAGES) {
    return createAnthropicMessagesAdapter(config, options.fetchImpl);
  }
  if (route.apiFormat === AGENT_API_FORMAT_RESPONSES) {
    return createOpenAIResponsesAdapter(config, options.fetchImpl);
  }
  return {
    provider: route.provider,
    apiFormat: route.apiFormat,
    model: options.createChatCompletionsModel(),
  };
}

/**
 * Explicit Anthropic native Messages API adapter.
 *
 * The Anthropic client and its provider-specific conversion live behind the
 * same Agents SDK Model boundary as the two OpenAI adapters.
 */
export class AnthropicMessagesAdapter implements ModelAdapter {
  readonly provider = AGENT_PROVIDER_ANTHROPIC;
  readonly apiFormat = AGENT_API_FORMAT_MESSAGES;
  readonly model: Model;

  constructor(
    config: Pick<ModelAdapterConfig, 'baseUrl' | 'apiKey' | 'model'>,
    fetchImpl?: typeof fetch,
  ) {
    this.model = createAnthropicMessagesModel({
      ...config,
      fetchImpl,
    });
  }
}

export function createAnthropicMessagesAdapter(
  config: Pick<ModelAdapterConfig, 'baseUrl' | 'apiKey' | 'model'>,
  fetchImpl?: typeof fetch,
): AnthropicMessagesAdapter {
  return new AnthropicMessagesAdapter(config, fetchImpl);
}

/**
 * Explicit OpenAI Responses API adapter.
 *
 * The adapter owns the OpenAI client and Responses model construction. Agent
 * orchestration, tools, approvals, persistence and the internal protocol do
 * not need to know the provider wire format.
 */
export class OpenAIResponsesAdapter implements ModelAdapter {
  readonly provider = AGENT_PROVIDER_OPENAI;
  readonly apiFormat = AGENT_API_FORMAT_RESPONSES;
  readonly model: OpenAIResponsesModel;

  constructor(
    config: Pick<ModelAdapterConfig, 'baseUrl' | 'apiKey' | 'model'>,
    fetchImpl?: typeof fetch,
  ) {
    const client = new OpenAI({
      ...(config.baseUrl.trim() ? { baseURL: config.baseUrl } : {}),
      apiKey: config.apiKey,
      ...(fetchImpl ? { fetch: fetchImpl as never } : {}),
    });
    this.model = new OpenAIResponsesModel(client, config.model);
  }
}

export function createOpenAIResponsesAdapter(
  config: Pick<ModelAdapterConfig, 'baseUrl' | 'apiKey' | 'model'>,
  fetchImpl?: typeof fetch,
): OpenAIResponsesAdapter {
  return new OpenAIResponsesAdapter(config, fetchImpl);
}

function assertProviderFormat(
  provider: AgentProvider,
  format: AgentApiFormat,
): void {
  if (provider === AGENT_PROVIDER_ANTHROPIC && format !== AGENT_API_FORMAT_MESSAGES) {
    throw new Error('Anthropic provider 仅支持 native Messages API format');
  }
  if (provider === AGENT_PROVIDER_OPENAI && format === AGENT_API_FORMAT_MESSAGES) {
    throw new Error('OpenAI provider 不支持 Anthropic Messages API format');
  }
}
