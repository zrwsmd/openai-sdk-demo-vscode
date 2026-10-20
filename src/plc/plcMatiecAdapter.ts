import {
  PlcRuntimeConfigError,
  validatePlcRuntimeConfig,
  type PlcRuntimeConfig,
  type PlcTaskConfig,
} from './plcRuntimeConfig';

export const GENERATED_MATIEC_CONFIGURATION_PATH = '__generated__/plc_configuration.st';

const IEC_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export interface PlcMatiecSourceInput {
  path: string;
  content: string;
}

export interface PlcMatiecCompileInput extends PlcMatiecSourceInput {
  role: 'source' | 'configuration';
  generated: boolean;
}

export interface PlcRuntimeProgramDeployment {
  instanceName: string;
  typeName: string;
  source: string;
}

export interface PlcRuntimeTaskDeployment {
  name: string;
  type: PlcTaskConfig['type'];
  priority: number;
  cpuCore: number;
  periodMs: number;
  programs: PlcRuntimeProgramDeployment[];
}

export interface PlcRuntimeResourceDeployment {
  name: string;
  target: string;
  tasks: PlcRuntimeTaskDeployment[];
}

export interface PlcRuntimeDeployment {
  configurationName: string;
  resources: PlcRuntimeResourceDeployment[];
}

function fail(pathName: string, message: string): never {
  throw new PlcRuntimeConfigError(`${pathName}: ${message}`);
}

function assertIecIdentifier(value: string, pathName: string): void {
  if (!IEC_IDENTIFIER.test(value)) {
    fail(pathName, '必须是 IEC 标识符，才能生成 matiec CONFIGURATION');
  }
}

function normalizeInputPath(value: string, pathName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(pathName, '必须是非空路径');
  }
  return value.trim().replaceAll('\\', '/');
}

function formatFiniteDecimal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    fail('periodMs', '必须是大于 0 的有限数字');
  }
  if (Number.isInteger(value)) return String(value);
  const formatted = value.toFixed(6).replace(/0+$/u, '').replace(/\.$/u, '');
  if (!formatted || formatted === '0' || /e/iu.test(formatted)) {
    fail('periodMs', '无法稳定转换为 IEC TIME 字面量');
  }
  return formatted;
}

export function iecTimeLiteralFromPeriodMs(periodMs: number): string {
  return `T#${formatFiniteDecimal(periodMs)}ms`;
}

function renderTask(task: PlcTaskConfig, taskPath: string): string {
  if (task.type !== 'cyclic') {
    fail(taskPath, 'matiec 适配第一版只支持 cyclic 任务，event 任务需要运行时触发适配');
  }
  if (task.periodMs === undefined) {
    fail(`${taskPath}.periodMs`, 'cyclic 任务必须提供周期');
  }
  return `    TASK ${task.name}(INTERVAL := ${iecTimeLiteralFromPeriodMs(task.periodMs)}, PRIORITY := ${task.priority});`;
}

function renderProgram(task: PlcTaskConfig, instance: PlcTaskConfig['instances'][number]): string {
  return `    PROGRAM ${instance.name} WITH ${task.name} : ${instance.pou};`;
}

export function renderMatiecConfiguration(value: unknown): string {
  const config = validatePlcRuntimeConfig(value);
  const lines: string[] = ['CONFIGURATION CONFIG_IEC'];
  config.tasks.forEach((task, taskIndex) => {
    const resourceName = `resource_${task.name}`;
    assertIecIdentifier(resourceName, `tasks[${taskIndex}].name`);
    lines.push(`  RESOURCE ${resourceName} ON plc`);
    lines.push(renderTask(task, `tasks[${taskIndex}]`));
    for (const instance of task.instances) {
      if (instance.name !== `instance_${instance.pou}`) {
        fail(`tasks[${taskIndex}].instances`, `devUni 目标要求实例名为 instance_${instance.pou}`);
      }
      lines.push(renderProgram(task, instance));
    }
    lines.push('  END_RESOURCE');
  });
  lines.push('END_CONFIGURATION');
  return `${lines.join('\n')}\n`;
}

export function createMatiecCompileInputs(
  config: unknown,
  sourceFiles: readonly PlcMatiecSourceInput[],
): PlcMatiecCompileInput[] {
  const configurationContent = renderMatiecConfiguration(config);
  return [
    ...sourceFiles.map((file, index) => ({
      path: normalizeInputPath(file.path, `sourceFiles[${index}].path`),
      content: file.content,
      role: 'source' as const,
      generated: false,
    })),
    {
      path: GENERATED_MATIEC_CONFIGURATION_PATH,
      content: configurationContent,
      role: 'configuration',
      generated: true,
    },
  ];
}

export function runtimeDeploymentFromConfig(value: unknown): PlcRuntimeDeployment {
  const config: PlcRuntimeConfig = validatePlcRuntimeConfig(value);
  const pous = new Map(config.pous.map((pou) => [pou.name.toLocaleUpperCase(), pou]));
  return {
    configurationName: 'CONFIG_IEC',
    resources: config.tasks.map((task) => ({
      name: `resource_${task.name}`,
      target: 'plc',
      tasks: [{
        name: task.name,
        type: task.type,
        priority: task.priority,
        cpuCore: task.cpuCore,
        periodMs: task.periodMs,
        programs: task.instances.map((instance) => ({
          instanceName: instance.name,
          typeName: instance.pou,
          source: pous.get(instance.pou.toLocaleUpperCase())?.source ?? '',
        })),
      }],
    })),
  };
}
