#!/usr/bin/env node
'use strict';
/**
 * ST 校验器 CLI —— 证明"同一套端口层可以脱离 VSCode 独立运行"(指南第 11 节第 3 条)。
 *
 * 它就是一个最小宿主:用与插件完全相同的端口实现
 * (NodeProcessRunner + SpawnStAnalyzer + 降级组合器 + 工作区上下文收集)跑真实校验,
 * 唯一区别是宿主装配写在本文件里,而不是 src/app/analyzerHost.ts。
 *
 * 前置: 先执行 npm run test:generate 生成端口层打包产物 scripts/agent.testbundle.mjs,
 *       并执行 npm run vendor:st-analyzer 准备 vendor/st-analyzer。
 *
 * 用法:
 *   node scripts/st_analyzer_cli.mjs --version
 *   node scripts/st_analyzer_cli.mjs <a.st> [b.st ...] [--no-context] [--analyzer-dir <dir>]
 *
 * 退出码: 0 = 校验已执行(发现问题也算成功,与桥语义一致)
 *         1 = 用法/输入错误   2 = 校验器不可用(降级)
 */
import fs from 'node:fs';
import path from 'node:path';

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

const args = process.argv.slice(2);
const flags = { noContext: false, analyzerDir: '' };
const targets = [];
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--version') {
    flags.version = true;
  } else if (arg === '--no-context') {
    flags.noContext = true;
  } else if (arg === '--analyzer-dir') {
    flags.analyzerDir = args[++i] || '';
  } else if (arg === '-h' || arg === '--help') {
    flags.help = true;
  } else {
    targets.push(arg);
  }
}

if (flags.help || (!flags.version && !targets.length)) {
  console.log([
    '用法:',
    '  node scripts/st_analyzer_cli.mjs --version',
    '  node scripts/st_analyzer_cli.mjs <a.st> [b.st ...] [--no-context] [--analyzer-dir <dir>]',
    '',
    '  --no-context     不加载同目录其它 .st 作为跨文件上下文',
    '  --analyzer-dir   覆盖 vendor/st-analyzer 目录(默认 process.cwd()/vendor/st-analyzer)',
    '',
    '退出码: 0 校验已执行 / 1 用法或输入错误 / 2 校验器不可用(降级)',
  ].join('\n'));
  process.exit(flags.help ? 0 : 1);
}

// 端口层来自生成的测试 bundle(与 npm run test:st 同一来源,保证"同一套实现")
let port;
try {
  // .mjs 是 ESM 作用域,用动态 import 加载同目录的 ESM 打包产物
  port = await import('./agent.testbundle.mjs');
} catch (error) {
  fail('端口层产物缺失,请先执行: npm run test:generate\n' + (error && error.message), 1);
}

const analyzerDir = path.resolve(flags.analyzerDir || path.join(process.cwd(), 'vendor', 'st-analyzer'));
const bridgePath = path.join(analyzerDir, 'bridge.cjs');

if (flags.version) {
  let vendor = null;
  try {
    vendor = JSON.parse(fs.readFileSync(path.join(analyzerDir, 'vendor.json'), 'utf8'));
  } catch {
    /* vendor.json 可选 */
  }
  console.log(JSON.stringify({
    cli: 'scripts/st_analyzer_cli.mjs',
    portLayer: 'scripts/agent.testbundle.mjs',
    bridge: fs.existsSync(bridgePath) ? bridgePath : null,
    vendor: vendor && {
      sourceCommit: vendor.sourceCommit,
      bundleMtime: vendor.bundleMtime,
      sha256: vendor.sha256,
    },
  }, null, 2));
  process.exit(0);
}

if (!fs.existsSync(bridgePath)) {
  fail(`未找到桥: ${bridgePath}\n请先执行 npm run vendor:st-analyzer`, 2);
}

// 与插件一致的宿主装配:唯一区别是这些"平台知识"写在本文件里
const launches = [{ exe: process.execPath, args: [bridgePath], cwd: analyzerDir }];
const primary = new port.SpawnStAnalyzer({
  launches,
  runner: new port.NodeProcessRunner(),
  timeoutMs: 20000,
});
const analyzer = new port.ResilientStAnalyzer(primary, new port.FallbackStAnalyzer());

(async () => {
  const absoluteTargets = targets.map((item) => path.resolve(item));
  for (const item of absoluteTargets) {
    if (!fs.existsSync(item)) fail(`文件不存在: ${item}`, 1);
    if (!/\.st$/i.test(item)) fail(`不是 .st 文件: ${item}`, 1);
  }

  const scope = new port.WorkspaceScope([path.dirname(absoluteTargets[0])]);
  const excludePaths = absoluteTargets.map((item) => path.basename(item));
  const context = flags.noContext
    ? { files: [], truncated: false, skipped: 0 }
    : await port.collectWorkspaceStContext(scope, { excludePaths });

  const result = await analyzer.verify({
    workspaceRoot: scope.primaryRoot,
    targets: absoluteTargets.map((item) => ({
      path: item,
      // 去 BOM + 统一换行:实测带 BOM 的文本会让校验器静默返回 0 诊断(漏报),
      // Windows 工具链生成的文件极易带 BOM,必须在提交给端口层之前剥掉。
      text: fs.readFileSync(item, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'),
    })),
    context: context.files,
  });

  for (const targetResult of result.results) {
    const display = path.basename(targetResult.path);
    for (const diagnostic of targetResult.diagnostics) {
      const where = diagnostic.line > 0 ? `${display}:${diagnostic.line}:${diagnostic.character}` : display;
      console.log(`${diagnostic.severity.padEnd(7)} ${where}  ${diagnostic.code}  ${diagnostic.message}`);
    }
    if (!targetResult.diagnostics.length) console.log(`(无诊断) ${display}`);
  }

  const counts = port.countStDiagnostics(result);
  console.log('');
  console.log(`engine=${result.engine.id}` +
    (result.engine.fallbackReason ? ` fallbackReason=${result.engine.fallbackReason}` : '') +
    ` errors=${counts.error} warnings=${counts.warning} contextFiles=${result.contextLoaded}` +
    ` elapsedMs=${result.elapsedMs}`);
  if (result.engine.id !== 'st-analyze') {
    console.error('警告: 本次不是真实校验器在干活(见上方 fallbackReason),结果仅供参考。');
    process.exit(2);
  }
  process.exit(0);
})().catch((error) => {
  if (error instanceof port.StAnalyzerUnavailableError) {
    fail(`校验器不可用: ${error.code}\n${error.detail || ''}`, 2);
  }
  fail(error && error.stack ? error.stack : String(error), 1);
});