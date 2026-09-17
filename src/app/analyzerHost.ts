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

const VENDOR_DIR_NAME = 'st-analyzer';
const BRIDGE_FILE_NAME = 'bridge.cjs';

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