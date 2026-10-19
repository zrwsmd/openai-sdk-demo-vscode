import { hashContent } from '../contentHash';
import { isMcpServerEnabled, type McpServerConfig, type McpSettings } from './mcpConfig';

/**
 * MCP 工具清单缓存，跟 mcp.json 放在同一个目录。
 *
 * 记的是"上次真连上时，这个服务器给了哪些工具及其可序列化定义"，不是配置本身。
 * 存在的意义只有一个：让"这一轮有哪些 MCP 工具"这件事不必先连上才知道，
 * 于是可见性不再吊在连接上——服务器暂时连不上、或者将来改成按需连接，
 * 工具名单仍然拿得到。
 */
export const MCP_TOOL_CACHE_RELATIVE_PATH = '.plc-agent/mcp-tools-cache.json';

/**
 * 单个工具 schema 的缓存上限（按序列化后的字符数计）。
 *
 * 缓存存在的意义是"连不上时也知道有哪些工具"，不是把整份工具文档抄一份。
 * 真实 MCP 的 inputSchema 通常几百字符，上到几 KB 已经很少见；超过这个量级的，
 * 多半是把别的东西一起塞了进来。超限就只留名字和描述——宁可这一条没有懒加载，
 * 也不让这个文件无限长大。
 */
export const MAX_CACHED_TOOL_SCHEMA_CHARS = 8 * 1024;

export interface McpCachedTool {
  /** 暴露给模型的工具名，形如 mcp_<server>_<tool>，跟实际发出去的名字一致。 */
  name: string;
  description?: string;
  /**
   * 上次清单里的可序列化 MCP 定义。它只描述工具，不包含连接或可执行代码；
   * 真正调用时仍会按服务器配置懒连接。
   */
  definition?: McpCachedToolDefinition;
}

export interface McpCachedToolDefinition {
  /** MCP server 原始工具名，调用 tools/call 时使用它。 */
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServerToolList {
  serverName: string;
  /**
   * 服务器配置指纹。命令、参数、工作目录、环境变量或地址变了，指纹就变，
   * 这份清单随即作废——宁可当没有，也不能拿旧清单当真。
   */
  fingerprint: string;
  /** 取到这份清单的时间(ISO 字符串)。 */
  fetchedAt: string;
  tools: McpCachedTool[];
}

export interface McpToolCache {
  version: 1;
  servers: Record<string, McpServerToolList>;
}

export function emptyMcpToolCache(): McpToolCache {
  return { version: 1, servers: {} };
}

/**
 * 单个服务器的配置指纹。只算会影响"它提供哪些工具"的字段，
 * 超时之类的调优参数不算在内。
 */
export function mcpServerFingerprint(server: McpServerConfig): string {
  const identity = server.transport === 'http'
    ? { transport: server.transport, url: server.url }
    : {
      transport: server.transport,
      command: server.command,
      args: server.args ?? [],
      cwd: server.cwd ?? '',
      env: server.env ?? {},
    };
  return hashContent(JSON.stringify(identity));
}

export function mcpToolCachePath(workspaceRoot: string): string {
  return joinPath(workspaceRoot.trim(), MCP_TOOL_CACHE_RELATIVE_PATH);
}

export function parseMcpToolCache(value: unknown): McpToolCache {
  if (!isRecord(value) || !isRecord(value.servers)) return emptyMcpToolCache();
  const servers: Record<string, McpServerToolList> = {};
  for (const [name, entry] of Object.entries(value.servers)) {
    const list = parseServerToolList(name, entry);
    if (list) servers[name] = list;
  }
  return { version: 1, servers };
}

/**
 * 读缓存。任何问题（文件不在、内容坏了、没工作区）都当成"没有缓存"：
 * 它只是加速和兜底，不该影响正常流程，更不该把主流程拖挂。
 */
export async function readMcpToolCache(workspaceRoot: string | undefined): Promise<McpToolCache> {
  const root = workspaceRoot?.trim();
  if (!root) return emptyMcpToolCache();
  try {
    const { promises: fs } = await import('node:fs');
    const raw = await fs.readFile(mcpToolCachePath(root), 'utf8');
    return parseMcpToolCache(JSON.parse(raw));
  } catch {
    return emptyMcpToolCache();
  }
}

/**
 * 把这次真连上拿到的清单写回缓存。
 *
 * 按服务器名合并：这次没连上的服务器，它上一份清单保留原样，
 * 不能因为这次没见到就把它抹掉——抹掉就等于把兜底也一起丢了。
 */
export async function writeMcpToolCache(
  workspaceRoot: string | undefined,
  lists: readonly McpServerToolList[],
): Promise<void> {
  const root = workspaceRoot?.trim();
  if (!root || !lists.length) return;
  const existing = await readMcpToolCache(root);
  const servers = { ...existing.servers };
  for (const list of lists) servers[list.serverName] = list;
  const document: McpToolCache = { version: 1, servers };
  const { promises: fs } = await import('node:fs');
  const filePath = mcpToolCachePath(root);
  const directory = parentDir(filePath);
  if (directory) await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

/**
 * 从缓存里取"当前配置下每个服务器该有哪些工具"。
 *
 * 只认三样都对的条目：服务器还开着、配置指纹没变、清单非空。
 * 调用方拿它去补"这次没连上的服务器"，所以返回的是按服务器名分好的表。
 */
export function cachedToolsByServer(
  cache: McpToolCache,
  settings: McpSettings | undefined,
): Map<string, McpCachedTool[]> {
  const result = new Map<string, McpCachedTool[]>();
  if (!settings?.enabled) return result;
  for (const server of settings.servers.filter(isMcpServerEnabled)) {
    const entry = cache.servers[server.name];
    if (!entry || !entry.tools.length) continue;
    if (entry.fingerprint !== mcpServerFingerprint(server)) continue;
    result.set(server.name, entry.tools);
  }
  return result;
}

function parseServerToolList(name: string, value: unknown): McpServerToolList | undefined {
  if (!isRecord(value)) return undefined;
  const fingerprint = typeof value.fingerprint === 'string' ? value.fingerprint : '';
  if (!fingerprint) return undefined;
  const tools = Array.isArray(value.tools)
    ? value.tools
      .map((item) => parseCachedTool(item))
      .filter((item): item is McpCachedTool => !!item)
    : [];
  return {
    serverName: typeof value.serverName === 'string' && value.serverName.trim()
      ? value.serverName.trim()
      : name,
    fingerprint,
    fetchedAt: typeof value.fetchedAt === 'string' ? value.fetchedAt : '',
    tools,
  };
}

function parseCachedTool(value: unknown): McpCachedTool | undefined {
  if (!isRecord(value)) return undefined;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) return undefined;
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const definition = parseCachedToolDefinition(value.definition);
  return {
    name,
    ...(description ? { description } : {}),
    ...(definition ? { definition } : {}),
  };
}

/**
 * 把 SDK 返回的 MCP 工具定义转成可落盘的最小定义。
 * MCP 的 schema 是 JSON 对象；这里保留原始 inputSchema，避免缓存只剩名字，
 * 同时不把 SDK/server 上的函数、连接状态或其它运行时对象写进文件。
 */
export function cachedMcpToolFromDefinition(
  exposedName: string,
  definition: {
    name: string;
    description?: string;
    inputSchema?: unknown;
  },
): McpCachedTool {
  const description = typeof definition.description === 'string'
    ? definition.description.trim()
    : '';
  const inputSchema = isRecord(definition.inputSchema)
    ? definition.inputSchema
    : { type: 'object', properties: {}, required: [] };
  const base = {
    name: exposedName,
    ...(description ? { description } : {}),
  };
  // 超限只留名字和描述：调用方据此知道这一条没有懒加载定义，也就不会为它造工具。
  if (!schemaWithinCacheBudget(inputSchema)) return base;
  return {
    ...base,
    definition: {
      name: definition.name,
      ...(description ? { description } : {}),
      inputSchema,
    },
  };
}

function parseCachedToolDefinition(value: unknown): McpCachedToolDefinition | undefined {
  if (!isRecord(value)) return undefined;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || !isRecord(value.inputSchema)) return undefined;
  // 旧缓存可能是放宽限制之前写的，读的时候按同一把尺子再过一遍。
  if (!schemaWithinCacheBudget(value.inputSchema)) return undefined;
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  return {
    name,
    ...(description ? { description } : {}),
    inputSchema: value.inputSchema,
  };
}

function schemaWithinCacheBudget(schema: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(schema).length <= MAX_CACHED_TOOL_SCHEMA_CHARS;
  } catch {
    // 循环引用之类序列化不了的东西，本来也没法落盘。
    return false;
  }
}

function joinPath(root: string, relativePath: string): string {
  const sep = root.includes('\\') ? '\\' : '/';
  return `${root.replace(/[\\/]+$/, '')}${sep}${relativePath.replaceAll('/', sep)}`;
}

function parentDir(filePath: string): string {
  const sep = filePath.includes('\\') ? '\\' : '/';
  const index = filePath.lastIndexOf(sep);
  return index > 0 ? filePath.slice(0, index) : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
