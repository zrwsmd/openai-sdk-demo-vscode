/**
 * 真实实现(analysis 层,纯 Node)。
 *
 * 只做三件事:把请求编码成桥协议、通过注入的 ProcessRunner 执行、把响应解码成诊断。
 * 它不知道 vendor 目录在哪、用哪个 node、有哪些宿主配置 —— 这些都由构造参数传入。
 */
import {
  parseStAnalyzerResponse,
  parseStGraphResponse,
  parseStImpactResponse,
  ST_ANALYZER_PROTOCOL_VERSION,
  StAnalyzerUnavailableError,
  type StAnalyzer,
  type StAnalyzerLaunch,
  type StGraphRequest,
  type StGraphResult,
  type StImpactRequest,
  type StImpactResult,
  type StValidationRequest,
  type StValidationResult,
} from './stAnalyzer';
import type { ProcessRunner } from './processRunner';

export interface SpawnStAnalyzerConfig {
  /** 有序候选:第一个能跑通的即采用(探测链由宿主给出)。 */
  launches: StAnalyzerLaunch[];
  runner: ProcessRunner;
  timeoutMs?: number;
  maxDiagnostics?: number;
  now?: () => number;
}

export class SpawnStAnalyzer implements StAnalyzer {
  readonly id = 'st-analyze';

  constructor(private readonly cfg: SpawnStAnalyzerConfig) {}

  async verify(
    request: StValidationRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StValidationResult> {
    const startedAt = this.now();
    const raw = await this.runAction('validate', {
      workspaceRoot: request.workspaceRoot,
      targets: request.targets,
      context: request.context ?? [],
      options: {
        maxDiagnostics: request.options?.maxDiagnostics ?? this.cfg.maxDiagnostics ?? 200,
      },
    }, context);
    const parsed = parseStAnalyzerResponse(raw);
    return { ...parsed, elapsedMs: parsed.elapsedMs || this.now() - startedAt };
  }

  async dependencyGraph(
    request: StGraphRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StGraphResult> {
    const startedAt = this.now();
    const raw = await this.runAction('graph', {
      workspaceRoot: request.workspaceRoot,
      files: request.files,
      options: request.options ?? {},
    }, context);
    const parsed = parseStGraphResponse(raw);
    return { ...parsed, elapsedMs: parsed.elapsedMs || this.now() - startedAt };
  }

  async changeImpact(
    request: StImpactRequest,
    context?: { signal?: AbortSignal },
  ): Promise<StImpactResult> {
    const startedAt = this.now();
    const raw = await this.runAction('impact', {
      workspaceRoot: request.workspaceRoot,
      files: request.files,
      options: {
        ...(request.options ?? {}),
        impactTarget: request.target,
        ...(request.symbols ? { symbols: request.symbols } : {}),
        ...(request.granularity ? { granularity: request.granularity } : {}),
      },
    }, context);
    const parsed = parseStImpactResponse(raw);
    return { ...parsed, elapsedMs: parsed.elapsedMs || this.now() - startedAt };
  }

  /**
   * 执行一次桥动作(validate/graph/impact 共用)。
   * 按候选链依次尝试;不可用错误换下一个候选;取消原样上抛。
   */
  private async runAction(
    action: string,
    payload: Record<string, unknown>,
    context?: { signal?: AbortSignal },
  ): Promise<string> {
    if (!this.cfg.launches.length) {
      throw new StAnalyzerUnavailableError('st_analyzer_not_configured', 'no launch candidate');
    }
    let lastError: StAnalyzerUnavailableError | undefined;
    for (const launch of this.cfg.launches) {
      try {
        return await this.runActionOn(launch, action, payload, context);
      } catch (error) {
        // 用户取消不是"换个候选再试"的场景,直接向上抛,由运行层判定 cancelled
        if (context?.signal?.aborted) throw error;
        if (error instanceof StAnalyzerUnavailableError) {
          lastError = error;
          continue;
        }
        lastError = new StAnalyzerUnavailableError(
          'st_analyzer_unavailable',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    throw lastError ?? new StAnalyzerUnavailableError('st_analyzer_unavailable', 'all candidates failed');
  }

  private async runActionOn(
    launch: StAnalyzerLaunch,
    action: string,
    payload: Record<string, unknown>,
    context?: { signal?: AbortSignal },
  ): Promise<string> {
    const run = await this.cfg.runner.run(launch.exe, launch.args, {
      cwd: launch.cwd,
      ...(launch.env ? { env: launch.env } : {}),
      stdin: JSON.stringify({
        protocolVersion: ST_ANALYZER_PROTOCOL_VERSION,
        action,
        ...payload,
      }),
      timeoutMs: this.cfg.timeoutMs ?? 20_000,
      ...(context?.signal ? { signal: context.signal } : {}),
      stdoutMode: 'last-json-line',
    });

    if (run.timedOut) {
      throw new StAnalyzerUnavailableError(
        'st_analyzer_timeout',
        `exceeded ${this.cfg.timeoutMs ?? 20_000}ms`,
      );
    }
    if (run.code === 2) {
      throw new StAnalyzerUnavailableError('st_analyzer_unavailable', firstLine(run.stderr));
    }
    if (run.code === 3) {
      throw new StAnalyzerUnavailableError('st_analyzer_protocol_error', firstLine(run.stderr));
    }
    if (run.code !== 0) {
      throw new StAnalyzerUnavailableError(
        'st_analyzer_unavailable',
        `exit=${String(run.code)} ${firstLine(run.stderr)}`.trim(),
      );
    }
    return run.stdout;
  }

  private now(): number {
    return this.cfg.now?.() ?? Date.now();
  }
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean) ?? '';
  return line.slice(0, 300);
}