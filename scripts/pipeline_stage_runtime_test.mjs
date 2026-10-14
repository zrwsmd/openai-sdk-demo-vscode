import {
  PipelineStageRuntime,
  ST_WORKSPACE_DELIVERY_PIPELINE_PLAN,
  ST_WORKSPACE_DELIVERY_TURN_BUDGET,
} from './agent.testbundle.mjs';

{
  const runtime = new PipelineStageRuntime({
    id: 'custom_flow',
    resultTransitions: [{
      fromToolName: 'compile_draft',
      toToolName: 'upload_binary',
      reason: 'compile passed, upload next',
      canTransition: (result) => result.ok && result.data?.exitCode === 0,
    }],
    duplicateToolFingerprints: [{
      toolName: 'compile_draft',
      fingerprint: (event) => event.args ? `compile:${event.args}` : undefined,
    }],
  });
  const decision = runtime.nextToolAfterResult(
    'compile_draft',
    { ok: true, data: { exitCode: 0 }, diagnostics: [], effect: 'none', risk: 'plan' },
    new Set(['upload_binary']),
  );
  if (decision?.toolName !== 'upload_binary') {
    throw new Error('generic pipeline transition did not choose upload_binary');
  }
  const firstVisible = runtime.shouldSuppressStarted({
    toolName: 'compile_draft',
    args: '{"target":"plc"}',
    callId: 'call-1',
  });
  const secondSuppressed = runtime.shouldSuppressStarted({
    toolName: 'compile_draft',
    args: '{"target":"plc"}',
    callId: 'call-2',
  });
  if (firstVisible || !secondSuppressed || !runtime.shouldSuppressCompleted('call-2')) {
    throw new Error('generic pipeline duplicate suppression failed');
  }
}

{
  const runtime = new PipelineStageRuntime(ST_WORKSPACE_DELIVERY_PIPELINE_PLAN);
  const decision = runtime.nextToolAfterResult(
    'validate_st_code',
    {
      ok: true,
      data: { errorCount: 0, validatedContentHash: 'abc' },
      diagnostics: [],
      effect: 'none',
      risk: 'plan',
    },
    new Set(['commit_st_delivery']),
  );
  if (decision?.toolName !== 'commit_st_delivery') {
    throw new Error('ST pipeline transition did not choose commit_st_delivery');
  }
  const repairDecision = runtime.nextToolAfterResult(
    'validate_st_code',
    {
      ok: false,
      error: 'ST 校验未通过',
      data: { errorCount: 3 },
      diagnostics: [],
      effect: 'none',
      risk: 'plan',
    },
    new Set(['validate_st_code', 'write_file', 'st_dependency_map']),
  );
  if (repairDecision?.toolName !== 'validate_st_code') {
    throw new Error('ST pipeline failed validation did not force validate_st_code repair');
  }
  const commitDecision = runtime.nextToolAfterResult(
    'commit_st_delivery',
    {
      ok: true,
      data: {
        deliveryAuthorization: {
          path: 'PumpControl.st',
          contentHash: 'abc',
        },
      },
      diagnostics: [],
      effect: 'none',
      risk: 'plan',
    },
    new Set(['write_file']),
  );
  if (commitDecision?.toolName !== 'write_file') {
    throw new Error('ST pipeline authorization did not force write_file');
  }
  const firstVisible = runtime.shouldSuppressStarted({
    toolName: 'validate_st_code',
    args: JSON.stringify({ code: 'PROGRAM Demo\nEND_PROGRAM' }),
    callId: 'st-1',
  });
  const secondSuppressed = runtime.shouldSuppressStarted({
    toolName: 'validate_st_code',
    args: JSON.stringify({ code: 'PROGRAM Demo\nEND_PROGRAM' }),
    callId: 'st-2',
  });
  if (firstVisible || !secondSuppressed || !runtime.shouldSuppressCompleted('st-2')) {
    throw new Error('ST pipeline duplicate suppression failed');
  }
}

{
  const baseContext = {
    currentTurn: 10,
    currentLimit: 10,
    softLimit: 10,
    hardLimit: 20,
    completed: false,
    progressToolNames: new Set([
      'validate_st_code',
      'commit_st_delivery',
      'write_file',
      'matiec_compile',
    ]),
  };
  const stageRecord = (name, result, args = '{}') => ({
    name,
    args,
    result: {
      diagnostics: [],
      effect: 'none',
      risk: 'plan',
      ...result,
    },
  });

  const successfulFutureStage = ST_WORKSPACE_DELIVERY_TURN_BUDGET.evaluateAtSoftLimit({
    ...baseContext,
    records: [
      stageRecord('matiec_compile', {
        ok: true,
        data: { exitCode: 0, artifact: 'plc.c' },
      }),
    ],
  });
  if (successfulFutureStage.action !== 'continue') {
    throw new Error('ST turn budget should continue after a successful future stage');
  }

  const changingFailure = ST_WORKSPACE_DELIVERY_TURN_BUDGET.evaluateAtSoftLimit({
    ...baseContext,
    records: [
      stageRecord('validate_st_code', {
        ok: false,
        error: 'syntax error near IF',
        data: { errorCount: 1 },
        diagnostics: [{
          code: 'ST_SYNTAX',
          severity: 'error',
          message: 'syntax error near IF',
        }],
      }),
      stageRecord('validate_st_code', {
        ok: false,
        error: 'missing END_IF',
        data: { errorCount: 1 },
        diagnostics: [{
          code: 'ST_SYNTAX',
          severity: 'error',
          message: 'missing END_IF',
        }],
      }),
    ],
  });
  if (changingFailure.action !== 'continue') {
    throw new Error('ST turn budget should continue when diagnostics change');
  }

  const repeatedFailure = ST_WORKSPACE_DELIVERY_TURN_BUDGET.evaluateAtSoftLimit({
    ...baseContext,
    records: [
      stageRecord('validate_st_code', {
        ok: false,
        error: 'missing END_IF',
        data: { errorCount: 1 },
        diagnostics: [{
          code: 'ST_SYNTAX',
          severity: 'error',
          message: 'missing END_IF',
        }],
      }),
      stageRecord('validate_st_code', {
        ok: false,
        error: 'missing END_IF',
        data: { errorCount: 1 },
        diagnostics: [{
          code: 'ST_SYNTAX',
          severity: 'error',
          message: 'missing END_IF',
        }],
      }),
    ],
  });
  if (repeatedFailure.action !== 'pause') {
    throw new Error('ST turn budget should pause after repeated identical failure');
  }

  const noStageEvidence = ST_WORKSPACE_DELIVERY_TURN_BUDGET.evaluateAtSoftLimit({
    ...baseContext,
    records: [
      stageRecord('st_dependency_map', {
        ok: true,
        data: { files: [] },
      }),
    ],
  });
  if (noStageEvidence.action !== 'pause') {
    throw new Error('ST turn budget should pause without stage evidence');
  }
}

console.log('[pipeline_stage_runtime_test] ok');
