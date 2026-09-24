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
import type { AgentConfig } from "../agentConfig";
import type { AuditEvent } from "../../observability/audit";
import { workspaceScopeFromRoots, type WorkspaceScope } from "../../workspace/workspaceScope";
import { MockPlcAdapter, type PlcAdapter } from "../../plc/plcAdapter";
import type { WorkflowContract, WorkflowRuntime } from "../workflow/types";
import type { Diagnostic } from "../../protocol/results";
import {
  EMPTY_RUNTIME_SERVICES,
  type RuntimeServiceContainer,
} from "../services";

export type ToolEffect = "none" | "filesystem" | "process" | "device";

export interface RuntimeDiagnosticReport {
  summary: string;
  toolName?: string;
  phase?: string;
  diagnostics?: readonly unknown[];
  [key: string]: unknown;
}

export type DiagnosticSideReporter = (report: RuntimeDiagnosticReport) => void;
export type RuntimeToolCallGuard = (
  toolName: string,
  input: unknown,
) => string | undefined;

export interface BeforeEffectContext {
  toolName: string;
  input: unknown;
  workspace: WorkspaceScope;
  signal?: AbortSignal;
}

export interface BeforeEffectResult {
  ok: boolean;
  risk?: ToolRisk;
  error?: string;
  failureData?: unknown;
  diagnostics?: readonly Diagnostic[];
  metadata?: Record<string, unknown>;
  receiptData?: Record<string, unknown>;
}

export type BeforeEffectHook = (
  context: BeforeEffectContext,
) => Promise<BeforeEffectResult | undefined>;

export type ToolGuardrails = ReturnType<typeof buildToolGuardrails>;

export interface ToolBuildContext {
  cfg: AgentConfig;
  services: RuntimeServiceContainer;
  policy: ToolPolicy;
  plc: PlcAdapter;
  workspace: WorkspaceScope;
  guardrails: ToolGuardrails;
  workflowContract?: WorkflowContract;
  workflow?: WorkflowRuntime;
  diagnosticReporter?: DiagnosticSideReporter;
  beforeEffectsFor: (toolName: string) => readonly BeforeEffectHook[];
  registerBeforeEffect: (toolName: string, hook: BeforeEffectHook) => void;
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

/**
 * @openai/agents strict tool schemas expose optional object properties as
 * required. A default keeps the outgoing schema unambiguous while preserving
 * compatibility with omitted or null legacy inputs.
 */
export function defaultedIntParam(defaultValue: number) {
  return optionalIntParam.default(defaultValue);
}

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

function buildToolGuardrails(
  cfg: AgentConfig,
  policy: ToolPolicy,
  runtimeToolGuard?: RuntimeToolCallGuard,
  riskByTool?: Readonly<Record<string, ToolRisk>>,
) {
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
      const input = toolArguments(call.arguments);
      const decision = policy.evaluate(
        name,
        input,
        context,
      );
      const risk = riskByTool?.[name];
      const runtimeReason = decision.allowed
        ? runtimeToolGuard?.(name, input)
        : undefined;
      const finalDecision = runtimeReason
        ? { ...decision, allowed: false, reason: runtimeReason }
        : decision;
      const registeredDecision = risk
        ? {
            ...finalDecision,
            risk,
            requiresApproval: risk === "write" || risk === "execute",
          }
        : finalDecision;
      audit(cfg, {
        type: "guardrail_evaluated",
        toolName: name,
        risk: registeredDecision.risk,
        decision: registeredDecision.allowed ? "allow" : "deny",
        metadata: {
          requiresApproval: registeredDecision.requiresApproval,
          reason: registeredDecision.reason,
        },
      });
      return registeredDecision.allowed
        ? ToolGuardrailFunctionOutputFactory.allow(registeredDecision)
        : ToolGuardrailFunctionOutputFactory.rejectContent(
            registeredDecision.reason ?? "工具调用被工控安全策略拒绝。",
            registeredDecision,
          );
    },
  });
  return { input: [input], output: [] };
}

export function createToolBuildContext(
  cfg: AgentConfig,
  options: {
    workflowContract?: WorkflowContract;
    workflow?: WorkflowRuntime;
    diagnosticReporter?: DiagnosticSideReporter;
    runtimeToolGuard?: RuntimeToolCallGuard;
    riskByTool?: Readonly<Record<string, ToolRisk>>;
    beforeEffectsFor: (toolName: string) => readonly BeforeEffectHook[];
    registerBeforeEffect: (toolName: string, hook: BeforeEffectHook) => void;
  },
): ToolBuildContext {
  const policy = cfg.policy ?? new DefaultToolPolicy(options.riskByTool);
  const plc = cfg.plcAdapter ?? new MockPlcAdapter();
  const workspace = workspaceScopeFromRoots(
    cfg.workspaceRoot,
    cfg.workspaceRoots,
  );
  const guardrails = buildToolGuardrails(
    cfg,
    policy,
    options.runtimeToolGuard,
    options.riskByTool,
  );
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
    services: cfg.services ?? EMPTY_RUNTIME_SERVICES,
    policy,
    plc,
    workspace,
    guardrails,
    workflowContract: options.workflowContract,
    workflow: options.workflow,
    diagnosticReporter: options.diagnosticReporter,
    beforeEffectsFor: options.beforeEffectsFor,
    registerBeforeEffect: options.registerBeforeEffect,
    withEffect,
    contract,
    failed,
    guard,
    audit: (event) => audit(cfg, event),
  };
}
