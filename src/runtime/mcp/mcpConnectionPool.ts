import type { FunctionTool } from '@openai/agents';
import type { ToolPolicy, ToolPolicyContext } from '../../tools/toolContract';
import type { AgentConfig } from '../agentConfig';
import { hashContent } from '../contentHash';
import { isMcpServerEnabled, type McpSettings } from './mcpConfig';
import { buildMcpTools, openMcpConnection, type McpConnection } from './mcpSession';
import {
  cachedToolsByServer,
  readMcpToolCache,
  writeMcpToolCache,
  type McpServerToolList,
} from './mcpToolCache';

/**
 * 连接空闲多久后回收。
 *
 * 复用连接是为了让冷启动只付一次，但一个一直开着的服务器进程会长期占着内存，
 * 所以闲置一段时间后主动断掉，下次要用时再连。取值参考主流客户端对本地
 * stdio 服务器给出的空闲窗口。
 */
export const DEFAULT_MCP_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export interface McpSessionLease {
  readonly tools: readonly FunctionTool<any, any, any>[];
  /**
   * 这一轮"有哪些 MCP 工具"的名字：本次连上的取真清单，
   * 本次没连上的服务器用缓存里那份补。名单因此不再吊在连接上。
   */
  readonly toolNames: readonly string[];
  /** 本轮用完归还：连接留在池里，只重置空闲计时。 */
  release(): void;
}

export interface AcquireMcpSessionOptions {
  settings: McpSettings | undefined;
  reservedToolNames?: readonly string[];
  policy?: ToolPolicy;
  policyContext: ToolPolicyContext;
  executeEffect?: AgentConfig['executeEffect'];
}

export interface McpConnectionPoolOptions {
  idleTimeoutMs?: number;
  log?: (line: string) => void;
}

interface PoolEntry {
  connection: McpConnection;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * 按配置复用 MCP 连接。
 *
 * 复用只发生在"同一份配置"之内：服务器增删、命令或参数变化、工作区变化，
 * 都会算出不同的键，旧连接直接丢弃重连。
 */
export class McpConnectionPool {
  private readonly entries = new Map<string, PoolEntry>();
  private readonly pending = new Map<string, Promise<McpConnection>>();
  private readonly idleTimeoutMs: number;
  private readonly log: (line: string) => void;
  private disposed = false;

  constructor(options: McpConnectionPoolOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_MCP_IDLE_TIMEOUT_MS;
    this.log = options.log ?? (() => undefined);
  }

  /**
   * 借一条连接。工具对象每轮重新包装，审批上下文和效果台账因此仍然绑定在当前这一轮上。
   */
  async acquire(options: AcquireMcpSessionOptions): Promise<McpSessionLease> {
    const key = mcpConnectionKey(options);
    if (!key) return { tools: [], toolNames: [], release: () => undefined };
    const connection = await this.connectionFor(key, options);
    const entry = this.entries.get(key);
    if (entry) this.clearTimer(entry);
    void this.rememberToolLists(options, connection.toolLists);
    const tools = buildMcpTools(connection, {
      policy: options.policy,
      policyContext: options.policyContext,
      executeEffect: options.executeEffect,
      onInvocationError: (error) => {
        this.log(
          `[mcp] 工具调用失败，丢弃连接以便下次重连: ${error instanceof Error ? error.message : String(error)}`,
        );
        void this.drop(key);
      },
    });
    const toolNames = await this.toolNamesFor(options, connection);
    return { tools, toolNames, release: () => this.touch(key) };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const keys = [...this.entries.keys()];
    await Promise.all(keys.map(async (key) => this.drop(key)));
  }

  /**
   * 这一轮"有哪些 MCP 工具"的名字。
   *
   * 本次连上的服务器取真清单；本次没连上的（服务器挂了、超时了），
   * 用缓存里那份补上。补的意义是让名单不再依赖"这次一定连得上"——
   * 将来改成按需连接时，名字也有出处。
   */
  private async toolNamesFor(
    options: AcquireMcpSessionOptions,
    connection: McpConnection,
  ): Promise<string[]> {
    const names = connection.tools.map((entry) => entry.name);
    const live = new Set(connection.toolLists.map((list) => list.serverName));
    const cache = await readMcpToolCache(options.policyContext.workspaceRoot);
    for (const [serverName, cached] of cachedToolsByServer(cache, options.settings)) {
      if (live.has(serverName)) continue;
      this.log(`[mcp] ${serverName} 本次没连上，用缓存里的 ${cached.length} 个工具名兜底`);
      names.push(...cached.map((tool) => tool.name));
    }
    return names;
  }

  /** 把这次真拿到的清单落盘。写不进去只记一行，不影响这一轮。 */
  private async rememberToolLists(
    options: AcquireMcpSessionOptions,
    lists: readonly McpServerToolList[],
  ): Promise<void> {
    if (!lists.length) return;
    try {
      await writeMcpToolCache(options.policyContext.workspaceRoot, lists);
    } catch (error) {
      this.log(`[mcp] 工具清单缓存写入失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async connectionFor(
    key: string,
    options: AcquireMcpSessionOptions,
  ): Promise<McpConnection> {
    const existing = this.entries.get(key);
    if (existing) return existing.connection;
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    const promise = openMcpConnection({
      settings: options.settings,
      reservedToolNames: options.reservedToolNames,
      log: this.log,
    })
      .then((connection) => {
        if (this.disposed) {
          void connection.close();
          return connection;
        }
        this.entries.set(key, { connection });
        return connection;
      })
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }

  private touch(key: string): void {
    const entry = this.entries.get(key);
    if (!entry || this.disposed) return;
    this.clearTimer(entry);
    const minutes = Math.round(this.idleTimeoutMs / 60_000);
    entry.timer = setTimeout(() => {
      this.log(`[mcp] 连接空闲 ${minutes} 分钟，回收`);
      void this.drop(key);
    }, this.idleTimeoutMs);
    entry.timer.unref?.();
  }

  private clearTimer(entry: PoolEntry): void {
    if (!entry.timer) return;
    clearTimeout(entry.timer);
    entry.timer = undefined;
  }

  private async drop(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.clearTimer(entry);
    try {
      await entry.connection.close();
    } catch {
      // 回收失败不能影响调用方。
    }
  }
}

function mcpConnectionKey(options: AcquireMcpSessionOptions): string | undefined {
  const settings = options.settings;
  if (!settings?.enabled) return undefined;
  const servers = settings.servers.filter(isMcpServerEnabled);
  if (servers.length === 0) return undefined;
  return hashContent(JSON.stringify({
    servers: servers.map((server) => server.transport === 'http'
      ? {
        name: server.name,
        transport: server.transport,
        url: server.url,
        timeoutMs: server.timeoutMs ?? null,
      }
      : {
        name: server.name,
        transport: server.transport,
        command: server.command,
        args: server.args ?? [],
        cwd: server.cwd ?? '',
        env: server.env ?? {},
        timeoutMs: server.timeoutMs ?? null,
      }),
    roots: options.policyContext.workspaceRoots ?? [options.policyContext.workspaceRoot],
    reserved: options.reservedToolNames ?? [],
  }));
}
