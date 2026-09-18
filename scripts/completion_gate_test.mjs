import {
  createToolResult,
  createDeliveryContract,
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

const validationContract = createDeliveryContract({
  requiresDeliverable: true,
  reason: '用户要求生成并校验可交付程序',
  deliverables: [{
    kind: 'code',
    title: '程序',
    description: '通过校验的程序',
    required: true,
    acceptableEvidence: ['final_artifact', 'successful_tool'],
    workspacePersistence: 'not_required',
  }],
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
    deliveryContract: validationContract,
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
    deliveryContract: validationContract,
  });
  console.log('[completion_gate:4] 后续成功解决 =', gate.passed);
  assert(gate.passed, '同一工具同一目标后续成功应解决前序失败');
}

const codeContract = createDeliveryContract({
  requiresDeliverable: true,
  reason: '用户要求生成可交付代码',
  deliverables: [{
    kind: 'code',
    title: 'ST 程序',
    description: '完整 ST 控制程序',
    required: true,
    acceptableEvidence: ['final_artifact'],
    workspacePersistence: 'not_required',
  }],
});

{
  const gate = evaluateCompletionGate({
    userText: '生成一个 ST 程序',
    finalMessage: '好的，我来编写完整程序。',
    toolResults: [],
    deliveryContract: codeContract,
  });
  console.log('[completion_gate:5] 缺少契约交付物阻断 =', !gate.passed);
  assert(!gate.passed, '交付契约要求代码时，只有口头承诺不应放行');
}

{
  const gate = evaluateCompletionGate({
    userText: '生成一个 ST 程序',
    finalMessage: '已生成程序。',
    toolResults: [],
    deliveryContract: codeContract,
    artifacts: [{ kind: 'code', name: 'Pump.st', content: 'PROGRAM Pump\nEND_PROGRAM' }],
  });
  console.log('[completion_gate:6] artifact 交付放行 =', gate.passed);
  assert(gate.passed, '交付契约要求代码时，有 code artifact 应放行');
}

{
  const gate = evaluateCompletionGate({
    userText: '生成一个 ST 程序',
    finalMessage: '已生成并保存程序。',
    toolResults: [],
    deliveryContract: createDeliveryContract({
      requiresDeliverable: true,
      reason: '默认保存生成的代码',
      deliverables: [{
        kind: 'code',
        title: 'ST 程序',
        description: '当前工作区中的 ST 程序',
        required: true,
        acceptableEvidence: ['final_artifact'],
        workspaceFileExtension: '.st',
      }],
    }),
    artifacts: [{ kind: 'code', name: 'Pump.st', content: 'PROGRAM Pump\nEND_PROGRAM' }],
  });
  console.log('[completion_gate:6b] 默认代码落盘阻断 =', !gate.passed);
  assert(!gate.passed, '默认代码交付不能只靠内联 artifact 通过');
}

{
  const writeContract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求写入文件',
    deliverables: [{
      kind: 'file',
      title: '写入 yy.txt',
      description: '把内容保存到 yy.txt',
      required: true,
      acceptableEvidence: ['successful_write'],
    }],
  });
  const gate = evaluateCompletionGate({
    userText: '写入 yy.txt',
    finalMessage: '已写入。',
    deliveryContract: writeContract,
    toolResults: [{
      name: 'write_file',
      args: JSON.stringify({ path: 'yy.txt' }),
      result: createToolResult({ ok: true, data: { path: 'yy.txt' }, effect: 'filesystem', risk: 'write' }),
    }],
  });
  console.log('[completion_gate:7] 写入工具证据放行 =', gate.passed);
  assert(gate.passed, '交付契约要求写入时，成功写工具回执应放行');
}

{
  const stContract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求生成并保存 ST 程序',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const gate = evaluateCompletionGate({
    userText: '生成一个 ST 程序',
    finalMessage: '已生成、校验并保存 WaterPumpControl.st。',
    deliveryContract: stContract,
    toolResults: [
      {
        name: 'write_file',
        args: JSON.stringify({ path: 'WaterPumpControl.st', content: 'bad' }),
        order: 1,
        result: createToolResult({
          ok: false,
          error: 'ST 代码在写入前必须先通过 validate_st_code',
          diagnostics: [{ code: 'st_validation_required', message: '未找到当前代码对应的 validate_st_code 成功回执(errorCount=0)。', severity: 'error' }],
          effect: 'none',
          risk: 'plan',
        }),
      },
      {
        name: 'validate_st_code',
        args: JSON.stringify({ code: 'bad' }),
        order: 2,
        result: createToolResult({
          ok: false,
          error: 'ST 校验未通过',
          diagnostics: [{ code: 'E1', message: '语法错误', severity: 'error' }],
          effect: 'none',
          risk: 'plan',
        }),
      },
      {
        name: 'validate_st_code',
        args: JSON.stringify({ code: 'PROGRAM WaterPumpControl\nEND_PROGRAM' }),
        order: 3,
        result: createToolResult({ ok: true, data: { errorCount: 0 }, effect: 'none', risk: 'plan' }),
      },
      {
        name: 'write_file',
        args: '{}',
        order: 4,
        result: createToolResult({
          ok: true,
          data: { file: 'WaterPumpControl.st', bytes: 7081 },
          effect: 'filesystem',
          risk: 'write',
        }),
      },
    ],
  });
  console.log('[completion_gate:8] ST 旧失败被后续交付证据解决 =', gate.passed);
  assert(gate.passed, 'ST 交付后续校验和写入成功后，不应被旧失败继续阻断');
}

{
  const gate = evaluateCompletionGate({
    userText: '解释一下 ST 语言',
    finalMessage: 'ST 是 IEC 61131-3 中的结构化文本语言。',
    toolResults: [],
  });
  console.log('[completion_gate:9] 无契约普通回答不阻断 =', gate.passed);
  assert(gate.passed, '没有交付契约时，普通回答不应被新逻辑阻断');
}

console.log('\ncompletion gate 测试通过');
