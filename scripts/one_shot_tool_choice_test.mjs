import assert from 'node:assert/strict';
import {
  requireToolOnce,
  withOneShotToolChoice,
} from './agent.testbundle.mjs';

const requests = [];
const fakeModel = {
  async getResponse(request) {
    requests.push(request);
    return { output: [], usage: { requests: 1, inputTokens: 0, outputTokens: 0 } };
  },
  async *getStreamedResponse(request) {
    requests.push(request);
  },
};

const model = withOneShotToolChoice(fakeModel);
assert.equal(requireToolOnce(model, 'devuni_create_project'), true);
await model.getResponse({ modelSettings: { toolChoice: 'auto' } });
await model.getResponse({ modelSettings: { toolChoice: 'auto' } });
assert.equal(requests[0].modelSettings.toolChoice, 'devuni_create_project');
assert.equal(requests[1].modelSettings.toolChoice, 'auto');

requireToolOnce(model, 'request_clarification');
for await (const _event of model.getStreamedResponse({ modelSettings: {} })) {
  // The fake model emits no events; the request capture is the assertion target.
}
for await (const _event of model.getStreamedResponse({ modelSettings: {} })) {
  // Second request verifies that the constraint was consumed exactly once.
}
assert.equal(requests[2].modelSettings.toolChoice, 'request_clarification');
assert.equal(requests[3].modelSettings.toolChoice, undefined);

console.log('one-shot tool choice tests passed');
