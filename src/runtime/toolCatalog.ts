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

export interface ToolCatalogSelectionOptions {
  /**
   * Logical caller scope for cache isolation. This is a performance key only;
   * it never grants or removes runtime permission.
   */
  scope?: string;
}

export interface ToolCapabilityIntentMatch {
  fragment: string;
  matches: readonly ToolCapabilityTextMatch[];
  selected: readonly ToolCapabilityTextMatch[];
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

function longestCommonSubsequenceLength(left: string, right: string): number {
  if (!left || !right) return 0;
  const previous = new Array<number>(right.length + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? previous[rightIndex - 1] + 1
          : Math.max(previous[rightIndex], current[rightIndex - 1]);
    }
    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previous[rightIndex] = current[rightIndex];
    }
  }
  return previous[right.length];
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
  if (compactQuery.length >= 3 && compactValue.length >= 3) {
    const subsequenceLength = longestCommonSubsequenceLength(
      compactQuery,
      compactValue,
    );
    const shorterLength = Math.min(compactQuery.length, compactValue.length);
    const coverage = subsequenceLength / shorterLength;
    // Allow descriptive context between meaningful words while avoiding
    // matches based on one or two shared characters.
    if (subsequenceLength >= 3 && coverage >= 0.6) {
      return weight * (0.74 + coverage * 0.24);
    }
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

const INTENT_FRAGMENT_SEPARATOR =
  /(?:[，,；;、]+|\b(?:and|also|then|plus|as\s+well\s+as)\b|并且|同时|以及|另外|然后|还要|还需要)/giu;
const SINGLE_CHARACTER_INTENT_CONNECTORS = new Set(["并", "和", "与", "及"]);

type WordSegment = {
  segment: string;
};

type WordSegmenter = {
  segment(input: string): Iterable<WordSegment>;
};

type WordSegmenterConstructor = new (
  locales?: string | readonly string[],
  options?: { granularity?: "grapheme" | "word" | "sentence" },
) => WordSegmenter;

function splitStandaloneIntentConnectors(text: string): readonly string[] {
  const segmenterConstructor = (
    Intl as unknown as { Segmenter?: WordSegmenterConstructor }
  ).Segmenter;
  // If the host does not provide word segmentation, do not guess at single
  // character boundaries. Keeping the phrase intact is the safer fallback.
  if (!segmenterConstructor) return [text];

  const segments = [...new segmenterConstructor("zh", { granularity: "word" }).segment(text)];
  const fragments: string[] = [];
  let current = "";
  for (const segment of segments) {
    if (SINGLE_CHARACTER_INTENT_CONNECTORS.has(segment.segment)) {
      if (current.trim()) fragments.push(current.trim());
      current = "";
      continue;
    }
    current += segment.segment;
  }
  if (current.trim()) fragments.push(current.trim());
  return fragments;
}

export function splitToolCapabilityIntentText(text: string): readonly string[] {
  const fragments = text
    .replace(/[。！？!?]+/gu, "；")
    .split(INTENT_FRAGMENT_SEPARATOR)
    .flatMap((fragment) => splitStandaloneIntentConnectors(fragment))
    .map((fragment) => fragment.trim())
    .filter((fragment) => compactSearchText(fragment).length >= 2);
  return Object.freeze([...new Set(fragments)]);
}

function selectStrongTextMatches(
  matches: readonly ToolCapabilityTextMatch[],
): readonly ToolCapabilityTextMatch[] {
  if (!matches.length) return [];
  const topScore = matches[0].score;
  const selected = matches.filter((match) => match.score >= topScore - 0.05);
  if (topScore < 0.82 || selected.length === 0 || selected.length > 4) {
    return [];
  }
  return selected;
}

function capabilityScope(
  capability: RegisteredToolCapability,
): string | undefined {
  const domain = capability.domain?.trim();
  if (domain) return `domain:${normalized(domain)}`;
  const provider = capability.providerId.trim();
  return provider ? `provider:${normalized(provider)}` : undefined;
}

const MIN_SCOPE_CONTEXT_FRAGMENT_LENGTH = 5;
const MAX_TOOL_CATALOG_CACHE_ENTRIES = 128;

function normalizedCacheText(value: string | undefined): string {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function rememberBounded<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
): void {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size <= MAX_TOOL_CATALOG_CACHE_ENTRIES) return;
  const oldest = cache.keys().next().value as string | undefined;
  if (oldest !== undefined) cache.delete(oldest);
}

function applyIntentScopeContext(
  intents: readonly ToolCapabilityIntentMatch[],
): readonly ToolCapabilityIntentMatch[] {
  const anchorScopes = new Set<string>();
  for (const intent of intents) {
    if (intent.selected.length !== 1) continue;
    const scope = capabilityScope(intent.selected[0].capability);
    if (scope) anchorScopes.add(scope);
  }
  if (anchorScopes.size !== 1) return intents;

  const [scope] = anchorScopes;
  return intents.map((intent) => {
    // A short fragment such as "查看文件" is intentionally ambiguous:
    // another fragment may establish a domain, but it must not rewrite this
    // generic request into a domain-specific capability.
    if (
      intent.selected.length <= 1 ||
      compactSearchText(intent.fragment).length <
        MIN_SCOPE_CONTEXT_FRAGMENT_LENGTH
    ) {
      return intent;
    }
    const scoped = intent.selected.filter(
      (match) => capabilityScope(match.capability) === scope,
    );
    return scoped.length
      ? Object.freeze({ ...intent, selected: scoped })
      : intent;
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
  private catalogVersion = 0;
  private readonly fallbackSelectionCache = new Map<string, readonly string[]>();
  private readonly capabilityPromptCache = new Map<string, string>();

  constructor(initial: readonly RegisteredToolCapability[] = []) {
    for (const capability of initial) {
      this.register(capability.providerId, capability);
    }
  }

  /**
   * Monotonic metadata version used to invalidate selection and prompt caches.
   * It is not an authorization version and must not be used as one.
   */
  get selectionVersion(): number {
    return this.catalogVersion;
  }

  private invalidateCaches(): void {
    this.catalogVersion += 1;
    this.fallbackSelectionCache.clear();
    this.capabilityPromptCache.clear();
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
    this.invalidateCaches();
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
    if (entries.length > 0) this.invalidateCaches();
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
   * Return a deduplicated, deterministic tool-name order.
   *
   * Registered capabilities keep their declaration order so the prompt and
   * provider tool array remain readable and backwards-compatible. Runtime
   * control or legacy tools that are not in the catalog use lexical order as
   * a deterministic fallback.
   */
  orderToolNames(names: readonly string[]): readonly string[] {
    const unique = [
      ...new Set(
        names
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    ];
    const order = new Map(
      this.list().map((capability, index) => [capability.name, index]),
    );
    unique.sort((left, right) => {
      const leftOrder = order.get(left);
      const rightOrder = order.get(right);
      if (leftOrder !== undefined && rightOrder !== undefined) {
        return leftOrder - rightOrder;
      }
      if (leftOrder !== undefined) return -1;
      if (rightOrder !== undefined) return 1;
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
    return Object.freeze(unique);
  }

  /**
   * Render generic capability metadata for the model-facing tool prompt.
   *
   * The catalog is not an authorization boundary: the caller supplies the
   * already-filtered tool names, and unknown runtime-control tools remain
   * visible by name without requiring a catalog entry.
   */
  renderToolCapabilityPrompt(toolNames: readonly string[]): string {
    const orderedToolNames = this.orderToolNames(toolNames);
    const cacheKey = JSON.stringify([
      this.catalogVersion,
      orderedToolNames,
    ]);
    const cached = this.capabilityPromptCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const rendered = orderedToolNames
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
    rememberBounded(this.capabilityPromptCache, cacheKey, rendered);
    return rendered;
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
      .map((capability, index) => ({
        match: matchCapabilityText(text, capability),
        index,
      }))
      .filter(({ match }) => match.score >= minScore)
      .sort((left, right) =>
        right.match.score - left.match.score || left.index - right.index)
      .map(({ match }) => match);
    return limit ? matches.slice(0, limit) : matches;
  }

  toolsForText(
    text: string,
    query: ToolCapabilityTextQuery = {},
  ): readonly string[] {
    return this.findByText(text, query).map((match) => match.capability.name);
  }

  findByTextIntents(
    text: string,
    query: ToolCapabilityTextQuery = {},
  ): readonly ToolCapabilityIntentMatch[] {
    const fragments = splitToolCapabilityIntentText(text);
    const intents = fragments.map((fragment) => {
      const matches = this.findByText(fragment, query);
      return Object.freeze({
        fragment,
        matches,
        selected: selectStrongTextMatches(matches),
      });
    });
    return applyIntentScopeContext(intents);
  }

  toolsForTextIntents(
    text: string,
    query: ToolCapabilityTextQuery = {},
  ): readonly string[] {
    const selected = new Set<string>();
    for (const intent of this.findByTextIntents(text, query)) {
      for (const match of intent.selected) {
        selected.add(match.capability.name);
      }
    }
    return this.orderToolNames([...selected]);
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

  toolsForFallback(
    mode: ToolFallbackMode,
    userText?: string,
    options: ToolCatalogSelectionOptions = {},
  ): readonly string[] {
    const cacheKey = JSON.stringify([
      this.catalogVersion,
      options.scope?.trim() || "fallback",
      mode,
      normalizedCacheText(userText),
    ]);
    const cached = this.fallbackSelectionCache.get(cacheKey);
    if (cached !== undefined) return [...cached];
    const normalizedUserText = normalizedCacheText(userText);

    const query = capabilityQueryForFallback(mode);
    const baseTools = query
      ? this.toolsForQuery(query)
      : this.list()
      .filter((capability) => capability.fallbackModes?.includes(mode))
      .map((capability) => capability.name);
    if (!normalizedUserText || baseTools.length < 2) {
      rememberBounded(
        this.fallbackSelectionCache,
        cacheKey,
        Object.freeze([...baseTools]),
      );
      return baseTools;
    }

    const selected = this.toolsForTextIntents(normalizedUserText, {
      names: baseTools,
      minScore: 0.74,
    });
    // A weak or broad match must never hide tools. Only a strong, bounded
    // result from one or more intent fragments is allowed to narrow the
    // ordinary fallback surface.
    if (selected.length === 0 || selected.length > 4) {
      rememberBounded(
        this.fallbackSelectionCache,
        cacheKey,
        Object.freeze([...baseTools]),
      );
      return baseTools;
    }
    // A file-edit fallback may be selected after an uncertain or conflicting
    // intent judgment. Never let a read-only match hide every write-capable
    // tool from a surface that originally exposed write capabilities.
    const baseHasWriteCapability = baseTools.some(
      (name) => this.get(name)?.risk === "write",
    );
    const selectedHasWriteCapability = selected.some(
      (name) => this.get(name)?.risk === "write",
    );
    if (baseHasWriteCapability && !selectedHasWriteCapability) {
      rememberBounded(
        this.fallbackSelectionCache,
        cacheKey,
        Object.freeze([...baseTools]),
      );
      return baseTools;
    }
    const orderedSelected = this.orderToolNames(selected);
    rememberBounded(
      this.fallbackSelectionCache,
      cacheKey,
      orderedSelected,
    );
    return orderedSelected;
  }
}
