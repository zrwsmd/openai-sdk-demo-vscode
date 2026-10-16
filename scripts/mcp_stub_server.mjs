// 最小 MCP stdio 服务器：只实现握手、tools/list、tools/call。
// 启动时把自己的 pid 追加进 marker 文件，测试据此断言"服务器进程起了几次"。
//
// 第三个参数是可选的"停摆标记"文件：它存在就立刻退出，用来模拟"配置没变、
// 但服务器起不来"的情况。参数位置固定，这样前后两次连接的配置指纹一致。
import fs from 'node:fs';

const marker = process.argv[2];
const downSentinel = process.argv[3];

if (downSentinel) {
  try {
    fs.accessSync(downSentinel);
    process.exit(1);
  } catch {
    // 文件不在就是正常启动。
  }
}

function mark(line) {
  if (!marker) return;
  try {
    fs.appendFileSync(marker, line);
  } catch {
    // marker 只用于测试观察，写不进去也不影响协议行为。
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method === 'initialize') {
    mark(`init ${Date.now()} pid=${process.pid}\n`);
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'stub', version: '1.0.0' },
      },
    });
    return;
  }
  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'stub_ping',
            description: '返回固定字符串，用于验证连接是否还活着',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    });
    return;
  }
  if (message.method === 'tools/call') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { content: [{ type: 'text', text: 'pong' }] },
    });
    return;
  }
  if (typeof message.id !== 'undefined') {
    send({ jsonrpc: '2.0', id: message.id, result: {} });
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf('\n');
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) handle(line);
    index = buffer.indexOf('\n');
  }
});
process.stdin.on('end', () => process.exit(0));

mark(`boot ${Date.now()} pid=${process.pid}\n`);
