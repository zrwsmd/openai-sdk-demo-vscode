import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const PLC_RUNTIME_CONFIG_FILE_NAME = 'plc-runtime.json';
export const PLC_RUNTIME_CONFIG_SCHEMA_VERSION = 1 as const;

export type PlcTaskType = 'cyclic' | 'event';
export type PlcTriggerEdge = 'rising' | 'falling' | 'both';

export interface PlcEventTrigger {
  kind: 'variable';
  ref: string;
  edge?: PlcTriggerEdge;
}

export interface PlcProgramBinding {
  instanceName: string;
  typeName: string;
  source: string;
  retain?: boolean;
}

export interface PlcTaskConfig {
  name: string;
  type: PlcTaskType;
  periodMs?: number;
  priority: number;
  cpuCore: number;
  programs: PlcProgramBinding[];
  trigger?: PlcEventTrigger;
}

export interface PlcResourceConfig {
  name: string;
  target: string;
  tasks: PlcTaskConfig[];
}

export interface PlcRuntimeConfig {
  schemaVersion: typeof PLC_RUNTIME_CONFIG_SCHEMA_VERSION;
  configuration: {
    name: string;
    resources: PlcResourceConfig[];
  };
}

export class PlcRuntimeConfigError extends Error {
  readonly code = 'PLC_RUNTIME_CONFIG_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'PlcRuntimeConfigError';
  }
}

const IEC_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const MAX_NAME_LENGTH = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function fail(pathName: string, message: string): never {
  throw new PlcRuntimeConfigError(`${pathName}: ${message}`);
}

function record(value: unknown, pathName: string): Record<string, unknown> {
  if (!isRecord(value)) fail(pathName, '必须是对象');
  return value;
}

function allowedKeys(value: Record<string, unknown>, keys: readonly string[], pathName: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, '不支持的字段');
  }
}

function requiredString(value: unknown, pathName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(pathName, '必须是非空字符串');
  }
  return value.trim();
}

function identifier(value: unknown, pathName: string): string {
  const normalized = requiredString(value, pathName);
  if (normalized.length > MAX_NAME_LENGTH || !IEC_IDENTIFIER.test(normalized)) {
    fail(pathName, '必须是 IEC 标识符(A-Z/a-z/数字/下划线，且不能以数字开头)');
  }
  return normalized;
}

function finiteNumber(value: unknown, pathName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(pathName, '必须是有限数字');
  }
  return value;
}

function integer(value: unknown, pathName: string, min?: number, max?: number): number {
  const normalized = finiteNumber(value, pathName);
  if (!Number.isInteger(normalized)) fail(pathName, '必须是整数');
  if (min !== undefined && normalized < min) fail(pathName, `不能小于 ${min}`);
  if (max !== undefined && normalized > max) fail(pathName, `不能大于 ${max}`);
  return normalized;
}

function relativeSource(value: unknown, pathName: string): string {
  const normalized = requiredString(value, pathName).replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split('/').some((part) => part === '..' || part === '.')
  ) {
    fail(pathName, '必须是工作区内的相对路径，不能包含绝对路径或 ..');
  }
  return normalized;
}

function uniqueNames(values: readonly string[], pathName: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) fail(pathName, `名称重复: ${value}`);
    seen.add(value);
  }
}

function parseProgram(value: unknown, pathName: string): PlcProgramBinding {
  const raw = record(value, pathName);
  allowedKeys(raw, ['instanceName', 'typeName', 'source', 'retain'], pathName);
  const result: PlcProgramBinding = {
    instanceName: identifier(raw.instanceName, `${pathName}.instanceName`),
    typeName: identifier(raw.typeName, `${pathName}.typeName`),
    source: relativeSource(raw.source, `${pathName}.source`),
  };
  if (raw.retain !== undefined) {
    if (typeof raw.retain !== 'boolean') fail(`${pathName}.retain`, '必须是布尔值');
    result.retain = raw.retain;
  }
  return result;
}

function parseTrigger(value: unknown, pathName: string): PlcEventTrigger {
  const raw = record(value, pathName);
  allowedKeys(raw, ['kind', 'ref', 'edge'], pathName);
  if (raw.kind !== 'variable') fail(`${pathName}.kind`, '第一版只支持 variable');
  const result: PlcEventTrigger = {
    kind: 'variable',
    ref: requiredString(raw.ref, `${pathName}.ref`),
  };
  if (raw.edge !== undefined) {
    if (raw.edge !== 'rising' && raw.edge !== 'falling' && raw.edge !== 'both') {
      fail(`${pathName}.edge`, '必须是 rising、falling 或 both');
    }
    result.edge = raw.edge;
  }
  return result;
}

function parseTask(value: unknown, pathName: string): PlcTaskConfig {
  const raw = record(value, pathName);
  allowedKeys(raw, ['name', 'type', 'periodMs', 'priority', 'cpuCore', 'programs', 'trigger'], pathName);
  const type =
    raw.type === 'cycle'
      ? 'cyclic'
      : raw.type === 'cyclic' || raw.type === 'event'
        ? raw.type
        : undefined;
  if (!type) fail(`${pathName}.type`, '必须是 cyclic 或 event');

  const programs = raw.programs;
  if (!Array.isArray(programs) || programs.length === 0) {
    fail(`${pathName}.programs`, '必须至少绑定一个程序实例');
  }
  const parsedPrograms = programs.map((item, index) => parseProgram(item, `${pathName}.programs[${index}]`));
  uniqueNames(parsedPrograms.map((item) => item.instanceName), `${pathName}.programs`);

  const result: PlcTaskConfig = {
    name: identifier(raw.name, `${pathName}.name`),
    type,
    priority: integer(raw.priority, `${pathName}.priority`, 0, 31),
    cpuCore: integer(raw.cpuCore, `${pathName}.cpuCore`, 0),
    programs: parsedPrograms,
  };

  if (raw.periodMs !== undefined) {
    result.periodMs = finiteNumber(raw.periodMs, `${pathName}.periodMs`);
    if (result.periodMs <= 0) fail(`${pathName}.periodMs`, '必须大于 0');
  }
  if (type === 'cyclic' && result.periodMs === undefined) {
    fail(`${pathName}.periodMs`, 'cyclic 任务必须提供周期');
  }
  if (type === 'event' && raw.trigger === undefined) {
    fail(`${pathName}.trigger`, 'event 任务必须提供触发条件');
  }
  if (raw.trigger !== undefined) result.trigger = parseTrigger(raw.trigger, `${pathName}.trigger`);
  if (type === 'cyclic' && result.trigger !== undefined) {
    fail(`${pathName}.trigger`, 'cyclic 任务不应配置触发条件');
  }
  return result;
}

function parseResource(value: unknown, pathName: string): PlcResourceConfig {
  const raw = record(value, pathName);
  allowedKeys(raw, ['name', 'target', 'tasks'], pathName);
  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
    fail(`${pathName}.tasks`, '必须至少包含一个任务');
  }
  const tasks = raw.tasks.map((item, index) => parseTask(item, `${pathName}.tasks[${index}]`));
  uniqueNames(tasks.map((item) => item.name), `${pathName}.tasks`);
  return {
    name: identifier(raw.name, `${pathName}.name`),
    target: requiredString(raw.target, `${pathName}.target`),
    tasks,
  };
}

export function validatePlcRuntimeConfig(value: unknown): PlcRuntimeConfig {
  const raw = record(value, 'root');
  allowedKeys(raw, ['schemaVersion', 'configuration'], 'root');
  if (raw.schemaVersion !== PLC_RUNTIME_CONFIG_SCHEMA_VERSION) {
    fail('schemaVersion', `只支持版本 ${PLC_RUNTIME_CONFIG_SCHEMA_VERSION}`);
  }
  const configuration = record(raw.configuration, 'configuration');
  allowedKeys(configuration, ['name', 'resources'], 'configuration');
  if (!Array.isArray(configuration.resources) || configuration.resources.length === 0) {
    fail('configuration.resources', '必须至少包含一个资源');
  }
  const resources = configuration.resources.map((item, index) =>
    parseResource(item, `configuration.resources[${index}]`),
  );
  uniqueNames(resources.map((item) => item.name), 'configuration.resources');
  return {
    schemaVersion: PLC_RUNTIME_CONFIG_SCHEMA_VERSION,
    configuration: {
      name: identifier(configuration.name, 'configuration.name'),
      resources,
    },
  };
}

export function plcRuntimeConfigPath(workspaceRoot: string): string {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) {
    throw new PlcRuntimeConfigError('workspaceRoot: 必须是非空字符串');
  }
  return path.join(path.resolve(workspaceRoot), PLC_RUNTIME_CONFIG_FILE_NAME);
}

export async function readPlcRuntimeConfig(
  filePath: string,
): Promise<PlcRuntimeConfig | undefined> {
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new PlcRuntimeConfigError(
      `读取 ${filePath} 失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new PlcRuntimeConfigError(
      `解析 ${filePath} 失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    return validatePlcRuntimeConfig(parsed);
  } catch (error) {
    if (error instanceof PlcRuntimeConfigError) {
      throw new PlcRuntimeConfigError(`${filePath}: ${error.message}`);
    }
    throw error;
  }
}

async function writeAtomic(filePath: string, config: PlcRuntimeConfig): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, filePath);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function writePlcRuntimeConfig(
  filePath: string,
  value: unknown,
): Promise<PlcRuntimeConfig> {
  const config = validatePlcRuntimeConfig(value);
  await writeAtomic(filePath, config);
  return config;
}

export class PlcRuntimeConfigStore {
  private static readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly filePath: string) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new PlcRuntimeConfigError('filePath: 必须是非空字符串');
    }
  }

  private queueKey(): string {
    const resolved = path.resolve(this.filePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const key = this.queueKey();
    const previous = PlcRuntimeConfigStore.queues.get(key) ?? Promise.resolve();
    const current = previous.then(operation);
    const settled = current.then(
      () => undefined,
      () => undefined,
    );
    PlcRuntimeConfigStore.queues.set(key, settled);
    void settled.then(() => {
      if (PlcRuntimeConfigStore.queues.get(key) === settled) {
        PlcRuntimeConfigStore.queues.delete(key);
      }
    });
    return current;
  }

  read(): Promise<PlcRuntimeConfig | undefined> {
    return this.enqueue(() => readPlcRuntimeConfig(this.filePath));
  }

  write(value: unknown): Promise<PlcRuntimeConfig> {
    return this.enqueue(() => writePlcRuntimeConfig(this.filePath, value));
  }
}

