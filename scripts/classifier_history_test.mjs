import assert from 'node:assert/strict';
import { projectHistoryForClassifier } from './agent.testbundle.mjs';

// 助手回答在会话里存的是 IndustrialAgentOutput 的裸 JSON。分类器原样吃下它，
// 就会照着这个形状回答，schema 校验必挂，所以喂进去之前要先还原成正文。
const structured = JSON.stringify({
  message: '\n\n当前诗词库共有 13 首。',
  diagnostics: [],
  artifacts: [],
  data: null,
});

const history = [
  { type: 'message', role: 'user', content: '当前有哪些古诗词' },
  { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: structured }] },
  { type: 'message', role: 'user', content: '看看关山月这首' },
];
const projected = projectHistoryForClassifier(history);
assert.equal(projected.length, 3);
assert.equal(projected[1].content[0].text, '\n\n当前诗词库共有 13 首。');
assert.equal(projected[0].content, '当前有哪些古诗词');
assert.equal(projected[2].content, '看看关山月这首');
// 原历史不能被就地改写
assert.equal(history[1].content[0].text, structured);

// 落盘形态是双份编码：内容部分本身是一段 JSON 文本
const doubleEncoded = JSON.stringify([{ type: 'output_text', text: structured }]);
const nested = projectHistoryForClassifier([
  { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: doubleEncoded }] },
]);
assert.equal(nested[0].content[0].text, '\n\n当前诗词库共有 13 首。');

// content 直接是字符串的形态
const stringContent = projectHistoryForClassifier([
  { type: 'message', role: 'assistant', content: structured },
]);
assert.equal(stringContent[0].content, '\n\n当前诗词库共有 13 首。');

// 普通散文不动
const plain = [
  { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '你好' }] },
];
assert.deepEqual(projectHistoryForClassifier(plain), plain);

// 用户消息不动
const userItem = [{ type: 'message', role: 'user', content: structured }];
assert.deepEqual(projectHistoryForClassifier(userItem), userItem);

// 工具链条目不动
const toolItem = [{ type: 'function_call', name: 'list_files', arguments: '{}' }];
assert.deepEqual(projectHistoryForClassifier(toolItem), toolItem);

// 带 message 字段但不是结构化输出的 JSON 不动
const otherJson = [{ type: 'message', role: 'assistant', content: '{"foo":1}' }];
assert.deepEqual(projectHistoryForClassifier(otherJson), otherJson);

// 坏 JSON 不动，不能抛
const broken = [{ type: 'message', role: 'assistant', content: '{不是 JSON' }];
assert.deepEqual(projectHistoryForClassifier(broken), broken);

console.log('classifier history tests passed');
