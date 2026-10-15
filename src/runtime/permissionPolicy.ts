import type { PermissionMode } from './agentConfig';
import type { ToolRisk } from '../tools/toolContract';
import { classifyCommandRisk, commandFromToolArgs } from '../tools/commandRisk';

export function shouldAutoApproveToolCall(options: {
  permissionMode: PermissionMode;
  toolName: string;
  toolRisk: ToolRisk;
  args?: string;
}): boolean {
  if (options.permissionMode === 'full_access') return true;
  if (options.permissionMode !== 'auto') return false;
  if (options.toolRisk === 'write') return true;
  if (options.toolName === 'run_command') {
    const command = commandFromToolArgs(options.args);
    return classifyCommandRisk(command).level === 'low';
  }
  return false;
}
