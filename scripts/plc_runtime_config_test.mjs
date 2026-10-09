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
  schemaVersion: 1,
  configuration: {
    name: 'CONFIG_IEC',
    resources: [
      {
        name: 'resource_MainTask',
        target: 'PLC',
        tasks: [
          {
            name: 'MainTask',
            type: 'cycle',
            periodMs: 1000,
            priority: 1,
            cpuCore: 1,
            programs: [
              {
                instanceName: 'instance_PLC_PRG',
                typeName: 'PLC_PRG',
                source: 'src\\PLC_PRG.st',
              },
            ],
          },
        ],
      },
    ],
  },
};

const normalized = validatePlcRuntimeConfig(valid);
if (
  normalized.configuration.resources[0].tasks[0].type !== 'cyclic' ||
  normalized.configuration.resources[0].tasks[0].programs[0].source !== 'src/PLC_PRG.st'
) {
  throw new Error('配置标准化失败');
}

const store = new PlcRuntimeConfigStore(filePath);
if (await store.read() !== undefined) throw new Error('不存在的配置不应被伪造为默认配置');
await store.write(valid);
const loaded = await store.read();
if (loaded?.configuration.resources[0].tasks[0].periodMs !== 1000) {
  throw new Error('配置读写失败');
}

const invalidCases = [
  {
    name: 'cyclic 缺少周期',
    value: structuredClone(valid),
    check: (value) => {
      delete value.configuration.resources[0].tasks[0].periodMs;
    },
    expected: 'periodMs',
  },
  {
    name: '源文件越界',
    value: structuredClone(valid),
    check: (value) => {
      value.configuration.resources[0].tasks[0].programs[0].source = '../PLC_PRG.st';
    },
    expected: 'source',
  },
  {
    name: '任务名称重复',
    value: structuredClone(valid),
    check: (value) => {
      value.configuration.resources[0].tasks.push(
        structuredClone(value.configuration.resources[0].tasks[0]),
      );
    },
    expected: '名称重复',
  },
  {
    name: '未知字段',
    value: structuredClone(valid),
    check: (value) => {
      value.configuration.resources[0].tasks[0].unexpected = true;
    },
    expected: '不支持的字段',
  },
];

for (const testCase of invalidCases) {
  testCase.check(testCase.value);
  let error;
  try {
    validatePlcRuntimeConfig(testCase.value);
  } catch (candidate) {
    error = candidate;
  }
  if (!(error instanceof PlcRuntimeConfigError) || !error.message.includes(testCase.expected)) {
    throw new Error(`${testCase.name} 未被正确拒绝: ${error?.message ?? '无错误'}`);
  }
}

const concurrentStore = new PlcRuntimeConfigStore(filePath);
await Promise.all([
  concurrentStore.write(valid),
  concurrentStore.write({
    ...valid,
    configuration: {
      ...valid.configuration,
      name: 'CONFIG_SECOND',
    },
  }),
]);
const afterConcurrentWrite = await readPlcRuntimeConfig(filePath);
if (!afterConcurrentWrite || !['CONFIG_IEC', 'CONFIG_SECOND'].includes(afterConcurrentWrite.configuration.name)) {
  throw new Error('并发写入后的配置不可读');
}

console.log('plc runtime config tests passed');

