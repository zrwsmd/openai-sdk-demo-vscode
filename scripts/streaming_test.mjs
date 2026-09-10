import assert from 'node:assert/strict';
import { AgentEventFactory, AgentStreamAdapter, parseAgentEvent } from './agent.testbundle.mjs';

async function* scriptedEvents() {
  yield { type: 'agent_updated_stream_event', agent: { name: 'Planner' } };
  yield { type: 'raw_model_stream_event', data: { type: 'output_text_delta', delta: '开始检查' } };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_called',
    item: { type: 'tool_call_item', rawItem: { name: 'read_plc_variables', callId: 'call-1', arguments: '{"names":["Motor.Run"]}' } },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_output',
    item: {
      type: 'tool_call_output_item',
      rawItem: { callId: 'call-1' },
      output: [{ type: 'text', text: JSON.stringify({ protocolVersion: 1, ok: true, data: { value: false }, effect: 'none', risk: 'read', diagnostics: [] }) }],
    },
  };
  yield { type: 'agent_updated_stream_event', agent: { name: 'Reviewer' } };
  yield { type: 'raw_model_stream_event', data: { type: 'response.output_text.delta', delta: '完成' } };
}

const events = [];
const stream = scriptedEvents();
stream.state = { usage: { inputTokens: 3, outputTokens: 4, requests: 1 } };
const adapter = new AgentStreamAdapter({
  runId: 'run-stream',
  operationId: 'op-stream',
  eventFactory: new AgentEventFactory('run-stream', 'op-stream'),
  emit: (event) => events.push(event),
});
const result = await adapter.consume(stream);

assert.equal(result.output, '开始检查完成');
assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 4, requests: 1 });
assert.deepEqual(events.map((event) => event.type), [
  'agent.started', 'text.delta', 'tool.started', 'tool.completed',
  'agent.updated', 'text.delta', 'usage.updated',
]);
assert.equal(events[3].payload.result.ok, true);
for (const event of events) parseAgentEvent(event);
for (let i = 1; i < events.length; i += 1) assert.equal(events[i].sequence, events[i - 1].sequence + 1);

const structuredEvents = [];
const structuredStream = scriptedEvents();
structuredStream.state = { usage: { inputTokens: 3, outputTokens: 4, requests: 1 } };
const structuredAdapter = new AgentStreamAdapter({
  runId: 'run-structured',
  operationId: 'op-structured',
  structuredOutput: true,
  eventFactory: new AgentEventFactory('run-structured', 'op-structured'),
  emit: (event) => structuredEvents.push(event),
});
const structuredResult = await structuredAdapter.consume(structuredStream);
assert.equal(structuredResult.output, '开始检查完成');
assert.equal(structuredEvents.some((event) => event.type === 'text.delta'), false);

console.log('streaming adapter tests passed: SDK events, structured tool result, usage');
