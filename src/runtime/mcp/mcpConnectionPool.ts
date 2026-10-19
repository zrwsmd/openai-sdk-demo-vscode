import type { FunctionTool, MCPServer } from '@openai/agents';
import type { ToolPolicy, ToolPolicyContext } from '../../tools/toolContract';
import type { AgentConfig } from '../agentConfig';
import { hashContent } from '../contentHash';
import { isMcpServerEnabled, type McpServerConfig, type McpSettings } from './mcpConfig';
import {
  buildCachedMcpTools,
  buildMcpTools,
  openMcpServerConnection,
  type McpServerConnection,
} from './mcpSession';
import {
  cachedToolsByServer,
  mcpServerFingerprint,
  readMcpToolCache,
  writeMcpToolCache,
  type McpCachedTool,
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

/**
 * 空租约：这一轮压根不需要 MCP 工具时用它。
 *
 * 形状跟真租约一样（工具空、名字空、归还是空操作），调用方不用到处判空，
 * 也就不会因为"这次没连"而在别处多出一个分支。
 */
export const EMPTY_MCP_SESSION_LEASE: McpSessionLease = {
  tools: [],
  toolNames: [],
  release: () => undefined,
};

export interface AcquireMcpSessionOptions {
  settings: McpSettings | undefined;
  /** Optional semantic selection. Omitted means all enabled servers; [] means none. */
  serverNames?: readonly string[];
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
  connection: McpServerConnection;
  serverName: string;
  scopeKey: string;
  leases: number;
  stale?: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * 按配置复用 MCP 连接。**每台服务器一条**。
 *
 * 拆到单台有三个好处：某台工具调用出错只丢这一台；改一台的配置只让这一台重连；
 * 一台起不来也不牵动其余几台。
 *
 * 复用只发生在"同一份配置"之内：服务器增删、命令或参数变化、工作区变化，
 * 都会算出不同的键，对应的那台直接丢弃重连。
 */
export class McpConnectionPool {
  private readonly entries = new Map<string, PoolEntry>();
  private readonly pending = new Map<string, Promise<McpServerConnection | undefined>>();
  private readonly idleTimeoutMs: number;
  private readonly log: (line: string) => void;
  private disposed = false;
  /** 清单落盘的排队口，见 rememberToolLists。 */
  private cacheWrite: Promise<void> = Promise.resolve();

  constructor(options: McpConnectionPoolOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_MCP_IDLE_TIMEOUT_MS;
    this.log = options.log ?? (() => undefined);
  }

  /**
   * 借一组连接：按配置顺序逐台取（热的复用，冷的现连）。
   * 工具对象每轮重新包装，审批上下文和效果台账因此仍然绑定在当前这一轮上。
   */
  async acquire(options: AcquireMcpSessionOptions): Promise<McpSessionLease> {
    const configuredServers = options.settings?.enabled
      ? options.settings.servers.filter(isMcpServerEnabled)
      : [];
    const selectedNames = options.serverNames === undefined
      ? undefined
      : new Set(options.serverNames);
    const servers = selectedNames === undefined
      ? configuredServers
      : configuredServers.filter((server) => selectedNames.has(server.name));
    const scopeKey = mcpScopeKey(options);
    this.retireMissingEntries(scopeKey, new Set(configuredServers.map((server) => server.name)));
    if (!servers.length) return EMPTY_MCP_SESSION_LEASE;

    // 跨服务器的重名占位。按配置顺序逐台过：前面接受的名字让后面避让，
    // 复用的那台也要把它上次占住的名字重新加回来。
    const reserved = new Set(options.reservedToolNames ?? []);
    const keys: string[] = [];
    const connections: McpServerConnection[] = [];
    const failedServers: McpServerConfig[] = [];
    for (const server of servers) {
      const key = mcpServerKey(server, options);
      const connection = await this.connectionFor(key, server, reserved, scopeKey);
      if (!connection) {
        failedServers.push(server);
        continue;
      }
      keys.push(key);
      connections.push(connection);
    }

    // 借出去的期间不回收：先把空闲计时清掉，归还时再重新起算。
    for (const key of keys) {
      const entry = this.entries.get(key);
      if (entry) {
        this.clearTimer(entry);
        entry.leases += 1;
      }
    }

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      for (const key of keys) this.release(key);
    };
    try {
      await this.rememberToolLists(options, connections.map((connection) => connection.toolList));
      // 逐台包工具，这样某台调用出错时能精确丢掉那一台，不误伤别的服务器。
      const liveTools = connections.flatMap((connection, index) => buildMcpTools([connection], {
        policy: options.policy,
        policyContext: options.policyContext,
        executeEffect: options.executeEffect,
        onInvocationError: (error) => {
          this.log(
            `[mcp] ${connection.serverName} 工具调用失败，丢弃这台连接以便下次重连: ${error instanceof Error ? error.message : String(error)}`,
          );
          void this.drop(keys[index]);
        },
      }));
      const cachedByServer = cachedToolsByServer(
        await readMcpToolCache(options.policyContext.workspaceRoot),
        options.settings,
      );
      const cachedTools = failedServers.flatMap((server) => {
        const cached = cachedByServer.get(server.name) ?? [];
        const available = cached.filter((tool) => tool.definition && !reserved.has(tool.name));
        for (const tool of available) reserved.add(tool.name);
        if (!available.length) return [];
        const invoke = async (
          toolName: string,
          args: Parameters<MCPServer['callTool']>[1],
          meta?: Parameters<MCPServer['callTool']>[2],
          callOptions?: Parameters<MCPServer['callTool']>[3],
        ) => {
          const cachedTool = available.find((tool) => tool.definition?.name === toolName);
          if (!cachedTool) {
            throw new Error(`缓存的 MCP 工具 ${server.name}.${toolName} 已不存在`);
          }
          return this.invokeCachedMcpTool(
            server,
            cachedTool.name,
            toolName,
            args,
            meta,
            callOptions,
            options,
          );
        };
        return buildCachedMcpTools(available, {
          serverName: server.name,
          policy: options.policy,
          policyContext: options.policyContext,
          executeEffect: options.executeEffect,
          invoke,
          log: this.log,
          onInvocationError: (error) => {
            this.log(
              `[mcp] ${server.name} 缓存工具调用失败，丢弃这台连接以便下次重连: ${error instanceof Error ? error.message : String(error)}`,
            );
            void this.drop(mcpServerKey(server, options));
          },
        });
      });
      const toolNames = await this.toolNamesFor(options, connections, cachedByServer);
      return { tools: [...liveTools, ...cachedTools], toolNames, release };
    } catch (error) {
      // 借连接后任何一步失败都必须归还，否则清掉的 idle timer 永远不会恢复。
      release();
      throw error;
    }
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
    connections: readonly McpServerConnection[],
    cachedByServer: Map<string, McpCachedTool[]>,
  ): Promise<string[]> {
    const names = connections.flatMap((connection) => connection.tools.map((entry) => entry.name));
    const live = new Set(connections.map((connection) => connection.serverName));
    for (const [serverName, cached] of cachedByServer) {
      if (options.serverNames !== undefined && !options.serverNames.includes(serverName)) continue;
      if (live.has(serverName)) continue;
      this.log(`[mcp] ${serverName} 本次没连上，用缓存里的 ${cached.length} 个工具名兜底`);
      names.push(...cached.map((tool) => tool.name));
    }
    return names;
  }

  /**
   * 缓存工具的真正执行路径：借一条实时连接，验证缓存工具仍在清单里，
   * 直接调用 MCP server，最后按普通租约规则归还。调用失败由外层包装丢弃连接。
   */
  private async invokeCachedMcpTool(
    server: McpServerConfig,
    exposedToolName: string,
    rawToolName: string,
    args: Parameters<MCPServer['callTool']>[1],
    meta: Parameters<MCPServer['callTool']>[2] | undefined,
    callOptions: Parameters<MCPServer['callTool']>[3] | undefined,
    options: AcquireMcpSessionOptions,
  ): Promise<Awaited<ReturnType<MCPServer['callTool']>>> {
    const key = mcpServerKey(server, options);
    const scopeKey = mcpScopeKey(options);
    const reserved = new Set(options.reservedToolNames ?? []);
    const connection = await this.connectionFor(key, server, reserved, scopeKey);
    if (!connection) {
      throw new Error(`MCP 服务器 ${server.name} 当前无法连接，缓存工具 ${exposedToolName} 暂时不可用`);
    }
    const entry = this.entries.get(key);
    if (entry) {
      this.clearTimer(entry);
      entry.leases += 1;
    }
    try {
      await this.rememberToolLists(options, [connection.toolList]);
      const liveTool = connection.tools.find((tool) => (
        tool.name === exposedToolName && tool.definition.name === rawToolName
      ));
      if (!liveTool) {
        throw new Error(`MCP 服务器 ${server.name} 已不再提供缓存工具 ${exposedToolName}`);
      }
      return await connection.server.callTool(liveTool.definition.name, args, meta, callOptions);
    } finally {
      if (entry) {
        this.release(key);
      } else {
        try {
          await connection.server.close();
        } catch {
          // 连接池已销毁时没有 entry，临时连接也要尽力收掉。
        }
      }
    }
  }

  /**
   * 把这次真拿到的清单落盘。写不进去只记一行，不影响这一轮。
   *
   * 写是"读旧文件、改、再写回"，所以必须排队：两轮同时写的话，后写的那份
   * 手里拿的是没包含对方的旧内容，会把对方刚补上的服务器一起盖掉。
   */
  private rememberToolLists(
    options: AcquireMcpSessionOptions,
    lists: readonly McpServerToolList[],
  ): Promise<void> {
    if (!lists.length) return Promise.resolve();
    this.cacheWrite = this.cacheWrite
      .then(() => writeMcpToolCache(options.policyContext.workspaceRoot, lists))
      .catch((error: unknown) => {
        this.log(`[mcp] 工具清单缓存写入失败: ${error instanceof Error ? error.message : String(error)}`);
      });
    return this.cacheWrite;
  }

  private async connectionFor(
    key: string,
    server: McpServerConfig,
    reserved: Set<string>,
    scopeKey: string,
  ): Promise<McpServerConnection | undefined> {
    // 同名服务换了配置时，旧连接不能一直留到 idle timeout。正在使用的旧租约
    // 先标为过期，等归还后立即关闭；空闲的直接回收。
    this.retireObsoleteEntries(key, server.name, scopeKey);
    const existing = this.entries.get(key);
    if (existing) {
      // 复用的那台：它上次占住的名字要重新占位，后面的服务器才不会撞名。
      for (const tool of existing.connection.tools) reserved.add(tool.name);
      return existing.connection;
    }
    const inflight = this.pending.get(key);
    if (inflight) {
      const connection = await inflight;
      if (connection) for (const tool of connection.tools) reserved.add(tool.name);
      return connection;
    }
    const promise = openMcpServerConnection(server, reserved, this.log)
      .then((connection) => {
        if (this.disposed) {
          void connection.server.close();
          return connection;
        }
        this.entries.set(key, {
          connection,
          serverName: server.name,
          scopeKey,
          leases: 0,
        });
        return connection;
      })
      .catch((error: unknown) => {
        // 一台连不上只影响这一台：其余服务器照常，已经热的那些也不受影响。
        this.log(
          `[mcp] 连接 ${server.name} 失败: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
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

  private release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.leases = Math.max(0, entry.leases - 1);
    if (entry.stale && entry.leases === 0) {
      void this.drop(key);
      return;
    }
    this.touch(key);
  }

  private retireObsoleteEntries(activeKey: string, serverName: string, scopeKey: string): void {
    for (const [key, entry] of this.entries) {
      if (
        key === activeKey
        || entry.serverName !== serverName
        || entry.scopeKey !== scopeKey
      ) continue;
      entry.stale = true;
      this.clearTimer(entry);
      if (entry.leases === 0) void this.drop(key);
    }
  }

  private retireMissingEntries(scopeKey: string, activeNames: ReadonlySet<string>): void {
    // `activeNames` deliberately contains every enabled configured server,
    // rather than only this round's semantic selection. A server not selected
    // for one run is still configured and may be selected by the next run;
    // only removal/disablement should retire its pooled connection.
    for (const [key, entry] of this.entries) {
      if (entry.scopeKey !== scopeKey || activeNames.has(entry.serverName)) continue;
      entry.stale = true;
      this.clearTimer(entry);
      if (entry.leases === 0) void this.drop(key);
    }
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
      await entry.connection.server.close();
    } catch {
      // 回收失败不能影响调用方。
    }
  }
}

/**
 * 单台服务器的复用键。
 *
 * 只算"会影响这台怎么连"的东西：这台自己的配置指纹、工作区根、保留工具名。
 * 键按台算，所以改一台的配置只让这一台重连，其余照旧热着。
 */
function mcpServerKey(
  server: McpServerConfig,
  options: AcquireMcpSessionOptions,
): string {
  return hashContent(JSON.stringify({
    fingerprint: mcpServerFingerprint(server),
    timeoutMs: server.timeoutMs ?? null,
    roots: options.policyContext.workspaceRoots ?? [options.policyContext.workspaceRoot],
    reserved: options.reservedToolNames ?? [],
  }));
}

function mcpScopeKey(options: AcquireMcpSessionOptions): string {
  return hashContent(JSON.stringify(
    options.policyContext.workspaceRoots ?? [options.policyContext.workspaceRoot],
  ));
}
