import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentEventFactory,
  JsonFileSession,
  JsonRunStore,
  commandToolResult,
  runAgent,
} from './agent.testbundle.mjs';

const gatewayPort = 8791;
const gateway = spawn(process.execPath, ['scripts/mock_gateway.mjs', String(gatewayPort)], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});
gateway.stdout.on('data', () => {});
gateway.stderr.on('data', () => {});

async function waitForGateway(url) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(300),
      });
      if (response.status > 0) return;
    } catch {
      // The child process may need a few milliseconds to bind its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`mock gateway did not start: ${url}`);
}

function sse(res, value) {
  res.write(`event: ${value.type}\n`);
  res.write(`data: ${JSON.stringify(value)}\n\n`);
}

async function streamAnthropicMessage(res, model, blocks, options = {}) {
  const messageId = `msg_regression_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  sse(res, {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: options.inputTokens ?? 12, output_tokens: 0 },
    },
  });
  for (const [index, block] of blocks.entries()) {
    if (block.type === 'tool_use') {
      sse(res, {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: {},
        },
      });
      sse(res, {
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: block.arguments,
        },
      });
    } else {
      sse(res, {
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '' },
      });
      for (const character of block.text) {
        sse(res, {
          type: 'content_block_delta',
          index,
          delta: { type: 'text_delta', text: character },
        });
        if (options.slow) await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }
    sse(res, { type: 'content_block_stop', index });
  }
  sse(res, {
    type: 'message_delta',
    delta: {
      stop_reason: options.stopReason ?? 'end_turn',
      stop_sequence: null,
    },
    usage: { output_tokens: options.outputTokens ?? 16 },
  });
  sse(res, { type: 'message_stop' });
  res.end();
}

async function startAnthropicMock() {
  let sequence = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    res.on('error', () => {});
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        assert.equal(req.url, '/v1/messages');
        assert.equal(req.headers['x-api-key'], 'mock-key');
        const request = JSON.parse(body || '{}');
        const messages = Array.isArray(request.messages) ? request.messages : [];
        const serialized = JSON.stringify(messages);
        const hasToolResult = messages.some((message) =>
          Array.isArray(message.content) &&
          message.content.some((block) => block?.type === 'tool_result'),
        );
        const userText = messages
          .flatMap((message) => (
            typeof message.content === 'string'
              ? [message.content]
              : Array.isArray(message.content)
                ? message.content
                : []
          ))
          .map((block) => typeof block === 'string' ? block : block?.text ?? '')
          .join('\n');

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        if (!hasToolResult && userText.includes('慢速')) {
          await streamAnthropicMessage(res, request.model, [
            { type: 'text', text: '慢速响应'.repeat(300) },
          ], { slow: true });
          return;
        }

        let tool;
        if (!hasToolResult && userText.includes('读取')) {
          tool = {
            name: 'read_file',
            arguments: JSON.stringify({ path: 'lk.txt' }),
          };
        } else if (!hasToolResult && userText.includes('导出')) {
          tool = {
            name: 'export_st_program',
            arguments: JSON.stringify({
              code: [
                'PROGRAM StarDelta',
                '  Motor_Star := Start_Btn;',
                'END_PROGRAM',
              ].join('\n'),
            }),
          };
        } else if (
          !hasToolResult &&
          (userText.includes('非零') || userText.includes('失败命令'))
        ) {
          tool = {
            name: 'run_command',
            arguments: JSON.stringify({
              command: 'node -e "process.exit(7)"',
            }),
          };
        } else if (!hasToolResult && userText.includes('超时命令')) {
          tool = {
            name: 'run_command',
            arguments: JSON.stringify({
              command: 'node -e "setTimeout(() => {}, 5000)"',
            }),
          };
        }

        if (tool) {
          await streamAnthropicMessage(res, request.model, [{
            type: 'tool_use',
            id: `toolu_regression_${++sequence}`,
            name: tool.name,
            arguments: tool.arguments,
          }], { stopReason: 'tool_use', outputTokens: 8 });
          return;
        }

        const text = hasToolResult
          ? JSON.stringify({
              message: userText.includes('读取')
                ? 'Anthropic 已读取文件'
                : userText.includes('导出')
                  ? 'Anthropic 已完成导出'
                  : 'Anthropic 已收到工具结果',
              diagnostics: [],
              artifacts: [],
              data: null,
            })
          : '你好，我是 Anthropic Messages mock。';
        await streamAnthropicMessage(res, request.model, [{ type: 'text', text }], {
          inputTokens: serialized.length > 0 ? 20 : 12,
          outputTokens: 16,
        });
      } catch (error) {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: { type: 'mock_test_error', message: String(error) },
        }));
      }
    });
  });
  const address = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
  return {
    server,
    port: typeof address === 'object' && address ? address.port : 0,
  };
}

function makeProtocol(label, events) {
  return {
    runId: `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    operationId: `${label}-operation`,
    eventFactory: undefined,
    onEvent: (event) => events.push(event),
  };
}

async function runTurn(config, session, text, label, options = {}) {
  const events = [];
  const protocol = makeProtocol(label, events);
  const result = await runAgent(config, session, text, {
    ...options,
    protocol: {
      ...protocol,
      eventFactory: new AgentEventFactory(protocol.runId, protocol.operationId),
    },
  });
  return { result, events };
}

async function runApprovalTurn(config, session, text, label, decide, options = {}) {
  let current = await runTurn(config, session, text, label, options);
  while (current.result.status === 'awaiting_approval') {
    const decisions = {};
    for (const approval of current.result.approvals ?? []) {
      decisions[approval.id] = await decide(approval.name, approval.args);
    }
    current = await runTurn(config, session, text, label, {
      ...options,
      initialState: current.result.state,
      decisions,
    });
  }
  return current;
}

function simulatedCommandResult(outcome) {
  return async (name, input, execute) => {
    if (name !== 'run_command') return execute();
    return commandToolResult(input.command, outcome);
  };
}

async function runFormatSuite(label, baseConfig) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `plc-${label}-regression-`));
  const config = {
    ...baseConfig,
    exportDir: path.join(root, 'exports'),
    workspaceRoot: root,
  };
  const freshSession = (name) =>
    new JsonFileSession(path.join(root, `${name}-session.json`));

  try {
    // 1. Ordinary answer.
    const ordinary = await runTurn(
      config,
      freshSession('ordinary'),
      '你好',
      `${label}-ordinary`,
    );
    assert.equal(ordinary.result.status, 'completed');
    assert.ok(ordinary.result.output.length > 0);

    // 2. A real tool call and a structured tool result.
    await fs.writeFile(path.join(root, 'lk.txt'), '你好', 'utf8');
    const read = await runApprovalTurn(
      config,
      freshSession('read'),
      '读取 lk.txt 的内容',
      `${label}-read`,
      async () => true,
    );
    assert.equal(read.result.status, 'completed');
    assert.ok(read.events.some((event) =>
      event.type === 'tool.started' && event.payload.toolName === 'read_file'));
    assert.ok(read.events.some((event) =>
      event.type === 'tool.completed' &&
      event.payload.toolName === 'read_file' &&
      event.payload.ok === true));

    // 3. User refusal is a terminal business state and must not execute.
    const refused = await runApprovalTurn(
      config,
      freshSession('refused'),
      '把程序导出为文件',
      `${label}-refused`,
      async () => false,
    );
    assert.equal(refused.result.status, 'refused');
    const refusedExports = await fs.readdir(config.exportDir).catch(() => []);
    assert.equal(refusedExports.length, 0);

    // 4. Approval checkpoint survives a fresh Session/RunStore instance.
    const runFile = path.join(root, 'recovery-runs.json');
    const sessionFile = path.join(root, 'recovery-session.json');
    const store1 = new JsonRunStore(runFile);
    const record = await store1.begin(
      '把程序导出为文件',
      config,
      0,
      `${label}-recovery-operation`,
    );
    const first = await runAgent(config, new JsonFileSession(sessionFile), record.userText, {
      protocol: {
        runId: `${label}-recovery`,
        operationId: record.operationId,
        eventFactory: new AgentEventFactory(`${label}-recovery`, record.operationId),
        onEvent: () => {},
      },
      onCheckpoint: async (checkpoint) => {
        record.status = 'awaiting_approval';
        record.state = checkpoint.state;
        record.approvals = checkpoint.approvals;
        record.output = checkpoint.output;
        record.usage = checkpoint.usage;
        await store1.update(record);
      },
    });
    assert.equal(first.status, 'awaiting_approval');
    const store2 = new JsonRunStore(runFile);
    const restored = await store2.getActive();
    assert.ok(restored?.state);
    assert.equal(restored?.approvals.length, 1);
    const resumed = await runAgent({
      ...config,
      executeEffect: (name, input, execute) =>
        store2.executeEffect(restored.id, restored.operationId, name, input, execute),
    }, new JsonFileSession(sessionFile), restored.userText, {
      initialState: restored.state,
      decisions: { [restored.approvals[0].id]: true },
      protocol: {
        runId: `${label}-recovery-resume`,
        operationId: restored.operationId,
        eventFactory: new AgentEventFactory(`${label}-recovery-resume`, restored.operationId),
        onEvent: () => {},
      },
    });
    assert.equal(resumed.status, 'completed');
    assert.ok((await fs.readdir(config.exportDir)).includes('StarDelta.st'));

    // 5. Cancellation is reported as cancelled, not as a provider failure.
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15);
    const cancelled = await runTurn(
      config,
      freshSession('cancel'),
      '慢速回答',
      `${label}-cancel`,
      { signal: controller.signal },
    );
    assert.equal(cancelled.result.status, 'cancelled');

    // 6-7. The wire adapter receives failed command results for both cases.
    // The workspace_tools suite separately verifies real process/timeout behavior.
    for (const [name, text, outcome, code] of [
      ['nonzero', '执行一个非零命令', { exitCode: 7, output: 'exit 7' }, 'command_nonzero_exit'],
      ['timeout', '执行一个超时命令', { exitCode: null, output: 'timeout' }, 'command_timeout'],
    ]) {
      const failed = await runApprovalTurn(
        {
          ...config,
          // Keep this protocol test focused on the tool result. Required-action
          // verification is covered by the approval/export scenarios above.
          actionPolicy: { requiredToolFor: () => undefined },
          executeEffect: simulatedCommandResult(outcome),
        },
        freshSession(name),
        text,
        `${label}-${name}`,
        async () => true,
      );
      assert.equal(failed.result.status, 'completed');
      const event = failed.events.find((item) =>
        item.type === 'tool.completed' && item.payload.toolName === 'run_command');
      assert.ok(event, `${label} ${name}: missing run_command completion`);
      assert.equal(event.payload.ok, false);
      assert.equal(event.payload.result?.diagnostics?.[0]?.code, code);
    }

    console.log(`${label}: ordinary, tool, refusal, recovery, cancellation, nonzero, timeout passed`);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

const anthropic = await startAnthropicMock();
try {
  await waitForGateway(`http://127.0.0.1:${gatewayPort}/v1/responses`);
  await runFormatSuite('chat-completions', {
    provider: 'openai',
    apiFormat: 'chat_completions',
    baseUrl: `http://127.0.0.1:${gatewayPort}/v1`,
    apiKey: 'mock-key',
    model: 'mock-chat',
  });
  await runFormatSuite('responses', {
    provider: 'openai',
    apiFormat: 'responses',
    baseUrl: `http://127.0.0.1:${gatewayPort}/v1`,
    apiKey: 'mock-key',
    model: 'mock-responses',
  });
  await runFormatSuite('anthropic-messages', {
    provider: 'anthropic',
    apiFormat: 'messages',
    baseUrl: `http://127.0.0.1:${anthropic.port}/v1`,
    apiKey: 'mock-key',
    model: 'mock-claude',
  });
} finally {
  await new Promise((resolve) => anthropic.server.close(resolve));
  gateway.kill();
}

console.log('all three API format regression suites passed');
