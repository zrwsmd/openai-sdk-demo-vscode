import {
  PlcRuntimeConfigError,
  validatePlcRuntimeConfig,
  type PlcEventTrigger,
  type PlcProgramBinding,
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
  retain: boolean;
}

export interface PlcRuntimeTaskDeployment {
  name: string;
  type: PlcTaskConfig['type'];
  priority: number;
  cpuCore: number;
  periodMs?: number;
  trigger?: PlcEventTrigger;
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

function renderProgram(task: PlcTaskConfig, program: PlcProgramBinding): string {
  const retain = program.retain ? ' RETAIN' : '';
  return `    PROGRAM${retain} ${program.instanceName} WITH ${task.name} : ${program.typeName};`;
}

export function renderMatiecConfiguration(value: unknown): string {
  const config = validatePlcRuntimeConfig(value);
  assertIecIdentifier(config.configuration.name, 'configuration.name');

  const lines: string[] = [`CONFIGURATION ${config.configuration.name}`];
  config.configuration.resources.forEach((resource, resourceIndex) => {
    const resourcePath = `configuration.resources[${resourceIndex}]`;
    assertIecIdentifier(resource.target, `${resourcePath}.target`);
    lines.push(`  RESOURCE ${resource.name} ON ${resource.target}`);
    resource.tasks.forEach((task, taskIndex) => {
      lines.push(renderTask(task, `${resourcePath}.tasks[${taskIndex}]`));
    });
    for (const task of resource.tasks) {
      for (const program of task.programs) {
        lines.push(renderProgram(task, program));
      }
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
  return {
    configurationName: config.configuration.name,
    resources: config.configuration.resources.map((resource) => ({
      name: resource.name,
      target: resource.target,
      tasks: resource.tasks.map((task) => ({
        name: task.name,
        type: task.type,
        priority: task.priority,
        cpuCore: task.cpuCore,
        ...(task.periodMs === undefined ? {} : { periodMs: task.periodMs }),
        ...(task.trigger === undefined ? {} : { trigger: { ...task.trigger } }),
        programs: task.programs.map((program) => ({
          instanceName: program.instanceName,
          typeName: program.typeName,
          source: program.source,
          retain: program.retain === true,
        })),
      })),
    })),
  };
}
