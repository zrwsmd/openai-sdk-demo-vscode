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

export async function openMcpSession(options: OpenMcpSessionOptions): Promise<McpSession> {
  const settings = options.settings;
  if (!settings?.enabled || settings.servers.length === 0) {
    return { tools: [], close: async () => undefined };
  }
  const log = options.log ?? (() => undefined);
  const policy = options.policy ?? new DefaultToolPolicy();
  const reserved = new Set(options.reservedToolNames ?? []);
  const servers: MCPServer[] = [];
  const tools: FunctionTool<any, any, any>[] = [];

  for (const spec of settings.servers.filter(isMcpServerEnabled)) {
    try {
      const server = createMcpServer(spec);
      await server.connect();
      servers.push(server);
      const listed = await server.listTools();
      for (const mcpTool of listed) {
        const name = mcpFunctionToolName(spec.name, mcpTool.name);
        if (reserved.has(name)) {
          log(`[mcp] 跳过重名工具 ${name}`);
          continue;
        }
        reserved.add(name);
        const fnTool = mcpToFunctionTool(mcpTool, server, false, { toolNameOverride: name });
        tools.push(wrapMcpFunctionTool(fnTool, {
          serverName: spec.name,
          policy,
          policyContext: options.policyContext,
          executeEffect: options.executeEffect,
        }));
      }
      log(`[mcp] 已连接 ${spec.name}(${spec.transport})，工具 ${listed.length} 个`);
    } catch (error) {
      log(`[mcp] 连接 ${spec.name} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    tools,
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
      return options.executeEffect
        ? options.executeEffect(fnTool.name, parsed, run)
        : run();
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
