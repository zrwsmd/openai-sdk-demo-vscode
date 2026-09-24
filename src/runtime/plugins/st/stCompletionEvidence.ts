import type {
  CompletionEvidenceRecord,
  EvidenceFact,
  EvidenceFactScope,
  EvidenceFactValue,
  EvidenceHelpers,
  ToolEvidenceExtractor,
} from "../../decision/completionEvidence";

function fact(
  key: string,
  value: EvidenceFactValue,
  scope: EvidenceFactScope,
  sourceTool?: string,
): EvidenceFact {
  return {
    key,
    value,
    scope,
    ...(sourceTool ? { sourceTool } : {}),
  };
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

function addStringFact(
  facts: EvidenceFact[],
  key: string,
  value: string | undefined,
  scope: EvidenceFactScope,
  sourceTool?: string,
): void {
  if (value) facts.push(fact(key, value, scope, sourceTool));
}

function validationTargetHash(
  data: Record<string, unknown>,
  helpers: Pick<EvidenceHelpers, "objectField" | "stringField">,
): string | undefined {
  const target = helpers.objectField(data, "validationTarget");
  return target ? helpers.stringField(target, ["contentHash"]) : undefined;
}

function preWriteValidationHash(
  data: Record<string, unknown>,
  helpers: Pick<EvidenceHelpers, "objectField" | "numberField" | "stringField">,
): string | undefined {
  const preWrite = helpers.objectField(data, "preWriteValidation");
  if (!preWrite) return undefined;
  if (helpers.numberField(preWrite, ["errorCount"]) !== 0) return undefined;
  return helpers.stringField(preWrite, ["validatedContentHash"]);
}

function successfulValidationHashes(
  records: readonly CompletionEvidenceRecord[],
  helpers: EvidenceHelpers,
): Set<string> {
  const hashes = new Set<string>();
  for (const record of records) {
    if (!record.result.ok) continue;
    const data = helpers.data(record.result);
    const preWriteHash = preWriteValidationHash(data, helpers);
    if (preWriteHash) {
      hashes.add(preWriteHash);
      continue;
    }
    if (record.name !== "validate_st_code") continue;
    if (helpers.numberField(data, ["errorCount"]) !== 0) continue;
    const hash = helpers.stringField(data, ["validatedContentHash"]) ??
      validationTargetHash(data, helpers);
    if (hash) hashes.add(hash);
  }
  return hashes;
}

const stValidationEvidenceExtractor: ToolEvidenceExtractor = {
  id: "st.validation",
  toolNames: ["validate_st_code"],
  extract: (record, context) => {
    const { helpers } = context;
    const data = helpers.data(record.result);
    const target = helpers.objectField(data, "validationTarget");
    const errorCount = helpers.numberField(data, ["errorCount"]);
    const warningCount = helpers.numberField(data, ["warningCount"]);
    const validatedHash = helpers.stringField(data, ["validatedContentHash"]) ??
      validationTargetHash(data, helpers);
    const facts: EvidenceFact[] = [
      fact("st.validation.passed", errorCount === 0 && record.result.ok === true, "domain", record.name),
    ];
    addNumberFact(facts, "st.validation.errorCount", errorCount, "domain", record.name);
    addNumberFact(facts, "st.validation.warningCount", warningCount, "domain", record.name);
    if (target) {
      addStringFact(facts, "st.validation.target", helpers.stringField(target, ["path"]), "domain", record.name);
      const complete = target.complete;
      if (typeof complete === "boolean") {
        facts.push(fact("st.validation.completeInput", complete, "domain", record.name));
      }
      addNumberFact(facts, "st.validation.lines", helpers.numberField(target, ["totalLines"]), "domain", record.name);
      addNumberFact(facts, "st.validation.bytes", helpers.numberField(target, ["totalBytes"]), "domain", record.name);
    }
    if (validatedHash) {
      facts.push(fact("st.validation.hash", helpers.shortHash(validatedHash) ?? validatedHash, "domain", record.name));
    }
    return facts;
  },
};

const stPersistenceEvidenceExtractor: ToolEvidenceExtractor = {
  id: "st.persistence",
  toolNames: ["write_file", "export_st_program"],
  extract: (record, context) => {
    const { helpers } = context;
    const data = helpers.data(record.result);
    const contentHash = helpers.stringField(data, ["contentHash"]);
    const preWriteHash = preWriteValidationHash(data, helpers);
    const validationHashes = successfulValidationHashes(context.records, helpers);
    const validationHashMatch = !!contentHash &&
      (contentHash === preWriteHash || validationHashes.has(contentHash));
    const facts: EvidenceFact[] = [];

    if (record.name === "export_st_program") {
      facts.push(fact("file.operation", "export", "file", record.name));
      facts.push(fact("file.export.persisted", record.result.ok === true, "file", record.name));
    }
    if (contentHash) {
      facts.push(fact("st.persistence.validationHashMatch", validationHashMatch, "domain", record.name));
    }
    const preWrite = helpers.objectField(data, "preWriteValidation");
    if (preWrite) {
      const errorCount = helpers.numberField(preWrite, ["errorCount"]);
      facts.push(fact("st.preWriteValidation.passed", errorCount === 0, "domain", record.name));
      addNumberFact(facts, "st.preWriteValidation.errorCount", errorCount, "domain", record.name);
      addNumberFact(
        facts,
        "st.preWriteValidation.warningCount",
        helpers.numberField(preWrite, ["warningCount"]),
        "domain",
        record.name,
      );
      if (preWriteHash) {
        facts.push(fact("st.preWriteValidation.hash", helpers.shortHash(preWriteHash) ?? preWriteHash, "domain", record.name));
      }
    }
    return facts;
  },
};

export const ST_TOOL_EVIDENCE_EXTRACTORS: readonly ToolEvidenceExtractor[] = [
  stValidationEvidenceExtractor,
  stPersistenceEvidenceExtractor,
];
