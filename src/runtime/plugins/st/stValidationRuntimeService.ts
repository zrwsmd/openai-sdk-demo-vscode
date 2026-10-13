import type { ToolResult } from "../../../protocol/results";
import type { WorkflowToolRecord } from "../../workflow/types";
import {
  getWorkflowStateSlot,
  type WorkflowRuntimeState,
} from "../../workflow/runtimeState";
import { hashStContent } from "./stContentHash";

export type StValidationInputMode = "inline_code" | "path_or_code";

export type StDeclaration = {
  category: string;
  kind: string;
  name: string;
  line: number;
};

export type StUnit = StDeclaration;

export type StValidatedDraft = {
  hash: string;
  content: string;
  declarations: StDeclaration[];
};

export type StDraftIdentity = {
  programName: string;
};

export type StValidationCandidateSource =
  | "validate_st_code"
  | "pre_write_validation"
  | "restore"
  | "manual";

export type StValidationCandidate = {
  hash: string;
  declarations: StDeclaration[];
  status: "passed" | "failed";
  errorCount: number;
  source: StValidationCandidateSource;
  targetLabel?: string;
  sequence: number;
};

export type StPersistedWriteSource =
  | "write_file"
  | "edit_file"
  | "export_st_program";

export type StPersistedWrite = {
  path: string;
  workspaceRoot?: string;
  contentHash: string;
  declarations: StDeclaration[];
  source: StPersistedWriteSource;
  sequence: number;
};

export type StDeliveryCommit = {
  commitId: string;
  path: string;
  workspaceRoot?: string;
  contentHash: string;
  declarations: StDeclaration[];
  writeSequence: number;
  sequence: number;
};

export type StValidationState = {
  hashes: Set<string>;
  lastSuccessful?: StValidatedDraft;
  draftIdentity?: StDraftIdentity;
  candidates: StValidationCandidate[];
  nextCandidateSequence: number;
  persistedWrites: StPersistedWrite[];
  deliveryCommits: StDeliveryCommit[];
  nextWriteSequence: number;
  nextDeliveryCommitSequence: number;
};

export const ST_TOOL_STATE_SERVICE = "st.validationState";
export const ST_VALIDATION_RUNTIME_SERVICE = "st.validationRuntime";

const ST_WORKSPACE_DELIVERY_STATE_KEY = "st_workspace_delivery.validation";

export function createStValidationState(): StValidationState {
  return {
    hashes: new Set<string>(),
    candidates: [],
    nextCandidateSequence: 1,
    persistedWrites: [],
    deliveryCommits: [],
    nextWriteSequence: 1,
    nextDeliveryCommitSequence: 1,
  };
}

export function getStValidationState(
  state: WorkflowRuntimeState,
): StValidationState {
  return getWorkflowStateSlot(
    state,
    ST_WORKSPACE_DELIVERY_STATE_KEY,
    createStValidationState,
  );
}

function maskStNonCode(content: string): string {
  const chars = content.split("");
  let state: "code" | "line_comment" | "block_comment" | "single_string" | "double_string" = "code";
  let blockDepth = 0;
  const blank = (index: number): void => {
    if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " ";
  };

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1];
    if (state === "line_comment") {
      if (current === "\n" || current === "\r") state = "code";
      else blank(i);
      continue;
    }
    if (state === "block_comment") {
      if (current === "(" && next === "*") {
        blank(i);
        blank(i + 1);
        blockDepth += 1;
        i += 1;
      } else if (current === "*" && next === ")") {
        blank(i);
        blank(i + 1);
        blockDepth -= 1;
        i += 1;
        if (blockDepth === 0) state = "code";
      } else {
        blank(i);
      }
      continue;
    }
    if (state === "single_string" || state === "double_string") {
      const quote = state === "single_string" ? "'" : '"';
      if (current === quote && next === quote) {
        blank(i);
        blank(i + 1);
        i += 1;
      } else if (current === quote) {
        blank(i);
        state = "code";
      } else {
        blank(i);
      }
      continue;
    }
    if (current === "/" && next === "/") {
      blank(i);
      blank(i + 1);
      i += 1;
      state = "line_comment";
    } else if (current === "(" && next === "*") {
      blank(i);
      blank(i + 1);
      i += 1;
      blockDepth = 1;
      state = "block_comment";
    } else if (current === "'") {
      blank(i);
      state = "single_string";
    } else if (current === '"') {
      blank(i);
      state = "double_string";
    }
  }
  return chars.join("");
}

function normalizeTargetPath(value: string): string {
  return value
    .trim()
    .replace(/\\/gu, "/")
    .replace(/^\.\/+/u, "")
    .toLocaleLowerCase();
}

function sameTarget(
  leftPath: string,
  rightPath: string,
  leftRoot?: string,
  rightRoot?: string,
): boolean {
  if (normalizeTargetPath(leftPath) !== normalizeTargetPath(rightPath)) {
    return false;
  }
  if (!leftRoot || !rightRoot) return true;
  return normalizeTargetPath(leftRoot) === normalizeTargetPath(rightRoot);
}

function declaration(
  category: string,
  kind: string,
  name: string,
  source: string,
  offset: number,
): StDeclaration {
  return {
    category,
    kind,
    name: name.toLocaleUpperCase(),
    line: source.slice(0, offset).split(/\r?\n/u).length,
  };
}

function identifyPouDeclarations(source: string): StDeclaration[] {
  const declarations: StDeclaration[] = [];
  const pattern =
    /\b(FUNCTION_BLOCK|PROGRAM|FUNCTION)\s+([A-Za-z_][A-Za-z0-9_]*)\b/giu;
  for (const match of source.matchAll(pattern)) {
    const kind = match[1]?.toUpperCase();
    const name = match[2]?.trim();
    if (!kind || !name) continue;
    declarations.push(
      declaration("pou", kind, name, source, match.index ?? 0),
    );
  }
  return declarations;
}

function classifyTypeDeclaration(definition: string): string {
  if (/^\s*STRUCT\b/iu.test(definition)) return "STRUCT";
  if (/^\s*UNION\b/iu.test(definition)) return "UNION";
  if (/^\s*\(/u.test(definition)) return "ENUM";
  return "TYPE_ALIAS";
}

function identifyTypeDeclarations(source: string): StDeclaration[] {
  const declarations: StDeclaration[] = [];
  const typeBlockPattern = /\bTYPE\b([\s\S]*?)\bEND_TYPE\b/giu;
  for (const block of source.matchAll(typeBlockPattern)) {
    const body = block[1] ?? "";
    const bodyOffset = (block.index ?? 0) + block[0].indexOf(body);
    const lines = body.split(/\r?\n/u);
    let offset = 0;
    let aggregateDepth = 0;
    for (const line of lines) {
      if (aggregateDepth === 0) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*?)\s*;?\s*$/u.exec(line);
        if (match?.[1]) {
          const kind = classifyTypeDeclaration(match[2] ?? "");
          declarations.push(
            declaration("type", kind, match[1], source, bodyOffset + offset),
          );
          if (kind === "STRUCT" || kind === "UNION") {
            const opens = line.match(/\b(?:STRUCT|UNION)\b/giu)?.length ?? 0;
            const closes = line.match(/\bEND_(?:STRUCT|UNION)\b/giu)?.length ?? 0;
            aggregateDepth = Math.max(0, opens - closes);
          }
        }
      } else {
        const opens = line.match(/\b(?:STRUCT|UNION)\b/giu)?.length ?? 0;
        const closes = line.match(/\bEND_(?:STRUCT|UNION)\b/giu)?.length ?? 0;
        aggregateDepth = Math.max(0, aggregateDepth + opens - closes);
      }
      offset += line.length + 1;
    }
  }
  return declarations;
}

const ST_DECLARATION_EXTRACTORS = [
  identifyPouDeclarations,
  identifyTypeDeclarations,
] as const;

export function identifyStDeclarations(content: string): StDeclaration[] {
  const source = maskStNonCode(content);
  return ST_DECLARATION_EXTRACTORS
    .flatMap((extract) => extract(source))
    .sort((left, right) => left.line - right.line);
}

export function identifyStUnits(content: string): StUnit[] {
  return identifyStDeclarations(content);
}

export function identifyStDraft(content: string): StDraftIdentity | undefined {
  const programName = identifyStDeclarations(content).find(
    (item) => item.category === "pou" && item.kind === "PROGRAM",
  )?.name;
  return programName
    ? { programName: programName.toLocaleUpperCase() }
    : undefined;
}

export type StDraftIdentityCheck = {
  accepted: boolean;
  expectedProgramName?: string;
  actualProgramName?: string;
};

export class StValidationRuntimeService {
  readonly validationInputMode: StValidationInputMode;

  constructor(
    readonly state: StValidationState,
    validationInputMode: StValidationInputMode = "inline_code",
  ) {
    this.validationInputMode = validationInputMode;
    this.state.candidates ??= [];
    this.state.nextCandidateSequence ??= this.state.candidates.length + 1;
    this.state.persistedWrites ??= [];
    this.state.deliveryCommits ??= [];
    this.state.nextWriteSequence ??= this.state.persistedWrites.length + 1;
    this.state.nextDeliveryCommitSequence ??=
      this.state.deliveryCommits.length + 1;
  }

  get lastValidatedContentHash(): string | undefined {
    return this.state.lastSuccessful?.hash;
  }

  hasValidatedContent(content: string): boolean {
    return this.state.hashes.has(hashStContent(content));
  }

  canWriteContent(content: string): boolean {
    return this.lastValidatedContentHash === hashStContent(content);
  }

  checkDraftIdentity(content: string): StDraftIdentityCheck {
    const actual = identifyStDraft(content);
    const expected = this.state.draftIdentity?.programName;
    if (!expected || !actual) {
      return {
        accepted: !expected || !!actual,
        ...(expected ? { expectedProgramName: expected } : {}),
        ...(actual ? { actualProgramName: actual.programName } : {}),
      };
    }
    return {
      accepted: expected === actual.programName,
      expectedProgramName: expected,
      actualProgramName: actual.programName,
    };
  }

  recordValidationAttempt(content: string): StDraftIdentityCheck {
    const actual = identifyStDraft(content);
    const expected = this.state.draftIdentity?.programName;
    if (!expected) {
      if (actual) this.state.draftIdentity = actual;
      return {
        accepted: !expected || !!actual,
        ...(actual ? { actualProgramName: actual.programName } : {}),
      };
    }
    const check = this.checkDraftIdentity(content);
    return check;
  }

  recordSuccessfulValidation(content: string, hash: string): boolean {
    return this.recordSuccessfulValidationWithOptions(content, hash);
  }

  recordSuccessfulValidationWithOptions(
    content: string,
    hash: string,
    options: {
      source?: StValidationCandidateSource;
      targetLabel?: string;
      recordCandidate?: boolean;
    } = {},
  ): boolean {
    const check = this.recordValidationAttempt(content);
    if (!check.accepted) return false;
    this.state.hashes.add(hash);
    this.state.lastSuccessful = {
      hash,
      content,
      declarations: identifyStDeclarations(content),
    };
    if (options.recordCandidate !== false) {
      this.recordValidationCandidate(content, {
        hash,
        status: "passed",
        errorCount: 0,
        source: options.source ?? "manual",
        ...(options.targetLabel ? { targetLabel: options.targetLabel } : {}),
      });
    }
    return true;
  }

  recordValidationCandidate(
    content: string,
    result: {
      hash?: string;
      status: "passed" | "failed";
      errorCount: number;
      source: StValidationCandidateSource;
      targetLabel?: string;
    },
  ): StValidationCandidate {
    const candidate: StValidationCandidate = {
      hash: result.hash ?? hashStContent(content),
      declarations: identifyStDeclarations(content),
      status: result.status,
      errorCount: result.errorCount,
      source: result.source,
      ...(result.targetLabel ? { targetLabel: result.targetLabel } : {}),
      sequence: this.state.nextCandidateSequence++,
    };
    this.state.candidates.push(candidate);
    return candidate;
  }

  getValidationCandidates(): readonly StValidationCandidate[] {
    return this.state.candidates;
  }

  /**
   * Record a real filesystem persistence event. This is deliberately separate
   * from validation: a successful validation is only a candidate, while this
   * record proves that the same bytes reached a concrete .st target.
   */
  recordSuccessfulWrite(options: {
    path: string;
    workspaceRoot?: string;
    content: string;
    contentHash: string;
    source: StPersistedWriteSource;
  }): StPersistedWrite | undefined {
    const contentHash = options.contentHash.trim();
    if (
      !options.path.trim() ||
      !options.path.toLocaleLowerCase().endsWith(".st") ||
      !contentHash ||
      hashStContent(options.content) !== contentHash ||
      !this.hasValidatedContent(options.content) ||
      !this.checkDraftIdentity(options.content).accepted
    ) {
      return undefined;
    }
    const existing = this.state.persistedWrites
      .slice()
      .reverse()
      .find((write) =>
        write.contentHash === contentHash &&
        sameTarget(
          write.path,
          options.path,
          write.workspaceRoot,
          options.workspaceRoot,
        ),
      );
    if (existing) return existing;
    const persisted: StPersistedWrite = {
      path: options.path,
      ...(options.workspaceRoot ? { workspaceRoot: options.workspaceRoot } : {}),
      contentHash,
      declarations: identifyStDeclarations(options.content),
      source: options.source,
      sequence: this.state.nextWriteSequence++,
    };
    this.state.persistedWrites.push(persisted);
    return persisted;
  }

  getPersistedWrites(): readonly StPersistedWrite[] {
    return this.state.persistedWrites;
  }

  recordDeliveryCommit(options: {
    path: string;
    workspaceRoot?: string;
    contentHash: string;
  }): StDeliveryCommit | undefined {
    const contentHash = options.contentHash.trim();
    const persisted = this.state.persistedWrites
      .slice()
      .reverse()
      .find((write) =>
        write.contentHash === contentHash &&
        sameTarget(
          write.path,
          options.path,
          write.workspaceRoot,
          options.workspaceRoot,
        ),
      );
    // A commit acknowledges the current delivery candidate, not an older
    // write that happens to remain in the same run's ledger.
    if (!persisted || persisted !== this.state.persistedWrites.at(-1)) {
      return undefined;
    }
    const existing = this.state.deliveryCommits
      .slice()
      .reverse()
      .find((commit) =>
        commit.contentHash === contentHash &&
        sameTarget(
          commit.path,
          options.path,
          commit.workspaceRoot,
          options.workspaceRoot,
        ),
      );
    if (existing) return existing;
    const sequence = this.state.nextDeliveryCommitSequence++;
    const commit: StDeliveryCommit = {
      commitId: `st-delivery-${sequence}-${contentHash.slice(0, 12)}`,
      path: persisted.path,
      ...(persisted.workspaceRoot
        ? { workspaceRoot: persisted.workspaceRoot }
        : {}),
      contentHash,
      declarations: persisted.declarations,
      writeSequence: persisted.sequence,
      sequence,
    };
    this.state.deliveryCommits.push(commit);
    return commit;
  }

  getDeliveryCommits(): readonly StDeliveryCommit[] {
    return this.state.deliveryCommits;
  }

  hasDeliveryCommit(
    path: string,
    contentHash: string,
    workspaceRoot?: string,
  ): boolean {
    return this.state.deliveryCommits.some((commit) =>
      commit.contentHash === contentHash.trim() &&
      sameTarget(commit.path, path, commit.workspaceRoot, workspaceRoot),
    );
  }

  restore(records: readonly WorkflowToolRecord[]): void {
    for (const record of records) {
      const data = resultData(record.result);
      if (record.name === "validate_st_code") {
        const args = parseArgs(record.args);
        const code = typeof args.code === "string" && args.code.trim()
          ? args.code
          : undefined;
        if (!code) continue;
        const errorCount = typeof data.errorCount === "number"
          ? data.errorCount
          : record.result.ok ? 0 : 1;
        const target = data.validationTarget;
        const targetLabel = target && typeof target === "object" &&
            !Array.isArray(target) &&
            typeof (target as Record<string, unknown>).path === "string"
          ? (target as Record<string, unknown>).path as string
          : undefined;
        if (!record.result.ok || errorCount !== 0) {
          this.recordValidationCandidate(code, {
            status: "failed",
            errorCount,
            source: "validate_st_code",
            ...(targetLabel ? { targetLabel } : {}),
          });
          continue;
        }
        if (!this.recordValidationAttempt(code).accepted) {
          this.recordValidationCandidate(code, {
            status: "failed",
            errorCount: 1,
            source: "validate_st_code",
            ...(targetLabel ? { targetLabel } : {}),
          });
          continue;
        }
        const hash = typeof data.validatedContentHash === "string"
          ? data.validatedContentHash
          : hashStContent(code);
        if (!hash) continue;
        this.recordSuccessfulValidationWithOptions(code, hash, {
          source: "validate_st_code",
          ...(targetLabel ? { targetLabel } : {}),
          recordCandidate: true,
        });
        continue;
      }
      if (
        (record.name === "write_file" ||
          record.name === "edit_file" ||
          record.name === "export_st_program") &&
        record.result.ok
      ) {
        const args = parseArgs(record.args);
        const content = record.name === "export_st_program"
          ? typeof args.code === "string" ? args.code : undefined
          : typeof args.content === "string" ? args.content : undefined;
        if (content && !this.recordValidationAttempt(content).accepted) continue;
        const hash = typeof data.contentHash === "string"
          ? data.contentHash
          : preWriteValidationHash(data);
        const preWriteHash = preWriteValidationHash(data);
        const validationHash = hash ?? preWriteHash;
        if (
          content &&
          validationHash &&
          preWriteHash === hashStContent(content)
        ) {
          this.recordSuccessfulValidationWithOptions(content, validationHash, {
            source: "pre_write_validation",
            recordCandidate: true,
          });
        }
        if (content && validationHash) {
          const path = typeof args.path === "string"
            ? args.path
            : typeof data.file === "string" ? data.file : undefined;
          if (path) {
            this.recordSuccessfulWrite({
              path,
              content,
              contentHash: validationHash,
              source: record.name,
            });
          }
        }
      } else if (record.name === "write_file") {
        const args = parseArgs(record.args);
        const content = typeof args.content === "string" ? args.content : undefined;
        const errorCount = typeof data.errorCount === "number"
          ? data.errorCount
          : undefined;
        if (content && errorCount !== undefined && errorCount > 0) {
          this.recordValidationCandidate(content, {
            status: "failed",
            errorCount,
            source: "pre_write_validation",
            ...(typeof args.path === "string" ? { targetLabel: args.path } : {}),
          });
        }
      }
      if (record.name === "commit_st_delivery" && record.result.ok) {
        const commitData = data.deliveryCommit;
        const commit =
          commitData && typeof commitData === "object" && !Array.isArray(commitData)
            ? commitData as Record<string, unknown>
            : {};
        const args = parseArgs(record.args);
        const path = typeof commit.path === "string"
          ? commit.path
          : typeof args.path === "string" ? args.path : undefined;
        const contentHash = typeof commit.contentHash === "string"
          ? commit.contentHash
          : typeof args.contentHash === "string" ? args.contentHash : undefined;
        if (path && contentHash) {
          this.recordDeliveryCommit({ path, contentHash });
        }
      }
    }
  }
}

export function getStValidationRuntimeService(
  state: WorkflowRuntimeState,
): StValidationRuntimeService {
  return getWorkflowStateSlot(
    state,
    ST_VALIDATION_RUNTIME_SERVICE,
    () => new StValidationRuntimeService(getStValidationState(state)),
  );
}

function parseArgs(args: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function resultData(result: ToolResult): Record<string, unknown> {
  return result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data as Record<string, unknown>
    : {};
}

function preWriteValidationHash(data: Record<string, unknown>): string | undefined {
  const preWrite = data.preWriteValidation;
  if (!preWrite || typeof preWrite !== "object" || Array.isArray(preWrite)) {
    return undefined;
  }
  const value = preWrite as Record<string, unknown>;
  if (value.errorCount !== 0) return undefined;
  return typeof value.validatedContentHash === "string"
    ? value.validatedContentHash
    : undefined;
}
