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

async function* extendedEvents() {
  yield { type: 'raw_model_stream_event', data: { type: 'chat.completion.chunk', reasoning_content: 'hidden reasoning' } };
  yield {
    type: 'raw_model_stream_event',
    data: { type: 'response.reasoning_summary_text.delta', item_id: 'reason-summary-1', delta: '检查安全约束' },
  };
  yield {
    type: 'raw_model_stream_event',
    data: { type: 'response.reasoning_summary_text.done', item_id: 'reason-summary-1', text: '检查安全约束' },
  };
  yield {
    type: 'raw_model_stream_event',
    data: { type: 'model', event: { type: 'response.function_call_arguments.delta', call_id: 'call-fn', item_id: 'item-fn', delta: '{"x":' } },
  };
  yield {
    type: 'raw_model_stream_event',
    data: { type: 'response.function_call_arguments.done', call_id: 'call-fn', item_id: 'item-fn', arguments: '{"x":1}' },
  };
  yield {
    type: 'raw_model_stream_event',
    data: { type: 'response.web_search_call.searching', call_id: 'search-1', item_id: 'search-1' },
  };
  yield {
    type: 'raw_model_stream_event',
    data: { type: 'response.shell_call_command.delta', call_id: 'shell-1', item_id: 'shell-1', delta: 'echo ready' },
  };
  yield {
    type: 'raw_model_stream_event',
    data: { type: 'response.output_item.added', item: { type: 'computer_call', id: 'computer-1', call_id: 'computer-1' } },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'reasoning_item_created',
    item: {
      type: 'reasoning_item',
      rawItem: { type: 'reasoning', id: 'reason-1', rawContent: [{ type: 'reasoning_text', text: 'hidden' }] },
    },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'compaction_item_created',
    item: { type: 'compaction_item', rawItem: { type: 'compaction', id: 'compact-1', createdBy: 'model' } },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_search_called',
    item: { type: 'tool_search_call_item', rawItem: { callId: 'search-call', arguments: '{"query":"motor"}' } },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_search_output_created',
    item: { type: 'tool_search_output_item', rawItem: { callId: 'search-call' }, output: { tools: [{ name: 'read_motor' }] } },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_called',
    item: {
      type: 'tool_call_item',
      rawItem: { type: 'computer_call', id: 'computer-1', call_id: 'computer-1', action: { type: 'click', x: 1, y: 2 } },
    },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_output',
    item: {
      type: 'tool_call_output_item',
      rawItem: { type: 'computer_call_result', call_id: 'computer-1', output: { type: 'computer_screenshot', image: 'hidden' } },
    },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_called',
    item: {
      type: 'tool_call_item',
      rawItem: { type: 'shell_call', id: 'shell-1', call_id: 'shell-1', action: { commands: ['echo ready'] } },
    },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_output',
    item: {
      type: 'tool_call_output_item',
      rawItem: {
        type: 'shell_call_output',
        call_id: 'shell-1',
        output: [{ stdout: 'ready', stderr: '', outcome: { type: 'exit', exitCode: 0 } }],
      },
    },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_called',
    item: {
      type: 'tool_call_item',
      rawItem: { type: 'program', id: 'program-1', callId: 'program-1', code: 'return 1', fingerprint: 'fp-1' },
    },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'tool_output',
    item: {
      type: 'tool_call_output_item',
      rawItem: { type: 'program_output', callId: 'program-1', output: 'program failed', status: 'incomplete' },
    },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'input_item_created',
    item: { type: 'run_input_item', rawItem: { type: 'input_item', id: 'input-1' } },
  };
  yield {
    type: 'run_item_stream_event',
    name: 'future_item_created',
    item: { type: 'future_item', rawItem: { type: 'future_item', id: 'future-1', status: 'completed' } },
  };
  yield { type: 'raw_model_stream_event', data: { type: 'response.future.event', item_id: 'future-1' } };
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

const textEvents = [];
const textStream = scriptedEvents();
textStream.state = { usage: { inputTokens: 3, outputTokens: 4, requests: 1 } };
const textAdapter = new AgentStreamAdapter({
  runId: 'run-text',
  operationId: 'op-text',
  structuredOutput: false,
  eventFactory: new AgentEventFactory('run-text', 'op-text'),
  emit: (event) => textEvents.push(event),
});
const textResult = await textAdapter.consume(textStream);
assert.equal(textResult.output, '开始检查完成');
assert.deepEqual(
  textEvents.filter((event) => event.type === 'text.delta').map((event) => event.payload.text),
  ['开始检查', '完成'],
);

const extended = [];
const extendedStream = extendedEvents();
extendedStream.state = { usage: { inputTokens: 10, outputTokens: 20, requests: 2 } };
const extendedAdapter = new AgentStreamAdapter({
  runId: 'run-extended',
  operationId: 'op-extended',
  eventFactory: new AgentEventFactory('run-extended', 'op-extended'),
  emit: (event) => extended.push(event),
});
const extendedResult = await extendedAdapter.consume(extendedStream);
assert.equal(extendedResult.output, '');
for (const event of extended) parseAgentEvent(event);
assert.equal(extended.some((event) => event.type === 'reasoning.updated'
  && event.payload.redacted === true
  && event.payload.summary === undefined), true);
assert.equal(extended.some((event) => event.type === 'reasoning.updated'
  && event.payload.summary === '检查安全约束'
  && event.payload.redacted === false), true);
assert.equal(extended.some((event) => event.type === 'tool.updated'
  && event.payload.kind === 'function'
  && event.payload.argumentsDelta === '{"x":'), true);
assert.equal(extended.some((event) => event.type === 'tool.updated'
  && event.payload.kind === 'web_search'
  && event.payload.status === 'searching'), true);
assert.equal(extended.some((event) => event.type === 'tool.updated'
  && event.payload.kind === 'shell'
  && event.payload.commandsDelta === 'echo ready'), true);
assert.equal(extended.some((event) => event.type === 'tool.started'
  && event.payload.kind === 'computer'
  && event.payload.itemType === 'computer_call'), true);
assert.equal(extended.some((event) => event.type === 'tool.completed'
  && event.payload.kind === 'computer'
  && event.payload.summary === 'computer result received'
  && JSON.stringify(event).includes('hidden') === false), true);
assert.equal(extended.some((event) => event.type === 'tool.completed'
  && event.payload.kind === 'shell'
  && event.payload.ok === true), true);
assert.equal(extended.some((event) => event.type === 'tool.started'
  && event.payload.kind === 'hosted'
  && event.payload.itemType === 'program'), true);
assert.equal(extended.some((event) => event.type === 'tool.completed'
  && event.payload.kind === 'hosted'
  && event.payload.itemType === 'program_output'
  && event.payload.ok === false), true);
assert.equal(extended.some((event) => event.type === 'tool.completed'
  && event.payload.kind === 'tool_search'
  && event.payload.details.toolCount === 1), true);
assert.equal(extended.some((event) => event.type === 'context.compacted'), true);
assert.equal(extended.some((event) => event.type === 'run.input'), true);
assert.equal(extended.some((event) => event.type === 'item.observed'
  && event.payload.itemId === 'future-1'), true);
assert.equal(extended.some((event) => event.type === 'model.event'
  && event.payload.eventType === 'response.future.event'), true);

console.log('streaming adapter tests passed: SDK events, structured tool result, usage');
