/**
 * ST 诊断码映射(纯函数,可单测)。
 *
 * st-analyze 目前只给中文 message、不给稳定 code,所以这里做保守映射:
 * 命中不到就落到 st.other,并保留原文,信息不丢。
 * 将来校验器自己提供 Diagnostic.code 时,rawCode 优先,本表退化为兜底。
 */

export const ST_DIAGNOSTIC_CODES = {
  unresolvedReference: 'st.unresolved_reference',
  typeMismatch: 'st.type_mismatch',
  parseError: 'st.parse_error',
  referenceMissing: 'st.reference_missing',
  duplicateDeclaration: 'st.duplicate_declaration',
  unknownCallable: 'st.unknown_callable',
  invalidParameterName: 'st.parameter_name_invalid',
  invalidParameterType: 'st.parameter_type_invalid',
  enumMemberInvalid: 'st.enum_member_invalid',
  varExternalInvalid: 'st.var_external_invalid',
  timerLiteralMissing: 'st.timer_literal_missing',
  other: 'st.other',
} as const;

/** 宿主侧(非校验器产出)的可用性诊断码。 */
export const ST_ANALYZER_STATUS_CODES = {
  unavailable: 'st_analyzer_unavailable',
  timeout: 'st_analyzer_timeout',
  protocolError: 'st_analyzer_protocol_error',
  notConfigured: 'st_analyzer_not_configured',
  disabled: 'st_analyzer_disabled',
  launchMissing: 'st_analyzer_bridge_missing',
} as const;

const MESSAGE_RULES: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /Could not resolve reference/i, code: ST_DIAGNOSTIC_CODES.unresolvedReference },
  { pattern: /cannot convert|type mismatch|不能将类型|类型不匹配/i, code: ST_DIAGNOSTIC_CODES.typeMismatch },
  { pattern: /Expecting token of type|Expecting end of file|mismatched input/i, code: ST_DIAGNOSTIC_CODES.parseError },
  { pattern: /重复定义|duplicate/i, code: ST_DIAGNOSTIC_CODES.duplicateDeclaration },
  { pattern: /不能引用的功能块或函数|unknown function block|not defined/i, code: ST_DIAGNOSTIC_CODES.unknownCallable },
  { pattern: /不是.*的输入参数|unknown parameter/i, code: ST_DIAGNOSTIC_CODES.invalidParameterName },
  { pattern: /qualified_only|VAR_EXTERNAL/i, code: ST_DIAGNOSTIC_CODES.varExternalInvalid },
  { pattern: /枚举|enum/i, code: ST_DIAGNOSTIC_CODES.enumMemberInvalid },
  { pattern: /不存在|not found|missing/i, code: ST_DIAGNOSTIC_CODES.referenceMissing },
];

/**
 * 把校验器 message 收敛成稳定诊断码。
 * 校验器自己给了 code 就用它的(future-proof),否则按 message 模式匹配。
 */
export function mapStDiagnosticCode(message: string, rawCode?: unknown): string {
  if (typeof rawCode === 'string' && rawCode.trim()) return rawCode.trim();
  const text = String(message ?? '');
  for (const rule of MESSAGE_RULES) {
    if (rule.pattern.test(text)) return rule.code;
  }
  return ST_DIAGNOSTIC_CODES.other;
}
