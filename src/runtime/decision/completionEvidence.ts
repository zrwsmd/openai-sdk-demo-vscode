import type { Artifact, ToolResult } from "../../protocol/results";
import type { CompletionGateResult } from "../completionGate";
import type { DeliveryContract } from "../deliveryContract";
import type { DeliveryWorkflow } from "../deliveryWorkflow";

export type CompletionEvidenceRecord = {
  name: string;
  args: string;
  result: ToolResult;
  order?: number;
};

export type EvidenceFactValue = string | number | boolean;

export type EvidenceFactScope =
  | "tool"
  | "file"
  | "artifact"
  | "workflow"
  | "contract"
  | "diagnostic"
  | "domain";

export interface EvidenceFact {
  key: string;
  value: EvidenceFactValue;
  scope: EvidenceFactScope;
  sourceTool?: string;
  confidence?: number;
}

export interface CompletionEvidenceInput {
  records: CompletionEvidenceRecord[];
  gate: CompletionGateResult;
  artifacts: Artifact[];
  deliveredArtifacts: Artifact[];
  deliveryContract?: DeliveryContract;
  deliveryWorkflow?: DeliveryWorkflow;
  authoritativeMessage?: string;
  extractors?: readonly ToolEvidenceExtractor[];
}

export interface CompletionEvidenceSummary {
  facts: EvidenceFact[];
  toolSummaries: string[];
  artifactSummaries: string[];
}

export interface ToolEvidenceExtractor {
  id: string;
  toolNames?: readonly string[];
  extract(record: CompletionEvidenceRecord, context: ToolEvidenceContext): EvidenceFact[];
}

export interface ToolEvidenceContext {
  records: readonly CompletionEvidenceRecord[];
  input: CompletionEvidenceInput;
  helpers: EvidenceHelpers;
}

export interface EvidenceHelpers {
  args(record: CompletionEvidenceRecord): Record<string, unknown>;
  data(result: ToolResult): Record<string, unknown>;
  objectField(value: Record<string, unknown>, key: string): Record<string, unknown> | undefined;
  stringField(value: Record<string, unknown>, keys: readonly string[]): string | undefined;
  numberField(value: Record<string, unknown>, keys: readonly string[]): number | undefined;
  shortHash(value: unknown): string | undefined;
}

export function compactCompletionDecisionText(value: unknown, maxLength = 800): string {
  const raw = typeof value === "string"
    ? value
    : JSON.stringify(value) ?? String(value);
  const compact = raw.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

export function buildCompletionEvidenceSummaries(
  input: CompletionEvidenceInput,
): CompletionEvidenceSummary {
  const records = input.records.slice(-10);
  const extractors = [
    ...DEFAULT_TOOL_EVIDENCE_EXTRACTORS,
    ...(input.extractors ?? []),
  ];
  const context = createToolEvidenceContext(input);
  const toolFacts = records.flatMap((record) =>
    extractEvidenceFactsForRecord(record, context, extractors),
  );
  const workflowFacts = extractWorkflowEvidenceFacts(input);
  const artifactFacts = extractArtifactEvidenceFacts([
    ...input.artifacts,
    ...input.deliveredArtifacts,
  ]);
  const facts = [...toolFacts, ...workflowFacts, ...artifactFacts];
  const toolSummaries = [
    ...records.map((record) =>
      summarizeToolEvidence(
        record,
        extractEvidenceFactsForRecord(record, context, extractors),
      ),
    ),
    summarizeFacts("WORKFLOW_EVIDENCE", workflowFacts, 900),
  ].filter((summary): summary is string => Boolean(summary));
  const artifactSummaries = buildArtifactSummaries(input, artifactFacts);
  return { facts, toolSummaries, artifactSummaries };
}

function extractEvidenceFactsForRecord(
  record: CompletionEvidenceRecord,
  context: ToolEvidenceContext,
  extractors: readonly ToolEvidenceExtractor[],
): EvidenceFact[] {
  const facts: EvidenceFact[] = [];
  for (const extractor of extractors) {
    if (extractor.toolNames && !extractor.toolNames.includes(record.name)) continue;
    facts.push(...extractor.extract(record, context));
  }
  return facts;
}

function createToolEvidenceContext(input: CompletionEvidenceInput): ToolEvidenceContext {
  return {
    records: input.records,
    input,
    helpers: createEvidenceHelpers(input.records),
  };
}

function createEvidenceHelpers(
  records: readonly CompletionEvidenceRecord[],
): EvidenceHelpers {
  void records;
  return {
    args: (record) => recordArgsForDecision(record.args),
    data: recordDataForDecision,
    objectField: objectFieldForDecision,
    stringField: stringFieldForDecision,
    numberField: numberFieldForDecision,
    shortHash: shortHashForDecision,
  };
}

const baseToolEvidenceExtractor: ToolEvidenceExtractor = {
  id: "tool.base",
  extract: (record) => {
    const facts: EvidenceFact[] = [
      fact("tool.name", record.name, "tool", record.name),
      fact("tool.ok", record.result.ok === true, "tool", record.name),
      fact("tool.risk", String(record.result.risk ?? "unknown"), "tool", record.name),
      fact("tool.effect", String(record.result.effect ?? "unknown"), "tool", record.name),
    ];
    if (typeof record.result.error === "string" && record.result.error.trim()) {
      facts.push(fact("tool.error", record.result.error.trim(), "diagnostic", record.name));
    }
    const diagnosticCounts = countDiagnostics(record.result);
    if (diagnosticCounts.error) {
      facts.push(fact("diagnostics.errorCount", diagnosticCounts.error, "diagnostic", record.name));
    }
    if (diagnosticCounts.warning) {
      facts.push(fact("diagnostics.warningCount", diagnosticCounts.warning, "diagnostic", record.name));
    }
    return facts;
  },
};

const fileEvidenceExtractor: ToolEvidenceExtractor = {
  id: "file.generic",
  toolNames: ["write_file", "edit_file", "read_file", "search_files", "list_files", "run_command"],
  extract: (record, context) => {
    const { helpers } = context;
    const data = helpers.data(record.result);
    const args = helpers.args(record);
    const file = helpers.stringField(data, ["file", "path", "relativePath", "uri"]) ??
      helpers.stringField(args, ["path", "file", "uri"]);
    const bytes = helpers.numberField(data, ["bytes", "totalBytes"]);
    const contentHash = helpers.stringField(data, ["contentHash"]);
    const facts: EvidenceFact[] = [];

    if (record.name === "write_file") {
      facts.push(fact("file.operation", "write", "file", record.name));
      facts.push(fact("file.write.persisted", record.result.ok === true, "file", record.name));
    } else if (record.name === "edit_file") {
      facts.push(fact("file.operation", "edit", "file", record.name));
      facts.push(fact("file.edit.persisted", record.result.ok === true, "file", record.name));
      facts.push(fact("file.edit.changed", data.changed === true, "file", record.name));
      addNumberFact(facts, "file.edit.editsApplied", helpers.numberField(data, ["editsApplied"]), "file", record.name);
    } else if (record.name === "read_file") {
      facts.push(fact("file.operation", "read", "file", record.name));
      facts.push(fact("file.read.succeeded", record.result.ok === true, "file", record.name));
      addNumberFact(facts, "file.totalLines", helpers.numberField(data, ["totalLines"]), "file", record.name);
      addNumberFact(facts, "file.returnedLines", helpers.numberField(data, ["returnedLines"]), "file", record.name);
    } else if (record.name === "search_files") {
      facts.push(fact("file.operation", "search", "file", record.name));
      facts.push(fact("file.search.succeeded", record.result.ok === true, "file", record.name));
      addNumberFact(facts, "file.matchCount", helpers.numberField(data, ["matchCount", "count"]), "file", record.name);
    } else if (record.name === "list_files") {
      facts.push(fact("file.operation", "list", "file", record.name));
      facts.push(fact("file.list.succeeded", record.result.ok === true, "file", record.name));
      addNumberFact(facts, "file.entryCount", helpers.numberField(data, ["count", "entryCount"]), "file", record.name);
    } else if (record.name === "run_command") {
      facts.push(fact("process.operation", "run_command", "tool", record.name));
      facts.push(fact("process.succeeded", record.result.ok === true, "tool", record.name));
      const exitCode = data.exitCode;
      if (typeof exitCode === "number") {
        facts.push(fact("process.exitCode", exitCode, "tool", record.name));
      }
    }

    if (file) facts.push(fact("file.path", file, "file", record.name));
    if (bytes !== undefined) facts.push(fact("file.bytes", bytes, "file", record.name));
    if (contentHash) {
      facts.push(fact("file.contentHash", helpers.shortHash(contentHash) ?? contentHash, "file", record.name));
    }
    return facts;
  },
};

const artifactToolEvidenceExtractor: ToolEvidenceExtractor = {
  id: "artifact.tool",
  toolNames: ["deliver_artifact"],
  extract: (record, context) => {
    const { helpers } = context;
    const data = helpers.data(record.result);
    const artifact = helpers.objectField(data, "artifact") ?? data;
    const kind = helpers.stringField(artifact, ["kind"]);
    const name = helpers.stringField(artifact, ["name"]);
    const content = helpers.stringField(artifact, ["content"]);
    const facts: EvidenceFact[] = [
      fact("artifact.delivered", record.result.ok === true, "artifact", record.name),
    ];
    if (kind) facts.push(fact("artifact.kind", kind, "artifact", record.name));
    if (name) facts.push(fact("artifact.name", name, "artifact", record.name));
    if (content) {
      facts.push(fact("artifact.contentBytes", Buffer.byteLength(content, "utf8"), "artifact", record.name));
    }
    return facts;
  },
};

export const DEFAULT_TOOL_EVIDENCE_EXTRACTORS: readonly ToolEvidenceExtractor[] = [
  baseToolEvidenceExtractor,
  fileEvidenceExtractor,
  artifactToolEvidenceExtractor,
];

function extractWorkflowEvidenceFacts(input: CompletionEvidenceInput): EvidenceFact[] {
  const facts: EvidenceFact[] = [
    fact("rule.completionGate.passed", input.gate.passed, "workflow"),
    fact("delivery.required", input.deliveryContract?.requiresDeliverable === true, "contract"),
  ];
  if (input.authoritativeMessage) {
    facts.push(fact(
      "workflow.authoritativeMessage",
      compactCompletionDecisionText(input.authoritativeMessage, 700),
      "workflow",
    ));
  }
  if (input.deliveryWorkflow) {
    facts.push(fact("workflow.id", input.deliveryWorkflow.id, "workflow"));
    facts.push(fact("workflow.title", input.deliveryWorkflow.title, "workflow"));
    facts.push(fact(
      "workflow.stages",
      input.deliveryWorkflow.stages
        .map((stage) => `${stage.order}:${stage.toolName ?? stage.id}`)
        .join(">"),
      "workflow",
    ));
  }
  if (input.deliveryContract?.requiresDeliverable) {
    const deliverables = input.deliveryContract.deliverables.filter((deliverable) => deliverable.required);
    facts.push(fact("contract.requiredDeliverableCount", deliverables.length, "contract"));
    deliverables.slice(0, 6).forEach((deliverable, index) => {
      const label = [
        deliverable.title || deliverable.kind,
        `kind=${deliverable.kind}`,
        deliverable.workspaceFileExtension ? `ext=${deliverable.workspaceFileExtension}` : undefined,
        deliverable.requiredVerificationTools?.length
          ? `verify=${deliverable.requiredVerificationTools.join(",")}`
          : undefined,
        deliverable.workspacePersistence
          ? `persistence=${deliverable.workspacePersistence}`
          : undefined,
      ].filter(Boolean).join(" ");
      facts.push(fact(`contract.requiredDeliverable.${index + 1}`, label, "contract"));
    });
  }
  return facts;
}

function extractArtifactEvidenceFacts(artifacts: readonly Artifact[]): EvidenceFact[] {
  return artifacts.slice(0, 8).flatMap((artifact, index) => {
    const facts = [
      fact(`artifact.${index + 1}.kind`, artifact.kind, "artifact"),
      fact(`artifact.${index + 1}.name`, artifact.name, "artifact"),
    ];
    if (artifact.uri) facts.push(fact(`artifact.${index + 1}.uri`, artifact.uri, "artifact"));
    if (artifact.content) {
      facts.push(fact(
        `artifact.${index + 1}.contentBytes`,
        Buffer.byteLength(artifact.content, "utf8"),
        "artifact",
      ));
    }
    return facts;
  });
}

function buildArtifactSummaries(
  input: CompletionEvidenceInput,
  facts: EvidenceFact[],
): string[] {
  const artifactSummaries = [
    ...input.artifacts,
    ...input.deliveredArtifacts,
  ]
    .slice(0, 8)
    .map((artifact) =>
      compactCompletionDecisionText(
        `${artifact.kind}:${artifact.name}` +
          (artifact.uri ? ` uri=${artifact.uri}` : "") +
          (artifact.content ? ` contentBytes=${Buffer.byteLength(artifact.content, "utf8")}` : ""),
        400,
      ),
    );
  if (artifactSummaries.length) return artifactSummaries;
  const factSummary = summarizeFacts("ARTIFACT_EVIDENCE", facts, 400);
  return factSummary ? [factSummary] : [];
}

function summarizeToolEvidence(
  record: CompletionEvidenceRecord,
  facts: EvidenceFact[],
): string {
  return summarizeFacts(`TOOL_EVIDENCE ${record.name}`, facts, 650) ??
    `TOOL_EVIDENCE ${record.name}`;
}

function summarizeFacts(
  label: string,
  facts: readonly EvidenceFact[],
  maxLength: number,
): string | undefined {
  if (!facts.length) return undefined;
  return compactCompletionDecisionText(
    `${label} facts=[${facts.map(formatEvidenceFact).join(" ")}]`,
    maxLength,
  );
}

function formatEvidenceFact(factValue: EvidenceFact): string {
  const confidence = typeof factValue.confidence === "number"
    ? `@${factValue.confidence.toFixed(2)}`
    : "";
  return `${factValue.key}=${formatEvidenceValue(factValue.value)}${confidence}`;
}

function formatEvidenceValue(value: EvidenceFactValue): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  const compact = value.replace(/\s+/g, "_");
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function fact(
  key: string,
  value: EvidenceFactValue,
  scope: EvidenceFactScope,
  sourceTool?: string,
  confidence?: number,
): EvidenceFact {
  return {
    key,
    value,
    scope,
    ...(sourceTool ? { sourceTool } : {}),
    ...(typeof confidence === "number" ? { confidence } : {}),
  };
}

function addStringFact(
  facts: EvidenceFact[],
  key: string,
  value: string | undefined,
  scope: EvidenceFactScope,
  sourceTool?: string,
): void {
  if (value) facts.push(fact(key, value, scope, sourceTool));
}

function addNumberFact(
  facts: EvidenceFact[],
  key: string,
  value: number | undefined,
  scope: EvidenceFactScope,
  sourceTool?: string,
): void {
  if (value !== undefined) facts.push(fact(key, value, scope, sourceTool));
}

function recordDataForDecision(result: ToolResult): Record<string, unknown> {
  return result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
}

function recordArgsForDecision(args: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function objectFieldForDecision(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const item = value[key];
  return item && typeof item === "object" && !Array.isArray(item)
    ? item as Record<string, unknown>
    : undefined;
}

function stringFieldForDecision(
  value: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const item = value[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return undefined;
}

function numberFieldForDecision(
  value: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const item = value[key];
    if (typeof item === "number" && Number.isFinite(item)) return item;
  }
  return undefined;
}

function shortHashForDecision(value: unknown): string | undefined {
  return typeof value === "string" && value
    ? value.length > 16 ? `${value.slice(0, 12)}...` : value
    : undefined;
}

function countDiagnostics(result: ToolResult): { error: number; warning: number } {
  const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
  return diagnostics.reduce((counts, diagnostic) => {
    if (diagnostic.severity === "error" || diagnostic.severity === "blocking") {
      counts.error += 1;
    } else if (diagnostic.severity === "warning") {
      counts.warning += 1;
    }
    return counts;
  }, { error: 0, warning: 0 });
}
