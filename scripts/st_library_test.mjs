// ST 标准库符号查询回归测试(纯 Node,不需要 VS Code)
// 运行: node scripts/build_test_bundle.mjs && node scripts/st_library_test.mjs
//
// 覆盖四层:
//   1. 响应解析(纯函数,不依赖 vendor)
//   2. 降级实现如实标注不可用,而不是假装"库里没有"
//   3. 工具已在 ToolCatalog 中,且按 risk=plan 自动进入安全 fallback 工具集
//   4. 桥端到端(需要 vendor/st-analyzer 已就位;缺失时跳过并说明)
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FallbackStAnalyzer,
  NodeProcessRunner,
  SpawnStAnalyzer,
  ST_ANALYZER_PROTOCOL_VERSION,
  ST_ANALYZER_STATUS_CODES,
  StAnalyzerUnavailableError,
  createAppToolRegistry,
  parseStLibraryResponse,
} from './agent.testbundle.mjs';

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok    ' + name);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    failures.push(name + ' :: ' + message);
    console.error('  FAIL  ' + name + ' -> ' + message);
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const vendorDir = path.join(repoRoot, 'vendor', 'st-analyzer');
const bridgePath = path.join(vendorDir, 'bridge.cjs');
const dataPath = path.join(vendorDir, 'data.json');
const hasVendor = existsSync(bridgePath) && existsSync(dataPath);

function envelope(library, over = {}) {
  return JSON.stringify({
    protocolVersion: ST_ANALYZER_PROTOCOL_VERSION,
    engine: { id: 'st-analyze', sourceCommit: 'deadbeef' },
    library,
    elapsedMs: 3,
    ...over,
  });
}

function liveAnalyzer() {
  return new SpawnStAnalyzer({
    launches: [{ exe: process.execPath, args: [bridgePath], cwd: vendorDir }],
    runner: new NodeProcessRunner(),
    timeoutMs: 20_000,
  });
}

// ---------- 1. 响应解析 ----------

await test('[1] 解析完整条目:端口 / usage / 可变参数 / 过滤串', () => {
  const result = parseStLibraryResponse(
    envelope({
      symbol: 'ADD',
      matchCount: 2,
      entries: [
        {
          name: 'ADD',
          kind: 'function',
          comment: 'Addition',
          inputs: [{ name: 'IN1', type: 'ANY_NUM' }, { name: 'IN2', type: 'ANY_NUM' }],
          outputs: [{ name: 'OUT', type: 'ANY_NUM' }],
          extensible: true,
          baseInputCount: 1,
          typeFilter: 'ANY_NUM',
        },
        {
          name: 'ADD',
          kind: 'function',
          comment: 'Time addition',
          inputs: [{ name: 'IN1', type: 'TIME' }],
          outputs: [{ name: 'OUT', type: 'TIME' }],
          usage: '(TIME:IN1, TIME:IN2) => (TIME:OUT)',
        },
      ],
    }),
  );
  assert.equal(result.symbol, 'ADD');
  assert.equal(result.matchCount, 2);
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].extensible, true);
  assert.equal(result.entries[0].baseInputCount, 1);
  assert.equal(result.entries[0].typeFilter, 'ANY_NUM');
  assert.deepEqual(result.entries[0].inputs, [
    { name: 'IN1', type: 'ANY_NUM' },
    { name: 'IN2', type: 'ANY_NUM' },
  ]);
  assert.equal(result.entries[1].usage, '(TIME:IN1, TIME:IN2) => (TIME:OUT)');
});

await test('[2] 解析边沿限定与 enum/struct/derived 的专属字段', () => {
  const result = parseStLibraryResponse(
    envelope({
      symbol: 'MIX',
      matchCount: 3,
      entries: [
        {
          name: 'CTU',
          kind: 'functionBlock',
          inputs: [
            { name: 'CU', type: 'BOOL', edge: 'rising' },
            { name: 'PV', type: 'INT' },
          ],
          outputs: [{ name: 'Q', type: 'BOOL' }],
        },
        { name: 'SMC_ERROR', kind: 'enum', values: ['SMC_NO_ERROR'] },
        {
          name: 'SMC_TP',
          kind: 'struct',
          elements: [{ name: 'delta_time', type: 'TIME', comment: '周期' }],
        },
        { name: 'AXIS_REF', kind: 'derived', baseType: 'INT' },
      ],
    }),
  );
  assert.equal(result.entries[0].inputs[0].edge, 'rising');
  assert.equal(result.entries[0].inputs[1].edge, undefined, 'edge=none 不应占位');
  assert.deepEqual(result.entries[1].values, ['SMC_NO_ERROR']);
  assert.equal(result.entries[2].elements[0].comment, '周期');
  assert.equal(result.entries[3].baseType, 'INT');
});

await test('[3] 空结果与缺字段不炸', () => {
  const empty = parseStLibraryResponse(envelope({ symbol: 'NOPE', matchCount: 0, entries: [] }));
  assert.equal(empty.matchCount, 0);
  assert.deepEqual(empty.entries, []);

  const bare = parseStLibraryResponse(envelope({}));
  assert.equal(bare.symbol, '');
  assert.equal(bare.matchCount, 0);
  assert.deepEqual(bare.entries, []);

  // 名称为空的条目应被丢弃,而不是产出无名条目
  const junk = parseStLibraryResponse(
    envelope({ symbol: 'X', matchCount: 1, entries: [{ name: '', kind: 'function' }] }),
  );
  assert.deepEqual(junk.entries, []);
});

await test('[4] 协议版本不符归为协议错误(可降级),不返回假结果', () => {
  assert.throws(
    () => parseStLibraryResponse(envelope({ symbol: 'ADD' }, { protocolVersion: 99 })),
    (error) =>
      error instanceof StAnalyzerUnavailableError &&
      error.code === 'st_analyzer_protocol_error',
  );
});

// ---------- 2. 降级 ----------

await test('[5] 降级实现返回空并标注原因,而不是假装库里没有', async () => {
  const fallback = new FallbackStAnalyzer(ST_ANALYZER_STATUS_CODES.disabled);
  const result = await fallback.libraryLookup({ symbol: 'ADD' });
  assert.equal(result.engine.id, 'fallback');
  assert.equal(result.engine.fallbackReason, ST_ANALYZER_STATUS_CODES.disabled);
  assert.equal(result.matchCount, 0);
  assert.deepEqual(result.entries, []);
});

// ---------- 3. 能力声明与 fallback 收录 ----------

await test('[6] 工具已注册,风险 plan / 副作用 none', () => {
  const catalog = createAppToolRegistry().getToolCatalog();
  const capability = catalog.get('st_library_symbol');
  assert.ok(capability, 'st_library_symbol 应已在 ToolCatalog 中');
  assert.equal(capability.risk, 'plan');
  assert.equal(capability.effect, 'none');
  assert.equal(capability.providerId, 'st');
});

await test('[7] 三个安全模式自动收录,写/执行类工具不混入', () => {
  const catalog = createAppToolRegistry().getToolCatalog();
  for (const mode of ['general_chat', 'needs_clarification', 'blocked_high_risk']) {
    const tools = catalog.toolsForFallback(mode);
    assert.ok(tools.includes('st_library_symbol'), `${mode} 应包含 st_library_symbol`);
    assert.ok(!tools.includes('write_file'), `${mode} 不应包含 write_file`);
    assert.ok(!tools.includes('run_command'), `${mode} 不应包含 run_command`);
  }
});

// ---------- 4. 桥端到端 ----------

if (!hasVendor) {
  console.log('  skip  桥端到端(vendor/st-analyzer 未就位:需要 bridge.cjs + data.json)');
} else {
  await test('[8] 端到端:精确命中且大小写不敏感', async () => {
    const analyzer = liveAnalyzer();
    const upper = await analyzer.libraryLookup({ symbol: 'ADD' });
    assert.equal(upper.engine.id, 'st-analyze');
    // 同名多用途:ADD 在数值加法与时间加法下各有一条,靠类型签名区分
    assert.ok(upper.matchCount >= 2, `ADD 应命中多条,实际 ${upper.matchCount}`);
    assert.ok(
      upper.entries.some((entry) =>
        (entry.inputs ?? []).some((port) => port.type === 'TIME'),
      ),
      '应至少有一条时间加法的 ADD',
    );

    const lower = await analyzer.libraryLookup({ symbol: 'add' });
    assert.equal(lower.matchCount, upper.matchCount, '大小写不应影响命中数');
    assert.equal(lower.entries[0].name, 'ADD', '返回的应是符号表里的原始大小写');
  });

  await test('[9] 端到端:功能块带调用签名,注释已剥掉 gettext 外壳', async () => {
    const analyzer = liveAnalyzer();
    const result = await analyzer.libraryLookup({ symbol: 'TON' });
    assert.equal(result.matchCount, 1);
    const [ton] = result.entries;
    assert.equal(ton.kind, 'functionBlock');
    assert.ok(ton.usage && ton.usage.includes('=>'), '功能块应带调用签名');
    assert.ok(ton.comment && !ton.comment.includes('_('), '注释不应残留 _("...") 外壳');
    assert.ok(
      (ton.inputs ?? []).some((port) => port.name === 'PT' && port.type === 'TIME'),
      'TON 应有 TIME 类型的 PT 输入',
    );
  });

  await test('[10] 端到端:查不到返回 0 条(不做模糊匹配)', async () => {
    const analyzer = liveAnalyzer();
    const result = await analyzer.libraryLookup({ symbol: 'ADDX_NOT_A_SYMBOL' });
    assert.equal(result.matchCount, 0);
    assert.deepEqual(result.entries, []);
  });

  await test('[11] 端到端:空符号名是协议错误,不是空结果', async () => {
    const analyzer = liveAnalyzer();
    await assert.rejects(
      () => analyzer.libraryLookup({ symbol: '   ' }),
      (error) =>
        error instanceof StAnalyzerUnavailableError &&
        error.code === 'st_analyzer_protocol_error',
    );
  });
}

// ---------- 汇总 ----------

console.log(`\nst_library_test: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error('  - ' + failure);
  process.exit(1);
}
