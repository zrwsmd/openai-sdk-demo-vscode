import { spawn } from 'node:child_process';
import type {
  CommandRunner,
  CommandRunnerOptions,
  CommandRunnerResult,
} from './commandRunner';

const OUTPUT_LIMIT = 20_000;

function truncateOutput(output: string): string {
  return output.length > OUTPUT_LIMIT
    ? output.slice(0, OUTPUT_LIMIT) + '\n…(输出截断)'
    : output;
}

export class LocalCommandRunner implements CommandRunner {
  readonly id = 'local';

  async run(options: CommandRunnerOptions): Promise<CommandRunnerResult> {
    const {
      cwd,
      command,
      timeoutMs,
      signal,
    } = options;
    if (!cwd) throw new Error('未打开工作区文件夹,无法执行命令');
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const child = spawn(command, {
        cwd,
        shell: true,
        windowsHide: true,
        detached: !isWindows,
      });
      let out = '';
      let killed = false;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const terminateTree = () => {
        if (!child.pid) return;
        if (isWindows) {
          const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
          });
          killer.once('error', () => child.kill('SIGKILL'));
          return;
        }
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      };
      const onAbort = () => {
        if (settled) return;
        killed = true;
        terminateTree();
        settled = true;
        cleanup();
        reject(signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => {
        if (settled) return;
        killed = true;
        terminateTree();
        settled = true;
        cleanup();
        resolve({
          exitCode: null,
          output: `命令超时(${timeoutMs}ms)被终止:\n${truncateOutput(out)}`,
        });
      }, timeoutMs);
      child.stdout?.on('data', (d) => (out += d));
      child.stderr?.on('data', (d) => (out += d));
      child.on('error', (e) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`命令启动失败:${e.message}`));
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ exitCode: killed ? null : code, output: truncateOutput(out) });
      });
      // Close the race between the initial throwIfAborted() and listener setup.
      if (signal?.aborted) onAbort();
    });
  }
}
