import type { ToolResult } from '../protocol/results';
import type { RequiredAgentTool } from '../policy/actionPolicy';

export interface CompletionGateToolRecord {
  name: string;
  args: string;
  result: ToolResult;
  order?: number;
}

export interface CompletionGateInput {
  userText: string;
  finalMessage: string;
  toolResults: CompletionGateToolRecord[];
  requiredTool?: RequiredAgentTool;
}

export interface CompletionGateIssue {
  toolName: string;
  args: string;
  targetKey: string;
  order: number;
  risk: ToolResult['risk'];
  effect: ToolResult['effect'];
  summary: string;
  requiresRepair: boolean;
}

export type CompletionGateResult =
  | { passed: true }
  | {
      passed: false;
      reason: string;
      repairInstruction: string;
      issues: CompletionGateIssue[];
    };

const BLOCKING_DIAGNOSTIC_SEVERITIES = new Set(['error', 'blocking']);

export function evaluateCompletionGate(
  input: CompletionGateInput,
): CompletionGateResult {
  const records = input.toolResults
    .map((record, index) => ({ ...record, order: record.order ?? index + 1 }))
    .sort((a, b) => a.order - b.order);
  const unresolvedIssues = collectUnresolvedIssues(records, input.userText);
  if (!unresolvedIssues.length) return { passed: true };

  const finalMessage = input.finalMessage.trim();
  const acknowledged = messageAcknowledgesProblem(finalMessage);
  const successClaim = messageClaimsCompletion(finalMessage);
  const mustRepair = unresolvedIssues.some((issue) => issue.requiresRepair);

  if (!mustRepair && acknowledged && finalMessage) {
    return { passed: true };
  }

  if (!mustRepair && acknowledged && !successClaim) {
    return { passed: true };
  }

  const reason = summarizeIssues(unresolvedIssues, {
    finalMessageEmpty: !finalMessage,
    successClaim,
    acknowledged,
  });
  return {
    passed: false,
    reason,
    repairInstruction: buildRepairInstruction(reason, unresolvedIssues, input),
    issues: unresolvedIssues,
  };
}

function collectUnresolvedIssues(
  records: (CompletionGateToolRecord & { order: number })[],
  userText: string,
): CompletionGateIssue[] {
  const issues = records
    .map((record) => issueFromToolResult(record, userText))
    .filter((issue): issue is CompletionGateIssue => issue !== undefined);
  return issues.filter((issue) => !hasLaterResolution(issue, records));
}

function issueFromToolResult(
  record: CompletionGateToolRecord & { order: number },
  userText: string,
): CompletionGateIssue | undefined {
  const diagnostics = Array.isArray(record.result.diagnostics)
    ? record.result.diagnostics
    : [];
  const blockingDiagnostics = diagnostics.filter((diagnostic) =>
    BLOCKING_DIAGNOSTIC_SEVERITIES.has(diagnostic.severity),
  );
  const errorText = typeof record.result.error === 'string'
    ? record.result.error.trim()
    : '';
  if (record.result.ok && !errorText && !blockingDiagnostics.length) {
    return undefined;
  }

  const diagnosticSummary = blockingDiagnostics
    .map((diagnostic) => diagnostic.message.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('；');
  const summary = [
    record.result.ok ? undefined : 'ok=false',
    errorText || undefined,
    diagnosticSummary ? `diagnostics=${diagnosticSummary}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join('；') || '工具返回了阻断性问题';

  return {
    toolName: record.name,
    args: record.args,
    targetKey: targetKeyFor(record),
    order: record.order,
    risk: record.result.risk,
    effect: record.result.effect,
    summary,
    requiresRepair: shouldRequireRepair(record.result, userText),
  };
}

function hasLaterResolution(
  issue: CompletionGateIssue,
  records: (CompletionGateToolRecord & { order: number })[],
): boolean {
  return records.some((record) => {
    if (record.order <= issue.order) return false;
    if (record.name !== issue.toolName) return false;
    if (targetKeyFor(record) !== issue.targetKey) return false;
    return !issueFromToolResult(record, '');
  });
}

function shouldRequireRepair(result: ToolResult, userText: string): boolean {
  if (result.risk !== 'plan') return false;
  return hasDeliveryIntent(userText);
}

function hasDeliveryIntent(userText: string): boolean {
  return /(?:写|生成|编写|创建|实现|修正|修改|完善|导出|保存|完成|搭建|构建|\bwrite\b|\bgenerate\b|\bcreate\b|\bimplement\b|\bfix\b|\brepair\b|\bmodify\b|\bexport\b|\bsave\b|\bbuild\b)/iu.test(userText);
}

function messageAcknowledgesProblem(message: string): boolean {
  if (!message.trim()) return false;
  return /(?:失败|错误|异常|不存在|找不到|无法|不能|未能|没有成功|未通过|报错|被拒绝|拒绝|取消|超时|不满足|缺失|failed|failure|error|unable|cannot|can't|not found|missing|denied|refused|timeout|timed out|does not exist|non[-\s]?zero)/iu.test(message);
}

function messageClaimsCompletion(message: string): boolean {
  if (!message.trim()) return false;
  return /(?:已完成|完成了|成功|已成功|已读取|已写入|已导出|已生成|已修复|已通过|OK|done|completed|success|succeeded|passed|fixed|generated|written|exported|read)/iu.test(message);
}

function targetKeyFor(record: CompletionGateToolRecord): string {
  const args = parseArgs(record.args);
  const target =
    stringField(args, ['path', 'file', 'uri', 'url', 'name', 'command']) ??
    arrayField(args, ['paths', 'files', 'names']);
  return target ? `${record.name}:${target}` : record.name;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringField(
  value: Record<string, unknown>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const item = value[name];
    if (typeof item === 'string' && item.trim()) return item.trim();
  }
  return undefined;
}

function arrayField(
  value: Record<string, unknown>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const item = value[name];
    if (!Array.isArray(item)) continue;
    const text = item
      .map((entry) => typeof entry === 'string' ? entry.trim() : '')
      .filter(Boolean)
      .join(',');
    if (text) return text;
  }
  return undefined;
}

function summarizeIssues(
  issues: CompletionGateIssue[],
  state: {
    finalMessageEmpty: boolean;
    successClaim: boolean;
    acknowledged: boolean;
  },
): string {
  const prefix = state.finalMessageEmpty
    ? '模型准备结束时没有给出文字说明'
    : state.successClaim && !state.acknowledged
      ? '模型准备以成功口径结束,但工具账本仍有未处理失败'
      : '模型准备结束,但工具账本仍有需要继续处理的问题';
  const details = issues
    .slice(0, 3)
    .map((issue) => `${issue.toolName}: ${issue.summary}`)
    .join('；');
  return `${prefix}: ${details}`;
}

function buildRepairInstruction(
  reason: string,
  issues: CompletionGateIssue[],
  input: CompletionGateInput,
): string {
  const lines = [
    reason,
    '请继续处理当前用户目标,不要直接给最终成功答复。',
    '根据工具回执中的 ok/error/diagnostics 判断下一步: 可以修正参数、查找替代资源、修复生成内容、重新调用校验/读取/执行工具。',
    '只有后续工具回执显示相关问题已解决,或你能明确向用户说明无法完成及具体原因时,才可以结束。',
  ];
  if (input.requiredTool) {
    lines.push(`用户请求要求 ${input.requiredTool}; 若该工具失败,必须基于失败原因继续处理或明确报告无法完成。`);
  }
  const repairOnly = issues.filter((issue) => issue.requiresRepair);
  if (repairOnly.length) {
    lines.push('这些问题属于生成/修复/交付流程中的校验或计划失败,需要修正后重新验证通过,不能只报告失败就结束。');
  }
  lines.push(
    '未处理问题: ' +
      issues
        .slice(0, 5)
        .map((issue) => {
          const args = issue.args.trim()
            ? ` args=${truncateForInstruction(issue.args, 600)}`
            : '';
          return `${issue.toolName}(${issue.targetKey})${args} => ${issue.summary}`;
        })
        .join(' | '),
  );
  return lines.join('\n');
}

function truncateForInstruction(text: string, max: number): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}
