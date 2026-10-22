import assert from 'node:assert/strict';
import { Agent, Runner, tool } from '@openai/agents';
import { z } from 'zod';
import {
  ToolRegistry,
  createCoreToolProvider,
  describeSchemaMismatches,
  normalizeToolArguments,
  withToolInputNormalization,
} from './agent.testbundle.mjs';

const clarificationRequests = [];
const coreTools = new ToolRegistry([createCoreToolProvider()]).createTools({
  cfg: {
    baseUrl: 'http://localhost/v1',
    apiKey: 'test',
    model: 'test',
    exportDir: process.cwd(),
    workspaceRoot: process.cwd(),
    clarification: {
      async request(request) {
        clarificationRequests.push(request);
        return {
          requestId: 'normalizer-test',
          cancelled: false,
          answers: { projectType: 'standard' },
        };
      },
    },
  },
});

const clarification = coreTools.find((item) => item.name === 'request_clarification');
assert(clarification);
const rawClarification = JSON.stringify({
  kind: 'plc_task_configuration',
  steps: JSON.stringify([
    {
      id: 'projectType',
      question: '请选择工程类型',
      options: JSON.stringify([
        { id: 'standard', label: '标准工程' },
      ]),
    },
  ]),
});

const normalized = normalizeToolArguments(rawClarification, clarification.parameters);
assert.equal(normalized.changed, true);
const normalizedPayload = JSON.parse(normalized.value);
assert(Array.isArray(normalizedPayload.steps));
assert(Array.isArray(normalizedPayload.steps[0].options));
assert.match(describeSchemaMismatches(rawClarification, clarification.parameters), /steps 当前为字符串/u);

const seen = [];
const approvalInputs = [];
let guardedInput;
const genericTool = tool({
  name: 'generic_nested_container_tool',
  description: 'test',
  parameters: z.object({
    note: z.string(),
    details: z.union([z.string(), z.array(z.string())]),
    payload: z.object({
      items: z.array(z.object({ tags: z.array(z.string()) })),
    }),
  }),
  needsApproval: async (_context, input) => {
    approvalInputs.push(input);
    return false;
  },
  inputGuardrails: [{
    name: 'capture-normalized-input',
    async run({ toolCall }) {
      guardedInput = JSON.parse(toolCall.arguments);
      return { behavior: { type: 'allow' } };
    },
  }],
  execute: async (input) => {
    seen.push(input);
    return JSON.stringify({ ok: true });
  },
});
function singleToolResponse(toolName, argumentsObject) {
  let turn = 0;
  return {
    async getResponse() {
      turn += 1;
      if (turn === 1) {
        return {
          output: [{
            type: 'function_call',
            callId: `normalizer-${toolName}-call`,
            name: toolName,
            status: 'completed',
            arguments: JSON.stringify(argumentsObject),
          }],
          usage: { requests: 1, inputTokens: 0, outputTokens: 0 },
        };
      }
      return {
        output: [{
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'done' }],
        }],
        usage: { requests: 1, inputTokens: 0, outputTokens: 0 },
      };
    },
    async *getStreamedResponse() {},
  };
}

const genericArguments = {
  note: '[this must remain a string]',
  details: '["keep this as a string"]',
  payload: {
    items: JSON.stringify([{ tags: JSON.stringify(['a', 'b']) }]),
  },
};
const runnerModel = withToolInputNormalization(
  singleToolResponse('generic_nested_container_tool', genericArguments),
);
const runnerAgent = new Agent({ name: 'normalizer-runner', model: runnerModel, tools: [genericTool] });
const runnerResult = await new Runner({ tracingDisabled: true }).run(runnerAgent, 'run');
assert.equal(runnerResult.finalOutput, 'done');
assert.equal(seen[0].note, '[this must remain a string]');
assert.equal(seen[0].details, '["keep this as a string"]');
assert.deepEqual(seen[0].payload.items, [{ tags: ['a', 'b'] }]);
assert.deepEqual(guardedInput.payload.items, [{ tags: ['a', 'b'] }]);
assert.deepEqual(approvalInputs[0].payload.items, [{ tags: ['a', 'b'] }]);

let clarificationTurn = 0;
const clarificationModel = withToolInputNormalization({
  async getResponse(request) {
    clarificationTurn += 1;
    if (clarificationTurn === 1) {
      const schema = request.tools.find((item) => item.name === 'request_clarification');
      assert(schema);
      return {
        output: [{
          type: 'function_call',
          callId: 'normalizer-clarification-call',
          name: 'request_clarification',
          status: 'completed',
          arguments: rawClarification,
        }],
        usage: { requests: 1, inputTokens: 0, outputTokens: 0 },
      };
    }
    return {
      output: [{
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'done' }],
      }],
      usage: { requests: 1, inputTokens: 0, outputTokens: 0 },
    };
  },
  async *getStreamedResponse() {},
});
const clarificationAgent = new Agent({
  name: 'clarification-normalizer',
  model: clarificationModel,
  tools: [clarification],
});
const clarificationRun = await new Runner({ tracingDisabled: true }).run(clarificationAgent, 'clarify');
assert.equal(clarificationRun.finalOutput, 'done');
assert(Array.isArray(clarificationRequests[0].steps));
assert(Array.isArray(clarificationRequests[0].steps[0].options));

const streamModel = withToolInputNormalization({
  async getResponse() {
    return { output: [], usage: { requests: 1, inputTokens: 0, outputTokens: 0 } };
  },
  async *getStreamedResponse() {
    yield {
      type: 'response_done',
      response: {
        id: 'stream-normalizer',
        usage: { requests: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        output: [{
          type: 'function_call',
          callId: 'stream-call',
          name: 'generic_nested_container_tool',
          status: 'completed',
          arguments: JSON.stringify({
            note: 'stream',
            details: 'text',
            payload: { items: JSON.stringify([{ tags: JSON.stringify(['s']) }]) },
          }),
        }],
      },
    };
  },
});
const streamedEvents = [];
for await (const event of streamModel.getStreamedResponse({ tools: [{
  type: 'function',
  name: 'generic_nested_container_tool',
  description: 'test',
  parameters: genericTool.parameters,
  strict: true,
}], outputType: { type: 'text' }, handoffs: [], tracing: false })) {
  streamedEvents.push(event);
}
const streamedCall = streamedEvents[0].response.output[0];
assert.deepEqual(JSON.parse(streamedCall.arguments).payload.items, [{ tags: ['s'] }]);

console.log('tool input normalizer tests passed');
