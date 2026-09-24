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

export type ToolFallbackMode = "read_only" | "file_edit";

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

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
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

  toolsForFallback(mode: ToolFallbackMode): readonly string[] {
    return this.list()
      .filter((capability) => capability.fallbackModes?.includes(mode))
      .map((capability) => capability.name);
  }
}
