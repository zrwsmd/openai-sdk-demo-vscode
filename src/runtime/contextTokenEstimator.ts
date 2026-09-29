import type {
  AgentInputItem,
  Model,
  ModelRequest,
  ModelResponse,
  ModelRetryAdviceRequest,
  StreamEvent,
} from '@openai/agents';
import type { ModelContextProfile, TokenEstimateCalibration } from './contextManager';
import { createHash } from 'node:crypto';

const CALIBRATION_ALPHA = 0.25;
const MIN_CALIBRATION_FACTOR = 0.5;
const MAX_CALIBRATION_FACTOR = 3;

export type NamedModelResolver = (
  modelName: string,
) => Model | Promise<Model>;

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
  const rawTokens = estimateTextTokens(safeJson(items));
  return applyNumericCalibration(
    rawTokens,
    calibration?.historyFactor ?? calibration?.factor,
  );
}

export interface ModelRequestTokenBreakdown {
  inputTokens: number;
  fixedOverheadTokens: number;
  totalTokens: number;
  rawInputTokens: number;
  rawFixedOverheadTokens: number;
  rawTotalTokens: number;
}

/**
 * Estimates the history and fixed request portions separately. Keeping the
 * portions separate prevents a tool/schema-heavy request's total correction
 * factor from being incorrectly applied to history alone.
 */
export function estimateModelRequestTokenBreakdown(
  request: ModelRequest,
  calibration?: TokenEstimateCalibration,
): ModelRequestTokenBreakdown {
  const rawInputTokens = estimateTextTokens(safeJson(request.input));
  const rawFixedOverheadTokens = estimateTextTokens(safeJson({
    systemInstructions: request.systemInstructions,
    tools: request.tools,
    handoffs: request.handoffs,
    outputType: request.outputType,
    modelSettings: request.modelSettings,
    prompt: request.prompt,
  })) + 8;
  const inputTokens = applyNumericCalibration(
    rawInputTokens,
    calibration?.historyFactor ?? calibration?.factor,
  );
  const fixedOverheadTokens = applyNumericCalibration(
    rawFixedOverheadTokens,
    calibration?.fixedOverheadTokens === undefined
      ? undefined
      : calibration.fixedOverheadTokens / Math.max(1, rawFixedOverheadTokens),
  );
  return {
    inputTokens,
    fixedOverheadTokens,
    totalTokens: inputTokens + fixedOverheadTokens,
    rawInputTokens,
    rawFixedOverheadTokens,
    rawTotalTokens: rawInputTokens + rawFixedOverheadTokens,
  };
}

/** Estimates the complete generic SDK request, including instructions and tool schemas. */
export function estimateModelRequestTokens(request: ModelRequest): number {
  return estimateModelRequestTokenBreakdown(request).totalTokens;
}

export function applyTokenEstimateCalibration(
  estimatedTokens: number,
  calibration?: TokenEstimateCalibration,
): number {
  return applyNumericCalibration(estimatedTokens, calibration?.factor);
}

function applyNumericCalibration(
  estimatedTokens: number,
  factor: number | undefined,
): number {
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

/**
 * Updates separate request-shape calibration from one complete model call.
 *
 * Providers report only total input tokens, so the fixed portion is anchored
 * to the structural estimate and the residual is used to learn historyFactor.
 * This is intentionally conservative: it never applies the total-request
 * factor directly to history.
 */
export function updateTokenEstimateCalibrationFromRequest(
  previous: TokenEstimateCalibration | undefined,
  routeKey: string,
  estimatedHistoryTokens: number,
  estimatedFixedOverheadTokens: number,
  actualInputTokens: number,
): TokenEstimateCalibration | undefined {
  if (
    !routeKey ||
    !Number.isFinite(estimatedHistoryTokens) ||
    estimatedHistoryTokens <= 0 ||
    !Number.isFinite(estimatedFixedOverheadTokens) ||
    estimatedFixedOverheadTokens < 0 ||
    !Number.isFinite(actualInputTokens) ||
    actualInputTokens <= 0
  ) {
    return previous?.routeKey === routeKey ? previous : undefined;
  }

  const rawTotal = estimatedHistoryTokens + estimatedFixedOverheadTokens;
  const totalSampleFactor = clamp(
    actualInputTokens / Math.max(1, rawTotal),
    MIN_CALIBRATION_FACTOR,
    MAX_CALIBRATION_FACTOR,
  );
  const residualHistoryTokens = Math.max(1, actualInputTokens - estimatedFixedOverheadTokens);
  const historySampleFactor = clamp(
    residualHistoryTokens / estimatedHistoryTokens,
    MIN_CALIBRATION_FACTOR,
    MAX_CALIBRATION_FACTOR,
  );
  const sameRoute = previous?.routeKey === routeKey;
  const previousHistoryFactor = previous?.historyFactor ?? previous?.factor ?? 1;
  const previousFixedOverhead = previous?.fixedOverheadTokens ?? estimatedFixedOverheadTokens;
  const factor = sameRoute
    ? previous.factor * (1 - CALIBRATION_ALPHA) + totalSampleFactor * CALIBRATION_ALPHA
    : totalSampleFactor;
  const historyFactor = sameRoute
    ? previousHistoryFactor * (1 - CALIBRATION_ALPHA) + historySampleFactor * CALIBRATION_ALPHA
    : historySampleFactor;
  const fixedOverheadTokens = sameRoute
    ? previousFixedOverhead * (1 - CALIBRATION_ALPHA) +
      estimatedFixedOverheadTokens * CALIBRATION_ALPHA
    : estimatedFixedOverheadTokens;

  return {
    routeKey,
    factor: clamp(factor, MIN_CALIBRATION_FACTOR, MAX_CALIBRATION_FACTOR),
    historyFactor: clamp(historyFactor, MIN_CALIBRATION_FACTOR, MAX_CALIBRATION_FACTOR),
    fixedOverheadTokens: Math.max(0, Math.ceil(fixedOverheadTokens)),
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
    usageScope?: string;
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
  const usageScope = config.usageScope?.trim() || 'main_agent';
  const route = JSON.stringify([
    provider,
    apiFormat,
    normalizedBaseUrl,
    config.model.trim(),
    ...(usageScope === 'main_agent' ? [] : [usageScope]),
  ]);
  return `context-route-v1:${createHash('sha256').update(route).digest('hex').slice(0, 24)}`;
}

/** Instruments the SDK Model boundary without changing its identity or instanceof behavior. */
export function observeModelUsage(
  model: string | Model,
  profile: ModelContextProfile | undefined,
  routeKey: string,
  usageScope = 'main_agent',
  resolveNamedModel?: NamedModelResolver,
): string | Model {
  if (!profile) return model;

  if (typeof model === 'string') {
    if (!resolveNamedModel) {
      throw new Error(
        `字符串模型 "${model}" 无法启用 usage 校准：请提供 resolveNamedModel`,
      );
    }
    model = new DeferredNamedModel(model, resolveNamedModel);
  }

  return new Proxy(model, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (property === 'getResponse' && typeof value === 'function') {
        return async (request: ModelRequest): Promise<ModelResponse> => {
          const estimate = estimateModelRequestTokenBreakdown(request);
          const response = await value.call(target, request) as ModelResponse;
          recordUsage(profile, routeKey, usageScope, estimate, response?.usage?.inputTokens);
          return response;
        };
      }
      if (property === 'getStreamedResponse' && typeof value === 'function') {
        return (request: ModelRequest): AsyncIterable<StreamEvent> => {
          const estimate = estimateModelRequestTokenBreakdown(request);
          const source = value.call(target, request) as AsyncIterable<StreamEvent>;
          return observeStreamUsage(source, profile, routeKey, usageScope, estimate);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Keeps named-model resolution lazy while still exposing a normal SDK Model.
 *
 * The Agents SDK normally resolves a string model through ModelProvider inside
 * Runner. The runtime observes the Model boundary instead, so a named model
 * needs the same resolution step before it can be instrumented. Resolving on
 * first use preserves the old lazy behavior and makes provider failures visible
 * at the actual model call.
 */
class DeferredNamedModel implements Model {
  private resolvedModel: Promise<Model> | undefined;

  constructor(
    private readonly modelName: string,
    private readonly resolveNamedModel: NamedModelResolver,
  ) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    const model = await this.resolveModel();
    return model.getResponse(request);
  }

  async *getStreamedResponse(
    request: ModelRequest,
  ): AsyncGenerator<StreamEvent> {
    const model = await this.resolveModel();
    yield* model.getStreamedResponse(request);
  }

  async getRetryAdvice(args: ModelRetryAdviceRequest) {
    const model = await this.resolveModel();
    return model.getRetryAdvice?.(args);
  }

  private resolveModel(): Promise<Model> {
    if (!this.resolvedModel) {
      this.resolvedModel = Promise.resolve(
        this.resolveNamedModel(this.modelName),
      );
    }
    return this.resolvedModel;
  }
}

async function* observeStreamUsage(
  source: AsyncIterable<StreamEvent>,
  profile: ModelContextProfile,
  routeKey: string,
  usageScope: string,
  estimate: ModelRequestTokenBreakdown,
): AsyncGenerator<StreamEvent> {
  for await (const event of source) {
    if (event.type === 'response_done') {
      recordUsage(
        profile,
        routeKey,
        usageScope,
        estimate,
        event.response?.usage?.inputTokens,
      );
    }
    yield event;
  }
}

function recordUsage(
  profile: ModelContextProfile,
  routeKey: string,
  usageScope: string,
  estimate: ModelRequestTokenBreakdown,
  actualInputTokens: number | undefined,
): void {
  if (typeof actualInputTokens !== 'number') return;
  const previous = profile.tokenCalibrations?.[routeKey] ??
    (profile.tokenCalibration?.routeKey === routeKey ? profile.tokenCalibration : undefined);
  const calibration = updateTokenEstimateCalibrationFromRequest(
    previous,
    routeKey,
    estimate.rawInputTokens,
    estimate.rawFixedOverheadTokens,
    actualInputTokens,
  );
  if (!calibration) return;
  profile.tokenCalibrations = {
    ...(profile.tokenCalibrations ?? {}),
    [routeKey]: calibration,
  };
  if (usageScope === 'main_agent') {
    profile.tokenCalibration = calibration;
  }
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
