import {
  OpenAIResponsesModel,
  type Model,
} from '@openai/agents';
import OpenAI from 'openai';

/**
 * Provider and wire-format are separate dimensions on purpose.
 *
 * A third-party gateway can expose an OpenAI wire format, while the same
 * provider may eventually expose more than one API. The agent runtime only
 * consumes the Model returned by this boundary.
 */
export const AGENT_PROVIDER_OPENAI = 'openai' as const;
export const AGENT_API_FORMAT_AUTO = 'auto' as const;
export const AGENT_API_FORMAT_CHAT_COMPLETIONS = 'chat_completions' as const;
export const AGENT_API_FORMAT_RESPONSES = 'responses' as const;

export type AgentProvider = typeof AGENT_PROVIDER_OPENAI;
export type AgentApiFormat =
  | typeof AGENT_API_FORMAT_CHAT_COMPLETIONS
  | typeof AGENT_API_FORMAT_RESPONSES;
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
    value === AGENT_API_FORMAT_RESPONSES
  );
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
): AgentApiFormat {
  if (value === AGENT_API_FORMAT_CHAT_COMPLETIONS) {
    return AGENT_API_FORMAT_CHAT_COMPLETIONS;
  }
  if (value === AGENT_API_FORMAT_RESPONSES) {
    return AGENT_API_FORMAT_RESPONSES;
  }
  if (value === undefined || value === AGENT_API_FORMAT_AUTO) {
    return baseUrl.trim()
      ? AGENT_API_FORMAT_CHAT_COMPLETIONS
      : AGENT_API_FORMAT_RESPONSES;
  }
  throw new Error(`不支持的 API format: ${String(value)}`);
}

export function resolveModelRoute(
  config: ModelAdapterConfig,
): ResolvedModelRoute {
  return {
    provider: resolveProvider(config.provider),
    apiFormat: resolveApiFormat(config.baseUrl, config.apiFormat),
  };
}

export function createModelAdapter(
  config: ModelAdapterConfig,
  options: ModelAdapterFactoryOptions,
): ModelAdapter {
  const route = resolveModelRoute(config);
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
