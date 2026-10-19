import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ChatSessionCatalog,
  JsonFileSession,
  ProjectWindowHandoffStore,
  createHistoricalToolArgumentGuard,
  createProjectHandoffSession,
  extractChatMessages,
} from './agent.testbundle.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-project-handoff-'));
const globalStorage = path.join(base, 'global');
const newWorkspaceStorage = path.join(base, 'new-workspace-storage');
const projectRoot = path.join(base, 'projects', 'Mixer', 'SC5100');
const workspaceFile = path.join(base, 'projects', 'Mixer', 'Mixer.code-workspace');
await fs.mkdir(projectRoot, { recursive: true });
await fs.writeFile(workspaceFile, JSON.stringify({ folders: [{ path: 'SC5100' }] }), 'utf8');

const store = new ProjectWindowHandoffStore(globalStorage);
const handoff = await store.enqueue({
  workspaceFile,
  projectRoots: [projectRoot],
  projectName: 'Mixer',
  parentDirectory: path.dirname(path.dirname(workspaceFile)),
  deviceModel: 'SC5100',
  language: 'st',
  projectType: 'standard',
});

assert(
  (await store.claimForWorkspace(path.join(base, 'other.code-workspace'), [path.join(base, 'other')])) === undefined,
  'unrelated workspace must not consume the project handoff',
);

const claim = await store.claimForWorkspace(workspaceFile, []);
assert(claim?.handoff.id === handoff.id, 'new project window did not claim its handoff');

const catalog = new ChatSessionCatalog(newWorkspaceStorage);
await catalog.initialize();
const oldSession = await catalog.create('旧工程会话');
await catalog.setWorkspaceRoots(oldSession.id, [path.join(base, 'old-workspace')]);
await new JsonFileSession(catalog.pathsFor(oldSession.id).sessionFile).addItems([
  { type: 'message', role: 'user', content: '这段旧会话内容不能进入新工程会话' },
]);

const projectSession = await createProjectHandoffSession(catalog, claim.handoff);
await claim.complete();

const index = await catalog.list();
assert(index.activeSessionId === projectSession.id, 'project handoff session should become active');
const storedProject = index.sessions.find((session) => session.id === projectSession.id);
assert(
  JSON.stringify(storedProject?.workspaceRoots) === JSON.stringify([path.resolve(projectRoot)]),
  'project handoff session must authorize only the new project root',
);
const storedOldSession = index.sessions.find((session) => session.id === oldSession.id);
assert(
  JSON.stringify(storedOldSession?.workspaceRoots) === JSON.stringify([path.join(base, 'old-workspace')]),
  'creating the project handoff session must not change another session authorization',
);

const projectHistory = new JsonFileSession(catalog.pathsFor(projectSession.id).sessionFile);
const items = await projectHistory.getItems();
assert(items.length === 1, `new project session should contain one summary item, got ${items.length}`);
const messages = extractChatMessages(items);
assert(messages.length === 1 && messages[0].role === 'agent', 'summary should be one agent message');
assert(messages[0].text.includes('工程名称：Mixer'), 'summary is missing the project name');
assert(messages[0].text.includes('设备型号：SC5100'), 'summary is missing the device model');
assert(messages[0].text.includes('工程类型：standard'), 'summary is missing the project type');
assert(messages[0].text.includes('工程语言：st'), 'summary is missing the language');
assert(!messages[0].text.includes('旧会话内容'), 'old conversation leaked into the project session');
const handoffGuard = createHistoricalToolArgumentGuard(
  items,
  '列出当前工程中的文件',
);
assert(
  handoffGuard?.('list_files', { dir: projectRoot }) === undefined,
  'host-authored project summary must not be rejected as a stale historical path',
);
assert(
  (await store.claimForWorkspace(workspaceFile, [projectRoot])) === undefined,
  'completed handoff should be consumed exactly once',
);

const retryable = await store.enqueue({
  workspaceFile,
  projectRoots: [projectRoot],
  projectName: 'Mixer',
});
const firstClaim = await store.claimForWorkspace(undefined, [projectRoot]);
assert(firstClaim?.handoff.id === retryable.id, 'project root should match the handoff');
await firstClaim.release();
const secondClaim = await store.claimForWorkspace(workspaceFile, []);
assert(secondClaim?.handoff.id === retryable.id, 'released handoff should be claimable again');
await secondClaim.complete();

console.log('project window handoff tests passed: matching, isolation, summary seeding, exactly-once claim');
