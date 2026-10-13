import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  StValidationRuntimeService,
  StWorkspaceDeliveryWorkflow,
  ToolRegistry,
  createCoreToolProvider,
  createStCodeDeliveryContract,
  createStToolProvider,
  createStValidationState,
  setAgentLogger,
} from './agent.testbundle.mjs';

async function withSession(run) {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'st-identity-ws-'));
  const exportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'st-identity-export-'));
  const logs = [];
  setAgentLogger((line) => logs.push(line));
  try {
    const contract = createStCodeDeliveryContract({
      workspacePersistence: 'required',
    });
    const service = new StValidationRuntimeService(createStValidationState());
    const workflow = new StWorkspaceDeliveryWorkflow(contract, service);
    const tools = new ToolRegistry([
      createCoreToolProvider(),
      createStToolProvider(),
    ]).createTools({
      cfg: {
        baseUrl: 'http://localhost/v1',
        apiKey: 'test',
        model: 'test',
        exportDir,
        workspaceRoot,
        workspaceRoots: [workspaceRoot],
      },
      userText: '生成 ST 程序并保存到工作区',
      workflowContract: contract,
      workflow,
    });
    const findTool = (name) => {
      const found = tools.find((tool) => tool.name === name);
      assert(found, `missing tool: ${name}`);
      return found;
    };
    const invoke = async (name, input) =>
      JSON.parse(await findTool(name).invoke({}, JSON.stringify(input)));
    const fileExists = async (relativePath) =>
      fs.access(path.join(workspaceRoot, relativePath)).then(
        () => true,
        () => false,
      );
    await run({ invoke, service, workspaceRoot, fileExists, logs });
  } finally {
    setAgentLogger(() => {});
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.rm(exportDir, { recursive: true, force: true });
  }
}

function describeDeclaration(declaration) {
  if (declaration.category === 'type') {
    return `TYPE ${declaration.kind} ${declaration.name}`;
  }
  return `${declaration.kind} ${declaration.name}`;
}

function assertRejectedLog(logs, { target, tool, expected, actual, label }) {
  const expectedText = describeDeclaration(expected);
  const actualText = describeDeclaration(actual);
  const found = logs.find((line) =>
    line.includes('[st-validation] rejected') &&
    line.includes(`target=${target}`) &&
    line.includes(`expectedDeclaration=${expectedText}`) &&
    line.includes(`actualDeclaration=${actualText}`) &&
    (tool ? line.includes(`tool=${tool}`) : !line.includes('tool=')),
  );
  assert(found, `${label} 应写入 rejected 日志`);
}

function assertIdentityMismatch(result, expected, actual, label, risk) {
  assert.equal(result.ok, false, `${label} 应被拦截`);
  assert.equal(result.effect, 'none', `${label} 不得产生副作用`);
  assert.equal(result.risk, risk, `${label} risk 应为 ${risk}`);
  const diagnostic = (result.diagnostics ?? []).find(
    (item) => item.code === 'st_draft_identity_mismatch',
  );
  assert(diagnostic, `${label} 应返回 st_draft_identity_mismatch`);
  const identity = result.data?.draftIdentity ?? result.data;
  assert.deepEqual(
    identity?.expectedDeclaration ?? identity,
    expected,
    `${label} 应带上已锁定声明`,
  );
  assert.deepEqual(
    identity?.actualDeclaration,
    actual,
    `${label} 应带上实际声明`,
  );
  assert.match(
    result.error ?? diagnostic.message ?? '',
    /目标声明/u,
    `${label} 错误信息应描述声明不一致`,
  );
}

const genericCases = [
  {
    label: 'FUNCTION_BLOCK',
    first: 'FUNCTION_BLOCK MotorControl\nEND_FUNCTION_BLOCK',
    other: 'FUNCTION_BLOCK ProbeBlock\nEND_FUNCTION_BLOCK',
    expected: { category: 'pou', kind: 'FUNCTION_BLOCK', name: 'MOTORCONTROL' },
    actual: { category: 'pou', kind: 'FUNCTION_BLOCK', name: 'PROBEBLOCK' },
    otherPath: 'ProbeBlock.st',
  },
  {
    label: 'FUNCTION',
    first: 'FUNCTION Scale : REAL\nEND_FUNCTION',
    other: 'FUNCTION ProbeFunction : REAL\nEND_FUNCTION',
    expected: { category: 'pou', kind: 'FUNCTION', name: 'SCALE' },
    actual: { category: 'pou', kind: 'FUNCTION', name: 'PROBEFUNCTION' },
    otherPath: 'ProbeFunction.st',
  },
  {
    label: 'TYPE alias',
    first: 'TYPE\n  PressureValue : REAL;\nEND_TYPE',
    other: 'TYPE\n  ProbeValue : REAL;\nEND_TYPE',
    expected: { category: 'type', kind: 'TYPE_ALIAS', name: 'PRESSUREVALUE' },
    actual: { category: 'type', kind: 'TYPE_ALIAS', name: 'PROBEVALUE' },
    otherPath: 'ProbeValue.st',
  },
];

for (const item of genericCases) {
  await withSession(async ({ invoke, service, fileExists, logs }) => {
    const firstValidate = await invoke('validate_st_code', { code: item.first });
    assert.deepEqual(
      service.state.draftIdentity?.declaration,
      item.expected,
      `${item.label} 首次校验应锁定声明身份`,
    );
    assert.notEqual(
      firstValidate.data?.draftIdentity?.expectedDeclaration?.name,
      item.actual.name,
      `${item.label} 首次校验不得误锁成后续探针名`,
    );

    const secondValidate = await invoke('validate_st_code', { code: item.other });
    assertIdentityMismatch(
      secondValidate,
      item.expected,
      item.actual,
      `${item.label} validate_st_code`,
      'plan',
    );
    assertRejectedLog(logs, {
      target: '<inline st code>',
      expected: item.expected,
      actual: item.actual,
      label: `${item.label} validate_st_code`,
    });

    const writeResult = await invoke('write_file', {
      path: item.otherPath,
      content: item.other,
    });
    assertIdentityMismatch(
      writeResult,
      item.expected,
      item.actual,
      `${item.label} write_file`,
      'write',
    );
    assertRejectedLog(logs, {
      target: item.otherPath,
      tool: 'write_file',
      expected: item.expected,
      actual: item.actual,
      label: `${item.label} write_file`,
    });
    assert.equal(
      await fileExists(item.otherPath),
      false,
      `${item.label} 被拒写入不得落盘`,
    );
  });
}

await withSession(async ({ invoke, service, fileExists, logs }) => {
  const probe = 'PROGRAM Probe5\nEND_PROGRAM\n';
  const official = 'PROGRAM PressureFilterScale\nEND_PROGRAM\n';
  const expected = { category: 'pou', kind: 'PROGRAM', name: 'PROBE5' };
  const actual = { category: 'pou', kind: 'PROGRAM', name: 'PRESSUREFILTERSCALE' };
  const firstValidate = await invoke('validate_st_code', { code: probe });
  assert.equal(firstValidate.ok, true, 'PROGRAM 探针草稿应能通过 fallback 校验');
  assert.deepEqual(service.state.draftIdentity?.declaration, expected);

  const officialValidate = await invoke('validate_st_code', { code: official });
  assertIdentityMismatch(
    officialValidate,
    expected,
    actual,
    '首个提交是 Probe 后的 validate_st_code',
    'plan',
  );
  assertRejectedLog(logs, {
    target: '<inline st code>',
    expected,
    actual,
    label: '首个提交是 Probe 后的 validate_st_code',
  });

  const officialWrite = await invoke('write_file', {
    path: 'PressureFilterScale.st',
    content: official,
  });
  assertIdentityMismatch(
    officialWrite,
    expected,
    actual,
    '首个提交是 Probe 后的 write_file',
    'write',
  );
  assertRejectedLog(logs, {
    target: 'PressureFilterScale.st',
    tool: 'write_file',
    expected,
    actual,
    label: '首个提交是 Probe 后的 write_file',
  });
  assert.equal(await fileExists('PressureFilterScale.st'), false);
});

await withSession(async ({ invoke, service, fileExists, logs }) => {
  const probe = 'PROGRAM Probe1\nEND_PROGRAM\n';
  const official = 'PROGRAM PressureFilterScale\nEND_PROGRAM\n';
  const expected = { category: 'pou', kind: 'PROGRAM', name: 'PROBE1' };
  const actual = { category: 'pou', kind: 'PROGRAM', name: 'PRESSUREFILTERSCALE' };
  const probeWrite = await invoke('write_file', {
    path: 'Probe1.st',
    content: probe,
  });
  assert.equal(probeWrite.ok, true, '无预校验时���个 PROGRAM 写入可以先锁定身份');
  assert.deepEqual(service.state.draftIdentity?.declaration, expected);
  assert.equal(await fileExists('Probe1.st'), true);

  const officialValidate = await invoke('validate_st_code', { code: official });
  assertIdentityMismatch(
    officialValidate,
    expected,
    actual,
    'write_file 先提交 Probe 后的 validate_st_code',
    'plan',
  );

  const officialWrite = await invoke('write_file', {
    path: 'PressureFilterScale.st',
    content: official,
  });
  assertIdentityMismatch(
    officialWrite,
    expected,
    actual,
    'write_file 先提交 Probe 后的正式写入',
    'write',
  );
  assertRejectedLog(logs, {
    target: 'PressureFilterScale.st',
    tool: 'write_file',
    expected,
    actual,
    label: 'write_file 先提交 Probe 后的正式写入',
  });
  assert.equal(await fileExists('PressureFilterScale.st'), false);
});

console.log('st draft identity tool tests passed');
