import type { ToolResult } from "../../protocol/results";
import {
  type PipelineStagePlan,
  type PipelineToolEventInput,
} from "./stagePlan";

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
