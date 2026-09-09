import { createHash } from 'node:crypto';
import { createToolResult, type ToolResultInput, type ToolRisk } from '../protocol/results';

// Keep the historical toolContract exports stable while making the protocol
// module the single source of truth for tool result shapes and risk/effect enums.
export type { ToolEffect, ToolResult, ToolResultInput, ToolRisk } from '../protocol/results';

export interface ToolPolicyContext {
  workspaceRoot: string;
  workspaceRoots?: string[];
  allowedCommands?: string[];
  allowedDevices?: string[];
  dryRun?: boolean;
}

export interface ToolPolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  risk: ToolRisk;
}

export interface ToolPolicy {
  evaluate(toolName: string, input: unknown, context: ToolPolicyContext): ToolPolicyDecision;
}

const RISK_BY_TOOL: Record<string, ToolRisk> = {
  get_io_table: 'read',
  read_plc_variables: 'read',
  validate_st_code: 'plan',
  list_files: 'read',
  read_file: 'read',
  search_files: 'read',
  export_st_program: 'write',
  write_file: 'write',
  run_command: 'execute',
  write_plc_variables: 'execute',
};

function stringInput(input: unknown, key: string): string {
  if (!input || typeof input !== 'object') return '';
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export class DefaultToolPolicy implements ToolPolicy {
  evaluate(toolName: string, input: unknown, context: ToolPolicyContext): ToolPolicyDecision {
    const risk = RISK_BY_TOOL[toolName] ?? 'execute';
    const requiresApproval = risk === 'write' || risk === 'execute';
    if (context.dryRun && requiresApproval) {
      return { allowed: false, requiresApproval, risk, reason: '当前处于干运行模式，不允许执行副作用工具。' };
    }
    if (toolName === 'run_command') {
      const command = stringInput(input, 'command').trim();
      if (!command) return { allowed: false, requiresApproval, risk, reason: '命令不能为空。' };
      const first = command.split(/\s+/)[0]?.toLowerCase() ?? '';
      if (context.allowedCommands?.length && !context.allowedCommands.includes(first)) {
        return { allowed: false, requiresApproval, risk, reason: `命令 ${first} 不在允许列表中。` };
      }
      if (/\b(shutdown|format|del|rm|rmdir|diskpart)\b/i.test(command)) {
        return { allowed: false, requiresApproval, risk, reason: '检测到破坏性命令，策略禁止执行。' };
      }
    }
    if (toolName === 'write_plc_variables') {
      const device = stringInput(input, 'device');
      if (context.allowedDevices?.length && !context.allowedDevices.includes(device)) {
        return { allowed: false, requiresApproval, risk, reason: `设备 ${device || '(空)'} 不在允许列表中。` };
      }
    }
    return { allowed: true, requiresApproval, risk };
  }
}

export function toolResult<T>(
  result: Omit<ToolResultInput<T>, 'risk'> & { risk?: ToolRisk },
  fallbackRisk: ToolRisk = 'read',
): string {
  return JSON.stringify(createToolResult({ ...result, risk: result.risk ?? fallbackRisk }));
}

export function toolFingerprint(toolName: string, input: unknown): string {
  return createHash('sha256').update(toolName).update(JSON.stringify(input)).digest('hex').slice(0, 16);
}
