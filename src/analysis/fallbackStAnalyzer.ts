/**
 * 降级实现与组合器(analysis 层,纯 Node)。
 *
 * FallbackStAnalyzer 把原先藏在工具里的简易校验搬出来,变成可单测、可复用的实现:
 * 它同时是"校验器不可用时的兜底",也是"内核脱离宿主仍可独立运行"的默认实现。
 */
import {
  StAnalyzerUnavailableError,
  type StAnalyzer,
  type StDiagnostic,
  type StTarget,
  type StValidationRequest,
  type StValidationResult,
} from './stAnalyzer';
import { ST_ANALYZER_STATUS_CODES, ST_DIAGNOSTIC_CODES } from './stDiagnosticCodes';

function makeDiagnostic(path: string, code: string, message: string): StDiagnostic {
  return {
    severity: 'error',
    code,
    message,
    path,
    line: 1,
    character: 1,
    endLine: 1,
    endCharacter: 1,
    source: 'fallback',
  };
}

/** 内置简易规则:只做两件低成本的事,与接入真实校验器之前的工具行为一致。 */
export function fallbackStDiagnostics(target: StTarget): StDiagnostic[] {
  const diagnostics: StDiagnostic[] = [];
  if (!/END_PROGRAM/i.test(target.text)) {
    diagnostics.push(
      makeDiagnostic(target.path, ST_DIAGNOSTIC_CODES.parseError, '缺少 END_PROGRAM 结束标记'),
    );
  }
  if (/\bTON\b/i.test(target.text) && !/T#/.test(target.text)) {
    diagnostics.push(
      makeDiagnostic(target.path, ST_DIAGNOSTIC_CODES.timerLiteralMissing, '使用了 TON 但未发现时间字面量(如 T#5s)'),
    );
  }
  return diagnostics;
}

export class FallbackStAnalyzer implements StAnalyzer {
  readonly id = 'fallback';

  constructor(private readonly reason: string = ST_ANALYZER_STATUS_CODES.notConfigured) {}

  async verify(request: StValidationRequest): Promise<StValidationResult> {
    const startedAt = Date.now();
    return {
      engine: { id: 'fallback', fallbackReason: this.reason },
      results: request.targets.map((target) => ({
        path: target.path,
        diagnostics: fallbackStDiagnostics(target),
      })),
      contextLoaded: 0,
      elapsedMs: Date.now() - startedAt,
    };
  }
}

/**
 * 组合策略:主实现不可用时切到兜底,并把降级原因带进结果。
 * 降级必须可见(engine.fallbackReason),绝不静默把"没校验"当"通过"。
 */
export class ResilientStAnalyzer implements StAnalyzer {
  readonly id = 'resilient';

  constructor(
    private readonly primary: StAnalyzer,
    private readonly fallback: StAnalyzer = new FallbackStAnalyzer(),
  ) {}

  async verify(
    request: StValidationRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StValidationResult> {
    try {
      return await this.primary.verify(request, context);
    } catch (error) {
      if (error instanceof StAnalyzerUnavailableError) {
        const result = await this.fallback.verify(request, context);
        return {
          ...result,
          engine: {
            ...result.engine,
            fallbackReason: error.code,
            ...(error.detail ? { detail: error.detail } : {}),
          },
        };
      }
      throw error; // 取消/未知错误照常向上抛,不伪装成校验结论
    }
  }
}