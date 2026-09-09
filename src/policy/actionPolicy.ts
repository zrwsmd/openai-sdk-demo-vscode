/**
 * Application-level action intent policy.
 *
 * The Agents SDK decides how to call a tool. This policy decides whether a
 * user's request explicitly requires a particular tool call, which is needed
 * for gateways that may otherwise answer without executing the tool.
 */

export type RequiredAgentTool = 'read_file' | 'write_file' | 'export_st_program' | 'run_command';

export interface ActionPolicy {
  requiredToolFor(userText: string): RequiredAgentTool | undefined;
}

export class DefaultActionPolicy implements ActionPolicy {
  requiredToolFor(userText: string): RequiredAgentTool | undefined {
    const text = userText.trim();
    if (!text) return undefined;
    if (hasNegation(text, /(?:写|保存|修改|覆盖|创建)/u) || hasNegation(text, /(?:读取|读|查看|打开|read)/iu)) {
      return undefined;
    }

    const mentionsWorkspaceFile = /(?:文件|工作区|当前项目|workspace|\bfile\b|[`'"“”‘’]?[^\s`'"“”‘’]+\.[a-z0-9]{1,8}\b)/iu.test(text);
    const asksToWrite = /(?:写入|写到|写进|写文件|保存到|保存为|落盘|创建|修改|覆盖|\bwrite\b|\bsave\b|\bcreate\b|\bmodify\b|\boverwrite\b)/iu.test(text);
    if (mentionsWorkspaceFile && asksToWrite) return 'write_file';

    const asksToRead = /(?:读取|读一下|读出|查看|打开|内容|\bread\b|\bopen\b|\bcat\b)/iu.test(text);
    if (mentionsWorkspaceFile && asksToRead) return 'read_file';

    if (/(?=.*(?:导出|保存|落盘))(?=.*(?:ST|程序|源码))|export.*program|save.*program/iu.test(text)) {
      return 'export_st_program';
    }

    if (/(执行|运行).*(命令|脚本)|run\s+(a\s+)?command|execute.*command/iu.test(text)) {
      return 'run_command';
    }
    return undefined;
  }
}

const defaultActionPolicy = new DefaultActionPolicy();

export function inferRequiredTool(userText: string): RequiredAgentTool | undefined {
  return defaultActionPolicy.requiredToolFor(userText);
}

function hasNegation(text: string, action: RegExp): boolean {
  return new RegExp(`(?:不要|无需|不需要|别|勿)[^。！？\\r\\n]{0,8}${action.source}`, action.flags).test(text);
}
