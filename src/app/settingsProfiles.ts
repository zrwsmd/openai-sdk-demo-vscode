import {
  isAgentApiFormat,
  isAgentProvider,
  type AgentApiFormat,
  type AgentProvider,
} from '../runtime/modelAdapter';

export const API_SETTINGS_STATE_KEY = 'settingsByApiFormat';
export const LEGACY_SETTINGS_STATE_KEY = 'settings';
export const LEGACY_API_KEY_SECRET_KEY = 'apiKey';

export interface ApiSettingsProfile {
  baseUrl: string;
  model: string;
}

export interface ApiVendorProfile {
  id: string;
  name: string;
  provider: AgentProvider;
  apiFormat: AgentApiFormat;
  baseUrl: string;
  model: string;
}

const API_FORMATS: readonly AgentApiFormat[] = [
  'chat_completions',
  'responses',
  'messages',
];

export interface StoredApiSettings {
  activeProvider?: AgentProvider;
  activeApiFormat?: AgentApiFormat;
  activeVendorId?: string;
  lastVendorIdByFormat?: Partial<Record<AgentApiFormat, string>>;
  vendors: ApiVendorProfile[];
  profiles: Partial<
    Record<AgentProvider, Partial<Record<AgentApiFormat, ApiSettingsProfile>>>
  >;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeBaseUrl(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  return normalized?.replace(/\/+$/, '');
}

function normalizeProfile(value: unknown): ApiSettingsProfile | undefined {
  if (!isRecord(value)) return undefined;
  return {
    baseUrl: normalizeBaseUrl(value.baseUrl) ?? '',
    model: normalizeString(value.model) ?? '',
  };
}

export function providerForApiFormat(format: AgentApiFormat): AgentProvider {
  return format === 'messages' ? 'anthropic' : 'openai';
}

export function legacyVendorId(
  provider: AgentProvider,
  format: AgentApiFormat,
): string {
  return `${provider}.${format}`;
}

export function defaultVendorName(
  provider: AgentProvider,
  format: AgentApiFormat,
): string {
  if (provider === 'anthropic' || format === 'messages') return 'Anthropic';
  return format === 'responses' ? 'OpenAI Responses' : 'OpenAI';
}

export function createVendorId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function vendorApiKeySecretKey(vendorId: string): string {
  return `apiKey.vendor.${vendorId}`;
}

function isCompatibleProviderFormat(
  provider: AgentProvider,
  format: AgentApiFormat,
): boolean {
  if (provider === 'anthropic') return format === 'messages';
  return format !== 'messages';
}

function normalizeVendor(value: unknown): ApiVendorProfile | undefined {
  if (!isRecord(value)) return undefined;
  const id = normalizeString(value.id);
  const provider = isAgentProvider(value.provider) ? value.provider : undefined;
  const apiFormat = isAgentApiFormat(value.apiFormat) ? value.apiFormat : undefined;
  if (!id || !provider || !apiFormat) return undefined;
  if (!isCompatibleProviderFormat(provider, apiFormat)) return undefined;
  return {
    id,
    name: normalizeString(value.name) || defaultVendorName(provider, apiFormat),
    provider,
    apiFormat,
    baseUrl: normalizeBaseUrl(value.baseUrl) ?? '',
    model: normalizeString(value.model) ?? '',
  };
}

function vendorsFromProfiles(
  profiles: StoredApiSettings['profiles'],
): ApiVendorProfile[] {
  const vendors: ApiVendorProfile[] = [];
  for (const provider of ['openai', 'anthropic'] as const) {
    const providerProfiles = profiles[provider];
    if (!providerProfiles) continue;
    for (const format of API_FORMATS) {
      const profile = providerProfiles[format];
      if (!profile || !isCompatibleProviderFormat(provider, format)) continue;
      vendors.push({
        id: legacyVendorId(provider, format),
        name: defaultVendorName(provider, format),
        provider,
        apiFormat: format,
        baseUrl: profile.baseUrl,
        model: profile.model,
      });
    }
  }
  return vendors;
}

function normalizeVendorIdMap(
  value: unknown,
): Partial<Record<AgentApiFormat, string>> | undefined {
  if (!isRecord(value)) return undefined;
  const mapped: Partial<Record<AgentApiFormat, string>> = {};
  for (const format of API_FORMATS) {
    const id = normalizeString(value[format]);
    if (id) mapped[format] = id;
  }
  return Object.keys(mapped).length ? mapped : undefined;
}

export function readStoredApiSettings(value: unknown): StoredApiSettings {
  if (!isRecord(value)) return { profiles: {}, vendors: [] };

  const profiles: StoredApiSettings['profiles'] = {};
  if (isRecord(value.profiles)) {
    for (const provider of ['openai', 'anthropic'] as const) {
      const providerValue = value.profiles[provider];
      if (!isRecord(providerValue)) continue;
      const providerProfiles: Partial<
        Record<AgentApiFormat, ApiSettingsProfile>
      > = {};
      for (const format of [
        'chat_completions',
        'responses',
        'messages',
      ] as const) {
        const profile = normalizeProfile(providerValue[format]);
        if (profile) providerProfiles[format] = profile;
      }
      if (Object.keys(providerProfiles).length) {
        profiles[provider] = providerProfiles;
      }
    }

    // Migrate the previous format-only shape into the OpenAI namespace.
    const legacyOpenAiProfiles: Partial<
      Record<AgentApiFormat, ApiSettingsProfile>
    > = { ...(profiles.openai ?? {}) };
    for (const format of [
      'chat_completions',
      'responses',
      'messages',
    ] as const) {
      const profile = normalizeProfile(value.profiles[format]);
      if (profile && !legacyOpenAiProfiles[format]) {
        legacyOpenAiProfiles[format] = profile;
      }
    }
    if (Object.keys(legacyOpenAiProfiles).length) {
      profiles.openai = legacyOpenAiProfiles;
    }
  }

  const vendors: ApiVendorProfile[] = [];
  if (Array.isArray(value.vendors)) {
    for (const item of value.vendors) {
      const vendor = normalizeVendor(item);
      if (vendor && !vendors.some((existing) => existing.id === vendor.id)) {
        vendors.push(vendor);
      }
    }
  }
  if (!vendors.length) {
    vendors.push(...vendorsFromProfiles(profiles));
  }

  const lastVendorIdByFormat = normalizeVendorIdMap(value.lastVendorIdByFormat);
  const activeVendorId = normalizeString(value.activeVendorId);
  const activeProvider = isAgentProvider(value.activeProvider)
    ? value.activeProvider
    : isAgentApiFormat(value.activeApiFormat)
      ? 'openai' as const
      : undefined;
  const activeApiFormat = isAgentApiFormat(value.activeApiFormat)
    ? value.activeApiFormat
    : undefined;
  const activeVendor = (activeVendorId
    ? vendors.find((vendor) => vendor.id === activeVendorId)
    : undefined)
    ?? (activeApiFormat
      ? vendors.find((vendor) =>
        vendor.apiFormat === activeApiFormat
        && (!activeProvider || vendor.provider === activeProvider)
      )
      : undefined)
    ?? vendors[0];

  return {
    ...(activeProvider ? { activeProvider } : {}),
    ...(activeApiFormat ? { activeApiFormat } : {}),
    ...(activeVendor ? { activeVendorId: activeVendor.id } : {}),
    ...(lastVendorIdByFormat ? { lastVendorIdByFormat } : {}),
    vendors,
    profiles,
  };
}

export function readLegacyApiSettings(value: unknown): {
  baseUrl?: string;
  model?: string;
  apiFormat?: AgentApiFormat;
} {
  if (!isRecord(value)) return {};
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  const model = normalizeString(value.model);
  return {
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(model === undefined ? {} : { model }),
    ...(isAgentApiFormat(value.apiFormat) ? { apiFormat: value.apiFormat } : {}),
  };
}

export function hasStoredApiProfiles(settings: StoredApiSettings): boolean {
  return settings.vendors.length > 0
    || Object.values(settings.profiles).some(
      (profiles) => !!profiles && Object.keys(profiles).length > 0,
    );
}

export function getStoredApiProfile(
  settings: StoredApiSettings,
  provider: AgentProvider,
  format: AgentApiFormat,
): ApiSettingsProfile | undefined {
  return settings.profiles[provider]?.[format];
}

export function listStoredVendors(
  settings: StoredApiSettings,
  format?: AgentApiFormat,
): ApiVendorProfile[] {
  return format
    ? settings.vendors.filter((vendor) => vendor.apiFormat === format)
    : [...settings.vendors];
}

export function resolveStoredVendor(
  settings: StoredApiSettings,
  request: {
    vendorId?: string;
    provider?: AgentProvider;
    apiFormat?: AgentApiFormat;
  } = {},
): ApiVendorProfile | undefined {
  const vendors = settings.vendors;
  if (request.vendorId) {
    return vendors.find((vendor) => vendor.id === request.vendorId);
  }
  if (request.apiFormat) {
    const lastId = settings.lastVendorIdByFormat?.[request.apiFormat];
    const last = lastId
      ? vendors.find((vendor) =>
        vendor.id === lastId && vendor.apiFormat === request.apiFormat
      )
      : undefined;
    if (last) return last;
    const active = settings.activeVendorId
      ? vendors.find((vendor) =>
        vendor.id === settings.activeVendorId
        && vendor.apiFormat === request.apiFormat
      )
      : undefined;
    if (active) return active;
    if (request.provider) {
      const match = vendors.find((vendor) =>
        vendor.apiFormat === request.apiFormat
        && vendor.provider === request.provider
      );
      if (match) return match;
    }
    return vendors.find((vendor) => vendor.apiFormat === request.apiFormat);
  }
  if (settings.activeVendorId) {
    const active = vendors.find((vendor) => vendor.id === settings.activeVendorId);
    if (active) return active;
  }
  if (settings.activeApiFormat) {
    return resolveStoredVendor(settings, {
      apiFormat: settings.activeApiFormat,
      provider: request.provider ?? settings.activeProvider,
    });
  }
  return vendors[0];
}

function syncProfileSlot(
  profiles: StoredApiSettings['profiles'],
  vendor: ApiVendorProfile,
): StoredApiSettings['profiles'] {
  return {
    ...profiles,
    [vendor.provider]: {
      ...profiles[vendor.provider],
      [vendor.apiFormat]: {
        baseUrl: vendor.baseUrl,
        model: vendor.model,
      },
    },
  };
}

function clearProfileSlot(
  profiles: StoredApiSettings['profiles'],
  provider: AgentProvider,
  format: AgentApiFormat,
): StoredApiSettings['profiles'] {
  const providerProfiles = { ...profiles[provider] };
  delete providerProfiles[format];
  if (!Object.keys(providerProfiles).length) {
    const next = { ...profiles };
    delete next[provider];
    return next;
  }
  return { ...profiles, [provider]: providerProfiles };
}

export function saveStoredVendor(
  current: unknown,
  vendor: ApiVendorProfile,
): StoredApiSettings {
  const settings = readStoredApiSettings(current);
  if (!vendor.id.trim()) {
    throw new Error('供应商 id 不能为空');
  }
  if (!isCompatibleProviderFormat(vendor.provider, vendor.apiFormat)) {
    throw new Error('供应商协议与 API Format 不匹配');
  }
  const normalized: ApiVendorProfile = {
    id: vendor.id.trim(),
    name: vendor.name.trim() || defaultVendorName(vendor.provider, vendor.apiFormat),
    provider: vendor.provider,
    apiFormat: vendor.apiFormat,
    baseUrl: vendor.baseUrl.trim().replace(/\/+$/, ''),
    model: vendor.model.trim(),
  };
  const vendors = settings.vendors.some((item) => item.id === normalized.id)
    ? settings.vendors.map((item) => item.id === normalized.id ? normalized : item)
    : [...settings.vendors, normalized];
  return {
    ...settings,
    activeProvider: normalized.provider,
    activeApiFormat: normalized.apiFormat,
    activeVendorId: normalized.id,
    lastVendorIdByFormat: {
      ...settings.lastVendorIdByFormat,
      [normalized.apiFormat]: normalized.id,
    },
    vendors,
    profiles: syncProfileSlot(settings.profiles, normalized),
  };
}

export function deleteStoredVendor(
  current: unknown,
  vendorId: string,
): StoredApiSettings {
  const settings = readStoredApiSettings(current);
  const id = vendorId.trim();
  const removed = settings.vendors.find((vendor) => vendor.id === id);
  if (!removed) return settings;
  const vendors = settings.vendors.filter((vendor) => vendor.id !== id);
  const lastVendorIdByFormat = { ...settings.lastVendorIdByFormat };
  if (lastVendorIdByFormat[removed.apiFormat] === id) {
    const nextSameFormat = vendors.find((vendor) => vendor.apiFormat === removed.apiFormat);
    if (nextSameFormat) lastVendorIdByFormat[removed.apiFormat] = nextSameFormat.id;
    else delete lastVendorIdByFormat[removed.apiFormat];
  }
  const activeVendorId = settings.activeVendorId === id
    ? lastVendorIdByFormat[removed.apiFormat] ?? vendors[0]?.id
    : settings.activeVendorId;
  const active = vendors.find((vendor) => vendor.id === activeVendorId);
  const remainingSame = vendors.find((vendor) =>
    vendor.provider === removed.provider && vendor.apiFormat === removed.apiFormat
  );
  return {
    ...settings,
    activeProvider: active?.provider,
    activeApiFormat: active?.apiFormat,
    ...(active ? { activeVendorId: active.id } : { activeVendorId: undefined }),
    lastVendorIdByFormat,
    vendors,
    profiles: remainingSame
      ? syncProfileSlot(settings.profiles, remainingSame)
      : clearProfileSlot(settings.profiles, removed.provider, removed.apiFormat),
  };
}

export function saveStoredApiProfile(
  current: unknown,
  provider: AgentProvider,
  format: AgentApiFormat,
  profile: ApiSettingsProfile,
): StoredApiSettings {
  const settings = readStoredApiSettings(current);
  const existing = settings.vendors.find((vendor) => vendor.id === legacyVendorId(provider, format))
    ?? settings.vendors.find((vendor) =>
      vendor.provider === provider && vendor.apiFormat === format
    );
  return saveStoredVendor(settings, {
    id: existing?.id ?? legacyVendorId(provider, format),
    name: existing?.name ?? defaultVendorName(provider, format),
    provider,
    apiFormat: format,
    baseUrl: profile.baseUrl,
    model: profile.model,
  });
}

export function apiKeySecretKey(
  provider: AgentProvider,
  format: AgentApiFormat,
): string {
  return `apiKey.${provider}.${format}`;
}

export function apiKeySecretCandidates(
  vendor: Pick<ApiVendorProfile, 'id' | 'provider' | 'apiFormat'>,
): string[] {
  return [...new Set([
    vendorApiKeySecretKey(vendor.id),
    apiKeySecretKey(vendor.provider, vendor.apiFormat),
  ])];
}
