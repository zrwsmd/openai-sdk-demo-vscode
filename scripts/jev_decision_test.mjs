import {
  AgentDecisionService,
  JevDecisionProvider,
} from './agent.testbundle.mjs';

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

let calls = 0;
let lastRequest;
const provider = new JevDecisionProvider(
  {
    apiKey: 'test-key',
    model: 'jev-latest',
    timeoutMs: 1_000,
    maxRetries: 0,
  },
  async (url, init) => {
    calls += 1;
    lastRequest = { url, init };
    return response({
      model: 'jev-test',
      answers: {
        delivery: { type: 'noul', noul: 0.96 },
        orchestration: {
          type: 'choice',
          choice: 'single',
          probabilities: { single: 0.94, team: 0.06 },
          confidence: 0.88,
        },
      },
      usage: { input_tokens: 11, output_tokens: 7 },
    });
  },
);

const evaluation = await provider.evaluate({
  state: { request: '读取 yy.txt' },
  questions: {
    delivery: {
      type: 'noul',
      instructions: '是否需要交付物？',
      criteria: { true: '需要', false: '不需要' },
    },
  },
});
if (evaluation.status !== 'ok') throw new Error('Jev success response was not accepted');
if (evaluation.usage?.inputTokens !== 11 || evaluation.answers?.delivery?.noul !== 0.96) {
  throw new Error('Jev response fields were not normalized');
}
if (lastRequest?.url !== 'https://api.typesafe.ai/v1/systemone') {
  throw new Error(`unexpected Jev endpoint: ${lastRequest?.url}`);
}
if (lastRequest?.init?.headers?.Authorization !== 'Bearer test-key') {
  throw new Error('Jev authorization header missing');
}

const savedTypesafeKey = process.env.TYPESAFE_API_KEY;
delete process.env.TYPESAFE_API_KEY;
try {
  const disabled = new JevDecisionProvider({ enabled: true });
  const disabledResult = await disabled.evaluate({
    state: 'offline',
    questions: {
      delivery: { type: 'noul', instructions: 'x' },
    },
  });
  if (disabledResult.status !== 'disabled') {
    throw new Error('missing Jev key should use disabled/fallback status');
  }
} finally {
  if (savedTypesafeKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = savedTypesafeKey;
}

const originalFetch = globalThis.fetch;
let sharedCalls = 0;
globalThis.fetch = async () => {
  sharedCalls += 1;
  return response({
    model: 'jev-test',
    answers: {
      delivery: { type: 'noul', noul: 0.04 },
      orchestration: {
        type: 'choice',
        choice: 'single',
        probabilities: { single: 0.91, team: 0.09 },
        confidence: 0.86,
      },
    },
    usage: { input_tokens: 13, output_tokens: 8 },
  });
};
try {
  const service = new AgentDecisionService();
  const settings = { apiKey: 'test-key', minConfidence: 0.78 };
  const first = await service.taskHint(settings, '查看当前工作区文件');
  const second = await service.taskHint(settings, '查看当前工作区文件');
  if (sharedCalls !== 1) throw new Error(`expected one shared Jev call, got ${sharedCalls}`);
  if (first.delivery !== 'not_required' || first.orchestration !== 'single') {
    throw new Error('Jev task hint did not apply confidence thresholds');
  }
  if (second.evaluation.usage?.inputTokens !== 13) {
    throw new Error('cached Jev task hint changed its result');
  }
} finally {
  globalThis.fetch = originalFetch;
}

if (calls !== 1) throw new Error(`expected one provider call, got ${calls}`);
console.log('jev decision tests passed');
