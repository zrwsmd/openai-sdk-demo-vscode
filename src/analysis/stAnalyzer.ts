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

export interface StGraphRequest {
  workspaceRoot: string;
  /** 参与构建的全部 .st 文件(含目标与其依赖) */
  files: StTarget[];
  options?: StGraphAnalysisOptions;
}

export interface StImpactRequest extends StGraphRequest {
  /** 被变更的文件(必须出现在 files 中) */
  target: string;
  /** 符号级影响时提供:只关心目标文件中的哪些符号 */
  symbols?: string[];
  /** 影响面粒度,缺省为 file(保守,宁可多报) */
  granularity?: 'file' | 'symbol';
}

/** 唯一的端口。宿主注入,内核消费。 */
export interface StAnalyzer {
  readonly id: string;
  verify(
    request: StValidationRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StValidationResult>;
  /** 工作区文件级依赖图(跨文件符号引用的语义聚合)。 */
  dependencyGraph(
    request: StGraphRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StGraphResult>;
  /** 变更影响面:改动 target 文件(可选:其中特定符号)会波及哪些文件。 */
  changeImpact(
    request: StImpactRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StImpactResult>;
  /** 符号级引用明细:某符号声明在哪、被哪些文件的哪一行引用。 */
  findSymbolReferences(
    request: StSymbolReferencesRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StSymbolReferencesResult>;
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
    const resultPath = asString(record.path);
    const wireDiagnostics = Array.isArray(record.diagnostics) ? record.diagnostics : [];
    return {
      path: resultPath,
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
          // 诊断项级的路径:桥通常只在结果层级给,这里用结果路径兜底,
          // 保证下游(审计/UI/测试)拿到的每条诊断都知道自己属于哪个文件。
          path: asString(diagnostic.path) || resultPath,
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

// ---------- 依赖图 / 变更影响面(桥协议 v1 的 action 扩展) ----------

/** 依赖图的一条边。from/to 是参与构建的文件路径(与请求中的 path 一致)。 */
export interface StGraphEdge {
  from: string;
  to: string;
  /** 被引用符号名(来自 AST 交叉引用,非文本匹配) */
  symbols: string[];
  /** 边的种类:reference=直接跨文件引用 / global=GVL 全局变量依赖 */
  kinds: string[];
}

export interface StGraphResult {
  engine: StAnalyzerEngineInfo;
  files: string[];
  edges: StGraphEdge[];
  /** 互相可达的文件组(循环依赖),不影响构图 */
  cycles: string[][];
  /** 未解析引用(符号在任何文件里都找不到声明) */
  unresolved: Array<{ file: string; symbol: string; count: number }>;
  /** 外部库符号引用计数(来自 data.json 等,不产生文件边) */
  externalCount: number;
  elapsedMs: number;
}

export interface StImpactResult {
  engine: StAnalyzerEngineInfo;
  target: string;
  granularity: 'file' | 'symbol';
  directDependents: string[];
  allDependents: string[];
  /** 符号级时的细分:符号 -> 受影响文件 */
  bySymbol?: Record<string, string[]>;
  elapsedMs: number;
}

export interface StGraphAnalysisOptions {
  /** 影响面目标文件(与 files 中的 path 一致) */
  impactTarget?: string;
  /** 符号级影响时提供 */
  symbols?: string[];
  granularity?: 'file' | 'symbol';
  maxDependents?: number;
  maxEdges?: number;
}

// ---------- 符号引用查询(action=symbol) ----------

/**
 * 符号引用查询请求:回答"这个符号声明在哪、被哪些文件的哪一行引用"。
 *
 * 与依赖图的分工:依赖图给的是文件级边(谁依赖谁),
 * 这里给的是符号级明细(具体哪个变量/类型,在哪些行被用到),
 * 因此能覆盖同一文件内部的本地变量引用 —— 那是 edges 拿不到的。
 */
export interface StSymbolReferencesRequest {
  workspaceRoot: string;
  /** 参与分析的文件池(通常为目标文件 + 工作区上下文) */
  files: StTarget[];
  /** 要查询的符号名(区分大小写,与源码一致) */
  symbol: string;
  /** 可选:把声明限定在某个文件里,用于同名符号消歧 */
  path?: string;
  options?: StSymbolReferencesOptions;
}

export interface StSymbolReferencesOptions {
  /** 每处声明最多列出多少条引用,缺省 40 */
  maxReferences?: number;
  /** 最多列出多少处声明,缺省 20 */
  maxDeclarations?: number;
}

/** 一处引用点(使用处)。line/character 为 1 起的行列号。 */
export interface StSymbolReferenceLocation {
  file: string;
  line: number;
  character: number;
}

/** 一处声明及其被引用情况。 */
export interface StSymbolDeclaration {
  file: string;
  /** 声明时使用的原始名字(大小写保留) */
  name: string;
  /** 声明类型:FunctionBlock / Program / VarDeclarationInit / ... */
  type: string;
  line: number;
  character: number;
  /** 该声明被引用的总处数(可能大于 references.length,超出配额时见 truncated) */
  referenceCount: number;
  references: StSymbolReferenceLocation[];
}

export interface StSymbolReferencesResult {
  engine: StAnalyzerEngineInfo;
  /** 查询用的符号名 */
  symbol: string;
  /** 匹配到的声明处数。为 0 表示分析池内没有这个名字的声明 */
  declarationCount: number;
  declarations: StSymbolDeclaration[];
  /** 结果被配额截断(还有未列出的声明或引用) */
  truncated: boolean;
  elapsedMs: number;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseGraphEdges(value: unknown): StGraphEdge[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      return {
        from: asString(record.from),
        to: asString(record.to),
        symbols: asStringArray(record.symbols),
        kinds: asStringArray(record.kinds),
      };
    })
    .filter((edge) => edge.from && edge.to);
}

function parseStEngine(value: unknown): StAnalyzerEngineInfo {
  const engineWire = (value ?? {}) as Record<string, unknown>;
  const bundleMtime = asString(engineWire.bundleMtime);
  const sourceCommit = asString(engineWire.sourceCommit);
  const detail = [bundleMtime ? `bundle=${bundleMtime}` : '', sourceCommit ? `commit=${sourceCommit}` : '']
    .filter(Boolean)
    .join(' ');
  return {
    id: asString(engineWire.id, 'st-analyze'),
    ...(detail ? { detail } : {}),
  };
}

function parseBridgeEnvelope(raw: string): Record<string, unknown> {
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
  return parsed;
}

/** 解析 action=graph 的响应。结构异常归为协议错误(可降级),绝不返回假的空图。 */
export function parseStGraphResponse(raw: string): StGraphResult {
  const parsed = parseBridgeEnvelope(raw);
  const graph = (parsed.graph ?? {}) as Record<string, unknown>;
  const unresolvedRaw = Array.isArray(graph.unresolved) ? graph.unresolved : [];
  return {
    engine: parseStEngine(parsed.engine),
    files: asStringArray(graph.files),
    edges: parseGraphEdges(graph.edges),
    cycles: (Array.isArray(graph.cycles) ? graph.cycles : [])
      .map((group) => asStringArray(group))
      .filter((group) => group.length > 0),
    unresolved: unresolvedRaw.map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      return { file: asString(record.file), symbol: asString(record.symbol), count: asNumber(record.count) };
    }),
    externalCount: asNumber(graph.externalCount),
    elapsedMs: asNumber(parsed.elapsedMs),
  };
}

// ---------- 符号定义查询(桥协议 action=definition) ----------

/** 一处符号声明的位置。line/character 为 1 起的行列号。 */
export interface StDefinitionMatch {
  /** 声明所在文件 */
  file: string;
  /** 声明时使用的原始名字(大小写保留) */
  name: string;
  /** 声明类型:FunctionBlock / Program / VarGlobal / StFunction / ... */
  type: string;
  line: number;
  character: number;
}

export interface StDefinitionResult {
  engine: StAnalyzerEngineInfo;
  /** 查询用的符号名 */
  symbolName: string;
  /** 匹配到的全部声明(同名符号可能有多处,遮蔽场景由调用方结合上下文判断) */
  matches: StDefinitionMatch[];
  elapsedMs: number;
}

/** 解析 action=definition 的响应。 */
export function parseStDefinitionResponse(raw: string): StDefinitionResult {
  const parsed = parseBridgeEnvelope(raw);
  const definition = (parsed.definition ?? {}) as Record<string, unknown>;
  const rawMatches = Array.isArray(definition.matches) ? definition.matches : [];
  return {
    engine: parseStEngine(parsed.engine),
    symbolName: asString(definition.symbolName),
    matches: rawMatches
      .map((entry) => {
        const record = (entry ?? {}) as Record<string, unknown>;
        return {
          file: asString(record.file),
          name: asString(record.name),
          type: asString(record.type, 'unknown'),
          line: asNumber(record.line),
          character: asNumber(record.character),
        };
      })
      .filter((match) => match.file),
    elapsedMs: asNumber(parsed.elapsedMs),
  };
}

/** 解析 action=impact 的响应。 */
export function parseStImpactResponse(raw: string): StImpactResult {
  const parsed = parseBridgeEnvelope(raw);
  const impact = (parsed.impact ?? {}) as Record<string, unknown>;
  const bySymbolRaw = (impact.bySymbol && typeof impact.bySymbol === 'object' && !Array.isArray(impact.bySymbol))
    ? (impact.bySymbol as Record<string, unknown>)
    : undefined;
  const granularity = impact.granularity === 'symbol' ? 'symbol' : 'file';
  return {
    engine: parseStEngine(parsed.engine),
    target: asString(impact.target),
    granularity,
    directDependents: asStringArray(impact.directDependents),
    allDependents: asStringArray(impact.allDependents),
    ...(bySymbolRaw
      ? {
          bySymbol: Object.fromEntries(
            Object.entries(bySymbolRaw).map(([symbol, files]) => [symbol, asStringArray(files)]),
          ),
        }
      : {}),
    elapsedMs: asNumber(parsed.elapsedMs),
  };
}

/** 解析 action=symbol 的响应。结构异常归为协议错误(可降级),绝不返回假的空引用。 */
export function parseStSymbolReferencesResponse(raw: string): StSymbolReferencesResult {
  const parsed = parseBridgeEnvelope(raw);
  const references = (parsed.references ?? {}) as Record<string, unknown>;
  const rawDeclarations = Array.isArray(references.declarations) ? references.declarations : [];
  return {
    engine: parseStEngine(parsed.engine),
    symbol: asString(references.symbol),
    declarationCount: asNumber(references.declarationCount),
    declarations: rawDeclarations
      .map((entry): StSymbolDeclaration => {
        const record = (entry ?? {}) as Record<string, unknown>;
        const rawReferences = Array.isArray(record.references) ? record.references : [];
        return {
          file: asString(record.file),
          name: asString(record.name),
          type: asString(record.type, 'unknown'),
          line: asNumber(record.line),
          character: asNumber(record.character),
          referenceCount: asNumber(record.referenceCount),
          references: rawReferences
            .map((point) => {
              const location = (point ?? {}) as Record<string, unknown>;
              return {
                file: asString(location.file),
                line: asNumber(location.line),
                character: asNumber(location.character),
              };
            })
            .filter((location) => location.file),
        };
      })
      .filter((declaration) => declaration.file),
    truncated: references.truncated === true,
    elapsedMs: asNumber(parsed.elapsedMs),
  };
}