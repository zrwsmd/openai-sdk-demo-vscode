export type CommandRiskLevel = 'low' | 'high' | 'blocked';

export interface CommandRisk {
  level: CommandRiskLevel;
  reason: string;
  executable: string;
}

const BLOCKED_COMMANDS = new Set([
  'shutdown',
  'format',
  'diskpart',
  'del',
  'erase',
  'rm',
  'rmdir',
  'rd',
  'remove-item',
  'clear-content',
  'clear-item',
  'stop-computer',
  'restart-computer',
  'format-volume',
  'mkfs',
  'dd',
]);

const PS_ALIASES: Record<string, string> = {
  gc: 'Get-Content',
  cat: 'Get-Content',
  type: 'Get-Content',
  gci: 'Get-ChildItem',
  ls: 'Get-ChildItem',
  dir: 'Get-ChildItem',
  gi: 'Get-Item',
  sls: 'Select-String',
  select: 'Select-Object',
  where: 'Where-Object',
  foreach: 'ForEach-Object',
  ft: 'Format-Table',
  fl: 'Format-List',
  echo: 'Write-Output',
  write: 'Write-Output',
  pwd: 'Get-Location',
  gl: 'Get-Location',
  cd: 'Set-Location',
  sl: 'Set-Location',
  rm: 'Remove-Item',
  rmdir: 'Remove-Item',
  ri: 'Remove-Item',
  del: 'Remove-Item',
  erase: 'Remove-Item',
  rd: 'Remove-Item',
  sc: 'Set-Content',
  cls: 'Clear-Host',
  sleep: 'Start-Sleep',
  curl: 'Invoke-WebRequest',
  wget: 'Invoke-WebRequest',
  iwr: 'Invoke-WebRequest',
  irm: 'Invoke-RestMethod',
  iex: 'Invoke-Expression',
  ipmo: 'Import-Module',
  ni: 'New-Item',
  mi: 'Move-Item',
  cpi: 'Copy-Item',
  copy: 'Copy-Item',
  move: 'Move-Item',
  ren: 'Rename-Item',
  rni: 'Rename-Item',
  kill: 'Stop-Process',
  spps: 'Stop-Process',
  saps: 'Start-Process',
  start: 'Start-Process',
};

const LOW_COMMANDS = new Set([
  'echo',
  'dir',
  'ls',
  'pwd',
  'type',
  'cat',
  'where',
  'which',
  'whoami',
  'hostname',
  'ver',
  'date',
  'findstr',
  'find',
  'rg',
  'grep',
  'more',
  'less',
  'head',
  'tail',
  'wc',
  'sort',
  'uniq',
  'fc',
  'tree',
  'printenv',
  'env',
]);

const LOW_PS_CMDLETS = new Set([
  'get-content',
  'get-childitem',
  'get-item',
  'get-command',
  'get-help',
  'get-location',
  'get-date',
  'get-host',
  'get-process',
  'get-service',
  'get-unique',
  'get-member',
  'get-variable',
  'get-alias',
  'get-module',
  'select-object',
  'select-string',
  'where-object',
  'foreach-object',
  'sort-object',
  'group-object',
  'measure-object',
  'compare-object',
  'format-table',
  'format-list',
  'format-wide',
  'format-custom',
  'write-output',
  'write-host',
  'write-verbose',
  'write-warning',
  'write-error',
  'write-debug',
  'write-information',
  'out-string',
  'out-null',
  'out-host',
  'convertto-json',
  'convertfrom-json',
  'convertto-csv',
  'convertfrom-csv',
  'join-path',
  'split-path',
  'join-string',
  'test-path',
  'resolve-path',
  'set-location',
  'push-location',
  'pop-location',
  'start-sleep',
  'clear-host',
  'measure-command',
]);

const HIGH_PS_CMDLETS = new Set([
  'set-content',
  'add-content',
  'clear-variable',
  'out-file',
  'tee-object',
  'new-item',
  'copy-item',
  'move-item',
  'rename-item',
  'new-itemproperty',
  'set-item',
  'set-itemproperty',
  'set-variable',
  'set-alias',
  'new-variable',
  'invoke-expression',
  'invoke-webrequest',
  'invoke-restmethod',
  'invoke-command',
  'invoke-item',
  'start-process',
  'start-job',
  'start-service',
  'stop-process',
  'stop-service',
  'restart-service',
  'import-module',
  'export-csv',
  'export-clixml',
  'install-module',
  'install-package',
  'uninstall-module',
  'uninstall-package',
  'update-module',
  'register-scheduledjob',
  'unregister-scheduledjob',
  'read-host',
  'wait-process',
]);

const HIGH_COMMANDS = new Set([
  'curl',
  'wget',
  'bitsadmin',
  'taskkill',
  'tskill',
  'sc',
  'net',
  'netsh',
  'reg',
  'msiexec',
  'wmic',
  'start',
  'setx',
  'sudo',
  'su',
  'chmod',
  'chown',
  'chattr',
  'mount',
  'umount',
  'tee',
  'npx',
  'bash',
  'sh',
  'zsh',
  'wsl',
]);

const GIT_LOW_SUBCOMMANDS = new Set([
  'status',
  'log',
  'diff',
  'show',
  'rev-parse',
  'describe',
  'ls-files',
  'blame',
  'grep',
  'version',
  'help',
  'shortlog',
  'whatchanged',
  'name-rev',
]);

const NPM_LOW_SUBCOMMANDS = new Set([
  '--version',
  '-v',
  '-h',
  '--help',
  'help',
  'ls',
  'list',
  'outdated',
  'view',
  'ping',
  'whoami',
  'root',
  'bin',
  'prefix',
]);

const VERSION_OR_HELP = /^(?:--version|-version|-v|-V|--help|-h|version|help)$/;

export function commandFromToolArgs(args: string | undefined): string {
  if (!args) return '';
  const trimmed = args.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && typeof (parsed as { command?: unknown }).command === 'string') {
      return (parsed as { command: string }).command;
    }
  } catch {
    return '';
  }
  return '';
}

export function classifyCommandRisk(command: string): CommandRisk {
  const text = command.trim();
  if (!text) {
    return { level: 'high', reason: '命令为空。', executable: '' };
  }
  const unwrapped = unwrapRepeated(text);
  const segments = splitSegments(unwrapped);
  if (!segments.length) {
    return { level: 'high', reason: '无法解析命令。', executable: '' };
  }
  let worst: CommandRisk = { level: 'low', reason: '只读查询命令。', executable: '' };
  for (const segment of segments) {
    const risk = classifySegment(segment);
    if (worse(risk.level, worst.level)) worst = risk;
    if (worst.level === 'blocked') return worst;
  }
  return worst;
}

function worse(left: CommandRiskLevel, right: CommandRiskLevel): boolean {
  const rank = { low: 0, high: 1, blocked: 2 };
  return rank[left] > rank[right];
}

function unwrapRepeated(command: string): string {
  let current = command.trim();
  for (let i = 0; i < 3; i++) {
    const next = unwrapShellWrapper(current);
    if (next === current) return current;
    current = next.trim();
  }
  return current;
}

function unwrapShellWrapper(command: string): string {
  const tokens = tokenize(command);
  if (!tokens.length) return command;
  const exe = normalizeExe(tokens[0]);
  if (exe === 'powershell' || exe === 'pwsh') {
    for (let i = 1; i < tokens.length; i++) {
      const flag = tokens[i].toLowerCase();
      if (['-encodedcommand', '-enc', '-ec', '-e'].includes(flag)) return command;
      if (['-file', '-f'].includes(flag)) return command;
      if (['-command', '-c'].includes(flag)) {
        return stripQuotes(tokens.slice(i + 1).join(' '));
      }
    }
    if (tokens.length > 1 && !tokens[1].startsWith('-')) {
      return tokens.slice(1).join(' ');
    }
    return command;
  }
  if (exe === 'cmd') {
    for (let i = 1; i < tokens.length; i++) {
      const flag = tokens[i].toLowerCase();
      if (flag === '/c' || flag === '/k' || flag === '/r') {
        return stripQuotes(tokens.slice(i + 1).join(' '));
      }
    }
  }
  return command;
}

function classifySegment(segment: string): CommandRisk {
  const trimmed = stripLeadingCall(segment.trim());
  if (!trimmed) return { level: 'low', reason: '空片段。', executable: '' };
  if (hasFileRedirection(trimmed)) {
    return { level: 'high', reason: '命令包含写入重定向。', executable: firstExecutable(trimmed) };
  }
  const tokens = tokenize(trimmed);
  if (!tokens.length) return { level: 'high', reason: '无法解析命令。', executable: '' };
  const executable = canonicalCommand(tokens[0]);
  const args = tokens.slice(1);
  const blocked = classifyBlocked(executable, trimmed);
  if (blocked) return blocked;
  const scriptblockRisk = classifyScriptblock(trimmed, executable);
  if (scriptblockRisk) return scriptblockRisk;

  if (executable === 'git') return classifyGit(args);
  if (executable === 'npm' || executable === 'pnpm' || executable === 'yarn') {
    return classifyNpm(executable, args);
  }
  if (executable === 'node') return classifyNode(args);
  if (executable === 'python' || executable === 'python3' || executable === 'py') {
    return classifyPython(executable, args);
  }
  if (LOW_COMMANDS.has(executable) || LOW_PS_CMDLETS.has(executable)) {
    return { level: 'low', reason: `${executable} 属于只读查询。`, executable };
  }
  if (executable.startsWith('get-') && executable !== 'get-credential') {
    return { level: 'low', reason: `${executable} 属于只读查询。`, executable };
  }
  if (
    HIGH_COMMANDS.has(executable) ||
    HIGH_PS_CMDLETS.has(executable) ||
    executable.startsWith('set-') ||
    executable.startsWith('new-') ||
    executable.startsWith('add-') ||
    executable.startsWith('invoke-') ||
    executable.startsWith('install-') ||
    executable.startsWith('uninstall-')
  ) {
    return { level: 'high', reason: `${executable} 可能修改系统或访问网络。`, executable };
  }
  if (args.some((arg) => VERSION_OR_HELP.test(arg)) && args.every((arg) => arg.startsWith('-') || VERSION_OR_HELP.test(arg))) {
    return { level: 'low', reason: `${executable} 仅查询版本或帮助。`, executable };
  }
  return { level: 'high', reason: `未识别为低风险命令：${executable}。`, executable };
}

function classifyBlocked(executable: string, segment: string): CommandRisk | undefined {
  if (BLOCKED_COMMANDS.has(executable)) {
    return { level: 'blocked', reason: `检测到破坏性命令 ${executable}。`, executable };
  }
  if (
    /\b(?:Stop-Computer|Restart-Computer|Format-Volume|Clear-Content|Remove-Item)\b/i.test(segment) &&
    !/^\s*(?:Get-Help|Get-Command|help)\b/i.test(segment)
  ) {
    const match = segment.match(/\b(Stop-Computer|Restart-Computer|Format-Volume|Clear-Content|Remove-Item)\b/i);
    const name = match?.[1] ?? executable;
    return { level: 'blocked', reason: `检测到破坏性命令 ${name}。`, executable: name.toLowerCase() };
  }
  return undefined;
}

function classifyScriptblock(segment: string, executable: string): CommandRisk | undefined {
  const blocks = segment.match(/\{[\s\S]*\}/g);
  if (!blocks) return undefined;
  for (const block of blocks) {
    if (/\b(?:Remove-Item|Clear-Content|Stop-Computer|Restart-Computer|Format-Volume|Invoke-Expression|Invoke-WebRequest|Set-Content|Out-File|Start-Process)\b/i.test(block)) {
      return { level: 'high', reason: '脚本块内包含高风险命令。', executable };
    }
  }
  return undefined;
}

function classifyGit(args: string[]): CommandRisk {
  if (args.some((arg) => VERSION_OR_HELP.test(arg)) && !args.some((arg) => !arg.startsWith('-') && !VERSION_OR_HELP.test(arg))) {
    return { level: 'low', reason: 'git 版本或帮助查询。', executable: 'git' };
  }
  const sub = (args[0] ?? '').toLowerCase();
  if (GIT_LOW_SUBCOMMANDS.has(sub)) {
    return { level: 'low', reason: `git ${sub} 属于只读查询。`, executable: 'git' };
  }
  if (sub === 'branch') {
    const rest = args.slice(1).join(' ');
    if (/(^|\s)(-[a-zA-Z]*[dDm]|--delete|--move|--force|-f)(\s|$)/.test(rest)) {
      return { level: 'high', reason: 'git branch 会修改分支。', executable: 'git' };
    }
    return { level: 'low', reason: 'git branch 属于只读查询。', executable: 'git' };
  }
  if (sub === 'remote') {
    const action = (args[1] ?? '').toLowerCase();
    if (!action || action === '-v' || action === '--verbose' || action === 'show' || action === 'get-url') {
      return { level: 'low', reason: 'git remote 属于只读查询。', executable: 'git' };
    }
  }
  if (sub === 'config' && args.includes('--get')) {
    return { level: 'low', reason: 'git config --get 属于只读查询。', executable: 'git' };
  }
  return { level: 'high', reason: `git ${sub || '命令'} 可能修改仓库。`, executable: 'git' };
}

function classifyNpm(executable: string, args: string[]): CommandRisk {
  const sub = (args[0] ?? '').toLowerCase();
  if (!sub || NPM_LOW_SUBCOMMANDS.has(sub)) {
    if (sub === 'config') {
      const action = (args[1] ?? '').toLowerCase();
      if (action === 'set' || action === 'delete' || action === 'rm') {
        return { level: 'high', reason: `${executable} config 会修改配置。`, executable };
      }
    }
    return { level: 'low', reason: `${executable} ${sub || '--version'} 属于只读查询。`, executable };
  }
  return { level: 'high', reason: `${executable} ${sub} 可能安装或发布软件包。`, executable };
}

function classifyNode(args: string[]): CommandRisk {
  if (args.some((arg) => VERSION_OR_HELP.test(arg)) && args.every((arg) => arg.startsWith('-') || VERSION_OR_HELP.test(arg))) {
    return { level: 'low', reason: 'node 版本或帮助查询。', executable: 'node' };
  }
  if (args.some((arg) => arg === '-e' || arg === '--eval' || arg === '-p' || arg === '--print')) {
    return { level: 'high', reason: 'node 会执行任意代码。', executable: 'node' };
  }
  return { level: 'high', reason: 'node 会执行脚本。', executable: 'node' };
}

function classifyPython(executable: string, args: string[]): CommandRisk {
  if (args.some((arg) => VERSION_OR_HELP.test(arg)) && args.every((arg) => arg.startsWith('-') || VERSION_OR_HELP.test(arg))) {
    return { level: 'low', reason: `${executable} 版本或帮助查询。`, executable };
  }
  if (args.some((arg) => arg === '-c' || arg === '--command')) {
    return { level: 'high', reason: `${executable} 会执行任意代码。`, executable };
  }
  return { level: 'high', reason: `${executable} 会执行脚本。`, executable };
}

function stripLeadingCall(segment: string): string {
  return segment.replace(/^(?:call|&)\s+/i, '').trim();
}

function firstExecutable(segment: string): string {
  const tokens = tokenize(stripLeadingCall(segment));
  return tokens.length ? canonicalCommand(tokens[0]) : '';
}

function canonicalCommand(token: string): string {
  const normalized = normalizeExe(token);
  const aliased = PS_ALIASES[normalized] ?? normalized;
  return aliased.toLowerCase();
}

function normalizeExe(token: string): string {
  let value = stripQuotes(token).trim();
  value = value.split(/[\\/]/).pop() ?? value;
  return value.replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase();
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function hasFileRedirection(segment: string): boolean {
  return /(?:^|[\s])(?:\d*)>>?(?![>&])/.test(segment);
}

function splitSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    const rest = command.slice(i);
    if (rest.startsWith('||') || rest.startsWith('&&')) {
      if (current.trim()) segments.push(current.trim());
      current = '';
      i += 1;
      continue;
    }
    if (ch === '|' || ch === ';' || ch === '\n') {
      if (current.trim()) segments.push(current.trim());
      current = '';
      continue;
    }
    if (ch === '&') {
      if (current.trim()) segments.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  const flush = () => {
    if (current) {
      tokens.push(current);
      current = '';
    }
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    current += ch;
  }
  flush();
  return tokens;
}
