import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PlcRuntimeConfigError,
  PlcRuntimeConfigStore,
  plcRuntimeConfigPath,
  readPlcRuntimeConfig,
  validatePlcRuntimeConfig,
} from './agent.testbundle.mjs';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-config-test-'));
const filePath = plcRuntimeConfigPath(workspace);
const valid = {
  schemaVersion: 2,
  tasks: [{
    name: 'MainTask', deviceId: 'plc', type: 'cyclic', periodMs: 1000,
    priority: 1, cpuCore: 0, instances: [{ name: 'instance_PLC_PRG', pou: 'PLC_PRG' }],
  }],
  pous: [{ name: 'PLC_PRG', pouType: 'program', source: 'src\\PLC_PRG.st' }],
  devices: [{ id: 'plc', role: 'local', model: 'SC5100', points: [], connections: [] }],
  networks: [],
  ioMappings: [],
};

const normalized = validatePlcRuntimeConfig(valid);
if (normalized.schemaVersion !== 2 || normalized.pous[0].source !== 'src/PLC_PRG.st') {
  throw new Error('v2 配置标准化失败');
}

const complete = structuredClone(valid);
complete.devices[0].points.push({
  id: 'start',
  address: { kind: 'direct', address: '%IX0.0' },
  direction: 'input',
  dataType: 'BOOL',
});
complete.networks.push({
  id: 'mb_tcp_1',
  protocol: 'modbusTcp',
  mode: 'master',
  interface: { name: 'eth0', ip: '192.168.1.5' },
});
complete.devices.push({
  id: 'rio_1', role: 'remote', model: 'RIO',
  points: [{
    id: 'do0',
    address: { kind: 'protocol', networkId: 'mb_tcp_1', area: 'coil', offset: 0, wireType: 'BOOL' },
    direction: 'output', dataType: 'BOOL',
  }],
  connections: [{ networkId: 'mb_tcp_1', endpoint: { host: '192.168.1.10', port: 502 }, unitId: 1 }],
});
complete.ioMappings.push({ variable: 'Start', task: 'MainTask', instance: 'instance_PLC_PRG', point: 'plc/start' });
complete.runtimeOverrides = {
  dataArea: { input: 8192, output: 8192, memory: 16384 },
  retainPolicy: { enabled: true, intervalMs: 5000 },
};
const normalizedComplete = validatePlcRuntimeConfig(complete);
if (
  normalizedComplete.devices[1].connections?.[0].endpoint?.port !== 502 ||
  normalizedComplete.devices[1].points[0].address.kind !== 'protocol' ||
  normalizedComplete.runtimeOverrides?.dataArea?.memory !== 16384
) {
  throw new Error('完整 v2 设备、网络或运行时覆盖字段解析失败');
}

const legacy = {
  schemaVersion: 1,
  configuration: { name: 'CONFIG_IEC', resources: [{
    name: 'resource_MainTask', target: 'PLC', tasks: [{
      name: 'MainTask', type: 'cycle', periodMs: 1000, priority: 1, cpuCore: 0,
      programs: [{ instanceName: 'instance_PLC_PRG', typeName: 'PLC_PRG', source: 'src/PLC_PRG.st' }],
    }],
  }] },
};
const migrated = validatePlcRuntimeConfig(legacy);
if (migrated.schemaVersion !== 2 || migrated.tasks[0].deviceId !== 'PLC' || migrated.pous[0].name !== 'PLC_PRG') {
  throw new Error('v1 配置没有迁移到 v2');
}

const store = new PlcRuntimeConfigStore(filePath);
if (await store.read() !== undefined) throw new Error('不存在的配置不应被伪造为默认配置');
await store.write(legacy);
const rawWritten = JSON.parse(await fs.readFile(filePath, 'utf8'));
if (rawWritten.schemaVersion !== 2 || rawWritten.configuration !== undefined) {
  throw new Error('保存旧配置时没有落盘为 v2');
}
const loaded = await store.read();
if (loaded?.tasks[0].periodMs !== 1000) throw new Error('配置读写失败');

const invalidCases = [
  ['cyclic 缺少周期', (value) => { delete value.tasks[0].periodMs; }, 'periodMs'],
  ['源文件越界', (value) => { value.pous[0].source = '../PLC_PRG.st'; }, 'source'],
  ['任务名称重复', (value) => { value.tasks.push(structuredClone(value.tasks[0])); }, '名称重复'],
  ['未知字段', (value) => { value.tasks[0].unexpected = true; }, '不支持的字段'],
  ['POU 引用不存在', (value) => { value.tasks[0].instances[0].pou = 'Missing'; }, '引用的 POU 不存在'],
];
for (const [name, mutate, expected] of invalidCases) {
  const value = structuredClone(valid);
  mutate(value);
  let error;
  try { validatePlcRuntimeConfig(value); } catch (candidate) { error = candidate; }
  if (!(error instanceof PlcRuntimeConfigError) || !error.message.includes(expected)) {
    throw new Error(`${name} 未被正确拒绝: ${error?.message ?? '无错误'}`);
  }
}

const concurrentStore = new PlcRuntimeConfigStore(filePath);
const second = structuredClone(valid);
second.tasks[0].periodMs = 2000;
await Promise.all([concurrentStore.write(valid), concurrentStore.write(second)]);
const afterConcurrentWrite = await readPlcRuntimeConfig(filePath);
if (!afterConcurrentWrite || ![1000, 2000].includes(afterConcurrentWrite.tasks[0].periodMs)) {
  throw new Error('并发写入后的配置不可读');
}

console.log('plc runtime config tests passed');
