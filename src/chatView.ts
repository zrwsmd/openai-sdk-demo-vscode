import * as vscode from 'vscode';
import { runAgentTurn, validateConfig, type ChatHistory } from './agent';

/**
 * 侧边栏聊天视图:WebView(界面) ↔ 扩展进程(agent 内核) 通过 postMessage 通信。
 * 消息协议:
 *   webview → host: {type:'send', text} / {type:'clear'}
 *   host → webview: {type:'user', text} / {type:'delta', text} / {type:'tool', name}
 *                   {type:'done'} / {type:'error', message} / {type:'busy'} / {type:'idle'}
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private history: ChatHistory = [];
  private busy = false;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = this.buildHtml(view.webview);

    view.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'send' && typeof msg.text === 'string') {
        void this.send(msg.text);
      } else if (msg.type === 'clear') {
        this.history = [];
      }
    });
  }

  clear(): void {
    this.history = [];
    this.post({ type: 'cleared' });
  }

  private post(msg: Record<string, unknown>): void {
    void this.view?.webview.postMessage(msg);
  }

  /** 配置优先级:VSCode 设置 > 环境变量 > 默认值(与 CLI 版一致) */
  private config() {
    const cfg = vscode.workspace.getConfiguration('plcAgent');
    return {
      baseUrl: (cfg.get<string>('baseUrl') || process.env.OPENAI_BASE_URL || '').trim(),
      apiKey: (cfg.get<string>('apiKey') || process.env.OPENAI_API_KEY || '').trim(),
      model: (cfg.get<string>('model') || process.env.AGENT_MODEL || 'gpt-4o-mini').trim(),
    };
  }

  private async send(text: string): Promise<void> {
    if (this.busy) return;
    const cfg = this.config();
    const err = validateConfig(cfg);
    if (err) {
      this.post({ type: 'error', message: err });
      return;
    }

    this.busy = true;
    this.post({ type: 'busy' });
    this.post({ type: 'user', text });
    this.history = [...this.history, { role: 'user', content: text }];

    try {
      const result = await runAgentTurn(cfg, this.history, (ev) => {
        if (ev.type === 'delta') this.post({ type: 'delta', text: ev.text });
        else if (ev.type === 'tool') this.post({ type: 'tool', name: ev.name });
      });
      this.history = result.history;
      this.post({ type: 'done' });
    } catch (e) {
      const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      this.post({ type: 'error', message });
    } finally {
      this.busy = false;
      this.post({ type: 'idle' });
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const js = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'));
    const css = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'));
    const nonce = Array.from({ length: 16 }, () => Math.random().toString(36)[2] ?? '0').join('');
    const model = this.config().model;

    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;" />
  <link rel="stylesheet" href="${css}" />
  <title>PLC 编程助手</title>
</head>
<body>
  <div id="messages" aria-live="polite"></div>

  <div class="composer">
    <div class="composer-box">
      <textarea id="input" rows="1" placeholder="请输入需求…(/指令 @文件 后续支持)"></textarea>
      <div class="composer-bar">
        <div class="left">
          <span class="chip" id="mode-chip">Agent ▾</span>
          <span class="chip model" id="model-chip" title="在设置里改 plcAgent.model">${model}</span>
        </div>
        <button id="send" class="send-btn" title="发送 (Enter)">↑</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}
