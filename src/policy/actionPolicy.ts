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

/**
 * Coarse action intent shared by workflow routing and ordinary tool policy.
 *
 * A project name or a recently created project is target context.  This value
 * describes the action in the current user turn so a domain workflow cannot
 * claim a request merely because its domain is mentioned as the target.
 */
export type CurrentActionIntent =
  | 'project'
  | 'file_read'
  | 'file_edit'
  | 'command'
  | 'unknown';

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

    const mentionsWorkspaceFile =
      /(?:文件|目录|工作区|当前项目|配置(?:文件)?|文档|脚本|源码|代码|workspace|\bfile\b|\bdirectory\b)/iu.test(text) ||
      looksLikeWorkspaceFileReference(text);
    // ActionPolicy is only an intent hint. Retrospective/state questions such as
    // "which file was written just now?" must not be interpreted as a new
    // filesystem action, even when they contain action words.
    if (mentionsWorkspaceFile && isInformationalActionQuery(text)) return undefined;
    const asksToEdit = /(?:编辑|局部修改|替换|修订|修改|添加|增加|追加|插入|加上?|补上?|删除|移除|格式化|调整?缩进|调整?(?:空白|空格|换行)|patch|edit|replace|append|insert|delete|format)/iu.test(text);
    const asksToWrite = /(?:写入|写到|写进|写文件|写|保存到|保存为|保存|落盘|创建|修改|覆盖|\bwrite\b|\bsave\b|\bcreate\b|\bmodify\b|\boverwrite\b)/iu.test(text);
    if (mentionsWorkspaceFile && asksToEdit) return 'edit_file';
    if (mentionsWorkspaceFile && asksToWrite) return 'write_file';

    const asksToRead = /(?:读取|读一下|读出|查看|打开|\bread\b|\bopen\b|\bcat\b)/iu.test(text);
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

/**
 * Infer the current turn's coarse action independently from its target nouns.
 * This is deliberately conservative: unknown leaves workflow selection to the
 * registered local matcher or model classifier.
 */
export function inferCurrentActionIntent(userText: string): CurrentActionIntent {
  const text = userText.trim();
  if (!text) return 'unknown';

  const requiredTool = defaultActionPolicy.requiredToolFor(text);
  if (requiredTool === 'read_file') return 'file_read';
  if (requiredTool === 'write_file' || requiredTool === 'edit_file' || requiredTool === 'export_st_program') {
    return 'file_edit';
  }
  if (requiredTool === 'run_command') return 'command';

  // File listing/searching does not have a single required tool yet, but it is
  // still a concrete read action and must not be mistaken for project setup.
  const mentionsWorkspaceTarget =
    /(?:文件|目录|工作区|路径|内容|配置(?:文件)?|文档|脚本|源码|代码|workspace|file|directory)/iu.test(text) ||
    looksLikeWorkspaceFileReference(text);
  const asksWorkspaceInspection =
    /(?:列出|列举|搜索|查找|检索|浏览|扫描|检查|分析|inspect|list|search)/iu.test(text);
  if (mentionsWorkspaceTarget && asksWorkspaceInspection) return 'file_read';

  // A project mention can be historical context for a code-delivery request;
  // keep that request out of the project lifecycle workflow as well.
  if (/(?:程序|代码|源码|结构化文本|IEC\s*61131)/u.test(text)) return 'file_edit';

  if (isProjectLifecycleRequest(text)) return 'project';
  return 'unknown';
}

function isProjectLifecycleRequest(text: string): boolean {
  const lead = /^(?:请(?:帮我)?|帮我|我要|我想|想|想要|需要)?(?:再|继续|重新)?/u;
  const create = new RegExp(
    `${lead.source}(?:在[^。！？\\r\\n]{0,24})?(?:新建|创建|建立|搭建|生成|建(?=另(?:外)?一个|再一个|第二个|个|一个|工程|项目))\\s*` +
      `(?:另(?:外)?一个|再一个|第二个|一个|个|新的)?\\s*(?:[A-Za-z0-9_-]+\\s*)?(?:工程|项目)(?!的)`,
    'u',
  );
  const open = new RegExp(
    `${lead.source}(?:打开|开启)\\s*[^。！？\\r\\n]{0,24}(?:工程|项目)(?!的)`,
    'u',
  );
  const manageBeforeTarget = new RegExp(
    `${lead.source}(?:关闭|关掉|关了|删除|删掉|移除)\\s*` +
      `(?:当前|这个|那个|刚刚创建的|刚刚新建的)?\\s*(?:工程|项目)(?!的)`,
    'u',
  );
  const manageAfterTarget = new RegExp(
    `${lead.source}(?:把)?\\s*(?:当前|这个|那个)?\\s*(?:工程|项目)\\s*` +
      `(?:关闭|关掉|关了|删除|删掉|移除|重命名|改名|改个名)`,
    'u',
  );
  return create.test(text) || open.test(text) || manageBeforeTarget.test(text) || manageAfterTarget.test(text);
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

/**
 * A dotted token is not automatically a workspace file:
 * stock symbols (000895.SZ), versions (v1.2) and package names (node.js)
 * are common in ordinary questions. Keep the heuristic conservative and
 * recognize common workspace extensions unless the user supplied a path-like
 * reference or explicitly marked the token as a filename.
 */
function looksLikeWorkspaceFileReference(text: string): boolean {
  const commonExtensions =
    /(?:txt|md|markdown|json|jsonc|yaml|yml|xml|csv|log|st|iec|scl|pas|c|h|cpp|hpp|ts|tsx|js|jsx|mjs|cjs|py|java|go|rs|toml|ini|cfg|conf|sql|sh|bat|ps1|html|css|scss|svg|drawio)\b/iu;
  const explicitPath =
    /(?:[A-Za-z]:[\\/]|(?:^|[\s"'`“”‘’(（])\.{0,2}[\\/]|[\w.-]+[\\/][\w.-]+)/u;
  const markedFilename =
    /[`'"“”‘’][^`'"“”‘’\s/\\]+\.[a-z0-9]{1,12}[`'"“”‘’]/iu;
  const commonFilename =
    /(?:^|[\s,，。:：;；"'`“”‘’(（]|(?:到|为|在|把|将|向|从|给))[\p{L}\p{N}_-]+\.[a-z0-9]{1,12}\b/iu;
  return (
    explicitPath.test(text) ||
    markedFilename.test(text) ||
    (commonFilename.test(text) && commonExtensions.test(text))
  );
}
