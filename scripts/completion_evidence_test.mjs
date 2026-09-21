import {
  buildCompletionEvidenceSummaries,
} from './agent.testbundle.mjs';

const hash = 'abc1234567890abcdef';

const summary = buildCompletionEvidenceSummaries({
  records: [
    {
      name: 'validate_st_code',
      args: JSON.stringify({ code: 'PROGRAM Demo\nEND_PROGRAM' }),
      result: {
        ok: true,
        data: {
          errorCount: 0,
          warningCount: 0,
          validatedContentHash: hash,
          validationTarget: {
            path: '<inline>',
            complete: true,
            totalLines: 2,
            totalBytes: 24,
            contentHash: hash,
          },
        },
        effect: 'none',
        risk: 'plan',
      },
    },
    {
      name: 'write_file',
      args: JSON.stringify({ path: 'Demo.st', content: 'PROGRAM Demo\nEND_PROGRAM' }),
      result: {
        ok: true,
        data: {
          file: 'Demo.st',
          bytes: 24,
          contentHash: hash,
        },
        effect: 'filesystem',
        risk: 'write',
      },
    },
    {
      name: 'compile_st',
      args: JSON.stringify({ path: 'Demo.st' }),
      result: {
        ok: true,
        data: {
          binaryPath: 'Demo.bin',
          exitCode: 0,
        },
        effect: 'process',
        risk: 'execute',
      },
    },
  ],
  gate: { passed: true },
  artifacts: [],
  deliveredArtifacts: [],
  deliveryContract: {
    requiresDeliverable: true,
    reason: 'test',
    deliverables: [{
      title: 'ST code',
      description: 'PLC source',
      kind: 'code',
      required: true,
      acceptableEvidence: ['successful_write'],
      workspacePersistence: 'required',
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  },
  extractors: [{
    id: 'compile.custom',
    toolNames: ['compile_st'],
    extract: (record, context) => {
      const data = context.helpers.data(record.result);
      return [
        {
          key: 'compile.succeeded',
          value: record.result.ok === true,
          scope: 'domain',
          sourceTool: record.name,
        },
        {
          key: 'compile.binaryPath',
          value: String(data.binaryPath ?? ''),
          scope: 'domain',
          sourceTool: record.name,
        },
      ];
    },
  }],
});

function hasFact(key, value) {
  return summary.facts.some((fact) => fact.key === key && fact.value === value);
}

if (!hasFact('st.validation.passed', true)) {
  throw new Error('missing ST validation fact');
}
if (!hasFact('st.persistence.validationHashMatch', true)) {
  throw new Error('missing ST hash-match fact');
}
if (!hasFact('file.write.persisted', true)) {
  throw new Error('missing generic file write fact');
}
if (!hasFact('compile.succeeded', true)) {
  throw new Error('custom tool extractor did not contribute facts');
}
if (!summary.toolSummaries.some((line) => line.includes('compile.succeeded=true'))) {
  throw new Error('custom tool facts were not rendered in summaries');
}
if (!summary.toolSummaries.some((line) => line.includes('contract.requiredDeliverableCount=1'))) {
  throw new Error('contract facts were not rendered in workflow summary');
}

console.log('completion evidence tests passed');
