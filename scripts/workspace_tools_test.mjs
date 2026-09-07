// 工作区工具层单测(纯函数,不需要 mock 网关)
// 运行: node scripts/workspace_tools_test.mjs   (需先打包 testbundle,见 README)
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveInWorkspace, listFiles, readFileRange, writeFileText, searchText, runCommand } from './agent.testbundle.mjs';

const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-ws-test-'));
await fs.writeFile(path.join(ws, 'main.st'), 'PROGRAM Demo\n  x := 1;\nEND_PROGRAM\n');
await fs.mkdir(path.join(ws, 'sub'), { recursive: true });
await fs.writeFile(path.join(ws, 'sub', 'util.txt'), 'Motor_Star := TON_Star.Q;\n');
await fs.mkdir(path.join(ws, 'node_modules', 'foo'), { recursive: true });
await fs.writeFile(path.join(ws, 'node_modules', 'foo', 'index.js'), 'PROGRAM ShouldNotBeSeen\n');

// [1] list_files:能看到工作区文件,跳过 node_modules
{
  const files = await listFiles(ws);
  console.log('[1] list_files:', files.map((f) => f.split('\t')[0]).join(', '));
  if (!files.some((f) => f.startsWith('main.st'))) throw new Error('未列出 main.st');
  if (files.some((f) => f.includes('node_modules'))) throw new Error('未跳过 node_modules');
}

// [2] read_file:整读与分段
{
  const all = await readFileRange(ws, 'main.st');
  const part = await readFileRange(ws, 'main.st', 2, 2);
  console.log('[2] read_file: totalLines =', all.totalLines, '| 第2行 =', JSON.stringify(part.text));
  if (all.totalLines !== 4 || part.text.trim() !== 'x := 1;') throw new Error('读取分段错误');
}

// [3] write_file:嵌套目录自动创建 + 覆盖写
{
  const r = await writeFileText(ws, 'out/deep/gen.st', 'PROGRAM Gen\nEND_PROGRAM\n');
  const back = await fs.readFile(r.file, 'utf8');
  console.log('[3] write_file: bytes =', r.bytes, '| 回读一致 =', back.includes('PROGRAM Gen'));
  if (!back.includes('PROGRAM Gen')) throw new Error('写入回读不一致');
}

// [4] search_files:字面量 + glob 过滤 + 正则 + 不误报
{
  const m1 = await searchText(ws, 'Motor_Star');
  const m2 = await searchText(ws, 'PROGRAM', { glob: '*.st' });
  const m3 = await searchText(ws, 'PROGRAM\\s+\\w+', { isRegex: true, glob: '*.st' });
  const m4 = await searchText(ws, '不存在的字符串xyz');
  console.log('[4] search_files: 字面量 =', m1.length, '| glob 命中 =', JSON.stringify(m2), '| 正则 =', m3.length, '| 空结果 =', m4[0].includes('未找到'));
  if (!m1[0].includes('sub/util.txt:1')) throw new Error('字面量搜索路径/行号错误');
  if (m2.some((s) => s.includes('node_modules'))) throw new Error('搜索未跳过 node_modules');
  if (m2.length !== 2) throw new Error('glob=*.st 应命中 main.st 的 2 行(PROGRAM/END_PROGRAM)');
  if (m3.length !== 1) throw new Error('正则搜索应命中 1 行');
}

// [5] 路径越界防护
{
  let thrown = null;
  try {
    resolveInWorkspace(ws, '../evil.txt');
  } catch (e) {
    thrown = e;
  }
  const absOut = path.join(os.tmpdir(), 'evil-absolute.txt');
  let thrown2 = null;
  try {
    resolveInWorkspace(ws, absOut);
  } catch (e) {
    thrown2 = e;
  }
  console.log('[5] 越界防护: ../ →', thrown?.message?.slice(0, 12) + '…', '| 绝对路径越界 →', thrown2?.message?.slice(0, 12) + '…');
  if (!thrown || !thrown2) throw new Error('越界路径未被拒绝');
}

// [6] run_command:正常输出与非零退出码
{
  const ok = await runCommand(ws, 'echo hello-from-tool');
  const bad = await runCommand(ws, 'node -e "process.exit(7)"');
  console.log('[6] run_command: echo 输出含 hello-from-tool =', ok.output.includes('hello-from-tool'), '| 退出码 =', ok.exitCode, '/', bad.exitCode);
  if (!ok.output.includes('hello-from-tool') || ok.exitCode !== 0 || bad.exitCode !== 7) throw new Error('命令执行结果不符合预期');
}

// [7] run_command:AbortSignal 会终止 shell 及其子进程树
{
  const controller = new AbortController();
  const marker = path.join(ws, 'cancel-marker.txt').replaceAll('\\', '/');
  const startedAt = Date.now();
  setTimeout(() => controller.abort(), 50);
  let aborted = false;
  try {
    await runCommand(
      ws,
      `node -e "setTimeout(()=>require('fs').writeFileSync('${marker}','alive'),3000)"`,
      10_000,
      controller.signal,
    );
  } catch (error) {
    aborted = error?.name === 'AbortError';
  }
  const elapsed = Date.now() - startedAt;
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const childSurvived = await fs.access(marker).then(() => true, () => false);
  console.log('[7] run_command: 取消 =', aborted, '| 耗时 =', elapsed, 'ms | 子进程存活 =', childSurvived);
  if (!aborted || elapsed > 3000 || childSurvived) throw new Error('命令取消未终止进程树');
}

console.log(`\n工作区工具层 全部通过 ✔ (工作区 ${ws})`);
