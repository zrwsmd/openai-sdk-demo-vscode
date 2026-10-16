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
import { mcpServerFingerprint, type McpCachedTool, type McpServerToolList } from './mcpToolCache';

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

export interface McpConnectedTool {
  /** 暴露给模型的工具名，形如 mcp_<server>_<tool>。 */
  readonly name: string;
  readonly serverName: string;
  readonly server: MCPServer;
  readonly definition: McpToolDefinition;
}

export interface McpConnection {
  readonly tools: readonly McpConnectedTool[];
  /**
   * 这次连上时每个服务器给出的工具清单（工具名用的是发出去的那个名字）。
   * 调用方拿去落盘，下次连接不在时仍然知道有哪些工具。
   */
  readonly toolLists: readonly McpServerToolList[];
  close(): Promise<void>;
}

export interface OpenMcpConnectionOptions {
  settings: McpSettings | undefined;
  reservedToolNames?: readonly string[];
  log?: (line: string) => void;
}

/**
 * 建立连接并取回工具清单，不包装工具。
 *
 * 与工具包装拆开，是为了让连接能跨轮复用：连接和清单与轮次无关，
 * 而工具对象要绑定本轮的策略上下文、审批和效果台账，必须每轮重造。
 */
export async function openMcpConnection(
  options: OpenMcpConnectionOptions,
): Promise<McpConnection> {
  const settings = options.settings;
  if (!settings?.enabled || settings.servers.length === 0) {
    return { tools: [], toolLists: [], close: async () => undefined };
  }
  const log = options.log ?? (() => undefined);
  const reserved = new Set(options.reservedToolNames ?? []);
  const servers: MCPServer[] = [];
  const tools: McpConnectedTool[] = [];
  const toolLists: McpServerToolList[] = [];

  for (const spec of settings.servers.filter(isMcpServerEnabled)) {
    try {
      const server = createMcpServer(spec);
      await server.connect();
      servers.push(server);
      const listed = await server.listTools();
      const accepted: McpCachedTool[] = [];
      for (const mcpTool of listed) {
        const name = mcpFunctionToolName(spec.name, mcpTool.name);
        if (reserved.has(name)) {
          log(`[mcp] 跳过重名工具 ${name}`);
          continue;
        }
        reserved.add(name);
        tools.push({ name, serverName: spec.name, server, definition: mcpTool });
        accepted.push(mcpTool.description ? { name, description: mcpTool.description } : { name });
      }
      toolLists.push({
        serverName: spec.name,
        fingerprint: mcpServerFingerprint(spec),
        fetchedAt: new Date().toISOString(),
        tools: accepted,
      });
      log(`[mcp] 已连接 ${spec.name}(${spec.transport})，工具 ${listed.length} 个`);
    } catch (error) {
      log(`[mcp] 连接 ${spec.name} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    tools,
    toolLists,
    close: async () => {
      await Promise.all(servers.map(async (server) => {
        try {
          await server.close();
        } catch {
          // Ignore teardown failures; the run has already finished.
        }
      }));
    },
  };
}

export interface BuildMcpToolsOptions {
  policy?: ToolPolicy;
  policyContext: ToolPolicyContext;
  executeEffect?: AgentConfig['executeEffect'];
  /** 调用抛错时回调，供连接池判定这条连接已不可用。 */
  onInvocationError?: (error: unknown) => void;
}

export function buildMcpTools(
  connection: McpConnection,
  options: BuildMcpToolsOptions,
): FunctionTool<any, any, any>[] {
  const policy = options.policy ?? new DefaultToolPolicy();
  return connection.tools.map((entry) => {
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
  });
}

/** 单轮用法：连上、包装、用完关闭。跨轮复用走 openMcpConnection + buildMcpTools。 */
export async function openMcpSession(options: OpenMcpSessionOptions): Promise<McpSession> {
  const connection = await openMcpConnection(options);
  return {
    tools: buildMcpTools(connection, options),
    close: () => connection.close(),
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
      const run = () => originalInvoke(runContext, input, details);
      try {
        return await (options.executeEffect
          ? options.executeEffect(fnTool.name, parsed, run)
          : run());
      } catch (error) {
        // 连接复用之后进程可能已经死了。报错一次就让调用方丢掉这条连接，
        // 否则后面每一轮都会打在一条死连接上。
        options.onInvocationError?.(error);
        throw error;
      }
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
