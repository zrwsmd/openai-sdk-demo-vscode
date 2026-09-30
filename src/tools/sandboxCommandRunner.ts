import {
  DockerSandboxClient,
  Manifest,
  localBindMountStrategy,
  mount,
} from '@openai/agents/sandbox/local';
import type {
  CommandRunner,
  CommandRunnerOptions,
  CommandRunnerResult,
} from './commandRunner';

const OUTPUT_LIMIT = 20_000;

export interface SandboxCommandRunnerOptions {
  image?: string;
  networkMode?: 'none';
}

function truncateOutput(output: string): string {
  return output.length > OUTPUT_LIMIT
    ? output.slice(0, OUTPUT_LIMIT) + '\n…(输出截断)'
    : output;
}

async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  onAbort: () => Promise<void>,
): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();
  let removeAbortListener: (() => void) | undefined;
  const abortPromise = new Promise<T>((_, reject) => {
    const handleAbort = () => {
      void onAbort().finally(() => {
        reject(signal.reason ?? new DOMException('The operation was aborted', 'AbortError'));
      });
    };
    signal.addEventListener('abort', handleAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener('abort', handleAbort);
  });
  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    removeAbortListener?.();
  }
}

export class SandboxCommandRunner implements CommandRunner {
  readonly id = 'dockerSandbox';

  private readonly client: DockerSandboxClient;

  constructor(options: SandboxCommandRunnerOptions = {}) {
    this.client = new DockerSandboxClient({
      ...(options.image ? { image: options.image } : {}),
      ...(options.networkMode ? { networkMode: options.networkMode } : {}),
    });
  }

  async run(options: CommandRunnerOptions): Promise<CommandRunnerResult> {
    const {
      cwd,
      command,
      timeoutMs,
      signal,
    } = options;
    if (!cwd) throw new Error('未打开工作区文件夹,无法执行命令');
    signal?.throwIfAborted();
    const manifest = new Manifest({
      root: '/workspace',
      entries: {
        '': mount({
          source: cwd,
          readOnly: false,
          mountStrategy: localBindMountStrategy(),
        }),
      },
    });
    const session = await abortable(
      this.client.create({ manifest }),
      signal,
      async () => undefined,
    );
    try {
      const result = await abortable(
        session.exec!({
          cmd: command,
          workdir: '/workspace',
          shell: '/bin/sh',
          login: false,
          tty: false,
          yieldTimeMs: timeoutMs,
          maxOutputTokens: 8_000,
        }),
        signal,
        async () => {
          await session.close?.();
        },
      );
      if (result.sessionId !== undefined && result.exitCode === undefined) {
        await session.close?.();
        return {
          exitCode: null,
          output: `命令超时(${timeoutMs}ms)被终止:\n${truncateOutput(result.output ?? '')}`,
        };
      }
      return {
        exitCode: result.exitCode ?? null,
        output: truncateOutput(result.output ?? ''),
      };
    } finally {
      await session.close?.();
    }
  }
}
