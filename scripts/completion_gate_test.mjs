import {
  createToolResult,
  createDeliveryContract,
  evaluateCompletionGate,
  createStValidationState,
  StWorkspaceDeliveryWorkflow,
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
    userText: '恢复后继续校验',
    finalMessage: '已修复并通过校验。',
    toolResults: [
      { name: 'validate_code', args: '{}', result: failedValidation, order: 1 },
      { name: 'validate_code', args: '{}', result: passedValidation, order: 1 },
    ],
    deliveryContract: validationContract,
  });
  console.log('[completion_gate:4b] 恢复账本重复序号仍按输入顺序解决 =', gate.passed);
  assert(gate.passed, '恢复账本的重复局部序号不应阻断后续成功');
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
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求生成发布包',
    deliverables: [{
      kind: 'file',
      title: '发布包',
      description: '应用发布包',
      required: true,
      acceptableEvidence: ['successful_export'],
      workspacePersistence: 'not_required',
    }],
  });
  const gate = evaluateCompletionGate({
    userText: '生成发布包',
    finalMessage: '发布包已生成。',
    deliveryContract: contract,
    toolEvidence: {
      package_bundle: ['successful_export'],
    },
    toolResults: [{
      name: 'package_bundle',
      args: JSON.stringify({ path: 'release.bundle' }),
      result: createToolResult({
        ok: true,
        data: { file: 'release.bundle' },
        effect: 'filesystem',
        risk: 'write',
      }),
    }],
  });
  console.log('[completion_gate:7b] Provider 能力声明的导出证据放行 =', gate.passed);
  assert(gate.passed, '通用导出工具的能力声明应满足 successful_export 契约');
}

{
  const contract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求写入指定文本文件',
    deliverables: [{
      kind: 'file',
      title: 'a.txt',
      description: '写入 a.txt',
      required: true,
      acceptableEvidence: ['successful_write'],
      workspaceFileExtension: '.txt',
    }],
  });
  const gate = evaluateCompletionGate({
    userText: '写入 a.txt',
    finalMessage: 'a.txt 已写入。',
    deliveryContract: contract,
    toolEvidence: {
      write_file: ['successful_write'],
    },
    toolResults: [
      {
        name: 'write_file',
        args: JSON.stringify({ path: 'a.txt' }),
        order: 1,
        result: createToolResult({
          ok: false,
          error: '目标文件写入失败',
          effect: 'filesystem',
          risk: 'write',
        }),
      },
      {
        name: 'write_file',
        args: JSON.stringify({ path: 'b.txt' }),
        order: 2,
        result: createToolResult({
          ok: true,
          data: { file: 'b.txt' },
          effect: 'filesystem',
          risk: 'write',
        }),
      },
    ],
  });
  console.log('[completion_gate:7c] 其他目标的写入不能消除失败 =', !gate.passed);
  assert(!gate.passed, '另一个文件写入成功不能解决 a.txt 的写入失败');
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
  const stRecords = [
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
      result: createToolResult({
        ok: true,
        data: { errorCount: 0, validatedContentHash: 'validated-content-hash' },
        effect: 'none',
        risk: 'plan',
      }),
    },
    {
      name: 'write_file',
      args: JSON.stringify({ path: 'WaterPumpControl.st', content: 'PROGRAM WaterPumpControl\nEND_PROGRAM' }),
      order: 4,
      result: createToolResult({
        ok: true,
        data: {
          file: 'WaterPumpControl.st',
          bytes: 7081,
          contentHash: 'validated-content-hash',
        },
        effect: 'filesystem',
        risk: 'write',
      }),
    },
  ];
  const stWorkflow = new StWorkspaceDeliveryWorkflow(stContract, createStValidationState());
  stWorkflow.hydrate(stRecords);
  const gate = evaluateCompletionGate({
    userText: '生成一个 ST 程序',
    finalMessage: '已生成、校验并保存 WaterPumpControl.st。',
    workflowAdapter: stWorkflow,
    toolEvidence: {
      write_file: ['successful_write'],
      export_st_program: ['successful_export', 'successful_write'],
    },
    deliveryContract: stContract,
    toolResults: stRecords,
  });
  console.log('[completion_gate:8] ST 旧失败被后续交付证据解决 =', gate.passed);
  assert(gate.passed, 'ST 交付后续校验和写入成功后，不应被旧失败继续阻断');
}

{
  const stContract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求生成并保存 ST 程序',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '当前工作区中的 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  });
  const records = [
    {
      name: 'write_file',
      args: JSON.stringify({ path: 'WaterPumpControl.st', content: 'unvalidated draft' }),
      order: 1,
      result: createToolResult({
        ok: false,
        error: '写入前校验失败',
        effect: 'none',
        risk: 'plan',
      }),
    },
    {
      name: 'validate_st_code',
      args: JSON.stringify({ code: 'PROGRAM Validated\nEND_PROGRAM' }),
      order: 2,
      result: createToolResult({
        ok: true,
        data: { errorCount: 0, validatedContentHash: 'hash-validated' },
        effect: 'none',
        risk: 'plan',
      }),
    },
    {
      name: 'write_file',
      args: JSON.stringify({ path: 'WaterPumpControl.st', content: 'different content' }),
      order: 3,
      result: createToolResult({
        ok: true,
        data: { file: 'WaterPumpControl.st', contentHash: 'hash-different' },
        effect: 'filesystem',
        risk: 'write',
      }),
    },
  ];
  const workflow = new StWorkspaceDeliveryWorkflow(stContract, createStValidationState());
  workflow.hydrate(records);
  const gate = evaluateCompletionGate({
    userText: '生成并保存 ST 程序',
    finalMessage: '已校验并保存 WaterPumpControl.st。',
    deliveryContract: stContract,
    workflowAdapter: workflow,
    toolEvidence: { write_file: ['successful_write'] },
    toolResults: records,
  });
  console.log('[completion_gate:8b] 校验与写入哈希不一致时阻断 =', !gate.passed);
  assert(!gate.passed, 'ST 失败不能被内容哈希不匹配的后续写入掩盖');
}

{
  const genericStFileContract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '普通代码文件落盘',
    deliverables: [{
      kind: 'code',
      title: '源文件',
      description: '源代码文件',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspaceFileExtension: '.st',
    }],
  });
  assert(
    (genericStFileContract.deliverables[0].requiredVerificationTools ?? []).length === 0,
    '通用交付契约不应根据 .st 扩展名注入领域验证工具',
  );
}

{
  const docContract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求说明文档',
    deliverables: [{
      kind: 'text',
      title: '程序运行说明文档',
      description: '程序运行说明文档，描述各功能块用途、变量意义和使用方式',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspacePersistence: 'not_required',
    }],
  });
  const gate = evaluateCompletionGate({
    userText: '生成说明文档',
    finalMessage: '已生成说明文档。',
    toolResults: [],
    deliveryContract: docContract,
    artifacts: [{
      kind: 'file',
      name: 'PumpControl_说明文档.md',
      mimeType: 'text/markdown',
      content: '# 3泵水箱液位控制程序说明文档\n\n## 变量说明\nAutoMode 表示自动模式。',
    }],
  });
  console.log('[completion_gate:9] Markdown 文件 artifact 可作为说明文档 =', gate.passed);
  assert(gate.passed, 'Markdown file artifact 应满足 text/report 类 final_artifact 交付物');
}

{
  const codeArtifactContract = createDeliveryContract({
    requiresDeliverable: true,
    reason: '用户要求内联 ST 程序',
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 ST 控制程序',
      required: true,
      acceptableEvidence: ['final_artifact'],
      workspacePersistence: 'not_required',
      workspaceFileExtension: '.st',
    }],
  });
  const gate = evaluateCompletionGate({
    userText: '生成 ST 程序但不要保存',
    finalMessage: '已生成 ST 程序。',
    toolResults: [],
    deliveryContract: codeArtifactContract,
    artifacts: [{
      kind: 'file',
      name: 'PumpControl.st',
      mimeType: 'text/plain',
      content: 'PROGRAM PumpControl\nEND_PROGRAM',
    }],
  });
  console.log('[completion_gate:10] ST 文件 artifact 可作为代码 =', gate.passed);
  assert(gate.passed, 'ST file artifact 应满足 code 类 final_artifact 交付物');
}

{
  const gate = evaluateCompletionGate({
    userText: '解释一下 ST 语言',
    finalMessage: 'ST 是 IEC 61131-3 中的结构化文本语言。',
    toolResults: [],
  });
  console.log('[completion_gate:11] 无契约普通回答不阻断 =', gate.passed);
  assert(gate.passed, '没有交付契约时，普通回答不应被新逻辑阻断');
}

console.log('\ncompletion gate 测试通过');
