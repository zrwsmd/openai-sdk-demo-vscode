import type { ToolResult } from "../../../protocol/results";
import type { WorkflowToolRecord } from "../../workflow/types";
import {
  getWorkflowStateSlot,
  type WorkflowRuntimeState,
} from "../../workflow/runtimeState";
import { hashStContent } from "./stContentHash";

export type StValidationInputMode = "inline_code" | "path_or_code";

export type StValidatedDraft = {
  hash: string;
  content: string;
};

export type StValidationState = {
  hashes: Set<string>;
  lastSuccessful?: StValidatedDraft;
};

export const ST_TOOL_STATE_SERVICE = "st.validationState";
export const ST_VALIDATION_RUNTIME_SERVICE = "st.validationRuntime";

const ST_WORKSPACE_DELIVERY_STATE_KEY = "st_workspace_delivery.validation";

export function createStValidationState(): StValidationState {
  return { hashes: new Set<string>() };
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

export class StValidationRuntimeService {
  readonly validationInputMode: StValidationInputMode;

  constructor(
    readonly state: StValidationState,
    validationInputMode: StValidationInputMode = "inline_code",
  ) {
    this.validationInputMode = validationInputMode;
  }

  get lastValidatedContentHash(): string | undefined {
    return this.state.lastSuccessful?.hash;
  }

  recordSuccessfulValidation(content: string, hash: string): void {
    this.state.hashes.add(hash);
    this.state.lastSuccessful = { hash, content };
  }

  hasValidatedContent(content: string): boolean {
    return this.state.hashes.has(hashStContent(content));
  }

  canWriteContent(content: string): boolean {
    return this.lastValidatedContentHash === hashStContent(content);
  }

  restore(records: readonly WorkflowToolRecord[]): void {
    for (const record of records) {
      const data = resultData(record.result);
      if (record.name === "validate_st_code" && record.result.ok) {
        if (data.errorCount !== 0) continue;
        const args = parseArgs(record.args);
        const code = typeof args.code === "string" && args.code.trim()
          ? args.code
          : undefined;
        const hash = typeof data.validatedContentHash === "string"
          ? data.validatedContentHash
          : code ? hashStContent(code) : undefined;
        if (!code || !hash) continue;
        this.recordSuccessfulValidation(code, hash);
        continue;
      }
      if (record.name === "write_file" && record.result.ok) {
        const args = parseArgs(record.args);
        const content = typeof args.content === "string" ? args.content : undefined;
        const hash = preWriteValidationHash(data);
        if (content && hash === hashStContent(content)) {
          this.recordSuccessfulValidation(content, hash);
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
