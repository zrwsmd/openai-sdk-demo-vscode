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
3. 底部输入框输入问题即可对话,工具调用会有 "⚙ 调用工具 get_io_table" 提示

试试:`写一个电机星三角启动的 ST 程序,延时 5 秒切换`

## 配置模型(三选一)

| 方式 | 设置 |
|---|---|
| VSCode 设置(推荐) | `plcAgent.baseUrl` / `plcAgent.apiKey` / `plcAgent.model` |
| 环境变量 | `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `AGENT_MODEL`(和 CLI 版相同) |
| 什么都不配 | 走官方 api.openai.com + gpt-4o-mini |

网关地址注意带 `/v1`,例如 `https://ai.duckduckport.top/v1`。

## 架构(为长成成熟 agent 而设计)

```
src/agent.ts      ← agent 内核:工具、提示词、流式循环(纯 Node,不依赖 VSCode,可单测)
src/chatView.ts   ← WebView 宿主:消息协议桥接(界面 ↔ 内核)
src/extension.ts  ← 激活入口:注册视图和命令
media/main.js     ← WebView 界面脚本(渲染气泡、输入框)
media/main.css    ← 界面样式
```

消息协议:webview 发 `{type:'send', text}`,host 回 `{type:'delta'|'tool'|'done'|'error'|...}`。
内核与界面完全解耦——换工具、加护栏、做多代理只改 `agent.ts`;换 UI 只改 `media/`。

## 下一步路线(成熟化)

1. 真实工具:变量表读文件、ST 代码落盘、接真实编译器
2. 工作区集成:@文件 引用当前文件、选中代码作为上下文
3. 安全护栏:SDK guardrails、危险操作确认(tool approval)
4. 会话持久化、停止/重试按钮、markdown 完整渲染

## 打包发布(可选)

```bash
npm i -g @vscode/vsce
vsce package   # 生成 plc-agent-vscode-0.1.0.vsix
code --install-extension plc-agent-vscode-0.1.0.vsix
```
