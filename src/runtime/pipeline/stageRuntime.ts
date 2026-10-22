import type { ToolResult } from "../../protocol/results";
import {
  type PipelineStagePlan,
  type PipelineToolEventInput,
} from "./stagePlan";

type PipelineToolRecord = {
  name: string;
  result: ToolResult;
};

export type PipelineNextToolDecision = {
  toolName: string;
  reason: string;
};

export class PipelineStageRuntime {
  private readonly visibleCallIdByFingerprint = new Map<string, string>();
  private readonly fingerprintByCallId = new Map<string, string>();
  private readonly suppressedCallIds = new Set<string>();

  constructor(private readonly plan: PipelineStagePlan | undefined) {}

  nextToolAfterResult(
    toolName: string,
    result: ToolResult | undefined,
    availableToolNames: Set<string>,
  ): PipelineNextToolDecision | undefined {
    if (!result) return undefined;
    for (const transition of this.plan?.resultTransitions ?? []) {
      if (transition.fromToolName !== toolName) continue;
      if (!availableToolNames.has(transition.toToolName)) continue;
      if (!transition.canTransition(result)) continue;
      return {
        toolName: transition.toToolName,
        reason: transition.reason,
      };
    }
    return undefined;
  }

  guardToolCall(
    toolName: string,
    records: readonly PipelineToolRecord[],
  ): string | undefined {
    const transitions = (this.plan?.resultTransitions ?? [])
      .filter((transition) => transition.toToolName === toolName);
    for (const transition of transitions) {
      const previous = [...records]
        .reverse()
        .find((record) => record.name === transition.fromToolName);
      if (!previous) continue;
      if (transition.canTransition(previous.result)) return undefined;
      const retryTransition = transitions.find(
        (candidate) =>
          candidate.fromToolName === transition.fromToolName &&
          candidate.canTransition(previous.result),
      );
      if (retryTransition) return undefined;
      return (
        `工作流要求先成功执行 ${transition.fromToolName}，` +
        `当前最近一次结果未通过，不能直接调用 ${toolName}。` +
        "请修正参数并重新完成前置步骤。"
      );
    }
    return undefined;
  }

  shouldSuppressStarted(event: PipelineToolEventInput): boolean {
    const fingerprint = this.toolInputFingerprint(event);
    if (!fingerprint) return false;
    const callId = event.callId ?? event.itemId ?? `${fingerprint}:anonymous`;
    const existingCallId = this.visibleCallIdByFingerprint.get(fingerprint);
    if (existingCallId && existingCallId !== callId) {
      this.suppressedCallIds.add(callId);
      return true;
    }
    this.visibleCallIdByFingerprint.set(fingerprint, callId);
    this.fingerprintByCallId.set(callId, fingerprint);
    return false;
  }

  shouldSuppressCompleted(callId: string | undefined): boolean {
    if (!callId) return false;
    if (this.suppressedCallIds.has(callId)) return true;
    const fingerprint = this.fingerprintByCallId.get(callId);
    if (
      fingerprint &&
      this.visibleCallIdByFingerprint.get(fingerprint) === callId
    ) {
      this.fingerprintByCallId.delete(callId);
    }
    return false;
  }

  private toolInputFingerprint(
    event: PipelineToolEventInput,
  ): string | undefined {
    if (!event.toolName) return undefined;
    for (const rule of this.plan?.duplicateToolFingerprints ?? []) {
      if (rule.toolName !== event.toolName) continue;
      const fingerprint = rule.fingerprint(event);
      return fingerprint ? `${this.plan?.id}:${fingerprint}` : undefined;
    }
    return undefined;
  }
}
