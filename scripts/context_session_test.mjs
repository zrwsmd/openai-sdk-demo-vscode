import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createManagedContextSession,
  JsonFileSession,
} from './agent.testbundle.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-context-session-test-'));

function message(role, content) {
  return { type: 'message', role, content };
}

const baseConfig = {
  baseUrl: 'http://mock/v1',
  apiKey: 'key',
  model: 'mock-model',
  provider: 'openai',
  apiFormat: 'chat_completions',
  exportDir: '',
  workspaceRoot: '',
  modelContext: {
    contextWindowTokens: 128_000,
    reservedOutputTokens: 4_096,
    safetyMarginTokens: 1_024,
    fixedRequestOverheadTokens: 4_096,
  },
};

{
  const session = new JsonFileSession(path.join(dir, 'local-session.json'));
  await session.addItems([
    message('user', '本轮之前的历史'),
    message('assistant', '之前的回复'),
  ]);
  const logs = [];
  let checkpoints = 0;
  const managed = await createManagedContextSession(session, baseConfig, {
    log: (line) => logs.push(line),
    compact: async (target) => {
      checkpoints += 1;
      const current = await target.getItems();
      if (current.length < 3) {
        return {
          compacted: false,
          beforeItems: current.length,
          afterItems: current.length,
          beforeCharacters: 0,
          afterCharacters: 0,
        };
      }
      await target.replaceItems([
        message('system', '[summary] 已压缩'),
        ...current.slice(-1),
      ]);
      return {
        compacted: true,
        beforeItems: current.length,
        afterItems: 2,
        beforeCharacters: 0,
        afterCharacters: 0,
      };
    },
  });

  const initial = await managed.runInitialCheckpoint();
  assert.equal(initial.compacted, false);
  await managed.session.addItems([message('assistant', '本轮工具回执')]);
  assert.equal(checkpoints, 2);
  assert.deepEqual(
    (await session.getItems()).map((item) => item.content),
    ['[summary] 已压缩', '本轮工具回执'],
  );
  assert.equal(logs.some((line) => line.includes('单轮中途检查已压缩历史')), true);

  await managed.restoreTurnBoundary();
  assert.deepEqual(
    (await session.getItems()).map((item) => item.content),
    ['本轮之前的历史', '之前的回复'],
  );
}

{
  const session = new JsonFileSession(path.join(dir, 'official-session.json'));
  await session.addItems([
    message('user', '旧请求'),
    message('assistant', '旧回复'),
    message('assistant', '旧工具结果'),
  ]);
  const compactCalls = [];
  const managed = await createManagedContextSession(
    session,
    {
      ...baseConfig,
      baseUrl: '',
      apiFormat: 'responses',
      model: 'gpt-4o-mini',
      modelContext: {
        contextWindowTokens: 100,
        reservedOutputTokens: 0,
        safetyMarginTokens: 0,
        fixedRequestOverheadTokens: 0,
        compaction: { maxInputTokens: 1 },
      },
    },
    {
      client: {
        responses: {
          compact: async (request) => {
            compactCalls.push(request);
            return {
              output: [{ type: 'compaction', id: 'cmp-1', encrypted_content: 'compressed' }],
              usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
            };
          },
        },
      },
      log: (line) => console.log(line),
    },
  );

  assert.equal(managed.mode, 'official_responses');
  const initial = await managed.runInitialCheckpoint();
  assert.equal(initial.compacted, true);
  assert.equal(compactCalls.length, 1);
  assert.equal((await session.getItems())[0].type, 'compaction');
  const initialBoundary = await session.getItems();

  await managed.session.addItems([message('user', '新的请求')]);
  await managed.session.runCompaction?.({ force: true });
  assert.equal(compactCalls.length, 2);
  await managed.restoreTurnBoundary();
  assert.deepEqual(await session.getItems(), initialBoundary);
}

{
  const session = new JsonFileSession(path.join(dir, 'fallback-session.json'));
  const logs = [];
  const managed = await createManagedContextSession(session, {
    ...baseConfig,
    baseUrl: '',
    apiFormat: 'responses',
    model: 'deepseek-v4-flash',
  }, { log: (line) => logs.push(line) });
  assert.equal(managed.mode, 'local');
  assert.equal(logs.some((line) => line.includes('回退本地压缩')), true);
}

console.log('context session tests passed');
