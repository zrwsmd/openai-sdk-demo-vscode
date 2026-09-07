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
src/agent.ts          ← agent 内核:工具(含审批工具)、提示词、流式循环、中断/恢复(纯 Node,可单测)
src/workspaceTools.ts ← 通用文件/命令工具的纯函数实现(路径越界拦截、目录跳过、输出截断)
src/session.ts        ← JSON 文件版 Session(SDK 会话持久化接口实现)
src/chatView.ts   ← WebView 宿主:消息协议桥接、配置读写、审批桥(界面 ↔ 内核)
src/extension.ts  ← 激活入口:注册视图和命令
media/main.js     ← WebView 界面脚本(气泡/审批卡片/历史回放/输入框)
media/main.css    ← 界面样式
```

消息协议:webview 发 `{type:'send', text}` / `{type:'getSettings'}` / `{type:'saveSettings', ...}`,
host 回 `{type:'delta'|'tool'|'toolResult'|'done'|'error'|'busy'|'idle'|'approval'|'history'|'settings'|...}`。
Webview 永远拿不到明文 Key(host 只回 `hasKey` 布尔值)。
内核与界面完全解耦——换工具、加护栏、做多代理只改 `agent.ts`;换 UI 只改 `media/` + `chatView.ts`。

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
- **每轮 token 用量**:流结束后从 `stream.rawResponses` 汇总 `inputTokens/outputTokens/requests`,
  回答下方右对齐显示 `📊 本轮 tokens:输入 X / 输出 Y,模型调用 N 次`(网关不回 usage 时自动隐藏)。
- **会话持久化(Session)**:对话历史由 SDK 的 `Session` 接口自动读写,落到扩展
  `globalStorage/session.json`。面板重开、F5 调试、重开 VSCode 都会自动回放历史;
  输入框左下"＋ 新会话"清空当前会话。自研 `JsonFileSession` 而非官方 sqlite 版,
  避免原生模块在插件里分发/重编的麻烦(见 `src/session.ts` 注释)。
- **工具审批(needsApproval)**:`export_st_program`(写文件)标记 `needsApproval:true`。
  内核执行前 SDK 中断 → 界面弹出审批卡片(可展开查看参数)→ 用户"允许"才落盘、
  "拒绝"则该工具被拒。这套中断/恢复循环(`runState.approve/reject` + 带 `state` 续跑)
  是以后 `write_program` 等危险操作的通用安全底座。
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
node scripts/mock_gateway.mjs 8790                 # 模拟网关五模式:问候/星三角工具链/导出审批/死循环/静默(工具后空回复)
npx esbuild scripts/test_entry.ts --bundle --platform=node --format=esm --external:vscode \
  --target=node18 --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
  --outfile=scripts/agent.testbundle.mjs           # 打包内核+会话+工具为 ESM 供测试 import
node scripts/agent_kernel_test.mjs                 # 产物级 9 场景:回放/持久化/工具链/审批允许+拒绝/maxTurns/clear/静默熔断
node scripts/workspace_tools_test.mjs              # 文件工具层 6 单测:列表/读取分段/写入/搜索/越界拦截/命令退出码
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
