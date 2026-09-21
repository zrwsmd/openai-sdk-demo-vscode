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

export interface CompletionEvidenceInput {
  records: CompletionEvidenceRecord[];
  gate: CompletionGateResult;
  artifacts: Artifact[];
  deliveredArtifacts: Artifact[];
  deliveryContract?: DeliveryContract;
  deliveryWorkflow?: DeliveryWorkflow;
  authoritativeMessage?: string;
}

export interface CompletionEvidenceSummary {
  toolSummaries: string[];
  artifactSummaries: string[];
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
  const toolSummaries = [
    ...input.records
      .slice(-10)
      .map((record) => summarizeToolRecordForDecision(record, input.records)),
    ...workflowEvidenceSummariesForDecision(input),
  ];
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
  return { toolSummaries, artifactSummaries };
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
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const item = value[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return undefined;
}

function numberFieldForDecision(
  value: Record<string, unknown>,
  keys: string[],
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

function validationTargetHashForDecision(data: Record<string, unknown>): string | undefined {
  const target = objectFieldForDecision(data, "validationTarget");
  return target ? stringFieldForDecision(target, ["contentHash"]) : undefined;
}

function preWriteValidationHashForDecision(data: Record<string, unknown>): string | undefined {
  const preWrite = objectFieldForDecision(data, "preWriteValidation");
  if (!preWrite) return undefined;
  if (numberFieldForDecision(preWrite, ["errorCount"]) !== 0) return undefined;
  return stringFieldForDecision(preWrite, ["validatedContentHash"]);
}

function successfulStValidationHashesForDecision(
  records: CompletionEvidenceRecord[],
): Set<string> {
  const hashes = new Set<string>();
  for (const record of records) {
    if (!record.result.ok) continue;
    const data = recordDataForDecision(record.result);
    const preWriteHash = preWriteValidationHashForDecision(data);
    if (preWriteHash) {
      hashes.add(preWriteHash);
      continue;
    }
    if (record.name !== "validate_st_code") continue;
    if (numberFieldForDecision(data, ["errorCount"]) !== 0) continue;
    const hash = stringFieldForDecision(data, ["validatedContentHash"]) ??
      validationTargetHashForDecision(data);
    if (hash) hashes.add(hash);
  }
  return hashes;
}

function summarizeToolRecordForDecision(
  record: CompletionEvidenceRecord,
  records: CompletionEvidenceRecord[],
): string {
  const data = recordDataForDecision(record.result);
  const args = recordArgsForDecision(record.args);
  const validationHashes = successfulStValidationHashesForDecision(records);
  const dataParts: string[] = [];

  if (record.name === "validate_st_code") {
    const target = objectFieldForDecision(data, "validationTarget");
    const errorCount = numberFieldForDecision(data, ["errorCount"]);
    const warningCount = numberFieldForDecision(data, ["warningCount"]);
    const validatedHash = stringFieldForDecision(data, ["validatedContentHash"]) ??
      validationTargetHashForDecision(data);
    dataParts.push(errorCount === 0 && record.result.ok
      ? "ST_VALIDATION_PASSED"
      : "ST_VALIDATION_NOT_PASSED");
    if (errorCount !== undefined) dataParts.push(`errorCount=${errorCount}`);
    if (warningCount !== undefined) dataParts.push(`warningCount=${warningCount}`);
    if (target) {
      const targetPath = stringFieldForDecision(target, ["path"]);
      const complete = target.complete;
      const lines = numberFieldForDecision(target, ["totalLines"]);
      const bytes = numberFieldForDecision(target, ["totalBytes"]);
      if (targetPath) dataParts.push(`target=${targetPath}`);
      if (typeof complete === "boolean") dataParts.push(`complete=${complete}`);
      if (lines !== undefined) dataParts.push(`lines=${lines}`);
      if (bytes !== undefined) dataParts.push(`bytes=${bytes}`);
    }
    if (validatedHash) dataParts.push(`validatedHash=${shortHashForDecision(validatedHash)}`);
  } else if (record.name === "write_file") {
    const file = stringFieldForDecision(data, ["file", "path", "relativePath"]) ??
      stringFieldForDecision(args, ["path", "file"]);
    const contentHash = stringFieldForDecision(data, ["contentHash"]);
    const preWriteHash = preWriteValidationHashForDecision(data);
    const previousValidationMatch = !!contentHash && validationHashes.has(contentHash);
    const hashMatch = !!contentHash && (preWriteHash === contentHash || previousValidationMatch);
    const bytes = numberFieldForDecision(data, ["bytes"]);
    dataParts.push(record.result.ok ? "WRITE_FILE_PERSISTED" : "WRITE_FILE_NOT_PERSISTED");
    if (file) dataParts.push(`file=${file}`);
    if (bytes !== undefined) dataParts.push(`bytes=${bytes}`);
    if (contentHash) dataParts.push(`contentHash=${shortHashForDecision(contentHash)}`);
    if (preWriteHash) dataParts.push(`preWriteValidatedHash=${shortHashForDecision(preWriteHash)}`);
    if (contentHash) dataParts.push(`validationHashMatch=${hashMatch}`);
    const preWrite = objectFieldForDecision(data, "preWriteValidation");
    if (preWrite) {
      const errorCount = numberFieldForDecision(preWrite, ["errorCount"]);
      const warningCount = numberFieldForDecision(preWrite, ["warningCount"]);
      dataParts.push(
        `preWriteValidation=${errorCount === 0 ? "passed" : "failed"}` +
          (errorCount !== undefined ? `(errorCount=${errorCount}` : "") +
          (warningCount !== undefined ? ` warningCount=${warningCount}` : "") +
          (errorCount !== undefined ? ")" : ""),
      );
    }
  } else if (record.name === "export_st_program") {
    const file = stringFieldForDecision(data, ["file", "path"]) ??
      stringFieldForDecision(args, ["path", "file"]);
    const bytes = numberFieldForDecision(data, ["bytes"]);
    const contentHash = stringFieldForDecision(data, ["contentHash"]);
    dataParts.push(record.result.ok ? "ST_EXPORT_PERSISTED" : "ST_EXPORT_NOT_PERSISTED");
    if (file) dataParts.push(`file=${file}`);
    if (bytes !== undefined) dataParts.push(`bytes=${bytes}`);
    if (contentHash) {
      dataParts.push(`contentHash=${shortHashForDecision(contentHash)}`);
      dataParts.push(`validationHashMatch=${validationHashes.has(contentHash)}`);
    }
  } else if (record.name === "read_file") {
    const file = stringFieldForDecision(data, ["file", "path", "relativePath"]) ??
      stringFieldForDecision(args, ["path", "file"]);
    const totalLines = numberFieldForDecision(data, ["totalLines"]);
    const returnedLines = numberFieldForDecision(data, ["returnedLines"]);
    dataParts.push(record.result.ok ? "FILE_READ_SUCCEEDED" : "FILE_READ_FAILED");
    if (file) dataParts.push(`file=${file}`);
    if (totalLines !== undefined) dataParts.push(`totalLines=${totalLines}`);
    if (returnedLines !== undefined) dataParts.push(`returnedLines=${returnedLines}`);
  } else if (record.name === "deliver_artifact") {
    const artifact = objectFieldForDecision(data, "artifact") ?? data;
    const kind = stringFieldForDecision(artifact, ["kind"]);
    const name = stringFieldForDecision(artifact, ["name"]);
    const content = stringFieldForDecision(artifact, ["content"]);
    dataParts.push(record.result.ok ? "ARTIFACT_DELIVERED" : "ARTIFACT_NOT_DELIVERED");
    if (kind) dataParts.push(`kind=${kind}`);
    if (name) dataParts.push(`name=${name}`);
    if (content) dataParts.push(`contentBytes=${Buffer.byteLength(content, "utf8")}`);
  }

  const diagnostics = Array.isArray(record.result.diagnostics)
    ? record.result.diagnostics
        .slice(0, 3)
        .map((diagnostic) => {
          const code = typeof diagnostic.code === "string" ? `${diagnostic.code}:` : "";
          return `${diagnostic.severity}:${code}${diagnostic.message}`;
        })
        .join("；")
    : "";
  const error = typeof record.result.error === "string" && record.result.error.trim()
    ? ` error=${record.result.error.trim()}`
    : "";
  const diagnosticText = diagnostics ? ` diagnostics=${diagnostics}` : "";
  return compactCompletionDecisionText(
    `${record.name} ok=${record.result.ok} risk=${record.result.risk} effect=${record.result.effect}` +
      (dataParts.length ? ` evidence=[${dataParts.join(" ")}]` : "") +
      `${error}${diagnosticText}`,
    500,
  );
}

function workflowEvidenceSummariesForDecision(
  input: CompletionEvidenceInput,
): string[] {
  const summaries = [
    `RULE_COMPLETION_GATE passed=${input.gate.passed} deliveryRequired=${input.deliveryContract?.requiresDeliverable === true}`,
  ];
  if (input.authoritativeMessage) {
    summaries.push(
      `DELIVERY_WORKFLOW_AUTHORITATIVE ${compactCompletionDecisionText(input.authoritativeMessage, 700)}`,
    );
  }
  if (input.deliveryWorkflow) {
    summaries.push(
      `DELIVERY_WORKFLOW id=${input.deliveryWorkflow.id} title=${input.deliveryWorkflow.title}` +
        ` stages=${input.deliveryWorkflow.stages.map((stage) => `${stage.order}:${stage.toolName ?? stage.id}`).join(">")}`,
    );
  }
  if (input.deliveryContract?.requiresDeliverable) {
    summaries.push(
      "DELIVERY_CONTRACT " +
        input.deliveryContract.deliverables
          .filter((deliverable) => deliverable.required)
          .slice(0, 6)
          .map((deliverable) =>
            [
              deliverable.title || deliverable.kind,
              `kind=${deliverable.kind}`,
              deliverable.workspaceFileExtension ? `ext=${deliverable.workspaceFileExtension}` : undefined,
              deliverable.requiredVerificationTools?.length
                ? `verify=${deliverable.requiredVerificationTools.join(",")}`
                : undefined,
              deliverable.workspacePersistence
                ? `persistence=${deliverable.workspacePersistence}`
                : undefined,
            ].filter(Boolean).join(" "),
          )
          .join(" | "),
    );
  }
  const artifactEvidence = [
    ...input.artifacts,
    ...input.deliveredArtifacts,
  ];
  if (artifactEvidence.length) {
    summaries.push(
      "ARTIFACT_EVIDENCE " +
        artifactEvidence
          .slice(0, 6)
          .map((artifact) =>
            `${artifact.kind}:${artifact.name}` +
              (artifact.uri ? ` uri=${artifact.uri}` : "") +
              (artifact.content ? ` contentBytes=${Buffer.byteLength(artifact.content, "utf8")}` : ""),
          )
          .join(" | "),
    );
  }
  return summaries.map((summary) => compactCompletionDecisionText(summary, 900));
}
