import assert from 'node:assert/strict';
import {
  AGENT_PROTOCOL_VERSION,
  AgentEventFactory,
  agentEventSchema,
  createAgentEvent,
  createAgentResult,
  createToolResult,
  parseAgentEvent,
  parseAgentResult,
  parseToolResult,
} from './agent.testbundle.mjs';

const textEvent = createAgentEvent({
  type: 'text.delta',
  runId: 'run-1',
  operationId: 'op-1',
  sequence: 3,
  payload: { text: '正在检查 PLC' },
});
assert.equal(textEvent.protocolVersion, AGENT_PROTOCOL_VERSION);
assert.equal(textEvent.source, 'model');
assert.equal(parseAgentEvent(textEvent).payload.text, '正在检查 PLC');

const mcpEvent = createAgentEvent({
  type: 'tool.started',
  runId: 'run-1',
  sequence: 4,
  source: 'mcp',
  payload: { toolName: 'read_device_state', serverId: 'plc-sim' },
});
assert.equal(mcpEvent.source, 'mcp');
assert.equal(agentEventSchema.parse(mcpEvent).payload.serverId, 'plc-sim');

const reasoningEvent = createAgentEvent({
  type: 'reasoning.updated',
  runId: 'run-1',
  sequence: 5,
  payload: {
    itemId: 'reasoning-1',
    status: 'in_progress',
    characterCount: 18,
    redacted: true,
  },
});
assert.equal(reasoningEvent.payload.redacted, true);
assert.equal(reasoningEvent.payload.summary, undefined);

const toolUpdate = createAgentEvent({
  type: 'tool.updated',
  runId: 'run-1',
  sequence: 6,
  source: 'tool',
  payload: {
    toolName: 'shell',
    kind: 'shell',
    itemType: 'shell_call',
    status: 'in_progress',
    commandsDelta: 'echo ready',
  },
});
assert.equal(agentEventSchema.parse(toolUpdate).payload.kind, 'shell');

const inputEvent = createAgentEvent({
  type: 'run.input',
  runId: 'run-1',
  sequence: 7,
  payload: { itemId: 'input-1', itemType: 'input_item', status: 'completed' },
});
const compactionEvent = createAgentEvent({
  type: 'context.compacted',
  runId: 'run-1',
  sequence: 8,
  payload: { itemId: 'compact-1', itemType: 'compaction', status: 'completed' },
});
const observedEvent = createAgentEvent({
  type: 'item.observed',
  runId: 'run-1',
  sequence: 9,
  payload: { itemType: 'unknown', itemId: 'future-1' },
});
const modelEvent = createAgentEvent({
  type: 'model.event',
  runId: 'run-1',
  sequence: 10,
  payload: { eventType: 'response.future.event', category: 'unknown' },
});
for (const event of [reasoningEvent, toolUpdate, inputEvent, compactionEvent, observedEvent, modelEvent]) {
  parseAgentEvent(event);
}

const events = new AgentEventFactory('run-2', 'op-2', 7);
assert.equal(events.next({ type: 'agent.started', payload: { agentName: 'Planner' } }).sequence, 7);
assert.equal(events.next({ type: 'text.delta', payload: { text: '开始' } }).sequence, 8);
assert.equal(events.nextSequence, 9);

assert.throws(() => parseAgentEvent({
  ...textEvent,
  sequence: -1,
}));

const tool = createToolResult({
  ok: true,
  data: { value: 1 },
  effect: 'none',
  risk: 'read',
});
assert.equal(tool.protocolVersion, 1);
assert.deepEqual(parseToolResult(tool).data, { value: 1 });
assert.throws(() => parseToolResult({ ok: true, data: {} }));

const result = createAgentResult({
  status: 'completed',
  output: { message: '完成' },
  usage: { inputTokens: 4, outputTokens: 5, requests: 1 },
});
assert.equal(result.protocolVersion, 1);
assert.deepEqual(parseAgentResult(result).output, { message: '完成' });
assert.deepEqual(result.diagnostics, []);
assert.deepEqual(result.artifacts, []);
assert.throws(() => parseAgentResult({ status: 'awaiting_approval', approvals: [] }));
assert.throws(() => parseAgentResult({ status: 'failed' }));

console.log('protocol tests passed: versioned events, MCP-ready source, typed results');
