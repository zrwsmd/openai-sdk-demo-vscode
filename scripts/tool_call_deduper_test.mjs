import assert from 'node:assert/strict';
import { ToolCallDeduper } from './agent.testbundle.mjs';

const logs = [];
const capabilities = {
  read_file: { risk: 'read', effect: 'none' },
  search_files: { risk: 'read', effect: 'none' },
  read_plc_variables: { risk: 'read', effect: 'device' },
  write_file: { risk: 'write', effect: 'filesystem' },
  run_command: { risk: 'execute', effect: 'process' },
};
const deduper = new ToolCallDeduper(
  (name) => capabilities[name],
  (message) => logs.push(message),
);

assert.equal(
  deduper.shouldSuppressStarted({
    toolName: 'read_file',
    args: '{"path":"a.txt","startLine":1,"endLine":0}',
    callId: 'read-1',
  }),
  false,
);
assert.equal(
  deduper.shouldSuppressCompleted({
    toolName: 'read_file',
    callId: 'read-1',
    ok: true,
    result: { ok: true },
  }),
  false,
);
assert.match(
  deduper.guard('read_file', { endLine: 0, startLine: 1, path: 'a.txt' }) ?? '',
  /相同参数成功执行过/u,
);
assert.equal(
  deduper.shouldSuppressStarted({
    toolName: 'read_file',
    args: '{"endLine":0,"path":"a.txt","startLine":1}',
    callId: 'read-2',
  }),
  true,
);
assert.equal(
  deduper.shouldSuppressCompleted({
    toolName: 'read_file',
    callId: 'read-2',
    ok: false,
    result: { ok: false },
  }),
  true,
);

const failedRead = new ToolCallDeduper(
  (name) => capabilities[name],
  () => undefined,
);
failedRead.shouldSuppressStarted({
  toolName: 'read_file',
  args: '{"path":"missing.txt"}',
  callId: 'failed-read',
});
failedRead.shouldSuppressCompleted({
  toolName: 'read_file',
  callId: 'failed-read',
  ok: false,
  result: { ok: false },
});
assert.equal(failedRead.guard('read_file', { path: 'missing.txt' }), undefined);

const invalidated = new ToolCallDeduper(
  (name) => capabilities[name],
  () => undefined,
);
invalidated.shouldSuppressStarted({
  toolName: 'read_file',
  args: '{"path":"changed.txt"}',
  callId: 'read-before-write',
});
invalidated.shouldSuppressCompleted({
  toolName: 'read_file',
  callId: 'read-before-write',
  ok: true,
  result: { ok: true },
});
invalidated.shouldSuppressStarted({
  toolName: 'write_file',
  args: '{"path":"changed.txt","content":"new"}',
  callId: 'write-1',
});
assert.equal(invalidated.guard('read_file', { path: 'changed.txt' }), undefined);

const parallel = new ToolCallDeduper(
  (name) => capabilities[name],
  () => undefined,
);
assert.equal(
  parallel.shouldSuppressStarted({
    toolName: 'read_file',
    args: '{"path":"one.txt"}',
    callId: 'parallel-1',
  }),
  false,
);
assert.equal(
  parallel.shouldSuppressStarted({
    toolName: 'read_file',
    args: '{"path":"two.txt"}',
    callId: 'parallel-2',
  }),
  false,
);
assert.equal(
  parallel.shouldSuppressStarted({
    toolName: 'read_plc_variables',
    args: '{"names":["Level"]}',
    callId: 'device-read-1',
  }),
  false,
);
parallel.shouldSuppressCompleted({
  toolName: 'read_plc_variables',
  callId: 'device-read-1',
  ok: true,
  result: { ok: true },
});
assert.equal(
  parallel.guard('read_plc_variables', { names: ['Level'] }),
  undefined,
);

assert.equal(logs.length, 2);
console.log('tool call deduper tests passed');
