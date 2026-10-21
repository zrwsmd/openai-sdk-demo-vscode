import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  PLC_RUNTIME_CONFIG_SCHEMA_VERSION,
  PlcRuntimeConfigError,
  validatePlcRuntimeConfig,
  type PlcPouConfig,
  type PlcRuntimeConfig,
  type PlcTaskInstance,
} from './plcRuntimeConfig';
import {
  createPlcRuntimeConfigRepository,
  type PlcRuntimeConfigState,
} from './plcRuntimeConfigRepository';
import {
  classifyPlcIecSource,
  extractPlcProgramDeclarations,
  inspectPlcProgramBindings,
  type PlcProgramBindingResolution,
  type PlcProgramDeclaration,
} from './plcProgramBinding';

export interface PlcRuntimeAuditSourceFile {
  source: string;
  content: string;
}

export type PlcRuntimeAuditIssueSeverity = 'info' | 'warning' | 'error';

export type PlcRuntimeAuditIssueCode =
  | 'config_missing'
  | 'config_invalid'
  | 'program_unbound'
  | 'program_ambiguous'
  | 'program_source_mismatch'
  | 'binding_source_missing'
  | 'binding_source_no_program'
  | 'binding_type_missing'
  | 'iec_source_missing'
  | 'iec_source_kind_mismatch'
  | 'iec_source_unindexed'
  | 'event_task_runtime_only';

export interface PlcRuntimeAuditIssue {
  code: PlcRuntimeAuditIssueCode;
  severity: PlcRuntimeAuditIssueSeverity;
  message: string;
  source?: string;
  programName?: string;
  deviceId?: string;
  taskName?: string;
  instanceName?: string;
  details?: string;
}

export interface PlcRuntimeAuditStFile {
  source: string;
  declarations: PlcProgramDeclaration[];
  resolutions: PlcProgramBindingResolution[];
}

export interface PlcRuntimeAuditSummary {
  stFileCount: number;
  programCount: number;
  configuredProgramCount: number;
  unboundProgramCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
}

export interface PlcRuntimeAuditReport {
  workspaceRoot: string;
  configPath: string;
  configState: PlcRuntimeConfigState['status'];
  config?: PlcRuntimeConfig;
  stFiles: PlcRuntimeAuditStFile[];
  issues: PlcRuntimeAuditIssue[];
  summary: PlcRuntimeAuditSummary;
}

export interface AuditPlcRuntimeConfigOptions {
  workspaceRoot: string;
  files?: readonly PlcRuntimeAuditSourceFile[];
  maxFiles?: number;
  excludeDirectories?: readonly string[];
}

export interface InitialPlcRuntimeProgram {
  source: string;
  programName: string;
  instanceName?: string;
}

export interface CreateInitialPlcRuntimeConfigDraftOptions {
  programs: readonly InitialPlcRuntimeProgram[];
  periodMs: number;
  deviceId?: string;
  deviceModel?: string;
  taskName?: string;
  priority?: number;
  cpuCore?: number;
}

const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.vscode',
  '.vscode-test',
  'dist',
  'node_modules',
  'out',
  'coverage',
]);

const DEFAULT_MAX_FILES = 1000;

function normalizeWorkspaceRoot(workspaceRoot: string): string {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) {
    throw new PlcRuntimeConfigError('workspaceRoot: 必须是非空字符串');
  }
  return path.resolve(workspaceRoot);
}

function normalizeSource(source: string): string {
  return source.trim().replaceAll('\\', '/').replace(/^\.\/+/u, '');
}

function sourceKey(source: string): string {
  return normalizeSource(source).toLocaleLowerCase();
}

function normalizeSourceFile(file: PlcRuntimeAuditSourceFile, index: number): PlcRuntimeAuditSourceFile {
  const source = normalizeSource(file.source);
  if (!source) throw new PlcRuntimeConfigError(`files[${index}].source: 必须是非空路径`);
  return { source, content: file.content };
}

async function discoverStFiles(
  workspaceRoot: string,
  options: { maxFiles: number; excludeDirectories: Set<string> },
): Promise<PlcRuntimeAuditSourceFile[]> {
  const files: PlcRuntimeAuditSourceFile[] = [];

  async function visit(directory: string): Promise<void> {
    if (files.length > options.maxFiles) {
      throw new PlcRuntimeConfigError(`工作区 .st 文件超过 ${options.maxFiles} 个，请缩小扫描范围`);
    }
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!options.excludeDirectories.has(entry.name)) await visit(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLocaleLowerCase() !== '.st') continue;
      const source = path.relative(workspaceRoot, fullPath).replaceAll('\\', '/');
      files.push({
        source,
        content: await fs.readFile(fullPath, 'utf8'),
      });
    }
  }

  await visit(workspaceRoot);
  if (files.length > options.maxFiles) {
    throw new PlcRuntimeConfigError(`工作区 .st 文件超过 ${options.maxFiles} 个，请缩小扫描范围`);
  }
  return files.sort((left, right) => left.source.localeCompare(right.source));
}

function inspectFiles(
  files: readonly PlcRuntimeAuditSourceFile[],
  config: PlcRuntimeConfig | undefined,
): PlcRuntimeAuditStFile[] {
  return files.map((file) => {
    if (!config) {
      return {
        source: file.source,
        declarations: extractPlcProgramDeclarations(file.content),
        resolutions: [],
      };
    }
    const inspection = inspectPlcProgramBindings(config, {
      source: file.source,
      text: file.content,
    });
    return {
      source: inspection.source,
      declarations: inspection.declarations,
      resolutions: inspection.resolutions,
    };
  });
}

function issueFromResolution(
  source: string,
  resolution: PlcProgramBindingResolution,
): PlcRuntimeAuditIssue | undefined {
  const programName = resolution.declaration.name;
  if (resolution.status === 'bound') return undefined;
  if (resolution.status === 'ambiguous') {
    return {
      code: 'program_ambiguous',
      severity: 'error',
      source,
      programName,
      message: `PROGRAM ${programName} 在 plc-runtime.json 中存在多个匹配绑定。`,
    };
  }
  if (resolution.status === 'source_mismatch') {
    return {
      code: 'program_source_mismatch',
      severity: 'warning',
      source,
      programName,
      message: `PROGRAM ${programName} 已在其他源文件绑定，当前文件没有唯一任务绑定。`,
      details: resolution.typeMatches
        .map((match) => `${match.deviceId}/${match.taskName}: ${match.pou.source}`)
        .join('; '),
    };
  }
  return {
    code: 'program_unbound',
    severity: 'warning',
    source,
    programName,
    message: `PROGRAM ${programName} 尚未绑定到 plc-runtime.json 的任务。`,
  };
}

function allBindings(config: PlcRuntimeConfig): Array<{
  deviceId: string;
  taskName: string;
  instance: PlcTaskInstance;
  pou: PlcPouConfig;
}> {
  const result: Array<{ deviceId: string; taskName: string; instance: PlcTaskInstance; pou: PlcPouConfig }> = [];
  const pous = new Map(config.pous.map((pou) => [pou.name.toLocaleUpperCase(), pou]));
  for (const task of config.tasks) {
    for (const instance of task.instances) {
      const pou = pous.get(instance.pou.toLocaleUpperCase());
      if (pou) result.push({ deviceId: task.deviceId, taskName: task.name, instance, pou });
    }
  }
  return result;
}

function bindingIssues(
  config: PlcRuntimeConfig,
  files: readonly PlcRuntimeAuditStFile[],
): PlcRuntimeAuditIssue[] {
  const fileBySource = new Map(files.map((file) => [sourceKey(file.source), file]));
  const issues: PlcRuntimeAuditIssue[] = [];
  for (const { deviceId, taskName, instance, pou } of allBindings(config)) {
    const source = normalizeSource(pou.source);
    const file = fileBySource.get(sourceKey(source));
    const base = {
      source,
      deviceId,
      taskName,
      instanceName: instance.name,
      programName: pou.name,
    };
    if (!file) {
      issues.push({
        ...base,
        code: 'binding_source_missing',
        severity: 'error',
        message: `任务 ${taskName} 绑定的源文件不存在或未被扫描: ${source}。`,
      });
      continue;
    }
    if (file.declarations.length === 0) {
      issues.push({
        ...base,
        code: 'binding_source_no_program',
        severity: 'error',
        message: `任务 ${taskName} 绑定的源文件没有 PROGRAM 声明: ${source}。`,
      });
      continue;
    }
    if (!file.declarations.some(
      (declaration) => declaration.name.toLocaleUpperCase() === pou.name.toLocaleUpperCase(),
    )) {
      issues.push({
        ...base,
        code: 'binding_type_missing',
        severity: 'error',
        message: `任务 ${taskName} 绑定的源文件没有 PROGRAM ${pou.name}。`,
        details: `当前声明: ${file.declarations.map((item) => item.name).join(', ')}`,
      });
    }
  }
  return issues;
}

function iecSourceIssues(
  config: PlcRuntimeConfig,
  files: readonly PlcRuntimeAuditSourceFile[],
): PlcRuntimeAuditIssue[] {
  const filesBySource = new Map(files.map((file) => [sourceKey(file.source), file]));
  const configured = new Set(config.iecSources.map((item) => sourceKey(item.source)));
  const issues: PlcRuntimeAuditIssue[] = [];
  for (const source of config.iecSources) {
    const file = filesBySource.get(sourceKey(source.source));
    if (!file) {
      issues.push({
        code: 'iec_source_missing',
        severity: 'error',
        source: source.source,
        message: `IEC 编译源不存在或未被扫描: ${source.source}。`,
      });
      continue;
    }
    const actualKind = classifyPlcIecSource(file.content);
    if (actualKind !== source.kind) {
      issues.push({
        code: 'iec_source_kind_mismatch',
        severity: 'error',
        source: source.source,
        message: `IEC 编译源 ${source.source} 声明为 ${source.kind}，实际识别为 ${actualKind ?? 'unknown'}。`,
      });
    }
  }
  for (const file of files) {
    const kind = classifyPlcIecSource(file.content);
    if (!kind || configured.has(sourceKey(file.source))) continue;
    issues.push({
      code: 'iec_source_unindexed',
      severity: 'error',
      source: file.source,
      message: `IEC 源文件 ${file.source} (${kind}) 尚未登记到 iecSources。`,
    });
  }
  return issues;
}

function eventTaskIssues(config: PlcRuntimeConfig): PlcRuntimeAuditIssue[] {
  const issues: PlcRuntimeAuditIssue[] = [];
  for (const task of config.tasks) {
      if (task.type !== 'event') continue;
      issues.push({
        code: 'event_task_runtime_only',
        severity: 'warning',
        deviceId: task.deviceId,
        taskName: task.name,
        message: `事件任务 ${task.name} 需要运行时触发适配，第一版不会生成 matiec cyclic TASK。`,
      });
  }
  return issues;
}

function buildSummary(
  stFiles: readonly PlcRuntimeAuditStFile[],
  issues: readonly PlcRuntimeAuditIssue[],
): PlcRuntimeAuditSummary {
  const programCount = stFiles.reduce((sum, file) => sum + file.declarations.length, 0);
  const configuredProgramCount = stFiles.reduce(
    (sum, file) => sum + file.resolutions.filter((resolution) => resolution.status === 'bound').length,
    0,
  );
  const unboundProgramCount = stFiles.reduce(
    (sum, file) => sum + file.resolutions.filter((resolution) => resolution.status !== 'bound').length,
    0,
  );
  return {
    stFileCount: stFiles.length,
    programCount,
    configuredProgramCount,
    unboundProgramCount,
    issueCount: issues.length,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
  };
}

function issuesForConfigState(
  state: PlcRuntimeConfigState,
  stFiles: readonly PlcRuntimeAuditStFile[],
): PlcRuntimeAuditIssue[] {
  if (state.status === 'missing') {
    const programCount = stFiles.reduce((sum, file) => sum + file.declarations.length, 0);
    if (programCount === 0) return [];
    return [{
      code: 'config_missing',
      severity: 'warning',
      message: `发现 ${programCount} 个 PROGRAM，但工作区还没有 plc-runtime.json。`,
    }];
  }
  if (state.status === 'invalid') {
    return [{
      code: 'config_invalid',
      severity: 'error',
      message: `plc-runtime.json 无法解析或校验失败: ${state.error.message}`,
    }];
  }
  return [];
}

export async function auditPlcRuntimeConfigWorkspace(
  options: AuditPlcRuntimeConfigOptions,
): Promise<PlcRuntimeAuditReport> {
  const workspaceRoot = normalizeWorkspaceRoot(options.workspaceRoot);
  const repository = createPlcRuntimeConfigRepository(workspaceRoot);
  const state = await repository.refresh();
  const files = options.files
    ? options.files.map(normalizeSourceFile)
    : await discoverStFiles(workspaceRoot, {
        maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
        excludeDirectories: new Set([
          ...DEFAULT_EXCLUDED_DIRECTORIES,
          ...(options.excludeDirectories ?? []),
        ]),
      });
  const config = state.status === 'ready' ? state.config : undefined;
  const stFiles = inspectFiles(files, config);
  const issues = [
    ...issuesForConfigState(state, stFiles),
    ...(config
      ? [
          ...stFiles.flatMap((file) =>
            file.resolutions
              .map((resolution) => issueFromResolution(file.source, resolution))
              .filter((issue): issue is PlcRuntimeAuditIssue => issue !== undefined),
          ),
          ...bindingIssues(config, stFiles),
          ...iecSourceIssues(config, files),
          ...eventTaskIssues(config),
        ]
      : []),
  ];
  return {
    workspaceRoot,
    configPath: repository.filePath,
    configState: state.status,
    ...(config ? { config } : {}),
    stFiles,
    issues,
    summary: buildSummary(stFiles, issues),
  };
}

function uniqueInstanceName(programName: string, usedNames: Set<string>): string {
  const base = `instance_${programName}`;
  if (!usedNames.has(base.toLocaleUpperCase())) {
    usedNames.add(base.toLocaleUpperCase());
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!usedNames.has(candidate.toLocaleUpperCase())) {
      usedNames.add(candidate.toLocaleUpperCase());
      return candidate;
    }
  }
  throw new PlcRuntimeConfigError(`无法生成唯一程序实例名: ${programName}`);
}

export function createInitialPlcRuntimeConfigDraft(
  options: CreateInitialPlcRuntimeConfigDraftOptions,
): PlcRuntimeConfig {
  if (!Array.isArray(options.programs) || options.programs.length === 0) {
    throw new PlcRuntimeConfigError('programs: 必须至少包含一个 PROGRAM');
  }
  if (!Number.isFinite(options.periodMs) || options.periodMs <= 0) {
    throw new PlcRuntimeConfigError('periodMs: 必须是大于 0 的有限数字');
  }
  const usedNames = new Set<string>();
  const pous = options.programs.map((program) => ({
    name: program.programName,
    pouType: 'program' as const,
    source: normalizeSource(program.source),
  }));
  const config = {
    schemaVersion: PLC_RUNTIME_CONFIG_SCHEMA_VERSION,
    tasks: [{
          name: options.taskName ?? 'MainTask',
          deviceId: options.deviceId ?? 'plc',
          type: 'cyclic',
          periodMs: options.periodMs,
          priority: options.priority ?? 1,
          cpuCore: options.cpuCore ?? 0,
          instances: options.programs.map((program) => ({
            name: program.instanceName ?? uniqueInstanceName(program.programName, usedNames),
            pou: program.programName,
          })),
    }],
    pous,
    iecSources: [...new Map(pous.map((pou) => [
      sourceKey(pou.source),
      { source: pou.source, kind: 'pou' as const },
    ])).values()],
    libraries: [],
    devices: [{
      id: options.deviceId ?? 'plc',
      role: 'local',
      model: options.deviceModel ?? 'PLC',
      points: [],
      connections: [],
    }],
    networks: [],
    ioMappings: [],
  };
  return validatePlcRuntimeConfig(config);
}
