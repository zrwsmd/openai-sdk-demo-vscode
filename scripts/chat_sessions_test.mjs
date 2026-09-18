import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ChatSessionCatalog,
  titleFromUserText,
} from './agent.testbundle.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-chat-sessions-'));
await fs.writeFile(path.join(dir, 'session.json'), JSON.stringify({
  schemaVersion: 1,
  sessionId: 'legacy',
  items: [
    { type: 'message', role: 'user', content: '第一段历史会话内容' },
    { type: 'message', role: 'assistant', content: '收到' },
  ],
}), 'utf8');
await fs.writeFile(path.join(dir, 'runs.json'), JSON.stringify({
  schemaVersion: 1,
  effects: {},
  effectAttempts: {},
}), 'utf8');

const catalog = new ChatSessionCatalog(dir);
const firstIndex = await catalog.initialize();
assert(firstIndex.sessions.length === 1, 'legacy session was not migrated into first session');
assert(firstIndex.sessions[0].title === '第一段历史会话内容', 'legacy session title was not inferred');
const firstPaths = catalog.pathsFor(firstIndex.activeSessionId);
assert(JSON.parse(await fs.readFile(firstPaths.sessionFile, 'utf8')).sessionId === 'legacy', 'legacy session file was not copied');
assert(JSON.parse(await fs.readFile(firstPaths.runStoreFile, 'utf8')).schemaVersion === 1, 'legacy run store was not copied');

const second = await catalog.create();
assert(second.title === '新会话', 'new session should use default title');
await catalog.touch(second.id, titleFromUserText('设计一个三台水泵自动手动冗余切换运行时间均衡故障保护液位控制完整 PLC 程序'));
const withSecond = await catalog.list();
assert(withSecond.activeSessionId === second.id, 'new session should become active');
assert(withSecond.sessions[0].id === second.id, 'touched session should sort first');
assert(withSecond.sessions[0].title.endsWith('…'), 'long title should be compacted');

await catalog.setActive(firstIndex.activeSessionId);
const finalIndex = await catalog.list();
assert(finalIndex.activeSessionId === firstIndex.activeSessionId, 'switching active session failed');
assert(finalIndex.sessions.length === 2, 'session list lost history session');

console.log('chat session tests passed: legacy migration, creation, title update, switching');
