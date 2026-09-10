import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  DefaultToolPolicy,
  JsonAuditSink,
  MockPlcAdapter,
  createIndustrialAgentTeam,
  inferRequiredTool,
  industrialAgentOutputDefinition,
  industrialAgentOutputSchema,
  parseToolResult,
  reviewReportToToolResult,
  verifyWorkspaceWrite,
  toolResult,
  DefaultActionPolicy,
  WorkspaceScope,
} from './agent.testbundle.mjs';

const policy = new DefaultToolPolicy();

assert.deepEqual(policy.evaluate('read_file', { path: 'main.st' }, { workspaceRoot: '.' }), {
  allowed: true,
  requiresApproval: false,
  risk: 'read',
});
assert.equal(
  policy.evaluate('write_file', { path: 'main.st' }, { workspaceRoot: '.', dryRun: true }).allowed,
  false,
);
assert.equal(
  policy.evaluate('run_command', { command: 'shutdown /s' }, { workspaceRoot: '.' }).allowed,
  false,
);
assert.equal(
  policy.evaluate('run_command', { command: 'node --version' }, {
    workspaceRoot: '.',
    allowedCommands: ['npm'],
  }).allowed,
  false,
);

const result = JSON.parse(toolResult({ ok: true, data: { value: 1 }, effect: 'none', risk: 'read' }));
assert.deepEqual(result, {
  protocolVersion: 1,
  ok: true,
  data: { value: 1 },
  diagnostics: [],
  effect: 'none',
  risk: 'read',
});

const plc = new MockPlcAdapter();
const table = await plc.getIoTable();
assert.ok(table.length >= 5);
assert.deepEqual((await plc.readVariables(['Motor_Main'])).map((item) => item.name), ['Motor_Main']);

const team = createIndustrialAgentTeam('gpt-4o-mini', []);
assert.equal(team.planner.handoffs.length, 1);
assert.equal(team.planner.tools.length, 1);
assert.equal(team.planner.tools[0].name, 'review_plc_plan');
assert.equal(team.reviewer.tools.length, 0);
assert.equal(team.executor.tools.length, 0);

const approvedReview = {
  approved: true,
  summary: '方案满足基本安全要求',
  findings: [],
  requiredChanges: [],
};
const approvedToolResult = parseToolResult(JSON.parse(reviewReportToToolResult(approvedReview)));
assert.equal(approvedToolResult.ok, true);
assert.deepEqual(approvedToolResult.data, approvedReview);
assert.equal(approvedToolResult.error, undefined);

const rejectedReview = {
  approved: false,
  summary: '急停回路缺少复位互锁',
  findings: ['急停后未限制自动重启'],
  requiredChanges: ['增加人工复位条件'],
};
const rejectedToolResult = parseToolResult(JSON.parse(reviewReportToToolResult(rejectedReview)));
assert.equal(rejectedToolResult.ok, false);
assert.deepEqual(rejectedToolResult.data, rejectedReview);
assert.equal(rejectedToolResult.error, 'PLC 安全审查未通过: 急停回路缺少复位互锁');

const structuredValue = industrialAgentOutputSchema.parse({
  message: '程序已校验',
  diagnostics: [],
  artifacts: [],
  data: null,
});
assert.equal(structuredValue.message, '程序已校验');
assert.equal(inferRequiredTool('请把你好写入当前项目的 op.txt 文件'), 'write_file');
assert.equal(inferRequiredTool('write this content to config.json'), 'write_file');
assert.equal(inferRequiredTool('写你好我是agent这5个字到rr.txt下面'), 'write_file');
assert.equal(inferRequiredTool('读取 lk.txt 文件里面的内容'), 'read_file');
assert.equal(inferRequiredTool('读取 `lk.txt` 文件里面的内容'), 'read_file');
assert.equal(inferRequiredTool('读取并修改 lk.txt 文件'), 'write_file');
assert.equal(inferRequiredTool('不要读取 lk.txt，只解释读取工具'), undefined);
assert.equal(inferRequiredTool('只解释一下 write_file 的作用，不要执行写入'), undefined);
assert.equal(inferRequiredTool('请把这段 ST 程序导出保存'), 'export_st_program');
assert.equal(inferRequiredTool('请运行这个命令检查工程'), 'run_command');
const outputFormat = zodTextFormat(industrialAgentOutputSchema, 'industrial_agent_output');
const assertClosedObjects = (value) => {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'object') assert.notEqual(value.additionalProperties, true);
  for (const child of Object.values(value)) assertClosedObjects(child);
};
assertClosedObjects(outputFormat.schema);
const assertTypedSchemaBranches = (value, path = 'schema') => {
  if (!value || typeof value !== 'object') return;
  const hasCombiner = ['anyOf', 'oneOf', 'allOf'].some((key) => Array.isArray(value[key]));
  const hasTypedForm = ['type', '$ref', 'const', 'enum'].some((key) => Object.hasOwn(value, key));
  assert.ok(hasTypedForm || hasCombiner, `${path} must declare a JSON Schema type or combiner`);
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (!Array.isArray(value[key])) continue;
    value[key].forEach((child, index) => assertTypedSchemaBranches(child, `${path}.${key}[${index}]`));
  }
  if (value.properties && typeof value.properties === 'object') {
    for (const [key, child] of Object.entries(value.properties)) {
      assertTypedSchemaBranches(child, `${path}.properties.${key}`);
    }
  }
  if (value.items && typeof value.items === 'object') assertTypedSchemaBranches(value.items, `${path}.items`);
  if (value.additionalProperties && typeof value.additionalProperties === 'object') {
    assertTypedSchemaBranches(value.additionalProperties, `${path}.additionalProperties`);
  }
};
assertTypedSchemaBranches(outputFormat.schema);
const structuredTeam = createIndustrialAgentTeam('gpt-4o-mini', []);
const parsedPlannerOutput = structuredTeam.planner.outputType.parse(structuredValue);
assert.equal(parsedPlannerOutput.message, '程序已校验');
const parsedExecutorOutput = structuredTeam.executor.outputType.parse(structuredValue);
assert.equal(parsedExecutorOutput.message, '程序已校验');
assert.equal(structuredTeam.planner.outputType, industrialAgentOutputDefinition.schema);
assert.equal(structuredTeam.executor.outputType, industrialAgentOutputDefinition.schema);

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-write-'));
try {
  await fs.writeFile(path.join(workspace, 'op.txt'), '你好', 'utf8');
  const artifact = await verifyWorkspaceWrite(workspace, 'op.txt', '你好');
  assert.equal(artifact.kind, 'file');
  assert.equal(artifact.name, 'op.txt');
  await assert.rejects(
    verifyWorkspaceWrite(workspace, 'op.txt', '错误内容'),
    /文件校验失败/,
  );
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}

const scopeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-scope-'));
const scopeOther = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-scope-other-'));
const scopeOutside = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-scope-outside-'));
try {
  const scope = new WorkspaceScope([scopeRoot, scopeOther]);
  assert.equal(scope.resolve('lk.txt').root, path.resolve(scopeRoot));
  assert.equal(scope.resolve('`lk.txt`').relativePath, 'lk.txt');
  const otherFile = path.join(scopeOther, 'remote.txt');
  await fs.writeFile(otherFile, 'remote', 'utf8');
  assert.equal(scope.resolve(otherFile).root, path.resolve(scopeOther));
  assert.throws(() => scope.resolve(path.join(scopeOutside, 'blocked.txt')), /不在已授权工作区内/);
  assert.equal(new DefaultActionPolicy().requiredToolFor('读取 lk.txt 文件里面的内容'), 'read_file');
} finally {
  await fs.rm(scopeRoot, { recursive: true, force: true });
  await fs.rm(scopeOther, { recursive: true, force: true });
  await fs.rm(scopeOutside, { recursive: true, force: true });
}

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-audit-'));
try {
  const sink = new JsonAuditSink(path.join(directory, 'audit.json'));
  await Promise.all([
    sink.append({ type: 'run_started', runId: 'run-1' }),
    sink.append({ type: 'guardrail_evaluated', runId: 'run-1', decision: 'allow' }),
    sink.append({ type: 'run_completed', runId: 'run-1', ok: true }),
  ]);
  const events = await sink.read();
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.type), [
    'run_started',
    'guardrail_evaluated',
    'run_completed',
  ]);
  assert.ok(events.every((event) => event.id && event.timestamp));
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}

console.log('sdk foundation tests passed');
