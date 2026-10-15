export type CommandShell = 'auto' | 'native' | 'powershell';

export interface CommandRunnerOptions {
  cwd: string;
  command: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** auto 在支持的宿主上识别 PowerShell 语法；native 保持历史 shell 行为。 */
  shell?: CommandShell;
}

export interface CommandRunnerResult {
  exitCode: number | null;
  output: string;
}

export interface CommandRunner {
  readonly id: string;
  run(options: CommandRunnerOptions): Promise<CommandRunnerResult>;
}

/** 只识别 PowerShell 的常见命令/变量，不把普通 node/git/rg 命令误切换。 */
export function looksLikePowerShellCommand(command: string): boolean {
  const text = command.trim();
  return (
    /(?:^|[|;&\n]\s*)(?:Get|Set|Add|Clear|Remove|Select|Where|ForEach|Format|Out|Test|Resolve|Write|Read|Join|Split|Convert|Invoke|Measure|Sort|Group|Compare|Export|Import|New|Copy|Move|Rename|Start|Stop|Restart|Wait|Receive|Send|Install|Uninstall|Update|Register|Unregister)-[A-Za-z][\w-]*/i.test(text) ||
    /\$(?:env|global|local|script|using):[A-Za-z_][\w-]*/i.test(text) ||
    /(?:^|[\s|;&])\$_(?:\s|$|[|;&])/i.test(text) ||
    /(?:^|[\s|;&])\$[A-Za-z_][\w-]*(?:\s|$|[|;&=])/i.test(text)
  );
}
