import assert from 'node:assert/strict';
import { unwrapStructuredMessage } from './agent.testbundle.mjs';

/* ------------------------------------------------------------------ */
/* 最终文案守卫：模型/收尾器把整段 JSON 当 message 返回时不能直接展示      */
/* ------------------------------------------------------------------ */

// 正常正文原样返回。
assert.equal(unwrapStructuredMessage('已完成：ST 程序已交付。'), '已完成：ST 程序已交付。');
assert.equal(unwrapStructuredMessage('  '), '');
assert.equal(unwrapStructuredMessage(undefined), '');

// 标准结构化对象：取内层 message。
assert.equal(
  unwrapStructuredMessage('{"message":"已交付 st\\\\Main.st","diagnostics":[],"artifacts":[],"data":null}'),
  '已交付 st\\Main.st',
);

// 双层编码：message 里还是一段 JSON 字符串，要再拆一层。
assert.equal(
  unwrapStructuredMessage(JSON.stringify({ message: JSON.stringify({ message: '真正的结论' }) })),
  '真正的结论',
);

// 模型中途断掉、JSON 解析不了：把第一个 message 字段抠出来。
const truncated =
  '{"message":"已完成：根据运行时证据，程序已交付。","diagnostics":[{"code":"ST_DELIVERY_COMPLETED","message":"validate 通过","severity":"info","path":null},{"code":"ARTIFACT_CONTENT_UNAVAILABLE","message":"未提供正文","severity":"info","path":"st\\\\Main';
assert.equal(unwrapStructuredMessage(truncated), '已完成：根据运行时证据，程序已交付。');

// 断了而且连 message 字段都没有：宁可没有正文，也不能把 JSON 推给用户。
assert.equal(unwrapStructuredMessage('{"diagnostics":[{"code":"X","mess'), '');

// 结构化对象里没有可用的 message：同样不展示。
assert.equal(unwrapStructuredMessage('{"diagnostics":[],"artifacts":[],"data":null}'), '');
assert.equal(unwrapStructuredMessage('["a","b"]'), '');

// 转义字符要正确还原，不能把 \\n 原样贴出去。
assert.equal(unwrapStructuredMessage('{"message":"第一行\\n第二行"}'), '第一行\n第二行');

console.log('final message guard tests passed');
