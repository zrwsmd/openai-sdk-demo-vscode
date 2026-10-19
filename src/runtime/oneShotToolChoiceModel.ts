import type { Model } from "@openai/agents";

type ModelRequest = Parameters<Model["getResponse"]>[0];
type ModelResponse = Awaited<ReturnType<Model["getResponse"]>>;
type ModelStream = ReturnType<Model["getStreamedResponse"]>;
type ModelStreamEvent = ModelStream extends AsyncIterable<infer Event> ? Event : never;

export interface OneShotToolChoiceModel extends Model {
  requireToolOnce(toolName: string): void;
}

function isOneShotToolChoiceModel(model: Model): model is OneShotToolChoiceModel {
  return typeof (model as Partial<OneShotToolChoiceModel>).requireToolOnce === "function";
}

class OneShotToolChoiceModelWrapper implements OneShotToolChoiceModel {
  private requiredToolOnce?: string;

  constructor(private readonly inner: Model) {}

  requireToolOnce(toolName: string): void {
    this.requiredToolOnce = toolName;
  }

  getResponse(request: ModelRequest): Promise<ModelResponse> {
    return this.inner.getResponse(this.prepareRequest(request));
  }

  async *getStreamedResponse(
    request: ModelRequest,
  ): AsyncIterable<ModelStreamEvent> {
    yield* this.inner.getStreamedResponse(this.prepareRequest(request));
  }

  getRetryAdvice: Model["getRetryAdvice"] = (args) =>
    this.inner.getRetryAdvice?.(args);

  private prepareRequest(request: ModelRequest): ModelRequest {
    const requiredTool = this.requiredToolOnce;
    this.requiredToolOnce = undefined;
    if (!requiredTool) return request;
    return {
      ...request,
      modelSettings: {
        ...request.modelSettings,
        toolChoice: requiredTool,
      },
    };
  }
}

/**
 * Give every concrete SDK model the same one-request tool forcing capability.
 * GatewayGuardedModel already implements it and keeps its compatibility retry;
 * Responses and Anthropic Messages are wrapped at the provider-neutral boundary.
 */
export function withOneShotToolChoice(
  model: string | Model,
): string | OneShotToolChoiceModel {
  if (typeof model === "string" || isOneShotToolChoiceModel(model)) return model;
  return new OneShotToolChoiceModelWrapper(model);
}

export function requireToolOnce(
  model: string | Model,
  toolName: string,
): boolean {
  if (typeof model === "string" || !isOneShotToolChoiceModel(model)) return false;
  model.requireToolOnce(toolName);
  return true;
}
