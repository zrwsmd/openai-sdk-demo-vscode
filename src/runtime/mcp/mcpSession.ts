import {
  MCPServerStdio,
  MCPServerStreamableHttp,
  mcpToFunctionTool,
  type FunctionTool,
  type MCPServer,
  type Tool,
} from '@openai/agents';
import {
  DefaultToolPolicy,
  toolResult,
  type ToolPolicy,
  type ToolPolicyContext,
} from '../../tools/toolContract';
import type { AgentConfig } from '../agentConfig';
import {
  mcpFunctionToolName,
  isMcpServerEnabled,
  type McpServerConfig,
  type McpSettings,
} from './mcpConfig';
import {
  cachedMcpToolFromDefinition,
  MAX_CACHED_TOOL_SCHEMA_CHARS,
  mcpServerFingerprint,
  type McpCachedTool,
  type McpServerToolList,
} from './mcpToolCache';

export interface McpSession {
  readonly tools: readonly FunctionTool<any, any, any>[];
  close(): Promise<void>;
}

export type McpProbeStatus = 'connected' | 'disabled' | 'error';

export interface McpProbeResult {
  name: string;
  status: McpProbeStatus;
  error?: string;
  toolCount?: number;
}

export interface OpenMcpSessionOptions {
  settings: McpSettings | undefined;
  reservedToolNames?: readonly string[];
  policy?: ToolPolicy;
  policyContext: ToolPolicyContext;
  executeEffect?: AgentConfig['executeEffect'];
  log?: (line: string) => void;
}

/** `listTools()` 返回的单条工具定义。 */
type McpToolDefinition = Awaited<ReturnType<MCPServer['listTools']>>[number];
type McpCallToolOptions = Parameters<MCPServer['callTool']>[3];
type McpCallToolMeta = Parameters<MCPServer['callTool']>[2];
type McpCallToolArgs = Parameters<MCPServer['callTool']>[1];
type McpCallToolResult = Awaited<ReturnType<MCPServer['callTool']>>;

export interface McpConnectedTool {
  /** 暴露给模型的工具名，形如 mcp_<server>_<tool>。 */
  readonly name: string;
  readonly serverName: string;
  readonly server: MCPServer;
  readonly definition: McpToolDefinition;
}

/**
 * 一台服务器连上之后的样子。
 *
 * 连接池是按"每台一条"管的，所以这里是单台的单位。拆到单台有两个直接好处：
 * 某台调用出错只丢这一台；改一台的配置也只让这一台重连。
 */
export interface McpServerConnection {
  readonly serverName: string;
  readonly server: MCPServer;
  /** 这台这次被接受暴露的工具（跨服务器重名被跳过的那些不在里面）。 */
  readonly tools: readonly McpConnectedTool[];
  /**
   * 这台的清单（工具名用的是发出去的那个名字）。调用方拿去落盘，
   * 下次这台连不上时仍然知道它有哪些工具。
   */
  readonly toolList: McpServerToolList;
}

/**
 * 连上一台服务器并取回它的工具清单，不包装工具。
 *
 * 与工具包装拆开，是为了让连接能跨轮复用：连接和清单与轮次无关，
 * 而工具对象要绑定本轮的策略上下文、审批和效果台账，必须每轮重造。
 *
 * `reserved` 是跨服务器的重名占位：被接受的名字会加进这个集合，
 * 交给后面几台避让。连不上就抛，由调用方决定是记一行跳过（单轮用法）
 * 还是当成"这台没连上"（连接池）。
 */
export async function openMcpServerConnection(
  spec: McpServerConfig,
  reserved: Set<string>,
  log: (line: string) => void = () => undefined,
): Promise<McpServerConnection> {
  const server = createMcpServer(spec);
  try {
    await server.connect();
    const listed = await server.listTools();
    const tools: McpConnectedTool[] = [];
    const accepted: McpCachedTool[] = [];
    for (const mcpTool of listed) {
      const name = mcpFunctionToolName(spec.name, mcpTool.name);
      if (reserved.has(name)) {
        log(`[mcp] 跳过重名工具 ${name}`);
        continue;
      }
      reserved.add(name);
      tools.push({ name, serverName: spec.name, server, definition: mcpTool });
      const cachedTool = cachedMcpToolFromDefinition(name, mcpTool);
      if (!cachedTool.definition) {
        log(
          `[mcp] ${name} 的 inputSchema 超过 ${MAX_CACHED_TOOL_SCHEMA_CHARS} 字符，只缓存名字，不做懒加载`,
        );
      }
      accepted.push(cachedTool);
    }
    log(`[mcp] 已连接 ${spec.name}(${spec.transport})，工具 ${listed.length} 个`);
    return {
      serverName: spec.name,
      server,
      tools,
      toolList: {
        serverName: spec.name,
        fingerprint: mcpServerFingerprint(spec),
        fetchedAt: new Date().toISOString(),
        tools: accepted,
      },
    };
  } catch (error) {
    // 连上了但取清单失败也要收干净，否则会留下一个没人管的进程。
    try {
      await server.close();
    } catch {
      // 本来就没连上，收尾失败无所谓。
    }
    throw error;
  }
}

export interface BuildMcpToolsOptions {
  policy?: ToolPolicy;
  policyContext: ToolPolicyContext;
  executeEffect?: AgentConfig['executeEffect'];
  /** 调用抛错时回调，供连接池判定这条连接已不可用。 */
  onInvocationError?: (error: unknown) => void;
}

export interface BuildCachedMcpToolsOptions extends BuildMcpToolsOptions {
  /** 仅用于标记工具来源和构造懒连接代理的 server.name。 */
  serverName: string;
  /**
   * 缓存工具真正被调用时才执行。回调负责按需拿到连接并调用原始 MCP 工具；
   * 这里的代理只负责让 Agents SDK 继续使用同一套 schema/result 转换。
   */
  invoke: (
    toolName: string,
    args: McpCallToolArgs,
    meta?: McpCallToolMeta,
    options?: McpCallToolOptions,
  ) => Promise<McpCallToolResult>;
  /** 转换失败时的诊断出口；不传就静默跳过。 */
  log?: (line: string) => void;
}

export function buildMcpTools(
  connections: readonly McpServerConnection[],
  options: BuildMcpToolsOptions,
): FunctionTool<any, any, any>[] {
  const policy = options.policy ?? new DefaultToolPolicy();
  return connections.flatMap((connection) => connection.tools.map((entry) => {
    const fnTool = mcpToFunctionTool(entry.definition, entry.server, false, {
      toolNameOverride: entry.name,
    });
    return wrapMcpFunctionTool(fnTool, {
      serverName: entry.serverName,
      policy,
      policyContext: options.policyContext,
      executeEffect: options.executeEffect,
      onInvocationError: options.onInvocationError,
    });
  }));
}

/**
 * 用缓存里的 MCP 定义生成可展示的 FunctionTool，但不在构造阶段连接服务器。
 * `mcpToFunctionTool` 接收到的是一个只实现调用转发的轻量代理；真正的连接时机
 * 由 `invoke` 回调决定，因此缓存只负责 schema，连接池仍负责生命周期和回收。
 */
export function buildCachedMcpTools(
  cachedTools: readonly McpCachedTool[],
  options: BuildCachedMcpToolsOptions,
): FunctionTool<any, any, any>[] {
  const lazyServer = {
    cacheToolsList: false,
    name: options.serverName,
    connect: async () => undefined,
    close: async () => undefined,
    listTools: async () => [],
    callTool: options.invoke,
    invalidateToolsCache: async () => undefined,
  } as unknown as MCPServer;
  const policy = options.policy ?? new DefaultToolPolicy();
  return cachedTools.flatMap((cached) => {
    if (!cached.definition) return [];
    try {
      const fnTool = mcpToFunctionTool(cached.definition as McpToolDefinition, lazyServer, false, {
        toolNameOverride: cached.name,
      });
      return [wrapMcpFunctionTool(fnTool, {
        serverName: options.serverName,
        policy,
        policyContext: options.policyContext,
        executeEffect: options.executeEffect,
        onInvocationError: options.onInvocationError,
      })];
    } catch (error) {
      // 缓存是加速层：旧版本或损坏 schema 不能拖挂整轮 acquire。但静默跳过会让
      // "这台服务器为什么没有懒加载工具"变成悬案，所以留一行。
      options.log?.(
        `[mcp] 缓存工具 ${cached.name} 的定义无法转换为 FunctionTool，已跳过: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  });
}

/** 单轮用法：连上所有服务器、包装、用完关闭。跨轮复用走连接池。 */
export async function openMcpSession(options: OpenMcpSessionOptions): Promise<McpSession> {
  const settings = options.settings;
  const log = options.log ?? (() => undefined);
  const reserved = new Set(options.reservedToolNames ?? []);
  const connections: McpServerConnection[] = [];
  const specs = settings?.enabled ? settings.servers.filter(isMcpServerEnabled) : [];
  for (const spec of specs) {
    try {
      connections.push(await openMcpServerConnection(spec, reserved, log));
    } catch (error) {
      log(`[mcp] 连接 ${spec.name} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    tools: buildMcpTools(connections, options),
    close: async () => {
      await Promise.all(connections.map(async (connection) => {
        try {
          await connection.server.close();
        } catch {
          // 收尾失败不影响调用方：这一轮已经跑完了。
        }
      }));
    },
  };
}

export async function probeMcpServer(spec: McpServerConfig): Promise<McpProbeResult> {
  if (!isMcpServerEnabled(spec)) {
    return { name: spec.name, status: 'disabled' };
  }
  const timeoutMs = spec.timeoutMs ?? 15_000;
  const server = createMcpServer(spec);
  try {
    await withTimeout(server.connect(), timeoutMs, `连接 ${spec.name}`);
    const listed = await withTimeout(server.listTools(), timeoutMs, `列出 ${spec.name} 工具`);
    return {
      name: spec.name,
      status: 'connected',
      toolCount: listed.length,
    };
  } catch (error) {
    return {
      name: spec.name,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      await server.close();
    } catch {
      // Ignore teardown failures after a probe.
    }
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 超时(${timeoutMs}ms)`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function wrapMcpFunctionTool(
  fnTool: FunctionTool<any, any, any>,
  options: {
    serverName: string;
    policy: ToolPolicy;
    policyContext: ToolPolicyContext;
    executeEffect?: AgentConfig['executeEffect'];
    onInvocationError?: (error: unknown) => void;
  },
): FunctionTool<any, any, any> {
  const originalInvoke = fnTool.invoke.bind(fnTool);
  return {
    ...fnTool,
    description:
      `${fnTool.description || fnTool.name} (MCP:${options.serverName}; 默认高风险，执行前需批准)`,
    needsApproval: async () => true,
    invoke: async (runContext, input, details) => {
      let parsed: unknown = input;
      if (typeof input === 'string') {
        try {
          parsed = JSON.parse(input);
        } catch {
          parsed = { raw: input };
        }
      }
      const decision = options.policy.evaluate(fnTool.name, parsed, options.policyContext);
      if (!decision.allowed) {
        return toolResult({
          ok: false,
          error: decision.reason ?? 'MCP 工具被策略拒绝。',
          effect: 'none',
          risk: 'execute',
        });
      }
      // 只把真正调用 MCP server 的失败视为连接故障。策略、效果台账或恢复
      // 流程本身抛错时，server 可能完全健康，不应因此被连接池丢弃。
      const run = async () => {
        try {
          return await originalInvoke(runContext, input, details);
        } catch (error) {
          options.onInvocationError?.(error);
          throw error;
        }
      };
      return await (options.executeEffect
        ? options.executeEffect(fnTool.name, parsed, run)
        : run());
    },
  };
}

function createMcpServer(spec: McpServerConfig): MCPServer {
  if (spec.transport === 'http') {
    return new MCPServerStreamableHttp({
      name: spec.name,
      url: spec.url,
      timeout: spec.timeoutMs,
    });
  }
  return new MCPServerStdio({
    name: spec.name,
    command: spec.command,
    args: spec.args,
    env: spec.env,
    cwd: spec.cwd,
    timeout: spec.timeoutMs,
  });
}

export function isFunctionTool(tool: Tool): tool is FunctionTool {
  return !!tool && typeof tool === 'object' && (tool as { type?: unknown }).type === 'function';
}
