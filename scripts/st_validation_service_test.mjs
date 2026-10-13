import assert from 'node:assert/strict';
import {
  createStValidationState,
  createToolResult,
  createWorkflowRuntimeState,
  describeStDeclaration,
  getStValidationRuntimeService,
  identifyStDeclarations,
  identifyStDraft,
  hashStContent,
  StValidationRuntimeService,
  StWorkspaceDeliveryWorkflow,
  createStCodeDeliveryContract,
} from './agent.testbundle.mjs';

const declarations = identifyStDeclarations(`
(* PROGRAM FakeInComment END_PROGRAM *)
PROGRAM Main
END_PROGRAM
FUNCTION_BLOCK Motor
END_FUNCTION_BLOCK
FUNCTION Scale : REAL
END_FUNCTION
TYPE
  AliasValue : DINT;
  MotorState : STRUCT
    Running : BOOL;
  END_STRUCT;
  AlarmCode : (None, High, Low);
END_TYPE
`);
assert.deepEqual(
  declarations.map(({ category, kind, name }) => ({ category, kind, name })),
  [
    { category: 'pou', kind: 'PROGRAM', name: 'MAIN' },
    { category: 'pou', kind: 'FUNCTION_BLOCK', name: 'MOTOR' },
    { category: 'pou', kind: 'FUNCTION', name: 'SCALE' },
    { category: 'type', kind: 'TYPE_ALIAS', name: 'ALIASVALUE' },
    { category: 'type', kind: 'STRUCT', name: 'MOTORSTATE' },
    { category: 'type', kind: 'ENUM', name: 'ALARMCODE' },
  ],
);

const code = 'PROGRAM Pump\nEND_PROGRAM';
const codeHash = hashStContent(code);
const runtimeState = createWorkflowRuntimeState();
const service = getStValidationRuntimeService(runtimeState);

assert.equal(service, getStValidationRuntimeService(runtimeState));
assert.equal(service.validationInputMode, 'inline_code');
assert.equal(service.canWriteContent(code), false);

service.recordSuccessfulValidation(code, codeHash);
assert.equal(service.hasValidatedContent(code), true);
assert.equal(service.canWriteContent(code), true);
assert.equal(service.lastValidatedContentHash, codeHash);
assert.equal(service.canWriteContent(`${code}\n`), false);
assert.deepEqual(service.getValidationCandidates()[0], {
  hash: codeHash,
  declarations: [{ category: 'pou', kind: 'PROGRAM', name: 'PUMP', line: 1 }],
  status: 'passed',
  errorCount: 0,
  source: 'manual',
  sequence: 1,
});

const restoredCode = 'PROGRAM Restored\nEND_PROGRAM';
const restoredHash = hashStContent(restoredCode);
const restoredWrite = 'PROGRAM Restored\nVAR\n    x : INT;\nEND_VAR\nx := 1;\nEND_PROGRAM';
const restoredWriteHash = hashStContent(restoredWrite);
const restored = new StValidationRuntimeService(createStValidationState());

restored.restore([
  {
    name: 'validate_st_code',
    args: JSON.stringify({ code: restoredCode }),
    result: createToolResult({
      ok: true,
      data: { errorCount: 0, validatedContentHash: restoredHash },
      effect: 'none',
      risk: 'plan',
    }),
  },
  {
    name: 'write_file',
    args: JSON.stringify({
      path: 'Written.st',
      content: restoredWrite,
    }),
    result: createToolResult({
      ok: true,
      data: {
        contentHash: restoredWriteHash,
        preWriteValidation: {
          errorCount: 0,
          validatedContentHash: restoredWriteHash,
        },
      },
      effect: 'filesystem',
      risk: 'write',
    }),
  },
]);

assert.equal(restored.hasValidatedContent(restoredCode), true);
assert.equal(restored.hasValidatedContent(restoredWrite), true);
assert.equal(restored.canWriteContent(restoredWrite), true);
assert.equal(restored.lastValidatedContentHash, restoredWriteHash);
assert(
  restored.getValidationCandidates().every((candidate) =>
    candidate.declarations.every((item) => item.category && item.kind && item.name),
  ),
  '恢复的 ST 候选应保留可扩展声明信息',
);

const unrelated = 'PROGRAM Probe\nEND_PROGRAM';
assert.equal(restored.recordValidationAttempt(unrelated).accepted, false);
assert.equal(restored.recordSuccessfulValidation(unrelated, hashStContent(unrelated)), false);
assert.equal(restored.hasValidatedContent(unrelated), false);

const genericDeclarationCases = [
  {
    label: 'FUNCTION_BLOCK',
    first: 'FUNCTION_BLOCK MotorControl\nEND_FUNCTION_BLOCK',
    same: 'FUNCTION_BLOCK MotorControl\nVAR\n  enabled : BOOL;\nEND_VAR\nEND_FUNCTION_BLOCK',
    other: 'FUNCTION_BLOCK ProbeBlock\nEND_FUNCTION_BLOCK',
    identity: { category: 'pou', kind: 'FUNCTION_BLOCK', name: 'MOTORCONTROL' },
  },
  {
    label: 'FUNCTION',
    first: 'FUNCTION Scale : REAL\nEND_FUNCTION',
    same: 'FUNCTION Scale : REAL\nVAR_INPUT\n  value : REAL;\nEND_VAR\nEND_FUNCTION',
    other: 'FUNCTION ProbeFunction : REAL\nEND_FUNCTION',
    identity: { category: 'pou', kind: 'FUNCTION', name: 'SCALE' },
  },
  {
    label: 'TYPE alias',
    first: 'TYPE\n  PressureValue : REAL;\nEND_TYPE',
    same: 'TYPE\n  PressureValue : REAL;\n  PressureLimit : REAL;\nEND_TYPE',
    other: 'TYPE\n  ProbeValue : REAL;\nEND_TYPE',
    identity: { category: 'type', kind: 'TYPE_ALIAS', name: 'PRESSUREVALUE' },
  },
];
for (const item of genericDeclarationCases) {
  const genericService = new StValidationRuntimeService(createStValidationState());
  const firstIdentity = identifyStDraft(item.first);
  assert.deepEqual(
    firstIdentity?.declaration,
    item.identity,
    `${item.label} 应生成通用声明身份`,
  );
  assert.equal(
    describeStDeclaration(firstIdentity?.declaration),
    `${item.identity.kind === 'TYPE_ALIAS' ? 'TYPE ' : ''}${item.identity.kind} ${item.identity.name}`,
  );
  assert.equal(
    genericService.recordValidationAttempt(item.first).accepted,
    true,
    `${item.label} 首次声明应建立锁定`,
  );
  assert.equal(
    genericService.recordValidationAttempt(item.same).accepted,
    true,
    `${item.label} 同身份修正版应允许继续`,
  );
  assert.equal(
    genericService.recordValidationAttempt(item.other).accepted,
    false,
    `${item.label} 不同声明不应冒充当前交付目标`,
  );
}

const legacyIdentityState = createStValidationState();
legacyIdentityState.draftIdentity = { programName: 'LegacyProgram' };
const legacyIdentityService = new StValidationRuntimeService(legacyIdentityState);
assert.deepEqual(
  legacyIdentityService.state.draftIdentity,
  {
    declaration: {
      category: 'pou',
      kind: 'PROGRAM',
      name: 'LEGACYPROGRAM',
    },
  },
  '旧 PROGRAM 身份账本应升级为通用声明身份',
);
assert.equal(
  legacyIdentityService.checkDraftIdentity('PROGRAM LegacyProgram\nEND_PROGRAM').accepted,
  true,
  '升级后的旧 PROGRAM 身份仍应保持原有锁定语义',
);

const deliveryService = new StValidationRuntimeService(createStValidationState());
const targetCode = 'PROGRAM PressureFilterScale\nEND_PROGRAM';
deliveryService.recordValidationAttempt(targetCode);
deliveryService.recordSuccessfulValidation(targetCode, hashStContent(targetCode));
const deliveryWorkflow = new StWorkspaceDeliveryWorkflow(
  createStCodeDeliveryContract({ workspacePersistence: 'required' }),
  deliveryService,
);
const probeCode = 'PROGRAM Probe5\nEND_PROGRAM';
const probeHash = hashStContent(probeCode);
const probeRecords = [
  {
    name: 'validate_st_code',
    args: JSON.stringify({ code: probeCode }),
    result: createToolResult({
      ok: true,
      data: { errorCount: 0, validatedContentHash: probeHash },
      effect: 'none',
      risk: 'plan',
    }),
  },
  {
    name: 'write_file',
    args: JSON.stringify({ path: 'probe-out/Probe5.st', content: probeCode }),
    result: createToolResult({
      ok: true,
      data: {
        file: 'probe-out/Probe5.st',
        contentHash: probeHash,
      },
      effect: 'filesystem',
      risk: 'write',
    }),
  },
];
assert.equal(deliveryWorkflow.completionAdapter.finalMessage?.(probeRecords), undefined);
assert.equal(
  deliveryWorkflow.completionAdapter.collectActionArtifact?.(probeRecords[1]),
  undefined,
);

const persistedTarget = deliveryService.recordSuccessfulWrite({
  path: 'out/PressureFilterScale.st',
  content: targetCode,
  contentHash: hashStContent(targetCode),
  source: 'write_file',
});
assert(persistedTarget, '通过校验的正式 ST 写入应进入持久化账本');
const deliveryCommit = deliveryService.recordDeliveryCommit({
  path: 'out/PressureFilterScale.st',
  contentHash: hashStContent(targetCode),
});
assert(deliveryCommit, '正式交付应基于实际写入记录创建 commit');
const committedRecords = [
  {
    name: 'validate_st_code',
    args: JSON.stringify({ code: targetCode }),
    result: createToolResult({
      ok: true,
      data: { errorCount: 0, validatedContentHash: hashStContent(targetCode) },
      effect: 'none',
      risk: 'plan',
    }),
  },
  {
    name: 'write_file',
    args: JSON.stringify({
      path: 'out/PressureFilterScale.st',
      content: targetCode,
    }),
    result: createToolResult({
      ok: true,
      data: {
        file: 'out/PressureFilterScale.st',
        contentHash: hashStContent(targetCode),
        stPersistence: {
          status: 'persisted',
          path: 'out/PressureFilterScale.st',
          contentHash: hashStContent(targetCode),
        },
      },
      effect: 'filesystem',
      risk: 'write',
    }),
  },
  {
    name: 'commit_st_delivery',
    args: JSON.stringify({
      path: 'out/PressureFilterScale.st',
      contentHash: hashStContent(targetCode),
    }),
    result: createToolResult({
      ok: true,
      data: { deliveryCommit },
      effect: 'none',
      risk: 'plan',
    }),
  },
];
assert.match(
  deliveryWorkflow.completionAdapter.finalMessage?.(committedRecords) ?? '',
  /正式交付/u,
);
assert(
  deliveryWorkflow.completionAdapter.collectActionArtifact?.(committedRecords[2]),
  '正式交付 commit 应成为 workflow artifact',
);

const staleCommitService = new StValidationRuntimeService(createStValidationState());
const firstDeliveryCode = 'PROGRAM SharedDelivery\nx := 1;\nEND_PROGRAM';
const firstDeliveryHash = hashStContent(firstDeliveryCode);
staleCommitService.recordSuccessfulValidation(firstDeliveryCode, firstDeliveryHash);
assert(
  staleCommitService.recordSuccessfulWrite({
    path: 'out/first.st',
    content: firstDeliveryCode,
    contentHash: firstDeliveryHash,
    source: 'write_file',
  }),
  '第一份有效写入应进入持久化账本',
);
const secondDeliveryCode = 'PROGRAM SharedDelivery\nx := 2;\nEND_PROGRAM';
const secondDeliveryHash = hashStContent(secondDeliveryCode);
staleCommitService.recordSuccessfulValidation(secondDeliveryCode, secondDeliveryHash);
assert(
  staleCommitService.recordSuccessfulWrite({
    path: 'out/second.st',
    content: secondDeliveryCode,
    contentHash: secondDeliveryHash,
    source: 'write_file',
  }),
  '第二份有效写入应进入持久化账本',
);
assert.equal(
  staleCommitService.recordDeliveryCommit({
    path: 'out/first.st',
    contentHash: firstDeliveryHash,
  }),
  undefined,
  '正式 commit 不能回指本轮更早的旧写入',
);
assert(
  staleCommitService.recordDeliveryCommit({
    path: 'out/second.st',
    contentHash: secondDeliveryHash,
  }),
  '正式 commit 应只接受最新有效写入',
);

console.log('st validation runtime service tests passed');
