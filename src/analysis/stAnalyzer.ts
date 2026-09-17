/**
 * ST 校验端口(analysis 层,纯 Node,不依赖 VS Code / SDK)。
 *
 * 与 src/plc/plcAdapter.ts 同一角色:把"校验能力"抽象成一个可替换端口。
 * 内核只认 StAnalyzer,谁来实现、装在哪、用子进程还是远程服务,它一概不知道。
 */
import type { Diagnostic, DiagnosticSeverity } from '../protocol/results';

import { mapStDiagnosticCode } from './stDiagnosticCodes';

/** 与桥脚本约定的协议版本,不兼容变更时递增。 */
export const ST_ANALYZER_PROTOCOL_VERSION = 1 as const;

export type StSeverity = 'error' | 'warning' | 'info';

export interface StDiagnostic {
  severity: StSeverity;
  /** 稳定诊断码:测试/审计可断言,不依赖校验器的中文 message。 */
  code: string;
  /** 校验器原始 code(它将来提供 Diagnostic.code 时优先使用)。 */
  rawCode?: string;
  message: string;
  /** 目标路径(宿主可投影为相对工作区路径展示)。 */
  path: string;
  line: number;
  character: number;
  endLine: number;
  endCharacter: number;
  source?: string;
}

/** 一段待校验的 ST 文本。path 只用于构造 URI,桥不会读盘。 */
export interface StTarget {
  path: string;
  text: string;
}

export interface StValidationRequest {
  workspaceRoot: string;
  targets: StTarget[];
  /** 工作区其它 .st 文件,跨文件(GVL/FB)解析需要。 */
  context?: StTarget[];
  options?: { maxDiagnostics?: number };
}

export interface StAnalyzerEngineInfo {
  id: string;
  /** 追溯信息(bundle 时间/来源),用于判断跑的是哪版规则。 */
  detail?: string;
  /** 降级原因(st_analyzer_unavailable / timeout / ...),正常路径下省略。 */
  fallbackReason?: string;
}

export interface StValidationTargetResult {
  path: string;
  diagnostics: StDiagnostic[];
}

export interface StValidationResult {
  engine: StAnalyzerEngineInfo;
  results: StValidationTargetResult[];
  contextLoaded: number;
  elapsedMs: number;
}

/** 唯一的端口。宿主注入,内核消费。 */
export interface StAnalyzer {
  readonly id: string;
  verify(
    request: StValidationRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StValidationResult>;
}

/**
 * 实现不可用(缺文件/起不来/超时/协议不符)。
 * 与"校验发现了错误"严格区分:前者可降级,后者是正常的校验结论。
 */
export class StAnalyzerUnavailableError extends Error {
  constructor(
    readonly code: string,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'StAnalyzerUnavailableError';
  }
}

/** 闸门语义的唯一判定点:只有 error 级诊断算失败,warning/info 只计数。 */
export function isStValidationFailure(result: StValidationResult): boolean {
  return result.results.some((target) =>
    target.diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  );
}

export function countStDiagnostics(result: StValidationResult): {
  error: number;
  warning: number;
  info: number;
} {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const target of result.results) {
    for (const diagnostic of target.diagnostics) counts[diagnostic.severity] += 1;
  }
  return counts;
}

export function toProtocolDiagnostics(diagnostics: StDiagnostic[]): Diagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message:
      diagnostic.line > 0 ? `L${diagnostic.line}: ${diagnostic.message}` : diagnostic.message,
    severity: diagnostic.severity as DiagnosticSeverity,
    ...(diagnostic.path ? { path: diagnostic.path } : {}),
  }));
}

/** 宿主算出的一条启动候选(可执行文件 + 参数 + 工作目录)。 */
export interface StAnalyzerLaunch {
  exe: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}

/**
 * 随 run 一起持久化的纯数据设置(不含实例/函数,可 JSON 序列化),
 * 这样重试与断点续跑用的是同一套校验器配置。
 */
export interface StAnalyzerSettings {
  launches?: StAnalyzerLaunch[];
  timeoutMs?: number;
  maxDiagnostics?: number;
  loadWorkspaceContext?: boolean;
  maxContextFiles?: number;
  maxFileBytes?: number;
}

/** 工具层需要的上下文配额(从 settings 投影,避免工具直接读宿主配置)。 */
export interface StAnalyzerToolOptions {
  loadWorkspaceContext?: boolean;
  maxContextFiles?: number;
  maxFileBytes?: number;
  maxDiagnostics?: number;
}

export function toolOptionsFromSettings(settings?: StAnalyzerSettings): StAnalyzerToolOptions {
  return {
    loadWorkspaceContext: settings?.loadWorkspaceContext,
    maxContextFiles: settings?.maxContextFiles,
    maxFileBytes: settings?.maxFileBytes,
    maxDiagnostics: settings?.maxDiagnostics,
  };
}

// ---------- 桥响应(wire)解析:把不可信输入收敛成稳定结构 ----------

interface BridgeDiagnosticWire {
  severity?: unknown;
  code?: unknown;
  rawCode?: unknown;
  message?: unknown;
  path?: unknown;
  line?: unknown;
  character?: unknown;
  endLine?: unknown;
  endCharacter?: unknown;
  source?: unknown;
}

function asSeverity(value: unknown): StSeverity {
  if (typeof value === 'number') {
    // LSP severity: 1 error / 2 warning / 3 information / 4 hint
    if (value === 2) return 'warning';
    if (value === 3 || value === 4) return 'info';
    return 'error'; // 未知严重度一律按 error,宁可让模型再看一眼
  }
  if (value === 'warning' || value === 'info') return value;
  return 'error';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * 解析桥的一行 JSON。任何结构性异常都归为协议错误(可降级),
 * 绝不返回"看起来像 0 错误"的空结果 —— 那等于假通过。
 */
export function parseStAnalyzerResponse(raw: string): StValidationResult {
  const text = raw.trim();
  if (!text) {
    throw new StAnalyzerUnavailableError('st_analyzer_protocol_error', 'empty stdout');
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new StAnalyzerUnavailableError(
      'st_analyzer_protocol_error',
      `invalid json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new StAnalyzerUnavailableError('st_analyzer_protocol_error', 'response is not an object');
  }
  if (parsed.protocolVersion !== ST_ANALYZER_PROTOCOL_VERSION) {
    throw new StAnalyzerUnavailableError(
      'st_analyzer_protocol_error',
      `protocolVersion=${String(parsed.protocolVersion)}`,
    );
  }
  const wireResults = Array.isArray(parsed.results) ? parsed.results : [];
  const results: StValidationTargetResult[] = wireResults.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const wireDiagnostics = Array.isArray(record.diagnostics) ? record.diagnostics : [];
    return {
      path: asString(record.path),
      diagnostics: wireDiagnostics.map((entry): StDiagnostic => {
        const diagnostic = (entry ?? {}) as BridgeDiagnosticWire;
        const message = asString(diagnostic.message).replace(/\s+/g, ' ').slice(0, 500);
        const wireCode = asString(diagnostic.code);
        return {
          severity: asSeverity(diagnostic.severity),
          // 桥只透传原始信息;稳定码在这里统一映射(单测覆盖)
          code: wireCode || mapStDiagnosticCode(message, diagnostic.rawCode),
          ...(asString(diagnostic.rawCode) ? { rawCode: asString(diagnostic.rawCode) } : {}),
          message,
          path: asString(diagnostic.path),
          line: asNumber(diagnostic.line),
          character: asNumber(diagnostic.character),
          endLine: asNumber(diagnostic.endLine),
          endCharacter: asNumber(diagnostic.endCharacter),
          ...(typeof diagnostic.source === 'string' ? { source: diagnostic.source } : {}),
        };
      }),
    };
  });
  const engineWire = (parsed.engine ?? {}) as Record<string, unknown>;
  const bundleMtime = asString(engineWire.bundleMtime);
  const sourceCommit = asString(engineWire.sourceCommit);
  const detail = [bundleMtime ? `bundle=${bundleMtime}` : '', sourceCommit ? `commit=${sourceCommit}` : '']
    .filter(Boolean)
    .join(' ');
  return {
    engine: {
      id: asString(engineWire.id, 'st-analyze'),
      ...(detail ? { detail } : {}),
    },
    results,
    contextLoaded: asNumber(parsed.contextLoaded),
    elapsedMs: asNumber(parsed.elapsedMs),
  };
}