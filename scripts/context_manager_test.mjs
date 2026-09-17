import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CONTEXT_SUMMARY_MARKER,
  ensureContextCompacted,
  estimateItemsCharacters,
  extractChatMessages,
  JsonFileSession,
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
