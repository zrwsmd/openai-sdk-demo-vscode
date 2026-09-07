/**
 * 工作区文件/命令的纯函数实现(不含任何 SDK/VSCode 依赖,工具层薄封装 + 单测直接调这层)。
 * 安全约束:所有路径必须落在工作区根目录内;目录遍历跳过依赖/构建产物;输出统一截断。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SKIP_DIRS = new Set(['node_modules', '.git', '.vscode', 'dist', 'out', 'build', 'bin', 'obj', '.venv', '__pycache__']);
/** 文本搜索时跳过的二进制/资源扩展名 */
const BINARY_EXT = new Set(['.exe', '.dll', '.so', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.zip', '.gz', '.7z', '.rar', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.mp3', '.mp4', '.wav', '.class', '.jar']);

export class ToolError extends Error {}

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
): Promise<{ text: string; totalLines: number }> {
  const abs = resolveInWorkspace(root, rel);
  const st = await fs.stat(abs).catch(() => {
    throw new ToolError(`文件不存在:${rel}`);
  });
  if (st.size > 2 * 1024 * 1024) throw new ToolError(`文件过大(${st.size}B),请用 startLine/endLine 分段读`);
  const all = (await fs.readFile(abs, 'utf8')).split(/\r?\n/);
  const s = Math.max(1, startLine);
  const e = Math.min(all.length, endLine ?? s + 3999);
  return { text: all.slice(s - 1, e).join('\n'), totalLines: all.length };
}

export async function writeFileText(root: string, rel: string, content: string): Promise<{ file: string; bytes: number }> {
  const abs = resolveInWorkspace(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return { file: abs, bytes: Buffer.byteLength(content) };
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
): Promise<{ exitCode: number | null; output: string }> {
  if (!root) throw new ToolError('未打开工作区文件夹,无法执行命令');
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd: root, shell: true, windowsHide: true });
    let out = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new ToolError(`命令启动失败:${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = out.length > 20_000 ? out.slice(0, 20_000) + '\n…(输出截断)' : out;
      resolve({ exitCode: killed ? null : code, output: killed ? `命令超时(${timeoutMs}ms)被终止:\n${text}` : text });
    });
  });
}
