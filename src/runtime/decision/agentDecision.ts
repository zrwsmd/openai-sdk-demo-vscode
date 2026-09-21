/**
 * Small, typed decision layer used by the agent runtime.
 *
 * Jev is deliberately kept behind this module. The rest of the agent only
 * consumes bounded choices and probabilities, so the provider can be replaced
 * by a local model, a gateway, or deterministic rules without changing the
 * workflow code.
 */

export type JevJsonValue =
  | string
  | number
  | boolean
  | null
  | JevJsonValue[]
  | { [key: string]: JevJsonValue };

export type JevInstructions = string | JevJsonValue | JevJsonValue[];

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: JevInstructions;
  criteria: Record<string, JevInstructions | null>;
}

export interface JevNoulQuestion {
  type: 'noul';
  instructions: JevInstructions;
  criteria?: {
    true?: JevInstructions;
    false?: JevInstructions;
  };
}

export interface JevScoreQuestion {
  type: 'score';
  instructions: JevInstructions;
  criteria: JevInstructions[];
}

export type JevQuestion = JevChoiceQuestion | JevNoulQuestion | JevScoreQuestion;

export interface JevAnswer {
  type: 'choice' | 'noul' | 'score';
  choice?: string;
  noul?: number;
  score?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
  legend?: Record<string, string>;
}

export interface JevUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface JevDecisionSettings {
  /**
   * Defaults to true. The provider still stays inert when no internal key is
   * available, which makes local development and offline deployments safe.
   */
  enabled?: boolean;
  /** Injected by the host from its environment or secret manager. */
  apiKey?: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  minConfidence?: number;
}

export interface JevEvaluation {
  status: 'ok' | 'disabled' | 'failed';
  model?: string;
  answers?: Record<string, JevAnswer>;
  usage?: JevUsage;
  elapsedMs: number;
  httpStatus?: number;
  reason?: string;
}

export interface JevDecisionRequest {
  state: JevJsonValue;
  questions: Record<string, JevQuestion>;
  signal?: AbortSignal;
}

export type DecisionLogger = (line: string) => void;

interface NormalizedJevSettings {
  enabled: boolean;
  apiKey: string;
  endpoint: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  minConfidence: number;
}

const DEFAULT_JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_JEV_MODEL = 'jev-latest';
const DEFAULT_JEV_TIMEOUT_MS = 3_000;
const DEFAULT_JEV_MAX_RETRIES = 1;
const DEFAULT_JEV_MIN_CONFIDENCE = 0.78;
const TASK_CACHE_TTL_MS = 15_000;

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeSettings(settings?: JevDecisionSettings): NormalizedJevSettings {
  const timeoutMs = Math.max(
    250,
    Math.min(60_000, Math.round(asFiniteNumber(settings?.timeoutMs, DEFAULT_JEV_TIMEOUT_MS))),
  );
  const maxRetries = Math.max(
    0,
    Math.min(3, Math.round(asFiniteNumber(settings?.maxRetries, DEFAULT_JEV_MAX_RETRIES))),
  );
  const minConfidence = Math.max(
    0.5,
    Math.min(0.99, asFiniteNumber(settings?.minConfidence, DEFAULT_JEV_MIN_CONFIDENCE)),
  );
  return {
    enabled: settings?.enabled !== false,
    apiKey: settings?.apiKey?.trim() || (process.env.TYPESAFE_API_KEY ?? '').trim(),
    endpoint: settings?.endpoint?.trim() || DEFAULT_JEV_ENDPOINT,
    model: settings?.model?.trim() || DEFAULT_JEV_MODEL,
    timeoutMs,
    maxRetries,
    minConfidence,
  };
}

function secretFingerprint(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${value.length}:${hash >>> 0}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function parseAnswers(value: unknown): Record<string, JevAnswer> | undefined {
  if (!isRecord(value)) return undefined;
  const answers: Record<string, JevAnswer> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!isRecord(raw) || typeof raw.type !== 'string') return undefined;
    answers[id] = raw as unknown as JevAnswer;
  }
  return answers;
}

function parseUsage(value: unknown): JevUsage | undefined {
  if (!isRecord(value)) return undefined;
  const inputTokens = value.input_tokens;
  const outputTokens = value.output_tokens;
  if (
    typeof inputTokens !== 'number' ||
    typeof outputTokens !== 'number' ||
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  ) {
    return undefined;
  }
  return { inputTokens, outputTokens };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function retryDelayMs(response: Response | undefined, attempt: number): number {
  const retryAfter = response?.headers.get('retry-after');
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(3_000, Math.max(100, Math.round(seconds * 1_000)));
  }
  return Math.min(3_000, 200 * (2 ** attempt));
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('aborted'));
    };
    const complete = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    timer = setTimeout(complete, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Minimal HTTP client for System One. We intentionally use the raw API here:
 * the extension targets Node 18, while the official JS SDK currently targets
 * Node 20. The wire contract is small and stable.
 */
export class JevDecisionProvider {
  private readonly settings: NormalizedJevSettings;
  private readonly fetchImpl: typeof fetch;

  constructor(
    settings?: JevDecisionSettings,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.settings = normalizeSettings(settings);
    this.fetchImpl = fetchImpl;
  }

  async evaluate(request: JevDecisionRequest): Promise<JevEvaluation> {
    const startedAt = Date.now();
    if (!this.settings.enabled) {
      return {
        status: 'disabled',
        elapsedMs: Date.now() - startedAt,
        reason: 'Jev 已通过配置关闭',
      };
    }
    if (!this.settings.apiKey) {
      return {
        status: 'disabled',
        elapsedMs: Date.now() - startedAt,
        reason: '未注入 TYPESAFE_API_KEY，使用现有回退逻辑',
      };
    }
    if (request.signal?.aborted) {
      return {
        status: 'failed',
        elapsedMs: Date.now() - startedAt,
        reason: 'Jev 请求在发送前被取消',
      };
    }

    const body = JSON.stringify({
      model: this.settings.model,
      state: request.state,
      questions: request.questions,
    });

    let lastReason = '未知错误';
    let lastStatus: number | undefined;
    for (let attempt = 0; attempt <= this.settings.maxRetries; attempt += 1) {
      let response: Response | undefined;
      try {
        response = await this.fetchWithTimeout(body, request.signal);
        lastStatus = response.status;
        const text = await response.text();
        const parsed = parseJsonObject(text);
        if (response.ok) {
          const answers = parseAnswers(parsed?.answers);
          if (!answers) {
            return {
              status: 'failed',
              elapsedMs: Date.now() - startedAt,
              httpStatus: response.status,
              reason: 'Jev 返回缺少合法 answers',
            };
          }
          return {
            status: 'ok',
            model: typeof parsed?.model === 'string' ? parsed.model : this.settings.model,
            answers,
            usage: parseUsage(parsed?.usage),
            elapsedMs: Date.now() - startedAt,
            httpStatus: response.status,
          };
        }
        const apiError = isRecord(parsed?.error) ? parsed.error : parsed;
        const message = isRecord(apiError) && typeof apiError.message === 'string'
          ? apiError.message
          : text.slice(0, 300);
        lastReason = `HTTP ${response.status}${message ? `: ${message}` : ''}`;
        if (response.status !== 429 && response.status !== 529) break;
        if (attempt < this.settings.maxRetries) {
          await waitWithAbort(retryDelayMs(response, attempt), request.signal);
          continue;
        }
      } catch (error) {
        lastReason = errorMessage(error);
        if (request.signal?.aborted || attempt >= this.settings.maxRetries) break;
        await waitWithAbort(retryDelayMs(response, attempt), request.signal);
      }
    }
    return {
      status: 'failed',
      elapsedMs: Date.now() - startedAt,
      httpStatus: lastStatus,
      reason: lastReason,
    };
  }

  private async fetchWithTimeout(body: string, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.settings.timeoutMs);
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      return await this.fetchImpl(this.settings.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut && !signal?.aborted) {
        throw new Error(`Jev 请求超时(${this.settings.timeoutMs}ms)`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}

interface CachedTaskDecision {
  expiresAt: number;
  promise: Promise<TaskDecisionHint>;
}

export interface TaskDecisionHint {
  delivery: 'required' | 'not_required' | 'unknown';
  deliveryConfidence: number;
  orchestration: 'single' | 'team' | 'unknown';
  orchestrationConfidence: number;
  evaluation: JevEvaluation;
}

const TASK_QUESTIONS: Record<string, JevQuestion> = {
  delivery: {
    type: 'noul',
    instructions:
      'Does the request require the agent to produce a verifiable deliverable beyond a conversational explanation?',
    criteria: {
      true: 'The user asks to create, modify, save, export, generate, or otherwise hand over code, a file, a report, a project, or another concrete result.',
      false: 'The user only asks a question, explanation, status, lookup, or read-only inspection with no requested handoff.',
    },
  },
  orchestration: {
    type: 'choice',
    instructions: 'Which execution lane best fits this request?',
    criteria: {
      single: 'One agent can complete the request as one bounded operation or a simple sequence; includes ordinary questions, reads, writes, and straightforward code generation.',
      team: 'The request has genuinely independent planning, review, execution, and verification responsibilities, or a high-risk multi-step change where those roles should be separated.',
    },
  },
};

function answerConfidence(answer: JevAnswer | undefined): number {
  if (typeof answer?.confidence === 'number' && Number.isFinite(answer.confidence)) {
    return Math.max(0, Math.min(1, answer.confidence));
  }
  if (answer?.type === 'choice' && answer.choice && answer.probabilities) {
    return Math.max(0, Math.min(1, answer.probabilities[answer.choice] ?? 0));
  }
  return 0;
}

function buildTaskHint(evaluation: JevEvaluation, minConfidence: number): TaskDecisionHint {
  if (evaluation.status !== 'ok') {
    return {
      delivery: 'unknown',
      deliveryConfidence: 0,
      orchestration: 'unknown',
      orchestrationConfidence: 0,
      evaluation,
    };
  }
  const deliveryAnswer = evaluation.answers?.delivery;
  const deliveryProbability = deliveryAnswer?.type === 'noul' &&
    typeof deliveryAnswer.noul === 'number'
    ? Math.max(0, Math.min(1, deliveryAnswer.noul))
    : undefined;
  const deliveryConfidence = deliveryProbability === undefined
    ? 0
    : Math.abs(deliveryProbability - 0.5) * 2;
  const delivery = deliveryProbability === undefined
    ? 'unknown'
    : deliveryProbability >= minConfidence
      ? 'required'
      : deliveryProbability <= 1 - minConfidence
        ? 'not_required'
        : 'unknown';

  const routeAnswer = evaluation.answers?.orchestration;
  const routeConfidence = answerConfidence(routeAnswer);
  const route = routeAnswer?.type === 'choice' &&
    (routeAnswer.choice === 'single' || routeAnswer.choice === 'team') &&
    routeConfidence >= minConfidence
    ? routeAnswer.choice
    : 'unknown';
  return {
    delivery,
    deliveryConfidence,
    orchestration: route,
    orchestrationConfidence: routeConfidence,
    evaluation,
  };
}

/**
 * One shared decision service per host/runtime. It asks independent questions
 * together and briefly caches the result so delivery classification and team
 * routing do not pay for duplicate Jev calls in the same turn.
 */
export class AgentDecisionService {
  private readonly providers = new Map<string, JevDecisionProvider>();
  private readonly taskCache = new Map<string, CachedTaskDecision>();
  private readonly loggedDisabled = new Set<string>();

  constructor(private readonly log: DecisionLogger = () => {}) {}

  async taskHint(
    settings: JevDecisionSettings | undefined,
    userText: string,
    signal?: AbortSignal,
  ): Promise<TaskDecisionHint> {
    const normalized = normalizeSettings(settings);
    const providerKey = [
      normalized.enabled,
      normalized.endpoint,
      normalized.model,
      normalized.timeoutMs,
      normalized.maxRetries,
      normalized.minConfidence,
      secretFingerprint(normalized.apiKey),
    ].join('|');
    let provider = this.providers.get(providerKey);
    if (!provider) {
      provider = new JevDecisionProvider(settings);
      this.providers.set(providerKey, provider);
    }
    const cacheKey = `${providerKey}|${userText}`;
    const cached = this.taskCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;
    const promise = provider.evaluate({
      state: { request: userText },
      questions: TASK_QUESTIONS,
      signal,
    }).then((evaluation) => {
      const hint = buildTaskHint(evaluation, normalized.minConfidence);
      this.logResult(hint);
      return hint;
    });
    this.taskCache.set(cacheKey, {
      expiresAt: Date.now() + TASK_CACHE_TTL_MS,
      promise,
    });
    return promise;
  }

  private logResult(hint: TaskDecisionHint): void {
    const { evaluation } = hint;
    if (evaluation.status === 'disabled') {
      const reason = evaluation.reason ?? '未启用';
      if (!this.loggedDisabled.has(reason)) {
        this.loggedDisabled.add(reason);
        this.log(`[jev] disabled: ${reason}`);
      }
      return;
    }
    if (evaluation.status === 'failed') {
      this.log(`[jev] failed: ${evaluation.reason ?? '未知错误'}; fallback=existing_logic`);
      return;
    }
    const usage = evaluation.usage
      ? ` usage=${evaluation.usage.inputTokens}/${evaluation.usage.outputTokens}`
      : '';
    this.log(
      `[jev] ok model=${evaluation.model ?? 'unknown'} elapsed=${evaluation.elapsedMs}ms` +
      `${usage} delivery=${hint.delivery}(${hint.deliveryConfidence.toFixed(2)})` +
      ` orchestration=${hint.orchestration}(${hint.orchestrationConfidence.toFixed(2)})`,
    );
  }
}

export const DEFAULT_JEV_SETTINGS = {
  endpoint: DEFAULT_JEV_ENDPOINT,
  model: DEFAULT_JEV_MODEL,
  timeoutMs: DEFAULT_JEV_TIMEOUT_MS,
  maxRetries: DEFAULT_JEV_MAX_RETRIES,
  minConfidence: DEFAULT_JEV_MIN_CONFIDENCE,
} as const;
