import {
  isAgentApiFormat,
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
  activeApiFormat?: AgentApiFormat;
  profiles: Partial<Record<AgentApiFormat, ApiSettingsProfile>>;
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

  const profiles: Partial<Record<AgentApiFormat, ApiSettingsProfile>> = {};
  if (isRecord(value.profiles)) {
    for (const format of ['chat_completions', 'responses'] as const) {
      const profile = normalizeProfile(value.profiles[format]);
      if (profile) profiles[format] = profile;
    }
  }

  return {
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
  return Object.keys(settings.profiles).length > 0;
}

export function getStoredApiProfile(
  settings: StoredApiSettings,
  format: AgentApiFormat,
): ApiSettingsProfile | undefined {
  return settings.profiles[format];
}

export function saveStoredApiProfile(
  current: unknown,
  format: AgentApiFormat,
  profile: ApiSettingsProfile,
): StoredApiSettings {
  const settings = readStoredApiSettings(current);
  return {
    activeApiFormat: format,
    profiles: {
      ...settings.profiles,
      [format]: {
        baseUrl: profile.baseUrl.trim().replace(/\/+$/, ''),
        model: profile.model.trim(),
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
