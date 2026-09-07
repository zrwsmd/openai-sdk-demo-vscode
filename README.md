# PLC 编程助手 VSCode 插件(OpenAI Agents SDK Demo)

CLI 版 demo(`F:\openai-sdk-demo` Python / `F:\openai-sdk-demo-node` JS)的 VSCode 插件形态:
侧边栏聊天界面,输入框提问,agent 在扩展进程里跑 `@openai/agents`,流式回答 + 工具调用提示。

界面参照主流 AI 助手面板:底部输入框(Enter 发送,Shift+Enter 换行)、模式/模型徽标、圆形发送按钮。

## 运行(F5 调试模式,无需打包)

```bash
cd F:/openai-sdk-demo-vscode
npm install
```

然后用 VSCode 打开这个文件夹,按 **F5**:

1. 会弹出"扩展开发宿主"窗口(一个新的 VSCode)
2. 左侧活动栏出现 **PLC Agent** 图标(机器人对话气泡),点开
3. 首次使用:点输入框右下角 ⚙ 齿轮,填 Base URL / API Key / Model 并保存(只需一次)
4. 底部输入框输入问题即可对话,工具调用会有 "⚙ 调用工具 get_io_table" 提示

试试:`写一个电机星三角启动的 ST 程序,延时 5 秒切换`

## 配置模型(配置一次,永久生效)

**推荐:插件内设置面板。** 点击输入框右下角的 ⚙ 齿轮(或点模型徽标),填三项:

| 字段 | 示例 |
|---|---|
| Base URL | `https://ai.duckduckport.top/v1`(OpenAI Compatible 网关,注意带 `/v1`) |
| API Key | 网关密钥(留空 = 不修改已保存的 Key) |
| Model | `gpt-5.6-sol` 等网关上可用的模型名 |

保存位置:Base URL / Model 存 `globalState`,**API Key 存 VSCode SecretStorage(系统级加密,不进 git、不随设置同步)**。
存一次后,重开 VSCode、按 F5 弹出的调试窗口都直接生效,不用再配。

兜底优先级:插件内设置 > VSCode 设置(`plcAgent.*`)> 环境变量(`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `AGENT_MODEL`)> 官方 API + gpt-4o-mini。

## 架构(为长成成熟 agent 而设计)

```
src/agent.ts          ← SDK 适配层:agent/工具注册、流式事件、RunState 中断与恢复
src/runCoordinator.ts ← 纯 Node 应用层:运行状态机、取消/重试、崩溃恢复(可复用于 CLI/边缘服务)
src/runStore.ts       ← JSON 持久化层:原子写、活动运行锁、副作用执行账本
src/workspaceTools.ts ← 工具实现层:文件边界、命令进程树、输出截断
src/session.ts        ← SDK Session 持久化与轮次边界回滚
src/chatView.ts       ← VS Code 适配层:WebView 消息和配置/SecretStorage
src/extension.ts      ← 激活入口:注册视图和命令
media/main.js         ← WebView 界面脚本(运行控制/审批/历史回放)
media/main.css        ← 界面样式
```

消息协议:webview 发 `{type:'send', text}` / `{type:'getSettings'}` / `{type:'saveSettings', ...}`,
host 回 `{type:'delta'|'tool'|'toolResult'|'done'|'error'|'busy'|'idle'|'approval'|'history'|'settings'|...}`。
Webview 永远拿不到明文 Key(host 只回 `hasKey` 布尔值)。
内核、运行生命周期、存储和界面分层：换工具/加护栏改 SDK 层；换存储实现 `RunStore`；
换 UI 只需要消费 `RunCoordinator` 事件，不把 VS Code API 带进核心运行时。

## 工具集(当前 8 个)

| 工具 | 作用 | 审批 |
|---|---|---|
| get_io_table | 查 I/O 变量表(演示假实现) | 免 |
| validate_st_code | ST 语法校验(演示假实现) | 免 |
| list_files / read_file / search_files | 读工作区:目录 / 文件(可分段)/ 文本搜索(glob+正则) | 免 |
| write_file | 写工作区文件(覆盖) | **需批准** |
| run_command | 工作区执行命令(60s 超时/输出截断) | **需批准** |
| export_st_program | ST 程序导出 .st 文件 | **需批准** |

安全边界:文件类工具的路径强制解析在当前工作区根内(`../` 与区外绝对路径直接拒绝),
遍历自动跳过 node_modules/.git/dist 等目录;纯函数实现在 `src/workspaceTools.ts`
(不依赖 SDK/VSCode,可单测),审批由工具层 `needsApproval` 统一拦截。

> SDK 自带工具说明:`web_search/file_search/code_interpreter` 等是 OpenAI Responses API
> 的**宿主工具**(模型服务端执行),我们的 chat_completions 网关用不了;
> `shellTool/applyPatchTool` 只有协议接口,具体执行要宿主自己注入。所以通用工具集自建。

## SDK 能力(已实现)

- **maxTurns 上限**:单次提问最多 `MAX_TURNS=10` 次模型往返,防止工具死循环把额度跑光。
  超限抛 `MaxTurnsExceededError`,界面给出友好提示而非无声刷屏。
- **每轮 token 用量**:从 SDK `RunState.usage` 读取聚合的 `inputTokens/outputTokens/requests`,
  回答下方右对齐显示 `📊 本轮 tokens:输入 X / 输出 Y,模型调用 N 次`(网关不回 usage 时自动隐藏)。
- **会话持久化(Session)**:对话历史由 SDK 的 `Session` 接口自动读写,落到扩展
  `storage/session.json`（无工作区时回退 `globalStorage`）。面板重开、F5 调试、重开 VSCode 都会自动回放历史;
  输入框左下"＋ 新会话"清空当前会话。自研 `JsonFileSession` 而非官方 sqlite 版,
  避免原生模块在插件里分发/重编的麻烦(见 `src/session.ts` 注释)。
- **可恢复 RunState**:SDK 在 `needsApproval` 前产生的 `RunState` 会写入
  工作区 `storage/runs.json`（无工作区时回退 `globalStorage`）；扩展宿主或 VS Code 重启后仍会恢复同一个审批卡片。
  用户决定先写回状态，再用 `runState.approve/reject` 续跑，不依赖内存 Promise。
- **取消与重试**:运行中可停止模型流和工具 `AbortSignal`；Windows 命令会终止整个子进程树。
  取消/异常会把 Session 回滚到本轮开始边界。重试生成新的 run id，但继承同一个
  operation id，避免把失败轮次重复写进对话历史。
- **副作用账本**:`write_file` / `run_command` / `export_st_program` 执行前先原子登记。
  整轮重试会按调用序号复用已完成结果；若进程在外部执行完成与本地确认之间崩溃，状态记为
  uncertain 并阻止自动重放，避免向 PLC/设备重复下发无法确认的动作。
- **单活动运行约束**:持久化层原子拒绝第二个活动任务，并防止旧异步回调重新激活终态任务。
- **工具执行回执(tool_result)**:内核从 `tool_call_output_item` 事件透出每个工具的执行结果,
  界面显示 `✓ write_file: {"ok":true,"file":"…","bytes":24}`(失败红色 ✗)。即使模型之后
  一言不发,用户也能看到工具成败——不再出现"点了允许没反应"。
- **空回复熔断(GatewayGuardedModel)**:部分网关会返回 `finish_reason=stop` 但 content 为空的
  completion(工具结果回喂后尤其常见),SDK 会把它当"未完成"反复重发直到烧满 maxTurns(实测
  10 连发仅 84ms,看门狗来不及拦)。包装 `OpenAIChatCompletionsModel.getStreamedResponse`,
  在模型层同步归因:单次响应无正文/无 tool_calls 记 1 次,连续 2 次抛 `EmptyGatewayResponseError`
  截停,按"本轮无文本"结束并给出明确提示。
- **运行日志**:视图 → 输出(OUTPUT) → 选 "PLC Agent",记录每轮消息、审批决定、工具回执、
  token 汇总与错误,网关行为异常时先看这里。

## 开发验证脚本

```bash
npm run compile      # VS Code 扩展产物
npm run test:batch   # store/coordinator/session/workspace tools（含命令取消）
node scripts/mock_gateway.mjs 8790
npm run test:agent   # SDK 工具链、审批、RunState 跨实例恢复、流取消
```

## 下一步路线(成熟化)

1. 定义工控 Tool Contract：风险等级、资源锁、超时、补偿/查询接口、审计字段
2. 把变量表、ST 编译器和 PLC 通信做成独立适配器，不直接耦合 Agent
3. 加 SDK guardrails、设备级权限与审批策略（读/写/运行分级）
4. 建立 SQLite/PostgreSQL `RunStore` 和可查询的审计日志，JSON 实现保留给单机开发
5. 工作区上下文、Markdown 渲染、多 Agent 编排与离线评测

## 打包发布(可选)

```bash
npm i -g @vscode/vsce
vsce package   # 生成 plc-agent-vscode-0.1.0.vsix
code --install-extension plc-agent-vscode-0.1.0.vsix
```
