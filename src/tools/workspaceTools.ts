/**
 * 工作区文件/命令的纯函数实现(不含任何 SDK/VSCode 依赖,工具层薄封装 + 单测直接调这层)。
 * 安全约束:所有路径必须落在工作区根目录内;目录遍历跳过依赖/构建产物;输出统一截断。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const SKIP_DIRS = new Set(['node_modules', '.git', '.vscode', 'dist', 'out', 'build', 'bin', 'obj', '.venv', '__pycache__']);
/** 文本搜索时跳过的二进制/资源扩展名 */
const BINARY_EXT = new Set(['.exe', '.dll', '.so', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.zip', '.gz', '.7z', '.rar', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.mp3', '.mp4', '.wav', '.class', '.jar']);

/** read_file 单次返回的最大行数;超出部分截断,并以 truncated 标记。 */
export const MAX_READ_LINES = 4000;

export class ToolError extends Error {}

export interface ReadFileRangeResult {
  text: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  returnedLines: number;
  totalBytes: number;
  returnedBytes: number;
  complete: boolean;
  truncated: boolean;
  /** SHA-1 of the complete file, independent of the requested line range. */
  fileContentHash: string;
  /** SHA-1 of the text returned in this particular read operation. */
  returnedContentHash: string;
}

/** 把相对路径解析为工作区内绝对路径;越界直接拒绝 */
export function resolveInWorkspace(root: string, rel: string): string {
  if (!root) throw new ToolError('未打开工作区文件夹(workspace folder),文件类工具不可用');
  const abs = path.resolve(root, rel || '.');
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== path.resolve(root) && !abs.startsWith(rootWithSep)) {
    throw new ToolError(`路径越界:${rel} 不在工作区 ${root} 内`);
  }
  return abs;
}

/** 遍历工作区文件(跳过依赖/构建目录),内部工具函数 */
async function* walkFiles(absDir: string, root: string, maxDepth = 6): AsyncGenerator<string> {
  const relDepth = absDir === root ? 0 : path.relative(root, absDir).split(path.sep).length;
  if (relDepth > maxDepth) return;
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      yield* walkFiles(abs, root, maxDepth);
    } else if (e.isFile()) {
      yield abs;
    }
  }
}
/**
 * 遍历工作区文件并返回绝对路径列表(纯函数,供 analysis 层收集 ST 上下文用)。
 * 复用与 list_files 相同的跳过规则(依赖/构建目录),路径边界同样走 resolveInWorkspace。
 */
export async function walkWorkspace(root: string, sub = '.', maxDepth = 6): Promise<string[]> {
  const absRoot = resolveInWorkspace(root, sub);
  const out: string[] = [];
  for await (const file of walkFiles(absRoot, absRoot, maxDepth)) out.push(file);
  return out;
}



export async function listFiles(root: string, sub = '.', cap = 400): Promise<string[]> {
  const absRoot = resolveInWorkspace(root, sub);
  const out: string[] = [];
  for await (const f of walkFiles(absRoot, absRoot)) {
    const st = await fs.stat(f).catch(() => null);
    const rel = path.relative(absRoot, f).split(path.sep).join('/');
    out.push(`${rel}\t${st?.size ?? 0}B`);
    if (out.length >= cap) {
      out.push(`…(已达 ${cap} 条上限,目录树更大)`);
      break;
    }
  }
  if (!out.length) out.push('(空目录)');
  return out;
}

export async function readFileRange(
  root: string,
  rel: string,
  startLine = 1,
  endLine?: number,
): Promise<ReadFileRangeResult> {
  const abs = resolveInWorkspace(root, rel);
  const st = await fs.stat(abs).catch(() => {
    throw new ToolError(`文件不存在:${rel}`);
  });
  if (st.size > 2 * 1024 * 1024) throw new ToolError(`文件过大(${st.size}B),请用 startLine/endLine 分段读`);
  const raw = await fs.readFile(abs, 'utf8');
  const all = raw.split(/\r?\n/);
  const s = Math.max(1, startLine);
  const e = Math.min(all.length, endLine ?? s + MAX_READ_LINES - 1);
  const complete = s === 1 && e === all.length;
  const text = complete ? raw : all.slice(s - 1, e).join('\n');
  return {
    text,
    totalLines: all.length,
    startLine: s,
    endLine: e,
    returnedLines: Math.max(0, e - s + 1),
    totalBytes: Buffer.byteLength(raw, 'utf8'),
    returnedBytes: Buffer.byteLength(text, 'utf8'),
    complete,
    truncated: !complete,
    fileContentHash: createHash('sha1').update(raw, 'utf8').digest('hex'),
    returnedContentHash: createHash('sha1').update(text, 'utf8').digest('hex'),
  };
}

export async function writeFileText(root: string, rel: string, content: string): Promise<{ file: string; bytes: number }> {
  const abs = resolveInWorkspace(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return { file: abs, bytes: Buffer.byteLength(content) };
}

export interface FileEditOperation {
  oldText: string;
  newText: string;
  replaceAll?: boolean;
}

export interface EditFileTextResult {
  file: string;
  bytes: number;
  oldBytes: number;
  changed: boolean;
  editsApplied: number;
  oldContentHash: string;
  contentHash: string;
  diff: string;
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (offset <= text.length - needle.length) {
    const index = text.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function contentHash(text: string): string {
  return createHash('sha1').update(text, 'utf8').digest('hex');
}

type DiffOperation =
  | { type: 'context'; oldLine: number; newLine: number; text: string }
  | { type: 'remove'; oldLine: number; newLine: number; text: string }
  | { type: 'add'; oldLine: number; newLine: number; text: string };

function diffLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  return lines.length && lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
}

function buildDiffOperations(oldText: string, newText: string): DiffOperation[] {
  const oldLines = diffLines(oldText);
  const newLines = diffLines(newText);
  const cellCount = (oldLines.length + 1) * (newLines.length + 1);
  if (cellCount > 4_000_000) {
    const prefix = oldLines.findIndex((line, index) => line !== newLines[index]);
    const firstChanged = prefix < 0 ? Math.min(oldLines.length, newLines.length) : prefix;
    const oldSuffix = oldLines.length - firstChanged;
    const newSuffix = newLines.length - firstChanged;
    const commonSuffix = (() => {
      let count = 0;
      while (
        count < oldSuffix &&
        count < newSuffix &&
        oldLines[oldLines.length - count - 1] === newLines[newLines.length - count - 1]
      ) count += 1;
      return count;
    })();
    const operations: DiffOperation[] = [];
    for (let index = 0; index < firstChanged; index += 1) {
      operations.push({
        type: 'context',
        oldLine: index + 1,
        newLine: index + 1,
        text: oldLines[index] ?? '',
      });
    }
    for (let index = firstChanged; index < oldLines.length - commonSuffix; index += 1) {
      operations.push({
        type: 'remove',
        oldLine: index + 1,
        newLine: firstChanged + 1,
        text: oldLines[index] ?? '',
      });
    }
    for (let index = firstChanged; index < newLines.length - commonSuffix; index += 1) {
      operations.push({
        type: 'add',
        oldLine: firstChanged + 1,
        newLine: index + 1,
        text: newLines[index] ?? '',
      });
    }
    for (let offset = commonSuffix; offset > 0; offset -= 1) {
      const oldLine = oldLines.length - offset + 1;
      const newLine = newLines.length - offset + 1;
      operations.push({
        type: 'context',
        oldLine,
        newLine,
        text: oldLines[oldLine - 1] ?? '',
      });
    }
    return operations;
  }

  const table = Array.from(
    { length: oldLines.length + 1 },
    () => new Uint32Array(newLines.length + 1),
  );
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      table[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? table[oldIndex + 1][newIndex + 1] + 1
        : Math.max(table[oldIndex + 1][newIndex], table[oldIndex][newIndex + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
      operations.push({
        type: 'context',
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
        text: oldLines[oldIndex],
      });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }
    if (
      newIndex >= newLines.length ||
      (oldIndex < oldLines.length && table[oldIndex + 1][newIndex] >= table[oldIndex][newIndex + 1])
    ) {
      operations.push({
        type: 'remove',
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
        text: oldLines[oldIndex],
      });
      oldIndex += 1;
      continue;
    }
    operations.push({
      type: 'add',
      oldLine: oldIndex + 1,
      newLine: newIndex + 1,
      text: newLines[newIndex],
    });
    newIndex += 1;
  }
  return operations;
}

function renderUnifiedDiff(
  oldText: string,
  newText: string,
  relativePath: string,
): string {
  if (oldText === newText) return '';
  const operations = buildDiffOperations(oldText, newText);
  const changed = operations
    .map((operation, index) => ({ operation, index }))
    .filter(({ operation }) => operation.type !== 'context');
  if (!changed.length) return '';

  const ranges: Array<[number, number]> = [];
  for (const { index } of changed) {
    const start = Math.max(0, index - 3);
    const end = Math.min(operations.length, index + 4);
    const previous = ranges[ranges.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else ranges.push([start, end]);
  }

  const hunks = ranges.map(([start, end]) => {
    const hunk = operations.slice(start, end);
    const oldStart = hunk.find((operation) => operation.type !== 'add')?.oldLine ?? 1;
    const newStart = hunk.find((operation) => operation.type !== 'remove')?.newLine ?? 1;
    const oldCount = hunk.filter((operation) => operation.type !== 'add').length;
    const newCount = hunk.filter((operation) => operation.type !== 'remove').length;
    const lines = hunk.map((operation) => {
      const prefix = operation.type === 'add' ? '+' : operation.type === 'remove' ? '-' : ' ';
      return `${prefix}${operation.text}`;
    });
    return [
      `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
      ...lines,
    ].join('\n');
  });
  return [
    `--- a/${relativePath}`,
    `+++ b/${relativePath}`,
    ...hunks,
  ].join('\n');
}

export async function editFileText(
  root: string,
  rel: string,
  edits: readonly FileEditOperation[],
): Promise<EditFileTextResult> {
  const abs = resolveInWorkspace(root, rel);
  if (!edits.length) throw new ToolError('至少需要提供一个文件编辑操作');
  const stat = await fs.stat(abs).catch(() => {
    throw new ToolError(`文件不存在:${rel}`);
  });
  if (!stat.isFile()) throw new ToolError(`目标不是普通文件:${rel}`);
  if (stat.size > 2 * 1024 * 1024) {
    throw new ToolError(`文件过大(${stat.size}B),请先分段读取后再决定如何修改`);
  }

  const original = await fs.readFile(abs, 'utf8');
  let content = original;
  let editsApplied = 0;
  for (const edit of edits) {
    if (!edit.oldText) throw new ToolError(`编辑操作 ${editsApplied + 1} 的 oldText 不能为空`);
    const occurrences = countOccurrences(content, edit.oldText);
    if (!occurrences) {
      throw new ToolError(`编辑操作 ${editsApplied + 1} 未找到要替换的原文`);
    }
    if (!edit.replaceAll && occurrences !== 1) {
      throw new ToolError(
        `编辑操作 ${editsApplied + 1} 匹配到 ${occurrences} 处，请提供更精确的 oldText 或设置 replaceAll=true`,
      );
    }
    content = edit.replaceAll
      ? content.split(edit.oldText).join(edit.newText)
      : content.replace(edit.oldText, edit.newText);
    editsApplied += edit.replaceAll ? occurrences : 1;
  }

  const changed = content !== original;
  if (changed) await fs.writeFile(abs, content, 'utf8');
  const relativePath = path.relative(root, abs).split(path.sep).join('/');
  const diff = renderUnifiedDiff(original, content, relativePath);
  return {
    file: abs,
    bytes: Buffer.byteLength(content, 'utf8'),
    oldBytes: Buffer.byteLength(original, 'utf8'),
    changed,
    editsApplied,
    oldContentHash: contentHash(original),
    contentHash: contentHash(content),
    diff: diff.length > 24_000 ? `${diff.slice(0, 24_000)}\n…(diff 已截断)` : diff,
  };
}

/** glob 只支持 * 与 ?(按文件名匹配),够用且无依赖 */
function globToRegExp(glob: string): RegExp {
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${body}$`, 'i');
}

export async function searchText(
  root: string,
  needle: string,
  opts: { glob?: string; isRegex?: boolean; maxResults?: number } = {},
): Promise<string[]> {
  if (!needle) throw new ToolError('搜索内容不能为空');
  const max = opts.maxResults ?? 50;
  const re = opts.isRegex
    ? new RegExp(needle, 'i')
    : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const nameRe = opts.glob ? globToRegExp(opts.glob) : null;
  const results: string[] = [];
  let scanned = 0;
  for await (const f of walkFiles(root, root)) {
    if (results.length >= max) {
      results.push(`…(已达 ${max} 条上限)`);
      break;
    }
    if (scanned++ > 3000) {
      results.push('…(已扫描 3000 个文件,提前停止;请用 glob 缩小范围)');
      break;
    }
    if (BINARY_EXT.has(path.extname(f).toLowerCase())) continue;
    if (nameRe && !nameRe.test(path.basename(f))) continue;
    let text: string;
    try {
      const st = await fs.stat(f);
      if (st.size > 1024 * 1024) continue;
      text = await fs.readFile(f, 'utf8');
    } catch {
      continue;
    }
    if (!re.test(text)) continue;
    const rel = path.relative(root, f).split(path.sep).join('/');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length && results.length < max; i++) {
      if (re.test(lines[i])) results.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
    }
  }
  if (!results.length) results.push('(未找到匹配)');
  return results;
}

/** 在工作区执行命令(60s 超时,输出截断 20KB);审批由工具层 needsApproval 保证 */
export async function runCommand(
  root: string,
  command: string,
  timeoutMs = 60_000,
  signal?: AbortSignal,
): Promise<{ exitCode: number | null; output: string }> {
  if (!root) throw new ToolError('未打开工作区文件夹,无法执行命令');
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const child = spawn(command, {
      cwd: root,
      shell: true,
      windowsHide: true,
      detached: !isWindows,
    });
    let out = '';
    let killed = false;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const terminateTree = () => {
      if (!child.pid) return;
      if (isWindows) {
        const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        killer.once('error', () => child.kill('SIGKILL'));
        return;
      }
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    };
    const onAbort = () => {
      if (settled) return;
      killed = true;
      terminateTree();
      settled = true;
      cleanup();
      reject(signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      if (settled) return;
      killed = true;
      terminateTree();
      settled = true;
      cleanup();
      const text = out.length > 20_000 ? out.slice(0, 20_000) + '\n…(输出截断)' : out;
      resolve({ exitCode: null, output: `命令超时(${timeoutMs}ms)被终止:\n${text}` });
    }, timeoutMs);
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new ToolError(`命令启动失败:${e.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      const text = out.length > 20_000 ? out.slice(0, 20_000) + '\n…(输出截断)' : out;
      resolve({ exitCode: killed ? null : code, output: text });
    });
    // Close the race between the initial throwIfAborted() and listener setup.
    if (signal?.aborted) onAbort();
  });
}
