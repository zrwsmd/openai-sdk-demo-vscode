import * as vscode from 'vscode';
import path from 'node:path';
import { setAgentLogger } from '../runtime/agent';
import { JsonFileSession } from '../runtime/session';
import { JsonRunStore, type DurableRunConfig } from '../runtime/runStore';
import { RunCoordinator, type RuntimeEvent } from '../runtime/runCoordinator';
import { JsonAuditSink } from '../observability/audit';

/**
 * 侧边栏聊天视图:WebView(界面) ↔ 扩展进程(agent 内核) 通过 postMessage 通信。
 * 配置持久化:baseUrl/model 存 globalState,apiKey 存 SecretStorage(OS 级加密)。
 * 会话持久化:对话历史存 workspace storage/session.json(SDK Session 接口),无工作区回退 globalStorage。
 * 消息协议:
 *   webview → host: {type:'send', text} / {type:'clear'} / {type:'stop'} / {type:'retry'}
 *                   {type:'approvalResponse', runId, approvalId, approve}
 *                   {type:'getSettings'} / {type:'saveSettings', baseUrl, apiKey, model}
 *   host → webview: {type:'user'|'delta'|'tool'|'toolResult'|'done'|'error'|'busy'|'idle'|'cleared'}
 *                   {type:'agentEvent', event: AgentProtocolEvent} (stable SDK-independent stream)
 *                   {type:'approval', name, args}(审批卡片) / {type:'history', messages}
 *                   {type:'settings', baseUrl, model, hasKey} / {type:'settingsSaved', model}
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private readonly session: JsonFileSession;
  private readonly coordinator: RunCoordinator;
  private readonly log: vscode.OutputChannel;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Keep run/session/effect state isolated per workspace. A no-folder chat
    // falls back to extension-global storage so it remains usable standalone.
    const storage = this.context.storageUri ?? this.context.globalStorageUri;
    this.session = new JsonFileSession(path.join(storage.fsPath, 'session.json'));
    const runStore = new JsonRunStore(path.join(storage.fsPath, 'runs.json'));
    const audit = new JsonAuditSink(path.join(storage.fsPath, 'audit.json'));
    // 诊断日志:视图 → 输出(OUTPUT) → 选 "PLC Agent"。网关返回空文本/报错时在这里能看到原始情况
    this.log = vscode.window.createOutputChannel('PLC Agent');
    setAgentLogger((line) => this.log.appendLine(line)); // 网关原始请求结构 / SSE 解析摘要也进这个面板
    this.coordinator = new RunCoordinator({
      session: this.session,
      store: runStore,
      emit: (event) => this.post(event),
      log: (line) => this.log.appendLine(line),
      audit,
    });
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
        void this.resolveApproval(msg);
      } else if (msg.type === 'stop') {
        void this.stop();
      } else if (msg.type === 'retry') {
        void this.retry();
      } else if (msg.type === 'getSettings') {
        void this.sendSettingsToWebview();
      } else if (msg.type === 'saveSettings') {
        void this.saveSettings(msg);
      }
    });

    void this.coordinator.initialize()
      .catch((error) => {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        this.log.appendLine(`[recovery] ${message}`);
        this.post({ type: 'error', message });
      });
  }

  async clear(): Promise<void> {
    await this.coordinator.clear();
  }

  private post(msg: RuntimeEvent | Record<string, unknown>): void {
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
      orchestration: cfg.get<'single' | 'team'>('orchestration') ?? 'single',
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
    const live = await this.getConfig();
    const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const config: DurableRunConfig = {
      baseUrl: live.baseUrl,
      model: live.model,
      exportDir: path.join((this.context.storageUri ?? this.context.globalStorageUri).fsPath, 'exports'),
      workspaceRoot: workspaceRoots[0] ?? '',
      workspaceRoots,
      orchestration: live.orchestration,
    };
    await this.coordinator.start(text, config, live.apiKey);
  }

  private async resolveApproval(msg: { runId?: string; approvalId?: string; approve?: boolean }): Promise<void> {
    const live = await this.getConfig();
    await this.coordinator.approve(msg.runId ?? '', msg.approvalId ?? '', msg.approve === true, live.apiKey);
  }

  private async stop(): Promise<void> {
    await this.coordinator.stop();
  }

  private async retry(): Promise<void> {
    const live = await this.getConfig();
    await this.coordinator.retry(live.apiKey);
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
          <button id="retry" class="tool-btn" title="重试上一轮" disabled>↻</button>
          <button id="stop" class="tool-btn danger hidden" title="停止本轮">■</button>
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
