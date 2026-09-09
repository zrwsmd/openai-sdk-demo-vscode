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
