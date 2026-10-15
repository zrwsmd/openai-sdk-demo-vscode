import assert from 'node:assert/strict';
import {
  DefaultToolPolicy,
  classifyCommandRisk,
  shouldAutoApproveToolCall,
} from './agent.testbundle.mjs';

function level(command) {
  return classifyCommandRisk(command).level;
}

const low = [
  'node --version',
  'node -v',
  'git --version',
  'java -version',
  'git status',
  'git log --oneline',
  'echo hello',
  'dir',
  'Get-Content media/main.js | Select-Object -Skip 1125 -First 280',
  'Get-ChildItem',
  'powershell -NoProfile -Command "node --version"',
  'rg -n foo',
  'where node',
  'Format-Table',
  'git branch',
  'npm --version',
];
for (const command of low) {
  assert.equal(level(command), 'low', `${command} 应判定为低风险，实际 ${level(command)} (${classifyCommandRisk(command).reason})`);
}

const high = [
  'npm install',
  'git push',
  'git commit -m "x"',
  'node -e "require(\'fs\').writeFileSync(\'a\',\'b\')"',
  'node app.js',
  'Set-Content foo.txt bar',
  'Get-Content a | Set-Content b',
  'echo hi > out.txt',
  'curl https://example.com',
  'Invoke-WebRequest https://example.com',
  'Start-Process notepad',
  'npx eslint',
  'npm run build',
  'python script.py',
  'git branch -d old',
];
for (const command of high) {
  assert.equal(level(command), 'high', `${command} 应判定为高风险，实际 ${level(command)} (${classifyCommandRisk(command).reason})`);
}

const blocked = [
  'shutdown /s',
  'del file.txt',
  'Remove-Item -Recurse foo',
  'rm -rf tmp',
  'rmdir /s old',
  'Stop-Computer',
  'Format-Volume',
];
for (const command of blocked) {
  assert.equal(level(command), 'blocked', `${command} 应判定为阻断，实际 ${level(command)} (${classifyCommandRisk(command).reason})`);
}

assert.equal(
  shouldAutoApproveToolCall({
    permissionMode: 'auto',
    toolName: 'run_command',
    toolRisk: 'execute',
    args: JSON.stringify({ command: 'node --version' }),
  }),
  true,
);
assert.equal(
  shouldAutoApproveToolCall({
    permissionMode: 'auto',
    toolName: 'run_command',
    toolRisk: 'execute',
    args: JSON.stringify({ command: 'Get-Content media/main.js | Select-Object -First 20' }),
  }),
  true,
);
assert.equal(
  shouldAutoApproveToolCall({
    permissionMode: 'auto',
    toolName: 'run_command',
    toolRisk: 'execute',
    args: JSON.stringify({ command: 'npm install' }),
  }),
  false,
);
assert.equal(
  shouldAutoApproveToolCall({
    permissionMode: 'ask',
    toolName: 'run_command',
    toolRisk: 'execute',
    args: JSON.stringify({ command: 'node --version' }),
  }),
  false,
);
assert.equal(
  shouldAutoApproveToolCall({
    permissionMode: 'auto',
    toolName: 'write_file',
    toolRisk: 'write',
    args: JSON.stringify({ path: 'a.st', content: 'x' }),
  }),
  true,
);
assert.equal(
  shouldAutoApproveToolCall({
    permissionMode: 'full_access',
    toolName: 'run_command',
    toolRisk: 'execute',
    args: JSON.stringify({ command: 'npm install' }),
  }),
  true,
);

const policy = new DefaultToolPolicy();
assert.equal(policy.evaluate('run_command', { command: 'shutdown /s' }, { workspaceRoot: '.' }).allowed, false);
assert.equal(policy.evaluate('run_command', { command: 'Remove-Item foo' }, { workspaceRoot: '.' }).allowed, false);
assert.equal(policy.evaluate('run_command', { command: 'Format-Table' }, { workspaceRoot: '.' }).allowed, true);
assert.equal(policy.evaluate('run_command', { command: 'node --version' }, { workspaceRoot: '.' }).allowed, true);

console.log('command risk tests passed');
