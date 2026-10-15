import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DefaultToolPolicy,
  loadMcpSettings,
  mcpAllowlist,
  mcpFunctionToolName,
  openMcpSession,
  parseMcpSettings,
  shouldExposeMcpTools,
  wrapMcpFunctionTool,
} from './agent.testbundle.mjs';

assert.deepEqual(parseMcpSettings(undefined), { enabled: false, servers: [] });
assert.equal(parseMcpSettings({ enabled: true, servers: [{ name: 'files', transport: 'stdio' }] }).servers.length, 0);
assert.equal(
  parseMcpSettings({
    enabled: true,
    servers: [{ name: 'files', transport: 'stdio', command: 'npx', args: ['-y', 'demo'] }],
  }).servers[0]?.command,
  'npx',
);
assert.equal(
  parseMcpSettings({
    enabled: true,
    servers: [{ name: 'remote', transport: 'http', url: 'http://127.0.0.1:3333/mcp' }],
  }).servers[0]?.url,
  'http://127.0.0.1:3333/mcp',
);

const fromClaudeFile = parseMcpSettings({
  mcpServers: {
    files: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '${workspaceFolder}'],
    },
    remote: { url: 'http://127.0.0.1:3333/mcp' },
  },
});
assert.equal(fromClaudeFile.enabled, true);
assert.equal(fromClaudeFile.servers[0]?.name, 'files');
assert.equal(fromClaudeFile.servers[0]?.transport, 'stdio');
assert.equal(fromClaudeFile.servers[1]?.transport, 'http');

assert.equal(shouldExposeMcpTools({ workflowId: 'st_workspace_delivery' }), false);
assert.equal(shouldExposeMcpTools({ fallbackMode: 'blocked_high_risk' }), false);
assert.equal(shouldExposeMcpTools({ fallbackMode: 'needs_clarification' }), false);
assert.equal(shouldExposeMcpTools({ fallbackMode: 'command_query' }), true);
assert.equal(shouldExposeMcpTools({ fallbackMode: 'general_chat' }), true);
assert.equal(shouldExposeMcpTools({}), false);

assert.equal(mcpFunctionToolName('files', 'read_file'), 'mcp_files_read_file');
assert.ok(mcpFunctionToolName('weird name', 'tool name!').startsWith('mcp_weird_name_tool_name'));

assert.deepEqual(
  mcpAllowlist({ fallbackMode: 'command_query', toolAllowlist: ['read_file', 'run_command'] }, ['mcp_files_list']),
  ['read_file', 'run_command', 'mcp_files_list'],
);
assert.deepEqual(
  mcpAllowlist({ workflowId: 'st_workspace_delivery', toolAllowlist: undefined }, ['mcp_files_list']),
  undefined,
);

let invoked = false;
const wrapped = wrapMcpFunctionTool(
  {
    type: 'function',
    name: 'mcp_files_list',
    description: 'list files',
    parameters: { type: 'object', properties: {} },
    strict: false,
    needsApproval: async () => false,
    invoke: async () => {
      invoked = true;
      return 'ok';
    },
  },
  {
    serverName: 'files',
    policy: new DefaultToolPolicy(),
    policyContext: { workspaceRoot: '.', dryRun: true },
  },
);
assert.equal(await wrapped.needsApproval({}, {}), true);
assert.match(wrapped.description, /默认高风险/);
const denied = await wrapped.invoke({}, '{}');
assert.match(String(denied), /干运行/);
assert.equal(invoked, false);

const allowed = wrapMcpFunctionTool(
  {
    type: 'function',
    name: 'mcp_files_list',
    description: 'list files',
    parameters: { type: 'object', properties: {} },
    strict: false,
    needsApproval: async () => false,
    invoke: async () => {
      invoked = true;
      return 'ok';
    },
  },
  {
    serverName: 'files',
    policy: new DefaultToolPolicy(),
    policyContext: { workspaceRoot: '.' },
  },
);
assert.equal(await allowed.invoke({}, '{}'), 'ok');
assert.equal(invoked, true);

const idle = await openMcpSession({
  settings: { enabled: false, servers: [] },
  policyContext: { workspaceRoot: '.' },
});
assert.equal(idle.tools.length, 0);
await idle.close();

const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-'));
await fs.mkdir(path.join(ws, '.plc-agent'), { recursive: true });
await fs.writeFile(path.join(ws, '.plc-agent', 'mcp.json'), JSON.stringify({
  mcpServers: {
    files: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '${workspaceFolder}'],
    },
  },
}, null, 2));
const loaded = await loadMcpSettings([ws]);
assert.equal(loaded.enabled, true);
assert.equal(loaded.servers[0]?.name, 'files');
assert.equal(loaded.servers[0]?.args?.[2], ws);

console.log('mcp client tests passed');
