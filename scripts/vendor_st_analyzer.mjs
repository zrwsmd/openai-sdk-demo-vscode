/**
 * 把 ST 校验器产物与桥同步进插件(开发机/打包时运行,不进入运行时)。
 *
 * 用法:
 *   node scripts/vendor_st_analyzer.mjs
 *     只同步桥(日常改桥用,不需要任何外部工程)
 *   ST_ANALYZER_SRC=<.../src/plc/server> node scripts/vendor_st_analyzer.mjs
 *     同时更新引擎产物(main.cjs / data.json),只在引擎升级时才需要
 *
 * 设计要点:
 *  - 桥(bridge.cjs)是本仓库自己的代码,源在 scripts/st_analyzer_bridge.cjs,
 *    永远无条件同步 —— 改桥不应该依赖任何外部工程;
 *  - 引擎产物(main.cjs / data.json)来自外部构建,只在提供 ST_ANALYZER_SRC 时更新;
 *  - 只同步桥时沿用上一次记录的引擎来源(sourceCommit / sourceDirty / bundleMtime),
 *    不能清空,否则以后判断不出 vendor 里的引擎是哪一版;
 *  - 本文件是唯一允许接触开发机路径的地方,而且不写死默认值,只认参数/环境变量;
 *  - 产物必须与 data.json 同目录(校验器用 __dirname 读符号表),所以三个文件平铺;
 *  - 若本次结果与上次相同,打印 unchanged,避免制造无意义的差异。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const OUT_DIR = path.resolve('vendor/st-analyzer');
const BRIDGE_SOURCE = path.resolve('scripts/st_analyzer_bridge.cjs');
const META_FILE = path.join(OUT_DIR, 'vendor.json');
const BUNDLE_NAME = 'main.cjs';
const DATA_NAME = 'data.json';
const BRIDGE_NAME = 'bridge.cjs';

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

const previous = await readPreviousMeta();

// ---- 桥:无条件同步(本仓库自有代码,与外部工程无关) ----
if (!(await exists(BRIDGE_SOURCE))) {
  console.error(`[vendor:st-analyzer] 缺少桥源码: ${BRIDGE_SOURCE}`);
  process.exit(1);
}
await fs.mkdir(OUT_DIR, { recursive: true });
const bridgeTarget = path.join(OUT_DIR, BRIDGE_NAME);
await fs.copyFile(BRIDGE_SOURCE, bridgeTarget);
const bridgeSha = await sha256(bridgeTarget);
if (bridgeSha !== (await sha256(BRIDGE_SOURCE))) {
  console.error('[vendor:st-analyzer] 桥拷贝校验失败(源与目标 sha256 不一致),已中止。');
  process.exit(1);
}

// ---- 引擎产物:提供 ST_ANALYZER_SRC 时才更新,否则沿用现有目录与来源信息 ----
let engineMode = 'reused';
let engine = {
  sourceCommit: typeof previous?.sourceCommit === 'string' ? previous.sourceCommit : '',
  sourceDirty: previous?.sourceDirty === true,
  bundleMtime: typeof previous?.bundleMtime === 'string' ? previous.bundleMtime : '',
};
if (source) {
  const bundleSource = path.join(source, 'out', BUNDLE_NAME);
  const dataSource = path.join(source, 'out', DATA_NAME);
  for (const required of [bundleSource, dataSource]) {
    if (!(await exists(required))) {
      console.error(`[vendor:st-analyzer] 缺少文件: ${required}`);
      console.error('[vendor:st-analyzer] 请先在 st-analyze 的 server 目录执行构建(node esbuild.mjs)。');
      process.exit(1);
    }
  }
  await fs.copyFile(bundleSource, path.join(OUT_DIR, BUNDLE_NAME));
  await fs.copyFile(dataSource, path.join(OUT_DIR, DATA_NAME));
  engine = {
    sourceCommit: gitValue(source, ['rev-parse', 'HEAD']),
    sourceDirty: Boolean(gitValue(source, ['status', '--porcelain', '--untracked-files=no'])),
    bundleMtime: (await fs.stat(bundleSource)).mtime.toISOString(),
  };
  engineMode = 'synced';
} else if (
  !(await exists(path.join(OUT_DIR, BUNDLE_NAME))) ||
  !(await exists(path.join(OUT_DIR, DATA_NAME)))
) {
  console.error('[vendor:st-analyzer] vendor 目录缺少引擎产物(main.cjs / data.json)。');
  console.error(
    '[vendor:st-analyzer] 首次 vendoring 时请提供 ST_ANALYZER_SRC 指向 st-analyze 的 server 目录。',
  );
  process.exit(1);
}

const sha = {
  main: await sha256(path.join(OUT_DIR, BUNDLE_NAME)),
  data: await sha256(path.join(OUT_DIR, DATA_NAME)),
  bridge: bridgeSha,
};
const meta = {
  schemaVersion: 1,
  sourceCommit: engine.sourceCommit,
  sourceDirty: engine.sourceDirty,
  bundleMtime: engine.bundleMtime,
  vendoredAt: new Date().toISOString(),
  sha256: sha,
};
await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf8');

const engineChanged = previous?.sha256?.main !== sha.main || previous?.sha256?.data !== sha.data;
const bridgeChanged = previous?.sha256?.bridge !== sha.bridge;
const unchanged = !engineChanged && !bridgeChanged;
const engineLabel = engineChanged ? 'updated' : engineMode === 'synced' ? 'unchanged' : 'reused';
const stats = await Promise.all(
  [BUNDLE_NAME, DATA_NAME, BRIDGE_NAME].map(async (name) => (await fs.stat(path.join(OUT_DIR, name))).size),
);
console.log(
  `[vendor:st-analyzer] ${unchanged ? 'unchanged' : 'updated'} → ${OUT_DIR} ` +
    `(${stats.map((size) => `${Math.round(size / 1024)}KB`).join(' + ')}) ` +
    `engine=${engineLabel} bridge=${bridgeChanged ? 'updated' : 'unchanged'} ` +
    `commit=${meta.sourceCommit.slice(0, 8) || 'unknown'}${meta.sourceDirty ? ' dirty' : ''}`,
);
