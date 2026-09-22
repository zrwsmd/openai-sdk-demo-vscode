import { Agent, Runner, type Model } from "@openai/agents";
import type { Artifact, Diagnostic, UsageSummary } from "../protocol/results";
import type { CompletionGateResult } from "./completionGate";
import {
  compactCompletionDecisionText,
  type CompletionEvidenceRecord,
  type CompletionEvidenceSummary,
} from "./decision/completionEvidence";
import {
  industrialAgentOutputSchema,
  type IndustrialAgentOutput,
} from "./output";

export const FINAL_OUTPUT_FINALIZER_MARKER = "FINAL_OUTPUT_FINALIZER_V1";

type IndustrialDiagnostic = IndustrialAgentOutput["diagnostics"][number];

export interface FinalOutputFinalizerInput {
  model: string | Model;
  tracingDisabled: boolean;
  userText: string;
  currentMessage: string;
  gate: CompletionGateResult;
  records: readonly CompletionEvidenceRecord[];
  evidence: CompletionEvidenceSummary;
  artifacts: readonly Artifact[];
  deliveredArtifacts: readonly Artifact[];
  signal?: AbortSignal;
  log?: (line: string) => void;
}

export interface FinalOutputFinalizerResult {
  output?: IndustrialAgentOutput;
  usage?: UsageSummary;
}

function compactJson(value: unknown, maxLength: number): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function toolDiagnostics(record: CompletionEvidenceRecord): Diagnostic[] {
  return Array.isArray(record.result.diagnostics)
    ? (record.result.diagnostics as Diagnostic[])
    : [];
}

function toolError(record: CompletionEvidenceRecord): string | undefined {
  return typeof record.result.error === "string" ? record.result.error : undefined;
}

function finalizerPrompt(input: FinalOutputFinalizerInput): string {
  const gate = input.gate.passed
    ? { passed: true }
    : {
        passed: false,
        reason: input.gate.reason,
        repairInstruction: input.gate.repairInstruction,
        issues: input.gate.issues.slice(0, 8).map((issue) => ({
          toolName: issue.toolName,
          summary: issue.summary,
          requiresRepair: issue.requiresRepair,
        })),
      };
  const records = input.records.slice(-12).map((record) => ({
    tool: record.name,
    ok: record.result.ok,
    error: toolError(record),
    diagnostics: toolDiagnostics(record).slice(0, 4).map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
    })),
  }));
  const artifacts = [...input.artifacts, ...input.deliveredArtifacts].slice(-8).map((artifact) => ({
    kind: artifact.kind,
    name: artifact.name,
    uri: artifact.uri,
    mimeType: artifact.mimeType,
    hasContent: typeof artifact.content === "string" && artifact.content.length > 0,
  }));

  return [
    FINAL_OUTPUT_FINALIZER_MARKER,
    "你是运行时的统一最终结果收尾器。你没有工具，也不能执行任何副作用。",
    "请只返回一个严格 JSON 对象，字段必须且只能是 message、diagnostics、artifacts、data。",
    "diagnostics 每项必须含 code、message、severity(info|warning|error|blocking)、path；没有路径时 path=null。",
    "artifacts 每项必须含 kind、name、uri、mimeType、content；未知值使用 null。data 必须为 null。",
    "只能根据下面的用户请求和运行时证据总结，不能补造工具调用、文件、内容或成功状态。",
    input.gate.passed
      ? "完成门控已通过：如实概括已经有证据确认的结果。"
      : "完成门控未通过：message 必须明确说明本轮未完成或未确认，diagnostics 必须保留阻断原因，不要声称交付成功。",
    `用户请求：${compactCompletionDecisionText(input.userText, 2_000)}`,
    `当前模型摘要：${compactCompletionDecisionText(input.currentMessage, 2_000) || "（空）"}`,
    `完成门控：${compactJson(gate, 3_000)}`,
    `工具账本：${compactJson(records, 5_000)}`,
    `已确认交付物：${compactJson(artifacts, 2_500)}`,
    `证据摘要：${compactJson({ facts: input.evidence.facts.slice(-24), toolSummaries: input.evidence.toolSummaries.slice(-12), artifactSummaries: input.evidence.artifactSummaries.slice(-8) }, 8_000)}`,
    "再次强调：不要输出 markdown、代码块、解释文字或 schema 之外的字段。",
  ].join("\n");
}

function usageFromFinalizerState(value: unknown): UsageSummary | undefined {
  const usage = (value as { state?: { usage?: Partial<UsageSummary> } } | undefined)?.state?.usage;
  if (!usage || typeof usage !== "object") return undefined;
  return {
    inputTokens: typeof usage.inputTokens === "number" ? usage.inputTokens : 0,
    outputTokens: typeof usage.outputTokens === "number" ? usage.outputTokens : 0,
    requests: typeof usage.requests === "number" && usage.requests > 0 ? usage.requests : 1,
  };
}

export async function runFinalOutputFinalizer(
  input: FinalOutputFinalizerInput,
): Promise<FinalOutputFinalizerResult> {
  try {
    const finalizer = new Agent({
      name: "运行时结构化结果收尾器",
      model: input.model,
      instructions: [
        "你负责把运行时提供的证据序列化为 IndustrialAgentOutput。",
        "本轮没有可用工具，不能发起工具调用；必须严格返回 schema JSON。",
        "不要把推测当成证据，不要因为用户请求了某件事就声称它已经完成。",
      ].join("\n"),
      tools: [],
      outputType: industrialAgentOutputSchema,
      modelSettings: { maxTokens: 1_600 },
    });
    const runner = new Runner({ tracingDisabled: input.tracingDisabled });
    const result = await runner.run(finalizer, finalizerPrompt(input), {
      stream: false,
      maxTurns: 1,
      signal: input.signal,
    });
    const parsed = industrialAgentOutputSchema.safeParse(result.finalOutput);
    const usage = usageFromFinalizerState(result);
    if (!parsed.success) {
      input.log?.(`[finalizer] 输出未通过统一 Schema: ${parsed.error.message}`);
      return { usage };
    }
    input.log?.("[finalizer] 无工具结构化收尾成功");
    return { output: parsed.data as IndustrialAgentOutput, usage };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    input.log?.(`[finalizer] 收尾请求失败，转为账本合成: ${message}`);
    return {};
  }
}

function normalizeArtifact(artifact: Artifact): IndustrialAgentOutput["artifacts"][number] {
  return {
    kind: artifact.kind,
    name: artifact.name,
    uri: artifact.uri ?? null,
    mimeType: artifact.mimeType ?? null,
    content: artifact.content ?? null,
  };
}

function diagnosticCode(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized ? `tool_${normalized}` : "tool_failure";
}

function addDiagnostic(
  diagnostics: IndustrialDiagnostic[],
  diagnostic: IndustrialDiagnostic,
): void {
  const key = `${diagnostic.code}\u0000${diagnostic.message}`;
  if (diagnostics.some((item) => `${item.code}\u0000${item.message}` === key)) return;
  diagnostics.push(diagnostic);
}

export function synthesizeStructuredFailure(input: {
  gate?: CompletionGateResult;
  records: readonly CompletionEvidenceRecord[];
  artifacts?: readonly Artifact[];
  deliveredArtifacts?: readonly Artifact[];
}): IndustrialAgentOutput {
  const diagnostics: IndustrialDiagnostic[] = [];
  if (input.gate && !input.gate.passed) {
    addDiagnostic(diagnostics, {
      code: "completion_gate_failed",
      message: input.gate.reason,
      severity: "blocking",
      path: null,
    });
  }
  for (const record of input.records) {
    const diagnosticsForRecord = toolDiagnostics(record);
    const errorForRecord = toolError(record);
    const blockingDiagnostics = diagnosticsForRecord.filter(
      (diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "blocking",
    );
    if (record.result.ok && !errorForRecord && !blockingDiagnostics.length) continue;
    for (const diagnostic of diagnosticsForRecord) {
      addDiagnostic(diagnostics, {
        code: diagnostic.code || diagnosticCode(record.name),
        message: diagnostic.message || `${record.name} 返回了失败诊断`,
        severity: diagnostic.severity,
        path: diagnostic.path ?? null,
      });
    }
    if (!record.result.ok || errorForRecord) {
      addDiagnostic(diagnostics, {
        code: diagnosticCode(record.name),
        message: errorForRecord?.trim() || `${record.name} 执行失败`,
        severity: "error",
        path: null,
      });
    }
  }
  if (!diagnostics.length) {
    addDiagnostic(diagnostics, {
      code: "final_output_missing",
      message: "模型未返回可解析的最终结构化结果，运行时无法确认本轮完成。",
      severity: "error",
      path: null,
    });
  }
  const firstReason = input.gate && !input.gate.passed
    ? input.gate.reason
    : diagnostics[0]?.message ?? "运行时无法确认本轮完成";
  return {
    message: `本轮未完成：${firstReason}`,
    diagnostics: diagnostics.slice(0, 20),
    artifacts: [...(input.artifacts ?? []), ...(input.deliveredArtifacts ?? [])]
      .map(normalizeArtifact)
      .filter((artifact, index, all) => all.findIndex((item) => item.name === artifact.name && item.uri === artifact.uri) === index),
    data: null,
  };
}
