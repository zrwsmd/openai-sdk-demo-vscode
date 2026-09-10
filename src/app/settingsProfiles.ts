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

export interface StoredApiSettings {
  activeProvider?: AgentProvider;
  activeApiFormat?: AgentApiFormat;
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

export function readStoredApiSettings(value: unknown): StoredApiSettings {
  if (!isRecord(value)) return { profiles: {} };

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

  return {
    ...(isAgentProvider(value.activeProvider)
      ? { activeProvider: value.activeProvider }
      : isAgentApiFormat(value.activeApiFormat)
        ? { activeProvider: 'openai' as const }
        : {}),
    ...(isAgentApiFormat(value.activeApiFormat)
      ? { activeApiFormat: value.activeApiFormat }
      : {}),
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
  return Object.values(settings.profiles).some(
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

export function saveStoredApiProfile(
  current: unknown,
  provider: AgentProvider,
  format: AgentApiFormat,
  profile: ApiSettingsProfile,
): StoredApiSettings {
  const settings = readStoredApiSettings(current);
  const providerProfiles = settings.profiles[provider] ?? {};
  return {
    activeProvider: provider,
    activeApiFormat: format,
    profiles: {
      ...settings.profiles,
      [provider]: {
        ...providerProfiles,
        [format]: {
          baseUrl: profile.baseUrl.trim().replace(/\/+$/, ''),
          model: profile.model.trim(),
        },
      },
    },
  };
}

export function apiKeySecretKey(
  provider: AgentProvider,
  format: AgentApiFormat,
): string {
  return `apiKey.${provider}.${format}`;
}
