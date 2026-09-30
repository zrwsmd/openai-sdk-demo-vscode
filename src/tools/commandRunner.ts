export interface CommandRunnerOptions {
  cwd: string;
  command: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface CommandRunnerResult {
  exitCode: number | null;
  output: string;
}

export interface CommandRunner {
  readonly id: string;
  run(options: CommandRunnerOptions): Promise<CommandRunnerResult>;
}
