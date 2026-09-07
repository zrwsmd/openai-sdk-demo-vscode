// 编译产物级验证:加载 esbuild ESM 打包的 agent 内核,对 mock 网关跑三个场景
// 前置: node scripts/mock_gateway.mjs 8790
// 运行: node scripts/agent_kernel_test.mjs
import { runAgentTurn, MaxTurnsExceededError, MAX_TURNS } from './agent.testbundle.mjs';

const cfg = { baseUrl: 'http://127.0.0.1:8790/v1', apiKey: 'mock-key', model: 'mock-model' };

// 场景1:普通问候 → 应流式产出文本,usage 非零、requests=1
{
  let deltas = 0;
  const r = await runAgentTurn(cfg, [{ role: 'user', content: '你好' }], (ev) => {
    if (ev.type === 'delta') deltas++;
  });
  console.log('[1] 普通问候:', r.output.slice(0, 20) + '…', '| usage =', JSON.stringify(r.usage));
  if (deltas === 0 || r.usage.requests !== 1 || r.usage.inputTokens !== 120 || r.usage.outputTokens !== 34) {
    throw new Error('场景1 usage 汇总不符合预期');
  }
}

// 场景2:星三角 → 工具链(get_io_table → 最终回答),requests 应为 2(两次模型往返),usage 累加
{
  const tools = [];
  const r = await runAgentTurn(cfg, [{ role: 'user', content: '写一个电机星三角启动的 ST 程序,延时 5 秒切换' }], (ev) => {
    if (ev.type === 'tool') tools.push(ev.name);
  });
  console.log('[2] 工具链:', tools.join(','), '| 含ST代码 =', r.output.includes('END_PROGRAM'), '| usage =', JSON.stringify(r.usage));
  if (tools.length !== 1 || !r.output.includes('END_PROGRAM') || r.usage.requests !== 2) {
    throw new Error('场景2 工具链/usage 不符合预期');
  }
  if (r.usage.inputTokens !== 90 + 120 || r.usage.outputTokens !== 12 + 34) {
    throw new Error('场景2 usage 累加值不符合预期');
  }
}

// 场景3:循环 → 模型每次都请求工具,应在 MAX_TURNS 处抛 MaxTurnsExceededError
{
  let thrown = null;
  try {
    await runAgentTurn(cfg, [{ role: 'user', content: '写一个循环测试程序' }], () => {});
  } catch (e) {
    thrown = e;
  }
  console.log('[3] 死循环: 抛出 =', thrown?.constructor?.name, '| instanceof MaxTurnsExceededError =', thrown instanceof MaxTurnsExceededError);
  if (!(thrown instanceof MaxTurnsExceededError)) throw new Error('场景3 未触发 MaxTurnsExceededError');
}

console.log(`\n全部通过 ✔ (MAX_TURNS=${MAX_TURNS},注意场景3 mock 共被请求了 ${MAX_TURNS} 次模型往返)`);
