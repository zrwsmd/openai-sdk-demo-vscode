import assert from 'node:assert/strict';
import {
  createStValidationState,
  createToolResult,
  createWorkflowRuntimeState,
  getStValidationRuntimeService,
  hashStContent,
  StValidationRuntimeService,
} from './agent.testbundle.mjs';

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

const restoredCode = 'PROGRAM Restored\nEND_PROGRAM';
const restoredHash = hashStContent(restoredCode);
const restoredWrite = 'PROGRAM Written\nEND_PROGRAM';
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

console.log('st validation runtime service tests passed');
