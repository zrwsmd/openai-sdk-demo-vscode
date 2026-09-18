// ST 校验端口层回归测试(纯 Node,不需要 VS Code / 真实校验器)
// 运行: npm run test:st  (等价于 node scripts/build_test_bundle.mjs && node scripts/st_analyzer_test.mjs)
//
// 覆盖:稳定码映射、严重度语义、协议解析、假执行器失败分支、候选链回退、
// 取消传播、降级可见、真实进程(噪声/超时)、真实端到端、持久化守卫。
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ST_ANALYZER_PROTOCOL_VERSION,
  ST_ANALYZER_STATUS_CODES,
  ST_DIAGNOSTIC_CODES,
  FallbackStAnalyzer,
  JsonRunStore,
  NodeProcessRunner,
  ResilientStAnalyzer,
  SpawnStAnalyzer,
  StAnalyzerUnavailableError,
  countStDiagnostics,
  fallbackStDiagnostics,
  isStValidationFailure,
  lastJsonLine,
  mapStDiagnosticCode,
  minimalProcessEnv,
  parseStAnalyzerResponse,
  toProtocolDiagnostics,
  toolOptionsFromSettings,
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

// ---------- 测试夹具 ----------

const LAUNCH = { exe: 'node-ish', args: ['bridge.cjs'], cwd: 'vendor-dir' };
const REQUEST = {
  workspaceRoot: 'F:\\ws',
  targets: [{ path: 'a.st', text: 'PROGRAM A\nEND_PROGRAM\n' }],
};

function wireDiagnostic(over = {}) {
  return {
    severity: 'error',
    rawCode: null,
    message: '诊断消息',
    line: 3,
    character: 5,
    endLine: 3,
    endCharacter: 6,
    source: 'st-analyze',
    ...over,
  };
}

function bridgePayload(diagnostics, extra = {}) {
  return JSON.stringify({
    protocolVersion: ST_ANALYZER_PROTOCOL_VERSION,
    engine: {
      id: 'st-analyze',
      bundleMtime: '2026-07-29T11:44:45.000Z',
      sourceCommit: 'bc2112d1',
    },
    results: [{ path: 'a.st', diagnostics }],
    contextLoaded: 2,
    elapsedMs: 7,
    ...extra,
  });
}

function processResult(over = {}) {
  return { code: 0, stdout: '', stderr: '', elapsedMs: 1, timedOut: false, ...over };
}

/** 记录调用并按脚本返回的假执行器 */
function fakeRunner(handler) {
  const calls = [];
  return {
    calls,
    async run(exe, args, options) {
      calls.push({ exe, args, options });
      return handler(exe, args, options);
    },
  };
}

function analyzerWith(runner, extra = {}) {
  return new SpawnStAnalyzer({ launches: [LAUNCH], runner, timeoutMs: 1000, ...extra });
}

async function expectUnavailable(promise, expectedCode) {
  try {
    await promise;
  } catch (error) {
    assert.ok(
      error instanceof StAnalyzerUnavailableError,
      `期望 StAnalyzerUnavailableError,实际 ${error && error.name}: ${error && error.message}`,
    );
    assert.equal(error.code, expectedCode);
    return error;
  }
  throw new Error('期望抛出不可用错误,但没有抛出');
}

console.log('ST 校验端口层测试');

// [1] 稳定诊断码映射
await test('[1] 稳定诊断码映射', async () => {
  assert.equal(
    mapStDiagnosticCode("Could not resolve reference to VariableReferenceTarget named 'x'."),
    ST_DIAGNOSTIC_CODES.unresolvedReference,
  );
  assert.equal(mapStDiagnosticCode("不能将类型'BOOL'转化为类型'INT'"), ST_DIAGNOSTIC_CODES.typeMismatch);
  assert.equal(
    mapStDiagnosticCode("Expecting token of type 'END_PROGRAM' but found ``."),
    ST_DIAGNOSTIC_CODES.parseError,
  );
  assert.equal(mapStDiagnosticCode('重复定义的局部变量:x'), ST_DIAGNOSTIC_CODES.duplicateDeclaration);
  assert.equal(mapStDiagnosticCode("不能引用的功能块或函数'NoFb'."), ST_DIAGNOSTIC_CODES.unknownCallable);
  assert.equal(mapStDiagnosticCode('NoSuchParam不是TON的输入参数'), ST_DIAGNOSTIC_CODES.invalidParameterName);
  assert.equal(mapStDiagnosticCode('不存在这样的变量'), ST_DIAGNOSTIC_CODES.referenceMissing);
  // 校验器自己给了 code 时优先用原始值(future-proof)
  assert.equal(mapStDiagnosticCode('任意文案', 'ST_CUSTOM_CODE'), 'ST_CUSTOM_CODE');
  // 未命中落到 other,不猜
  assert.equal(mapStDiagnosticCode('完全无法识别的文案'), ST_DIAGNOSTIC_CODES.other);
  assert.equal(mapStDiagnosticCode(''), ST_DIAGNOSTIC_CODES.other);
});

// [2] 严重度语义:error 才算失败,warning/info 只计数
await test('[2] 严重度语义与计数', async () => {
  const withError = parseStAnalyzerResponse(
    bridgePayload([
      wireDiagnostic({ severity: 'error' }),
      wireDiagnostic({ severity: 'warning' }),
      wireDiagnostic({ severity: 'info' }),
    ]),
  );
  assert.equal(isStValidationFailure(withError), true);
  assert.deepEqual(countStDiagnostics(withError), { error: 1, warning: 1, info: 1 });

  const warningOnly = parseStAnalyzerResponse(
    bridgePayload([wireDiagnostic({ severity: 'warning' }), wireDiagnostic({ severity: 'info' })]),
  );
  assert.equal(isStValidationFailure(warningOnly), false, 'warning 不应导致失败');
  assert.deepEqual(countStDiagnostics(warningOnly), { error: 0, warning: 1, info: 1 });

  const protocol = toProtocolDiagnostics(withError.results[0].diagnostics);
  assert.equal(protocol[0].severity, 'error');
  assert.ok(protocol[0].message.startsWith('L3: '), '应带行号前缀');
  assert.equal(protocol[0].path, 'a.st');
});

// [3] 协议解析:合法/坏 JSON/空输出/版本不符/数字严重度/追溯信息
await test('[3] 协议解析与容错', async () => {
  const parsed = parseStAnalyzerResponse(bridgePayload([wireDiagnostic()]));
  assert.equal(parsed.engine.id, 'st-analyze');
  assert.ok(parsed.engine.detail.includes('commit=bc2112d1'), 'engine.detail 应含来源 commit');
  assert.ok(parsed.engine.detail.includes('bundle='), 'engine.detail 应含构建时间');
  assert.equal(parsed.contextLoaded, 2);
  assert.equal(parsed.elapsedMs, 7);
  assert.equal(parsed.results[0].diagnostics[0].code, ST_DIAGNOSTIC_CODES.other);

  await expectUnavailable(
    Promise.resolve().then(() => parseStAnalyzerResponse('not json at all')),
    ST_ANALYZER_STATUS_CODES.protocolError,
  );
  await expectUnavailable(
    Promise.resolve().then(() => parseStAnalyzerResponse('   ')),
    ST_ANALYZER_STATUS_CODES.protocolError,
  );
  await expectUnavailable(
    Promise.resolve().then(() =>
      parseStAnalyzerResponse(JSON.stringify({ protocolVersion: 99, results: [] })),
    ),
    ST_ANALYZER_STATUS_CODES.protocolError,
  );

  // LSP 数字严重度映射:2→warning,3/4→info,未知→error(保守)
  const numeric = parseStAnalyzerResponse(
    JSON.stringify({
      protocolVersion: ST_ANALYZER_PROTOCOL_VERSION,
      engine: { id: 'st-analyze' },
      results: [
        {
          path: 'a.st',
          diagnostics: [
            { severity: 2, message: 'w' },
            { severity: 3, message: 'i' },
            { severity: 4, message: 'h' },
            { severity: 7, message: 'unknown' },
          ],
        },
      ],
      contextLoaded: 0,
      elapsedMs: 0,
    }),
  );
  assert.deepEqual(
    numeric.results[0].diagnostics.map((item) => item.severity),
    ['warning', 'info', 'info', 'error'],
  );
});

// [4] 工具函数:stdout 取最后一行 JSON、环境变量白名单
await test('[4] stdout 取值与环境变量白名单', async () => {
  assert.equal(lastJsonLine('noise\n{"a":1}\n'), '{"a":1}');
  assert.equal(lastJsonLine('warn\n{"a":1}\ntrailing text\n{"b":2}'), '{"b":2}');
  assert.equal(lastJsonLine('{"only":true}'), '{"only":true}');

  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-should-not-leak';
  try {
    const env = minimalProcessEnv({ EXTRA: '1' });
    assert.equal(env.OPENAI_API_KEY, undefined, '凭据不得透传给工具进程');
    assert.equal(env.EXTRA, '1');
    assert.ok(env.PATH || env.Path, '应透传 PATH');
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

// [5] 请求编码:协议版本、目标、上下文、诊断上限
await test('[5] 请求编码到桥协议', async () => {
  const runner = fakeRunner(() => Promise.resolve(processResult({ stdout: bridgePayload([]) })));
  const analyzer = analyzerWith(runner, { maxDiagnostics: 50 });
  await analyzer.verify({
    ...REQUEST,
    context: [{ path: 'GVL.st', text: 'VAR_GLOBAL\nEND_VAR\n' }],
  });
  assert.equal(runner.calls.length, 1);
  const call = runner.calls[0];
  assert.equal(call.exe, LAUNCH.exe);
  assert.deepEqual(call.args, LAUNCH.args);
  assert.equal(call.options.cwd, LAUNCH.cwd);
  assert.equal(call.options.stdoutMode, 'last-json-line');
  const sent = JSON.parse(call.options.stdin);
  assert.equal(sent.protocolVersion, ST_ANALYZER_PROTOCOL_VERSION);
  assert.equal(sent.workspaceRoot, REQUEST.workspaceRoot);
  assert.equal(sent.targets.length, 1);
  assert.equal(sent.targets[0].path, 'a.st');
  assert.equal(sent.context.length, 1);
  assert.equal(sent.options.maxDiagnostics, 50);
});

// [6] 退出码语义:2 不可用 / 3 协议错 / 其他 不可用 / 坏 JSON 协议错
await test('[6] 退出码语义', async () => {
  const unavailable = analyzerWith(
    fakeRunner(() =>
      Promise.resolve(processResult({ code: 2, stderr: 'analyzer unavailable: boom\nmore lines' })),
    ),
  );
  const error2 = await expectUnavailable(unavailable.verify(REQUEST), ST_ANALYZER_STATUS_CODES.unavailable);
  assert.ok(error2.detail.includes('boom'), 'detail 应含 stderr 首行');

  const protocol = analyzerWith(
    fakeRunner(() => Promise.resolve(processResult({ code: 3, stderr: 'bad_request' }))),
  );
  await expectUnavailable(protocol.verify(REQUEST), ST_ANALYZER_STATUS_CODES.protocolError);

  const crash = analyzerWith(fakeRunner(() => Promise.resolve(processResult({ code: 1, stderr: 'crash' }))));
  const error1 = await expectUnavailable(crash.verify(REQUEST), ST_ANALYZER_STATUS_CODES.unavailable);
  assert.ok(error1.detail.includes('exit=1'), 'detail 应带退出码');

  const garbled = analyzerWith(fakeRunner(() => Promise.resolve(processResult({ stdout: 'not json' }))));
  await expectUnavailable(garbled.verify(REQUEST), ST_ANALYZER_STATUS_CODES.protocolError);
});

// [7] 超时:不算通过,归为 timeout
await test('[7] 超时归为失败而非通过', async () => {
  const timedOut = analyzerWith(
    fakeRunner(() => Promise.resolve(processResult({ code: null, timedOut: true }))),
  );
  await expectUnavailable(timedOut.verify(REQUEST), ST_ANALYZER_STATUS_CODES.timeout);
});

// [8] 候选链:首个失败换下一个;全失败抛最后一个原因
await test('[8] 运行时候选链回退', async () => {
  const chain = [
    { exe: 'candidate-1', args: ['bridge.cjs'], cwd: '.' },
    { exe: 'candidate-2', args: ['bridge.cjs'], cwd: '.', env: { ELECTRON_RUN_AS_NODE: '1' } },
  ];
  const runner = fakeRunner((exe) =>
    Promise.resolve(
      exe === 'candidate-1'
        ? processResult({ code: 2, stderr: 'first failed' })
        : processResult({ stdout: bridgePayload([]) }),
    ),
  );
  const analyzer = new SpawnStAnalyzer({ launches: chain, runner, timeoutMs: 1000 });
  const result = await analyzer.verify(REQUEST);
  assert.equal(result.engine.id, 'st-analyze');
  assert.equal(runner.calls.length, 2, '应依次尝试两个候选');
  assert.equal(runner.calls[1].options.env.ELECTRON_RUN_AS_NODE, '1', '候选自带的 env 要透传');

  const allFail = new SpawnStAnalyzer({
    launches: chain,
    runner: fakeRunner(() => Promise.resolve(processResult({ code: 2, stderr: 'nope' }))),
    timeoutMs: 1000,
  });
  const last = await expectUnavailable(allFail.verify(REQUEST), ST_ANALYZER_STATUS_CODES.unavailable);
  assert.ok(last.detail.includes('nope'));

  const noCandidate = new SpawnStAnalyzer({
    launches: [],
    runner: fakeRunner(() => Promise.resolve(processResult())),
    timeoutMs: 1000,
  });
  await expectUnavailable(noCandidate.verify(REQUEST), ST_ANALYZER_STATUS_CODES.notConfigured);
});

// [9] 取消传播:已取消时原始异常向上抛,不包装成"可降级"
await test('[9] 取消不被包装成降级', async () => {
  const controller = new AbortController();
  const abortError = new Error('operation aborted by user');
  const runner = fakeRunner(() => {
    controller.abort();
    return Promise.reject(abortError);
  });
  const analyzer = new SpawnStAnalyzer({
    launches: [LAUNCH, { exe: 'second', args: [], cwd: '.' }],
    runner,
    timeoutMs: 1000,
  });
  await assert.rejects(
    () => analyzer.verify(REQUEST, { signal: controller.signal }),
    (error) => {
      assert.equal(error, abortError, '应原样抛出取消原因');
      assert.ok(!(error instanceof StAnalyzerUnavailableError), '不得包装成可降级错误');
      return true;
    },
  );
  assert.equal(runner.calls.length, 1, '取消后不应继续尝试其它候选');
});

// [10] 降级可见:主实现不可用 → 兜底结果 + 原因
await test('[10] 降级可见且不带假通过', async () => {
  const primary = analyzerWith(
    fakeRunner(() => Promise.resolve(processResult({ code: 2, stderr: 'missing' }))),
  );
  const resilient = new ResilientStAnalyzer(primary, new FallbackStAnalyzer());
  const result = await resilient.verify(REQUEST);
  assert.equal(result.engine.id, 'fallback');
  assert.equal(result.engine.fallbackReason, ST_ANALYZER_STATUS_CODES.unavailable);
  assert.equal(result.engine.detail, 'missing');
  assert.equal(isStValidationFailure(result), false, '示例代码本身没问题,兜底不应报错');

  // 未知错误(例如桥内部 bug):底层实现包装成"不可用"并保留原始原因
  const broken = analyzerWith(fakeRunner(() => Promise.reject(new Error('internal bug'))));
  const wrapped = await expectUnavailable(broken.verify(REQUEST), ST_ANALYZER_STATUS_CODES.unavailable);
  assert.ok(wrapped.detail.includes('internal bug'), '未知错误应保留原始原因');

  // 经组合器包装后转降级,但必须可见(原因 + 原始错误都不能被吞掉)
  const resilient2 = new ResilientStAnalyzer(broken, new FallbackStAnalyzer());
  const degraded = await resilient2.verify(REQUEST);
  assert.equal(degraded.engine.id, 'fallback');
  assert.equal(degraded.engine.fallbackReason, ST_ANALYZER_STATUS_CODES.unavailable);
  assert.ok(degraded.engine.detail.includes('internal bug'), '降级时也要能看到原始错误');
});

// [11] 兜底实现:与接入前行为一致(缺 END_PROGRAM、TON 无时间字面量)
await test('[11] 兜底实现行为', async () => {
  const good = fallbackStDiagnostics({ path: 'a.st', text: 'TON1(IN := TRUE, PT := T#5S);\nEND_PROGRAM\n' });
  assert.equal(good.length, 0, '合法片段不应报错');

  const missingEnd = fallbackStDiagnostics({ path: 'a.st', text: 'PROGRAM A\n' });
  assert.equal(missingEnd.length, 1);
  assert.equal(missingEnd[0].code, ST_DIAGNOSTIC_CODES.parseError);
  assert.equal(missingEnd[0].severity, 'error');

  const tonWithoutLiteral = fallbackStDiagnostics({ path: 'a.st', text: 'TON1(IN := TRUE);\nEND_PROGRAM\n' });
  assert.equal(tonWithoutLiteral.length, 1);
  assert.equal(tonWithoutLiteral[0].code, ST_DIAGNOSTIC_CODES.timerLiteralMissing);

  const fallback = new FallbackStAnalyzer(ST_ANALYZER_STATUS_CODES.disabled);
  const result = await fallback.verify(REQUEST);
  assert.equal(result.engine.fallbackReason, ST_ANALYZER_STATUS_CODES.disabled);
  assert.equal(result.contextLoaded, 0);
});

// [12] 真实进程:噪声 stdout 取最后一行、超时能及时返回
await test('[12] 真实进程执行器', async () => {
  const runner = new NodeProcessRunner();
  const noisy = await runner.run(
    process.execPath,
    ['-e', "console.log('Ambiguous Alternatives Detected'); console.log(JSON.stringify({ ok: true }))"],
    { stdoutMode: 'last-json-line', timeoutMs: 15000 },
  );
  assert.equal(noisy.code, 0);
  assert.deepEqual(JSON.parse(noisy.stdout), { ok: true }, '应取最后一行 JSON');

  const slow = await runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], {
    timeoutMs: 500,
  });
  assert.equal(slow.timedOut, true, '超时应被标记');
  assert.equal(slow.code, null);
  assert.ok(slow.elapsedMs < 4000, '超时后应立即返回,而不是等子进程自己结束');
});

// [13] 工具配额投影
await test('[13] 工具配额投影', async () => {
  const empty = toolOptionsFromSettings(undefined);
  assert.equal(empty.loadWorkspaceContext, undefined);
  assert.equal(empty.maxContextFiles, undefined);
  assert.equal(empty.maxFileBytes, undefined);
  assert.equal(empty.maxDiagnostics, undefined);

  const projected = toolOptionsFromSettings({
    loadWorkspaceContext: false,
    maxContextFiles: 5,
    maxFileBytes: 100,
    maxDiagnostics: 7,
  });
  assert.equal(projected.loadWorkspaceContext, false);
  assert.equal(projected.maxContextFiles, 5);
  assert.equal(projected.maxFileBytes, 100);
  assert.equal(projected.maxDiagnostics, 7);
});

// [14] 持久化守卫:合法设置可读、旧记录兼容、非法设置被拒
await test('[14] 持久化守卫', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-run-store-st-'));
  const file = path.join(dir, 'runs.json');
  const baseRecord = {
    schemaVersion: 1,
    id: 'r1',
    operationId: 'op1',
    userText: 'u',
    status: 'completed',
    sessionItemCountBefore: 0,
    canContinue: false,
    approvals: [],
    output: '',
    usage: { inputTokens: 0, outputTokens: 0, requests: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const withSettings = (settings) => ({
    ...baseRecord,
    config: {
      baseUrl: 'https://gateway/v1',
      model: 'm',
      exportDir: 'exports',
      workspaceRoot: 'ws',
      ...(settings === undefined ? {} : { stAnalyzerSettings: settings }),
    },
  });
  const writeStore = (active) =>
    fs.writeFile(file, JSON.stringify({ schemaVersion: 1, active, effects: {}, effectAttempts: {} }));

  try {
    // 合法:候选链 + 配额都应原样保留
    await writeStore(
      withSettings({
        launches: [{ exe: 'node.exe', args: ['bridge.cjs'], cwd: 'vendor' }],
        timeoutMs: 20000,
        loadWorkspaceContext: true,
        maxContextFiles: 200,
      }),
    );
    const active = await new JsonRunStore(file).getActive();
    assert.ok(active, '合法记录应能读取');
    assert.equal(active.config.stAnalyzerSettings.timeoutMs, 20000);
    assert.equal(active.config.stAnalyzerSettings.launches[0].exe, 'node.exe');

    // 兼容:不带该字段的历史记录必须仍可读(升级不能锁死旧状态)
    await writeStore(withSettings(undefined));
    assert.ok(await new JsonRunStore(file).getActive(), '旧记录(无该字段)必须仍可读');

    // 非法:类型不对必须被拒,避免带着坏配置继续跑
    await writeStore(withSettings({ launches: 'not-an-array' }));
    await assert.rejects(() => new JsonRunStore(file).getActive(), /运行状态存储损坏/);

    // 非法:配额写成非数字同样被拒
    await writeStore(withSettings({ timeoutMs: 'soon' }));
    await assert.rejects(() => new JsonRunStore(file).getActive(), /运行状态存储损坏/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// [15] 真实端到端:vendor 产物存在才跑(先 npm run vendor:st-analyzer)
const vendorDir = path.join(process.cwd(), 'vendor', 'st-analyzer');
const bridgePath = path.join(vendorDir, 'bridge.cjs');
const hasVendor = await fs
  .access(bridgePath)
  .then(() => true)
  .catch(() => false);

if (!hasVendor) {
  console.log('  skip  [15] 真实端到端(vendor/st-analyzer 不存在,先跑 npm run vendor:st-analyzer)');
} else {
  await test('[15] 真实端到端:产物可用', async () => {
    const real = new SpawnStAnalyzer({
      launches: [{ exe: process.execPath, args: [bridgePath], cwd: vendorDir }],
      runner: new NodeProcessRunner(),
      timeoutMs: 20000,
    });
    const workspaceRoot = 'F:\\st-analyzer-test-ws';

    const good = await real.verify({
      workspaceRoot,
      targets: [
        { path: 'ok.st', text: 'PROGRAM Main\nVAR\n  n : INT;\nEND_VAR\n  n := 1;\nEND_PROGRAM\n' },
      ],
    });
    assert.equal(good.engine.id, 'st-analyze');
    assert.equal(isStValidationFailure(good), false, '正确程序不应报错');
    assert.ok(good.engine.detail.includes('bundle='), '应带产物构建时间');

    const bad = await real.verify({
      workspaceRoot,
      targets: [
        {
          path: 'bad.st',
          text: 'PROGRAM Main\nVAR\n  n : INT;\nEND_VAR\n  n := TRUE;\nEND_PROGRAM\n',
        },
      ],
    });
    assert.equal(isStValidationFailure(bad), true, '类型错误必须被抓到');
    assert.ok(
      bad.results[0].diagnostics.some((item) => item.code === ST_DIAGNOSTIC_CODES.typeMismatch),
      '应映射出稳定诊断码',
    );

    const withContext = await real.verify({
      workspaceRoot,
      targets: [
        {
          path: 'use.st',
          text:
            'PROGRAM Main\nVAR_EXTERNAL\n  gStart : BOOL;\nEND_VAR\n  gStart := TRUE;\nEND_PROGRAM\n',
        },
      ],
      context: [{ path: 'GVL.st', text: 'VAR_GLOBAL\n  gStart : BOOL;\nEND_VAR\n' }],
    });
    assert.equal(isStValidationFailure(withContext), false, '带上下文时跨文件引用应通过');
    assert.equal(withContext.contextLoaded, 1);
  });
}

console.log('');
if (failures.length) {
  console.error(`ST 校验端口层测试失败 ${failures.length} 项(通过 ${passed} 项):`);
  for (const item of failures) console.error('  - ' + item);
  process.exit(1);
}
console.log(`ST 校验端口层测试全部通过 ✔ (${passed} 项)`);