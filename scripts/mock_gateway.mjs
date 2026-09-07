// 模拟 OpenAI 兼容网关(验证插件内核用):流式、工具调用、usage 统计、maxTurns 触发、会话回放、工具审批
// 脚本1: 普通消息 → 直接流式回答(回复中回显收到的 messages 数量,用于断言 session 历史回放)
// 脚本2: 含"星三角" → 请求 get_io_table 工具 → 回喂后流式给出最终回答
// 脚本3: 含"导出" → 请求 export_st_program 工具(needsApproval)→ 回喂后流式给出确认
// 脚本4: 含"循环" → 每次(包括收到工具结果后)都再次请求工具 → 触发 maxTurns 上限
// 每路回答末尾附带 usage-only chunk(与真实网关的 stream_options.include_usage 行为一致)
// 用法: node mock_gateway.mjs [port]
import http from 'node:http';

const REPLY = '你好!我是 PLC 编程助手(插件内核验证),请告诉我你的控制任务。';
const ST_CODE = [
  'PROGRAM StarDelta',
  '  VAR',
  '    TON_Star : TON;',
  '  END_VAR',
  '  TON_Star(IN := Start_Btn, PT := T#5s);',
  '  Motor_Star := TON_Star.Q;',
  'END_PROGRAM',
].join('\n');

let seq = 0;
function usageChunk(model, prompt, completion) {
  return {
    id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: 1, model,
    choices: [],
    usage: { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion },
  };
}

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

function chunk(model, delta, finish) {
  return { id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta: delta ?? {}, finish_reason: finish ?? null }] };
}

function toolCallChunk(model, name = 'get_io_table', args = '{}') {
  return chunk(model, {
    tool_calls: [{ index: 0, id: `call_mock_${++seq}`, type: 'function', function: { name, arguments: args } }],
  });
}

async function streamText(res, model, text) {
  for (const ch of text) {
    sse(res, chunk(model, { content: ch }));
    await new Promise((r) => setTimeout(r, 2));
  }
  sse(res, chunk(model, {}, 'stop'));
  sse(res, usageChunk(model, 120, 34));
  res.write('data: [DONE]\n\n');
  res.end();
}

function endWithToolCall(res, model) {
  sse(res, toolCallChunk(model));
  sse(res, chunk(model, {}, 'tool_calls'));
  sse(res, usageChunk(model, 90, 12));
  res.write('data: [DONE]\n\n');
  res.end();
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', async () => {
    const req_body = JSON.parse(body || '{}');
    const model = req_body.model || 'mock';
    const messages = req_body.messages || [];
    const last = messages[messages.length - 1] || {};
    // 只用最后一条 user 消息判断脚本分支(系统提示词里也含"导出"等词,不能用全量拼接)
    const lastUser = [...messages].reverse().find((m) => m.role === 'user' && typeof m.content === 'string');
    const userText = (lastUser && lastUser.content) || '';
    console.log(`[mock] model=${model} tools=${(req_body.tools || []).length} stream=${req_body.stream} msgs=${messages.length} last_role=${last.role}`);

    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    sse(res, chunk(model, { role: 'assistant' }));

    if (userText.includes('循环')) {
      // 死循环模式:无论是否收到工具结果,都再次请求工具 → 应被 maxTurns 截停
      endWithToolCall(res, model);
    } else if (userText.includes('导出') && last.role !== 'tool') {
      // 审批场景:请求 needsApproval 工具 export_st_program
      sse(res, toolCallChunk(model, 'export_st_program', JSON.stringify({ code: ST_CODE })));
      sse(res, chunk(model, {}, 'tool_calls'));
      sse(res, usageChunk(model, 100, 15));
      res.write('data: [DONE]\n\n');
      res.end();
    } else if (last.role === 'tool' && userText.includes('思考')) {
      // 复现套壳推理模型的坏行为:工具结果回喂后只吐 reasoning_content,正文始终为空
      console.log('[mock] 思考模式:工具结果回喂后只返回 reasoning,无正文');
      for (const ch of '用户在要求导出,我已经写入文件了,该告诉用户结果…') {
        sse(res, chunk(model, { reasoning_content: ch }));
        await new Promise((r) => setTimeout(r, 2));
      }
      sse(res, chunk(model, {}, 'stop'));
      sse(res, usageChunk(model, 45, 0));
      res.write('data: [DONE]\n\n');
      res.end();
    } else if (last.role === 'tool' && userText.includes('静默')) {
      // 复现真实网关的一种坏行为:工具结果回喂后,模型返回"空内容"完成(stop 但没有任何 content delta)
      console.log('[mock] 静默模式:工具结果回喂后返回空 completion');
      sse(res, chunk(model, {}, 'stop'));
      sse(res, usageChunk(model, 40, 0));
      res.write('data: [DONE]\n\n');
      res.end();
    } else if (last.role === 'tool' && userText.includes('导出')) {
      await streamText(res, model, '好的,已按你的要求导出为 .st 文件。');
    } else if (last.role === 'tool') {
      await streamText(res, model, `已通过变量表和校验,星三角程序如下:\n\`\`\`\n${ST_CODE}\n\`\`\``);
    } else if (userText.includes('星三角')) {
      endWithToolCall(res, model);
    } else {
      // 回显 messages 数量:第二句话应能看到第一句的历史 → 验证 session 回放
      await streamText(res, model, `${REPLY} [msgs=${messages.length}]`);
    }
  });
});

const port = Number(process.argv[2]) || 8787;
server.listen(port, '127.0.0.1', () => console.log(`mock gateway on http://127.0.0.1:${port}/v1`));
