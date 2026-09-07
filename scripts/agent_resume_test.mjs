import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonFileSession, JsonRunStore, runAgent } from './agent.testbundle.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-resume-test-'));
const sessionFile = path.join(dir, 'session.json');
const runFile = path.join(dir, 'runs.json');
const baseConfig = {
  baseUrl: 'http://127.0.0.1:8790/v1',
  apiKey: 'mock-key',
  model: 'mock-model',
  exportDir: path.join(dir, 'exports'),
  workspaceRoot: dir,
};

// First process: stop on approval and persist the SDK-native RunState.
const session1 = new JsonFileSession(sessionFile);
const store1 = new JsonRunStore(runFile);
const record = await store1.begin('把程序导出为文件', baseConfig, 0, 'operation-resume');
const first = await runAgent(baseConfig, session1, record.userText, () => {}, {
  onCheckpoint: async (checkpoint) => {
    record.status = 'awaiting_approval';
    record.state = checkpoint.state;
    record.approvals = checkpoint.approvals;
    record.usage = checkpoint.usage;
    await store1.update(record);
  },
});
if (first.status !== 'awaiting_approval' || !first.state || first.approvals?.length !== 1) {
  throw new Error('run did not return a durable approval checkpoint');
}

// Simulate extension-host restart with fresh Session/RunStore instances.
const session2 = new JsonFileSession(sessionFile);
const store2 = new JsonRunStore(runFile);
const restored = await store2.getActive();
if (!restored?.state || restored.approvals.length !== 1) throw new Error('checkpoint did not survive restart');
const approval = restored.approvals[0];
const resumed = await runAgent(
  {
    ...baseConfig,
    executeEffect: (name, input, execute) =>
      store2.executeEffect(restored.id, restored.operationId, name, input, execute),
  },
  session2,
  restored.userText,
  () => {},
  { initialState: restored.state, decisions: { [approval.id]: true } },
);
if (resumed.status !== 'completed') throw new Error(`resume returned ${resumed.status}`);
const exported = await fs.readdir(baseConfig.exportDir);
if (exported.filter((name) => name === 'StarDelta.st').length !== 1) {
  throw new Error('approved resumed tool did not execute exactly once');
}

// Replaying the same durable effect returns its prior result without executing.
let duplicateExecutions = 0;
await store2.executeEffect('retry-attempt', restored.operationId, 'export_st_program', {
  code: [
    'PROGRAM StarDelta',
    '  VAR',
    '    TON_Star : TON;',
    '  END_VAR',
    '  TON_Star(IN := Start_Btn, PT := T#5s);',
    '  Motor_Star := TON_Star.Q;',
    'END_PROGRAM',
  ].join('\n'),
}, async () => {
  duplicateExecutions += 1;
  return 'duplicate';
});
if (duplicateExecutions !== 0) throw new Error('durable side effect was repeated');

// An active model stream cooperatively cancels via AbortSignal.
const cancelSession = new JsonFileSession(path.join(dir, 'cancel-session.json'));
const controller = new AbortController();
setTimeout(() => controller.abort(), 10);
const cancelled = await runAgent(baseConfig, cancelSession, '你好', () => {}, { signal: controller.signal });
if (cancelled.status !== 'cancelled') throw new Error(`cancel returned ${cancelled.status}`);

console.log('agent resume tests passed: durable RunState resume, exactly-once effect, stream cancellation');
