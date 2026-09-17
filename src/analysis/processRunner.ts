/**
 * 进程端口(analysis 层,纯 Node)。
 *
 * 存在的意义:让"跑子进程"这件事本身也可替换。
 * 上层(SpawnStAnalyzer)不认识 child_process,单测注入假的执行器即可覆盖
 * 起不来/超时/噪声/坏 JSON 等分支,不需要真的装校验器。
 */
import { spawn } from 'node:child_process';

export interface ProcessRunOptions {
  cwd?: string;
  /** 额外环境变量(会与最小白名单合并,不会继承 API Key 等敏感变量)。 */
  env?: Record<string, string>;
  stdin?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 'last-json-line' 只取 stdout 最后一行(校验器有 Chevrotain 噪声)。 */
  stdoutMode?: 'raw' | 'last-json-line';
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
}

export interface ProcessRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
  timedOut: boolean;
}

export interface ProcessRunner {
  run(exe: string, args: string[], options: ProcessRunOptions): Promise<ProcessRunResult>;
}

/** 只透传运行 Node 所需的环境变量,刻意不继承凭据类变量。 */
const ENV_ALLOW_LIST = [
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'SYSTEMROOT',
  'windir',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
  'OS',
  'LANG',
];

export function minimalProcessEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ENV_ALLOW_LIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...(extra ?? {}) };
}

/** 取 stdout 里最后一个以 { 开头的平衡 JSON 行,容忍前置噪声。 */
export function lastJsonLine(raw: string): string {
  const lines = raw.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (line.startsWith('{') && line.endsWith('}')) return line;
  }
  return raw.trim();
}

export class NodeProcessRunner implements ProcessRunner {
  constructor(
    private readonly options: { maxStdoutBytes?: number; maxStderrBytes?: number } = {},
  ) {}

  async run(exe: string, args: string[], options: ProcessRunOptions): Promise<ProcessRunResult> {
    const startedAt = Date.now();
    const maxStdout = options.maxStdoutBytes ?? this.options.maxStdoutBytes ?? 4 * 1024 * 1024;
    const maxStderr = options.maxStderrBytes ?? this.options.maxStderrBytes ?? 8 * 1024;

    return new Promise<ProcessRunResult>((resolve, reject) => {
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(exe, args, {
          ...(options.cwd ? { cwd: options.cwd } : {}),
          env: minimalProcessEnv(options.env),
          shell: false,
          windowsHide: true,
        });
      } catch (error) {
        reject(error);
        return;
      }

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const isWindows = process.platform === 'win32';
      const killTree = (): void => {
        const pid = child.pid;
        if (!pid) return;
        if (isWindows) {
          // 与 workspaceTools.runCommand 同一策略:杀掉整棵子进程树
          const killer = spawn('taskkill.exe', ['/pid', String(pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
          });
          killer.once('error', () => child.kill('SIGKILL'));
          return;
        }
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      };

      const cleanup = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
      };

      const finish = (result: ProcessRunResult): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        killTree();
        // 与 run_command 一致:取消按异常向上抛,由运行层统一处理为 cancelled
        reject(options.signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'));
      };

      timer = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        killTree();
      }, options.timeoutMs ?? 20_000);

      options.signal?.addEventListener('abort', onAbort, { once: true });
      child.stdout?.on('data', (chunk: Buffer | string) => {
        if (stdout.length < maxStdout) stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer | string) => {
        if (stderr.length < maxStderr) stderr += chunk.toString();
      });
      child.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
      child.on('close', (code: number | null) => {
        const raw = options.stdoutMode === 'last-json-line' ? lastJsonLine(stdout) : stdout;
        finish({
          code: timedOut ? null : code,
          stdout: raw,
          stderr,
          elapsedMs: Date.now() - startedAt,
          timedOut,
        });
      });

      if (options.stdin !== undefined) child.stdin?.end(options.stdin);
      else child.stdin?.end();
      // 关闭初始检查与监听器安装之间的竞态
      if (options.signal?.aborted) onAbort();
    });
  }
}