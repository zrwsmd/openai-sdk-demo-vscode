import path from 'node:path';
import {
  PLC_RUNTIME_CONFIG_SCHEMA_VERSION,
  PlcRuntimeConfigError,
  type PlcProgramBinding,
  type PlcRuntimeConfig,
  type PlcTaskConfig,
} from './plcRuntimeConfig';
import {
  createPlcRuntimeConfigRepository,
  type PlcRuntimeConfigState,
} from './plcRuntimeConfigRepository';
import {
  extractPlcProgramDeclarations,
  inspectPlcProgramBindings,
} from './plcProgramBinding';

export interface PlcClarificationOption {
  id: string;
  label: string;
  description?: string;
  value?: unknown;
}

export interface PlcClarificationResponse {
  requestId: string;
  cancelled: boolean;
  selectedOptionId?: string;
  customText?: string;
  value?: unknown;
}

export interface PlcClarificationService {
  request(
    request: {
      kind?: string;
      title: string;
      question: string;
      details?: string;
      options?: readonly PlcClarificationOption[];
      allowCustom?: boolean;
      customPlaceholder?: string;
      required?: boolean;
      metadata?: Record<string, unknown>;
    },
    signal?: AbortSignal,
  ): Promise<PlcClarificationResponse>;
}

export interface PlcRuntimeConfigSyncPlan {
  filePath: string;
  action: 'create_config' | 'create_task' | 'bind_program';
  programName: string;
  source: string;
  taskName: string;
  resourceName: string;
  periodMs?: number;
  commit(): Promise<PlcRuntimeConfig>;
}

export interface PreparePlcRuntimeConfigSyncOptions {
  workspaceRoot: string;
  source: string;
  content: string;
  clarification?: PlcClarificationService;
  signal?: AbortSignal;
}

class PlcRuntimeConfigSyncCancelledError extends PlcRuntimeConfigError {
  constructor() {
    super('用户取消了 PLC 任务组态，已停止写入。');
    this.name = 'PlcRuntimeConfigSyncCancelledError';
  }
}

const IEC_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSource(source: string): string {
  return source.trim().replaceAll('\\', '/').replace(/^\.\/+/u, '');
}

function isWorkspaceRelativeSource(source: string): boolean {
  const normalized = normalizeSource(source);
  return !!normalized &&
    !path.isAbsolute(normalized) &&
    !/^[A-Za-z]:\//u.test(normalized) &&
    !normalized.split('/').some((part) => part === '..' || part === '.');
}

function uniqueName(base: string, existing: Iterable<string>): string {
  const used = new Set([...existing].map((item) => item.toLocaleUpperCase()));
  const normalized = IEC_IDENTIFIER.test(base) ? base : 'MainTask';
  if (!used.has(normalized.toLocaleUpperCase())) return normalized;
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${normalized}_${index}`;
    if (!used.has(candidate.toLocaleUpperCase())) return candidate;
  }
  throw new PlcRuntimeConfigError(`无法生成唯一名称: ${normalized}`);
}

function allTaskNames(config: PlcRuntimeConfig | undefined): string[] {
  return config?.configuration.resources.flatMap((resource) =>
    resource.tasks.map((task) => task.name),
  ) ?? [];
}

function firstResource(config: PlcRuntimeConfig | undefined): { name: string; target: string } {
  const resource = config?.configuration.resources[0];
  return {
    name: resource?.name ?? 'resource_MainTask',
    target: resource?.target ?? 'PLC',
  };
}

function taskLabel(task: PlcTaskConfig): string {
  const period = task.type === 'cyclic' && task.periodMs !== undefined
    ? `${task.periodMs} ms`
    : task.type;
  return `${task.name} (${period}, priority ${task.priority})`;
}

type Selection =
  | {
      action: 'bind_program';
      resourceName: string;
      taskName: string;
    }
  | {
      action: 'create_config' | 'create_task';
      resourceName: string;
      target: string;
      taskName: string;
      periodMs: number;
      priority: number;
      cpuCore: number;
    };

function selectionValue(value: Selection): string {
  return JSON.stringify(value);
}

function parseSelectionValue(value: unknown): Selection | undefined {
  const parsed = typeof value === 'string'
    ? tryParseJson(value)
    : value;
  if (!isRecord(parsed) || typeof parsed.action !== 'string') return undefined;
  if (parsed.action === 'bind_program') {
    if (typeof parsed.resourceName !== 'string' || typeof parsed.taskName !== 'string') return undefined;
    return {
      action: 'bind_program',
      resourceName: parsed.resourceName,
      taskName: parsed.taskName,
    };
  }
  if (parsed.action === 'create_config' || parsed.action === 'create_task') {
    if (
      typeof parsed.resourceName !== 'string' ||
      typeof parsed.target !== 'string' ||
      typeof parsed.taskName !== 'string' ||
      typeof parsed.periodMs !== 'number' ||
      typeof parsed.priority !== 'number' ||
      typeof parsed.cpuCore !== 'number'
    ) {
      return undefined;
    }
    return {
      action: parsed.action,
      resourceName: parsed.resourceName,
      target: parsed.target,
      taskName: parsed.taskName,
      periodMs: parsed.periodMs,
      priority: parsed.priority,
      cpuCore: parsed.cpuCore,
    };
  }
  return undefined;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseCustomSelection(
  text: string | undefined,
  fallback: Extract<Selection, { action: 'create_config' | 'create_task' }>,
): Extract<Selection, { action: 'create_config' | 'create_task' }> | undefined {
  const raw = String(text ?? '').trim();
  if (!raw) return undefined;
  const ms = /(\d+(?:\.\d+)?)\s*ms\b/iu.exec(raw);
  const seconds = /(\d+(?:\.\d+)?)\s*s\b/iu.exec(raw);
  const periodMs = ms
    ? Number(ms[1])
    : seconds
      ? Number(seconds[1]) * 1000
      : undefined;
  if (!periodMs || !Number.isFinite(periodMs) || periodMs <= 0) return undefined;
  const taskName = /(?:task|任务)\s*[=:：]\s*([A-Za-z_][A-Za-z0-9_]*)/iu.exec(raw)?.[1] ??
    fallback.taskName;
  const resourceName = /(?:resource|资源)\s*[=:：]\s*([A-Za-z_][A-Za-z0-9_]*)/iu.exec(raw)?.[1] ??
    fallback.resourceName;
  const target = /(?:target|plc|目标)\s*[=:：]\s*([A-Za-z_][A-Za-z0-9_]*)/iu.exec(raw)?.[1] ??
    fallback.target;
  const priority = /(?:priority|优先级)\s*[=:：]\s*(\d+)/iu.exec(raw)?.[1];
  const cpuCore = /(?:cpu|core|核心)\s*[=:：]\s*(\d+)/iu.exec(raw)?.[1];
  return {
    ...fallback,
    taskName,
    resourceName,
    target,
    periodMs,
    priority: priority ? Number(priority) : fallback.priority,
    cpuCore: cpuCore ? Number(cpuCore) : fallback.cpuCore,
  };
}

function createProgramBinding(
  task: PlcTaskConfig | undefined,
  programName: string,
  source: string,
): PlcProgramBinding {
  const instanceName = uniqueName(
    `instance_${programName}`,
    task?.programs.map((item) => item.instanceName) ?? [],
  );
  return {
    instanceName,
    typeName: programName,
    source,
  };
}

function cloneConfig(config: PlcRuntimeConfig): PlcRuntimeConfig {
  return JSON.parse(JSON.stringify(config)) as PlcRuntimeConfig;
}

function applySelection(
  state: PlcRuntimeConfigState,
  selection: Selection,
  programName: string,
  source: string,
): {
  config: PlcRuntimeConfig;
  action: PlcRuntimeConfigSyncPlan['action'];
  taskName: string;
  resourceName: string;
  periodMs?: number;
} {
  if (selection.action === 'create_config') {
    const task: PlcTaskConfig = {
      name: selection.taskName,
      type: 'cyclic',
      periodMs: selection.periodMs,
      priority: selection.priority,
      cpuCore: selection.cpuCore,
      programs: [createProgramBinding(undefined, programName, source)],
    };
    return {
      action: 'create_config',
      taskName: task.name,
      resourceName: selection.resourceName,
      periodMs: task.periodMs,
      config: {
        schemaVersion: PLC_RUNTIME_CONFIG_SCHEMA_VERSION,
        configuration: {
          name: 'CONFIG_IEC',
          resources: [{
            name: selection.resourceName,
            target: selection.target,
            tasks: [task],
          }],
        },
      },
    };
  }

  if (state.status !== 'ready') {
    throw new PlcRuntimeConfigError('当前没有可更新的 plc-runtime.json。');
  }
  const config = cloneConfig(state.config);
  const resource = config.configuration.resources.find((item) => item.name === selection.resourceName);
  if (!resource) throw new PlcRuntimeConfigError(`未找到资源: ${selection.resourceName}`);

  if (selection.action === 'bind_program') {
    const task = resource.tasks.find((item) => item.name === selection.taskName);
    if (!task) throw new PlcRuntimeConfigError(`未找到任务: ${selection.taskName}`);
    task.programs.push(createProgramBinding(task, programName, source));
    return {
      config,
      action: 'bind_program',
      taskName: task.name,
      resourceName: resource.name,
      periodMs: task.periodMs,
    };
  }

  const task: PlcTaskConfig = {
    name: selection.taskName,
    type: 'cyclic',
    periodMs: selection.periodMs,
    priority: selection.priority,
    cpuCore: selection.cpuCore,
    programs: [createProgramBinding(undefined, programName, source)],
  };
  resource.tasks.push(task);
  return {
    config,
    action: 'create_task',
    taskName: task.name,
    resourceName: resource.name,
    periodMs: task.periodMs,
  };
}

function optionsForState(
  state: PlcRuntimeConfigState,
  programName: string,
): {
  options: PlcClarificationOption[];
  createFallback: Extract<Selection, { action: 'create_config' | 'create_task' }>;
} {
  const config = state.status === 'ready' ? state.config : undefined;
  const resource = firstResource(config);
  const createAction = state.status === 'ready' ? 'create_task' : 'create_config';
  const taskName = uniqueName('MainTask', allTaskNames(config));
  const createFallback = {
    action: createAction,
    resourceName: resource.name,
    target: resource.target,
    taskName,
    periodMs: 20,
    priority: 1,
    cpuCore: 1,
  } satisfies Extract<Selection, { action: 'create_config' | 'create_task' }>;
  const options: PlcClarificationOption[] = [];

  if (config) {
    for (const candidateResource of config.configuration.resources) {
      for (const task of candidateResource.tasks) {
        options.push({
          id: `bind:${candidateResource.name}:${task.name}`,
          label: `绑定到 ${taskLabel(task)}`,
          description: `资源 ${candidateResource.name} / 目标 ${candidateResource.target}`,
          value: selectionValue({
            action: 'bind_program',
            resourceName: candidateResource.name,
            taskName: task.name,
          }),
        });
      }
    }
  }

  for (const periodMs of [20, 100, 1000]) {
    options.push({
      id: `create:${periodMs}ms`,
      label: `创建 ${taskName} · ${periodMs} ms`,
      description: `资源 ${resource.name}，优先级 1，CPU 核心 1`,
      value: selectionValue({
        ...createFallback,
        periodMs,
      }),
    });
  }
  return { options, createFallback };
}

export async function preparePlcRuntimeConfigSync(
  options: PreparePlcRuntimeConfigSyncOptions,
): Promise<PlcRuntimeConfigSyncPlan | undefined> {
  const source = normalizeSource(options.source);
  if (
    !options.workspaceRoot.trim() ||
    !source.toLocaleLowerCase().endsWith('.st') ||
    !isWorkspaceRelativeSource(source)
  ) {
    return undefined;
  }
  const declarations = extractPlcProgramDeclarations(options.content);
  if (declarations.length === 0) return undefined;
  if (declarations.length > 1) {
    throw new PlcRuntimeConfigError('一个 ST 文件包含多个 PROGRAM，第一版不会自动生成任务组态。');
  }
  if (!options.clarification) return undefined;

  const repository = createPlcRuntimeConfigRepository(options.workspaceRoot);
  const state = await repository.refresh();
  if (state.status === 'invalid') {
    throw new PlcRuntimeConfigError(`plc-runtime.json 无法解析，先修复后再生成任务组态: ${state.error.message}`);
  }

  const programName = declarations[0].name;
  if (state.status === 'ready') {
    const inspection = inspectPlcProgramBindings(state.config, {
      source,
      text: options.content,
    });
    const resolution = inspection.resolutions[0];
    if (resolution?.status === 'bound') return undefined;
    if (resolution?.status === 'ambiguous') {
      throw new PlcRuntimeConfigError(`PROGRAM ${programName} 的任务绑定重复，请先修复 plc-runtime.json。`);
    }
  }

  const { options: choices, createFallback } = optionsForState(state, programName);
  const response = await options.clarification.request({
    kind: 'plc_task_configuration',
    title: '任务组态确认',
    question: `PROGRAM ${programName} 还没有明确的 PLC 任务绑定。请选择任务周期或绑定已有任务。`,
    details: `源文件: ${source}。这只会更新 plc-runtime.json，不会向 ST 文件追加 CONFIGURATION。`,
    options: choices,
    allowCustom: true,
    customPlaceholder: '例如: MainTask, 20ms, priority=1, cpu=1, resource=resource_MainTask',
    required: true,
    metadata: {
      source,
      programName,
    },
  }, options.signal);
  if (response.cancelled) throw new PlcRuntimeConfigSyncCancelledError();

  const selectedOption = choices.find((item) => item.id === response.selectedOptionId);
  const selectedValue = response.value ?? selectedOption?.value;
  let selection = parseSelectionValue(selectedValue);
  if (!selection && response.customText) {
    selection = parseCustomSelection(response.customText, createFallback);
  }
  if (!selection) {
    throw new PlcRuntimeConfigError('无法解析任务组态选择，请选择候选项或填写类似 "20ms, priority=1, cpu=1" 的答案。');
  }

  const applied = applySelection(state, selection, programName, source);
  return {
    filePath: repository.filePath,
    action: applied.action,
    programName,
    source,
    taskName: applied.taskName,
    resourceName: applied.resourceName,
    ...(applied.periodMs === undefined ? {} : { periodMs: applied.periodMs }),
    commit: async () => (await repository.save(applied.config)).config,
  };
}
