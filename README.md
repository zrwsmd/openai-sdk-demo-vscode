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
src/agent.ts      ← agent 内核:工具、提示词、流式循环(纯 Node,不依赖 VSCode,可单测)
src/chatView.ts   ← WebView 宿主:消息协议桥接(界面 ↔ 内核)
src/extension.ts  ← 激活入口:注册视图和命令
media/main.js     ← WebView 界面脚本(渲染气泡、输入框)
media/main.css    ← 界面样式
```

消息协议:webview 发 `{type:'send', text}` / `{type:'getSettings'}` / `{type:'saveSettings', ...}`,
host 回 `{type:'delta'|'tool'|'done'|'error'|'settings'|'settingsSaved'|...}`。
Webview 永远拿不到明文 Key(host 只回 `hasKey` 布尔值)。
内核与界面完全解耦——换工具、加护栏、做多代理只改 `agent.ts`;换 UI 只改 `media/` + `chatView.ts`。

## 安全与用量(已实现)

- **maxTurns 上限**:单次提问最多 `MAX_TURNS=10` 次模型往返,防止工具死循环把额度跑光。
  超限抛 `MaxTurnsExceededError`,界面给出"超过上限已停止,换个说法"的友好提示而非崩溃。
- **每轮 token 用量**:流结束后从 `stream.rawResponses` 汇总 `inputTokens/outputTokens/requests`,
  回答下方右对齐显示一行 `📊 本轮 tokens:输入 X / 输出 Y,模型调用 N 次`。
  按额度付费的网关可据此估算消费;若网关流式不回 `usage` 字段则该行自动隐藏。

## 开发验证脚本

```bash
node scripts/mock_gateway.mjs 8790                 # 起模拟网关(流式/工具/usage/死循环四模式)
npx esbuild src/agent.ts --bundle --platform=node --format=esm --external:vscode \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
  --outfile=scripts/agent.testbundle.mjs           # 打包内核为 ESM 供测试 import
node scripts/agent_kernel_test.mjs                 # 产物级三场景:问候 / 工具链 usage 累加 / maxTurns 触发
```

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
