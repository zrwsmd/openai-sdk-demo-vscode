import {
  defineToolInputGuardrail,
  ToolGuardrailFunctionOutputFactory,
} from "@openai/agents";
import { z } from "zod";
import {
  DefaultToolPolicy,
  toolResult,
  type ToolPolicy,
  type ToolRisk,
} from "../../tools/toolContract";
import { EffectRecoveryRequiredError } from "../errors";
import type { AgentConfig } from "../agent";
import type { AuditEvent } from "../../observability/audit";
import { workspaceScopeFromRoots, type WorkspaceScope } from "../../workspace/workspaceScope";
import { MockPlcAdapter, type PlcAdapter } from "../../plc/plcAdapter";
import { FallbackStAnalyzer } from "../../analysis/fallbackStAnalyzer";
import type {
  StAnalyzer,
  StAnalyzerToolOptions,
  StDiagnostic,
} from "../../analysis/stAnalyzer";
import type { DeliveryContract } from "../deliveryContract";
import type {
  DeliveryWorkflow,
  StValidationState,
} from "../deliveryWorkflow";
import type { DiagnosticRepairPacket } from "../diagnosticCompression";

export const TOOL_RISK_BY_NAME: Record<string, ToolRisk> = {
  get_io_table: "read",
  read_plc_variables: "read",
  validate_st_code: "plan",
  deliver_artifact: "plan",
  list_files: "read",
  read_file: "read",
  search_files: "read",
  export_st_program: "write",
  write_file: "write",
  run_command: "execute",
};

export type ToolEffect = "none" | "filesystem" | "process" | "device";

export interface DiagnosticSideReport {
  toolName: string;
  phase: string;
  summary: string;
  counts: {
    error: number;
    warning: number;
    info: number;
  };
  validationTarget: {
    path: string;
    complete: boolean;
    totalLines: number;
    totalBytes: number;
    contentHash: string;
  };
  diagnostics: StDiagnostic[];
  repairPacket?: DiagnosticRepairPacket;
}

export type DiagnosticSideReporter = (report: DiagnosticSideReport) => void;

export type ToolGuardrails = ReturnType<typeof buildToolGuardrails>;

export interface ToolBuildContext {
  cfg: AgentConfig;
  policy: ToolPolicy;
  plc: PlcAdapter;
  stAnalyzer: StAnalyzer;
  stToolOptions: StAnalyzerToolOptions;
  requiresStValidation: boolean;
  inlineStValidation: boolean;
  workspace: WorkspaceScope;
  guardrails: ToolGuardrails;
  deliveryWorkflow?: DeliveryWorkflow;
  stValidationState: StValidationState;
  validatedStContent: Set<string>;
  stValidationCache: Map<string, Promise<string>>;
  diagnosticReporter?: DiagnosticSideReporter;
  withEffect: <T>(
    toolName: string,
    input: unknown,
    risk: ToolRisk,
    execute: () => Promise<T>,
  ) => Promise<T>;
  contract: <T>(data: T, risk: ToolRisk, effect?: ToolEffect) => string;
  failed: (error: unknown, risk: ToolRisk, effect?: ToolEffect) => string;
  guard: <T>(
    fn: () => Promise<T>,
    risk: ToolRisk,
    effect?: ToolEffect,
  ) => Promise<T | string>;
  audit: (event: Omit<AuditEvent, "id" | "timestamp">) => void;
}

export const optionalIntParam = z.union([z.number(), z.string(), z.null()]).optional();
export const optionalStringParam = z.union([z.string(), z.null()]).optional();
export const optionalBooleanParam = z.union([z.boolean(), z.string(), z.null()]).optional();

export function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? value : undefined;
}

export function parseOptionalInt(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) && Number(trimmed) > 0
      ? Number(trimmed)
      : undefined;
  }
  return undefined;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "none" || normalized === "null" || normalized === "undefined") {
      return undefined;
    }
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return undefined;
}

export function commandToolResult(
  command: string,
  result: { exitCode: number | null; output: string },
): string {
  if (result.exitCode === 0) {
    return toolResult({
      ok: true,
      data: result,
      effect: "process",
      risk: "execute",
    });
  }
  const isTimeout = result.exitCode === null;
  const message = isTimeout
    ? "命令超时或被终止，未取得成功退出码。"
    : `命令执行失败，退出码 ${result.exitCode}。`;
  return toolResult({
    ok: false,
    data: result,
    error: message,
    diagnostics: [
      {
        code: isTimeout ? "command_timeout" : "command_nonzero_exit",
        message,
        severity: "error",
        details: { command, exitCode: result.exitCode },
      },
    ],
    effect: "process",
    risk: "execute",
    metadata: { exitCode: result.exitCode },
  });
}

function toolArguments(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function audit(
  cfg: AgentConfig,
  event: Omit<AuditEvent, "id" | "timestamp">,
): void {
  void Promise.resolve(cfg.audit?.(event)).catch(() => undefined);
}

function buildToolGuardrails(cfg: AgentConfig, policy: ToolPolicy) {
  const context = {
    workspaceRoot: cfg.workspaceRoot,
    workspaceRoots: cfg.workspaceRoots,
    ...cfg.policyContext,
  };
  const input = defineToolInputGuardrail({
    name: "industrial-tool-policy",
    run: async ({ toolCall }) => {
      const call = toolCall as { name?: string; arguments?: string };
      const name = call.name ?? "unknown_tool";
      const decision = policy.evaluate(
        name,
        toolArguments(call.arguments),
        context,
      );
      audit(cfg, {
        type: "guardrail_evaluated",
        toolName: name,
        risk: decision.risk,
        decision: decision.allowed ? "allow" : "deny",
        metadata: {
          requiresApproval: decision.requiresApproval,
          reason: decision.reason,
        },
      });
      return decision.allowed
        ? ToolGuardrailFunctionOutputFactory.allow(decision)
        : ToolGuardrailFunctionOutputFactory.rejectContent(
            decision.reason ?? "工具调用被工控安全策略拒绝。",
            decision,
          );
    },
  });
  return { input: [input], output: [] };
}

export function createToolBuildContext(
  cfg: AgentConfig,
  deliveryContract: DeliveryContract | undefined,
  deliveryWorkflow: DeliveryWorkflow | undefined,
  stValidationState: StValidationState,
  diagnosticReporter?: DiagnosticSideReporter,
): ToolBuildContext {
  const policy = cfg.policy ?? new DefaultToolPolicy();
  const plc = cfg.plcAdapter ?? new MockPlcAdapter();
  const stAnalyzer = cfg.stAnalyzer ?? new FallbackStAnalyzer();
  const stToolOptions = cfg.stAnalyzerOptions ?? {};
  const requiresStValidation = deliveryContract?.deliverables.some(
    (deliverable) =>
      deliverable.required &&
      deliverable.requiredVerificationTools?.includes("validate_st_code"),
  ) === true;
  const inlineStValidation = deliveryWorkflow?.validationInputMode === "inline_code";
  const workspace = workspaceScopeFromRoots(
    cfg.workspaceRoot,
    cfg.workspaceRoots,
  );
  const guardrails = buildToolGuardrails(cfg, policy);
  const withEffect = <T>(
    toolName: string,
    input: unknown,
    risk: ToolRisk,
    execute: () => Promise<T>,
  ) => {
    audit(cfg, { type: "tool_requested", toolName, risk });
    const run = () => execute();
    return cfg.executeEffect ? cfg.executeEffect(toolName, input, run) : run();
  };
  const contract = <T>(data: T, risk: ToolRisk, effect: ToolEffect = "none") =>
    toolResult({ ok: true, data, effect, risk });
  const failed = (
    error: unknown,
    risk: ToolRisk,
    effect: ToolEffect = "none",
  ) =>
    toolResult({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      effect,
      risk,
    });
  const guard = <T>(
    fn: () => Promise<T>,
    risk: ToolRisk,
    effect: ToolEffect = "none",
  ): Promise<T | string> =>
    fn().catch((e: unknown) => {
      if (e instanceof EffectRecoveryRequiredError) throw e;
      return failed(e, risk, effect);
    });

  return {
    cfg,
    policy,
    plc,
    stAnalyzer,
    stToolOptions,
    requiresStValidation,
    inlineStValidation,
    workspace,
    guardrails,
    deliveryWorkflow,
    stValidationState,
    validatedStContent: stValidationState.hashes,
    stValidationCache: new Map<string, Promise<string>>(),
    diagnosticReporter,
    withEffect,
    contract,
    failed,
    guard,
    audit: (event) => audit(cfg, event),
  };
}
