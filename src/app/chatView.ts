import * as vscode from 'vscode';
import path from 'node:path';
import { setAgentLogger } from '../runtime/agent';
import { JsonFileSession } from '../runtime/session';
import { JsonRunStore, type DurableRunConfig } from '../runtime/runStore';
import { RunCoordinator, type RuntimeEvent } from '../runtime/runCoordinator';
import { JsonAuditSink } from '../observability/audit';
import {
  isAgentApiFormat,
  resolveApiFormat,
  type AgentApiFormat,
  type AgentApiFormatSetting,
  type AgentProvider,
} from '../runtime/modelAdapter';
import {
  API_SETTINGS_STATE_KEY,
  LEGACY_API_KEY_SECRET_KEY,
  LEGACY_SETTINGS_STATE_KEY,
  apiKeySecretKey,
  getStoredApiProfile,
  hasStoredApiProfiles,
  readLegacyApiSettings,
  readStoredApiSettings,
  saveStoredApiProfile,
} from './settingsProfiles';

/**
 * 侧边栏聊天视图:WebView(界面) ↔ 扩展进程(agent 内核) 通过 postMessage 通信。
 * 配置持久化:每个 provider/API format 独立保存 baseUrl/model，apiKey 存 SecretStorage(OS 级加密)。
 * 会话持久化:对话历史存 workspace storage/session.json(SDK Session 接口),无工作区回退 globalStorage。
 * 消息协议:
 *   webview → host: {type:'send', text} / {type:'clear'} / {type:'stop'} / {type:'retry'}
 *                   {type:'approvalResponse', runId, approvalId, approve}
 *                   {type:'getSettings', apiFormat?, requestId?}
 *                   {type:'saveSettings', baseUrl, apiKey, model, apiFormat}
 *   host → webview: {type:'user'|'done'|'error'|'busy'|'idle'|'cleared'}
 *                   {type:'agentEvent', event: AgentProtocolEvent} (stable SDK-independent stream)
 *                   {type:'approval', name, args}(审批卡片) / {type:'history', messages}
 *                   {type:'settings', baseUrl, model, apiFormat, hasKey, requestId?}
 *                   {type:'settingsSaved', model, apiFormat} / {type:'settingsError', message}
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
        void this.sendSettingsToWebview(
          isAgentApiFormat(msg.apiFormat) ? msg.apiFormat : undefined,
          Number.isInteger(msg.requestId) ? msg.requestId : undefined,
        );
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
  async getConfig(requestedApiFormat?: AgentApiFormat) {
    const cfg = vscode.workspace.getConfiguration('plcAgent');
    const savedProfiles = readStoredApiSettings(
      this.context.globalState.get<unknown>(API_SETTINGS_STATE_KEY),
    );
    const legacy = readLegacyApiSettings(
      this.context.globalState.get<unknown>(LEGACY_SETTINGS_STATE_KEY),
    );
    const allowedCommands = stringListSetting(cfg, 'allowedCommands', true);
    const allowedDevices = stringListSetting(cfg, 'allowedDevices');
    const provider = cfg.get<AgentProvider>('provider') ?? 'openai';
    const configuredApiFormat: AgentApiFormatSetting =
      savedProfiles.activeApiFormat
      ?? legacy.apiFormat
      ?? cfg.get<AgentApiFormatSetting>('apiFormat')
      ?? 'auto';
    const configuredBaseUrl = (
      legacy.baseUrl
      || cfg.get<string>('baseUrl')
      || process.env.OPENAI_BASE_URL
      || ''
    ).trim();
    const apiFormat = requestedApiFormat
      ?? resolveApiFormat(configuredBaseUrl, configuredApiFormat);
    const storedProfile = getStoredApiProfile(savedProfiles, apiFormat);
    const legacyHasValues = !!legacy.baseUrl || !!legacy.model || !!legacy.apiFormat;
    const legacyFormat = resolveApiFormat(
      legacy.baseUrl ?? configuredBaseUrl,
      legacy.apiFormat ?? 'auto',
    );
    const useLegacyProfile = !hasStoredApiProfiles(savedProfiles)
      && legacyHasValues
      && legacyFormat === apiFormat;
    const defaultModel = (
      cfg.get<string>('model')
      || process.env.AGENT_MODEL
      || 'gpt-4o-mini'
    ).trim();
    const baseUrl = storedProfile?.baseUrl
      ?? (useLegacyProfile ? legacy.baseUrl : undefined)
      ?? (hasStoredApiProfiles(savedProfiles) ? '' : configuredBaseUrl)
      ?? '';
    const model = storedProfile?.model
      || (useLegacyProfile ? legacy.model : undefined)
      || defaultModel;
    const formatKey = apiKeySecretKey(provider, apiFormat);
    const formatKeyValue = await this.context.secrets.get(formatKey);
    const legacyKeyValue = await this.context.secrets.get(LEGACY_API_KEY_SECRET_KEY);
    const legacyKeyApplies = !hasStoredApiProfiles(savedProfiles)
      || (legacyHasValues && legacyFormat === apiFormat);
    return {
      baseUrl,
      apiKey: (
        formatKeyValue
        || (legacyKeyApplies ? legacyKeyValue : undefined)
        || cfg.get<string>('apiKey')
        || process.env.OPENAI_API_KEY
        || ''
      ).trim(),
      model,
      provider,
      apiFormat,
      orchestration: cfg.get<'single' | 'team'>('orchestration') ?? 'single',
      policyContext: {
        allowedCommands,
        allowedDevices,
        dryRun: cfg.get<boolean>('dryRun') ?? false,
      },
      savedInPlugin: !!storedProfile || useLegacyProfile || !!formatKeyValue,
    };
  }

  private async sendSettingsToWebview(
    requestedApiFormat?: AgentApiFormat,
    requestId?: number,
  ): Promise<void> {
    try {
      const cfg = await this.getConfig(requestedApiFormat);
      this.post({
        type: 'settings',
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        provider: cfg.provider,
        apiFormat: cfg.apiFormat,
        hasKey: !!cfg.apiKey,
        source: cfg.savedInPlugin ? 'plugin' : 'other',
        ...(requestId === undefined ? {} : { requestId }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `读取模型配置失败: ${message}` });
    }
  }

  private async saveSettings(msg: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    apiFormat?: AgentApiFormat;
  }): Promise<void> {
    const baseUrl = (msg.baseUrl ?? '').trim().replace(/\/+$/, '');
    const model = (msg.model ?? '').trim();
    const apiFormat = isAgentApiFormat(msg.apiFormat) ? msg.apiFormat : undefined;
    if (!apiFormat) {
      this.post({ type: 'settingsError', message: '未选择有效的 API Format' });
      return;
    }
    try {
      const current = this.context.globalState.get<unknown>(API_SETTINGS_STATE_KEY);
      await this.context.globalState.update(
        API_SETTINGS_STATE_KEY,
        saveStoredApiProfile(current, apiFormat, { baseUrl, model }),
      );
      if (msg.apiKey?.trim()) {
        const provider = (await this.getConfig(apiFormat)).provider;
        await this.context.secrets.store(
          apiKeySecretKey(provider, apiFormat),
          msg.apiKey.trim(),
        );
      }
      this.post({ type: 'settingsSaved', model, apiFormat });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `保存模型配置失败: ${message}` });
    }
  }

  private async send(text: string): Promise<void> {
    const live = await this.getConfig();
    const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const config: DurableRunConfig = {
      baseUrl: live.baseUrl,
      model: live.model,
      provider: live.provider,
      apiFormat: live.apiFormat,
      exportDir: path.join((this.context.storageUri ?? this.context.globalStorageUri).fsPath, 'exports'),
      workspaceRoot: workspaceRoots[0] ?? '',
      workspaceRoots,
      policyContext: live.policyContext,
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
      <div class="settings-title">模型配置 <span class="settings-sub">OpenAI API · 保存后全局生效</span></div>
      <label>Base URL<input id="set-base" type="text" placeholder="https://你的网关/v1" spellcheck="false" /></label>
      <label>API Key<input id="set-key" type="password" placeholder="未设置" spellcheck="false" /></label>
      <label>Model<input id="set-model" type="text" placeholder="gpt-4o-mini" spellcheck="false" /></label>
      <label>API Format<select id="set-format">
        <option value="chat_completions">OpenAI Chat Completions</option>
        <option value="responses">OpenAI Responses</option>
      </select></label>
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

function stringListSetting(
  config: vscode.WorkspaceConfiguration,
  key: string,
  lowerCase = false,
): string[] {
  const value = config.get<unknown>(key);
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => {
      const trimmed = item.trim();
      return lowerCase ? trimmed.toLowerCase() : trimmed;
    })
    .filter(Boolean);
}
