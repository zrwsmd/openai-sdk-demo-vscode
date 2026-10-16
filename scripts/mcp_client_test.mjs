import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultToolPolicy,
  McpConnectionPool,
  loadMcpSettings,
  mcpAllowlist,
  mcpFunctionToolName,
  openMcpSession,
  parseMcpSettings,
  parseMcpServerInput,
  readMcpConfigFile,
  removeMcpServer,
  serializeMcpDocument,
  setMcpServerEnabled,
  upsertMcpServer,
  writeMcpConfigFile,
  probeMcpServer,
  shouldExposeMcpTools,
  wrapMcpFunctionTool,
  cachedToolsByServer,
  mcpServerFingerprint,
  mcpToolCachePath,
  parseMcpToolCache,
  readMcpToolCache,
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

const disabledDoc = parseMcpSettings({
  mcpServers: {
    files: {
      command: 'npx',
      args: ['-y', 'demo'],
      disabled: true,
    },
  },
});
assert.equal(disabledDoc.servers[0]?.enabled, false);
assert.equal(serializeMcpDocument(disabledDoc).mcpServers.files.disabled, true);
const enabledDoc = setMcpServerEnabled(disabledDoc, 'files', true);
assert.equal(enabledDoc.servers[0]?.enabled, true);
assert.equal(serializeMcpDocument(enabledDoc).mcpServers.files.disabled, undefined);
const skipped = await openMcpSession({
  settings: disabledDoc,
  policyContext: { workspaceRoot: '.' },
});
assert.equal(skipped.tools.length, 0);
await skipped.close();
const disabledProbe = await probeMcpServer(disabledDoc.servers[0]);
assert.equal(disabledProbe.status, 'disabled');

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

const serialized = serializeMcpDocument(fromClaudeFile);
assert.equal(serialized.mcpServers.files.command, 'npx');
assert.equal(serialized.mcpServers.files.args[2], '${workspaceFolder}');
assert.equal(serialized.mcpServers.remote.url, 'http://127.0.0.1:3333/mcp');

const added = upsertMcpServer(fromClaudeFile, parseMcpServerInput('docs', {
  command: 'npx',
  args: ['-y', 'docs'],
}));
assert.equal(added.servers.length, 3);
assert.equal(added.servers[2]?.name, 'docs');
const renamed = upsertMcpServer(added, parseMcpServerInput('notes', {
  command: 'npx',
  args: ['-y', 'docs'],
}), 'docs');
assert.equal(renamed.servers.some((server) => server.name === 'docs'), false);
assert.equal(removeMcpServer(renamed, 'notes').servers.length, 2);

const ws2 = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-write-'));
const writtenPath = path.join(ws2, '.plc-agent', 'mcp.json');
await writeMcpConfigFile(writtenPath, added);
const reread = await readMcpConfigFile([ws2]);
assert.equal(reread.exists, true);
assert.equal(reread.settings.servers[2]?.name, 'docs');
assert.equal(reread.settings.servers[0]?.args?.[2], '${workspaceFolder}');

// 连接复用：同一份配置连续借两次，服务器进程只应该被拉起一次。
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const stubDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-stub-'));
const markerPath = path.join(stubDir, 'starts.log');
// 这个文件一出现，stub 就立刻退出：用来模拟"配置没变、服务器起不来"。
// 参数位置固定，所以前后两次连接的配置指纹是一样的。
const downSentinel = path.join(stubDir, 'down');
const stubServer = {
  name: 'stub',
  transport: 'stdio',
  command: process.execPath,
  args: [path.join(scriptDir, 'mcp_stub_server.mjs'), markerPath, downSentinel],
};
const stubSettings = { enabled: true, servers: [stubServer] };
// 数"握手"而不是数"进程"：SDK 每次 connect 会多拉一个随即被丢弃的进程，
// 那是它自己的行为，跟连接是否被复用无关。
const handshakeCount = async () => {
  try {
    const raw = await fs.readFile(markerPath, 'utf8');
    return raw.split('\n').filter((line) => line.startsWith('init ')).length;
  } catch {
    return 0;
  }
};

const pool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
const noServers = await pool.acquire({
  settings: { enabled: false, servers: [] },
  policyContext: { workspaceRoot: stubDir },
});
assert.equal(noServers.tools.length, 0);
assert.deepEqual(noServers.toolNames, []);
noServers.release();

const leaseA = await pool.acquire({ settings: stubSettings, policyContext: { workspaceRoot: stubDir } });
assert.deepEqual(leaseA.tools.map((tool) => tool.name), ['mcp_stub_stub_ping']);
assert.deepEqual(leaseA.toolNames, ['mcp_stub_stub_ping']);
leaseA.release();
assert.equal(await handshakeCount(), 1);

const leaseB = await pool.acquire({ settings: stubSettings, policyContext: { workspaceRoot: stubDir } });
assert.deepEqual(leaseB.tools.map((tool) => tool.name), ['mcp_stub_stub_ping']);
// 复用同一条连接：工具照样能调通，进程没有被重新拉起。
assert.match(JSON.stringify(await leaseB.tools[0].invoke({}, '{}')), /pong/);
leaseB.release();
assert.equal(await handshakeCount(), 1);

// 清单落盘：连上一次之后，不用连也知道这个服务器有哪些工具。
const cache = await readMcpToolCache(stubDir);
assert.deepEqual(cache.servers.stub?.tools.map((tool) => tool.name), ['mcp_stub_stub_ping']);
assert.equal(cache.servers.stub?.fingerprint, mcpServerFingerprint(stubServer));
assert.deepEqual(
  [...cachedToolsByServer(cache, stubSettings).keys()],
  ['stub'],
);
// 配置改了（指纹对不上），缓存那份就不算数。
assert.equal(
  cachedToolsByServer(cache, {
    enabled: true,
    servers: [{ ...stubServer, args: [...stubServer.args, '--other'] }],
  }).size,
  0,
);
// 缓存文件坏掉、或者根本不存在，一律当没有，不抛错。
assert.deepEqual(parseMcpToolCache({ version: 1, servers: 'nope' }).servers, {});
assert.deepEqual(parseMcpToolCache(null).servers, {});
assert.deepEqual((await readMcpToolCache(path.join(stubDir, 'not-there'))).servers, {});
assert.equal(path.basename(mcpToolCachePath(stubDir)), 'mcp-tools-cache.json');

// 服务器起不来的时候，工具名单从缓存里补：可见性不再吊在连接上。
await fs.writeFile(downSentinel, '');
const offlinePool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
const offlineLease = await offlinePool.acquire({
  settings: stubSettings,
  policyContext: { workspaceRoot: stubDir },
});
assert.deepEqual(offlineLease.tools.map((tool) => tool.name), []);
assert.deepEqual(offlineLease.toolNames, ['mcp_stub_stub_ping']);
offlineLease.release();
await offlinePool.dispose();
// 服务器压根没握上手（进程起来就退了），所以握手计数不变。
assert.equal(await handshakeCount(), 1);
await fs.rm(downSentinel, { force: true });

const leaseC = await pool.acquire({
  settings: { enabled: true, servers: [{ ...stubServer, args: [...stubServer.args, '--changed'] }] },
  policyContext: { workspaceRoot: stubDir },
});
assert.equal(leaseC.tools.length, 1);
leaseC.release();
assert.equal(await handshakeCount(), 2);

await pool.dispose();
assert.equal(await handshakeCount(), 2);

console.log('mcp client tests passed');