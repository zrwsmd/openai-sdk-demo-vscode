export type McpTransport = 'stdio' | 'http';

export const MCP_CONFIG_RELATIVE_PATH = '.plc-agent/mcp.json';

export interface McpStdioServerConfig {
  name: string;
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
}

export interface McpHttpServerConfig {
  name: string;
  transport: 'http';
  url: string;
  timeoutMs?: number;
}

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

export interface McpSettings {
  enabled: boolean;
  servers: McpServerConfig[];
}

const MCP_FALLBACK_MODES = new Set([
  'general_chat',
  'read_only',
  'file_edit',
  'command_query',
]);

export function emptyMcpSettings(): McpSettings {
  return { enabled: false, servers: [] };
}

export function parseMcpSettings(value: unknown): McpSettings {
  return parseMcpDocument(value);
}

export function parseMcpDocument(value: unknown, workspaceRoot?: string): McpSettings {
  if (!isRecord(value)) return emptyMcpSettings();
  const named = namedServerMap(value);
  const servers = named
    ? Object.entries(named)
      .map(([name, spec]) => parseNamedMcpServer(name, spec, workspaceRoot))
      .filter((server): server is McpServerConfig => !!server)
    : Array.isArray(value.servers)
      ? value.servers
        .map((item) => parseMcpServerConfig(item, workspaceRoot))
        .filter((server): server is McpServerConfig => !!server)
      : [];
  return {
    enabled: value.enabled !== false && servers.length > 0,
    servers,
  };
}

export async function loadMcpSettings(
  workspaceRoots: readonly string[],
  readFile: (filePath: string, encoding: 'utf8') => Promise<string> = defaultReadFile,
): Promise<McpSettings> {
  for (const root of workspaceRoots) {
    const workspaceRoot = root.trim();
    if (!workspaceRoot) continue;
    const filePath = joinPath(workspaceRoot, MCP_CONFIG_RELATIVE_PATH);
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = parseMcpDocument(JSON.parse(raw), workspaceRoot);
      if (parsed.servers.length) return parsed;
    } catch (error) {
      if (isMissingFileError(error)) continue;
      throw new Error(`读取 MCP 配置失败: ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return emptyMcpSettings();
}

export function isMcpSettings(value: unknown): value is McpSettings {
  if (!isRecord(value)) return false;
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') return false;
  if (value.servers === undefined) return true;
  if (!Array.isArray(value.servers)) return false;
  return value.servers.every((server) => parseMcpServerConfig(server) !== undefined);
}

export function shouldExposeMcpTools(run: {
  workflowId?: string;
  fallbackMode?: string;
}): boolean {
  if (run.workflowId) return false;
  return MCP_FALLBACK_MODES.has(run.fallbackMode ?? '');
}

export function mcpAllowlist(run: {
  workflowId?: string;
  fallbackMode?: string;
  toolAllowlist?: readonly string[];
}, mcpToolNames: readonly string[]): readonly string[] | undefined {
  if (!mcpToolNames.length || !shouldExposeMcpTools(run) || !run.toolAllowlist) {
    return run.toolAllowlist;
  }
  return [...run.toolAllowlist, ...mcpToolNames];
}

export function sanitizeMcpNamePart(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'server';
}

export function mcpFunctionToolName(serverName: string, toolName: string): string {
  const base = `mcp_${sanitizeMcpNamePart(serverName)}_${sanitizeMcpNamePart(toolName)}`;
  if (base.length <= 64) return base;
  return `${base.slice(0, 55)}_${hash8(base)}`;
}

function parseMcpServerConfig(value: unknown, workspaceRoot?: string): McpServerConfig | undefined {
  if (!isRecord(value)) return undefined;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) return undefined;
  return parseNamedMcpServer(name, value, workspaceRoot);
}

function namedServerMap(value: Record<string, unknown>): Record<string, unknown> | undefined {
  if (isRecord(value.mcpServers)) return value.mcpServers;
  if (isRecord(value.servers) && !Array.isArray(value.servers)) return value.servers;
  return undefined;
}

function parseNamedMcpServer(
  name: string,
  value: unknown,
  workspaceRoot?: string,
): McpServerConfig | undefined {
  if (!isRecord(value) || !name.trim()) return undefined;
  const timeoutMs = parseTimeout(value);
  const type = typeof value.type === 'string' ? value.type.trim().toLowerCase() : '';
  const transport = value.transport === 'http' || type === 'http' || type === 'sse' || type === 'streamable-http'
    ? 'http'
    : value.transport === 'stdio' || type === 'stdio' || type === ''
      ? 'stdio'
      : undefined;
  const url = interpolate(typeof value.url === 'string' ? value.url.trim() : '', workspaceRoot);
  const command = interpolate(typeof value.command === 'string' ? value.command.trim() : '', workspaceRoot);
  if ((transport === 'http' || url) && url) {
    return { name: name.trim(), transport: 'http', url, ...(timeoutMs ? { timeoutMs } : {}) };
  }
  if ((transport === 'stdio' || command) && command) {
    const args = Array.isArray(value.args)
      ? value.args
        .filter((item): item is string => typeof item === 'string')
        .map((item) => interpolate(item, workspaceRoot))
      : undefined;
    const cwd = interpolate(
      typeof value.cwd === 'string' && value.cwd.trim() ? value.cwd.trim() : '',
      workspaceRoot,
    ) || undefined;
    const env = isStringRecord(value.env)
      ? Object.fromEntries(Object.entries(value.env).map(([key, item]) => [key, interpolate(item, workspaceRoot)]))
      : undefined;
    return {
      name: name.trim(),
      transport: 'stdio',
      command,
      ...(args ? { args } : {}),
      ...(cwd ? { cwd } : {}),
      ...(env ? { env } : {}),
      ...(timeoutMs ? { timeoutMs } : {}),
    };
  }
  return undefined;
}

function parseTimeout(value: Record<string, unknown>): number | undefined {
  const raw = value.timeoutMs ?? value.timeout;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return Math.max(1, Math.floor(raw));
}

function interpolate(value: string, workspaceRoot?: string): string {
  if (!workspaceRoot || !value) return value;
  return value.replaceAll('${workspaceFolder}', workspaceRoot);
}

function joinPath(root: string, relativePath: string): string {
  const sep = root.includes('\\') ? '\\' : '/';
  return `${root.replace(/[\\/]+$/, '')}${sep}${relativePath.replaceAll('/', sep)}`;
}

async function defaultReadFile(filePath: string, encoding: 'utf8'): Promise<string> {
  const { promises: fs } = await import('node:fs');
  return fs.readFile(filePath, encoding);
}

function isMissingFileError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'ENOENT';
}

function hash8(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}
