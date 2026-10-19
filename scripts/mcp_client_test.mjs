import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultToolPolicy,
  McpConnectionPool,
  EMPTY_MCP_SESSION_LEASE,
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
  JsonFileSession,
  JsonRunStore,
  RunCoordinator,
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

// effect/recovery 自己失败时不代表 MCP server 断了，不能触发连接丢弃回调。
let effectFailureReported = 0;
const effectFailure = wrapMcpFunctionTool(
  {
    type: 'function',
    name: 'mcp_files_list',
    description: 'list files',
    parameters: { type: 'object', properties: {} },
    strict: false,
    needsApproval: async () => false,
    invoke: async () => 'should not run',
  },
  {
    serverName: 'files',
    policy: new DefaultToolPolicy(),
    policyContext: { workspaceRoot: '.' },
    executeEffect: async () => {
      throw new Error('effect bookkeeping failed');
    },
    onInvocationError: () => { effectFailureReported += 1; },
  },
);
await assert.rejects(effectFailure.invoke({}, '{}'), /effect bookkeeping failed/);
assert.equal(effectFailureReported, 0);

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

// 连接复用：池子按"每台服务器一条"管。这里配两台，用来验证
// 一台出事不牵动另一台、改一台的配置也只让那一台重连。
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const stubDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-stub-'));
const stubScript = path.join(scriptDir, 'mcp_stub_server.mjs');
const markerOf = (tag) => path.join(stubDir, `starts-${tag}.log`);
// 这个文件一出现，对应那台就立刻退出：用来模拟"配置没变、服务器起不来"。
// 参数位置固定，所以前后两次连接的配置指纹是一样的。
const sentinelOf = (tag) => path.join(stubDir, `down-${tag}`);
const makeServer = (name, tag) => ({
  name,
  transport: 'stdio',
  command: process.execPath,
  args: [stubScript, markerOf(tag), sentinelOf(tag)],
});
const stubServer = makeServer('stub', 'a');
const otherServer = makeServer('other', 'b');
const twoServers = { enabled: true, servers: [stubServer, otherServer] };
// 数"握手"而不是数"进程"：SDK 每次 connect 会多拉一个随即被丢弃的进程，
// 那是它自己的行为，跟连接是否被复用无关。
const handshakesOf = async (tag) => {
  try {
    const raw = await fs.readFile(markerOf(tag), 'utf8');
    return raw.split('\n').filter((line) => line.startsWith('init ')).length;
  } catch {
    return 0;
  }
};

// 跑一轮用的 agent 桩。注意 output 必须是字符串、对象放进 result：落盘校验
// 要求 run.output 是字符串，写反了会抛 "invalid last run record"。
const completedAgentResult = () => ({
  status: 'completed',
  output: 'ok',
  usage: { inputTokens: 1, outputTokens: 2, requests: 1 },
  result: {
    protocolVersion: 1,
    status: 'completed',
    output: { message: 'ok', diagnostics: [], artifacts: [], data: null },
    diagnostics: [],
    artifacts: [],
    usage: { inputTokens: 1, outputTokens: 2, requests: 1 },
  },
});

const pool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
const noServers = await pool.acquire({
  settings: { enabled: false, servers: [] },
  policyContext: { workspaceRoot: stubDir },
});
assert.equal(noServers, EMPTY_MCP_SESSION_LEASE);
assert.equal(noServers.tools.length, 0);
assert.deepEqual(noServers.toolNames, []);
noServers.release();

const leaseA = await pool.acquire({ settings: twoServers, policyContext: { workspaceRoot: stubDir } });
assert.deepEqual(leaseA.tools.map((tool) => tool.name), ['mcp_stub_stub_ping', 'mcp_other_stub_ping']);
assert.deepEqual(leaseA.toolNames, ['mcp_stub_stub_ping', 'mcp_other_stub_ping']);
leaseA.release();
assert.equal(await handshakesOf('a'), 1);
assert.equal(await handshakesOf('b'), 1);

const leaseB = await pool.acquire({ settings: twoServers, policyContext: { workspaceRoot: stubDir } });
assert.deepEqual(leaseB.tools.map((tool) => tool.name), ['mcp_stub_stub_ping', 'mcp_other_stub_ping']);
// 复用同一条连接：工具照样能调通，进程没有被重新拉起。
assert.match(JSON.stringify(await leaseB.tools[0].invoke({}, '{}')), /pong/);
leaseB.release();
assert.equal(await handshakesOf('a'), 1);
assert.equal(await handshakesOf('b'), 1);

// 清单落盘：连上一次之后，不用连也知道每台有哪些工具。
const cache = await readMcpToolCache(stubDir);
assert.deepEqual(cache.servers.stub?.tools.map((tool) => tool.name), ['mcp_stub_stub_ping']);
assert.deepEqual(cache.servers.other?.tools.map((tool) => tool.name), ['mcp_other_stub_ping']);
assert.deepEqual(cache.servers.other?.tools[0]?.definition, {
  name: 'stub_ping',
  description: '返回固定字符串，用于验证连接是否还活着',
  inputSchema: { type: 'object', properties: {} },
});
assert.equal(cache.servers.stub?.fingerprint, mcpServerFingerprint(stubServer));
assert.deepEqual([...cachedToolsByServer(cache, twoServers).keys()], ['stub', 'other']);
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

// 一台起不来：只有那一台的名单从缓存补，另一台照常在。
// 这段必须排在下面前面——缓存是按服务器名合并的，改了配置的那台一旦连上，
// 它的旧条目就被新指纹盖掉，再想验"从缓存兜底"就取不到了。
await fs.writeFile(sentinelOf('b'), '');
const offlinePool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
const offlineLease = await offlinePool.acquire({
  settings: twoServers,
  policyContext: { workspaceRoot: stubDir },
});
assert.deepEqual(offlineLease.tools.map((tool) => tool.name), ['mcp_stub_stub_ping', 'mcp_other_stub_ping']);
assert.deepEqual(offlineLease.toolNames, ['mcp_stub_stub_ping', 'mcp_other_stub_ping']);
assert.equal(await handshakesOf('b'), 1);
// 缓存工具先以 schema 形式出现，不在 acquire 阶段重连；真正调用时才借连接。
const cachedOtherTool = offlineLease.tools.find((tool) => tool.name === 'mcp_other_stub_ping');
assert.ok(cachedOtherTool);
assert.deepEqual(cachedOtherTool.parameters, {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: true,
});
await fs.rm(sentinelOf('b'), { force: true });
assert.match(JSON.stringify(await cachedOtherTool.invoke({}, '{}')), /pong/);
offlineLease.release();
await offlinePool.dispose();
// 起不来那台压根没握上手（进程起来就退了），另一台在新池子里重新连了一次。
assert.equal(await handshakesOf('b'), 2);
assert.equal(await handshakesOf('a'), 2);

// 只改一台的配置：只有那一台重连，另一台照旧热着（复用第一条连接，不再握手）。
const leaseC = await pool.acquire({
  settings: {
    enabled: true,
    servers: [stubServer, { ...otherServer, args: [...otherServer.args, '--changed'] }],
  },
  policyContext: { workspaceRoot: stubDir },
});
assert.equal(leaseC.tools.length, 2);
leaseC.release();
assert.equal(await handshakesOf('a'), 2);
assert.equal(await handshakesOf('b'), 3);

// 关掉之后服务器进程要真的退出，不能只是把引用丢掉。
// 换会话时旧连接池就是靠这一步收尾的，收不掉就会叠进程。
const initPids = async () => {
  const pids = [];
  for (const tag of ['a', 'b']) {
    try {
      const raw = await fs.readFile(markerOf(tag), 'utf8');
      pids.push(...raw.split('\n')
        .filter((line) => line.startsWith('init '))
        .map((line) => Number(/pid=(\d+)/.exec(line)?.[1] ?? 0))
        .filter(Boolean));
    } catch {
      // 没有这个文件就是这台压根没握过手。
    }
  }
  return pids;
};
const alivePids = (pids) => pids.filter((pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
});
const waitForExit = async (pids) => {
  for (let i = 0; i < 60; i += 1) {
    if (!alivePids(pids).length) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
};

// 改配置（这里只改 timeoutMs）会立即淘汰旧连接，不等十分钟 idle timeout。
const retireServer = makeServer('retire', 'e');
const retirePool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
const oldLease = await retirePool.acquire({
  settings: { enabled: true, servers: [retireServer] },
  policyContext: { workspaceRoot: stubDir },
});
oldLease.release();
const oldPids = [];
try {
  const raw = await fs.readFile(markerOf('e'), 'utf8');
  oldPids.push(...raw.split('\n')
    .filter((line) => line.startsWith('init '))
    .map((line) => Number(/pid=(\d+)/.exec(line)?.[1] ?? 0))
    .filter(Boolean));
} catch {
  // 下面的 acquire 会给出明确失败。
}
const changedLease = await retirePool.acquire({
  settings: { enabled: true, servers: [{ ...retireServer, timeoutMs: 12_345 }] },
  policyContext: { workspaceRoot: stubDir },
});
assert.equal(await handshakesOf('e'), 2);
assert.equal(await waitForExit(oldPids), true);
const changedPids = [];
try {
  const raw = await fs.readFile(markerOf('e'), 'utf8');
  changedPids.push(...raw.split('\n')
    .filter((line) => line.startsWith('init '))
    .map((line) => Number(/pid=(\d+)/.exec(line)?.[1] ?? 0))
    .filter(Boolean));
} catch {
  // 下面的 acquire 会给出明确失败。
}
changedLease.release();
const disabledLease = await retirePool.acquire({
  settings: { enabled: false, servers: [] },
  policyContext: { workspaceRoot: stubDir },
});
disabledLease.release();
assert.equal(await waitForExit(changedPids), true);
await retirePool.dispose();

const connectedPids = await initPids();
assert.equal(connectedPids.length, 5);
await pool.dispose();
assert.equal(await handshakesOf('a') + await handshakesOf('b'), 5);
assert.equal(await waitForExit(connectedPids), true);

// A semantic server selection must limit both live connections and cached
// tool-name fallback to the selected server.
const selectedPool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
const otherBeforeSelection = await handshakesOf('b');
const selectedLease = await selectedPool.acquire({
  settings: twoServers,
  serverNames: ['stub'],
  policyContext: { workspaceRoot: stubDir },
});
assert.deepEqual(selectedLease.tools.map((tool) => tool.name), ['mcp_stub_stub_ping']);
assert.deepEqual(selectedLease.toolNames, ['mcp_stub_stub_ping']);
selectedLease.release();
assert.equal(await handshakesOf('b'), otherBeforeSelection);
await selectedPool.dispose();

// 池子归窗口，不归会话：换会话只是换一个运行对象，宿主把同一个池子交下去，连接留着。
//
// 这里跑两轮，分别落在两个不同的协调器上（也就是两条会话）。共用池子的话只该握手
// 一次；老做法是每个协调器自带一个池子，第二轮会再连一遍——所以"只握手一次"就是
// 这条改动的判据。顺带钉住"协调器不会把别人给的池子关掉"：dispose() 是单向开关，
// 一旦被某条会话顺手关掉，整个窗口的池子对所有人都废了，之后每轮都重连。
{
  const sharedServer = makeServer('shared', 'c');
  const sharedSettings = { enabled: true, servers: [sharedServer] };
  const sharedPool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
  const sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-sessions-'));
  const runConfig = {
    baseUrl: 'http://mock/v1',
    model: 'mock',
    exportDir: '',
    workspaceRoot: stubDir,
    jev: { enabled: false },
    mcp: sharedSettings,
  };
  const seenByAgent = [];
  for (const name of ['session-a', 'session-b']) {
    const store = new JsonRunStore(path.join(sessionDir, `${name}-runs.json`));
    const coordinator = new RunCoordinator({
      session: new JsonFileSession(path.join(sessionDir, `${name}.json`)),
      store,
      emit: () => undefined,
      mcpPool: sharedPool,
      executeAgent: async (_cfg, _session, _userText, options) => {
        seenByAgent.push({
          tools: (options.extraBusinessTools ?? []).map((tool) => tool.name),
          allowed: options.allowedToolNames ?? [],
        });
        return completedAgentResult();
      },
    });
    await coordinator.initialize();
    await coordinator.start('你好', runConfig, 'key');
  }
  // 两轮都真把 MCP 工具发给了模型，说明借的就是给下去那个池子。
  assert.equal(seenByAgent.length, 2);
  for (const seen of seenByAgent) {
    assert.ok(seen.tools.includes('mcp_shared_stub_ping'));
    assert.ok(seen.allowed.includes('mcp_shared_stub_ping'));
  }
  // 换了会话、换了运行对象，连接还是原来那条：全程只握了一次手。
  assert.equal(await handshakesOf('c'), 1);
  await sharedPool.dispose();
}

// 按需连接：档位和工作流定下来之后才决定连不连。
// 走工作流那几档时 MCP 工具本来就到不了模型手里，不该为它们把服务器拉起来。
{
  const lazyServer = makeServer('lazy', 'd');
  const lazyPool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
  const lazyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-lazy-'));
  const seenByAgent = [];
  const coordinator = new RunCoordinator({
    session: new JsonFileSession(path.join(lazyDir, 'session.json')),
    store: new JsonRunStore(path.join(lazyDir, 'runs.json')),
    emit: () => undefined,
    mcpPool: lazyPool,
    executeAgent: async (_cfg, _session, _userText, options) => {
      seenByAgent.push({
        workflowId: options.workflowId,
        tools: (options.extraBusinessTools ?? []).map((tool) => tool.name),
      });
      return completedAgentResult();
    },
  });
  await coordinator.initialize();
  // 这句话靠本地正则就能归到 ST 交付，不需要模型参与，所以结果稳定。
  await coordinator.start('生成一个 ST 程序', {
    baseUrl: 'http://mock/v1',
    model: 'mock',
    exportDir: '',
    workspaceRoot: stubDir,
    jev: { enabled: false },
    mcp: { enabled: true, servers: [lazyServer] },
  }, 'key');
  // 先确认这一轮真归了工作流，否则下面的"没连"说明不了问题。
  assert.deepEqual(seenByAgent.map((seen) => seen.workflowId), ['st_workspace_delivery']);
  assert.deepEqual(seenByAgent[0].tools, []);
  assert.equal(await handshakesOf('d'), 0);
  await lazyPool.dispose();
}

// Jev's per-server intent signals are carried through workflow triage to the
// pool. A confident yes/no result connects only the selected server.
{
  const intentServer = makeServer('intent', 'f');
  const unusedServer = makeServer('unused', 'g');
  const intentPool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
  const intentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-intent-'));
  const seen = [];
  const coordinator = new RunCoordinator({
    session: new JsonFileSession(path.join(intentDir, 'session.json')),
    store: new JsonRunStore(path.join(intentDir, 'runs.json')),
    emit: () => undefined,
    mcpPool: intentPool,
    decisionService: {
      taskHint: async () => ({
        delivery: 'not_required',
        deliveryConfidence: 0.95,
        orchestration: 'single',
        orchestrationConfidence: 0.95,
        workflow: 'general_chat',
        workflowConfidence: 0.95,
        toolNeeds: {
          readFile: { value: 'no', confidence: 0.95 },
          writeFile: { value: 'no', confidence: 0.95 },
          runCommand: { value: 'no', confidence: 0.95 },
        },
        mcpServerNeeds: {
          intent: { value: 'yes', confidence: 0.95 },
          unused: { value: 'no', confidence: 0.95 },
        },
        riskLevel: 'low',
        riskConfidence: 0.95,
        needsApproval: { value: 'no', confidence: 0.95 },
        evaluation: { status: 'ok', elapsedMs: 1 },
      }),
    },
    executeAgent: async (_cfg, _session, _userText, options) => {
      seen.push((options.extraBusinessTools ?? []).map((tool) => tool.name));
      return completedAgentResult();
    },
  });
  await coordinator.initialize();
  await coordinator.start('查询 intent 服务里的信息', {
    baseUrl: 'http://mock/v1',
    model: 'mock',
    exportDir: '',
    workspaceRoot: intentDir,
    jev: { enabled: false },
    mcp: { enabled: true, servers: [intentServer, unusedServer] },
  }, 'key');
  assert.deepEqual(seen, [['mcp_intent_stub_ping']]);
  assert.equal(await handshakesOf('g'), 0);
  await intentPool.dispose();
  await fs.rm(intentDir, { recursive: true, force: true });
}

// Any unknown MCP intent must fail open: both servers remain available so a
// semantic miss cannot hide the tool that the request actually needs.
{
  const knownServer = makeServer('known', 'h');
  const uncertainServer = makeServer('uncertain', 'i');
  const uncertainPool = new McpConnectionPool({ idleTimeoutMs: 60_000 });
  const uncertainDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-mcp-uncertain-'));
  const seen = [];
  const coordinator = new RunCoordinator({
    session: new JsonFileSession(path.join(uncertainDir, 'session.json')),
    store: new JsonRunStore(path.join(uncertainDir, 'runs.json')),
    emit: () => undefined,
    mcpPool: uncertainPool,
    decisionService: {
      taskHint: async () => ({
        delivery: 'not_required',
        deliveryConfidence: 0.95,
        orchestration: 'single',
        orchestrationConfidence: 0.95,
        workflow: 'general_chat',
        workflowConfidence: 0.95,
        toolNeeds: {
          readFile: { value: 'no', confidence: 0.95 },
          writeFile: { value: 'no', confidence: 0.95 },
          runCommand: { value: 'no', confidence: 0.95 },
        },
        mcpServerNeeds: {
          known: { value: 'yes', confidence: 0.95 },
          uncertain: { value: 'unknown', confidence: 0 },
        },
        riskLevel: 'low',
        riskConfidence: 0.95,
        needsApproval: { value: 'no', confidence: 0.95 },
        evaluation: { status: 'ok', elapsedMs: 1 },
      }),
    },
    executeAgent: async (_cfg, _session, _userText, options) => {
      seen.push((options.extraBusinessTools ?? []).map((tool) => tool.name));
      return completedAgentResult();
    },
  });
  await coordinator.initialize();
  await coordinator.start('查询外部服务', {
    baseUrl: 'http://mock/v1',
    model: 'mock',
    exportDir: '',
    workspaceRoot: uncertainDir,
    jev: { enabled: false },
    mcp: { enabled: true, servers: [knownServer, uncertainServer] },
  }, 'key');
  assert.deepEqual(seen, [['mcp_known_stub_ping', 'mcp_uncertain_stub_ping']]);
  assert.equal(await handshakesOf('h'), 1);
  assert.equal(await handshakesOf('i'), 1);
  await uncertainPool.dispose();
  await fs.rm(uncertainDir, { recursive: true, force: true });
}

console.log('mcp client tests passed');
