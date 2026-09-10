import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AgentEventFactory,
  JsonFileSession,
  resolveApiFormat,
  resolveModelRoute,
  runAgent,
} from './agent.testbundle.mjs';

assert.equal(resolveApiFormat('', undefined, 'anthropic'), 'messages');
assert.equal(
  resolveModelRoute({
    provider: 'anthropic',
    apiFormat: 'messages',
    baseUrl: 'http://mock/v1',
    apiKey: 'mock-key',
    model: 'mock-claude',
  }).apiFormat,
  'messages',
);
assert.throws(
  () => resolveModelRoute({
    provider: 'anthropic',
    apiFormat: 'chat_completions',
    baseUrl: 'http://mock/v1',
    apiKey: 'mock-key',
    model: 'mock-claude',
  }),
  /Messages/,
);

const requests = [];
let toolSequence = 0;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('error', (error) => {
    res.destroy(error);
  });
  req.on('end', async () => {
    try {
      const request = JSON.parse(body || '{}');
      requests.push({
        headers: req.headers,
        url: req.url,
        body: request,
      });
      assert.equal(req.url, '/v1/messages');
      assert.equal(req.headers['x-api-key'], 'mock-key');
      assert.equal(request.stream, true);
      assert.ok(request.tools?.some((tool) => tool?.name === 'read_file'));
      assert.ok(request.tools?.every((tool) => tool?.input_schema));
      assert.ok(request.tools?.every((tool) => tool?.parameters === undefined));
      assert.equal(request.output_config?.format?.type, 'json_schema');

      const hasToolResult = request.messages.some((message) =>
        Array.isArray(message.content)
        && message.content.some((block) => block?.type === 'tool_result'),
      );
      const userText = request.messages
        .flatMap((message) => Array.isArray(message.content) ? message.content : [])
        .filter((block) => block?.type === 'text')
        .map((block) => block.text)
        .join('\n');

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      if (!hasToolResult && userText.includes('读取')) {
        const args = JSON.stringify({
          path: 'lk.txt',
          startLine: 1,
          endLine: null,
        });
        await streamMessage(res, request.model, [
          {
            type: 'tool_use',
            id: `toolu_read_${++toolSequence}`,
            name: 'read_file',
            input: {},
          },
        ], {
          toolArguments: args,
          stopReason: 'tool_use',
          inputTokens: 21,
          outputTokens: 8,
        });
      } else if (hasToolResult) {
        await streamMessage(res, request.model, [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Anthropic Messages API 已读取文件',
              diagnostics: [],
              artifacts: [],
              data: null,
            }),
          },
        ], {
          stopReason: 'end_turn',
          inputTokens: 35,
          outputTokens: 18,
        });
      } else {
        await streamMessage(res, request.model, [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Anthropic Messages API 已连通',
              diagnostics: [],
              artifacts: [],
              data: null,
            }),
          },
        ], {
          stopReason: 'end_turn',
          inputTokens: 12,
          outputTokens: 16,
        });
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          type: 'mock_test_error',
          message: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  });
});

async function streamMessage(res, model, blocks, usage) {
  const messageId = `msg_mock_${requests.length}`;
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
      usage: {
        input_tokens: usage.inputTokens,
        output_tokens: 0,
      },
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
          input: block.input,
        },
      });
      sse(res, {
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: usage.toolArguments,
        },
      });
    } else {
      sse(res, {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'text',
          text: '',
        },
      });
      for (const character of block.text) {
        sse(res, {
          type: 'content_block_delta',
          index,
          delta: {
            type: 'text_delta',
            text: character,
          },
        });
      }
    }
    sse(res, { type: 'content_block_stop', index });
  }

  sse(res, {
    type: 'message_delta',
    delta: {
      stop_reason: usage.stopReason,
      stop_sequence: null,
    },
    usage: {
      output_tokens: usage.outputTokens,
    },
  });
  sse(res, { type: 'message_stop' });
  res.end();
}

function sse(res, value) {
  res.write(`event: ${value.type}\n`);
  res.write(`data: ${JSON.stringify(value)}\n\n`);
}

const address = await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address()));
});
const port = typeof address === 'object' && address ? address.port : 0;
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-anthropic-test-'));
const config = {
  provider: 'anthropic',
  apiFormat: 'messages',
  baseUrl: `http://127.0.0.1:${port}/v1`,
  apiKey: 'mock-key',
  model: 'mock-claude',
  exportDir: path.join(workspace, 'exports'),
  workspaceRoot: workspace,
};
const session = new JsonFileSession(path.join(workspace, 'session.json'));
let runNumber = 0;

async function runTestTurn(text) {
  const runId = `anthropic-${++runNumber}`;
  const events = [];
  const result = await runAgent(config, session, text, {
    protocol: {
      runId,
      operationId: runId,
      eventFactory: new AgentEventFactory(runId, runId),
      onEvent: (event) => events.push(event),
    },
  });
  return { result, events };
}

try {
  const normal = await runTestTurn('你好');
  assert.equal(normal.result.status, 'completed');
  assert.match(normal.result.output, /Anthropic Messages API 已连通/);

  await fs.writeFile(path.join(workspace, 'lk.txt'), '你好', 'utf8');
  const read = await runTestTurn('读取 lk.txt 的内容');
  assert.equal(read.result.status, 'completed');
  assert.deepEqual(
    read.events
      .filter((event) => event.type === 'tool.started')
      .map((event) => event.payload.toolName),
    ['read_file'],
  );
  const completed = read.events.find(
    (event) => event.type === 'tool.completed' && event.payload.toolName === 'read_file',
  );
  assert.equal(completed?.payload.ok, true);
  assert.equal(completed?.payload.result?.data?.content, '你好');
  assert.match(read.result.output, /Anthropic Messages API 已读取文件/);

  const toolRequest = requests.find((request) =>
    request.body.tool_choice?.type === 'tool',
  );
  assert.equal(toolRequest?.body.tool_choice?.name, 'read_file');
  assert.equal(toolRequest?.body.tools?.[0]?.input_schema?.type, 'object');
  assert.equal(requests.length, 3);
  console.log('Anthropic Messages API tests passed: native route, structured output, tool choice, tool call, typed result');
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
  await new Promise((resolve) => server.close(resolve));
}
