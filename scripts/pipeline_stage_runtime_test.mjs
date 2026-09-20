import {
  PipelineStageRuntime,
  ST_WORKSPACE_DELIVERY_PIPELINE_PLAN,
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
    new Set(['write_file']),
  );
  if (decision?.toolName !== 'write_file') {
    throw new Error('ST pipeline transition did not choose write_file');
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

console.log('[pipeline_stage_runtime_test] ok');
