import type { Artifact, ToolResult } from '../protocol/results';
import type { RequiredAgentTool } from '../policy/actionPolicy';
import type { DeliveryContract } from './deliveryContract';
import { isStCodeDeliveryContract } from './deliveryContract';

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
  artifacts?: Artifact[];
  deliveryContract?: DeliveryContract;
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
  const unresolvedIssues = [
    ...collectUnresolvedIssues(records, input),
    ...collectDeliveryContractIssues(input, records),
  ];
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
  input: CompletionGateInput,
): CompletionGateIssue[] {
  const issues = records
    .map((record) => issueFromToolResult(record, input))
    .filter((issue): issue is CompletionGateIssue => issue !== undefined);
  return issues.filter((issue) => !hasLaterResolution(issue, records, input));
}

function issueFromToolResult(
  record: CompletionGateToolRecord & { order: number },
  input: CompletionGateInput,
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
    requiresRepair: shouldRequireRepair(record.result, input),
  };
}

function hasLaterResolution(
  issue: CompletionGateIssue,
  records: (CompletionGateToolRecord & { order: number })[],
  input: CompletionGateInput,
): boolean {
  if (hasLaterDirectResolution(issue, records, input)) return true;
  return hasLaterDeliveryResolution(issue, records, input);
}

function hasLaterDirectResolution(
  issue: CompletionGateIssue,
  records: (CompletionGateToolRecord & { order: number })[],
  input: CompletionGateInput,
): boolean {
  return records.some((record) => {
    if (record.order <= issue.order) return false;
    if (record.name !== issue.toolName) return false;
    if (targetKeyFor(record) !== issue.targetKey) return false;
    return !issueFromToolResult(record, input);
  });
}

function hasLaterDeliveryResolution(
  issue: CompletionGateIssue,
  records: (CompletionGateToolRecord & { order: number })[],
  input: CompletionGateInput,
): boolean {
  const contract = input.deliveryContract;
  if (!contract?.requiresDeliverable) return false;
  const laterRecords = records.filter((record) => record.order > issue.order);
  const deliverables = contract.deliverables.filter((deliverable) => deliverable.required);

  if (
    isStCodeDeliveryContract(contract) &&
    (issue.toolName === 'validate_st_code' ||
      issue.toolName === 'write_file' ||
      issue.toolName === 'delivery_verification') &&
    hasValidatedStWrite(records)
  ) {
    return true;
  }

  if (issue.toolName === 'write_file') {
    return deliverables.some((deliverable) =>
      hasToolEvidence('successful_write', laterRecords, deliverable),
    );
  }

  if (issue.toolName === 'export_st_program') {
    return deliverables.some((deliverable) =>
      hasToolEvidence('successful_export', laterRecords, deliverable),
    );
  }

  return deliverables.some((deliverable) =>
    deliverable.requiredVerificationTools?.includes(issue.toolName) &&
    hasSuccessfulVerification(issue.toolName, laterRecords),
  );
}

function hasValidatedStWrite(
  records: (CompletionGateToolRecord & { order: number })[],
): boolean {
  const validationHashes = new Set<string>();
  for (const record of records) {
    if (record.name !== 'validate_st_code' || !toolResultSucceeded(record.result)) continue;
    const data = record.result.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    const value = data as Record<string, unknown>;
    if (value.errorCount !== 0) continue;
    const target = value.validationTarget;
    const targetHash = target && typeof target === 'object' && !Array.isArray(target)
      ? (target as Record<string, unknown>).contentHash
      : undefined;
    const hash = typeof value.validatedContentHash === 'string'
      ? value.validatedContentHash
      : typeof targetHash === 'string' ? targetHash : undefined;
    if (hash) validationHashes.add(hash);
  }
  return records.some((record) => {
    if (record.name !== 'write_file' || !toolResultSucceeded(record.result)) return false;
    const data = record.result.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const value = data as Record<string, unknown>;
    const preWriteHash = preWriteValidationHash(value);
    if (
      typeof value.file === 'string' &&
      value.file.toLowerCase().endsWith('.st') &&
      typeof value.contentHash === 'string' &&
      preWriteHash === value.contentHash
    ) {
      return true;
    }
    if (!validationHashes.size) return false;
    return typeof value.file === 'string' &&
      value.file.toLowerCase().endsWith('.st') &&
      typeof value.contentHash === 'string' &&
      validationHashes.has(value.contentHash);
  });
}

function shouldRequireRepair(result: ToolResult, input: CompletionGateInput): boolean {
  if (result.risk !== 'plan') return false;
  return input.deliveryContract?.requiresDeliverable === true;
}

function collectDeliveryContractIssues(
  input: CompletionGateInput,
  records: (CompletionGateToolRecord & { order: number })[],
): CompletionGateIssue[] {
  const contract = input.deliveryContract;
  if (!contract?.requiresDeliverable) return [];
  const artifacts = input.artifacts ?? [];
  const deliveryIssues = contract.deliverables
    .filter((deliverable) => deliverable.required)
    .filter((deliverable) => !hasDeliveryEvidence(deliverable, artifacts, records))
    .map((deliverable, index) => ({
      toolName: 'delivery_contract',
      args: JSON.stringify(deliverable),
      targetKey: `delivery:${deliverable.title || index + 1}`,
      order: records.length + index + 1,
      risk: 'plan' as const,
      effect: 'none' as const,
      summary: `缺少交付证据: ${deliverable.description || deliverable.title}`,
      requiresRepair: true,
    }));
  const verificationIssues = contract.deliverables
    .filter((deliverable) => deliverable.required)
    .flatMap((deliverable, deliverableIndex) =>
      (deliverable.requiredVerificationTools ?? [])
        .filter((toolName) => !hasSuccessfulVerification(toolName, records))
        .map((toolName, verificationIndex) => ({
          toolName: 'delivery_verification',
          args: JSON.stringify({ deliverable: deliverable.title, tool: toolName }),
          targetKey: `verification:${deliverable.title || deliverableIndex + 1}:${toolName}`,
          order: records.length + contract.deliverables.length + deliverableIndex * 8 + verificationIndex + 1,
          risk: 'plan' as const,
          effect: 'none' as const,
          summary: `缺少必要验证: ${toolName} (${deliverable.description || deliverable.title})`,
          requiresRepair: true,
        })),
    );
  return [...deliveryIssues, ...verificationIssues];
}

function hasDeliveryEvidence(
  deliverable: DeliveryContract['deliverables'][number],
  artifacts: Artifact[],
  records: (CompletionGateToolRecord & { order: number })[],
): boolean {
  if (
    deliverable.workspacePersistence === 'required' &&
    !hasToolEvidence('successful_write', records, deliverable)
  ) {
    return false;
  }
  return deliverable.acceptableEvidence.some((evidence) => {
    if (evidence === 'final_artifact') return hasArtifactEvidence(deliverable, artifacts);
    return hasToolEvidence(evidence, records, deliverable);
  });
}

function hasArtifactEvidence(
  deliverable: DeliveryContract['deliverables'][number],
  artifacts: Artifact[],
): boolean {
  return artifacts.some((artifact) => {
    if (!artifact) return false;
    // A model-provided URI/name is only a claim. Inline artifact evidence must
    // contain the actual payload; real files are evidenced by successful tools.
    const hasPayload = !!artifact.content?.trim();
    if (!hasPayload) return false;
    if (deliverable.kind === 'unknown') return true;
    if (artifact.kind === deliverable.kind || artifact.kind === 'unknown') return true;
    if (deliverable.kind === 'code') return artifact.kind === 'file' && hasCodeLikeName(artifact.name);
    if (deliverable.kind === 'text') return artifact.kind === 'report' || artifact.kind === 'file' || artifact.kind === 'data';
    if (deliverable.kind === 'report') return artifact.kind === 'file' || artifact.kind === 'data';
    if (deliverable.kind === 'data') return artifact.kind === 'file';
    if (deliverable.kind === 'file') return artifact.kind === 'code' || artifact.kind === 'report' || artifact.kind === 'data';
    if (deliverable.kind === 'project') return artifact.kind === 'file' || artifact.kind === 'report';
    return false;
  });
}

function hasCodeLikeName(name: string): boolean {
  return /\.(?:st|scl|iecst|c|cpp|h|hpp|cs|java|js|jsx|ts|tsx|py|go|rs|json|yaml|yml|xml|sql)$/i.test(name);
}

function hasToolEvidence(
  evidence: DeliveryContract['deliverables'][number]['acceptableEvidence'][number],
  records: (CompletionGateToolRecord & { order: number })[],
  deliverable: DeliveryContract['deliverables'][number],
): boolean {
  return records.some((record) => {
    if (!toolResultSucceeded(record.result)) return false;
    if (evidence === 'successful_tool') return true;
    if (evidence === 'successful_write') {
      const isWrite =
        record.name === 'write_file' ||
        record.result.risk === 'write' ||
        record.result.effect === 'filesystem' ||
        record.result.effect === 'device';
      if (!isWrite) return false;
      const extension = deliverable.workspaceFileExtension?.toLowerCase();
      if (!extension) return true;
      const filePath = filePathFor(record);
      return !!filePath && filePath.toLowerCase().endsWith(extension);
    }
    if (evidence === 'successful_export') return record.name === 'export_st_program' || record.name.toLowerCase().includes('export');
    return false;
  });
}

function hasSuccessfulVerification(
  toolName: string,
  records: (CompletionGateToolRecord & { order: number })[],
): boolean {
  return records.some((record) => {
    if (toolName === 'validate_st_code' && hasSuccessfulStPreWriteValidation(record)) return true;
    if (record.name !== toolName || !toolResultSucceeded(record.result)) return false;
    if (toolName !== 'validate_st_code') return true;
    const data = record.result.data;
    return !!data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      (data as Record<string, unknown>).errorCount === 0;
  });
}

function hasSuccessfulStPreWriteValidation(record: CompletionGateToolRecord): boolean {
  if (record.name !== 'write_file' || !toolResultSucceeded(record.result)) return false;
  const data = record.result.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const value = data as Record<string, unknown>;
  return typeof value.contentHash === 'string' &&
    preWriteValidationHash(value) === value.contentHash;
}

function preWriteValidationHash(data: Record<string, unknown>): string | undefined {
  const preWrite = data.preWriteValidation;
  if (!preWrite || typeof preWrite !== 'object' || Array.isArray(preWrite)) return undefined;
  const value = preWrite as Record<string, unknown>;
  if (value.errorCount !== 0) return undefined;
  return typeof value.validatedContentHash === 'string'
    ? value.validatedContentHash
    : undefined;
}

function toolResultSucceeded(result: ToolResult): boolean {
  const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
  const blockingDiagnostics = diagnostics.some((diagnostic) =>
    BLOCKING_DIAGNOSTIC_SEVERITIES.has(diagnostic.severity),
  );
  return result.ok === true && !result.error && !blockingDiagnostics;
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
  const target = targetFor(record);
  return target ? `${record.name}:${normalizeTarget(target)}` : record.name;
}

function targetFor(record: CompletionGateToolRecord): string | undefined {
  const args = parseArgs(record.args);
  const target =
    stringField(args, ['path', 'file', 'uri', 'url', 'name', 'command']) ??
    arrayField(args, ['paths', 'files', 'names']) ??
    filePathFor(record);
  return target;
}

function filePathFor(record: CompletionGateToolRecord): string | undefined {
  const args = parseArgs(record.args);
  const fromArgs = stringField(args, ['path', 'file', 'uri']);
  if (fromArgs) return fromArgs;
  const data = record.result.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  return stringField(data as Record<string, unknown>, [
    'path',
    'file',
    'uri',
    'relativePath',
  ]);
}

function normalizeTarget(value: string): string {
  return value.trim().replace(/\\/g, '/');
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
  if (issues.some((issue) => issue.toolName === 'delivery_contract')) {
    lines.push('这些问题来自交付契约: 用户要的是可交付结果。你必须实际交付内容并放入最终 artifacts, 或调用能产生交付证据的工具；不能只给过程说明或口头承诺。');
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
