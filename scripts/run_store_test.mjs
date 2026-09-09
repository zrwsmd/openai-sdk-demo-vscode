import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonRunStore, JsonFileSession } from './agent.testbundle.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-run-store-test-'));
const file = path.join(dir, 'runs.json');
const store = new JsonRunStore(file);
const config = {
  baseUrl: 'http://mock/v1',
  model: 'mock',
  exportDir: dir,
  workspaceRoot: dir,
  policyContext: {
    allowedCommands: ['npm'],
    allowedDevices: ['plc-main'],
    dryRun: true,
  },
};

// Lifecycle records remain readable from a fresh store instance.
const run = await store.begin('export', config, 3, 'operation-1');
run.status = 'awaiting_approval';
run.state = '{"sdk":"state"}';
run.approvals = [{ id: 'call-1', name: 'write_file', args: '{}' }];
await store.update(run);
const restored = await new JsonRunStore(file).getActive();
if (restored?.state !== run.state || restored.approvals[0]?.id !== 'call-1') {
  throw new Error('durable approval checkpoint was not restored');
}
if (
  restored.config.policyContext?.dryRun !== true ||
  restored.config.policyContext.allowedCommands?.[0] !== 'npm' ||
  restored.config.policyContext.allowedDevices?.[0] !== 'plc-main'
) {
  throw new Error('policy context was not persisted with the durable run');
}
let activeConflict = false;
try {
  await store.begin('must-not-start', config, 3);
} catch (error) {
  activeConflict = error?.name === 'RunAlreadyActiveError';
}
if (!activeConflict) throw new Error('run store admitted two active runs');

const staleCopy = structuredClone(run);
await store.update({ ...run, status: 'cancelled' });
let staleConflict = false;
try {
  await store.update(staleCopy);
} catch (error) {
  staleConflict = /不能重新激活/.test(error?.message ?? '');
}
if (!staleConflict) throw new Error('terminal run was reactivated by a stale update');

// Each intentional occurrence executes once; a fresh retry replays both.
let executions = 0;
const first = await store.executeEffect('attempt-1', 'operation-1', 'write_file', { path: 'a.st', content: 'x' }, async () => {
  executions += 1;
  return 'written-1';
});
const second = await store.executeEffect('attempt-1', 'operation-1', 'write_file', { path: 'a.st', content: 'x' }, async () => {
  executions += 1;
  return 'written-2';
});
const replayFirst = await new JsonRunStore(file).executeEffect(
  'attempt-2',
  'operation-1',
  'write_file',
  { content: 'x', path: 'a.st' },
  async () => {
    executions += 1;
    return 'written-again';
  },
);
const replaySecond = await new JsonRunStore(file).executeEffect(
  'attempt-2',
  'operation-1',
  'write_file',
  { content: 'x', path: 'a.st' },
  async () => {
    executions += 1;
    return 'written-again';
  },
);
if (first !== 'written-1' || second !== 'written-2' || replayFirst !== first || replaySecond !== second || executions !== 2) {
  throw new Error('effect occurrence replay did not preserve exactly-once behavior');
}

// An uncertain effect is never guessed/replayed automatically.
let uncertainExecutions = 0;
try {
  await store.executeEffect('attempt-3', 'operation-2', 'run_command', { command: 'deploy' }, async () => {
    uncertainExecutions += 1;
    throw new Error('connection lost');
  });
} catch {}
try {
  await store.executeEffect('attempt-4', 'operation-2', 'run_command', { command: 'deploy' }, async () => {
    uncertainExecutions += 1;
    return 'should-not-run';
  });
} catch {}
if (uncertainExecutions !== 1) throw new Error('uncertain side effect was replayed');

// Session rollback returns to the exact pre-turn boundary.
const session = new JsonFileSession(path.join(dir, 'session.json'));
await session.addItems([
  { type: 'message', role: 'user', content: 'one' },
  { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'two' }] },
]);
await session.truncate(1);
if ((await session.getItems()).length !== 1) throw new Error('session truncate did not restore boundary');

console.log('run store tests passed: checkpoint restore, active-run lock, effect occurrences, uncertain-effect block, session rollback');
