import type { DeliveryEvidence } from "./deliveryContract";
import type { ToolEffect, ToolRisk } from "../protocol/results";

/**
 * Domain-neutral description of what a tool can do.
 *
 * A capability is metadata for discovery and routing. It does not execute a
 * tool, change the current allowlist, or replace workflow policy.
 */
export interface ToolCapability {
  /** Exact runtime tool name exposed to the model. */
  name: string;
  /** Short semantic description used by future routing/catalog consumers. */
  description: string;
  /** Optional domain label, for example "workspace" or "plc". */
  domain?: string;
  /** User-goal phrases or normalized intents this tool can satisfy. */
  intents?: readonly string[];
  /** Stable labels for filtering and diagnostics. */
  tags?: readonly string[];
  /** Optional metadata; provider registration can supply defaults. */
  risk?: ToolRisk;
  effect?: ToolEffect;
  requiresApproval?: boolean;
  evidence?: readonly DeliveryEvidence[];
  /**
   * Ordinary fallback surfaces where the tool may be offered when no
   * registered Workflow owns the request. Omit to use the risk-based default.
   */
  fallbackModes?: readonly ToolFallbackMode[];
}

export type ToolFallbackMode =
  | "general_chat"
  | "read_only"
  | "file_edit"
  | "command_query"
  | "needs_clarification"
  | "blocked_high_risk";

export interface RegisteredToolCapability extends ToolCapability {
  providerId: string;
}

export interface ToolCapabilityRegistrationDefaults {
  riskByTool?: Readonly<Record<string, ToolRisk>>;
  evidenceByTool?: Readonly<Record<string, readonly DeliveryEvidence[]>>;
}

export interface ToolCapabilityQuery {
  names?: readonly string[];
  providerId?: string;
  domains?: readonly string[];
  intents?: readonly string[];
  tags?: readonly string[];
  risks?: readonly ToolRisk[];
}

export interface ToolCapabilityTextQuery {
  names?: readonly string[];
  minScore?: number;
  limit?: number;
}

export interface ToolCapabilityTextMatch {
  capability: RegisteredToolCapability;
  score: number;
  matchedIntents: readonly string[];
  matchedFields: readonly ("name" | "description" | "intent" | "tag" | "domain")[];
}

/**
 * Fallback surfaces that may inspect context without creating a new side
 * effect. Their tool set is derived from capability risk metadata rather than
 * from provider-specific tool names.
 */
const SAFE_FALLBACK_RISKS: readonly ToolRisk[] = ["read", "plan"];

export function capabilityQueryForFallback(
  mode: ToolFallbackMode,
): ToolCapabilityQuery | undefined {
  if (
    mode === "general_chat" ||
    mode === "needs_clarification" ||
    mode === "blocked_high_risk"
  ) {
    return { risks: SAFE_FALLBACK_RISKS };
  }
  return undefined;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compactSearchText(value: string): string {
  return normalized(value).replace(/[^\p{L}\p{N}_]+/gu, "");
}

function longestCommonSubstringLength(left: string, right: string): number {
  if (!left || !right) return 0;
  const previous = new Array<number>(right.length + 1).fill(0);
  let longest = 0;
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      if (left[leftIndex - 1] !== right[rightIndex - 1]) continue;
      current[rightIndex] = previous[rightIndex - 1] + 1;
      if (current[rightIndex] > longest) longest = current[rightIndex];
    }
    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previous[rightIndex] = current[rightIndex];
    }
  }
  return longest;
}

function textMatchScore(query: string, value: string, weight: number): number {
  const compactQuery = compactSearchText(query);
  const compactValue = compactSearchText(value);
  if (!compactQuery || !compactValue) return 0;
  if (
    compactQuery.includes(compactValue) ||
    compactValue.includes(compactQuery)
  ) {
    return weight;
  }
  const commonLength = longestCommonSubstringLength(compactQuery, compactValue);
  if (commonLength >= 5) return weight * 0.92;
  if (commonLength >= 4) return weight * 0.82;
  if (commonLength >= 3) return weight * 0.68;
  if (commonLength >= 2) return weight * 0.42;
  return 0;
}

function matchCapabilityText(
  query: string,
  capability: RegisteredToolCapability,
): ToolCapabilityTextMatch {
  const candidates: Array<{
    field: ToolCapabilityTextMatch["matchedFields"][number];
    value: string;
    weight: number;
  }> = [
    { field: "name", value: capability.name, weight: 0.82 },
    { field: "description", value: capability.description, weight: 0.9 },
    ...(capability.intents ?? []).map((value) => ({
      field: "intent" as const,
      value,
      weight: 1,
    })),
    ...(capability.tags ?? []).map((value) => ({
      field: "tag" as const,
      value,
      weight: 0.58,
    })),
    ...(capability.domain
      ? [{ field: "domain" as const, value: capability.domain, weight: 0.58 }]
      : []),
  ];
  let score = 0;
  const matchedFields = new Set<ToolCapabilityTextMatch["matchedFields"][number]>();
  const matchedIntents: string[] = [];
  for (const candidate of candidates) {
    const candidateScore = textMatchScore(query, candidate.value, candidate.weight);
    if (candidateScore <= 0) continue;
    score = Math.max(score, candidateScore);
    matchedFields.add(candidate.field);
    if (candidate.field === "intent") matchedIntents.push(candidate.value);
  }
  return {
    capability,
    score,
    matchedIntents,
    matchedFields: [...matchedFields],
  };
}

function normalizedList(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([
    ...new Set(
      (values ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]);
}

function evidenceList(
  values: readonly DeliveryEvidence[],
): readonly DeliveryEvidence[] {
  return Object.freeze([
    ...new Set(values.map((value) => value.trim() as DeliveryEvidence).filter(Boolean)),
  ]);
}

function defaultFallbackModes(
  risk: ToolRisk | undefined,
): readonly ToolFallbackMode[] {
  if (risk === "read") return ["read_only", "file_edit"];
  if (risk === "plan") return ["read_only"];
  if (risk === "write") return ["file_edit"];
  return [];
}

function overlaps(
  requested: readonly string[] | undefined,
  available: readonly string[] | undefined,
): boolean {
  if (!requested?.length) return true;
  const availableValues = new Set((available ?? []).map(normalized));
  return requested.some((value) => availableValues.has(normalized(value)));
}

function freezeCapability(
  providerId: string,
  capability: ToolCapability,
  defaults: ToolCapabilityRegistrationDefaults,
): RegisteredToolCapability {
  const name = capability.name.trim();
  const risk = capability.risk ?? defaults.riskByTool?.[name];
  const evidence = evidenceList([
    ...(capability.evidence ?? []),
    ...(defaults.evidenceByTool?.[name] ?? []),
  ]);
  const requiresApproval =
    capability.requiresApproval ??
    (risk === "write" || risk === "execute" ? true : undefined);
  const fallbackModes = capability.fallbackModes ?? defaultFallbackModes(risk);
  return Object.freeze({
    ...capability,
    name,
    description: capability.description.trim(),
    providerId,
    ...(capability.domain?.trim() ? { domain: capability.domain.trim() } : {}),
    intents: normalizedList(capability.intents),
    tags: normalizedList(capability.tags),
    ...(risk ? { risk } : {}),
    ...(capability.effect ? { effect: capability.effect } : {}),
    ...(requiresApproval !== undefined ? { requiresApproval } : {}),
    ...(evidence.length ? { evidence } : {}),
    fallbackModes: normalizedList(fallbackModes) as readonly ToolFallbackMode[],
  });
}

/**
 * Catalog of capabilities declared by registered ToolProviders.
 *
 * The catalog never executes tools. Runtime policy may use its fallback
 * selection results to build an ordinary-turn allowlist.
 */
export class ToolCatalog {
  private readonly capabilities = new Map<string, RegisteredToolCapability>();

  constructor(initial: readonly RegisteredToolCapability[] = []) {
    for (const capability of initial) {
      this.register(capability.providerId, capability);
    }
  }

  register(
    providerId: string,
    capability: ToolCapability,
    defaults: ToolCapabilityRegistrationDefaults = {},
  ): this {
    const normalizedProviderId = providerId.trim();
    if (!normalizedProviderId) {
      throw new Error("Tool capability provider id must not be empty");
    }
    if (!capability.name.trim()) {
      throw new Error("Tool capability name must not be empty");
    }
    if (!capability.description.trim()) {
      throw new Error(`Tool capability description must not be empty: ${capability.name}`);
    }
    const entry = freezeCapability(normalizedProviderId, capability, defaults);
    if (this.capabilities.has(entry.name)) {
      throw new Error(`Tool capability already registered: ${entry.name}`);
    }
    this.capabilities.set(entry.name, entry);
    return this;
  }

  registerProvider(
    providerId: string,
    capabilities: readonly ToolCapability[],
    defaults: ToolCapabilityRegistrationDefaults = {},
  ): this {
    const normalizedProviderId = providerId.trim();
    if (!normalizedProviderId) {
      throw new Error("Tool capability provider id must not be empty");
    }
    const entries = capabilities.map((capability) =>
      freezeCapability(normalizedProviderId, capability, defaults),
    );
    const names = new Set<string>();
    for (const entry of entries) {
      if (!entry.name) throw new Error("Tool capability name must not be empty");
      if (!entry.description) {
        throw new Error(`Tool capability description must not be empty: ${entry.name}`);
      }
      if (names.has(entry.name) || this.capabilities.has(entry.name)) {
        throw new Error(`Tool capability already registered: ${entry.name}`);
      }
      names.add(entry.name);
    }
    for (const entry of entries) this.capabilities.set(entry.name, entry);
    return this;
  }

  registerMany(
    providerId: string,
    capabilities: readonly ToolCapability[],
    defaults: ToolCapabilityRegistrationDefaults = {},
  ): this {
    return this.registerProvider(providerId, capabilities, defaults);
  }

  has(toolName: string): boolean {
    return this.capabilities.has(toolName);
  }

  get(toolName: string | undefined): RegisteredToolCapability | undefined {
    if (!toolName) return undefined;
    return this.capabilities.get(toolName);
  }

  list(): readonly RegisteredToolCapability[] {
    return [...this.capabilities.values()];
  }

  /**
   * Render generic capability metadata for the model-facing tool prompt.
   *
   * The catalog is not an authorization boundary: the caller supplies the
   * already-filtered tool names, and unknown runtime-control tools remain
   * visible by name without requiring a catalog entry.
   */
  renderToolCapabilityPrompt(toolNames: readonly string[]): string {
    return toolNames
      .map((toolName) => {
        const capability = this.get(toolName);
        if (!capability) return `- ${toolName}`;

        const details = [`- ${capability.name}: ${capability.description}`];
        if (capability.intents?.length) {
          details.push(`适用意图：${capability.intents.join("、")}`);
        }
        if (capability.domain) {
          details.push(`领域：${capability.domain}`);
        }
        if (capability.risk) {
          details.push(`风险：${capability.risk}`);
        }
        if (capability.effect) {
          details.push(`副作用：${capability.effect}`);
        }
        if (capability.requiresApproval !== undefined) {
          details.push(`需要审批：${capability.requiresApproval ? "是" : "否"}`);
        }
        return details.join("；");
      })
      .join("\n");
  }

  listByProvider(providerId: string): readonly RegisteredToolCapability[] {
    const normalizedProviderId = normalized(providerId);
    return this.list().filter(
      (capability) => normalized(capability.providerId) === normalizedProviderId,
    );
  }

  find(query: ToolCapabilityQuery = {}): readonly RegisteredToolCapability[] {
    const names = query.names?.map(normalized);
    const domains = query.domains?.map(normalized);
    const risks = query.risks ? new Set(query.risks) : undefined;
    const providerId = query.providerId ? normalized(query.providerId) : undefined;
    return this.list().filter((capability) => {
      if (names?.length && !names.includes(normalized(capability.name))) return false;
      if (providerId && normalized(capability.providerId) !== providerId) return false;
      if (
        domains?.length &&
        (!capability.domain || !domains.includes(normalized(capability.domain)))
      ) {
        return false;
      }
      if (risks && (!capability.risk || !risks.has(capability.risk))) return false;
      if (!overlaps(query.intents, capability.intents)) return false;
      if (!overlaps(query.tags, capability.tags)) return false;
      return true;
    });
  }

  findByIntent(intent: string): readonly RegisteredToolCapability[] {
    return this.find({ intents: [intent] });
  }

  findByTag(tag: string): readonly RegisteredToolCapability[] {
    return this.find({ tags: [tag] });
  }

  findByText(
    text: string,
    query: ToolCapabilityTextQuery = {},
  ): readonly ToolCapabilityTextMatch[] {
    const names = query.names?.map(normalized);
    const minScore = query.minScore ?? 0.5;
    const limit = query.limit && query.limit > 0 ? Math.floor(query.limit) : undefined;
    const matches = this.list()
      .filter((capability) => !names?.length || names.includes(normalized(capability.name)))
      .map((capability) => matchCapabilityText(text, capability))
      .filter((match) => match.score >= minScore)
      .sort((left, right) => right.score - left.score);
    return limit ? matches.slice(0, limit) : matches;
  }

  toolsForText(
    text: string,
    query: ToolCapabilityTextQuery = {},
  ): readonly string[] {
    return this.findByText(text, query).map((match) => match.capability.name);
  }

  toolsForQuery(query: ToolCapabilityQuery = {}): readonly string[] {
    return this.find(query).map((capability) => capability.name);
  }

  riskMap(): Readonly<Record<string, ToolRisk>> {
    return Object.freeze(
      Object.fromEntries(
        this.list()
          .filter((capability): capability is RegisteredToolCapability & { risk: ToolRisk } =>
            capability.risk !== undefined,
          )
          .map((capability) => [capability.name, capability.risk]),
      ),
    );
  }

  evidenceMap(): Readonly<Record<string, readonly DeliveryEvidence[]>> {
    return Object.freeze(
      Object.fromEntries(
        this.list()
          .filter((capability) => (capability.evidence?.length ?? 0) > 0)
          .map((capability) => [capability.name, capability.evidence ?? []]),
      ),
    );
  }

  toolsForEvidence(evidence: DeliveryEvidence): readonly string[] {
    return this.list()
      .filter((capability) => capability.evidence?.includes(evidence))
      .map((capability) => capability.name);
  }

  toolsForFallback(mode: ToolFallbackMode, userText?: string): readonly string[] {
    const query = capabilityQueryForFallback(mode);
    const baseTools = query
      ? this.toolsForQuery(query)
      : this.list()
      .filter((capability) => capability.fallbackModes?.includes(mode))
      .map((capability) => capability.name);
    if (!userText?.trim() || baseTools.length < 2) return baseTools;

    const matches = this.findByText(userText, {
      names: baseTools,
      minScore: 0.74,
    });
    if (!matches.length) return baseTools;
    const topScore = matches[0].score;
    const selected = matches
      .filter((match) => match.score >= topScore - 0.08)
      .map((match) => match.capability.name);
    // A weak or broad match must never hide tools. Only a strong, bounded
    // result is allowed to narrow the ordinary fallback surface.
    if (topScore < 0.82 || selected.length === 0 || selected.length > 4) {
      return baseTools;
    }
    return selected;
  }
}
