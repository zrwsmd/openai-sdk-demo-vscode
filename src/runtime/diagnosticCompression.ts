import type { Diagnostic, DiagnosticSeverity } from "../protocol/results";

export type CompressibleDiagnostic = {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
  line?: number;
  character?: number;
  endLine?: number;
  endCharacter?: number;
  source?: string;
};

export interface DiagnosticSource {
  path: string;
  text: string;
}

export interface DiagnosticSnippet {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  truncated: boolean;
}

export interface CompressedDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
  line?: number;
  character?: number;
  endLine?: number;
  endCharacter?: number;
  source?: string;
  snippet?: DiagnosticSnippet;
  occurrenceCount: number;
}

export interface DiagnosticRepairPacket {
  kind: "diagnostic_repair_packet";
  toolName: string;
  phase: string;
  instruction: string;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  totalDiagnostics: number;
  duplicateCount: number;
  omittedCount: number;
  maxDiagnostics: number;
  snippetRadius: number;
  truncated: boolean;
  sourceHash?: string;
  diagnostics: CompressedDiagnostic[];
}

export interface DiagnosticCompressionOptions {
  toolName: string;
  phase?: string;
  instruction?: string;
  diagnostics: CompressibleDiagnostic[];
  sources?: DiagnosticSource[];
  sourceHash?: string;
  maxDiagnostics?: number;
  snippetRadius?: number;
  maxMessageChars?: number;
  maxSnippetChars?: number;
  maxTotalChars?: number;
}

const DEFAULT_MAX_DIAGNOSTICS = 6;
const DEFAULT_SNIPPET_RADIUS = 2;
const DEFAULT_MAX_MESSAGE_CHARS = 260;
const DEFAULT_MAX_SNIPPET_CHARS = 1200;
const DEFAULT_MAX_TOTAL_CHARS = 6000;

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  blocking: 0,
  error: 1,
  warning: 2,
  info: 3,
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) return { text: value, truncated: false };
  if (maxChars <= 3) return { text: value.slice(0, Math.max(0, maxChars)), truncated: true };
  return { text: `${value.slice(0, maxChars - 3)}...`, truncated: true };
}

function normalizeDiagnostic(diagnostic: CompressibleDiagnostic): CompressibleDiagnostic {
  const severity = diagnostic.severity;
  return {
    ...diagnostic,
    severity,
    code: diagnostic.code || "diagnostic",
    message: normalizeWhitespace(diagnostic.message || ""),
    path: diagnostic.path || undefined,
    line: typeof diagnostic.line === "number" && Number.isFinite(diagnostic.line) ? diagnostic.line : undefined,
    character:
      typeof diagnostic.character === "number" && Number.isFinite(diagnostic.character)
        ? diagnostic.character
        : undefined,
    endLine: typeof diagnostic.endLine === "number" && Number.isFinite(diagnostic.endLine) ? diagnostic.endLine : undefined,
    endCharacter:
      typeof diagnostic.endCharacter === "number" && Number.isFinite(diagnostic.endCharacter)
        ? diagnostic.endCharacter
        : undefined,
  };
}

function diagnosticKey(diagnostic: CompressibleDiagnostic): string {
  return [
    diagnostic.severity,
    diagnostic.code,
    diagnostic.path ?? "",
    diagnostic.line ?? "",
    diagnostic.character ?? "",
    diagnostic.message,
  ].join("\u0000");
}

function sortDiagnostics(a: CompressibleDiagnostic, b: CompressibleDiagnostic): number {
  const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (severity !== 0) return severity;
  const pathCompare = (a.path ?? "").localeCompare(b.path ?? "");
  if (pathCompare !== 0) return pathCompare;
  return (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER);
}

function countBySeverity(diagnostics: CompressibleDiagnostic[]): {
  error: number;
  warning: number;
  info: number;
} {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "blocking" || diagnostic.severity === "error") counts.error += 1;
    else if (diagnostic.severity === "warning") counts.warning += 1;
    else counts.info += 1;
  }
  return counts;
}

function sourceMatchesDiagnostic(source: DiagnosticSource, diagnostic: CompressibleDiagnostic): boolean {
  if (!diagnostic.path) return true;
  const sourcePath = source.path.replace(/\\/g, "/");
  const diagnosticPath = diagnostic.path.replace(/\\/g, "/");
  return sourcePath === diagnosticPath || sourcePath.endsWith(`/${diagnosticPath}`) || diagnosticPath.endsWith(`/${sourcePath}`);
}

function snippetForDiagnostic(
  diagnostic: CompressibleDiagnostic,
  sources: DiagnosticSource[],
  radius: number,
  maxChars: number,
): DiagnosticSnippet | undefined {
  if (!diagnostic.line || diagnostic.line < 1 || sources.length === 0) return undefined;
  const source = sources.find((candidate) => sourceMatchesDiagnostic(candidate, diagnostic)) ?? sources[0];
  const lines = source.text.split(/\r?\n/);
  if (diagnostic.line > lines.length) return undefined;
  const startLine = Math.max(1, diagnostic.line - radius);
  const endLine = Math.min(lines.length, diagnostic.line + radius);
  const snippetLines: string[] = [];
  for (let line = startLine; line <= endLine; line += 1) {
    const marker = line === diagnostic.line ? ">" : " ";
    snippetLines.push(`${marker} ${line}: ${lines[line - 1]}`);
  }
  const truncated = truncateText(snippetLines.join("\n"), maxChars);
  return {
    path: source.path,
    startLine,
    endLine,
    text: truncated.text,
    truncated: truncated.truncated,
  };
}

function buildCompressedDiagnostic(
  diagnostic: CompressibleDiagnostic,
  occurrenceCount: number,
  options: {
    sources: DiagnosticSource[];
    snippetRadius: number;
    maxMessageChars: number;
    maxSnippetChars: number;
  },
): CompressedDiagnostic {
  const message = truncateText(diagnostic.message, options.maxMessageChars);
  const snippet = snippetForDiagnostic(
    diagnostic,
    options.sources,
    options.snippetRadius,
    options.maxSnippetChars,
  );
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: message.text,
    ...(diagnostic.path ? { path: diagnostic.path } : {}),
    ...(diagnostic.line !== undefined ? { line: diagnostic.line } : {}),
    ...(diagnostic.character !== undefined ? { character: diagnostic.character } : {}),
    ...(diagnostic.endLine !== undefined ? { endLine: diagnostic.endLine } : {}),
    ...(diagnostic.endCharacter !== undefined ? { endCharacter: diagnostic.endCharacter } : {}),
    ...(diagnostic.source ? { source: diagnostic.source } : {}),
    ...(snippet ? { snippet } : {}),
    occurrenceCount,
  };
}

function shrinkToBudget(packet: DiagnosticRepairPacket, maxTotalChars: number): DiagnosticRepairPacket {
  let next = packet;
  while (JSON.stringify(next).length > maxTotalChars && next.diagnostics.length > 1) {
    next = {
      ...next,
      diagnostics: next.diagnostics.slice(0, -1),
      omittedCount: next.omittedCount + 1,
      truncated: true,
    };
  }
  if (JSON.stringify(next).length <= maxTotalChars) return next;
  return {
    ...next,
    diagnostics: next.diagnostics.map((diagnostic) => {
      if (!diagnostic.snippet) return diagnostic;
      return {
        ...diagnostic,
        snippet: {
          ...diagnostic.snippet,
          text: truncateText(diagnostic.snippet.text, 360).text,
          truncated: true,
        },
      };
    }),
    truncated: true,
  };
}

export function compressDiagnostics(options: DiagnosticCompressionOptions): DiagnosticRepairPacket {
  const maxDiagnostics = Math.max(1, options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS);
  const snippetRadius = Math.max(0, options.snippetRadius ?? DEFAULT_SNIPPET_RADIUS);
  const maxMessageChars = Math.max(24, options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS);
  const maxSnippetChars = Math.max(120, options.maxSnippetChars ?? DEFAULT_MAX_SNIPPET_CHARS);
  const maxTotalChars = Math.max(800, options.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS);
  const normalized = options.diagnostics.map(normalizeDiagnostic);
  const counts = countBySeverity(normalized);
  const byKey = new Map<string, { diagnostic: CompressibleDiagnostic; count: number }>();
  for (const diagnostic of normalized) {
    const key = diagnosticKey(diagnostic);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { diagnostic, count: 1 });
  }
  const unique = [...byKey.values()].sort((a, b) => sortDiagnostics(a.diagnostic, b.diagnostic));
  const selected = unique.slice(0, maxDiagnostics);
  const duplicateCount = normalized.length - unique.length;
  const packet: DiagnosticRepairPacket = {
    kind: "diagnostic_repair_packet",
    toolName: options.toolName,
    phase: options.phase ?? "repair",
    instruction:
      options.instruction ??
      "只根据下列诊断和代码片段做最小修改；保持无关代码不变，修改后必须重新运行同一个工具校验。",
    errorCount: counts.error,
    warningCount: counts.warning,
    infoCount: counts.info,
    totalDiagnostics: normalized.length,
    duplicateCount,
    omittedCount: unique.length - selected.length,
    maxDiagnostics,
    snippetRadius,
    truncated: unique.length > selected.length,
    ...(options.sourceHash ? { sourceHash: options.sourceHash } : {}),
    diagnostics: selected.map(({ diagnostic, count }) =>
      buildCompressedDiagnostic(diagnostic, count, {
        sources: options.sources ?? [],
        snippetRadius,
        maxMessageChars,
        maxSnippetChars,
      }),
    ),
  };
  return shrinkToBudget(packet, maxTotalChars);
}

export function repairPacketToProtocolDiagnostics(packet: DiagnosticRepairPacket): Diagnostic[] {
  if (packet.diagnostics.length === 0) {
    return [{
      code: "diagnostics_unavailable",
      severity: packet.errorCount > 0 ? "error" : "warning",
      message: "校验失败但未返回可压缩诊断，请重新生成完整草稿后再校验。",
    }];
  }
  return packet.diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: [
      diagnostic.line ? `L${diagnostic.line}` : undefined,
      diagnostic.message,
      diagnostic.occurrenceCount > 1 ? `重复 ${diagnostic.occurrenceCount} 次` : undefined,
    ].filter(Boolean).join(": "),
    ...(diagnostic.path ? { path: diagnostic.path } : {}),
    details: {
      repairPacket: true,
      line: diagnostic.line,
      character: diagnostic.character,
      snippet: diagnostic.snippet,
    },
  }));
}
