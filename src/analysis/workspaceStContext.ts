/**
 * 工作区 ST 上下文收集(analysis 层,纯 Node)。
 *
 * 校验器是工作区感知的:目标代码引用 GVL/FB 时,必须把其它 .st 一起解析,
 * 否则会出现大量"未定义引用"假阳性。这里只做配额受控的只读收集。
 */
import path from 'node:path';
import { readFileRange, walkWorkspace } from '../tools/workspaceTools';
import type { WorkspaceScope } from '../workspace/workspaceScope';
import type { StTarget } from './stAnalyzer';

export interface WorkspaceStContextOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  /** 需要排除的相对路径(例如目标文件自身)。 */
  excludePaths?: string[];
}

export interface WorkspaceStContextResult {
  files: StTarget[];
  truncated: boolean;
  skipped: number;
}

function keyOf(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join('/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export async function collectWorkspaceStContext(
  scope: WorkspaceScope,
  options: WorkspaceStContextOptions = {},
): Promise<WorkspaceStContextResult> {
  const maxFiles = options.maxFiles ?? 200;
  const maxFileBytes = options.maxFileBytes ?? 1024 * 1024;
  const result: WorkspaceStContextResult = { files: [], truncated: false, skipped: 0 };
  const root = scope.primaryRoot;
  if (!root) return result;

  const excluded = new Set((options.excludePaths ?? []).map(keyOf));
  const candidates = await walkWorkspace(root);
  for (const absolutePath of candidates) {
    if (!/\.st$/i.test(absolutePath)) continue;
    const relativePath = path.relative(root, absolutePath);
    if (excluded.has(keyOf(relativePath))) continue;
    if (result.files.length >= maxFiles) {
      result.truncated = true;
      break;
    }
    try {
      const read = await readFileRange(root, relativePath);
      if (read.text.length > maxFileBytes) {
        result.skipped += 1;
        continue;
      }
      result.files.push({ path: absolutePath, text: read.text });
    } catch {
      result.skipped += 1; // 单文件读失败不影响整体校验
    }
  }
  return result;
}