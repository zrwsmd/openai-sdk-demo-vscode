import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CONTEXT_SUMMARY_MARKER,
  ensureContextCompacted,
  applyTokenEstimateCalibration,
  estimateItemsTokens,
  estimateItemsCharacters,
  estimateModelRequestTokens,
  estimateTextTokens,
  extractChatMessages,
  JsonFileSession,
  modelContextCalibrationRouteKey,
  updateTokenEstimateCalibration,
} from './agent.testbundle.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-context-test-'));
const cfg = {
  baseUrl: 'http://mock/v1',
  apiKey: 'key',
  model: 'mock',
  exportDir: '',
  workspaceRoot: '',
};

try {
  {
    const englishTokens = estimateTextTokens('The quick brown fox jumps over the lazy dog.');
    const chineseTokens = estimateTextTokens('读取工作区文件并分析依赖关系');
    assert.ok(englishTokens > 0);
    assert.ok(chineseTokens > englishTokens);

    const requestEstimate = estimateModelRequestTokens({
      systemInstructions: 'You are a helpful assistant.',
      input: [{ type: 'message', role: 'user', content: '读取 main.st' }],
      tools: [{ name: 'read_file', parameters: { type: 'object', properties: { path: { type: 'string' } } } }],
      handoffs: [],
      outputType: 'text',
      modelSettings: {},
    });
    assert.ok(requestEstimate > chineseTokens);

    const routeKey = modelContextCalibrationRouteKey({
      provider: 'openai',
      apiFormat: 'responses',
      baseUrl: 'https://api.example/v1/',
      model: 'model-a',
    });
    assert.equal(
      modelContextCalibrationRouteKey({
        provider: 'openai',
        apiFormat: 'auto',
        baseUrl: 'https://api.example/v1/',
        model: 'model-a',
      }),
      modelContextCalibrationRouteKey({
        provider: 'openai',
        apiFormat: 'chat_completions',
        baseUrl: 'https://api.example/v1/',
        model: 'model-a',
      }),
    );
    assert.equal(
      modelContextCalibrationRouteKey({
        provider: 'openai',
        apiFormat: 'auto',
        baseUrl: '',
        model: 'model-a',
      }),
      modelContextCalibrationRouteKey({
        provider: 'openai',
        apiFormat: 'responses',
        baseUrl: '',
        model: 'model-a',
      }),
    );
    const first = updateTokenEstimateCalibration(undefined, routeKey, 100, 150);
    assert.equal(first.factor, 1.5);
    assert.equal(first.samples, 1);
    const second = updateTokenEstimateCalibration(first, routeKey, 100, 200);
    assert.equal(second.samples, 2);
    assert.equal(second.factor, 1.625);
    assert.equal(applyTokenEstimateCalibration(100, second), 163);
    assert.ok(estimateItemsTokens([{ type: 'message', role: 'user', content: '你好' }], second) > 0);

    const otherRoute = updateTokenEstimateCalibration(second, 'other-route', 100, 110);
    assert.equal(otherRoute.samples, 1);
    assert.equal(otherRoute.factor, 1.1);
  }

  {
    const session = new JsonFileSession(path.join(dir, 'session.json'));
    await session.addItems([
      { type: 'message', role: 'user', content: 'old user 1' },
      { type: 'message', role: 'assistant', content: 'old assistant 1' },
      { type: 'message', role: 'user', content: 'old user 2' },
      { type: 'message', role: 'assistant', content: 'old assistant 2' },
      { type: 'message', role: 'user', content: 'recent user' },
      { type: 'message', role: 'assistant', content: 'recent assistant' },
    ]);

    let summarizedOlder = 0;
    const result = await ensureContextCompacted(session, cfg, {
      maxItems: 4,
      recentItems: 2,
      summarize: async (_config, older, recent) => {
        summarizedOlder = older.length;
        assert.equal(recent.length, 2);
        return {
          summary: '用户正在围绕 PLC 项目连续工作，早期历史已压缩。',
          userPreferences: ['偏好中文回复'],
          durableFacts: ['已经讨论过 old user 1 和 old user 2'],
          importantFiles: ['main.st'],
          openTasks: ['继续保留最近两条原文'],
          risks: ['不要丢失审批状态'],
        };
      },
    });

    assert.equal(result.compacted, true);
    assert.equal(summarizedOlder, 4);
    const items = await session.getItems();
    assert.equal(items.length, 3);
    assert.equal(items[0].role, 'system');
    assert.match(items[0].content, new RegExp(CONTEXT_SUMMARY_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(items[1].content, 'recent user');
    assert.equal(items[2].content, 'recent assistant');

    const visible = extractChatMessages(items);
    assert.deepEqual(visible.map((message) => message.text), ['recent user', 'recent assistant']);
  }

  {
    const structured = JSON.stringify({
      artifacts: [],
      data: {},
      diagnostics: [],
      message: '已读取 yy.txt，共 1 行：\nhello',
    });
    const visible = extractChatMessages([
      { type: 'message', role: 'user', content: '读取 yy.txt' },
      { type: 'message', role: 'assistant', content: structured },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: '## 普通 Markdown\n\n正文' }],
      },
    ]);
    assert.deepEqual(visible, [
      { role: 'user', text: '读取 yy.txt' },
      { role: 'agent', text: '已读取 yy.txt，共 1 行：\nhello' },
      { role: 'agent', text: '## 普通 Markdown\n\n正文' },
    ]);
  }

  {
    const session = new JsonFileSession(path.join(dir, 'small-session.json'));
    await session.addItems([
      { type: 'message', role: 'user', content: 'short' },
      { type: 'message', role: 'assistant', content: 'ok' },
    ]);
    let called = false;
    const before = estimateItemsCharacters(await session.getItems());
    const result = await ensureContextCompacted(session, cfg, {
      maxItems: 10,
      maxCharacters: before + 1_000,
      summarize: async () => {
        called = true;
        throw new Error('should not summarize');
      },
    });
    assert.equal(result.compacted, false);
    assert.equal(called, false);
    assert.equal((await session.getItems()).length, 2);
  }

  {
    const session = new JsonFileSession(path.join(dir, 'profile-session.json'));
    await session.addItems([
      { type: 'message', role: 'user', content: 'profile old user' },
      { type: 'message', role: 'assistant', content: 'profile old assistant' },
      { type: 'message', role: 'user', content: 'profile recent user' },
      { type: 'message', role: 'assistant', content: 'profile recent assistant' },
    ]);
    let called = false;
    const result = await ensureContextCompacted(session, cfg, {
      modelContext: {
        contextWindowTokens: 128_000,
        compaction: {
          maxItems: 3,
          recentItems: 2,
          maxSummaryInputCharacters: 2_000,
        },
      },
      summarize: async (_config, older, recent, _signal, maxInputCharacters) => {
        called = true;
        assert.equal(older.length, 2);
        assert.equal(recent.length, 2);
        assert.equal(maxInputCharacters, 2_000);
        return {
          summary: 'profile summary',
          userPreferences: [],
          durableFacts: [],
          importantFiles: [],
          openTasks: [],
          risks: [],
        };
      },
    });
    assert.equal(called, true);
    assert.equal(result.compacted, true);
    assert.equal((await session.getItems()).length, 3);
  }

  {
    const session = new JsonFileSession(path.join(dir, 'replace-session.json'));
    await session.addItems([{ type: 'message', role: 'user', content: 'stale' }]);
    await session.replaceItems([{ type: 'message', role: 'assistant', content: 'fresh' }]);
    const items = await session.getItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].content, 'fresh');
  }

  console.log('context manager tests passed: bounded compaction, hidden summary, atomic replace');
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
