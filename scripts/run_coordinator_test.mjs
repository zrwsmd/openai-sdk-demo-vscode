import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonFileSession, JsonRunStore, RunCoordinator } from './agent.testbundle.mjs';

const config = { baseUrl: 'http://mock/v1', model: 'mock', exportDir: '', workspaceRoot: '' };
const usage = { inputTokens: 1, outputTokens: 2, requests: 1 };

async function fixture(executeAgent) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-coordinator-test-'));
  const session = new JsonFileSession(path.join(dir, 'session.json'));
  const store = new JsonRunStore(path.join(dir, 'runs.json'));
  const events = [];
  const coordinator = new RunCoordinator({ session, store, executeAgent, emit: (event) => events.push(event) });
  return { dir, session, store, events, coordinator };
}

// Cancel rolls the partial Session turn back and exposes a retryable terminal run.
{
  const test = await fixture(async (_cfg, session, userText, options) => {
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    await new Promise((resolve) => options.signal.addEventListener('abort', resolve, { once: true }));
    return { status: 'cancelled', output: '', usage };
  });
  const running = test.coordinator.start('cancel me', config, 'key');
  await new Promise((resolve) => setTimeout(resolve, 10));
  await test.coordinator.initialize();
  if (!test.events.some((event) => event.type === 'runAttached')) throw new Error('live run was mistaken for a crash');
  await test.coordinator.stop();
  await running;
  if (!test.events.some((event) => event.type === 'agentEvent' && event.event.type === 'run.started')) {
    throw new Error('stable run.started protocol event missing');
  }
  if ((await test.session.getItems()).length !== 0) throw new Error('coordinator did not rollback cancelled session');
  if ((await test.store.getLast())?.status !== 'cancelled') throw new Error('cancelled run was not persisted');
  if (!test.events.some((event) => event.type === 'cancelled')) throw new Error('cancelled event missing');
}

// Stop can win the pre-controller startup window without allowing the model to run.
{
  let agentCalls = 0;
  const test = await fixture(async () => {
    agentCalls += 1;
    return { status: 'completed', output: 'unexpected', usage };
  });
  const starting = test.coordinator.start('instant stop', config, 'key');
  await test.coordinator.stop();
  await starting;
  if (agentCalls !== 0) throw new Error('stop raced with startup and still invoked the agent');
  if ((await test.store.getLast())?.status !== 'cancelled') throw new Error('pre-controller stop was not persisted');
}

// Retry reuses operationId while getting a new attempt/run id.
{
  let call = 0;
  const test = await fixture(async (_cfg, session, userText) => {
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    call += 1;
    if (call === 1) throw new Error('transient');
    await session.addItems([{
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'ok' }],
    }]);
    return { status: 'completed', output: 'ok', usage };
  });
  await test.coordinator.start('retry me', config, 'key');
  const failed = await test.store.getLast();
  if (failed?.status !== 'failed') throw new Error('failed run was not persisted');
  await test.coordinator.retry('key');
  const completed = await test.store.getLast();
  if (completed?.status !== 'completed' || completed.id === failed.id || completed.operationId !== failed.operationId) {
    throw new Error('retry identity contract is invalid');
  }
}

// Startup restores approvals, but rolls a crashed running turn back.
{
  const test = await fixture(async () => ({ status: 'completed', output: '', usage }));
  const waiting = await test.store.begin('approval', config, 0, 'approval-op');
  waiting.status = 'awaiting_approval';
  waiting.state = '{"state":true}';
  waiting.approvals = [{ id: 'call-1', name: 'write_file', args: '{}' }];
  await test.store.update(waiting);
  await test.coordinator.initialize();
  if (!test.events.some((event) => event.type === 'runRestored')) throw new Error('approval was not restored');

  await test.coordinator.stop(false);
  const running = await test.store.begin('crashed', config, 0, 'crash-op');
  await test.session.addItems([{ type: 'message', role: 'user', content: 'partial' }]);
  const freshEvents = [];
  const freshSession = new JsonFileSession(path.join(test.dir, 'session.json'));
  const fresh = new RunCoordinator({
    session: freshSession,
    store: new JsonRunStore(path.join(test.dir, 'runs.json')),
    emit: (event) => freshEvents.push(event),
  });
  await fresh.initialize();
  const recovered = await test.store.getLast();
  if (recovered?.id !== running.id || recovered.status !== 'failed') throw new Error('crashed run was not recovered');
  if ((await freshSession.getItems()).length !== 0) throw new Error('crashed run session was not rolled back');
  if (!freshEvents.some((event) => event.type === 'runRecovered')) throw new Error('recovery event missing');
}

console.log('run coordinator tests passed: cancel rollback, retry identity, approval/crash recovery');
