import * as vscode from 'vscode';
import path from 'node:path';
import {
  classifyDeliveryContract,
  classifyWorkflowDecision,
  planTask,
  setAgentLogger,
} from '../runtime/agent';
import {
  createStAnalyzerConfigExtension,
  createStRuntimeServicesFactory,
} from './analyzerHost';
import { createDevuniCommandPort, type CreatedDevuniProject } from './devuniHost';
import { DEVUNI_COMMAND_PORT_SERVICE } from '../runtime/plugins/devuni/devuniCommandPort';
import { workspaceRootsFromWorkspaceFile } from '../runtime/plugins/devuni/devuniProjectRoots';
import { createRuntimeServiceContainer } from '../runtime/services';
import { JsonFileSession } from '../runtime/session';
import { JsonRunStore, type DurableRunConfig } from '../runtime/runStore';
import { RunCoordinator, type RuntimeEvent } from '../runtime/runCoordinator';
import type { AgentProtocolEvent } from '../protocol/events';
import { JsonAuditSink } from '../observability/audit';
import { ChatSessionCatalog, titleFromUserText } from './chatSessions';
import {
  createProjectHandoffSession,
  ProjectWindowHandoffStore,
  type ProjectWindowHandoffInput,
} from './projectWindowHandoff';
import { AgentDecisionService } from '../runtime/decision/agentDecision';
import { createAppWorkflowRegistry } from './workflowRegistry';
import { createAppToolRegistry } from './toolRegistry';
import {
  isAgentApiFormat,
  isAgentProvider,
  resolveApiFormat,
  type AgentApiFormat,
  type AgentApiFormatSetting,
  type AgentProvider,
} from '../runtime/modelAdapter';
import { isPermissionMode, type PermissionMode } from '../runtime/agentConfig';
import {
  emptyMcpSettings,
  loadMcpSettings,
  MCP_CONFIG_RELATIVE_PATH,
  parseMcpServerInput,
  readMcpConfigFile,
  removeMcpServer,
  interpolateMcpSettings,
  setMcpServerEnabled,
  upsertMcpServer,
  writeMcpConfigFile,
  mcpConfigFilePath,
  type McpSettings,
} from '../runtime/mcp/mcpConfig';
import { probeMcpServer } from '../runtime/mcp/mcpSession';
import { McpConnectionPool } from '../runtime/mcp/mcpConnectionPool';
import {
  API_SETTINGS_STATE_KEY,
  LEGACY_API_KEY_SECRET_KEY,
  LEGACY_SETTINGS_STATE_KEY,
  apiKeySecretKey,
  apiKeySecretCandidates,
  createVendorId,
  deleteStoredVendor,
  defaultVendorName,
  getStoredApiProfile,
  listStoredVendors,
  providerForApiFormat,
  readLegacyApiSettings,
  readStoredApiSettings,
  resolveStoredVendor,
  saveStoredVendor,
  vendorApiKeySecretKey,
} from './settingsProfiles';

/**
 * 侧边栏聊天视图:WebView(界面) ↔ 扩展进程(agent 内核) 通过 postMessage 通信。
 * 配置持久化:每个 API format 可保存多个命名供应商(baseUrl/model)，apiKey 存 SecretStorage(OS 级加密)。
 * 会话持久化:每个工作区维护多会话索引,每个会话独立保存 SDK Session 与运行状态。
 * 消息协议:
 *   webview → host: {type:'send', text} / {type:'clear'} / {type:'newSession'} / {type:'switchSession', sessionId}
 *                   {type:'renameSession', sessionId, title} / {type:'deleteSession', sessionId}
 *                   {type:'stop'} / {type:'retry'}
 *                   {type:'continue'}
 *                   {type:'approvalResponse', runId, approvalId, approve}
 *                   {type:'clarificationResponse', runId, requestId, cancelled, selectedOptionId?, customText?}
 *                   {type:'getSettings', apiFormat?, vendorId?, requestId?}
 *                   {type:'saveSettings', vendorId?, name, baseUrl, apiKey, model, apiFormat}
 *                   {type:'deleteVendor', vendorId}
 *                   {type:'setPermissionMode', permissionMode}
 *                   {type:'setMcpServerEnabled', name, enabled}
 *                   {type:'probeMcpServers'}
 *                   {type:'saveMcpServer', name, originalName?, transport, command?, args?, url?, cwd?, env?}
 *                   {type:'deleteMcpServer', name}
 *                   {type:'openMcpConfig'}
 *                   {type:'pluginCommand', command, args?, actionKey?}
 *   host → webview: {type:'user'|'done'|'error'|'busy'|'idle'|'cleared'}
 *                   {type:'sessions', sessions, activeSessionId}
 *                   {type:'agentEvent', event: AgentProtocolEvent} (stable SDK-independent stream)
 *                   {type:'approval', name, args}(审批卡片) / {type:'history', messages}
 *                   {type:'settings', baseUrl, model, apiFormat, vendorId, vendors, hasKey, requestId?}
 *                   {type:'settingsSaved', model, apiFormat, vendorId} / {type:'settingsError', message}
 *                   {type:'permissionModeSaved', permissionMode}
 *                   {type:'mcpStatus', name, status, error?, toolCount?}
 *                   {type:'pluginCommandResult', actionKey, ok, error?}(工具动作执行回执)
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private coordinator?: RunCoordinator;
  private activeSessionId = '';
  private readonly sessionCatalog: ChatSessionCatalog;
  private readonly storageRoot: string;
  private readonly log: vscode.OutputChannel;
  private readonly decisionService: AgentDecisionService;
  private readonly workflowRegistry = createAppWorkflowRegistry();
  private readonly toolRegistry = createAppToolRegistry();
  /**
   * MCP 连接池归窗口，不归会话。
   *
   * 会话切换只是换一个运行对象，池子留在这儿，连接就跟着留下来——不然每切一次
   * 都要把所有服务器重新拉起来一遍（Java 那种冷启动接近三秒）。收尾挂到
   * context.subscriptions 上，扩展停用时自动关。
   */
  private readonly mcpPool: McpConnectionPool;
  private readonly projectHandoffStore: ProjectWindowHandoffStore;
  private readonly activeProtocolRunIds = new Map<string, string>();
  private readonly pendingProjectWindows = new Map<
    string,
    { runId?: string; completed: boolean; input: ProjectWindowHandoffInput }
  >();
  /** Session-specific roots restored from persisted chat or project handoff state. */
  private readonly sessionWorkspaceRoots = new Map<string, string[]>();
  private mcpProbeGeneration = 0;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Keep run/session/effect state isolated per workspace. A no-folder chat
    // falls back to extension-global storage so it remains usable standalone.
    const storage = this.context.storageUri ?? this.context.globalStorageUri;
    this.storageRoot = storage.fsPath;
    this.sessionCatalog = new ChatSessionCatalog(this.storageRoot);
    this.projectHandoffStore = new ProjectWindowHandoffStore(this.context.globalStorageUri.fsPath);
    // 诊断日志:视图 → 输出(OUTPUT) → 选 "PLC Agent"。网关返回空文本/报错时在这里能看到原始情况
    this.log = vscode.window.createOutputChannel('PLC Agent');
    setAgentLogger((line) => this.log.appendLine(line)); // 网关原始请求结构 / SSE 解析摘要也进这个面板
    this.mcpPool = new McpConnectionPool({ log: (line) => this.log.appendLine(line) });
    this.context.subscriptions.push({
      dispose: () => void this.mcpPool.dispose(),
    });
    this.decisionService = new AgentDecisionService((line) => this.log.appendLine(line));
    this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('plcAgent.ui.showThinking') ||
        event.affectsConfiguration('plcAgent.permissionMode')
      ) {
        void this.sendSettingsToWebview();
      }
    }));
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
      } else if (msg.type === 'newSession') {
        void this.newSession();
      } else if (msg.type === 'switchSession' && typeof msg.sessionId === 'string') {
        void this.switchSession(msg.sessionId);
      } else if (msg.type === 'renameSession' && typeof msg.sessionId === 'string' && typeof msg.title === 'string') {
        void this.renameSession(msg.sessionId, msg.title);
      } else if (msg.type === 'deleteSession' && typeof msg.sessionId === 'string') {
        void this.deleteSession(msg.sessionId);
      } else if (msg.type === 'approvalResponse') {
        void this.resolveApproval(msg);
      } else if (msg.type === 'clarificationResponse') {
        void this.resolveClarification(msg);
      } else if (msg.type === 'stop') {
        void this.stop();
      } else if (msg.type === 'retry') {
        void this.retry();
      } else if (msg.type === 'continue') {
        void this.continueRun();
      } else if (msg.type === 'getSettings') {
        void this.sendSettingsToWebview(
          isAgentProvider(msg.provider) ? msg.provider : undefined,
          isAgentApiFormat(msg.apiFormat) ? msg.apiFormat : undefined,
          Number.isInteger(msg.requestId) ? msg.requestId : undefined,
          typeof msg.vendorId === 'string' ? msg.vendorId : undefined,
        );
      } else if (msg.type === 'saveSettings') {
        void this.saveSettings(msg);
      } else if (msg.type === 'deleteVendor') {
        void this.deleteVendor(msg.vendorId);
      } else if (msg.type === 'setPermissionMode') {
        void this.setPermissionMode(msg.permissionMode);
      } else if (msg.type === 'saveMcpServer') {
        void this.saveMcpServer(msg);
      } else if (msg.type === 'deleteMcpServer') {
        void this.deleteMcpServer(msg.name);
      } else if (msg.type === 'openMcpConfig') {
        void this.openMcpConfig();
      } else if (msg.type === 'setMcpServerEnabled') {
        void this.setMcpEnabled(msg.name, msg.enabled);
      } else if (msg.type === 'probeMcpServers') {
        void this.probeMcpServers();
      } else if (msg.type === 'pluginCommand' && typeof msg.command === 'string') {
        void this.runPluginCommand(
          msg.command,
          Array.isArray(msg.args) ? msg.args : [],
          typeof msg.actionKey === 'string' ? msg.actionKey : '',
        );
      } else if (msg.type === 'copyText') {
        void this.copyTextToClipboard(msg.text, msg.requestId);
      }
    });

    void this.initializeActiveSession()
      .catch((error) => {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        this.log.appendLine(`[recovery] ${message}`);
        this.post({ type: 'error', message });
      });
  }

  /**
   * 复制走宿主：webview 的 navigator.clipboard 受 iframe 焦点和权限限制，
   * execCommand 失败时又只返回 false 不报错，只有 vscode.env.clipboard 是可靠的。
   */
  private async copyTextToClipboard(text: unknown, requestId: unknown): Promise<void> {
    const id = typeof requestId === 'number' ? requestId : undefined;
    try {
      await vscode.env.clipboard.writeText(typeof text === 'string' ? text : '');
      this.post({ type: 'copyTextResult', requestId: id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.appendLine(`[clipboard] 写入剪贴板失败: ${message}`);
      this.post({ type: 'copyTextResult', requestId: id, ok: false, error: message });
    }
  }

  async clear(): Promise<void> {
    await this.ensureRuntime();
    await this.coordinator!.clear();
    await this.sessionCatalog.touch(this.activeSessionId);
    await this.postSessions();
  }

  /**
   * A newly opened project window starts with an isolated session containing
   * only the deterministic project summary carried through global storage.
   */
  async restoreProjectWindowHandoff(): Promise<boolean> {
    const claim = await this.projectHandoffStore.claimForWorkspace(
      vscode.workspace.workspaceFile?.fsPath,
      (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
    );
    if (!claim) return false;
    try {
      const session = await createProjectHandoffSession(this.sessionCatalog, claim.handoff);
      this.sessionWorkspaceRoots.set(session.id, [...claim.handoff.projectRoots]);
      await claim.complete();
      this.log.appendLine(
        `[workspace] 已在新工程窗口创建独立会话: ${claim.handoff.workspaceFile}`,
      );
      return true;
    } catch (error) {
      await claim.release().catch(() => undefined);
      throw error;
    }
  }

  private post(msg: RuntimeEvent | Record<string, unknown>): void {
    void this.view?.webview.postMessage(msg);
  }

  private async initializeActiveSession(): Promise<void> {
    const index = await this.sessionCatalog.initialize();
    const active = index.sessions.find((session) => session.id === index.activeSessionId);
    this.sessionWorkspaceRoots.set(index.activeSessionId, [...(active?.workspaceRoots ?? [])]);
    this.activateRuntime(index.activeSessionId);
    await this.postSessions();
    await this.coordinator!.initialize();
  }

  private async ensureRuntime(): Promise<void> {
    if (this.coordinator && this.activeSessionId) return;
    await this.initializeActiveSession();
  }

  private activateRuntime(sessionId: string): void {
    const paths = this.sessionCatalog.pathsFor(sessionId);
    const session = new JsonFileSession(paths.sessionFile);
    const runStore = new JsonRunStore(paths.runStoreFile);
    const audit = new JsonAuditSink(paths.auditFile);
    this.activeSessionId = sessionId;
    this.coordinator = new RunCoordinator({
      session,
      store: runStore,
      emit: (event) => {
        if (this.activeSessionId === sessionId) this.post(event);
        this.handleProjectWindowRuntimeEvent(sessionId, event);
      },
      log: (line) => this.log.appendLine(line),
      decisionService: this.decisionService,
      workflowRegistry: this.workflowRegistry,
      toolRegistry: this.toolRegistry,
      mcpPool: this.mcpPool,
      planTask,
      classifyWorkflowDecision,
      classifyDeliveryContract,
      createRuntimeServices: (config) => {
        // 各领域自己装配自己那份宿主能力,这里只做合并,不让插件互相知道对方。
        const stServices = createStRuntimeServicesFactory(
          this.context,
          (line) => this.log.appendLine(line),
        )(config);
        return createRuntimeServiceContainer([
          ...stServices,
          [
            DEVUNI_COMMAND_PORT_SERVICE,
            createDevuniCommandPort({
              onProjectCreated: async (project) => {
                const projectRoots = await workspaceRootsFromWorkspaceFile(project.workspaceFile);
                if (!projectRoots.length) return;
                this.rememberProjectWindow(sessionId, project, projectRoots);
              },
            }),
          ] as const,
        ]);
      },
      audit,
    });
  }

  private rememberProjectWindow(
    sessionId: string,
    project: CreatedDevuniProject,
    projectRoots: readonly string[],
  ): void {
    this.pendingProjectWindows.set(sessionId, {
      runId: this.activeProtocolRunIds.get(sessionId),
      completed: false,
      input: {
        workspaceFile: project.workspaceFile,
        projectRoots,
        ...(project.projectName ? { projectName: project.projectName } : {}),
        ...(project.parentDirectory ? { parentDirectory: project.parentDirectory } : {}),
        ...(project.deviceModel ? { deviceModel: project.deviceModel } : {}),
        ...(project.language ? { language: project.language } : {}),
        ...(project.projectType ? { projectType: project.projectType } : {}),
      },
    });
  }

  private handleProjectWindowRuntimeEvent(sessionId: string, event: RuntimeEvent): void {
    if (event.type === 'agentEvent') {
      const protocolEvent = event.event as AgentProtocolEvent;
      if (protocolEvent.type === 'run.started') {
        this.activeProtocolRunIds.set(sessionId, protocolEvent.runId);
        return;
      }
      const pending = this.pendingProjectWindows.get(sessionId);
      if (!pending || (pending.runId && pending.runId !== protocolEvent.runId)) return;
      if (protocolEvent.type === 'run.completed') {
        pending.completed = true;
        return;
      }
      if (
        protocolEvent.type === 'run.failed' ||
        protocolEvent.type === 'run.cancelled' ||
        protocolEvent.type === 'run.refused'
      ) {
        this.pendingProjectWindows.delete(sessionId);
        this.activeProtocolRunIds.delete(sessionId);
      }
      return;
    }

    if (event.type !== 'done') return;
    const pending = this.pendingProjectWindows.get(sessionId);
    if (!pending?.completed) return;
    this.pendingProjectWindows.delete(sessionId);
    this.activeProtocolRunIds.delete(sessionId);
    void this.openProjectInNewWindow(pending.input);
  }

  private async openProjectInNewWindow(input: ProjectWindowHandoffInput): Promise<void> {
    let handoffId: string | undefined;
    try {
      const handoff = await this.projectHandoffStore.enqueue(input);
      handoffId = handoff.id;
      const port = createDevuniCommandPort();
      await port.invoke('bridgeOpenPrj', handoff.workspaceFile, true);
      this.log.appendLine(`[workspace] 已在新窗口打开工程: ${handoff.workspaceFile}`);
    } catch (error) {
      if (handoffId) await this.projectHandoffStore.discard(handoffId).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      this.log.appendLine(`[workspace] 自动打开新工程窗口失败: ${message}`);
      this.post({
        type: 'error',
        message: `工程已创建，但自动打开新工程窗口失败：${message}`,
        canRetry: false,
      });
    }
  }

  private async postSessions(): Promise<void> {
    const index = await this.sessionCatalog.listHistory();
    this.post({
      type: 'sessions',
      activeSessionId: index.activeSessionId,
      sessions: index.sessions,
    });
  }

  private async canLeaveActiveSession(): Promise<boolean> {
    await this.ensureRuntime();
    await this.coordinator!.initialize();
    if (await this.coordinator!.hasActiveWork()) {
      this.post({ type: 'error', message: '当前会话还有任务在运行或等待审批，先停止/处理完再切换会话。' });
      return false;
    }
    return true;
  }

  private async newSession(): Promise<void> {
    if (!(await this.canLeaveActiveSession())) return;
    if (await this.sessionCatalog.activeSessionIsEmpty()) {
      await this.postSessions();
      await this.coordinator!.initialize();
      return;
    }
    const session = await this.sessionCatalog.create();
    this.sessionWorkspaceRoots.set(session.id, [...(session.workspaceRoots ?? [])]);
    this.activateRuntime(session.id);
    await this.postSessions();
    await this.coordinator!.initialize();
  }

  private async switchSession(sessionId: string): Promise<void> {
    if (sessionId === this.activeSessionId) return;
    if (!(await this.canLeaveActiveSession())) return;
    const session = await this.sessionCatalog.setActive(sessionId);
    this.sessionWorkspaceRoots.set(sessionId, [...(session.workspaceRoots ?? [])]);
    this.activateRuntime(sessionId);
    await this.postSessions();
    await this.coordinator!.initialize();
  }

  private async renameSession(sessionId: string, title: string): Promise<void> {
    await this.sessionCatalog.rename(sessionId, title);
    await this.postSessions();
  }

  private async deleteSession(sessionId: string): Promise<void> {
    if (sessionId === this.activeSessionId && !(await this.canLeaveActiveSession())) return;
    const index = await this.sessionCatalog.delete(sessionId);
    this.sessionWorkspaceRoots.delete(sessionId);
    const active = index.sessions.find((session) => session.id === index.activeSessionId);
    if (active) this.sessionWorkspaceRoots.set(active.id, [...(active.workspaceRoots ?? [])]);
    if (this.activeSessionId !== index.activeSessionId) {
      this.activateRuntime(index.activeSessionId);
      await this.postSessions();
      await this.coordinator!.initialize();
      return;
    }
    await this.postSessions();
  }

  /** 配置优先级:插件内保存 > VSCode 设置 > 环境变量 > 默认值 */
  async getConfig(
    requestedProvider?: AgentProvider,
    requestedApiFormat?: AgentApiFormat,
    requestedVendorId?: string,
  ) {
    const cfg = vscode.workspace.getConfiguration('plcAgent');
    const savedProfiles = readStoredApiSettings(
      this.context.globalState.get<unknown>(API_SETTINGS_STATE_KEY),
    );
    const legacy = readLegacyApiSettings(
      this.context.globalState.get<unknown>(LEGACY_SETTINGS_STATE_KEY),
    );
    const allowedCommands = stringListSetting(cfg, 'allowedCommands', true);
    const runCommandModeSetting = cfg.get<'local' | 'dockerSandbox'>('runCommand.mode') ?? 'local';
    const runCommandMode: 'local' | 'dockerSandbox' = runCommandModeSetting === 'dockerSandbox' ? 'dockerSandbox' : 'local';
    const runCommandShellSetting = cfg.get<'auto' | 'native' | 'powershell'>('runCommand.shell') ?? 'auto';
    const runCommandShell: 'auto' | 'native' | 'powershell' =
      runCommandShellSetting === 'native' || runCommandShellSetting === 'powershell'
        ? runCommandShellSetting
        : 'auto';
    const runCommandDockerImage = (cfg.get<string>('runCommand.dockerImage') ?? '').trim();
    const runCommandNetworkMode = cfg.get<'default' | 'none'>('runCommand.networkMode') ?? 'default';
    const runCommand: NonNullable<DurableRunConfig['runCommand']> = {
      mode: runCommandMode,
      shell: runCommandShell,
      ...(runCommandDockerImage ? { dockerImage: runCommandDockerImage } : {}),
      ...(runCommandNetworkMode === 'none' ? { networkMode: 'none' as const } : {}),
    };
    const allowedDevices = stringListSetting(cfg, 'allowedDevices');
    const showThinking = cfg.get<boolean>('ui.showThinking') ?? true;
    const jev = {
      enabled: cfg.get<boolean>('jev.enabled') ?? true,
      apiKey: (process.env.TYPESAFE_API_KEY ?? '').trim(),
      endpoint: (cfg.get<string>('jev.endpoint') ?? '').trim() || undefined,
      model: (cfg.get<string>('jev.model') ?? '').trim() || undefined,
      timeoutMs: cfg.get<number>('jev.timeoutMs') ?? undefined,
      maxRetries: cfg.get<number>('jev.maxRetries') ?? undefined,
      minConfidence: cfg.get<number>('jev.minConfidence') ?? undefined,
    };
    const configuredContextWindowTokens = cfg.get<number>('context.contextWindowTokens') ?? 0;
    const modelContext = {
      ...(configuredContextWindowTokens > 0
        ? { contextWindowTokens: Math.floor(configuredContextWindowTokens) }
        : {}),
      reservedOutputTokens: Math.max(
        0,
        Math.floor(cfg.get<number>('context.reservedOutputTokens') ?? 4_096),
      ),
      safetyMarginTokens: Math.max(
        0,
        Math.floor(cfg.get<number>('context.safetyMarginTokens') ?? 1_024),
      ),
      fixedRequestOverheadTokens: Math.max(
        0,
        Math.floor(cfg.get<number>('context.fixedRequestOverheadTokens') ?? 4_096),
      ),
      compaction: {
        maxInputTokens: Math.max(
          0,
          Math.floor(cfg.get<number>('context.compaction.maxInputTokens') ?? 0),
        ),
        maxItems: Math.max(1, Math.floor(cfg.get<number>('context.compaction.maxItems') ?? 48)),
        maxCharacters: Math.max(
          1,
          Math.floor(cfg.get<number>('context.compaction.maxCharacters') ?? 80_000),
        ),
        recentItems: Math.max(
          2,
          Math.floor(cfg.get<number>('context.compaction.recentItems') ?? 16),
        ),
        maxSummaryInputCharacters: Math.max(
          1,
          Math.floor(cfg.get<number>('context.compaction.maxSummaryInputCharacters') ?? 60_000),
        ),
      },
    };
    const promptCache = {
      enabled: cfg.get<boolean>('promptCache.enabled') ?? false,
      ttl: cfg.get<'30m'>('promptCache.ttl') ?? '30m',
    };
    const configuredPermissionMode = cfg.get<unknown>('permissionMode');
    const permissionMode: PermissionMode = isPermissionMode(configuredPermissionMode)
      ? configuredPermissionMode
      : 'ask';
    const workspaceRoots = this.workspaceRoots();
    let mcp = emptyMcpSettings();
    try {
      mcp = await loadMcpSettings(workspaceRoots);
    } catch {
      mcp = emptyMcpSettings();
    }
    const vendor = resolveStoredVendor(savedProfiles, {
      vendorId: requestedVendorId,
      provider: requestedProvider,
      apiFormat: requestedApiFormat,
    });
    const configuredProvider = cfg.get<unknown>('provider');
    const provider = vendor?.provider
      ?? requestedProvider
      ?? savedProfiles.activeProvider
      ?? (isAgentProvider(configuredProvider) ? configuredProvider : 'openai');
    const savedProvider = savedProfiles.activeProvider;
    const legacyFormatSetting = provider === 'openai'
      ? legacy.apiFormat
      : undefined;
    const configuredApiFormat: AgentApiFormatSetting =
      (savedProvider === provider ? savedProfiles.activeApiFormat : undefined)
      ?? legacyFormatSetting
      ?? cfg.get<AgentApiFormatSetting>('apiFormat')
      ?? 'auto';
    const envBaseUrl = provider === 'anthropic'
      ? process.env.ANTHROPIC_BASE_URL
      : process.env.OPENAI_BASE_URL;
    const configuredBaseSetting = provider === 'openai'
      ? cfg.get<string>('baseUrl')
      : undefined;
    const configuredBaseUrl = (
      (provider === 'openai' ? legacy.baseUrl : undefined)
      || configuredBaseSetting
      || envBaseUrl
      || ''
    ).trim();
    const apiFormat = resolveApiFormat(
      configuredBaseUrl,
      requestedApiFormat ?? configuredApiFormat,
      provider,
    );
    const storedProfile = vendor
      ? { baseUrl: vendor.baseUrl, model: vendor.model }
      : getStoredApiProfile(savedProfiles, provider, apiFormat);
    const hasStoredProviderProfiles = Object.keys(
      savedProfiles.profiles[provider] ?? {},
    ).length > 0 || savedProfiles.vendors.length > 0;
    const legacyHasValues = provider === 'openai'
      && (!!legacy.baseUrl || !!legacy.model || !!legacy.apiFormat);
    const legacyFormat = provider === 'openai'
      ? resolveApiFormat(
        legacy.baseUrl ?? configuredBaseUrl,
        legacy.apiFormat ?? 'auto',
        'openai',
      )
      : undefined;
    const useLegacyProfile = provider === 'openai'
      && !hasStoredProviderProfiles
      && legacyHasValues
      && legacyFormat === apiFormat;
    const defaultModel = (
      (provider === 'openai' ? cfg.get<string>('model') : undefined)
      || (provider === 'anthropic'
        ? process.env.ANTHROPIC_MODEL
        : process.env.AGENT_MODEL)
      || (provider === 'anthropic'
        ? 'claude-sonnet-4-5-20250929'
        : 'gpt-4o-mini')
    ).trim();
    const baseUrl = storedProfile?.baseUrl
      ?? (useLegacyProfile ? legacy.baseUrl : undefined)
      ?? (hasStoredProviderProfiles ? '' : configuredBaseUrl)
      ?? '';
    const model = storedProfile?.model
      || (useLegacyProfile ? legacy.model : undefined)
      || defaultModel;
    const formatKey = apiKeySecretKey(provider, apiFormat);
    let formatKeyValue: string | undefined;
    if (vendor) {
      for (const key of apiKeySecretCandidates(vendor)) {
        formatKeyValue = await this.context.secrets.get(key);
        if (formatKeyValue) break;
      }
    } else {
      formatKeyValue = await this.context.secrets.get(formatKey);
    }
    const legacyKeyValue = await this.context.secrets.get(LEGACY_API_KEY_SECRET_KEY);
    const legacyKeyApplies = provider === 'openai'
      && (!hasStoredProviderProfiles
      || (legacyHasValues && legacyFormat === apiFormat));
    const envApiKey = provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;
    const configuredApiKey = provider === 'openai'
      ? cfg.get<string>('apiKey')
      : undefined;
    return {
      baseUrl,
      apiKey: (
        formatKeyValue
        || (legacyKeyApplies ? legacyKeyValue : undefined)
        || configuredApiKey
        || envApiKey
        || ''
      ).trim(),
      model,
      provider,
      apiFormat,
      vendorId: vendor?.id,
      vendorName: vendor?.name,
      vendors: listStoredVendors(savedProfiles).map((item) => ({
        id: item.id,
        name: item.name,
        provider: item.provider,
        apiFormat: item.apiFormat,
        model: item.model,
      })),
      orchestration: cfg.get<'auto' | 'single' | 'team'>('orchestration') ?? 'auto',
      permissionMode,
      skillsEnabled: cfg.get<boolean>('skills.enabled') ?? true,
      policyContext: {
        allowedCommands,
        allowedDevices,
        dryRun: cfg.get<boolean>('dryRun') ?? false,
      },
      runCommand,
      mcp,
      modelContext,
      promptCache,
      jev,
      showThinking,
      savedInPlugin: !!storedProfile || useLegacyProfile || !!formatKeyValue,
    };
  }

  private async sendSettingsToWebview(
    requestedProvider?: AgentProvider,
    requestedApiFormat?: AgentApiFormat,
    requestId?: number,
    requestedVendorId?: string,
  ): Promise<void> {
    try {
      const cfg = await this.getConfig(
        requestedProvider,
        requestedApiFormat,
        requestedVendorId,
      );
      this.post({
        type: 'settings',
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        provider: cfg.provider,
        apiFormat: cfg.apiFormat,
        vendorId: cfg.vendorId ?? '',
        vendorName: cfg.vendorName ?? '',
        vendors: cfg.vendors ?? [],
        hasKey: !!cfg.apiKey,
        showThinking: cfg.showThinking !== false,
        permissionMode: cfg.permissionMode ?? 'ask',
        source: cfg.savedInPlugin ? 'plugin' : 'other',
        builtinTools: this.builtinToolsForSettings(),
        ...(await this.mcpSettingsPayload()),
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
    provider?: AgentProvider;
    apiFormat?: AgentApiFormat;
    vendorId?: string;
    name?: string;
  }): Promise<void> {
    const baseUrl = (msg.baseUrl ?? '').trim().replace(/\/+$/, '');
    const model = (msg.model ?? '').trim();
    const apiFormat = isAgentApiFormat(msg.apiFormat) ? msg.apiFormat : undefined;
    if (!apiFormat) {
      this.post({ type: 'settingsError', message: '未选择有效的 API Format' });
      return;
    }
    const provider = isAgentProvider(msg.provider)
      ? msg.provider
      : providerForApiFormat(apiFormat);
    try {
      resolveApiFormat(baseUrl, apiFormat, provider);
      const current = this.context.globalState.get<unknown>(API_SETTINGS_STATE_KEY);
      const currentSettings = readStoredApiSettings(current);
      const requestedId = typeof msg.vendorId === 'string' ? msg.vendorId.trim() : '';
      const existing = requestedId
        ? currentSettings.vendors.find((vendor) => vendor.id === requestedId)
        : undefined;
      const vendorId = existing?.id ?? createVendorId();
      const name = (msg.name ?? '').trim()
        || existing?.name
        || vendorNameFromBaseUrl(baseUrl)
        || defaultVendorName(provider, apiFormat);
      const saved = saveStoredVendor(currentSettings, {
        id: vendorId,
        name,
        provider,
        apiFormat,
        baseUrl,
        model,
      });
      await this.context.globalState.update(
        API_SETTINGS_STATE_KEY,
        saved,
      );
      if (msg.apiKey?.trim()) {
        await this.context.secrets.store(
          vendorApiKeySecretKey(vendorId),
          msg.apiKey.trim(),
        );
      }
      this.post({
        type: 'settingsSaved',
        model,
        provider,
        apiFormat,
        vendorId,
        vendorName: name,
        vendors: listStoredVendors(saved).map((item) => ({
          id: item.id,
          name: item.name,
          provider: item.provider,
          apiFormat: item.apiFormat,
          model: item.model,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `保存模型配置失败: ${message}` });
    }
  }

  private async deleteVendor(vendorId: unknown): Promise<void> {
    const id = typeof vendorId === 'string' ? vendorId.trim() : '';
    if (!id) {
      this.post({ type: 'settingsError', message: '未选择要删除的供应商' });
      return;
    }
    try {
      const current = this.context.globalState.get<unknown>(API_SETTINGS_STATE_KEY);
      const currentSettings = readStoredApiSettings(current);
      const removed = currentSettings.vendors.find((vendor) => vendor.id === id);
      if (!removed) {
        this.post({ type: 'settingsError', message: '供应商不存在' });
        return;
      }
      const saved = deleteStoredVendor(currentSettings, id);
      await this.context.globalState.update(API_SETTINGS_STATE_KEY, saved);
      for (const key of apiKeySecretCandidates(removed)) {
        await this.context.secrets.delete(key);
      }
      await this.sendSettingsToWebview(
        saved.activeProvider,
        saved.activeApiFormat ?? removed.apiFormat,
        undefined,
        saved.activeVendorId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `删除供应商失败: ${message}` });
    }
  }

  private async setPermissionMode(value: unknown): Promise<void> {
    if (!isPermissionMode(value)) {
      this.post({ type: 'settingsError', message: '未选择有效的工具权限模式' });
      return;
    }
    try {
      await vscode.workspace
        .getConfiguration('plcAgent')
        .update('permissionMode', value, vscode.ConfigurationTarget.Global);
      this.post({ type: 'permissionModeSaved', permissionMode: value });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `保存工具权限失败: ${message}` });
    }
  }

  private builtinToolsForSettings(): Array<{
    name: string;
    description: string;
    providerId: string;
    risk?: string;
  }> {
    return this.toolRegistry.getToolCatalog().list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      providerId: tool.providerId,
      ...(tool.risk ? { risk: tool.risk } : {}),
    }));
  }

  private mcpServersForSettings(mcp: McpSettings): Array<{
    name: string;
    transport: string;
    detail: string;
    enabled: boolean;
    command?: string;
    args?: string[];
    url?: string;
    cwd?: string;
    env?: Record<string, string>;
  }> {
    return mcp.servers.map((server) => ({
      name: server.name,
      transport: server.transport,
      enabled: server.enabled !== false,
      detail: server.transport === 'http'
        ? server.url
        : [server.command, ...(server.args ?? [])].join(' '),
      ...(server.transport === 'http'
        ? { url: server.url }
        : {
          command: server.command,
          args: server.args ?? [],
          ...(server.cwd ? { cwd: server.cwd } : {}),
          ...(server.env ? { env: server.env } : {}),
        }),
    }));
  }

  private workspaceRoots(): string[] {
    const current = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const created = this.sessionWorkspaceRoots.get(this.activeSessionId) ?? [];
    return [...new Set([...created, ...current])];
  }

  private async mcpSettingsPayload(): Promise<{
    mcpConfigPath: string;
    mcpConfigWritable: boolean;
    mcpServers: ReturnType<ChatViewProvider['mcpServersForSettings']>;
    mcpError?: string;
  }> {
    try {
      const file = await readMcpConfigFile(this.workspaceRoots());
      return {
        mcpConfigPath: MCP_CONFIG_RELATIVE_PATH,
        mcpConfigWritable: !!file.filePath,
        mcpServers: this.mcpServersForSettings(file.settings),
      };
    } catch (error) {
      return {
        mcpConfigPath: MCP_CONFIG_RELATIVE_PATH,
        mcpConfigWritable: this.workspaceRoots().length > 0,
        mcpServers: [],
        mcpError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async saveMcpServer(msg: {
    name?: string;
    originalName?: string;
    transport?: string;
    command?: string;
    args?: unknown;
    url?: string;
    cwd?: string;
    env?: unknown;
  }): Promise<void> {
    try {
      const file = await this.requireMcpConfigFile();
      const name = (msg.name ?? '').trim();
      if (!/^[A-Za-z0-9._-]+$/.test(name)) {
        this.post({ type: 'settingsError', message: 'MCP 服务名只能包含字母、数字、点、下划线和连字符' });
        return;
      }
      const originalName = typeof msg.originalName === 'string' ? msg.originalName.trim() : '';
      const existing = file.settings.servers.find((item) =>
        item.name === (originalName || name)
      );
      const spec = msg.transport === 'http'
        ? {
          url: typeof msg.url === 'string' ? msg.url : '',
          enabled: existing?.enabled !== false,
        }
        : {
          command: typeof msg.command === 'string' ? msg.command : '',
          args: Array.isArray(msg.args)
            ? msg.args.filter((item): item is string => typeof item === 'string')
            : undefined,
          cwd: typeof msg.cwd === 'string' ? msg.cwd : undefined,
          env: isStringRecord(msg.env) ? msg.env : undefined,
          enabled: existing?.enabled !== false,
        };
      const server = parseMcpServerInput(name, spec);
      const saved = upsertMcpServer(
        file.settings,
        server,
        originalName || undefined,
      );
      await writeMcpConfigFile(file.filePath, saved);
      this.post({ type: 'mcpConfigSaved', name: server.name });
      await this.sendSettingsToWebview();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `保存 MCP 配置失败: ${message}` });
    }
  }

  private async deleteMcpServer(name: unknown): Promise<void> {
    const serverName = typeof name === 'string' ? name.trim() : '';
    if (!serverName) {
      this.post({ type: 'settingsError', message: '未选择要删除的 MCP 服务' });
      return;
    }
    try {
      const file = await this.requireMcpConfigFile();
      const saved = removeMcpServer(file.settings, serverName);
      await writeMcpConfigFile(file.filePath, saved);
      this.post({ type: 'mcpConfigSaved', name: serverName, deleted: true });
      await this.sendSettingsToWebview();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `删除 MCP 配置失败: ${message}` });
    }
  }

  private async openMcpConfig(): Promise<void> {
    try {
      const file = await this.requireMcpConfigFile(false);
      if (!file.exists) {
        await writeMcpConfigFile(file.filePath, emptyMcpSettings());
      }
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file.filePath));
      await vscode.window.showTextDocument(document, { preview: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `打开 MCP 配置失败: ${message}` });
    }
  }

  private async setMcpEnabled(name: unknown, enabled: unknown): Promise<void> {
    const serverName = typeof name === 'string' ? name.trim() : '';
    if (!serverName) {
      this.post({ type: 'settingsError', message: '未选择要开关的 MCP 服务' });
      return;
    }
    try {
      const file = await this.requireMcpConfigFile();
      const saved = setMcpServerEnabled(file.settings, serverName, enabled === true);
      await writeMcpConfigFile(file.filePath, saved);
      this.post({
        type: 'mcpStatus',
        name: serverName,
        status: enabled === true ? 'unknown' : 'disabled',
      });
      await this.sendSettingsToWebview();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'settingsError', message: `更新 MCP 开关失败: ${message}` });
    }
  }

  private async probeMcpServers(): Promise<void> {
    const generation = ++this.mcpProbeGeneration;
    try {
      const file = await readMcpConfigFile(this.workspaceRoots());
      const interpolated = interpolateMcpSettings(file.settings, file.workspaceRoot);
      await Promise.all(interpolated.servers.map(async (spec) => {
        const result = await probeMcpServer(spec);
        if (generation !== this.mcpProbeGeneration) return;
        this.post({ type: 'mcpStatus', ...result });
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.appendLine(`[mcp] 探测失败: ${message}`);
    }
  }

  private async requireMcpConfigFile(mustParse = true): Promise<{
    filePath: string;
    exists: boolean;
    settings: McpSettings;
  }> {
    const roots = this.workspaceRoots();
    if (!roots.length) {
      throw new Error('需要打开工作区才能配置项目级 MCP');
    }
    try {
      const file = await readMcpConfigFile(roots);
      if (!file.filePath) throw new Error('需要打开工作区才能配置项目级 MCP');
      return { filePath: file.filePath, exists: file.exists, settings: file.settings };
    } catch (error) {
      if (mustParse) throw error;
      return {
        filePath: mcpConfigFilePath(roots[0]!),
        exists: true,
        settings: emptyMcpSettings(),
      };
    }
  }

  /**
   * 界面上的工具动作被点了。工具结果里声明了什么命令,这里就原样打给外部插件。
   *
   * 这条路径不经过模型:界面点一下,这里直接调桥。chatView 只负责把命令转发出去,
   * 具体是哪个工具、调哪条命令、参数是什么,全在工具结果那份声明里,这里不判断。
   */
  private async runPluginCommand(
    command: string,
    args: unknown[],
    actionKey: string,
  ): Promise<void> {
    const name = command.trim();
    if (!name) return;
    try {
      const port = createDevuniCommandPort();
      await port.invoke(name, ...args);
      this.log.appendLine(`[devuni] 执行 ${name} ${JSON.stringify(args)}`);
      this.post({ type: 'pluginCommandResult', actionKey, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.appendLine(`[devuni] 执行 ${name} 失败: ${message}`);
      this.post({ type: 'pluginCommandResult', actionKey, ok: false, error: message });
    }
  }

  private async send(text: string): Promise<void> {
    await this.ensureRuntime();
    // ensureRuntime() initializes and replays the active session once. Replaying
    // before every send would clear live output and restore raw session text over
    // the completed result shown by the current run.
    // Keep the natural-language command narrow: "继续写一个..." remains a
    // new task, while an exact continuation phrase resumes the saved SDK state.
    if (isContinueRequest(text)) {
      const displayText = text.trim();
      this.post({ type: 'user', text: displayText });
      await this.continueRun(displayText);
      return;
    }
    const live = await this.getConfig();
    const workspaceRoots = this.workspaceRoots();
    const paths = this.sessionCatalog.pathsFor(this.activeSessionId);
    const config: DurableRunConfig = {
      baseUrl: live.baseUrl,
      model: live.model,
      provider: live.provider,
      apiFormat: live.apiFormat,
      exportDir: paths.exportDir,
      workspaceRoot: workspaceRoots[0] ?? '',
      workspaceRoots,
      policyContext: live.policyContext,
      runCommand: live.runCommand,
      mcp: live.mcp,
      modelContext: live.modelContext,
      promptCache: live.promptCache,
      orchestration: live.orchestration,
      permissionMode: live.permissionMode,
      skillsEnabled: live.skillsEnabled,
      extensions: createStAnalyzerConfigExtension(this.context),
      jev: {
        enabled: live.jev.enabled,
        ...(live.jev.endpoint ? { endpoint: live.jev.endpoint } : {}),
        ...(live.jev.model ? { model: live.jev.model } : {}),
        ...(live.jev.timeoutMs === undefined ? {} : { timeoutMs: live.jev.timeoutMs }),
        ...(live.jev.maxRetries === undefined ? {} : { maxRetries: live.jev.maxRetries }),
        ...(live.jev.minConfidence === undefined ? {} : { minConfidence: live.jev.minConfidence }),
      },
    };
    await this.sessionCatalog.touch(this.activeSessionId, titleFromUserText(text));
    await this.postSessions();
    await this.coordinator!.start(text, config, live.apiKey);
  }

  private async resolveApproval(msg: { runId?: string; approvalId?: string; approve?: boolean }): Promise<void> {
    await this.ensureRuntime();
    const live = await this.getConfig();
    await this.coordinator!.approve(msg.runId ?? '', msg.approvalId ?? '', msg.approve === true, live.apiKey);
    await this.sessionCatalog.touch(this.activeSessionId);
    await this.postSessions();
  }

  private async resolveClarification(msg: {
    runId?: string;
    requestId?: string;
    cancelled?: boolean;
    selectedOptionId?: string;
    customText?: string;
    value?: unknown;
    fields?: Record<string, string | number>;
  }): Promise<void> {
    await this.ensureRuntime();
    await this.coordinator!.resolveClarification(
      msg.runId ?? '',
      msg.requestId ?? '',
      {
        cancelled: msg.cancelled === true,
        ...(typeof msg.selectedOptionId === 'string' ? { selectedOptionId: msg.selectedOptionId } : {}),
        ...(typeof msg.customText === 'string' ? { customText: msg.customText } : {}),
        ...(msg.value !== undefined ? { value: msg.value } : {}),
        ...(msg.fields && typeof msg.fields === 'object' ? { fields: msg.fields } : {}),
      },
    );
    await this.sessionCatalog.touch(this.activeSessionId);
    await this.postSessions();
  }

  private async stop(): Promise<void> {
    await this.ensureRuntime();
    await this.coordinator!.stop();
  }

  private async retry(): Promise<void> {
    await this.ensureRuntime();
    const live = await this.getConfig();
    await this.coordinator!.retry(live.apiKey);
    await this.sessionCatalog.touch(this.activeSessionId);
    await this.postSessions();
  }

  private async continueRun(displayText?: string): Promise<void> {
    await this.ensureRuntime();
    const live = await this.getConfig();
    await this.coordinator!.continue(live.apiKey, displayText);
    await this.sessionCatalog.touch(this.activeSessionId);
    await this.postSessions();
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
  <title>PLC Agent</title>
</head>
<body>
  <div id="sessions" class="sessions">
    <div class="sessions-head">
      <button id="session-history" class="session-history" type="button" aria-expanded="false">Chat history</button>
      <button id="session-new" class="session-new" title="新建会话">＋</button>
    </div>
    <div id="session-panel" class="session-panel hidden">
      <div class="session-panel-title">Chats</div>
      <label class="session-search">
        <span>⌕</span>
        <input id="session-search" type="search" placeholder="Search recent chats" spellcheck="false" />
      </label>
      <div id="session-list" class="session-list"></div>
    </div>
  </div>
  <div id="messages" aria-live="polite"></div>

  <!-- 设置面板(齿轮打开) -->
  <div id="settings" class="settings hidden" aria-hidden="true">
    <div class="settings-shell">
      <header class="settings-head">
        <div class="settings-head-title">设置</div>
        <span id="set-save-status" class="settings-save-status"></span>
        <button id="settings-close" class="settings-close" type="button" title="关闭">×</button>
      </header>
      <div class="settings-body">
        <nav class="settings-nav" aria-label="设置分类">
          <div class="settings-nav-group">基础</div>
          <button type="button" class="settings-nav-item active" data-settings-page="model">模型配置</button>
          <div class="settings-nav-group">扩展</div>
          <button type="button" class="settings-nav-item" data-settings-page="tools">Tools &amp; MCP</button>
        </nav>
        <div class="settings-content">
          <section id="settings-page-model" class="settings-page" data-settings-page="model">
            <div class="settings-page-title">模型配置</div>
            <div class="settings-form">
              <label>API Format<select id="set-format">
                <option value="chat_completions">OpenAI Chat Completions</option>
                <option value="responses">OpenAI Responses</option>
                <option value="messages">Anthropic Messages</option>
              </select></label>
              <div class="settings-vendor-row">
                <label class="settings-vendor-select">供应商<select id="set-vendor"></select></label>
                <button id="set-vendor-add" class="btn" type="button">添加</button>
                <button id="set-vendor-delete" class="btn" type="button">删除</button>
              </div>
              <label>名称<input id="set-vendor-name" type="text" placeholder="例如 amd / deepseek" spellcheck="false" /></label>
              <label>Base URL<input id="set-base" type="text" placeholder="https://你的网关/v1" spellcheck="false" /></label>
              <label>API Key<input id="set-key" type="password" placeholder="未设置" spellcheck="false" /></label>
              <label>Model<input id="set-model" type="text" placeholder="gpt-4o-mini" spellcheck="false" /></label>
            </div>
            <div class="settings-actions">
              <button id="set-save" class="btn primary">保存</button>
            </div>
            <div class="settings-tip">Key 保存在系统安全存储(不会进 git / 同步)。配置一次,重开 VSCode 和 F5 调试窗口都生效。</div>
          </section>
          <section id="settings-page-tools" class="settings-page hidden" data-settings-page="tools">
            <div class="settings-page-title">Tools &amp; MCP</div>
            <div class="settings-section-title">系统工具</div>
            <button type="button" id="settings-builtin-toggle" class="settings-tool-group" aria-expanded="true">
              <span class="settings-tool-group-main">
                <span class="settings-chevron">▾</span>
                <span>内置工具</span>
                <span class="settings-badge">只读</span>
                <span id="settings-builtin-count" class="settings-count"></span>
              </span>
              <span class="settings-status-dot" title="已启用"></span>
            </button>
            <div id="settings-builtin-tools" class="settings-tool-list"></div>
            <div class="settings-section-head">
              <div class="settings-section-title">项目级 MCP <span id="settings-mcp-path" class="settings-sub"></span></div>
              <div class="settings-section-actions">
                <button id="mcp-add" class="btn" type="button">添加</button>
                <button id="mcp-open" class="btn" type="button">打开文件</button>
              </div>
            </div>
            <div id="settings-mcp-list" class="settings-empty">暂无 MCP 服务</div>
            <div id="mcp-form" class="settings-form hidden">
              <input id="mcp-original-name" type="hidden" />
              <label>名称<input id="mcp-name" type="text" placeholder="filesystem" spellcheck="false" /></label>
              <label>类型<select id="mcp-transport">
                <option value="stdio">Stdio</option>
                <option value="http">HTTP</option>
              </select></label>
              <div id="mcp-stdio-fields">
                <label>命令<input id="mcp-command" type="text" placeholder="npx" spellcheck="false" /></label>
                <label>参数<textarea id="mcp-args" rows="3" placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;\${workspaceFolder}" spellcheck="false"></textarea></label>
                <label>工作目录<input id="mcp-cwd" type="text" placeholder="可选，默认工作区" spellcheck="false" /></label>
                <label>环境变量<textarea id="mcp-env" rows="2" placeholder="可选，一行一个 KEY=value" spellcheck="false"></textarea></label>
              </div>
              <div id="mcp-http-fields" class="hidden">
                <label>URL<input id="mcp-url" type="text" placeholder="http://127.0.0.1:3333/mcp" spellcheck="false" /></label>
              </div>
              <div class="settings-actions">
                <button id="mcp-cancel" class="btn" type="button">取消</button>
                <button id="mcp-save" class="btn primary" type="button">保存</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>

  <div class="composer">
    <div class="composer-box">
      <textarea id="input" rows="1" placeholder="请输入需求…(/指令 @文件 后续支持)"></textarea>
      <div class="composer-bar">
        <div class="left">
          <div class="permission-menu-wrap">
            <button class="chip mode-chip" id="mode-chip" type="button" aria-expanded="false">Agent · 请求批准 ▾</button>
            <div id="permission-menu" class="permission-menu hidden" role="menu">
              <button type="button" role="menuitem" data-permission-mode="ask">
                <strong>请求批准</strong>
                <small>编辑文件、使用互联网等操作前始终询问</small>
              </button>
              <button type="button" role="menuitem" data-permission-mode="auto">
                <strong>帮我批准</strong>
                <small>仅对检测到的风险操作请求批准</small>
              </button>
              <button type="button" role="menuitem" data-permission-mode="full_access">
                <strong>完全访问权限</strong>
                <small>不经用户批准访问互联网和电脑上的文件</small>
              </button>
            </div>
          </div>
          <span class="chip model" id="model-chip" title="点击配置模型">未配置</span>
          <span class="chip action" id="newchat" title="创建新会话,保留历史会话">＋ 新会话</span>
        </div>
        <div class="right">
          <button id="gear" class="gear-btn" title="设置">⚙</button>
          <button id="retry" class="tool-btn" title="重试上一轮" disabled>↻</button>
          <button id="continue" class="tool-btn" title="继续上次任务" disabled>↪</button>
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

function vendorNameFromBaseUrl(baseUrl: string): string | undefined {
  try {
    const host = new URL(baseUrl).hostname.trim();
    return host || undefined;
  } catch {
    return undefined;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every((item) => typeof item === 'string');
}

function isContinueRequest(text: string): boolean {
  return /^(?:继续|接着刚才|继续刚才|继续上次|从刚才继续)[。！!,.，、\s]*$/u.test(text.trim());
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
