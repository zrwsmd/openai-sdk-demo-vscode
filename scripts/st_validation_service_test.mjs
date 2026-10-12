import assert from 'node:assert/strict';
import {
  createStValidationState,
  createToolResult,
  createWorkflowRuntimeState,
  getStValidationRuntimeService,
  identifyStDeclarations,
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

console.log('st validation runtime service tests passed');
