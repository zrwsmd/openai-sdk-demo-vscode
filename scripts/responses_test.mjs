import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentEventFactory,
  JsonFileSession,
  resolveApiFormat,
  resolveModelRoute,
  runAgent,
} from './agent.testbundle.mjs';

assert.equal(resolveApiFormat('http://mock/v1'), 'chat_completions');
assert.equal(resolveApiFormat(''), 'responses');
assert.equal(resolveApiFormat('http://mock/v1', 'responses'), 'responses');
assert.equal(
  resolveModelRoute({
    provider: 'openai',
    apiFormat: 'responses',
    baseUrl: 'http://mock/v1',
    apiKey: 'mock-key',
    model: 'mock-responses',
  }).apiFormat,
  'responses',
);

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-responses-test-'));
const port = process.env.MOCK_GATEWAY_PORT || '8790';
const config = {
  provider: 'openai',
  apiFormat: 'responses',
  baseUrl: `http://127.0.0.1:${port}/v1`,
  apiKey: 'mock-key',
  model: 'mock-responses',
  exportDir: path.join(dir, 'exports'),
  workspaceRoot: dir,
};
const session = new JsonFileSession(path.join(dir, 'session.json'));
let runNumber = 0;

async function runTestTurn(text) {
  const runId = `responses-${++runNumber}`;
  const events = [];
  const result = await runAgent(config, session, text, {
    protocol: {
      runId,
      operationId: runId,
      eventFactory: new AgentEventFactory(runId, runId),
      onEvent: (event) => events.push(event),
    },
  });
  return { result, events };
}

try {
  const normal = await runTestTurn('你好');
  assert.equal(normal.result.status, 'completed');
  assert.match(normal.result.output, /Responses API/);

  await fs.writeFile(path.join(dir, 'lk.txt'), '你好', 'utf8');
  const read = await runTestTurn('读取 lk.txt 的内容');
  assert.equal(read.result.status, 'completed');
  assert.deepEqual(
    read.events
      .filter((event) => event.type === 'tool.started')
      .map((event) => event.payload.toolName),
    ['read_file'],
  );
  const toolResult = read.events.find(
    (event) => event.type === 'tool.completed' && event.payload.toolName === 'read_file',
  );
  assert.equal(toolResult?.payload.ok, true);
  assert.equal(toolResult?.payload.result?.data?.content, '你好');
  assert.match(read.result.output, /读取文件/);
  console.log('Responses API tests passed: explicit route, structured output, tool call, typed result');
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
