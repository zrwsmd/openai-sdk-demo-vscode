import type { ToolResult } from "../../protocol/results";
import {
  hashStContent,
  type DeliveryWorkflow,
} from "../deliveryWorkflow";

export type PipelineNextToolDecision = {
  toolName: string;
  reason: string;
};

export type PipelineToolEventInput = {
  toolName?: string;
  args?: string;
  callId?: string;
  itemId?: string;
};

export class PipelineStageRuntime {
  private readonly visibleCallIdByFingerprint = new Map<string, string>();
  private readonly fingerprintByCallId = new Map<string, string>();
  private readonly suppressedCallIds = new Set<string>();

  constructor(private readonly workflow: DeliveryWorkflow | undefined) {}

  nextToolAfterResult(
    toolName: string,
    result: ToolResult | undefined,
    availableToolNames: Set<string>,
  ): PipelineNextToolDecision | undefined {
    if (
      this.workflow?.id !== "st_workspace_delivery" ||
      toolName !== "validate_st_code" ||
      !result?.ok ||
      !availableToolNames.has("write_file")
    ) {
      return undefined;
    }
    const data = result.data && typeof result.data === "object"
      ? result.data as Record<string, unknown>
      : {};
    if (
      data.errorCount !== 0 ||
      typeof data.validatedContentHash !== "string"
    ) {
      return undefined;
    }
    return {
      toolName: "write_file",
      reason: "validate_st_code 通过，下一轮强制工具: write_file",
    };
  }

  shouldSuppressStarted(event: PipelineToolEventInput): boolean {
    const fingerprint = this.toolInputFingerprint(event.toolName, event.args);
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
    toolName: string | undefined,
    args: string | undefined,
  ): string | undefined {
    if (
      this.workflow?.id !== "st_workspace_delivery" ||
      toolName !== "validate_st_code"
    ) {
      return undefined;
    }
    const rawArgs = args ?? "";
    try {
      const parsed = JSON.parse(rawArgs) as {
        code?: unknown;
        path?: unknown;
        loadWorkspaceContext?: unknown;
      };
      if (typeof parsed.code === "string" && parsed.code.length > 0) {
        return [
          "validate_st_code",
          "code",
          hashStContent(parsed.code),
          String(parsed.loadWorkspaceContext ?? "default"),
        ].join(":");
      }
      if (typeof parsed.path === "string" && parsed.path.length > 0) {
        return [
          "validate_st_code",
          "path",
          parsed.path,
          String(parsed.loadWorkspaceContext ?? "default"),
        ].join(":");
      }
    } catch {
      // Fall back to the raw argument hash below.
    }
    return rawArgs ? `validate_st_code:args:${hashStContent(rawArgs)}` : undefined;
  }
}
