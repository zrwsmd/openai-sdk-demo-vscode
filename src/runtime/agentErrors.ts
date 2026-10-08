import { MaxTurnsExceededError } from "@openai/agents";
import { EffectRecoveryRequiredError } from "./errors";
import { AgentOutputValidationError } from "./output";
import { EmptyGatewayResponseError } from "./modelGateway";

export class AgentActionVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentActionVerificationError";
  }
}

const AGENT_RUN_STATE_FIELD = "agentRunState";

export function attachResumableAgentState(
  error: unknown,
  state: string | undefined,
): void {
  if (!state || !error || (typeof error !== "object" && typeof error !== "function")) return;
  try {
    Object.defineProperty(error, AGENT_RUN_STATE_FIELD, {
      value: state,
      configurable: true,
      enumerable: false,
    });
  } catch {
    // Some third-party errors are frozen. The coordinator will use its safe
    // restart fallback when the state cannot be attached.
  }
}

/** Returns the SDK RunState captured at the point a streamed run failed. */
export function getResumableAgentState(error: unknown): string | undefined {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return undefined;
  const value = (error as Record<string, unknown>)[AGENT_RUN_STATE_FIELD];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Transient provider failures may continue from RunState or a safe boundary. */
export function isRetryableAgentError(error: unknown): boolean {
  if (
    error instanceof MaxTurnsExceededError ||
    error instanceof EmptyGatewayResponseError ||
    error instanceof AgentActionVerificationError ||
    error instanceof AgentOutputValidationError ||
    error instanceof EffectRecoveryRequiredError
  ) {
    return false;
  }

  const statuses: number[] = [];
  const names: string[] = [];
  const codes: string[] = [];
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && depth < 6; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    if (typeof current === "string") {
      messages.push(current);
      break;
    }
    if (typeof current !== "object" && typeof current !== "function") {
      messages.push(String(current));
      break;
    }
    const item = current as Record<string, unknown>;
    for (const candidate of [
      item.status,
      item.statusCode,
      (item.response as Record<string, unknown> | undefined)?.status,
    ]) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) statuses.push(candidate);
    }
    if (typeof item.name === "string") names.push(item.name);
    if (typeof item.code === "string") codes.push(item.code);
    if (typeof item.message === "string") messages.push(item.message);
    current = item.cause ?? item.error;
  }

  if (
    statuses.some(
      (status) =>
        status === 408 ||
        status === 409 ||
        status === 425 ||
        status === 429 ||
        status >= 500,
    )
  ) {
    return true;
  }
  if (
    statuses.some(
      (status) =>
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 404 ||
        status === 422,
    )
  ) {
    return false;
  }
  if (
    names.some((name) =>
      /^(?:APIConnectionError|APIConnectionTimeoutError|ModelTimeoutError)$/i.test(name),
    )
  ) {
    return true;
  }
  if (
    codes.some((code) =>
      /^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|UND_ERR_BODY_TIMEOUT|UND_ERR_HEADERS_TIMEOUT)$/i.test(
        code,
      ),
    )
  ) {
    return true;
  }
  if (
    messages.some((message) => /\bterminated\b/i.test(message)) &&
    (
      names.some((name) => /^(?:TypeError|SocketError)$/i.test(name)) ||
      codes.some((code) => /^UND_ERR_/i.test(code))
    )
  ) {
    return true;
  }
  const text = messages.join(" ");
  return /\b(?:408|409|425|429|5\d\d)\b|gateway\s+(?:is\s+)?unavailable|connection\s+(?:error|failed|reset|refused|terminated)|network\s+error|fetch\s+failed|timed?\s*out/i.test(text);
}

export function isAgentCancellationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.name === "APIUserAbortError" ||
    error.constructor.name === "APIUserAbortError" ||
    error.message === "Request was aborted."
  );
}
