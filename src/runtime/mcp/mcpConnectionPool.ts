import type { FunctionTool } from '@openai/agents';
import type { ToolPolicy, ToolPolicyContext } from '../../tools/toolContract';
import type { AgentConfig } from '../agentConfig';
import { hashContent } from '../contentHash';
import { isMcpServerEnabled, type McpServerConfig, type McpSettings } from './mcpConfig';
import { buildMcpTools, openMcpServerConnection, type McpServerConnection } from './mcpSession';
import {
  cachedToolsByServer,
  mcpServerFingerprint,
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
  connection: McpServerConnection;
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
    const servers = options.settings?.enabled
      ? options.settings.servers.filter(isMcpServerEnabled)
      : [];
    if (!servers.length) return { tools: [], toolNames: [], release: () => undefined };

    // 跨服务器的重名占位。按配置顺序逐台过：前面接受的名字让后面避让，
    // 复用的那台也要把它上次占住的名字重新加回来。
    const reserved = new Set(options.reservedToolNames ?? []);
    const keys: string[] = [];
    const connections: McpServerConnection[] = [];
    for (const server of servers) {
      const key = mcpServerKey(server, options);
      const connection = await this.connectionFor(key, server, reserved);
      if (!connection) continue;
      keys.push(key);
      connections.push(connection);
    }

    // 借出去的期间不回收：先把空闲计时清掉，归还时再重新起算。
    for (const key of keys) {
      const entry = this.entries.get(key);
      if (entry) this.clearTimer(entry);
    }

    await this.rememberToolLists(options, connections.map((connection) => connection.toolList));
    // 逐台包工具，这样某台调用出错时能精确丢掉那一台，不误伤别的服务器。
    const tools = connections.flatMap((connection, index) => buildMcpTools([connection], {
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
    const toolNames = await this.toolNamesFor(options, connections);
    return {
      tools,
      toolNames,
      release: () => {
        for (const key of keys) this.touch(key);
      },
    };
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
  ): Promise<string[]> {
    const names = connections.flatMap((connection) => connection.tools.map((entry) => entry.name));
    const live = new Set(connections.map((connection) => connection.serverName));
    const cache = await readMcpToolCache(options.policyContext.workspaceRoot);
    for (const [serverName, cached] of cachedToolsByServer(cache, options.settings)) {
      if (live.has(serverName)) continue;
      this.log(`[mcp] ${serverName} 本次没连上，用缓存里的 ${cached.length} 个工具名兜底`);
      names.push(...cached.map((tool) => tool.name));
    }
    return names;
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
  ): Promise<McpServerConnection | undefined> {
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
        this.entries.set(key, { connection });
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
    roots: options.policyContext.workspaceRoots ?? [options.policyContext.workspaceRoot],
    reserved: options.reservedToolNames ?? [],
  }));
}
