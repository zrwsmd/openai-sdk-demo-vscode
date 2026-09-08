import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DefaultToolPolicy,
  JsonAuditSink,
  MockPlcAdapter,
  createIndustrialAgentTeam,
  toolResult,
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
assert.deepEqual(result, { ok: true, data: { value: 1 }, effect: 'none', risk: 'read' });

const plc = new MockPlcAdapter();
const table = await plc.getIoTable();
assert.ok(table.length >= 5);
assert.deepEqual((await plc.readVariables(['Motor_Main'])).map((item) => item.name), ['Motor_Main']);

const team = createIndustrialAgentTeam('gpt-4o-mini', []);
assert.equal(team.planner.handoffs.length, 2);
assert.equal(team.reviewer.tools.length, 0);

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
