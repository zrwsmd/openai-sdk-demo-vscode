/**
 * 把 st-analyze 的构建产物 vendor 进插件(开发机/打包时运行,不进入运行时)。
 *
 * 用法:
 *   ST_ANALYZER_SRC=<.../src/plc/langium-server> node scripts/vendor_st_analyzer.mjs
 *
 * 设计要点:
 *  - 本文件是唯一允许接触开发机路径的地方,而且不写死默认值,只认参数/环境变量;
 *  - 产物必须与 data.json 同目录(校验器用 __dirname 读符号表),所以三个文件平铺;
 *  - 记录来源 commit 与 sha256,便于判断"插件里跑的是哪版规则";
 *  - 若本次结果与上次相同,打印 unchanged,避免制造无意义的差异。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const OUT_DIR = path.resolve('vendor/st-analyzer');
const BRIDGE_SOURCE = path.resolve('scripts/st_analyzer_bridge.cjs');
const META_FILE = path.join(OUT_DIR, 'vendor.json');

const source = (process.env.ST_ANALYZER_SRC ?? process.argv[2] ?? '').trim();

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  return createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

function gitValue(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function readPreviousMeta() {
  try {
    return JSON.parse(await fs.readFile(META_FILE, 'utf8'));
  } catch {
    return undefined;
  }
}

if (!source) {
  const alreadyVendored =
    (await exists(path.join(OUT_DIR, 'main.cjs'))) && (await exists(path.join(OUT_DIR, 'data.json')));
  console.warn(
    '[vendor:st-analyzer] 未提供 ST_ANALYZER_SRC,跳过 vendoring。' +
      '需要更新产物时请设置 ST_ANALYZER_SRC 指向 st-analyze 的 langium-server 目录。',
  );
  if (alreadyVendored) {
    console.warn('[vendor:st-analyzer] 复用现有 vendor/st-analyzer 目录。');
    process.exit(0);
  }
  console.error('[vendor:st-analyzer] vendor 目录为空且未提供 ST_ANALYZER_SRC,无法继续。');
  process.exit(1);
}

const bundleSource = path.join(source, 'out', 'main.cjs');
const dataSource = path.join(source, 'out', 'data.json');
for (const required of [bundleSource, dataSource, BRIDGE_SOURCE]) {
  if (!(await exists(required))) {
    console.error(`[vendor:st-analyzer] 缺少文件: ${required}`);
    if (required !== BRIDGE_SOURCE) {
      console.error('[vendor:st-analyzer] 请先在 st-analyze 的 langium-server 目录执行构建(node esbuild.mjs)。');
    }
    process.exit(1);
  }
}

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.copyFile(bundleSource, path.join(OUT_DIR, 'main.cjs'));
await fs.copyFile(dataSource, path.join(OUT_DIR, 'data.json'));
await fs.copyFile(BRIDGE_SOURCE, path.join(OUT_DIR, 'bridge.cjs'));

const bundleMtime = (await fs.stat(bundleSource)).mtime;
const sha = {
  main: await sha256(path.join(OUT_DIR, 'main.cjs')),
  data: await sha256(path.join(OUT_DIR, 'data.json')),
  bridge: await sha256(path.join(OUT_DIR, 'bridge.cjs')),
};
const previous = await readPreviousMeta();
const meta = {
  schemaVersion: 1,
  sourceCommit: gitValue(source, ['rev-parse', 'HEAD']),
  sourceDirty: Boolean(gitValue(source, ['status', '--porcelain', '--untracked-files=no'])),
  bundleMtime: bundleMtime.toISOString(),
  vendoredAt: new Date().toISOString(),
  sha256: sha,
};
await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf8');

const unchanged = previous?.sha256?.main === sha.main && previous?.sha256?.data === sha.data;
const stats = await Promise.all(
  ['main.cjs', 'data.json', 'bridge.cjs'].map(async (name) => (await fs.stat(path.join(OUT_DIR, name))).size),
);
console.log(
  `[vendor:st-analyzer] ${unchanged ? 'unchanged' : 'updated'} → ${OUT_DIR} ` +
    `(${stats.map((size) => `${Math.round(size / 1024)}KB`).join(' + ')}) ` +
    `commit=${meta.sourceCommit.slice(0, 8) || 'unknown'}${meta.sourceDirty ? ' dirty' : ''}`,
);