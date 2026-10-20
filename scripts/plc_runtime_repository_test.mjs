import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PlcRuntimeConfigError,
  PlcRuntimeConfigRepository,
} from './agent.testbundle.mjs';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-repository-test-'));
const repository = new PlcRuntimeConfigRepository({ workspaceRoot: workspace });

const missing = await repository.refresh();
if (missing.status !== 'missing' || !missing.filePath.endsWith('plc-runtime.json')) {
  throw new Error('未配置状态识别失败');
}
if (repository.getSnapshot()?.status !== 'missing') {
  throw new Error('仓库快照没有更新');
}

const config = {
  schemaVersion: 2,
  tasks: [{ name: 'MainTask', deviceId: 'plc', type: 'cyclic', periodMs: 20, priority: 1, cpuCore: 0, instances: [{ name: 'instance_Main', pou: 'Main' }] }],
  pous: [{ name: 'Main', pouType: 'program', source: 'src/Main.st' }],
  devices: [{ id: 'plc', role: 'local', model: 'PLC', points: [], connections: [] }],
  networks: [],
  ioMappings: [],
};

const saved = await repository.save(config);
if (saved.status !== 'ready' || saved.config.schemaVersion !== 2) {
  throw new Error('保存后的仓库状态错误');
}

const ready = await repository.refresh();
if (
  ready.status !== 'ready' ||
  ready.config.tasks[0].periodMs !== 20
) {
  throw new Error('有效配置刷新失败');
}

await fs.writeFile(repository.filePath, '{not-json', 'utf8');
const invalidJson = await repository.refresh();
if (
  invalidJson.status !== 'invalid' ||
  !invalidJson.error.message.includes('解析')
) {
  throw new Error('损坏 JSON 没有被识别为 invalid');
}

let assertFailed = false;
try {
  await repository.assertReady();
} catch (error) {
  assertFailed = error instanceof PlcRuntimeConfigError;
}
if (!assertFailed) throw new Error('损坏配置不应被 assertReady 静默放行');

await fs.writeFile(
  repository.filePath,
  JSON.stringify({ schemaVersion: 2, tasks: [], pous: [], devices: [], networks: [], ioMappings: [] }),
  'utf8',
);
const invalidSchema = await repository.refresh();
if (
  invalidSchema.status !== 'invalid' ||
  !invalidSchema.error.message.includes('tasks')
) {
  throw new Error('schema 错误没有被识别为 invalid');
}

console.log('plc runtime repository tests passed');

