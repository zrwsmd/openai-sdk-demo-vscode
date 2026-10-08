import {
  Agent,
  MaxTurnsExceededError,
  Runner,
  type AgentInputItem,
} from "@openai/agents";
import { z } from "zod";
import {
  industrialAgentOutputDefinition,
  AgentOutputValidationError,
  type IndustrialAgentOutput,
} from "./output";
import type { AgentConfig } from "./agentConfig";
import { AgentDecisionService } from "./decision/agentDecision";
import { agentLog, buildModelAdapter } from "./modelGateway";
import type { WorkflowDecisionSignals } from "./workflow/types";
import {
  createTeamTask,
  teamPlannerReportSchema,
  teamReviewReportSchema,
  teamRouteDecisionSchema,
  teamVerificationReportSchema,
  type TeamTask,
  type TeamPlannerReport,
  type TeamReviewReport,
  type TeamVerificationReport,
} from "../orchestration/teamTask";

function teamTracingDisabled(cfg: AgentConfig, adapter: {
  provider: string;
  apiFormat: string;
}): boolean {
  return !(adapter.provider === "openai" && adapter.apiFormat === "responses" && !cfg.baseUrl.trim());
}

const TEAM_ROLE_REPAIR_ATTEMPTS = 1;

function stringifyForPrompt(value: unknown, maxLength = 4_000): string {
  const text = typeof value === "string"
    ? value
    : JSON.stringify(value, null, 2) ?? String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function tryParseJsonLikeOutput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const firstObject = unfenced.indexOf("{");
    const lastObject = unfenced.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      try {
        return JSON.parse(unfenced.slice(firstObject, lastObject + 1));
      } catch {
        return value;
      }
    }
    return value;
  }
}

function formatZodIssues(error: z.ZodError, maxIssues = 8): string {
  return error.issues
    .slice(0, maxIssues)
    .map((issue) => {
      const pathText = issue.path.length ? issue.path.join(".") : "<root>";
      return `${pathText}: ${issue.message}`;
    })
    .join("; ");
}

function parseSchemaOutput<T>(
  schema: z.ZodType<T>,
  rawOutput: unknown,
): { ok: true; value: T } | { ok: false; issues: string; raw: string } {
  const candidate = tryParseJsonLikeOutput(rawOutput);
  const parsed = schema.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: formatZodIssues(parsed.error),
    raw: stringifyForPrompt(rawOutput),
  };
}

function teamRoleSchemaInstruction(name: string): string {
  switch (name) {
    case "协作任务路由器":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: route('single'|'team'), goal(string), reason(string), planSummary(string), reviewFocus(string[]), verificationCriteria(string[])。",
      ].join("\n");
    case "Team Planner":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: planSummary(string), reviewFocus(string[]), verificationCriteria(string[]), executionGraph(optional object)。",
        "executionGraph.nodes 每项必须包含 id,title,objective,dependsOn,completionCriteria,suggestedTools,effect,resources,parallelSafe,priority。",
      ].join("\n");
    case "Team Reviewer":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: approved(boolean), summary(string), findings(string[]), requiredChanges(string[])。",
      ].join("\n");
    case "Team Verifier":
      return [
        "只返回 JSON 对象，不要 markdown、代码块或解释文字。",
        "字段: passed(boolean), summary(string), evidence(string[]), gaps(string[]), decision(optional 'pass'|'retry'|'ask_user'|'revise')。",
      ].join("\n");
    default:
      return "只返回符合本角色 schema 的 JSON 对象，不要 markdown、代码块或解释文字。";
  }
}

function appendTeamRoleRepairInput(
  input: string | AgentInputItem[],
  repairPrompt: string,
): string | AgentInputItem[] {
  if (typeof input === "string") return `${input}\n\n${repairPrompt}`;
  return [...input, { type: "message", role: "user", content: repairPrompt }];
}

function teamRoleTextDelta(event: any): string {
  const raw = event?.type === "raw_model_stream_event"
    ? event.data
    : event?.event ?? event?.data ?? event;
  if (!raw || typeof raw !== "object") return "";
  if (
    (raw.type === "output_text_delta" ||
      raw.type === "response.output_text.delta") &&
    typeof raw.delta === "string"
  ) {
    return raw.delta;
  }
  const delta = raw.choices?.[0]?.delta ?? raw.providerData?.choices?.[0]?.delta;
  return typeof delta?.content === "string" ? delta.content : "";
}

async function runTeamRoleRawOutput(
  runner: Runner,
  role: Agent<any, any>,
  input: string | AgentInputItem[],
  signal?: AbortSignal,
): Promise<unknown> {
  const stream = await runner.run(role, input, {
    stream: true,
    maxTurns: 1,
    signal,
  });
  let text = "";
  try {
    for await (const event of stream) {
      text += teamRoleTextDelta(event);
    }
  } catch (error) {
    if (!(error instanceof MaxTurnsExceededError) || !text.trim()) throw error;
  }
  try {
    await stream.completed;
  } catch (error) {
    if (!(error instanceof MaxTurnsExceededError) || !text.trim()) throw error;
  }
  return typeof stream.finalOutput === "string" && stream.finalOutput.trim()
    ? stream.finalOutput
    : text;
}

function asPlainFinalMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  const candidate = tryParseJsonLikeOutput(value);
  if (candidate && typeof candidate === "object") {
    const message = (candidate as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
}

export function coerceIndustrialAgentOutput(value: unknown): IndustrialAgentOutput | undefined {
  const candidate = tryParseJsonLikeOutput(value);
  const parsed = industrialAgentOutputDefinition.schema.safeParse(candidate);
  if (parsed.success) return parsed.data as IndustrialAgentOutput;
  const message = asPlainFinalMessage(value);
  return message
    ? { message, diagnostics: [], artifacts: [], data: null }
    : undefined;
}

export function isInvalidFinalOutputTypeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: unknown; message?: unknown };
  const name = typeof value.name === "string" ? value.name : "";
  const message = typeof value.message === "string" ? value.message : "";
  return name === "ModelBehaviorError" &&
    /Invalid output type|final assistant output/i.test(message);
}

async function runTeamRole<T>(
  cfg: AgentConfig,
  name: string,
  instructions: string,
  outputType: z.ZodType<T>,
  input: string | AgentInputItem[],
  signal?: AbortSignal,
): Promise<T> {
  const adapter = buildModelAdapter(cfg, "team_role");
  const role = new Agent({
    name,
    model: adapter.model,
    instructions:
      instructions +
      "\n\n结构化输出要求:\n" +
      teamRoleSchemaInstruction(name) +
      "\n如果上一轮被指出 schema 错误,只修正 JSON 结构并重新返回完整对象。",
    // Team role schemas can contain a bounded execution graph. The gateway's
    // small default output cap can cut that JSON in the middle and surface as
    // a misleading "output did not match schema" error.
    modelSettings: { maxTokens: 8_000 },
  });
  const runner = new Runner({ tracingDisabled: teamTracingDisabled(cfg, adapter) });
  let currentInput = input;
  let lastIssues = "";
  let lastRaw = "";
  for (let attempt = 0; attempt <= TEAM_ROLE_REPAIR_ATTEMPTS; attempt += 1) {
    const rawOutput = await runTeamRoleRawOutput(runner, role, currentInput, signal);
    const parsed = parseSchemaOutput(outputType, rawOutput);
    if (parsed.ok) return parsed.value;
    lastIssues = parsed.issues;
    lastRaw = parsed.raw;
    if (attempt < TEAM_ROLE_REPAIR_ATTEMPTS) {
      agentLog(
        `[team] ${name} 结构化输出未通过 schema，要求模型按字段错误修正: ${lastIssues}`,
      );
      currentInput = appendTeamRoleRepairInput(
        input,
        "上一轮结构化输出没有通过 schema 校验。请根据下面的字段级错误自查并重试,只返回完整 JSON 对象。\n" +
          `schema错误: ${lastIssues}\n` +
          `上一轮原始输出: ${lastRaw}`,
      );
    }
  }
  throw new AgentOutputValidationError(
    `${name} 结构化输出不符合 schema: ${lastIssues || "未知错误"}；raw=${lastRaw || "无"}`,
  );
}

/**
 * Model-selected Team routing. It has no tools or side effects; an unavailable
 * router is intentionally allowed to fall back to the existing single path.
 */
export async function routeTeamTask(
  cfg: AgentConfig,
  userText: string,
  signal?: AbortSignal,
  history: AgentInputItem[] = [],
  decisionSignals?: WorkflowDecisionSignals,
): Promise<TeamTask | undefined> {
  const decisionService = cfg.decisionService ?? new AgentDecisionService(agentLog);
  const orchestration = decisionSignals?.orchestration;
  const orchestrationConfidence = decisionSignals?.orchestrationConfidence ?? 0;
  if (orchestration) {
    agentLog(
      `[team] 复用 Workflow Jev 信号 orchestration=${orchestration}` +
        `(conf=${orchestrationConfidence.toFixed(2)})，不重复请求 Jev`,
    );
  }
  const hint = decisionSignals
    ? undefined
    : await decisionService.taskHint(cfg.jev, userText, signal);
  const selectedOrchestration = decisionSignals?.orchestration ?? hint?.orchestration;
  const selectedConfidence = decisionSignals?.orchestrationConfidence ?? hint?.orchestrationConfidence ?? 0;
  if (selectedOrchestration === 'single') {
    agentLog(
      `[team] 高置信度路由 single(${selectedConfidence.toFixed(2)})，跳过 Team 路由模型`,
    );
    return undefined;
  }
  if (selectedOrchestration === 'team') {
    agentLog(
      `[team] 高置信度路由 team(${selectedConfidence.toFixed(2)})，交给 Team Planner 细化`,
    );
    return createTeamTask({
      route: 'team',
      goal: userText,
      reason: `Jev 判断该请求需要独立规划、审查、执行和验证(${selectedConfidence.toFixed(2)})`,
      planSummary: '由 Team Planner 根据用户目标生成可执行计划',
      reviewFocus: ['任务范围、风险、审批约束和完成证据'],
      verificationCriteria: ['最终结果满足用户目标并有可追溯的工具或交付证据'],
    }, userText);
  }
  const input: string | AgentInputItem[] = history.length
    ? [...history, { type: "message", role: "user", content: userText }]
    : userText;
  const decision = await runTeamRole(
    cfg,
    "协作任务路由器",
    "你是任务复杂度路由器，不执行工具。只在任务确实需要独立规划、审查、执行和结果验证四个职责协作时选择 team。" +
      "普通问答、解释、一次性读取、简单改写或单一已知操作必须选择 single。" +
      "team 时给出可执行的 planSummary、审查重点和可验证的完成标准；single 时三个字段给出简短说明或空数组。" +
      "必须严格返回 schema，不要输出 markdown。",
    teamRouteDecisionSchema,
    input,
    signal,
  );
  return createTeamTask(decision, userText);
}

export async function planTeamTask(
  cfg: AgentConfig,
  task: TeamTask,
  signal?: AbortSignal,
): Promise<TeamPlannerReport> {
  return runTeamRole(
    cfg,
    "Team Planner",
    "Return executionGraph with 1-12 DAG nodes. Every node must include dependsOn, completionCriteria, suggestedTools, effect, resources, parallelSafe and priority (0-100). Only read-only or no-effect nodes may set parallelSafe=true; file writes, commands and device writes must remain serial. Set bounded maxParallelism, budget, task timeoutMs, nodeTimeoutMs and maxRetries when the task warrants them. " +
    "你是协作任务的规划角色，不执行工具。把给定目标整理成执行角色可直接遵循的紧凑计划，" +
      "通常使用 1 到 4 个节点，只有存在真实依赖时才增加节点；每个字段保持简洁，不重复解释同一要求。" +
      "列出审查重点和可观察的验证标准。若路由初稿里包含审查反馈，必须针对反馈修订计划。" +
      "不要增加用户未要求的副作用，必须严格返回 schema。",
    teamPlannerReportSchema,
    `目标：${task.goal}\n路由初稿：${task.planSummary}`,
    signal,
  );
}

export async function reviewTeamTask(
  cfg: AgentConfig,
  task: TeamTask,
  signal?: AbortSignal,
): Promise<TeamReviewReport> {
  return runTeamRole(
    cfg,
    "Team Reviewer",
    "你是只读审查角色，不执行工具。审查计划是否超出用户目标、遗漏安全/审批约束，或缺少完成条件。" +
      "必须尊重用户明确给出的范围约束；用户已允许模拟、占位或明确说不需要的内容，不能再作为阻断性问题。" +
      "只有不存在阻断性问题才 approved=true。所有 requiredChanges 必须可操作，必须严格返回 schema。",
    teamReviewReportSchema,
    `目标：${task.goal}\n计划：${task.planSummary}\n审查重点：${task.reviewFocus.join('；') || '范围、风险、审批与证据'}`,
    signal,
  );
}

export async function verifyTeamTask(
  cfg: AgentConfig,
  task: TeamTask,
  executorSummary: string,
  evidence: string[],
  signal?: AbortSignal,
): Promise<TeamVerificationReport> {
  return runTeamRole(
    cfg,
    "Team Verifier",
    "你是只读结果验证角色，不执行工具。仅依据给定执行结果与证据，判断是否满足目标和验证标准。" +
      "证据不足、执行失败或结果不完整时 passed=false；不要猜测成功。" +
      "不通过时 decision 选择 retry（重试已有节点）、revise（只调整尚未开始的节点）或 ask_user（需要用户补充决定），并填写 retryNodeIds、revisedGraph 或 userQuestion；通过时 decision=pass。必须严格返回 schema。",
    teamVerificationReportSchema,
    `目标：${task.goal}\n计划：${task.planSummary}\n验证标准：${task.verificationCriteria.join('；') || '结果满足用户请求且有真实证据'}\n执行结果：${executorSummary}\n证据：${evidence.join('；') || '无额外证据'}`,
    signal,
  );
}
