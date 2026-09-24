/**
 * ST 校验器的宿主装配层(src/app)。
 *
 * 本文件是这套能力里唯一 import vscode 的地方,正如 chatView 是唯一处理
 * WebView/SecretStorage 的地方:插件装在哪、用哪个 node、读完配置怎么组候选,
 * 全部关在这里;analysis 层只看到纯数据的 StAnalyzerSettings。
 */
import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import {
  FallbackStAnalyzer,
  ResilientStAnalyzer,
} from '../analysis/fallbackStAnalyzer';
import { NodeProcessRunner } from '../analysis/processRunner';
import { SpawnStAnalyzer } from '../analysis/spawnStAnalyzer';
import { ST_ANALYZER_STATUS_CODES } from '../analysis/stDiagnosticCodes';
import type {
  StAnalyzer,
  StAnalyzerLaunch,
  StAnalyzerSettings,
} from '../analysis/stAnalyzer';
import { toolOptionsFromSettings } from '../analysis/stAnalyzer';
import {
  createRuntimeServiceContainer,
  type RuntimeServiceContainer,
} from '../runtime/services';
import {
  ST_ANALYZER_OPTIONS_SERVICE,
  ST_ANALYZER_SERVICE,
} from '../runtime/workflows/stToolContext';
import type { DurableRunConfig } from '../runtime/runStore';

const VENDOR_DIR_NAME = 'st-analyzer';
const BRIDGE_FILE_NAME = 'bridge.cjs';
const ST_ANALYZER_EXTENSION_KEY = 'stAnalyzer';

function configSection(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('plcAgent');
}

export function stAnalyzerVendorDir(context: vscode.ExtensionContext): string {
  const override = configSection().get<string>('stAnalyzer.dir')?.trim();
  if (override) return override;
  return vscode.Uri.joinPath(context.extensionUri, 'vendor', VENDOR_DIR_NAME).fsPath;
}

function numberSetting(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * 组装 Node 运行时候选链。
 *
 * 注:给 process.execPath 候选始终带上 ELECTRON_RUN_AS_NODE=1。
 * 扩展宿主里 execPath 通常指向 Code.exe(需要这个变量才会当纯 Node 用),
 * 而真正的 node.exe 会忽略它,所以一个变量同时覆盖两种情况。
 */
function nodeLaunches(bridgePath: string, cwd: string): StAnalyzerLaunch[] {
  const candidates: StAnalyzerLaunch[] = [];
  const push = (exe: string | undefined, env?: Record<string, string>): void => {
    const value = exe?.trim();
    if (!value) return;
    if (candidates.some((item) => item.exe.toLowerCase() === value.toLowerCase())) return;
    candidates.push({ exe: value, args: [bridgePath], cwd, ...(env ? { env } : {}) });
  };

  push(configSection().get<string>('stAnalyzer.nodePath'), undefined);
  push(process.env.ST_ANALYZER_NODE, undefined);
  push(process.platform === 'win32' ? 'node.exe' : 'node', undefined);
  push(process.execPath, { ELECTRON_RUN_AS_NODE: '1' });
  return candidates;
}

/**
 * 读取当前配置并产出可持久化的纯数据设置。
 * launches 为空表示宿主找不到可用实现,内核会走降级并如实上报原因。
 */
export function readStAnalyzerSettings(context: vscode.ExtensionContext): StAnalyzerSettings {
  const enabled = configSection().get<boolean>('stAnalyzer.enabled', true);
  const vendorDir = stAnalyzerVendorDir(context);
  const bridgePath = path.join(vendorDir, BRIDGE_FILE_NAME);
  const bridgeExists = enabled && fs.existsSync(bridgePath);
  return {
    launches: bridgeExists ? nodeLaunches(bridgePath, vendorDir) : [],
    timeoutMs: numberSetting(configSection().get<number>('stAnalyzer.timeoutMs'), 20_000),
    maxDiagnostics: numberSetting(configSection().get<number>('stAnalyzer.maxDiagnostics'), 200),
    loadWorkspaceContext: configSection().get<boolean>('stAnalyzer.loadWorkspaceContext', true),
    maxContextFiles: numberSetting(configSection().get<number>('stAnalyzer.maxContextFiles'), 200),
    maxFileBytes: numberSetting(configSection().get<number>('stAnalyzer.maxFileBytes'), 1024 * 1024),
  };
}

/**
 * 产出"设置 → 已装配端口"的工厂,交给 RunCoordinator 注入内核。
 * 内核与协调器永远看不到 extensionUri / vendor / node 这些平台概念。
 */
export function createStAnalyzerFactory(
  context: vscode.ExtensionContext,
  log: (line: string) => void,
): (settings?: StAnalyzerSettings) => StAnalyzer {
  return (settings?: StAnalyzerSettings): StAnalyzer => {
    if (!configSection().get<boolean>('stAnalyzer.enabled', true)) {
      return new FallbackStAnalyzer(ST_ANALYZER_STATUS_CODES.disabled);
    }
    // 设置随 run 持久化;若缺少启动候选(例如当时未打包 vendor),按当前配置重算。
    const effective = settings?.launches?.length ? settings : readStAnalyzerSettings(context);
    const launches = effective.launches ?? [];
    if (!launches.length) {
      log('[st-analyzer] 未找到 bridge.cjs,ST 校验降级为内置简易校验');
      return new FallbackStAnalyzer(ST_ANALYZER_STATUS_CODES.launchMissing);
    }
    log(`[st-analyzer] 启动候选: ${launches.map((item) => item.exe).join(' | ')}`);
    const primary = new SpawnStAnalyzer({
      launches,
      runner: new NodeProcessRunner(),
      timeoutMs: effective.timeoutMs,
      maxDiagnostics: effective.maxDiagnostics,
    });
    return new ResilientStAnalyzer(primary, new FallbackStAnalyzer());
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStAnalyzerSettings(value: unknown): value is StAnalyzerSettings {
  if (!isRecord(value)) return false;
  if (value.launches !== undefined) {
    if (!Array.isArray(value.launches)) return false;
    for (const launch of value.launches) {
      if (
        !isRecord(launch) ||
        typeof launch.exe !== 'string' ||
        !launch.exe ||
        !Array.isArray(launch.args) ||
        launch.args.some((arg) => typeof arg !== 'string') ||
        typeof launch.cwd !== 'string' ||
        (launch.env !== undefined &&
          (!isRecord(launch.env) ||
            Object.values(launch.env).some((item) => typeof item !== 'string')))
      ) {
        return false;
      }
    }
  }
  for (const key of ['timeoutMs', 'maxDiagnostics', 'maxContextFiles', 'maxFileBytes'] as const) {
    if (value[key] !== undefined &&
      (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      return false;
    }
  }
  return value.loadWorkspaceContext === undefined ||
    typeof value.loadWorkspaceContext === 'boolean';
}

function stAnalyzerSettingsFromConfig(
  config: DurableRunConfig,
): StAnalyzerSettings | undefined {
  const extensions = config.extensions?.[ST_ANALYZER_EXTENSION_KEY];
  if (isStAnalyzerSettings(extensions)) return extensions;

  // Read-only compatibility for runs written before generic extensions were
  // introduced. The legacy field is interpreted only at this host boundary.
  const legacy = (config as DurableRunConfig & {
    stAnalyzerSettings?: unknown;
  }).stAnalyzerSettings;
  return isStAnalyzerSettings(legacy) ? legacy : undefined;
}

export function createStAnalyzerConfigExtension(
  context: vscode.ExtensionContext,
): Record<string, unknown> {
  return {
    [ST_ANALYZER_EXTENSION_KEY]: readStAnalyzerSettings(context),
  };
}

export function createStRuntimeServicesFactory(
  context: vscode.ExtensionContext,
  log: (line: string) => void,
): (config: DurableRunConfig) => RuntimeServiceContainer {
  const createAnalyzer = createStAnalyzerFactory(context, log);
  return (config) => {
    const settings = stAnalyzerSettingsFromConfig(config);
    return createRuntimeServiceContainer([
      [ST_ANALYZER_SERVICE, createAnalyzer(settings)],
      [ST_ANALYZER_OPTIONS_SERVICE, toolOptionsFromSettings(settings)],
    ]);
  };
}
