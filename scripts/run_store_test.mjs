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

// A user stop with a serialized SDK state is resumable; resume must create a
// fresh active attempt while preserving the exact checkpoint and operation id.
const paused = await store.begin('resume me', config, 3, 'operation-resume');
paused.status = 'paused';
paused.state = '{"sdk":"resume-state"}';
paused.canContinue = true;
await store.update(paused);
const continuable = await store.getContinuable();
if (continuable?.id !== paused.id || continuable.state !== paused.state) {
  throw new Error('continuable checkpoint was not discovered');
}
const resumed = await store.resume(paused.id);
if (
  resumed.status !== 'running' ||
  resumed.canContinue ||
  resumed.state !== paused.state ||
  resumed.operationId !== paused.operationId
) {
  throw new Error('resume did not preserve the checkpoint');
}
resumed.status = 'completed';
resumed.result = undefined;
await store.update(resumed);

const earlyPaused = await store.begin('stopped immediately', config, 3, 'operation-early-resume');
earlyPaused.status = 'paused';
earlyPaused.canContinue = true;
await store.update(earlyPaused);
const earlyContinuable = await store.getContinuable();
if (earlyContinuable?.id !== earlyPaused.id || earlyContinuable.state !== undefined) {
  throw new Error('state-less safe continuation was not discovered');
}

// Generic linear plans are validated and survive a fresh store instance.
const planned = await store.begin('multi-step task', config, 3, 'operation-plan', {
  schemaVersion: 1,
  id: 'plan-1',
  goal: '完成一个多步任务',
  reason: '包含两个有顺序的动作',
  status: 'pending',
  steps: [
    { id: 'step-1', title: '准备', objective: '准备输入', completionCriteria: '输入已确认', suggestedTools: [], status: 'pending' },
    { id: 'step-2', title: '执行', objective: '执行目标动作', completionCriteria: '动作已完成', suggestedTools: [], status: 'pending' },
  ],
});
await store.update(planned);
const plannedRestored = await new JsonRunStore(file).getLast();
if (plannedRestored?.plan?.steps.length !== 2 || plannedRestored.plan.goal !== '完成一个多步任务') {
  throw new Error('task plan was not persisted with the durable run');
}
planned.status = 'completed';
planned.plan.status = 'completed';
planned.plan.steps.forEach((step) => { step.status = 'completed'; });
await store.update(planned);

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

const firstAccessSession = new JsonFileSession(path.join(dir, 'first-access-session.json'));
const firstSessionId = await firstAccessSession.getSessionId();
if (firstSessionId !== await firstAccessSession.getSessionId()) throw new Error('session id changed before first persistence');

// Separate session instances for the same UI storage path share the same
// serialized queue; a clear cannot be overwritten by a stale instance write.
const sharedSessionPath = path.join(dir, 'shared-session.json');
const staleSession = new JsonFileSession(sharedSessionPath);
const currentSession = new JsonFileSession(sharedSessionPath);
await staleSession.addItems([{ type: 'message', role: 'user', content: 'stale' }]);
await staleSession.getItems();
const pendingAdd = staleSession.addItems([{ type: 'message', role: 'user', content: 'late' }]);
const pendingClear = currentSession.clearSession();
await Promise.all([pendingAdd, pendingClear]);
if ((await currentSession.getItems()).length !== 0) throw new Error('shared session clear was overwritten by a stale instance');

console.log('run store tests passed: checkpoint restore, active-run lock, effect occurrences, uncertain-effect block, session rollback, shared session queue');
