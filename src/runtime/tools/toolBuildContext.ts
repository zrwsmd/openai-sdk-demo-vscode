import {
  defineToolInputGuardrail,
  ToolGuardrailFunctionOutputFactory,
} from "@openai/agents";
import path from "node:path";
import { promises as fs } from "node:fs";
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
import {
  WorkspaceScopeError,
  workspaceScopeFromRoots,
  type ResolvedWorkspacePath,
  type WorkspaceScope,
} from "../../workspace/workspaceScope";
import { MockPlcAdapter, type PlcAdapter } from "../../plc/plcAdapter";
import type { WorkflowContract, WorkflowRuntime } from "../workflow/types";
import type { Diagnostic, ToolResultAction } from "../../protocol/results";
import type { CommandRunner } from "../../tools/commandRunner";
import { LocalCommandRunner } from "../../tools/localCommandRunner";
import {
  EMPTY_RUNTIME_SERVICES,
  type RuntimeServiceContainer,
} from "../services";
import type { SkillCatalog } from "../skills/skillCatalog";

export type ToolEffect = "none" | "filesystem" | "process" | "device";
export type BeforeEffectResourceKind =
  | "file"
  | "directory"
  | "workspace"
  | "command"
  | "device"
  | (string & {});

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
  effect: ToolEffect;
  resourceKind: BeforeEffectResourceKind;
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
  afterEffect?: AfterEffectHook;
}

export type BeforeEffectHook = (
  context: BeforeEffectContext,
) => Promise<BeforeEffectResult | undefined>;

export type AfterEffectResult = Omit<BeforeEffectResult, "afterEffect">;

export type AfterEffectHook = () => Promise<AfterEffectResult | undefined>;

/**
 * A provider can target a concrete tool or a generic effect surface.
 *
 * `resourceKind: "file"` is deliberately domain-neutral: it lets a provider
 * protect every file-writing tool without making the common tool layer know
 * which domain needs the protection.
 */
export interface BeforeEffectSelector {
  toolName?: string;
  effect?: ToolEffect;
  resourceKind?: BeforeEffectResourceKind;
}

export type BeforeEffectRegistration = string | BeforeEffectSelector;

export interface BeforeEffectRunResult {
  ok: boolean;
  receiptData: Record<string, unknown>;
  failure?: BeforeEffectResult;
  afterEffects: readonly AfterEffectHook[];
}

export function matchesBeforeEffect(
  selector: BeforeEffectRegistration,
  request: BeforeEffectContext,
): boolean {
  if (typeof selector === "string") return selector === request.toolName;
  return (
    (selector.toolName === undefined || selector.toolName === request.toolName) &&
    (selector.effect === undefined || selector.effect === request.effect) &&
    (selector.resourceKind === undefined ||
      selector.resourceKind === request.resourceKind)
  );
}

export function beforeEffectFailureResult(result: BeforeEffectResult): string {
  return toolResult({
    ok: false,
    error: result.error ?? "副作用前置检查未通过。",
    ...(result.failureData !== undefined
      ? { data: result.failureData }
      : {}),
    ...(result.diagnostics
      ? { diagnostics: [...result.diagnostics] }
      : {}),
    ...(result.metadata ? { metadata: result.metadata } : {}),
    effect: "none",
    risk: result.risk ?? "plan",
  });
}

export type ToolGuardrails = ReturnType<typeof buildToolGuardrails>;

export interface ToolBuildContext {
  cfg: AgentConfig;
  skillCatalog?: SkillCatalog;
  /** 当前轮用户原始需求，供领域工具生成上下文相关建议；不作为工具参数暴露给模型。 */
  userText?: string;
  services: RuntimeServiceContainer;
  policy: ToolPolicy;
  plc: PlcAdapter;
  commandRunner: CommandRunner;
  workspace: WorkspaceScope;
  /** Resolve a file/directory and, when needed, ask to extend this turn's scope. */
  resolveWorkspacePath: (
    input: string,
    options?: WorkspacePathResolutionOptions,
  ) => Promise<ResolvedWorkspacePath>;
  guardrails: ToolGuardrails;
  workflowContract?: WorkflowContract;
  workflow?: WorkflowRuntime;
  diagnosticReporter?: DiagnosticSideReporter;
  beforeEffectsFor: (
    request: BeforeEffectContext,
  ) => readonly BeforeEffectHook[];
  registerBeforeEffect: (
    selector: BeforeEffectRegistration,
    hook: BeforeEffectHook,
  ) => void;
  runBeforeEffects: (
    request: BeforeEffectContext,
  ) => Promise<BeforeEffectRunResult>;
  runAfterEffects: (
    prepared: BeforeEffectRunResult,
  ) => Promise<BeforeEffectRunResult>;
  withEffect: <T>(
    toolName: string,
    input: unknown,
    risk: ToolRisk,
    execute: () => Promise<T>,
  ) => Promise<T>;
  contract: <T>(
    data: T,
    risk: ToolRisk,
    effect?: ToolEffect,
    actions?: ToolResultAction[],
  ) => string;
  failed: (error: unknown, risk: ToolRisk, effect?: ToolEffect) => string;
  guard: <T>(
    fn: () => Promise<T>,
    risk: ToolRisk,
    effect?: ToolEffect,
  ) => Promise<T | string>;
  audit: (event: Omit<AuditEvent, "id" | "timestamp">) => void;
}

export interface WorkspacePathResolutionOptions {
  /** File targets authorize their parent directory; directory targets authorize themselves. */
  targetKind?: "file" | "directory";
  /** A write target must agree with an absolute directory explicitly named by the user. */
  enforceUserTarget?: boolean;
  signal?: AbortSignal;
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

const ABSOLUTE_PATH_PATTERN = /(?:["'`]((?:[A-Za-z]:[\\/]|\\\\)[^"'`，。！？]+)["'`]|(?:[A-Za-z]:[\\/]|\\\\)[^\s"'`，。！？,;:]+)/gu;

function trimTargetPathToken(value: string): string {
  return value
    .trim()
    .replace(/[)}\],.;:!?，。！？]+$/gu, "")
    .replace(/(?:下面|目录|路径|文件夹|中|内|下)$/u, "");
}

function targetRootsFromUserText(userText: string | undefined): readonly string[] {
  if (!userText?.trim()) return [];
  const roots: string[] = [];
  for (const match of userText.matchAll(ABSOLUTE_PATH_PATTERN)) {
    const raw = trimTargetPathToken(match[1] ?? match[0]);
    if (!raw) continue;
    const before = userText.slice(Math.max(0, (match.index ?? 0) - 48), match.index ?? 0);
    // A path mentioned as the source of a read/copy is not the write target.
    if (!/(?:写|保存|落盘|生成|创建|导出|放|目标|到|在)/u.test(before)) continue;
    if (/(?:从|读取|读|查看|打开)\s*$/u.test(before)) continue;
    const absolute = path.resolve(raw);
    const root = path.extname(path.basename(absolute))
      ? path.dirname(absolute)
      : absolute;
    if (!roots.includes(root)) roots.push(root);
  }
  return roots;
}

function pathIsWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function userTargetMismatch(
  userText: string | undefined,
  candidateAbsolutePath: string,
): string | undefined {
  const targets = targetRootsFromUserText(userText);
  if (!targets.length || targets.some((root) => pathIsWithin(root, candidateAbsolutePath))) {
    return undefined;
  }
  return targets.join("、");
}

async function authorizationRootForPath(
  candidateAbsolutePath: string,
  targetKind: WorkspacePathResolutionOptions["targetKind"],
): Promise<string> {
  if (targetKind === "directory") return candidateAbsolutePath;
  const existing = await fs.stat(candidateAbsolutePath).catch(() => undefined);
  if (existing?.isDirectory()) return candidateAbsolutePath;
  return path.dirname(candidateAbsolutePath);
}

async function askForWorkspaceAuthorization(
  cfg: AgentConfig,
  root: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!cfg.clarification) return false;
  const response = await cfg.clarification.request({
    kind: "workspace_authorization",
    title: "需要授权目标目录",
    question: `目标目录 ${root} 尚未加入本轮授权，是否将该目录加入本轮授权？`,
    details: "完全访问权限不会自动扩大工作区边界；只有明确同意后，本轮工具才能访问该目录。",
    options: [
      {
        id: "authorize",
        label: "加入本轮授权",
        description: `允许本轮访问 ${root}`,
        value: root,
      },
      {
        id: "cancel",
        label: "取消",
        description: "保持当前授权范围，不执行本次访问",
      },
    ],
    allowCustom: false,
    required: true,
  }, signal);
  return !response.cancelled && response.selectedOptionId === "authorize";
}

async function resolveWorkspacePathWithAuthorization(
  cfg: AgentConfig,
  workspace: WorkspaceScope,
  input: string,
  userText: string | undefined,
  options: WorkspacePathResolutionOptions = {},
): Promise<ResolvedWorkspacePath> {
  const candidateAbsolutePath = workspace.candidateAbsolutePath(input);
  if (options.enforceUserTarget) {
    const requestedRoot = userTargetMismatch(userText, candidateAbsolutePath);
    if (requestedRoot) {
      throw new WorkspaceScopeError(
        `用户明确指定的写入目标是 ${requestedRoot}，但本次 write_file 参数解析为 ${candidateAbsolutePath}，已阻止写入。` +
          "请先确认目标目录，再使用该目录下的绝对路径重试；不能静默改写到其他工作区。",
      );
    }
  }
  try {
    return workspace.resolve(input);
  } catch (error) {
    if (!(error instanceof WorkspaceScopeError) || !candidateAbsolutePath || !workspace.roots.length) {
      throw error;
    }
    if (workspace.isAuthorizedAbsolutePath(candidateAbsolutePath)) throw error;
    const root = await authorizationRootForPath(candidateAbsolutePath, options.targetKind ?? "file");
    const authorized = await askForWorkspaceAuthorization(cfg, root, options.signal);
    if (!authorized) {
      throw new WorkspaceScopeError(
        `目标目录 ${root} 未获本轮授权，已阻止访问。请明确选择“加入本轮授权”后重试。`,
      );
    }
    workspace.addRoot(root);
    try {
      return workspace.resolve(input);
    } catch (error) {
      // A relative traversal such as `../shared/file.txt` still resolves to
      // the newly authorized root after the user explicitly approved it.
      if (workspace.isAuthorizedAbsolutePath(candidateAbsolutePath)) {
        return workspace.resolveAbsolutePath(candidateAbsolutePath);
      }
      throw error;
    }
  }
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
    userText?: string;
    skillCatalog?: SkillCatalog;
    workflowContract?: WorkflowContract;
    workflow?: WorkflowRuntime;
    diagnosticReporter?: DiagnosticSideReporter;
    runtimeToolGuard?: RuntimeToolCallGuard;
    riskByTool?: Readonly<Record<string, ToolRisk>>;
    beforeEffectsFor: (
      request: BeforeEffectContext,
    ) => readonly BeforeEffectHook[];
    registerBeforeEffect: (
      selector: BeforeEffectRegistration,
      hook: BeforeEffectHook,
    ) => void;
  },
): ToolBuildContext {
  const policy = cfg.policy ?? new DefaultToolPolicy(options.riskByTool);
  const plc = cfg.plcAdapter ?? new MockPlcAdapter();
  const commandRunner = cfg.commandRunner ?? new LocalCommandRunner();
  const workspace = workspaceScopeFromRoots(
    cfg.workspaceRoot,
    cfg.workspaceRoots,
  );
  const resolveWorkspacePath = (
    input: string,
    resolutionOptions?: WorkspacePathResolutionOptions,
  ): Promise<ResolvedWorkspacePath> =>
    resolveWorkspacePathWithAuthorization(
      cfg,
      workspace,
      input,
      options.userText,
      resolutionOptions,
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
  const contract = <T>(
    data: T,
    risk: ToolRisk,
    effect: ToolEffect = "none",
    actions?: ToolResultAction[],
  ) =>
    toolResult({
      ok: true,
      data,
      effect,
      risk,
      ...(actions?.length ? { actions } : {}),
    });
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
  const runBeforeEffects = async (
    request: BeforeEffectContext,
  ): Promise<BeforeEffectRunResult> => {
    const receiptData: Record<string, unknown> = {};
    const afterEffects: AfterEffectHook[] = [];
    for (const beforeEffect of options.beforeEffectsFor(request)) {
      const result = await beforeEffect(request);
      if (!result) continue;
      if (!result.ok) return { ok: false, receiptData, failure: result, afterEffects };
      Object.assign(receiptData, result.receiptData ?? {});
      if (result.afterEffect) afterEffects.push(result.afterEffect);
    }
    return { ok: true, receiptData, afterEffects };
  };
  const runAfterEffects = async (
    prepared: BeforeEffectRunResult,
  ): Promise<BeforeEffectRunResult> => {
    const receiptData = { ...prepared.receiptData };
    for (const afterEffect of prepared.afterEffects) {
      const result = await afterEffect();
      if (!result) continue;
      if (!result.ok) {
        return {
          ok: false,
          receiptData,
          failure: result,
          afterEffects: [],
        };
      }
      Object.assign(receiptData, result.receiptData ?? {});
    }
    return { ok: true, receiptData, afterEffects: [] };
  };

  return {
    cfg,
    skillCatalog: options.skillCatalog,
    userText: options.userText,
    services: cfg.services ?? EMPTY_RUNTIME_SERVICES,
    policy,
    plc,
    commandRunner,
    workspace,
    resolveWorkspacePath,
    guardrails,
    workflowContract: options.workflowContract,
    workflow: options.workflow,
    diagnosticReporter: options.diagnosticReporter,
    beforeEffectsFor: options.beforeEffectsFor,
    registerBeforeEffect: options.registerBeforeEffect,
    runBeforeEffects,
    runAfterEffects,
    withEffect,
    contract,
    failed,
    guard,
    audit: (event) => audit(cfg, event),
  };
}
