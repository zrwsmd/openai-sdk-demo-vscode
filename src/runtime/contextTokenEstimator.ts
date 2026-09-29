import type {
  AgentInputItem,
  Model,
  ModelRequest,
  ModelResponse,
  StreamEvent,
} from '@openai/agents';
import type { ModelContextProfile, TokenEstimateCalibration } from './contextManager';
import { createHash } from 'node:crypto';

const CALIBRATION_ALPHA = 0.25;
const MIN_CALIBRATION_FACTOR = 0.5;
const MAX_CALIBRATION_FACTOR = 3;

export function estimateTextTokens(text: string): number {
  let cjkCharacters = 0;
  let otherUnicodeCharacters = 0;
  let asciiPunctuation = 0;
  let asciiText = 0;
  let whitespace = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (isCjkCodePoint(codePoint)) {
      cjkCharacters += 1;
    } else if (/\s/u.test(character)) {
      whitespace += 1;
    } else if (codePoint <= 0x7f) {
      if (/[A-Za-z0-9]/u.test(character)) asciiText += 1;
      else asciiPunctuation += 1;
    } else {
      otherUnicodeCharacters += 1;
    }
  }

  return Math.ceil(
    cjkCharacters * 1.5 +
    otherUnicodeCharacters +
    asciiText / 3.5 +
    asciiPunctuation / 2 +
    whitespace / 8,
  );
}

export function estimateItemsTokens(
  items: readonly AgentInputItem[],
  calibration?: TokenEstimateCalibration,
): number {
  return applyTokenEstimateCalibration(estimateTextTokens(safeJson(items)), calibration);
}

/** Estimates the complete generic SDK request, including instructions and tool schemas. */
export function estimateModelRequestTokens(request: ModelRequest): number {
  const requestBody = {
    systemInstructions: request.systemInstructions,
    input: request.input,
    tools: request.tools,
    handoffs: request.handoffs,
    outputType: request.outputType,
    modelSettings: request.modelSettings,
    prompt: request.prompt,
  };
  return estimateTextTokens(safeJson(requestBody)) + 8;
}

export function applyTokenEstimateCalibration(
  estimatedTokens: number,
  calibration?: TokenEstimateCalibration,
): number {
  const factor = calibration?.factor;
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0) {
    return estimatedTokens;
  }
  return Math.ceil(estimatedTokens * factor);
}

export function updateTokenEstimateCalibration(
  previous: TokenEstimateCalibration | undefined,
  routeKey: string,
  estimatedTokens: number,
  actualInputTokens: number,
): TokenEstimateCalibration | undefined {
  if (
    !routeKey ||
    !Number.isFinite(estimatedTokens) ||
    estimatedTokens <= 0 ||
    !Number.isFinite(actualInputTokens) ||
    actualInputTokens <= 0
  ) {
    return previous?.routeKey === routeKey ? previous : undefined;
  }

  const sampleFactor = clamp(
    actualInputTokens / estimatedTokens,
    MIN_CALIBRATION_FACTOR,
    MAX_CALIBRATION_FACTOR,
  );
  const sameRoute = previous?.routeKey === routeKey;
  const factor = sameRoute
    ? previous.factor * (1 - CALIBRATION_ALPHA) + sampleFactor * CALIBRATION_ALPHA
    : sampleFactor;

  return {
    routeKey,
    factor: clamp(factor, MIN_CALIBRATION_FACTOR, MAX_CALIBRATION_FACTOR),
    samples: sameRoute ? Math.min(1_000, previous.samples + 1) : 1,
    updatedAt: new Date().toISOString(),
  };
}

export function modelContextCalibrationRouteKey(
  config: {
    provider?: string;
    apiFormat?: string;
    baseUrl: string;
    model: string;
  },
): string {
  const provider = config.provider ?? 'openai';
  const normalizedBaseUrl = config.baseUrl.trim().replace(/\/+$/, '').toLowerCase();
  const configuredFormat = config.apiFormat ?? 'auto';
  const apiFormat = configuredFormat === 'auto'
    ? provider === 'anthropic'
      ? 'messages'
      : normalizedBaseUrl
        ? 'chat_completions'
        : 'responses'
    : configuredFormat;
  const route = JSON.stringify([
    provider,
    apiFormat,
    normalizedBaseUrl,
    config.model.trim(),
  ]);
  return `context-route-v1:${createHash('sha256').update(route).digest('hex').slice(0, 24)}`;
}

/** Instruments the SDK Model boundary without changing its identity or instanceof behavior. */
export function observeModelUsage(
  model: string | Model,
  profile: ModelContextProfile | undefined,
  routeKey: string,
): string | Model {
  if (typeof model === 'string' || !profile) return model;

  return new Proxy(model, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (property === 'getResponse' && typeof value === 'function') {
        return async (request: ModelRequest): Promise<ModelResponse> => {
          const estimate = estimateModelRequestTokens(request);
          const response = await value.call(target, request) as ModelResponse;
          recordUsage(profile, routeKey, estimate, response?.usage?.inputTokens);
          return response;
        };
      }
      if (property === 'getStreamedResponse' && typeof value === 'function') {
        return (request: ModelRequest): AsyncIterable<StreamEvent> => {
          const estimate = estimateModelRequestTokens(request);
          const source = value.call(target, request) as AsyncIterable<StreamEvent>;
          return observeStreamUsage(source, profile, routeKey, estimate);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

async function* observeStreamUsage(
  source: AsyncIterable<StreamEvent>,
  profile: ModelContextProfile,
  routeKey: string,
  estimatedTokens: number,
): AsyncGenerator<StreamEvent> {
  for await (const event of source) {
    if (event.type === 'response_done') {
      recordUsage(
        profile,
        routeKey,
        estimatedTokens,
        event.response?.usage?.inputTokens,
      );
    }
    yield event;
  }
}

function recordUsage(
  profile: ModelContextProfile,
  routeKey: string,
  estimatedTokens: number,
  actualInputTokens: number | undefined,
): void {
  if (typeof actualInputTokens !== 'number') return;
  profile.tokenCalibration = updateTokenEstimateCalibration(
    profile.tokenCalibration,
    routeKey,
    estimatedTokens,
    actualInputTokens,
  );
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

function isCjkCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    (codePoint >= 0x3100 && codePoint <= 0x312f)
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
