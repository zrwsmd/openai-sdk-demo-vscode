import path from 'node:path';
import { Agent, Runner } from '@openai/agents';
import { z } from 'zod';
import { agentLog, buildModelAdapter } from '../runtime/modelGateway';
import type { AgentConfig } from '../runtime/agentConfig';
import { collectWorkspaceStContext } from '../analysis/workspaceStContext';
import { WorkspaceScope } from '../workspace/workspaceScope';
import {
  PLC_RUNTIME_CONFIG_SCHEMA_VERSION,
  PlcRuntimeConfigError,
  type PlcPouConfig,
  type PlcRuntimeConfig,
  type PlcTaskConfig,
} from './plcRuntimeConfig';
import {
  createPlcRuntimeConfigRepository,
  type PlcRuntimeConfigState,
} from './plcRuntimeConfigRepository';
import {
  extractPlcPouDeclarations,
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
  action: 'create_config' | 'create_task' | 'bind_program' | 'sync_pous';
  pous: readonly PlcPouConfig[];
  programName?: string;
  source: string;
  taskName?: string;
  deviceId?: string;
  periodMs?: number;
  commit(): Promise<PlcRuntimeConfig>;
}

export interface PlcTaskSuggestion {
  /**
   * 任务组角色，而不是当前 PROGRAM 的业务名称。
   * taskName 是规范化后的展示/持久化名称；模型不会直接提供它。
   */
  taskGroup: PlcTaskGroup;
  periodMs: number;
  reason?: string;
  taskName?: string;
}

export type PlcTaskGroup =
  | 'fast_control'
  | 'main_control'
  | 'slow_monitor';

type NormalizedPlcTaskSuggestion = PlcTaskSuggestion & {
  taskName: string;
};

export interface PlcTaskSuggestionInput {
  userRequest?: string;
  programName: string;
  source: string;
  stContent: string;
  existingTasks: readonly {
    name: string;
    type: PlcTaskConfig['type'];
    periodMs?: number;
    programCount: number;
  }[];
}

export type PlcTaskSuggestionProvider = (
  input: PlcTaskSuggestionInput,
  signal?: AbortSignal,
) => Promise<readonly PlcTaskSuggestion[]>;

export interface PreparePlcRuntimeConfigSyncOptions {
  workspaceRoot: string;
  source: string;
  content: string;
  userRequest?: string;
  modelConfig?: AgentConfig;
  taskSuggestionProvider?: PlcTaskSuggestionProvider;
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
const MAX_POU_INDEX_FILES = 1_000;
const MAX_POU_SOURCE_BYTES = 2 * 1024 * 1024;
const PLC_TASK_GROUP_NAMES: Record<PlcTaskGroup, string> = {
  fast_control: 'FastControlTask',
  main_control: 'MainControlTask',
  slow_monitor: 'SlowMonitorTask',
};

const plcTaskSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    taskGroup: z.enum(['fast_control', 'main_control', 'slow_monitor']),
    periodMs: z.number().int().min(1).max(86_400_000),
    reason: z.string().min(1).max(240),
  }).strict()).min(1).max(4),
}).strict();

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
  return config?.tasks.map((task) => task.name) ?? [];
}

function firstLocalDevice(config: PlcRuntimeConfig | undefined): { id: string; model: string } {
  const device = config?.devices.find((candidate) => candidate.role === 'local');
  return {
    id: device?.id ?? 'plc',
    model: device?.model ?? 'PLC',
  };
}

function taskLabel(task: PlcTaskConfig): string {
  const period = task.type === 'cyclic' && task.periodMs !== undefined
    ? `${task.periodMs} ms`
    : task.type;
  return `${task.name} (${period})`;
}

type Selection =
  | {
      action: 'bind_program';
      taskName: string;
    }
  | {
      action: 'create_config' | 'create_task';
      deviceId: string;
      deviceModel: string;
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
    if (typeof parsed.taskName !== 'string') return undefined;
    return {
      action: 'bind_program',
      taskName: parsed.taskName,
    };
  }
  if (parsed.action === 'create_config' || parsed.action === 'create_task') {
    if (
      typeof parsed.deviceId !== 'string' ||
      typeof parsed.deviceModel !== 'string' ||
      typeof parsed.taskName !== 'string' ||
      typeof parsed.periodMs !== 'number' ||
      typeof parsed.priority !== 'number' ||
      typeof parsed.cpuCore !== 'number'
    ) {
      return undefined;
    }
    return {
      action: parsed.action,
      deviceId: parsed.deviceId,
      deviceModel: parsed.deviceModel,
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

function stripJsonFence(value: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(value.trim());
  return match?.[1]?.trim() ?? value.trim();
}

function extractJsonObject(value: string): string | undefined {
  const start = value.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }
  return undefined;
}

function parseTaskSuggestionOutput(value: unknown): PlcTaskSuggestion[] {
  const raw = typeof value === 'string'
    ? value.trim()
    : JSON.stringify(value ?? '');
  const unfenced = stripJsonFence(raw);
  const candidates = [...new Set([
    unfenced,
    extractJsonObject(unfenced),
  ].filter((candidate): candidate is string => Boolean(candidate)))];
  for (const candidate of candidates) {
    try {
      const parsed = plcTaskSuggestionSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data.suggestions;
    } catch {
      // Try the next candidate, then report one stable error below.
    }
  }
  throw new PlcRuntimeConfigError(
    `任务建议模型输出不是有效的任务候选 JSON: ${JSON.stringify(unfenced.slice(0, 500))}`,
  );
}

function classifierUsesNativeStructuredOutput(cfg: AgentConfig): boolean {
  return !cfg.baseUrl.trim();
}

function existingTaskPrompt(
  tasks: PlcTaskSuggestionInput['existingTasks'],
): string {
  if (!tasks.length) return '（当前还没有已存在的任务）';
  return tasks.map((task) => {
    const period = task.periodMs === undefined ? task.type : `${task.periodMs}ms`;
    return `- ${task.name}: ${period}, 已绑定 ${task.programCount} 个 PROGRAM`;
  }).join('\n');
}

export async function suggestPlcTaskOptions(
  cfg: AgentConfig,
  input: PlcTaskSuggestionInput,
  signal?: AbortSignal,
): Promise<readonly PlcTaskSuggestion[]> {
  const adapter = buildModelAdapter(cfg, 'plc_task_suggester');
  const nativeStructuredOutput = classifierUsesNativeStructuredOutput(cfg);
  const taskContext = input.stContent.trim().slice(0, 12_000);
  const userRequest = input.userRequest?.trim() || '（未提供原始用户需求，请结合 PROGRAM 名和 ST 内容判断）';
  const prompt =
    '用户正在生成一个 IEC 61131-3 ST PROGRAM，需要决定新建 PLC 周期任务。' +
    '你只负责推荐“新建任务组”的候选，不要修改已有任务，也不要推荐绑定已有任务。' +
    '一个任务可以绑定多个 PROGRAM，因此候选必须描述可复用的运行职责，而不是当前业务功能。' +
    '请先根据实时性和运行职责判断任务组角色，再给出 2 到 4 个角色与周期组合。' +
    'taskGroup 只能是 fast_control、main_control、slow_monitor：' +
    'fast_control 表示快速闭环/高速控制，main_control 表示常规主控制，' +
    'slow_monitor 表示低频监视、统计或诊断。' +
    '不要根据当前 PROGRAM 或用户业务对象起名，不要输出 PressureControlTask、TemperatureMonitorTask、' +
    'PID_ConstantPressureTask 这类只适用于当前业务的名称；任务组名称由程序按角色统一生成。' +
    '周期必须是正整数毫秒，优先使用常见的 5、10、20、50、100、200、500、1000ms 等值。' +
    '不要输出 taskName、priority、cpuCore 或 resource 字段，这些由程序统一处理。' +
    '不要把已有任务名称原样作为新任务名；不要输出 markdown 或额外解释。' +
    (nativeStructuredOutput
      ? '必须严格返回 schema。'
      : '必须只返回一个 JSON 对象，格式为 {"suggestions":[{"taskGroup":"main_control","periodMs":20,"reason":"..."}]}。') +
    `\n\n用户原始需求:\n${userRequest}` +
    `\n\nPROGRAM: ${input.programName}` +
    `\n\n源文件: ${input.source}` +
    `\n\n已有任务:\n${existingTaskPrompt(input.existingTasks)}` +
    `\n\nST 内容:\n${taskContext}`;

  agentLog(
    `[plc-task] suggest start model=${cfg.model} provider=${adapter.provider} ` +
      `apiFormat=${adapter.apiFormat} program=${input.programName}`,
  );
  const instructions =
    '你是 PLC 任务组建议器，只负责推荐“新建任务组”的候选。' +
    '一个任务可绑定多个 PROGRAM，所以必须按运行职责和实时性给出可复用的任务组角色，' +
    '不能把当前 PROGRAM 或业务对象写进任务名。' +
    'taskGroup 只能是 fast_control、main_control、slow_monitor；' +
    '不要输出 taskName、priority、cpuCore 或 resource 字段。周期必须是正整数毫秒。' +
    '不要输出 markdown 或额外解释。' +
    (nativeStructuredOutput
      ? '必须严格返回 schema。'
      : '必须只返回一个 JSON 对象，格式为 {"suggestions":[{"taskGroup":"main_control","periodMs":20,"reason":"..."}]}。');
  const agent = new Agent({
    name: 'PLC 任务周期建议器',
    model: adapter.model,
    instructions,
    ...(nativeStructuredOutput ? { outputType: plcTaskSuggestionSchema } : {}),
  });
  const tracingDisabled = !(
    adapter.provider === 'openai' &&
    adapter.apiFormat === 'responses' &&
    !cfg.baseUrl.trim()
  );
  try {
    const result = await new Runner({ tracingDisabled }).run(agent, prompt, {
      stream: false,
      maxTurns: 1,
      signal,
    });
    const suggestions = nativeStructuredOutput
      ? plcTaskSuggestionSchema.parse(result.finalOutput).suggestions
      : parseTaskSuggestionOutput(result.finalOutput);
    agentLog(`[plc-task] suggest success count=${suggestions.length}`);
    return suggestions;
  } catch (error) {
    agentLog(
      `[plc-task] suggest failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
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
  const deviceId = /(?:device|设备)\s*[=:：]\s*([A-Za-z_][A-Za-z0-9_]*)/iu.exec(raw)?.[1] ??
    fallback.deviceId;
  const priority = /(?:priority|优先级)\s*[=:：]\s*(\d+)/iu.exec(raw)?.[1];
  const cpuCore = /(?:cpu|core|核心)\s*[=:：]\s*(\d+)/iu.exec(raw)?.[1];
  return {
    ...fallback,
    taskName,
    deviceId,
    periodMs,
    priority: priority ? Number(priority) : fallback.priority,
    cpuCore: cpuCore ? Number(cpuCore) : fallback.cpuCore,
  };
}

function defaultTaskSuggestions(
  config: PlcRuntimeConfig | undefined,
): NormalizedPlcTaskSuggestion[] {
  const existing = allTaskNames(config);
  const suggestions: PlcTaskSuggestion[] = [
    {
      taskGroup: 'fast_control',
      periodMs: 5,
      reason: '适合快速闭环或实时性要求较高的控制组。',
    },
    {
      taskGroup: 'main_control',
      periodMs: 20,
      reason: '适合常规控制逻辑，可继续绑定多个同类 PROGRAM。',
    },
    {
      taskGroup: 'slow_monitor',
      periodMs: 100,
      reason: '适合低频监视、统计或诊断逻辑。',
    },
  ];
  return suggestions.map((suggestion): NormalizedPlcTaskSuggestion => ({
    ...suggestion,
    taskName: uniqueName(PLC_TASK_GROUP_NAMES[suggestion.taskGroup], existing),
  }));
}

function normalizeTaskSuggestions(
  suggestions: readonly PlcTaskSuggestion[],
  config: PlcRuntimeConfig | undefined,
): NormalizedPlcTaskSuggestion[] {
  const existing = allTaskNames(config);
  const normalized: NormalizedPlcTaskSuggestion[] = [];
  const seen = new Set<string>();
  for (const suggestion of suggestions) {
    const taskGroup = suggestion.taskGroup;
    if (!(taskGroup in PLC_TASK_GROUP_NAMES)) continue;
    const periodMs = suggestion.periodMs;
    if (
      !Number.isInteger(periodMs) ||
      periodMs <= 0 ||
      periodMs > 86_400_000
    ) {
      continue;
    }
    const uniqueTaskName = uniqueName(
      PLC_TASK_GROUP_NAMES[taskGroup],
      existing,
    );
    const key = `${uniqueTaskName.toLocaleUpperCase()}:${periodMs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      taskGroup,
      taskName: uniqueTaskName,
      periodMs,
      ...(suggestion.reason?.trim() ? { reason: suggestion.reason.trim() } : {}),
    });
  }
  return normalized.slice(0, 4);
}

function createTaskInstance(
  task: PlcTaskConfig | undefined,
  programName: string,
): PlcTaskConfig['instances'][number] {
  const name = uniqueName(
    `instance_${programName}`,
    task?.instances.map((item) => item.name) ?? [],
  );
  return { name, pou: programName };
}

function cloneConfig(config: PlcRuntimeConfig): PlcRuntimeConfig {
  return JSON.parse(JSON.stringify(config)) as PlcRuntimeConfig;
}

function pousForSource(content: string, source: string): PlcPouConfig[] {
  const declarations = extractPlcPouDeclarations(content);
  const seen = new Set<string>();
  return declarations.map((declaration) => {
    const key = declaration.name.toLocaleUpperCase();
    if (seen.has(key)) {
      throw new PlcRuntimeConfigError(`源文件 ${source} 中 POU 名称重复: ${declaration.name}`);
    }
    seen.add(key);
    return {
      name: declaration.name,
      pouType: declaration.type,
      source,
    };
  });
}

async function collectWorkspacePous(
  workspaceRoot: string,
  pendingSource: string,
  pendingContent: string,
): Promise<PlcPouConfig[]> {
  const pendingKey = normalizeSource(pendingSource).toLocaleLowerCase();
  const collected = await collectWorkspaceStContext(
    new WorkspaceScope([workspaceRoot]),
    {
      maxFiles: MAX_POU_INDEX_FILES,
      maxFileBytes: MAX_POU_SOURCE_BYTES,
      excludePaths: [pendingSource],
    },
  );
  if (collected.truncated) {
    throw new PlcRuntimeConfigError(
      `工作区包含超过 ${MAX_POU_INDEX_FILES} 个 ST 文件，无法可靠生成完整 POU 索引。`,
    );
  }
  if (collected.skipped > 0) {
    throw new PlcRuntimeConfigError(
      `有 ${collected.skipped} 个 ST 文件无法读取或超过 ${MAX_POU_SOURCE_BYTES} 字节，` +
        '无法可靠生成完整 POU 索引。',
    );
  }
  const files = collected.files
    .map((file) => ({
      source: normalizeSource(path.relative(workspaceRoot, file.path)),
      content: file.text,
    }))
    .filter((file) => file.source.toLocaleLowerCase() !== pendingKey)
    .sort((left, right) => left.source.localeCompare(right.source));

  const byName = new Map<string, PlcPouConfig>();
  const addPous = (pous: readonly PlcPouConfig[]): void => {
    for (const pou of pous) {
      const key = pou.name.toLocaleUpperCase();
      const existing = byName.get(key);
      if (existing) {
        throw new PlcRuntimeConfigError(
          `POU ${pou.name} 在多个源文件中重复声明: ${existing.source}、${pou.source}`,
        );
      }
      byName.set(key, pou);
    }
  };

  for (const file of files) {
    addPous(pousForSource(file.content, file.source));
  }
  addPous(pousForSource(pendingContent, pendingSource));
  return [...byName.values()].sort((left, right) =>
    left.source.localeCompare(right.source) || left.name.localeCompare(right.name),
  );
}

function configWithWorkspacePous(
  state: PlcRuntimeConfigState,
  pous: readonly PlcPouConfig[],
): { config: PlcRuntimeConfig; changed: boolean } {
  const config: PlcRuntimeConfig = state.status === 'ready'
    ? cloneConfig(state.config)
    : {
        schemaVersion: PLC_RUNTIME_CONFIG_SCHEMA_VERSION,
        tasks: [],
        pous: [],
        devices: [],
        networks: [],
        ioMappings: [],
      };
  const declaredNames = new Set(pous.map((pou) => pou.name.toLocaleUpperCase()));
  const removed = config.pous.filter(
    (existing) => !declaredNames.has(existing.name.toLocaleUpperCase()),
  );
  for (const pou of removed) {
    const task = config.tasks.find((candidate) =>
      candidate.instances.some((instance) =>
        instance.pou.toLocaleUpperCase() === pou.name.toLocaleUpperCase(),
      ),
    );
    if (task) {
      throw new PlcRuntimeConfigError(
        `不能从 POU 索引删除 ${pou.name}，任务 ${task.name} 仍在引用它；请恢复源文件或先解除任务绑定。`,
      );
    }
  }
  const before = JSON.stringify(config.pous);
  config.pous = [...pous];
  return { config, changed: JSON.stringify(config.pous) !== before };
}

function applySelection(
  baseConfig: PlcRuntimeConfig,
  selection: Selection,
  programName: string,
): {
  config: PlcRuntimeConfig;
  action: PlcRuntimeConfigSyncPlan['action'];
  taskName: string;
  deviceId: string;
  periodMs?: number;
} {
  if (selection.action === 'create_config') {
    const task: PlcTaskConfig = {
      name: selection.taskName,
      deviceId: selection.deviceId,
      type: 'cyclic',
      periodMs: selection.periodMs,
      priority: selection.priority,
      cpuCore: selection.cpuCore,
      instances: [createTaskInstance(undefined, programName)],
    };
    return {
      action: 'create_config',
      taskName: task.name,
      deviceId: selection.deviceId,
      periodMs: task.periodMs,
      config: {
        ...baseConfig,
        tasks: [task],
        devices: [{
          id: selection.deviceId,
          role: 'local',
          model: selection.deviceModel,
          points: [],
          connections: [],
        }],
      },
    };
  }

  const config = cloneConfig(baseConfig);

  if (selection.action === 'bind_program') {
    const task = config.tasks.find((item) => item.name === selection.taskName);
    if (!task) throw new PlcRuntimeConfigError(`未找到任务: ${selection.taskName}`);
    task.instances.push(createTaskInstance(task, programName));
    return {
      config,
      action: 'bind_program',
      taskName: task.name,
      deviceId: task.deviceId,
      periodMs: task.periodMs,
    };
  }

  const task: PlcTaskConfig = {
    name: selection.taskName,
    deviceId: selection.deviceId,
    type: 'cyclic',
    periodMs: selection.periodMs,
    priority: selection.priority,
    cpuCore: selection.cpuCore,
    instances: [createTaskInstance(undefined, programName)],
  };
  if (!config.devices.some((device) => device.id === selection.deviceId)) {
    config.devices.push({
      id: selection.deviceId,
      role: 'local',
      model: selection.deviceModel,
      points: [],
      connections: [],
    });
  }
  config.tasks.push(task);
  return {
    config,
    action: 'create_task',
    taskName: task.name,
    deviceId: task.deviceId,
    periodMs: task.periodMs,
  };
}

async function optionsForState(
  state: PlcRuntimeConfigState,
  programName: string,
  syncOptions: PreparePlcRuntimeConfigSyncOptions,
): Promise<{
  options: PlcClarificationOption[];
  createFallback: Extract<Selection, { action: 'create_config' | 'create_task' }>;
}> {
  const config = state.status === 'ready' ? state.config : undefined;
  const device = firstLocalDevice(config);
  const createAction = state.status === 'ready' ? 'create_task' : 'create_config';
  const fallbackSuggestions = defaultTaskSuggestions(config);
  const existingTasks = config?.tasks.map((task) => ({
      name: task.name,
      type: task.type,
      periodMs: task.periodMs,
      programCount: task.instances.length,
    })) ?? [];
  const suggestionProvider = syncOptions.taskSuggestionProvider ??
    (syncOptions.modelConfig
      ? (input: PlcTaskSuggestionInput, signal?: AbortSignal) =>
          suggestPlcTaskOptions(syncOptions.modelConfig!, input, signal)
      : undefined);
  let suggestions: NormalizedPlcTaskSuggestion[] = fallbackSuggestions;
  if (suggestionProvider) {
    try {
      const modelSuggestions = await suggestionProvider({
        userRequest: syncOptions.userRequest,
        programName,
        source: syncOptions.source,
        stContent: syncOptions.content,
        existingTasks,
      }, syncOptions.signal);
      suggestions = normalizeTaskSuggestions(modelSuggestions, config);
      if (!suggestions.length) {
        agentLog('[plc-task] no valid model suggestions; using default candidates');
        suggestions = fallbackSuggestions;
      }
    } catch (error) {
      if (syncOptions.signal?.aborted) throw error;
      agentLog(
        `[plc-task] using default candidates after suggestion failure: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const firstSuggestion = suggestions[0] ?? fallbackSuggestions[0];
  const createFallback = {
    action: createAction,
    deviceId: device.id,
    deviceModel: device.model,
    taskName: firstSuggestion.taskName,
    periodMs: firstSuggestion.periodMs,
    priority: 1,
    cpuCore: 0,
  } satisfies Extract<Selection, { action: 'create_config' | 'create_task' }>;
  const options: PlcClarificationOption[] = [];
  const usingFallbackSuggestions = suggestions === fallbackSuggestions;

  if (config) {
    for (const task of config.tasks) {
        options.push({
          id: `bind:${task.name}`,
          label: `绑定到 ${taskLabel(task)}`,
          description:
            `设备 ${task.deviceId}` +
            `；当前已绑定 ${task.instances.length} 个 PROGRAM`,
          value: selectionValue({
            action: 'bind_program',
            taskName: task.name,
          }),
        });
    }
  }

  for (const suggestion of suggestions) {
    const defaultId = usingFallbackSuggestions
      ? `create:${suggestion.periodMs}ms`
      : `create:${suggestion.taskName}:${suggestion.periodMs}ms`;
    options.push({
      id: defaultId,
      label: `创建 ${suggestion.taskName} · ${suggestion.periodMs} ms`,
      description: suggestion.reason
        ? `${suggestion.reason} 设备 ${device.id}`
        : `设备 ${device.id}`,
      value: selectionValue({
        ...createFallback,
        taskName: suggestion.taskName,
        periodMs: suggestion.periodMs,
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
  const programs = extractPlcProgramDeclarations(options.content);
  if (programs.length > 1) {
    throw new PlcRuntimeConfigError('一个 ST 文件包含多个 PROGRAM，第一版不会自动生成任务组态。');
  }

  const repository = createPlcRuntimeConfigRepository(options.workspaceRoot);
  const state = await repository.refresh();
  if (state.status === 'invalid') {
    throw new PlcRuntimeConfigError(`plc-runtime.json 无法解析，先修复后再生成任务组态: ${state.error.message}`);
  }
  const workspacePous = await collectWorkspacePous(
    options.workspaceRoot,
    source,
    options.content,
  );
  if (workspacePous.length === 0 && state.status !== 'ready') return undefined;
  const synchronized = configWithWorkspacePous(state, workspacePous);
  const indexOnlyPlan = (): PlcRuntimeConfigSyncPlan => ({
    filePath: repository.filePath,
    action: 'sync_pous',
    pous: workspacePous,
    source,
    commit: async () => (await repository.save(synchronized.config)).config,
  });
  if (programs.length === 0) {
    return synchronized.changed ? indexOnlyPlan() : undefined;
  }

  const programName = programs[0].name;
  if (state.status === 'ready') {
    const inspection = inspectPlcProgramBindings(synchronized.config, {
      source,
      text: options.content,
    });
    const resolution = inspection.resolutions[0];
    if (resolution?.status === 'bound') {
      return synchronized.changed ? indexOnlyPlan() : undefined;
    }
    if (resolution?.status === 'ambiguous') {
      throw new PlcRuntimeConfigError(`PROGRAM ${programName} 的任务绑定重复，请先修复 plc-runtime.json。`);
    }
  }
  if (!options.clarification) return indexOnlyPlan();

  const { options: choices, createFallback } = await optionsForState(
    state,
    programName,
    options,
  );
  const response = await options.clarification.request({
    kind: 'plc_task_configuration',
    title: '任务组态确认',
    question: `PROGRAM ${programName} 还没有明确的 PLC 任务绑定。请选择任务周期或绑定已有任务。`,
    details: `源文件: ${source}。这只会更新 plc-runtime.json，不会向 ST 文件追加 CONFIGURATION。`,
    options: choices,
    allowCustom: true,
    customPlaceholder: '新建任务可填写: task=MainControlTask, 20ms',
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

  const applied = applySelection(synchronized.config, selection, programName);
  return {
    filePath: repository.filePath,
    action: applied.action,
    pous: workspacePous,
    programName,
    source,
    taskName: applied.taskName,
    deviceId: applied.deviceId,
    ...(applied.periodMs === undefined ? {} : { periodMs: applied.periodMs }),
    commit: async () => (await repository.save(applied.config)).config,
  };
}
