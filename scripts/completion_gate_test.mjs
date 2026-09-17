import {
  createToolResult,
  evaluateCompletionGate,
} from './agent.testbundle.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const missingFile = createToolResult({
  ok: false,
  error: '文件不存在:a.txt',
  effect: 'none',
  risk: 'read',
});

{
  const gate = evaluateCompletionGate({
    userText: '读取 a.txt',
    finalMessage: '已读取 a.txt。',
    toolResults: [{ name: 'read_file', args: JSON.stringify({ path: 'a.txt' }), result: missingFile }],
    requiredTool: 'read_file',
  });
  console.log('[completion_gate:1] 假成功阻断 =', !gate.passed);
  assert(!gate.passed, '工具失败后假成功没有被 completion gate 阻断');
}

{
  const gate = evaluateCompletionGate({
    userText: '读取 a.txt',
    finalMessage: '读取 a.txt 失败：文件不存在:a.txt',
    toolResults: [{ name: 'read_file', args: JSON.stringify({ path: 'a.txt' }), result: missingFile }],
    requiredTool: 'read_file',
  });
  console.log('[completion_gate:2] 如实失败放行 =', gate.passed);
  assert(gate.passed, '工具失败后如实报告失败不应触发无限修复');
}

{
  const failedValidation = createToolResult({
    ok: false,
    error: '校验未通过',
    diagnostics: [{ code: 'E1', message: '缺少结束语句', severity: 'error' }],
    effect: 'none',
    risk: 'plan',
  });
  const gate = evaluateCompletionGate({
    userText: '生成一个程序并校验',
    finalMessage: '校验失败：缺少结束语句。',
    toolResults: [{ name: 'validate_code', args: JSON.stringify({ path: 'main.txt' }), result: failedValidation }],
  });
  console.log('[completion_gate:3] 交付流程校验失败继续 =', !gate.passed);
  assert(!gate.passed, '生成/修复类任务里的 plan 校验失败不能只报告失败就结束');
}

{
  const failedValidation = createToolResult({
    ok: false,
    error: '校验未通过',
    diagnostics: [{ code: 'E1', message: '缺少结束语句', severity: 'error' }],
    effect: 'none',
    risk: 'plan',
  });
  const passedValidation = createToolResult({
    ok: true,
    data: { errorCount: 0 },
    effect: 'none',
    risk: 'plan',
  });
  const gate = evaluateCompletionGate({
    userText: '生成一个程序并校验',
    finalMessage: '已修复并通过校验。',
    toolResults: [
      { name: 'validate_code', args: JSON.stringify({ path: 'main.txt' }), result: failedValidation, order: 1 },
      { name: 'validate_code', args: JSON.stringify({ path: 'main.txt' }), result: passedValidation, order: 2 },
    ],
  });
  console.log('[completion_gate:4] 后续成功解决 =', gate.passed);
  assert(gate.passed, '同一工具同一目标后续成功应解决前序失败');
}

console.log('\ncompletion gate 测试通过');
