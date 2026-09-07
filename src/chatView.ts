import * as vscode from 'vscode';
import path from 'node:path';
import { runAgentTurn, validateConfig, MaxTurnsExceededError, MAX_TURNS } from './agent';
import { JsonFileSession, extractChatMessages } from './session';

/**
 * 侧边栏聊天视图:WebView(界面) ↔ 扩展进程(agent 内核) 通过 postMessage 通信。
 * 配置持久化:baseUrl/model 存 globalState,apiKey 存 SecretStorage(OS 级加密)。
 * 会话持久化:对话历史存 globalStorage/session.json(SDK Session 接口),面板重开自动回放。
 * 消息协议:
 *   webview → host: {type:'send', text} / {type:'clear'} / {type:'approvalResponse', approve}
 *                   {type:'getSettings'} / {type:'saveSettings', baseUrl, apiKey, model}
 *   host → webview: {type:'user'|'delta'|'tool'|'done'|'error'|'busy'|'idle'|'cleared'}
 *                   {type:'approval', name, args}(审批卡片) / {type:'history', messages}
 *                   {type:'settings', baseUrl, model, hasKey} / {type:'settingsSaved', model}
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private readonly session: JsonFileSession;
  private busy = false;
  private pendingApproval?: (ok: boolean) => void;

  constructor(private readonly context: vscode.ExtensionContext) {
    const storage = vscode.Uri.file(this.context.globalStorageUri.fsPath);
    this.session = new JsonFileSession(path.join(storage.fsPath, 'session.json'));
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    view.webview.html = this.buildHtml(view.webview);

    view.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'send' && typeof msg.text === 'string') {
        void this.send(msg.text);
      } else if (msg.type === 'clear') {
        void this.clear();
      } else if (msg.type === 'approvalResponse') {
        this.pendingApproval?.(msg.approve === true);
        this.pendingApproval = undefined;
      } else if (msg.type === 'getSettings') {
        void this.sendSettingsToWebview();
      } else if (msg.type === 'saveSettings') {
        void this.saveSettings(msg);
      }
    });

    // 面板(重)打开:回放持久化的历史,让用户接着上文继续
    void this.replayHistory();
  }

  private async replayHistory(): Promise<void> {
    const items = await this.session.getItems();
    this.post({ type: 'history', messages: extractChatMessages(items) });
  }

  async clear(): Promise<void> {
    await this.session.clearSession();
    this.post({ type: 'cleared' });
  }

  private post(msg: Record<string, unknown>): void {
    void this.view?.webview.postMessage(msg);
  }

  /** 配置优先级:插件内保存 > VSCode 设置 > 环境变量 > 默认值 */
  async getConfig() {
    const cfg = vscode.workspace.getConfiguration('plcAgent');
    const saved = this.context.globalState.get<{ baseUrl?: string; model?: string }>('settings') ?? {};
    const savedKey = (await this.context.secrets.get('apiKey')) ?? '';
    return {
      baseUrl: (saved.baseUrl || cfg.get<string>('baseUrl') || process.env.OPENAI_BASE_URL || '').trim(),
      apiKey: (savedKey || cfg.get<string>('apiKey') || process.env.OPENAI_API_KEY || '').trim(),
      model: (saved.model || cfg.get<string>('model') || process.env.AGENT_MODEL || 'gpt-4o-mini').trim(),
      savedInPlugin: !!(saved.baseUrl || saved.model || savedKey),
    };
  }

  private async sendSettingsToWebview(): Promise<void> {
    const cfg = await this.getConfig();
    this.post({
      type: 'settings',
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      hasKey: !!cfg.apiKey,
      source: cfg.savedInPlugin ? 'plugin' : 'other',
    });
  }

  private async saveSettings(msg: { baseUrl?: string; apiKey?: string; model?: string }): Promise<void> {
    const baseUrl = (msg.baseUrl ?? '').trim().replace(/\/+$/, '');
    const model = (msg.model ?? '').trim();
    await this.context.globalState.update('settings', { baseUrl, model });
    if (msg.apiKey) {
      await this.context.secrets.store('apiKey', msg.apiKey.trim());
    }
    void this.sendSettingsToWebview();
    this.post({ type: 'settingsSaved', model });
  }

  private async send(text: string): Promise<void> {
    if (this.busy) return;
    const cfg = {
      ...(await this.getConfig()),
      exportDir: path.join(this.context.globalStorageUri.fsPath, 'exports'),
      // 每次发消息时重新解析:用户可能后打开/切换工作区
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
    };
    const err = validateConfig(cfg);
    if (err) {
      this.post({ type: 'error', message: err });
      return;
    }

    this.busy = true;
    this.post({ type: 'busy' });
    this.post({ type: 'user', text });

    // 审批桥:内核遇到 needsApproval 工具时挂起,发审批卡片给界面,等用户点"允许/拒绝"
    const requestApproval = (name: string, args: string) =>
      new Promise<boolean>((resolve) => {
        this.pendingApproval = resolve;
        this.post({ type: 'approval', name, args });
      });

    try {
      const result = await runAgentTurn(cfg, this.session, text, (ev) => {
        if (ev.type === 'delta') this.post({ type: 'delta', text: ev.text });
        else if (ev.type === 'tool') this.post({ type: 'tool', name: ev.name });
      }, requestApproval);
      this.post({ type: 'done', usage: result.usage });
    } catch (e) {
      let message: string;
      if (e instanceof MaxTurnsExceededError) {
        message = `本轮模型往返超过 ${MAX_TURNS} 次上限,已自动停止(通常是模型反复调用工具)。请换个说法或把需求拆细。`;
      } else {
        message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      }
      this.post({ type: 'error', message });
    } finally {
      this.busy = false;
      this.post({ type: 'idle' });
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const js = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
    const css = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));
    const nonce = Array.from({ length: 16 }, () => Math.random().toString(36)[2] ?? '0').join('');

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

  <!-- 设置面板(齿轮打开) -->
  <div id="settings" class="settings hidden">
    <div class="settings-card">
      <div class="settings-title">模型配置 <span class="settings-sub">OpenAI Compatible · 保存后全局生效</span></div>
      <label>Base URL<input id="set-base" type="text" placeholder="https://你的网关/v1" spellcheck="false" /></label>
      <label>API Key<input id="set-key" type="password" placeholder="未设置" spellcheck="false" /></label>
      <label>Model<input id="set-model" type="text" placeholder="gpt-4o-mini" spellcheck="false" /></label>
      <div class="settings-actions">
        <button id="set-save" class="btn primary">保存</button>
        <button id="set-cancel" class="btn">取消</button>
      </div>
      <div class="settings-tip">Key 保存在系统安全存储(不会进 git / 同步)。配置一次,重开 VSCode 和 F5 调试窗口都生效。</div>
    </div>
  </div>

  <div class="composer">
    <div class="composer-box">
      <textarea id="input" rows="1" placeholder="请输入需求…(/指令 @文件 后续支持)"></textarea>
      <div class="composer-bar">
        <div class="left">
          <span class="chip" id="mode-chip">Agent ▾</span>
          <span class="chip model" id="model-chip" title="点击配置模型">未配置</span>
          <span class="chip action" id="newchat" title="清空当前会话,开始新对话">＋ 新会话</span>
        </div>
        <div class="right">
          <button id="gear" class="gear-btn" title="模型设置">⚙</button>
          <button id="send" class="send-btn" title="发送 (Enter)">↑</button>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}
