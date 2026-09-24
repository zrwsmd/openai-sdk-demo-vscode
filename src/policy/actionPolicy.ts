/**
 * Application-level action intent policy.
 *
 * The Agents SDK decides how to call a tool. This policy only provides a
 * best-effort action hint for ordinary turns. The runtime may use that hint
 * for a soft reminder or evidence wording, but it must not force a tool call
 * from this policy alone. Workflow contracts and completion repair retain
 * their own explicit authority.
 */

/** @deprecated Kept as a compatibility name; this is an action hint, not a forced call. */
export type RequiredAgentTool = 'read_file' | 'write_file' | 'edit_file' | 'export_st_program' | 'run_command';

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
    // ActionPolicy is only an intent hint. Retrospective/state questions such as
    // "which file was written just now?" must not be interpreted as a new
    // filesystem action, even when they contain action words.
    if (mentionsWorkspaceFile && isInformationalActionQuery(text)) return undefined;
    const asksToEdit = /(?:编辑|局部修改|替换|修订|修改|patch|edit|replace)/iu.test(text);
    const asksToWrite = /(?:写入|写到|写进|写文件|写|保存到|保存为|保存|落盘|创建|修改|覆盖|\bwrite\b|\bsave\b|\bcreate\b|\bmodify\b|\boverwrite\b)/iu.test(text);
    if (mentionsWorkspaceFile && asksToEdit) return 'edit_file';
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

function isInformationalActionQuery(text: string): boolean {
  const hasQuestionMarker =
    /[?？]|(?:吗|么|哪个|哪些|什么|哪里|是否|有没有|有无|怎么|为何|为什么|谁|多少)/u.test(text);
  const refersToPriorState =
    /(?:刚刚|刚才|之前|上次|已经|此前|当前|现在|历史|记录|最近).*(?:写|保存|修改|创建|覆盖|落盘|文件|工作区)/u.test(text) ||
    /(?:写|保存|修改|创建|覆盖|落盘).*(?:了|过|的).*(?:哪个|哪些|什么|文件)/u.test(text);
  return hasQuestionMarker && refersToPriorState;
}
