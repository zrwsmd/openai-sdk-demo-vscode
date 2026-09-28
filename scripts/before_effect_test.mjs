import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ToolRegistry,
  createCoreToolProvider,
  createStToolProvider,
} from './agent.testbundle.mjs';

const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'before-effect-ws-'));
const exportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'before-effect-export-'));
const events = [];

const beforeEffectProvider = {
  id: 'before-effect-test',
  createTools(context) {
    context.registerBeforeEffect(
      { effect: 'filesystem', resourceKind: 'file' },
      async ({ toolName, input }) => {
        const args = input && typeof input === 'object' ? input : {};
        const pathValue = typeof args.path === 'string' ? args.path : '';
        events.push({ toolName, path: pathValue });
        if (pathValue.endsWith('blocked.txt')) {
          return {
            ok: false,
            error: '测试前置检查拒绝了该文件。',
            risk: 'plan',
          };
        }
        return {
          ok: true,
          receiptData: {
            genericBeforeEffect: {
              toolName,
              resourceKind: 'file',
            },
          },
        };
      },
    );
    return [];
  },
};

const registry = new ToolRegistry([
  createCoreToolProvider(),
  createStToolProvider(),
  beforeEffectProvider,
]);
const tools = registry.createTools({
  cfg: {
    baseUrl: 'http://localhost/v1',
    apiKey: 'test',
    model: 'test',
    exportDir,
    workspaceRoot,
  },
});

const findTool = (name) => {
  const found = tools.find((tool) => tool.name === name);
  assert(found, `missing tool: ${name}`);
  return found;
};

const invoke = (name, input) => findTool(name).invoke({}, JSON.stringify(input));
const readResult = (raw) => JSON.parse(raw);

const writeResult = readResult(await invoke('write_file', {
  path: 'sample.txt',
  content: 'before\n',
}));
assert.equal(writeResult.ok, true);
assert.equal(writeResult.data.genericBeforeEffect.toolName, 'write_file');

const editResult = readResult(await invoke('edit_file', {
  path: 'sample.txt',
  edits: [{ oldText: 'before', newText: 'after' }],
}));
assert.equal(editResult.ok, true);
assert.equal(editResult.data.genericBeforeEffect.toolName, 'edit_file');
assert.match(editResult.data.diff, /-before/);
assert.match(editResult.data.diff, /\+after/);
assert.equal(await fs.readFile(path.join(workspaceRoot, 'sample.txt'), 'utf8'), 'after\n');

const exportResult = readResult(await invoke('export_st_program', {
  code: 'PROGRAM Exported\nEND_PROGRAM\n',
}));
assert.equal(exportResult.ok, true);
assert.equal(exportResult.data.genericBeforeEffect.toolName, 'export_st_program');
assert.equal(
  await fs.readFile(path.join(exportDir, 'Exported.st'), 'utf8'),
  'PROGRAM Exported\nEND_PROGRAM\n',
);

const blockedResult = readResult(await invoke('write_file', {
  path: 'blocked.txt',
  content: 'must not be written',
}));
assert.equal(blockedResult.ok, false);
assert.equal(
  await fs.access(path.join(workspaceRoot, 'blocked.txt')).then(
    () => true,
    () => false,
  ),
  false,
);

assert.deepEqual(
  events.map(({ toolName }) => toolName),
  ['write_file', 'edit_file', 'export_st_program', 'write_file'],
);

console.log('generic beforeEffect file coverage tests passed');
