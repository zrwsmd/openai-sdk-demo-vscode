import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const PLC_RUNTIME_CONFIG_FILE_NAME = 'plc-runtime.json';
export const PLC_RUNTIME_CONFIG_SCHEMA_VERSION = 2 as const;

export type PlcTaskType = 'cyclic' | 'event';
export type PlcPouType = 'program' | 'functionBlock' | 'function';

export interface PlcTaskInstance { name: string; pou: string }
export interface PlcTaskConfig {
  name: string;
  deviceId: string;
  type: PlcTaskType;
  periodMs: number;
  priority: number;
  cpuCore: number;
  instances: PlcTaskInstance[];
}
export interface PlcPouConfig { name: string; pouType: PlcPouType; source: string }
export interface PlcDirectAddress { kind: 'direct'; address: string }
export interface PlcProtocolAddress {
  kind: 'protocol';
  networkId: string;
  area?: 'coil' | 'discreteInput' | 'holdingRegister' | 'inputRegister';
  offset?: number;
  index?: string;
  subIndex?: number;
  wireType: string;
}
export type PlcPointAddress = PlcDirectAddress | PlcProtocolAddress;
export interface PlcDevicePoint {
  id: string;
  address: PlcPointAddress;
  direction: 'input' | 'output';
  dataType: string;
  module?: string;
  channel?: number;
  range?: string;
  description?: string;
}
export interface PlcDeviceConnection {
  networkId: string;
  endpoint?: { host: string; port: number };
  unitId?: number;
  slaveIndex?: number;
}
export interface PlcDeviceModule {
  id: string;
  slot: number;
  model: string;
  kind: 'digitalInput' | 'digitalOutput' | 'analogInput' | 'analogOutput' | 'mixed';
  channels: number;
  range?: string;
  resolutionBits?: number;
}
export interface PlcDeviceConfig {
  id: string;
  name?: string;
  role: 'local' | 'remote';
  model: string;
  vendor?: string;
  firmware?: string;
  runtime?: { coreCount?: number; memoryMb?: number };
  modules?: PlcDeviceModule[];
  points: PlcDevicePoint[];
  connections?: PlcDeviceConnection[];
}
export interface PlcNetworkConfig {
  id: string;
  name?: string;
  protocol: 'modbusTcp' | 'modbusRtu' | 'ethercat' | 'opcUa' | 'profinet';
  mode: 'master' | 'slave';
  interface?: { name: string; ip?: string; netmask?: string; gateway?: string };
  serial?: { port: string; baudRate: number; dataBits: number; parity: 'none' | 'even' | 'odd'; stopBits: number };
  listenPort?: number;
  timeoutMs?: number;
  retries?: number;
  pollIntervalMs?: number;
  cycleMs?: number;
  distributedClock?: boolean;
}
export interface PlcIoMapping {
  variable: string;
  task: string;
  instance: string;
  point: string;
  scale?: number;
  unit?: string;
  invert?: boolean;
}
export interface PlcRuntimeOverrides {
  dataArea?: { input: number; output: number; memory: number };
  retainPolicy?: { enabled: boolean; intervalMs: number };
}
export interface PlcRuntimeConfig {
  schemaVersion: typeof PLC_RUNTIME_CONFIG_SCHEMA_VERSION;
  tasks: PlcTaskConfig[];
  pous: PlcPouConfig[];
  devices: PlcDeviceConfig[];
  networks: PlcNetworkConfig[];
  ioMappings: PlcIoMapping[];
  runtimeOverrides?: PlcRuntimeOverrides;
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
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${pathName}.${key}`, '不支持的字段');
}
function requiredString(value: unknown, pathName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(pathName, '必须是非空字符串');
  return value.trim();
}
function optionalString(value: unknown, pathName: string): string | undefined {
  return value === undefined ? undefined : requiredString(value, pathName);
}
function identifier(value: unknown, pathName: string): string {
  const normalized = requiredString(value, pathName);
  if (normalized.length > MAX_NAME_LENGTH || !IEC_IDENTIFIER.test(normalized)) {
    fail(pathName, '必须是 IEC 标识符(A-Z/a-z/数字/下划线，且不能以数字开头)');
  }
  return normalized;
}
function finiteNumber(value: unknown, pathName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(pathName, '必须是有限数字');
  return value;
}
function positiveNumber(value: unknown, pathName: string): number {
  const normalized = finiteNumber(value, pathName);
  if (normalized <= 0) fail(pathName, '必须大于 0');
  return normalized;
}
function integer(value: unknown, pathName: string, min?: number, max?: number): number {
  const normalized = finiteNumber(value, pathName);
  if (!Number.isInteger(normalized)) fail(pathName, '必须是整数');
  if (min !== undefined && normalized < min) fail(pathName, `不能小于 ${min}`);
  if (max !== undefined && normalized > max) fail(pathName, `不能大于 ${max}`);
  return normalized;
}
function optionalInteger(value: unknown, pathName: string, min?: number, max?: number): number | undefined {
  return value === undefined ? undefined : integer(value, pathName, min, max);
}
function optionalPositiveNumber(value: unknown, pathName: string): number | undefined {
  return value === undefined ? undefined : positiveNumber(value, pathName);
}
function booleanValue(value: unknown, pathName: string): boolean {
  if (typeof value !== 'boolean') fail(pathName, '必须是布尔值');
  return value;
}
function relativeSource(value: unknown, pathName: string): string {
  const normalized = requiredString(value, pathName).replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//u.test(normalized) || normalized.split('/').some((part) => part === '..' || part === '.')) {
    fail(pathName, '必须是工作区内的相对路径，不能包含绝对路径、. 或 ..');
  }
  if (!normalized.toLocaleLowerCase().endsWith('.st')) fail(pathName, '必须以 .st 结尾');
  return normalized;
}
function array(value: unknown, pathName: string, allowEmpty = true): unknown[] {
  if (!Array.isArray(value)) fail(pathName, '必须是数组');
  if (!allowEmpty && value.length === 0) fail(pathName, '至少需要一项');
  return value;
}
function uniqueNames(values: readonly string[], pathName: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLocaleUpperCase();
    if (seen.has(key)) fail(pathName, `名称重复: ${value}`);
    seen.add(key);
  }
}

function parseInstance(value: unknown, pathName: string): PlcTaskInstance {
  const raw = record(value, pathName);
  allowedKeys(raw, ['name', 'pou'], pathName);
  return { name: identifier(raw.name, `${pathName}.name`), pou: identifier(raw.pou, `${pathName}.pou`) };
}
function parseTask(value: unknown, pathName: string): PlcTaskConfig {
  const raw = record(value, pathName);
  allowedKeys(raw, ['name', 'deviceId', 'type', 'periodMs', 'priority', 'cpuCore', 'instances'], pathName);
  if (raw.type !== 'cyclic' && raw.type !== 'event') fail(`${pathName}.type`, '必须是 cyclic 或 event');
  const instances = array(raw.instances, `${pathName}.instances`, false).map((item, index) => parseInstance(item, `${pathName}.instances[${index}]`));
  uniqueNames(instances.map((item) => item.name), `${pathName}.instances`);
  return {
    name: identifier(raw.name, `${pathName}.name`),
    deviceId: identifier(raw.deviceId, `${pathName}.deviceId`),
    type: raw.type,
    periodMs: positiveNumber(raw.periodMs, `${pathName}.periodMs`),
    priority: integer(raw.priority, `${pathName}.priority`, 0, 31),
    cpuCore: integer(raw.cpuCore, `${pathName}.cpuCore`, 0),
    instances,
  };
}
function parsePou(value: unknown, pathName: string): PlcPouConfig {
  const raw = record(value, pathName);
  allowedKeys(raw, ['name', 'pouType', 'source'], pathName);
  if (raw.pouType !== 'program' && raw.pouType !== 'functionBlock' && raw.pouType !== 'function') {
    fail(`${pathName}.pouType`, '必须是 program、functionBlock 或 function');
  }
  const name = identifier(raw.name, `${pathName}.name`);
  const source = relativeSource(raw.source, `${pathName}.source`);
  return { name, pouType: raw.pouType, source };
}
function parseAddress(value: unknown, pathName: string): PlcPointAddress {
  const raw = record(value, pathName);
  if (raw.kind === 'direct') {
    allowedKeys(raw, ['kind', 'address'], pathName);
    return { kind: 'direct', address: requiredString(raw.address, `${pathName}.address`) };
  }
  if (raw.kind !== 'protocol') fail(`${pathName}.kind`, '必须是 direct 或 protocol');
  allowedKeys(raw, ['kind', 'networkId', 'area', 'offset', 'index', 'subIndex', 'wireType'], pathName);
  const result: PlcProtocolAddress = {
    kind: 'protocol',
    networkId: identifier(raw.networkId, `${pathName}.networkId`),
    wireType: requiredString(raw.wireType, `${pathName}.wireType`),
  };
  if (raw.area !== undefined) {
    const areas = ['coil', 'discreteInput', 'holdingRegister', 'inputRegister'] as const;
    if (!areas.includes(raw.area as typeof areas[number])) fail(`${pathName}.area`, '是不支持的 Modbus 区域');
    result.area = raw.area as PlcProtocolAddress['area'];
  }
  if (raw.offset !== undefined) result.offset = integer(raw.offset, `${pathName}.offset`, 0);
  if (raw.index !== undefined) result.index = requiredString(raw.index, `${pathName}.index`);
  if (raw.subIndex !== undefined) result.subIndex = integer(raw.subIndex, `${pathName}.subIndex`, 0);
  return result;
}
function parsePoint(value: unknown, pathName: string): PlcDevicePoint {
  const raw = record(value, pathName);
  allowedKeys(raw, ['id', 'address', 'direction', 'dataType', 'module', 'channel', 'range', 'description'], pathName);
  if (raw.direction !== 'input' && raw.direction !== 'output') fail(`${pathName}.direction`, '必须是 input 或 output');
  const result: PlcDevicePoint = {
    id: requiredString(raw.id, `${pathName}.id`),
    address: parseAddress(raw.address, `${pathName}.address`),
    direction: raw.direction,
    dataType: requiredString(raw.dataType, `${pathName}.dataType`),
  };
  const module = optionalString(raw.module, `${pathName}.module`);
  const channel = optionalInteger(raw.channel, `${pathName}.channel`, 0);
  const range = optionalString(raw.range, `${pathName}.range`);
  const description = optionalString(raw.description, `${pathName}.description`);
  if (module !== undefined) result.module = module;
  if (channel !== undefined) result.channel = channel;
  if (range !== undefined) result.range = range;
  if (description !== undefined) result.description = description;
  return result;
}
function parseConnection(value: unknown, pathName: string): PlcDeviceConnection {
  const raw = record(value, pathName);
  allowedKeys(raw, ['networkId', 'endpoint', 'unitId', 'slaveIndex'], pathName);
  const result: PlcDeviceConnection = { networkId: identifier(raw.networkId, `${pathName}.networkId`) };
  if (raw.endpoint !== undefined) {
    const endpoint = record(raw.endpoint, `${pathName}.endpoint`);
    allowedKeys(endpoint, ['host', 'port'], `${pathName}.endpoint`);
    result.endpoint = { host: requiredString(endpoint.host, `${pathName}.endpoint.host`), port: integer(endpoint.port, `${pathName}.endpoint.port`, 1, 65535) };
  }
  if (raw.unitId !== undefined) result.unitId = integer(raw.unitId, `${pathName}.unitId`, 0, 255);
  if (raw.slaveIndex !== undefined) result.slaveIndex = integer(raw.slaveIndex, `${pathName}.slaveIndex`, 0);
  return result;
}
function parseModule(value: unknown, pathName: string): PlcDeviceModule {
  const raw = record(value, pathName);
  allowedKeys(raw, ['id', 'slot', 'model', 'kind', 'channels', 'range', 'resolutionBits'], pathName);
  const kinds = ['digitalInput', 'digitalOutput', 'analogInput', 'analogOutput', 'mixed'] as const;
  if (!kinds.includes(raw.kind as typeof kinds[number])) fail(`${pathName}.kind`, '是不支持的模块类型');
  const result: PlcDeviceModule = {
    id: requiredString(raw.id, `${pathName}.id`),
    slot: integer(raw.slot, `${pathName}.slot`, 0),
    model: requiredString(raw.model, `${pathName}.model`),
    kind: raw.kind as PlcDeviceModule['kind'],
    channels: integer(raw.channels, `${pathName}.channels`, 1),
  };
  const range = optionalString(raw.range, `${pathName}.range`);
  const resolutionBits = optionalInteger(raw.resolutionBits, `${pathName}.resolutionBits`, 1);
  if (range !== undefined) result.range = range;
  if (resolutionBits !== undefined) result.resolutionBits = resolutionBits;
  return result;
}
function parseDevice(value: unknown, pathName: string): PlcDeviceConfig {
  const raw = record(value, pathName);
  allowedKeys(raw, ['id', 'name', 'role', 'model', 'vendor', 'firmware', 'runtime', 'modules', 'points', 'connections'], pathName);
  if (raw.role !== 'local' && raw.role !== 'remote') fail(`${pathName}.role`, '必须是 local 或 remote');
  const points = array(raw.points, `${pathName}.points`).map((item, index) => parsePoint(item, `${pathName}.points[${index}]`));
  uniqueNames(points.map((item) => item.id), `${pathName}.points`);
  const result: PlcDeviceConfig = {
    id: identifier(raw.id, `${pathName}.id`), role: raw.role, model: requiredString(raw.model, `${pathName}.model`), points,
  };
  for (const key of ['name', 'vendor', 'firmware'] as const) {
    const item = optionalString(raw[key], `${pathName}.${key}`);
    if (item !== undefined) result[key] = item;
  }
  if (raw.runtime !== undefined) {
    const runtime = record(raw.runtime, `${pathName}.runtime`);
    allowedKeys(runtime, ['coreCount', 'memoryMb'], `${pathName}.runtime`);
    const coreCount = optionalInteger(runtime.coreCount, `${pathName}.runtime.coreCount`, 1);
    const memoryMb = optionalInteger(runtime.memoryMb, `${pathName}.runtime.memoryMb`, 1);
    result.runtime = { ...(coreCount === undefined ? {} : { coreCount }), ...(memoryMb === undefined ? {} : { memoryMb }) };
  }
  if (raw.modules !== undefined) {
    result.modules = array(raw.modules, `${pathName}.modules`).map((item, index) => parseModule(item, `${pathName}.modules[${index}]`));
    uniqueNames(result.modules.map((item) => item.id), `${pathName}.modules`);
    uniqueNames(result.modules.map((item) => String(item.slot)), `${pathName}.modules slots`);
  }
  if (raw.connections !== undefined) {
    result.connections = array(raw.connections, `${pathName}.connections`).map((item, index) => parseConnection(item, `${pathName}.connections[${index}]`));
    uniqueNames(result.connections.map((item) => item.networkId), `${pathName}.connections`);
  }
  return result;
}
function parseNetwork(value: unknown, pathName: string): PlcNetworkConfig {
  const raw = record(value, pathName);
  allowedKeys(raw, ['id', 'name', 'protocol', 'mode', 'interface', 'serial', 'listenPort', 'timeoutMs', 'retries', 'pollIntervalMs', 'cycleMs', 'distributedClock'], pathName);
  const protocols = ['modbusTcp', 'modbusRtu', 'ethercat', 'opcUa', 'profinet'] as const;
  if (!protocols.includes(raw.protocol as typeof protocols[number])) fail(`${pathName}.protocol`, '是不支持的协议');
  if (raw.mode !== 'master' && raw.mode !== 'slave') fail(`${pathName}.mode`, '必须是 master 或 slave');
  const result: PlcNetworkConfig = { id: identifier(raw.id, `${pathName}.id`), protocol: raw.protocol as PlcNetworkConfig['protocol'], mode: raw.mode };
  const name = optionalString(raw.name, `${pathName}.name`);
  if (name !== undefined) result.name = name;
  if (raw.interface !== undefined) {
    const item = record(raw.interface, `${pathName}.interface`);
    allowedKeys(item, ['name', 'ip', 'netmask', 'gateway'], `${pathName}.interface`);
    const ip = optionalString(item.ip, `${pathName}.interface.ip`);
    const netmask = optionalString(item.netmask, `${pathName}.interface.netmask`);
    const gateway = optionalString(item.gateway, `${pathName}.interface.gateway`);
    result.interface = { name: requiredString(item.name, `${pathName}.interface.name`), ...(ip ? { ip } : {}), ...(netmask ? { netmask } : {}), ...(gateway ? { gateway } : {}) };
  }
  if (raw.serial !== undefined) {
    const item = record(raw.serial, `${pathName}.serial`);
    allowedKeys(item, ['port', 'baudRate', 'dataBits', 'parity', 'stopBits'], `${pathName}.serial`);
    if (item.parity !== 'none' && item.parity !== 'even' && item.parity !== 'odd') fail(`${pathName}.serial.parity`, '必须是 none、even 或 odd');
    result.serial = { port: requiredString(item.port, `${pathName}.serial.port`), baudRate: integer(item.baudRate, `${pathName}.serial.baudRate`, 1), dataBits: integer(item.dataBits, `${pathName}.serial.dataBits`, 5, 8), parity: item.parity, stopBits: integer(item.stopBits, `${pathName}.serial.stopBits`, 1, 2) };
  }
  const listenPort = optionalInteger(raw.listenPort, `${pathName}.listenPort`, 1, 65535);
  const retries = optionalInteger(raw.retries, `${pathName}.retries`, 0);
  if (listenPort !== undefined) result.listenPort = listenPort;
  if (retries !== undefined) result.retries = retries;
  for (const key of ['timeoutMs', 'pollIntervalMs', 'cycleMs'] as const) {
    const item = optionalPositiveNumber(raw[key], `${pathName}.${key}`);
    if (item !== undefined) result[key] = item;
  }
  if (raw.distributedClock !== undefined) result.distributedClock = booleanValue(raw.distributedClock, `${pathName}.distributedClock`);
  return result;
}
function parseIoMapping(value: unknown, pathName: string): PlcIoMapping {
  const raw = record(value, pathName);
  allowedKeys(raw, ['variable', 'task', 'instance', 'point', 'scale', 'unit', 'invert'], pathName);
  const result: PlcIoMapping = { variable: requiredString(raw.variable, `${pathName}.variable`), task: identifier(raw.task, `${pathName}.task`), instance: identifier(raw.instance, `${pathName}.instance`), point: requiredString(raw.point, `${pathName}.point`) };
  if (raw.scale !== undefined) result.scale = finiteNumber(raw.scale, `${pathName}.scale`);
  const unit = optionalString(raw.unit, `${pathName}.unit`);
  if (unit !== undefined) result.unit = unit;
  if (raw.invert !== undefined) result.invert = booleanValue(raw.invert, `${pathName}.invert`);
  return result;
}
function parseRuntimeOverrides(value: unknown, pathName: string): PlcRuntimeOverrides {
  const raw = record(value, pathName);
  allowedKeys(raw, ['dataArea', 'retainPolicy'], pathName);
  const result: PlcRuntimeOverrides = {};
  if (raw.dataArea !== undefined) {
    const item = record(raw.dataArea, `${pathName}.dataArea`);
    allowedKeys(item, ['input', 'output', 'memory'], `${pathName}.dataArea`);
    result.dataArea = { input: integer(item.input, `${pathName}.dataArea.input`, 0), output: integer(item.output, `${pathName}.dataArea.output`, 0), memory: integer(item.memory, `${pathName}.dataArea.memory`, 0) };
  }
  if (raw.retainPolicy !== undefined) {
    const item = record(raw.retainPolicy, `${pathName}.retainPolicy`);
    allowedKeys(item, ['enabled', 'intervalMs'], `${pathName}.retainPolicy`);
    result.retainPolicy = { enabled: booleanValue(item.enabled, `${pathName}.retainPolicy.enabled`), intervalMs: positiveNumber(item.intervalMs, `${pathName}.retainPolicy.intervalMs`) };
  }
  return result;
}

function validateReferences(config: PlcRuntimeConfig): void {
  const devices = new Map(config.devices.map((item) => [item.id.toLocaleUpperCase(), item]));
  const pous = new Map(config.pous.map((item) => [item.name.toLocaleUpperCase(), item]));
  const networks = new Set(config.networks.map((item) => item.id.toLocaleUpperCase()));
  const tasks = new Map(config.tasks.map((item) => [item.name.toLocaleUpperCase(), item]));
  config.tasks.forEach((task, taskIndex) => {
    const device = devices.get(task.deviceId.toLocaleUpperCase());
    if (!device) fail(`tasks[${taskIndex}].deviceId`, `引用的设备不存在: ${task.deviceId}`);
    if (device.role !== 'local') fail(`tasks[${taskIndex}].deviceId`, 'Task 只能运行在 local 设备上');
    if (device.runtime?.coreCount !== undefined && task.cpuCore >= device.runtime.coreCount) fail(`tasks[${taskIndex}].cpuCore`, `超出设备核数 ${device.runtime.coreCount}`);
    task.instances.forEach((instance, instanceIndex) => {
      const pou = pous.get(instance.pou.toLocaleUpperCase());
      if (!pou) fail(`tasks[${taskIndex}].instances[${instanceIndex}].pou`, `引用的 POU 不存在: ${instance.pou}`);
      if (pou.pouType !== 'program') fail(`tasks[${taskIndex}].instances[${instanceIndex}].pou`, 'Task 实例只能引用 program POU');
    });
  });
  config.devices.forEach((device, deviceIndex) => {
    const connections = new Set((device.connections ?? []).map((item) => item.networkId.toLocaleUpperCase()));
    (device.connections ?? []).forEach((connection, connectionIndex) => {
      if (!networks.has(connection.networkId.toLocaleUpperCase())) fail(`devices[${deviceIndex}].connections[${connectionIndex}].networkId`, `引用的网络不存在: ${connection.networkId}`);
    });
    device.points.forEach((point, pointIndex) => {
      if (point.address.kind !== 'protocol') return;
      const key = point.address.networkId.toLocaleUpperCase();
      if (!networks.has(key)) fail(`devices[${deviceIndex}].points[${pointIndex}].address.networkId`, `引用的网络不存在: ${point.address.networkId}`);
      if (!connections.has(key)) fail(`devices[${deviceIndex}].points[${pointIndex}].address.networkId`, '设备 connections 中缺少对应网络');
    });
  });
  config.ioMappings.forEach((mapping, mappingIndex) => {
    const task = tasks.get(mapping.task.toLocaleUpperCase());
    if (!task) fail(`ioMappings[${mappingIndex}].task`, `引用的 Task 不存在: ${mapping.task}`);
    if (!task.instances.some((item) => item.name.toLocaleUpperCase() === mapping.instance.toLocaleUpperCase())) fail(`ioMappings[${mappingIndex}].instance`, `Task ${task.name} 中不存在实例 ${mapping.instance}`);
    const slash = mapping.point.indexOf('/');
    if (slash <= 0 || slash === mapping.point.length - 1) fail(`ioMappings[${mappingIndex}].point`, '必须是 <deviceId>/<pointId>');
    const device = devices.get(mapping.point.slice(0, slash).toLocaleUpperCase());
    const pointId = mapping.point.slice(slash + 1);
    if (!device || !device.points.some((item) => item.id.toLocaleUpperCase() === pointId.toLocaleUpperCase())) fail(`ioMappings[${mappingIndex}].point`, `引用的点位不存在: ${mapping.point}`);
  });
}

function validateV2(value: unknown): PlcRuntimeConfig {
  const raw = record(value, 'root');
  allowedKeys(raw, ['schemaVersion', 'tasks', 'pous', 'devices', 'networks', 'ioMappings', 'runtimeOverrides'], 'root');
  if (raw.schemaVersion !== PLC_RUNTIME_CONFIG_SCHEMA_VERSION) fail('schemaVersion', `只支持版本 ${PLC_RUNTIME_CONFIG_SCHEMA_VERSION}`);
  const tasks = array(raw.tasks, 'tasks').map((item, index) => parseTask(item, `tasks[${index}]`));
  const pous = array(raw.pous, 'pous').map((item, index) => parsePou(item, `pous[${index}]`));
  const devices = array(raw.devices, 'devices').map((item, index) => parseDevice(item, `devices[${index}]`));
  const networks = array(raw.networks, 'networks').map((item, index) => parseNetwork(item, `networks[${index}]`));
  const ioMappings = array(raw.ioMappings, 'ioMappings').map((item, index) => parseIoMapping(item, `ioMappings[${index}]`));
  uniqueNames(tasks.map((item) => item.name), 'tasks');
  uniqueNames(pous.map((item) => item.name), 'pous');
  uniqueNames(devices.map((item) => item.id), 'devices');
  uniqueNames(networks.map((item) => item.id), 'networks');
  const result: PlcRuntimeConfig = { schemaVersion: PLC_RUNTIME_CONFIG_SCHEMA_VERSION, tasks, pous, devices, networks, ioMappings };
  if (raw.runtimeOverrides !== undefined) result.runtimeOverrides = parseRuntimeOverrides(raw.runtimeOverrides, 'runtimeOverrides');
  validateReferences(result);
  return result;
}

function migrateV1(value: Record<string, unknown>): PlcRuntimeConfig {
  allowedKeys(value, ['schemaVersion', 'configuration'], 'root');
  const configuration = record(value.configuration, 'configuration');
  allowedKeys(configuration, ['name', 'resources'], 'configuration');
  identifier(configuration.name, 'configuration.name');
  const tasks: PlcTaskConfig[] = [];
  const pousByName = new Map<string, PlcPouConfig>();
  const devicesById = new Map<string, PlcDeviceConfig>();
  array(configuration.resources, 'configuration.resources', false).forEach((resourceValue, resourceIndex) => {
    const resourcePath = `configuration.resources[${resourceIndex}]`;
    const resource = record(resourceValue, resourcePath);
    allowedKeys(resource, ['name', 'target', 'tasks'], resourcePath);
    identifier(resource.name, `${resourcePath}.name`);
    const deviceId = identifier(resource.target, `${resourcePath}.target`);
    if (!devicesById.has(deviceId.toLocaleUpperCase())) devicesById.set(deviceId.toLocaleUpperCase(), { id: deviceId, role: 'local', model: deviceId, points: [], connections: [] });
    array(resource.tasks, `${resourcePath}.tasks`, false).forEach((taskValue, taskIndex) => {
      const taskPath = `${resourcePath}.tasks[${taskIndex}]`;
      const rawTask = record(taskValue, taskPath);
      allowedKeys(rawTask, ['name', 'type', 'periodMs', 'priority', 'cpuCore', 'programs', 'trigger'], taskPath);
      const type = rawTask.type === 'cycle' ? 'cyclic' : rawTask.type;
      if (type !== 'cyclic' && type !== 'event') fail(`${taskPath}.type`, '必须是 cyclic、cycle 或 event');
      const instances = array(rawTask.programs, `${taskPath}.programs`, false).map((programValue, programIndex) => {
        const programPath = `${taskPath}.programs[${programIndex}]`;
        const program = record(programValue, programPath);
        allowedKeys(program, ['instanceName', 'typeName', 'source', 'retain'], programPath);
        const name = identifier(program.typeName, `${programPath}.typeName`);
        const source = relativeSource(program.source, `${programPath}.source`);
        const existing = pousByName.get(name.toLocaleUpperCase());
        if (existing && existing.source !== source) fail(`${programPath}.source`, `POU ${name} 对应了多个源文件`);
        pousByName.set(name.toLocaleUpperCase(), { name, pouType: 'program', source });
        return { name: identifier(program.instanceName, `${programPath}.instanceName`), pou: name };
      });
      tasks.push({ name: identifier(rawTask.name, `${taskPath}.name`), deviceId, type, periodMs: positiveNumber(rawTask.periodMs, `${taskPath}.periodMs`), priority: integer(rawTask.priority, `${taskPath}.priority`, 0, 31), cpuCore: integer(rawTask.cpuCore, `${taskPath}.cpuCore`, 0), instances });
    });
  });
  return validateV2({ schemaVersion: PLC_RUNTIME_CONFIG_SCHEMA_VERSION, tasks, pous: [...pousByName.values()], devices: [...devicesById.values()], networks: [], ioMappings: [] });
}

export function validatePlcRuntimeConfig(value: unknown): PlcRuntimeConfig {
  const raw = record(value, 'root');
  return raw.schemaVersion === 1 ? migrateV1(raw) : validateV2(raw);
}
export function plcRuntimeConfigPath(workspaceRoot: string): string {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) throw new PlcRuntimeConfigError('workspaceRoot: 必须是非空字符串');
  return path.join(path.resolve(workspaceRoot), PLC_RUNTIME_CONFIG_FILE_NAME);
}
export async function readPlcRuntimeConfig(filePath: string): Promise<PlcRuntimeConfig | undefined> {
  let text: string;
  try { text = await fs.readFile(filePath, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new PlcRuntimeConfigError(`读取 ${filePath} 失败: ${error instanceof Error ? error.message : String(error)}`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (error) { throw new PlcRuntimeConfigError(`解析 ${filePath} 失败: ${error instanceof Error ? error.message : String(error)}`); }
  try { return validatePlcRuntimeConfig(parsed); }
  catch (error) {
    if (error instanceof PlcRuntimeConfigError) throw new PlcRuntimeConfigError(`${filePath}: ${error.message}`);
    throw error;
  }
}
async function writeAtomic(filePath: string, config: PlcRuntimeConfig): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, filePath);
  } finally { await fs.rm(tempPath, { force: true }).catch(() => undefined); }
}
export async function writePlcRuntimeConfig(filePath: string, value: unknown): Promise<PlcRuntimeConfig> {
  const config = validatePlcRuntimeConfig(value);
  await writeAtomic(filePath, config);
  return config;
}
export class PlcRuntimeConfigStore {
  private static readonly queues = new Map<string, Promise<void>>();
  constructor(private readonly filePath: string) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) throw new PlcRuntimeConfigError('filePath: 必须是非空字符串');
  }
  private queueKey(): string {
    const resolved = path.resolve(this.filePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const key = this.queueKey();
    const previous = PlcRuntimeConfigStore.queues.get(key) ?? Promise.resolve();
    const current = previous.then(operation);
    const settled = current.then(() => undefined, () => undefined);
    PlcRuntimeConfigStore.queues.set(key, settled);
    void settled.then(() => { if (PlcRuntimeConfigStore.queues.get(key) === settled) PlcRuntimeConfigStore.queues.delete(key); });
    return current;
  }
  read(): Promise<PlcRuntimeConfig | undefined> { return this.enqueue(() => readPlcRuntimeConfig(this.filePath)); }
  write(value: unknown): Promise<PlcRuntimeConfig> { return this.enqueue(() => writePlcRuntimeConfig(this.filePath, value)); }
}
