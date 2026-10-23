// WebView 脚本:只负责界面与消息转发,agent 逻辑与配置持久化在扩展进程(src/chatView.ts)
const vscode = acquireVsCodeApi();

const messagesEl = document.getElementById('messages');
const sessionsEl = document.getElementById('sessions');
const sessionHistoryBtn = document.getElementById('session-history');
const sessionPanelEl = document.getElementById('session-panel');
const sessionSearchEl = document.getElementById('session-search');
const sessionListEl = document.getElementById('session-list');
const sessionNewBtn = document.getElementById('session-new');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const stopBtn = document.getElementById('stop');
const retryBtn = document.getElementById('retry');
const continueBtn = document.getElementById('continue');
const gearBtn = document.getElementById('gear');
const modeChip = document.getElementById('mode-chip');
const permissionMenuEl = document.getElementById('permission-menu');
const modelChip = document.getElementById('model-chip');
const settingsEl = document.getElementById('settings');
const setBaseEl = document.getElementById('set-base');
const setKeyEl = document.getElementById('set-key');
const setModelEl = document.getElementById('set-model');
const setFormatEl = document.getElementById('set-format');
const setVendorEl = document.getElementById('set-vendor');
const setVendorNameEl = document.getElementById('set-vendor-name');
const setVendorAddEl = document.getElementById('set-vendor-add');
const setVendorDeleteEl = document.getElementById('set-vendor-delete');
const setSaveEl = document.getElementById('set-save');
const setSaveStatusEl = document.getElementById('set-save-status');
const settingsCloseEl = document.getElementById('settings-close');
const settingsBuiltinToggleEl = document.getElementById('settings-builtin-toggle');
const settingsBuiltinToolsEl = document.getElementById('settings-builtin-tools');
const settingsBuiltinCountEl = document.getElementById('settings-builtin-count');
const settingsMcpPathEl = document.getElementById('settings-mcp-path');
const settingsMcpListEl = document.getElementById('settings-mcp-list');
const mcpAddEl = document.getElementById('mcp-add');
const mcpOpenEl = document.getElementById('mcp-open');
const mcpFormEl = document.getElementById('mcp-form');
const mcpOriginalNameEl = document.getElementById('mcp-original-name');
const mcpNameEl = document.getElementById('mcp-name');
const mcpTransportEl = document.getElementById('mcp-transport');
const mcpStdioFieldsEl = document.getElementById('mcp-stdio-fields');
const mcpHttpFieldsEl = document.getElementById('mcp-http-fields');
const mcpCommandEl = document.getElementById('mcp-command');
const mcpArgsEl = document.getElementById('mcp-args');
const mcpCwdEl = document.getElementById('mcp-cwd');
const mcpEnvEl = document.getElementById('mcp-env');
const mcpUrlEl = document.getElementById('mcp-url');
const mcpSaveEl = document.getElementById('mcp-save');
const mcpCancelEl = document.getElementById('mcp-cancel');

let hasSavedKey = false;
let runtimeMode = 'idle';
let currentRunId = null;
let canRetry = false;
let canContinue = false;
let pauseNoticeEl = null;
let preflightNoteEl = null;
let contextCompactionNoteEl = null;
let settingsRequestId = 0;
let settingsSavePending = false;
let pendingLocalUserText = null;
let awaitingRunAck = false;
let stopRequestedBeforeRunAck = false;
let activeSessionId = null;
let showThinking = true;
let permissionMode = 'ask';
let knownSessions = [];
let settingsPage = 'model';
let currentVendorId = '';
let knownVendors = [];
let creatingVendor = false;
let knownMcpServers = [];
let mcpConfigWritable = false;
let sessionHistoryOpen = false;
let sessionSearchQuery = '';
let selectedSessionId = null;
let renamingSessionId = null;
let renameDraftTitle = '';
let pendingDeleteSessionId = null;
const toolRuns = new Map();
const anonymousToolRuns = new Map();
const workflowViews = new Map();
const workflowApprovals = new Map();
const clarificationRequests = new Map();
const thinkingViews = new Map();
const thinkingInlineViews = new Map();
const thinkingSegments = new Map();
const activeThinkingSegments = new Map();
const thinkingItemSegments = new Map();
const thinkingSegmentCounters = new Map();
const finalAnswerAnchors = new Map();
const richRenderStates = new WeakMap();
const THINKING_INLINE_MAX_CHARS = 80;
let scrollFramePending = false;
let replayingHistory = false;

const preflightStageLabels = {
  context: '正在整理上下文',
  workflow: '正在判断任务类型',
  delivery: '正在确认交付要求',
  routing: '正在判断协同执行',
  planning: '正在生成执行计划',
  execution: '开始执行',
};

function setRuntimeMode(mode) {
  runtimeMode = mode;
  const running = mode === 'running' || mode === 'stopping';
  const awaiting = mode === 'awaiting';
  sendBtn.disabled = running || awaiting;
  sessionNewBtn.disabled = running || awaiting;
  stopBtn.classList.toggle('hidden', !(running || awaiting));
  stopBtn.disabled = mode === 'stopping';
  retryBtn.disabled = !canRetry || running || awaiting;
  continueBtn.disabled = !canContinue || running || awaiting;
  renderSessions();
}

function setSessionHistoryOpen(open) {
  sessionHistoryOpen = !!open;
  sessionPanelEl?.classList.toggle('hidden', !sessionHistoryOpen);
  sessionHistoryBtn?.classList.toggle('active', sessionHistoryOpen);
  sessionHistoryBtn?.setAttribute('aria-expanded', sessionHistoryOpen ? 'true' : 'false');
  if (sessionHistoryOpen) {
    selectedSessionId = selectedSessionId || activeSessionId;
    renderSessions();
    requestAnimationFrame(() => sessionSearchEl?.focus());
  } else {
    renamingSessionId = null;
    renameDraftTitle = '';
    pendingDeleteSessionId = null;
  }
}

function filteredSessions() {
  const sessions = Array.isArray(knownSessions) ? knownSessions : [];
  const query = sessionSearchQuery.trim().toLowerCase();
  return query
    ? sessions.filter((session) => String(session?.title || '新会话').toLowerCase().includes(query))
    : sessions;
}

function sessionGroupLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '更早';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.floor((startOfToday - startOfDate) / 86_400_000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return '近 7 天';
  if (days < 30) return '近 30 天';
  return '更早';
}

function switchToSession(sessionId) {
  if (runtimeMode !== 'idle' || sessionId === activeSessionId) return;
  setSessionHistoryOpen(false);
  vscode.postMessage({ type: 'switchSession', sessionId });
}

function renameSession(sessionId, title) {
  const clean = String(title ?? '').replace(/\s+/g, ' ').trim();
  renamingSessionId = null;
  renameDraftTitle = '';
  if (!clean) {
    renderSessions();
    return;
  }
  vscode.postMessage({ type: 'renameSession', sessionId, title: clean });
}

function cancelRenameSession() {
  renamingSessionId = null;
  renameDraftTitle = '';
  renderSessions();
}

function requestDeleteSession(session) {
  if (runtimeMode !== 'idle' || !session?.id) return;
  pendingDeleteSessionId = session.id;
  renamingSessionId = null;
  renameDraftTitle = '';
  selectedSessionId = session.id;
  renderSessions();
}

function commitDeleteSession(session) {
  if (runtimeMode !== 'idle' || !session?.id) return;
  if (selectedSessionId === session.id) selectedSessionId = null;
  if (renamingSessionId === session.id) renamingSessionId = null;
  renameDraftTitle = '';
  if (pendingDeleteSessionId === session.id) pendingDeleteSessionId = null;
  vscode.postMessage({ type: 'deleteSession', sessionId: session.id });
}

function moveSessionSelection(delta) {
  const sessions = filteredSessions().filter((session) => session && typeof session.id === 'string');
  if (!sessions.length) return;
  const currentIndex = Math.max(0, sessions.findIndex((session) => session.id === selectedSessionId));
  const nextIndex = (currentIndex + delta + sessions.length) % sessions.length;
  selectedSessionId = sessions[nextIndex].id;
  renderSessions();
  requestAnimationFrame(() => {
    sessionListEl?.querySelector(`[data-session-id="${CSS.escape(selectedSessionId)}"]`)?.focus();
  });
}

function renderSessions() {
  if (!sessionListEl) return;
  sessionListEl.textContent = '';
  const sessions = Array.isArray(knownSessions) ? knownSessions : [];
  sessionHistoryBtn.textContent = sessions.length ? `Chat history · ${sessions.length}` : 'Chat history';
  const filtered = filteredSessions();
  if (filtered.length && !filtered.some((session) => session.id === selectedSessionId)) {
    selectedSessionId = filtered.find((session) => session.id === activeSessionId)?.id || filtered[0].id;
  }
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'session-empty';
    empty.textContent = sessions.length ? '没有匹配的历史会话' : '暂无历史会话';
    sessionListEl.appendChild(empty);
    return;
  }
  let lastGroup = '';
  for (const session of filtered) {
    if (!session || typeof session.id !== 'string') continue;
    const group = sessionGroupLabel(session.updatedAt);
    if (group !== lastGroup) {
      const groupEl = document.createElement('div');
      groupEl.className = 'session-group';
      groupEl.textContent = group;
      sessionListEl.appendChild(groupEl);
      lastGroup = group;
    }
    const item = document.createElement('div');
    item.className = [
      'session-item',
      session.id === activeSessionId ? 'active' : '',
      session.id === selectedSessionId ? 'selected' : '',
    ].filter(Boolean).join(' ');
    item.tabIndex = 0;
    item.role = 'button';
    item.dataset.sessionId = session.id;
    const main = document.createElement('div');
    main.className = 'session-main';
    if (renamingSessionId === session.id) {
      const input = document.createElement('input');
      input.className = 'session-rename-input';
      input.value = renameDraftTitle || session.title || '新会话';
      input.spellcheck = false;
      input.addEventListener('click', (event) => event.stopPropagation());
      input.addEventListener('input', () => {
        renameDraftTitle = input.value;
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          renameSession(session.id, input.value);
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancelRenameSession();
        }
      });
      main.appendChild(input);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    } else {
      const title = document.createElement('span');
      title.className = 'session-title';
      title.textContent = session.title || '新会话';
      main.appendChild(title);
    }
    const time = document.createElement('span');
    time.className = 'session-time';
    time.textContent = formatSessionTime(session.updatedAt);
    const actions = document.createElement('div');
    actions.className = 'session-actions';
    if (pendingDeleteSessionId === session.id) {
      actions.classList.add('confirming');
      const confirmDelete = document.createElement('button');
      confirmDelete.type = 'button';
      confirmDelete.className = 'session-action-text danger';
      confirmDelete.title = '确认删除';
      confirmDelete.textContent = '删除';
      confirmDelete.addEventListener('click', (event) => {
        event.stopPropagation();
        commitDeleteSession(session);
      });
      const cancelDelete = document.createElement('button');
      cancelDelete.type = 'button';
      cancelDelete.className = 'session-action-text';
      cancelDelete.title = '取消删除';
      cancelDelete.textContent = '取消';
      cancelDelete.addEventListener('click', (event) => {
        event.stopPropagation();
        pendingDeleteSessionId = null;
        renderSessions();
      });
      actions.append(confirmDelete, cancelDelete);
    } else if (renamingSessionId === session.id) {
      actions.classList.add('confirming');
      const acceptRename = document.createElement('button');
      acceptRename.type = 'button';
      acceptRename.className = 'session-action accept';
      acceptRename.title = '确认重命名';
      acceptRename.textContent = '✓';
      acceptRename.addEventListener('click', (event) => {
        event.stopPropagation();
        renameSession(session.id, renameDraftTitle);
      });
      const cancelRename = document.createElement('button');
      cancelRename.type = 'button';
      cancelRename.className = 'session-action';
      cancelRename.title = '恢复原名称';
      cancelRename.textContent = '↶';
      cancelRename.addEventListener('click', (event) => {
        event.stopPropagation();
        cancelRenameSession();
      });
      actions.append(acceptRename, cancelRename);
    } else {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'session-action';
      edit.title = '重命名';
      edit.textContent = '✎';
      edit.addEventListener('click', (event) => {
        event.stopPropagation();
        pendingDeleteSessionId = null;
        renamingSessionId = session.id;
        renameDraftTitle = session.title || '新会话';
        selectedSessionId = session.id;
        renderSessions();
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'session-action danger';
      del.title = '删除';
      del.textContent = '×';
      del.disabled = runtimeMode !== 'idle';
      del.addEventListener('click', (event) => {
        event.stopPropagation();
        requestDeleteSession(session);
      });
      actions.append(edit, del);
    }
    item.append(main, time, actions);
    item.addEventListener('click', () => {
      selectedSessionId = session.id;
      if (renamingSessionId) return;
      switchToSession(session.id);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') switchToSession(session.id);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSessionSelection(1);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSessionSelection(-1);
      }
    });
    sessionListEl.appendChild(item);
  }
}

function formatSessionTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
}

// ---------- 消息渲染 ----------

function addMessage(kind, text) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${kind}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollBottom();
  return bubble;
}

function rememberFinalAnswerAnchor(runId, bubble) {
  if (!runId || !bubble) return;
  finalAnswerAnchors.set(runId, bubble);
  while (finalAnswerAnchors.size > 12) {
    const oldest = finalAnswerAnchors.keys().next().value;
    if (!oldest) break;
    finalAnswerAnchors.delete(oldest);
  }
}

function finalAnswerNodeFor(runId) {
  const bubble = (runId && finalAnswerAnchors.get(runId)) || agentBubble;
  if (!bubble || !bubble.parentNode) return null;
  if (bubble.parentNode === messagesEl) return bubble;
  const wrapper = bubble.parentElement;
  if (wrapper?.parentNode === messagesEl && wrapper.classList.contains('msg')) {
    return wrapper;
  }
  return null;
}

function detachAgentBubbleFromTimeline() {
  if (!agentBubble) return;
  const wrapper = agentBubble.parentElement;
  if (wrapper?.parentNode === messagesEl && wrapper.classList.contains('msg')) {
    wrapper.remove();
    return;
  }
  if (agentBubble.parentNode === messagesEl || wrapper) agentBubble.remove();
}

function appendAgentBubbleToTimelineEnd() {
  if (!agentBubble) return;
  const wrapper = agentBubble.parentElement;
  if (wrapper?.parentNode === messagesEl && wrapper.classList.contains('msg')) {
    messagesEl.appendChild(wrapper);
    return;
  }
  if (agentBubble.parentNode === messagesEl) {
    messagesEl.appendChild(agentBubble);
    return;
  }
  if (wrapper?.classList.contains('msg')) {
    messagesEl.appendChild(wrapper);
    return;
  }
  const newWrapper = document.createElement('div');
  newWrapper.className = 'msg agent';
  newWrapper.appendChild(agentBubble);
  messagesEl.appendChild(newWrapper);
}

function insertBeforeFinalAnswer(node, runId) {
  // Provider streams may deliver reasoning after final text; keep the UI
  // order stable by anchoring Thinking before this run's answer bubble.
  const anchor = finalAnswerNodeFor(runId);
  if (anchor?.parentNode === messagesEl) {
    messagesEl.insertBefore(node, anchor);
  } else {
    messagesEl.appendChild(node);
  }
}

function beginUserTurn(text, runId, reusePendingLocal = false) {
  const displayText = String(text ?? '');
  const hint = messagesEl.querySelector('.hint');
  if (hint) hint.remove();
  clearPreflightNote();
  clearContextCompactionNote();
  const reuseExisting = reusePendingLocal && pendingLocalUserText === displayText && agentBubble;
  if (!reuseExisting) addMessage('user', displayText);
  currentRunId = runId || null;
  if (currentRunId) resetThinkingTracking(currentRunId);
  agentText = '';
  pendingAgentText = '';
  pendingFinalText = null;
  pendingToolCount = 0;
  hadToolThisTurn = false;
  canRetry = false;
  canContinue = false;
  if (!reuseExisting) {
    agentBubble = addMessage('agent', '');
    agentBubble.classList.add('streaming');
  }
  rememberFinalAnswerAnchor(currentRunId, agentBubble);
  setRuntimeMode('running');
  if (reusePendingLocal) pendingLocalUserText = null;
}

function clearPendingRunAck() {
  awaitingRunAck = false;
  stopRequestedBeforeRunAck = false;
}

function acknowledgeRunStart() {
  const shouldStop = stopRequestedBeforeRunAck;
  clearPendingRunAck();
  if (shouldStop) {
    setRuntimeMode('stopping');
    vscode.postMessage({ type: 'stop' });
  }
}

function addNote(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollBottom();
  return el;
}

function clearPreflightNote() {
  if (preflightNoteEl?.isConnected) preflightNoteEl.remove();
  preflightNoteEl = null;
}

function clearContextCompactionNote() {
  if (contextCompactionNoteEl?.isConnected) contextCompactionNoteEl.remove();
  contextCompactionNoteEl = null;
}

function showContextCompactionState(message, runId, status = 'completed') {
  if (currentRunId && runId && currentRunId !== runId) return;
  if (!contextCompactionNoteEl || !contextCompactionNoteEl.isConnected) {
    contextCompactionNoteEl = document.createElement('div');
    contextCompactionNoteEl.className = 'tool-note context-compaction-note';
    contextCompactionNoteEl.dataset.runId = runId || '';
    insertBeforeFinalAnswer(contextCompactionNoteEl, runId);
  }
  contextCompactionNoteEl.textContent = String(message || '上下文压缩完成');
  contextCompactionNoteEl.dataset.status = status;
  contextCompactionNoteEl.classList.toggle('active', status === 'started');
  scrollBottom();
}

function showPreflightStage(message) {
  const runId = message?.runId || currentRunId;
  const stage = typeof message?.stage === 'string' ? message.stage : '';
  const status = typeof message?.status === 'string' ? message.status : '';
  if (
    !stage ||
    !preflightStageLabels[stage] ||
    status !== 'started' ||
    (currentRunId && runId && currentRunId !== runId)
  ) {
    if (status !== 'started' || stage === 'execution') clearPreflightNote();
    return;
  }
  if (!preflightNoteEl || !preflightNoteEl.isConnected) {
    preflightNoteEl = document.createElement('div');
    preflightNoteEl.className = 'preflight-note';
    preflightNoteEl.dataset.runId = runId || '';
    insertBeforeFinalAnswer(preflightNoteEl, runId);
  }
  preflightNoteEl.textContent = preflightStageLabels[stage];
  preflightNoteEl.classList.add('active');
  scrollBottom();
}

function clearPauseNotice() {
  if (pauseNoticeEl?.isConnected) pauseNoticeEl.remove();
  pauseNoticeEl = null;
}

function showPauseNotice(text) {
  clearPauseNotice();
  pauseNoticeEl = addNote('tool-note', text);
  return pauseNoticeEl;
}

function setShowThinking(value) {
  showThinking = value !== false;
  if (showThinking) return;
  for (const view of thinkingViews.values()) view.el.remove();
  for (const view of thinkingInlineViews.values()) view.remove();
  clearThinkingState();
}

function clearThinkingState() {
  thinkingViews.clear();
  thinkingInlineViews.clear();
  thinkingSegments.clear();
  activeThinkingSegments.clear();
  thinkingItemSegments.clear();
  thinkingSegmentCounters.clear();
}

function resetThinkingTracking(runId) {
  if (!runId) return;
  activeThinkingSegments.delete(runId);
  thinkingSegmentCounters.delete(runId);
  for (const key of [...thinkingSegments.keys()]) {
    if (key.startsWith(`${runId}:`)) thinkingSegments.delete(key);
  }
  for (const key of [...thinkingItemSegments.keys()]) {
    if (key.startsWith(`${runId}:`)) thinkingItemSegments.delete(key);
  }
}

function thinkingSegmentState(key, runId) {
  const existing = thinkingSegments.get(key);
  if (existing) return existing;
  const state = {
    key,
    runId,
    text: '',
    view: null,
    inlineView: null,
    finalized: false,
  };
  thinkingSegments.set(key, state);
  return state;
}

function isShortThinkingText(text) {
  const normalized = String(text ?? '').trim();
  return normalized.length > 0 && normalized.length <= THINKING_INLINE_MAX_CHARS;
}

function ensureThinkingCard(state) {
  if (!state.view) {
    state.view = createThinkingView(state.key, state.runId);
  }
  if (!state.view.segments) state.view.segments = new Map();
  state.view.segments.set(state.key, state.text);
  state.view.body.textContent = [...state.view.segments.values()]
    .filter((text) => String(text ?? '').trim())
    .join('\n\n');
  state.view.body.classList.remove('hidden');
}

function detachThinkingCard(state) {
  const view = state.view;
  if (!view) return;
  view.segments?.delete(state.key);
  const remaining = [...(view.segments?.values() ?? [])]
    .map((text) => String(text ?? '').trim())
    .filter(Boolean);
  if (!remaining.length) {
    for (const [key, mapped] of [...thinkingViews.entries()]) {
      if (mapped === view) thinkingViews.delete(key);
    }
    if (view.el.isConnected) view.el.remove();
  } else {
    view.body.textContent = remaining.join('\n\n');
  }
  state.view = null;
}

function renderInlineThinking(state, text) {
  if (state.inlineView) {
    state.inlineView.textContent = text;
  } else {
    const el = document.createElement('div');
    el.className = 'thinking-inline';
    el.textContent = text;
    const view = state.view;
    const shared = Boolean(
      view?.segments && [...view.segments.keys()].some((key) => key !== state.key),
    );
    if (view?.el?.parentNode && !shared) {
      view.el.replaceWith(el);
    } else if (view?.el?.parentNode) {
      view.el.after(el);
    } else {
      insertBeforeFinalAnswer(el, state.runId);
    }
    state.inlineView = el;
    thinkingInlineViews.set(state.key, el);
  }
  detachThinkingCard(state);
  scrollBottom();
}

function compactThinkingSegment(state) {
  const text = String(state.text ?? '').trim();
  if (!text) {
    if (state.inlineView) {
      state.inlineView.remove();
      thinkingInlineViews.delete(state.key);
      state.inlineView = null;
    }
    detachThinkingCard(state);
    return;
  }
  if (state.inlineView) {
    state.inlineView.remove();
    thinkingInlineViews.delete(state.key);
    state.inlineView = null;
  }
  ensureThinkingCard(state);
  if (state.view?.el) state.view.el.open = false;
}

function compactThinkingForRun(runId) {
  if (!runId) return;
  for (const state of thinkingSegments.values()) {
    if (state.runId === runId) compactThinkingSegment(state);
  }
}

function closeThinkingSegment(runId) {
  if (!runId) return;
  const active = activeThinkingSegments.get(runId);
  if (active) {
    const state = thinkingSegments.get(active);
    if (state) {
      compactThinkingSegment(state);
      state.finalized = true;
    }
  }
  activeThinkingSegments.delete(runId);
  compactThinkingForRun(runId);
}

function closeThinkingAtBoundary(runId) {
  const runIds = new Set();
  if (runId) runIds.add(runId);
  if (currentRunId) runIds.add(currentRunId);
  for (const activeRunId of activeThinkingSegments.keys()) runIds.add(activeRunId);
  for (const id of runIds) closeThinkingSegment(id);
}

function nextThinkingSegmentKey(runId) {
  const count = (thinkingSegmentCounters.get(runId) || 0) + 1;
  thinkingSegmentCounters.set(runId, count);
  return `${runId}:segment:${count}`;
}

function thinkingSegmentKey(event, payload) {
  const runId = event.runId || currentRunId || 'standalone';
  const itemId = typeof payload.itemId === 'string' && payload.itemId.trim()
    ? payload.itemId.trim()
    : '';
  const itemKey = itemId ? `${runId}:item:${itemId}` : '';
  if (itemKey) {
    const existing = thinkingItemSegments.get(itemKey);
    if (existing) return existing;
  }
  const active = activeThinkingSegments.get(runId);
  if (active) {
    if (itemKey) thinkingItemSegments.set(itemKey, active);
    return active;
  }
  const segmentKey = nextThinkingSegmentKey(runId);
  activeThinkingSegments.set(runId, segmentKey);
  if (itemKey) thinkingItemSegments.set(itemKey, segmentKey);
  return segmentKey;
}

function createThinkingView(key, runId) {
  const previous = messagesEl.lastElementChild;
  if (previous?.classList.contains('thinking-card')) {
    const previousKey = previous.dataset.thinkingKey;
    const previousView = previousKey ? thinkingViews.get(previousKey) : undefined;
    if (previousView && previousView.runId === runId) {
      thinkingViews.set(key, previousView);
      return previousView;
    }
  }
  const details = document.createElement('details');
  details.className = 'thinking-card';
  details.dataset.thinkingKey = key;
  const summary = document.createElement('summary');
  summary.textContent = 'Thinking';
  const body = document.createElement('div');
  body.className = 'thinking-body hidden';
  details.append(summary, body);
  insertBeforeFinalAnswer(details, runId);
  const view = {
    el: details,
    body,
    runId,
    key,
    segments: new Map(),
  };
  thinkingViews.set(key, view);
  scrollBottom();
  return view;
}

function firstThinkingNodeForRun(runId) {
  if (!runId) return null;
  const thinkingNodes = new Set();
  for (const view of thinkingViews.values()) {
    if (view.runId === runId && view.el?.parentNode === messagesEl) {
      thinkingNodes.add(view.el);
    }
  }
  for (const state of thinkingSegments.values()) {
    if (state.runId === runId && state.inlineView?.parentNode === messagesEl) {
      thinkingNodes.add(state.inlineView);
    }
  }
  return [...messagesEl.children].find((node) => thinkingNodes.has(node)) || null;
}

function insertBeforeRunThinkingOrFinalAnswer(node, runId) {
  const thinkingAnchor = firstThinkingNodeForRun(runId);
  if (thinkingAnchor?.parentNode === messagesEl) {
    messagesEl.insertBefore(node, thinkingAnchor);
    return;
  }
  insertBeforeFinalAnswer(node, runId);
}

function addThinkingUpdate(event) {
  if (!showThinking) return;
  const payload = event.payload || {};
  const runId = event.runId || currentRunId || 'standalone';
  const key = thinkingSegmentKey(event, payload);
  const state = thinkingSegmentState(key, runId);
  if (state.finalized) return;
  const fullText = typeof payload.text === 'string' ? payload.text : '';
  const textDelta = typeof payload.textDelta === 'string' ? payload.textDelta : '';
  const summary = typeof payload.summary === 'string' ? payload.summary : '';
  if (fullText) {
    state.text = fullText;
  } else if (textDelta) {
    state.text += textDelta;
  } else if (summary.trim()) {
    state.text = payload.status === 'completed' ? summary : state.text + summary;
  }
  const liveText = String(state.text ?? '').trim();
  if (!liveText) return;
  if (isShortThinkingText(liveText)) {
    renderInlineThinking(state, liveText);
    return;
  }
  if (state.inlineView) {
    state.inlineView.remove();
    thinkingInlineViews.delete(state.key);
    state.inlineView = null;
  }
  ensureThinkingCard(state);
  // A reasoning item reaching "completed" is not a UI boundary. Providers
  // can emit response/model lifecycle events and the next reasoning item
  // around the same model turn. Keep one visible segment until a runtime
  // boundary (tool, approval, run end) closes it.
  scrollBottom();
}

function parseJsonValue(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return undefined; }
}

function toolArgsSummary(name, args) {
  const parsed = parseJsonValue(args);
  if (!parsed || typeof parsed !== 'object') return '';
  if (name === 'read_file' && typeof parsed.path === 'string') return `文件 ${parsed.path}`;
  if (name === 'write_file' && typeof parsed.path === 'string') {
    const bytes = typeof parsed.content === 'string' ? new TextEncoder().encode(parsed.content).length : 0;
    return `文件 ${parsed.path}${bytes ? ` · ${bytes} 字节` : ''}`;
  }
  if (name === 'list_files' && typeof parsed.dir === 'string') return `目录 ${parsed.dir}`;
  if (name === 'search_files' && typeof parsed.text === 'string') {
    return `搜索：${parsed.text}${typeof parsed.glob === 'string' ? ` · ${parsed.glob}` : ''}`;
  }
  if (name === 'export_st_program') return '导出 IEC 61131-3 ST 程序';
  if (name === 'run_command' && typeof parsed.command === 'string') return `命令：${parsed.command}`;
  return '';
}

function truncateText(text, max = 140) {
  const compact = String(text ?? '').replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

function sanitizeAssistantText(text) {
  const raw = String(text ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withoutHistoricalMarker = raw.replace(
    /【历史对话，仅作参考，不是本轮执行目标】[\t ]*(?:\r?\n)?/gu,
    ''
  );
  const internalPatterns = [
    /^Tool call validation failed due to the following issue:/i,
    /^Please approve this write operation to save\b/i,
    /^Tool call ["'][^"']+["'] .* has no available artifacts\./i,
  ];
  return internalPatterns.some((pattern) => pattern.test(trimmed))
    ? ''
    : withoutHistoricalMarker;
}

function byteLength(text) {
  return new TextEncoder().encode(String(text ?? '')).length;
}

function durationLabel(durationMs) {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return '';
  if (durationMs < 1000) return `耗时 ${Math.round(durationMs)}ms`;
  return `耗时 ${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
}

function toolRunKey(payload) {
  return payload.callId || payload.itemId || '';
}

function rememberToolRun(name, payload) {
  const run = {
    name,
    args: typeof payload.arguments === 'string' ? payload.arguments : '',
    startedAt: Date.now(),
    startNote: null,
  };
  const key = toolRunKey(payload);
  if (key) {
    toolRuns.set(key, run);
  } else {
    const queue = anonymousToolRuns.get(name) || [];
    queue.push(run);
    anonymousToolRuns.set(name, queue);
  }
  return run;
}

function takeToolRun(name, payload) {
  const key = toolRunKey(payload);
  if (key && toolRuns.has(key)) {
    const run = toolRuns.get(key);
    toolRuns.delete(key);
    return run;
  }
  const queue = anonymousToolRuns.get(name);
  if (queue?.length) {
    const run = queue.shift();
    if (!queue.length) anonymousToolRuns.delete(name);
    return run;
  }
  return undefined;
}

const workflowStatusText = {
  pending: '待执行',
  running: '执行中',
  awaiting_approval: '等待审批',
  completed: '已完成',
  failed: '未通过',
  cancelled: '已停止',
};

const workflowStatusIcon = {
  pending: '○',
  running: '●',
  awaiting_approval: '!',
  completed: '✓',
  failed: '!',
  cancelled: '–',
};

function normalizeWorkflowDescriptor(workflow) {
  if (!workflow || typeof workflow !== 'object' || !Array.isArray(workflow.stages)) {
    return undefined;
  }
  const stages = workflow.stages
    .filter((stage) => stage && typeof stage === 'object' && typeof stage.id === 'string')
    .map((stage, index) => ({
      order: typeof stage.order === 'number' ? stage.order : index + 1,
      id: stage.id,
      toolName: typeof stage.toolName === 'string' ? stage.toolName : '',
      title: typeof stage.title === 'string' && stage.title.trim()
        ? stage.title.trim()
        : stage.id,
      description: typeof stage.description === 'string' ? stage.description.trim() : '',
      successEvidence: typeof stage.successEvidence === 'string'
        ? stage.successEvidence.trim()
        : '',
      onFailure: typeof stage.onFailure === 'string' ? stage.onFailure : 'retry',
    }))
    .sort((a, b) => a.order - b.order);
  if (!stages.length) return undefined;
  return {
    id: typeof workflow.id === 'string' ? workflow.id : 'workflow',
    title: typeof workflow.title === 'string' && workflow.title.trim()
      ? workflow.title.trim()
      : '执行流程',
    stages,
  };
}

function workflowStageForTool(view, toolName) {
  if (!view || !toolName) return undefined;
  return [...view.stages.values()].find((stage) => stage.definition.toolName === toolName);
}

function workflowStageCount(view, status) {
  return [...view.stages.values()].filter((stage) => stage.status === status).length;
}

function workflowOverallStatus(view) {
  if (view.terminalStatus) return view.terminalStatus;
  if ([...view.stages.values()].some((stage) => stage.status === 'awaiting_approval')) {
    return 'awaiting_approval';
  }
  if ([...view.stages.values()].some((stage) => stage.status === 'running')) {
    return 'running';
  }
  if ([...view.stages.values()].some((stage) => stage.status === 'failed')) {
    return 'failed';
  }
  if ([...view.stages.values()].every((stage) => stage.status === 'completed')) {
    return 'completed';
  }
  return 'pending';
}

function workflowOverallLabel(view) {
  const status = workflowOverallStatus(view);
  if (status === 'completed') return '流程完成';
  if (status === 'failed') return '需要修正';
  if (status === 'awaiting_approval') return '等待审批';
  if (status === 'cancelled') return '已停止';
  if (status === 'running') return '执行中';
  return '待开始';
}

function renderWorkflowStageView(view) {
  if (!view) return;
  const status = workflowOverallStatus(view);
  const completed = workflowStageCount(view, 'completed');
  const total = view.stages.size;
  view.statusEl.textContent = workflowOverallLabel(view);
  view.statusEl.className = `workflow-stage-status ${status}`;
  view.progressEl.textContent = `${completed}/${total} 阶段`;
  view.root.className = `workflow-stage-view ${status}`;

  for (const stage of view.stages.values()) {
    const stageStatus = stage.status;
    stage.row.className = `workflow-stage-row ${stageStatus}`;
    stage.icon.textContent = workflowStatusIcon[stageStatus] || workflowStatusIcon.pending;
    stage.statusEl.textContent = workflowStatusText[stageStatus] || workflowStatusText.pending;
    stage.statusEl.className = `workflow-stage-row-status ${stageStatus}`;
    if (stage.definition.successEvidence) {
      stage.row.title = `完成依据：${stage.definition.successEvidence}`;
    }
  }
}

function createWorkflowStageView(runId, workflow) {
  const descriptor = normalizeWorkflowDescriptor(workflow);
  if (!runId || !descriptor) return undefined;
  const existing = workflowViews.get(runId);
  if (existing) return existing;

  const root = document.createElement('section');
  root.className = 'workflow-stage-view pending';
  root.dataset.runId = runId;
  root.setAttribute('aria-label', `${descriptor.title}阶段进度`);

  const header = document.createElement('div');
  header.className = 'workflow-stage-header';
  const title = document.createElement('div');
  title.className = 'workflow-stage-title';
  title.textContent = descriptor.title;
  const headerRight = document.createElement('div');
  headerRight.className = 'workflow-stage-header-right';
  const progress = document.createElement('span');
  progress.className = 'workflow-stage-progress';
  const status = document.createElement('span');
  status.className = 'workflow-stage-status pending';
  headerRight.append(progress, status);
  header.append(title, headerRight);

  const list = document.createElement('div');
  list.className = 'workflow-stage-list';
  const view = {
    runId,
    descriptor,
    root,
    statusEl: status,
    progressEl: progress,
    stages: new Map(),
    terminalStatus: undefined,
  };
  for (const definition of descriptor.stages) {
    const row = document.createElement('div');
    row.className = 'workflow-stage-row pending';
    row.dataset.stageId = definition.id;

    const icon = document.createElement('span');
    icon.className = 'workflow-stage-icon pending';
    icon.textContent = workflowStatusIcon.pending;

    const body = document.createElement('div');
    body.className = 'workflow-stage-body';
    const rowTitle = document.createElement('div');
    rowTitle.className = 'workflow-stage-row-title';
    rowTitle.textContent = definition.title;
    body.appendChild(rowTitle);
    if (definition.toolName) {
      const tool = document.createElement('div');
      tool.className = 'workflow-stage-tool';
      tool.textContent = definition.toolName;
      body.appendChild(tool);
    }

    const rowStatus = document.createElement('span');
    rowStatus.className = 'workflow-stage-row-status pending';
    rowStatus.textContent = workflowStatusText.pending;
    row.append(icon, body, rowStatus);
    list.appendChild(row);
    view.stages.set(definition.id, {
      definition,
      status: 'pending',
      attempts: 0,
      row,
      icon,
      statusEl: rowStatus,
    });
  }
  root.append(header, list);
  insertBeforeRunThinkingOrFinalAnswer(root, runId);
  workflowViews.set(runId, view);
  renderWorkflowStageView(view);
  scrollBottom();
  return view;
}

function updateWorkflowStage(runId, toolName, status, result) {
  const view = workflowViews.get(runId || currentRunId);
  const stage = workflowStageForTool(view, toolName);
  if (!stage) return;
  stage.status = status;
  if (status === 'running') stage.attempts += 1;
  if (result !== undefined) stage.result = result;
  renderWorkflowStageView(view);
}

function rememberWorkflowApproval(runId, approvalId, toolName) {
  if (!approvalId || !toolName) return;
  workflowApprovals.set(approvalId, { runId, toolName });
  updateWorkflowStage(runId, toolName, 'awaiting_approval');
}

function resolveWorkflowApproval(approvalId, approved) {
  const approval = workflowApprovals.get(approvalId);
  if (!approval) return;
  workflowApprovals.delete(approvalId);
  updateWorkflowStage(
    approval.runId,
    approval.toolName,
    approved ? 'running' : 'failed',
  );
}

function finishWorkflowView(runId, status) {
  const view = workflowViews.get(runId || currentRunId);
  if (!view) return;
  if (status === 'failed' || status === 'cancelled') {
    const current = [...view.stages.values()].find((stage) =>
      stage.status === 'running' || stage.status === 'awaiting_approval',
    ) || [...view.stages.values()].find((stage) => stage.status === 'pending');
    if (current) current.status = status === 'cancelled' ? 'cancelled' : 'failed';
  }
  view.terminalStatus = status;
  renderWorkflowStageView(view);
}

const TOOL_LINE_VERBS = {
  read_file: ['正在读取', '已读取'],
  write_file: ['正在写入', '已写入'],
  list_files: ['正在列出', '已列出'],
  search_files: ['正在搜索', '已搜索'],
  run_command: ['正在运行', '已运行'],
  export_st_program: ['正在导出', '已导出'],
};

const TOOL_LINE_MAX_TARGET = 80;

function toolLineTarget(name, args) {
  // export_st_program 的参数摘要是一句说明而不是具体目标，交给结果标题去说。
  if (name === 'export_st_program') return '';
  const summary = toolArgsSummary(name, args);
  return summary.replace(/^(?:命令|文件|目录|搜索)：/, '');
}

function toolLineText(name, args, state) {
  const target = toolLineTarget(name, args);
  const short = target ? truncateText(target, TOOL_LINE_MAX_TARGET) : '';
  const verbs = TOOL_LINE_VERBS[name];
  if (!verbs) {
    if (state === 'running') return `正在执行 · ${name}`;
    if (state === 'failure') return short ? `执行失败 · ${name} · ${short}` : `执行失败 · ${name}`;
    return short ? `已执行 · ${name} · ${short}` : `已执行 · ${name}`;
  }
  const verb = state === 'running'
    ? verbs[0]
    : state === 'failure'
      ? `${verbs[0].replace(/^正在/, '')}失败`
      : verbs[1];
  return short ? `${verb} · ${short}` : verb;
}

// 完成后那半行小字：工具名已经在动词里说了，这里只留结果口径和耗时。
function toolLineMeta(name, formatted, durationMs) {
  const duration = durationLabel(durationMs);
  const meta = typeof formatted?.meta === 'string' ? formatted.meta : '';
  const parts = meta
    .split(' · ')
    .filter((part) => part && part !== name && !part.startsWith('耗时 '));
  const headline = typeof formatted?.headline === 'string' ? formatted.headline : '';
  const exit = name === 'run_command' ? headline.match(/退出码\s*(-?\d+)/) : null;
  if (exit) parts.push(`退出码 ${exit[1]}`);
  // 行数、条数、字节数这类「结果有多大」只在标题里，挪到行尾才有用。
  const size = headline.match(/·\s*(\d+)\s*(行|项|条结果|条|字节|处)/);
  if (size && !parts.includes(`${size[1]} ${size[2]}`)) parts.unshift(`${size[1]} ${size[2]}`);
  if (duration) parts.push(duration);
  return parts.join(' · ');
}

function createToolLine(name, args) {
  const line = document.createElement('div');
  line.className = 'tool-line';
  line.dataset.tool = name;
  line.dataset.state = 'running';
  const row = document.createElement('div');
  row.className = 'tool-line-row';
  const icon = document.createElement('span');
  icon.className = 'tool-line-icon';
  icon.textContent = '◐';
  const text = document.createElement('span');
  text.className = 'tool-line-text';
  text.textContent = toolLineText(name, args, 'running');
  const target = toolLineTarget(name, args);
  if (target) text.title = target;
  const meta = document.createElement('span');
  meta.className = 'tool-line-meta';
  row.append(icon, text, meta);
  line.append(row);
  return line;
}

function commandGroupState(group) {
  const body = group.querySelector('.tool-group-body');
  const rows = body ? [...body.querySelectorAll('.tool-line')] : [];
  return {
    rows,
    count: rows.length,
    running: rows.filter((row) => row.dataset.state === 'running').length,
    failed: rows.filter((row) => row.dataset.state === 'failure').length,
  };
}

function refreshCommandGroup(group) {
  if (!group || !group.isConnected) return;
  const { count, running, failed } = commandGroupState(group);
  if (!count) {
    group.remove();
    return;
  }
  group.classList.toggle('single', count === 1);
  group.dataset.failed = failed > 0 ? '1' : '';
  if (count === 1) {
    group.classList.remove('expanded');
  } else if (running > 0) {
    group.classList.add('expanded');
  } else if (!group.dataset.userToggled) {
    group.classList.remove('expanded');
  }
  const header = group.querySelector('.tool-group-header');
  if (!header) return;
  header.textContent = running > 0
    ? `正在运行 ${count} 条命令`
    : failed > 0
      ? `已运行 ${count} 条命令 · ${failed} 条失败`
      : `已运行 ${count} 条命令`;
}

function createCommandGroup() {
  const group = document.createElement('div');
  group.className = 'tool-group single';
  group.dataset.tool = 'run_command';
  const header = document.createElement('div');
  header.className = 'tool-group-header';
  header.addEventListener('click', () => {
    const { running } = commandGroupState(group);
    if (running > 0) return;
    group.dataset.userToggled = '1';
    group.classList.toggle('expanded');
  });
  const body = document.createElement('div');
  body.className = 'tool-group-body';
  group.append(header, body);
  return group;
}

function appendToolLine(name, line) {
  if (name !== 'run_command') {
    messagesEl.appendChild(line);
    return line;
  }
  const last = messagesEl.lastElementChild;
  let group;
  if (last && last.classList.contains('tool-group') && last.dataset.tool === name) {
    group = last;
  } else {
    group = createCommandGroup();
    if (last && last.classList.contains('tool-line') && last.dataset.tool === name) {
      messagesEl.insertBefore(group, last);
      group.querySelector('.tool-group-body').appendChild(last);
    } else {
      messagesEl.appendChild(group);
    }
  }
  group.querySelector('.tool-group-body').appendChild(line);
  refreshCommandGroup(group);
  return line;
}

function removeToolLine(run) {
  const line = run?.startNote;
  if (!line || !line.isConnected) return;
  const group = line.closest('.tool-group');
  line.remove();
  if (group) refreshCommandGroup(group);
}


function formatToolInputError(name, rawError, meta, rawArgs) {
  const text = String(rawError ?? '').trim();
  if (!/(?:InvalidToolInputError|Invalid JSON input for tool|Invalid input for tool)/i.test(text)) {
    return undefined;
  }
  const badJson = /Invalid JSON input for tool/i.test(text);
  const argsText = typeof rawArgs === 'string' && rawArgs.trim()
    ? rawArgs.trim()
    : '';
  const parsedArgs = argsText ? parseJsonValue(argsText) : undefined;
  const argsSummary = argsText
    ? `错误参数：${truncateText(argsText, 220)}`
    : '未拿到工具参数原文；可在 OUTPUT 中查看 [toolargs] 日志。';
  return {
    headline: `执行失败：${name} 参数格式错误，工具未执行`,
    summary: badJson
      ? `模型生成的工具参数不是合法 JSON；工具实现还没有开始执行。${argsSummary}`
      : `模型生成的工具参数没有通过 schema 校验；工具实现还没有开始执行。${argsSummary}`,
    meta,
    detail: {
      cause: 'invalid_tool_input',
      tool: name,
      error: text,
      rawArguments: argsText || null,
      parsedArguments: parsedArgs ?? null,
      argumentsWereJson: parsedArgs !== undefined,
    },
  };
}

function isDiagnosticCheckTool(name) {
  return /^(?:validate|lint|check)(?:_|$)/i.test(String(name || ''));
}

function hasStructuredCheckResult(parsed) {
  const data = parsed && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
    ? parsed.data
    : {};
  return Array.isArray(parsed?.diagnostics)
    || Array.isArray(data.diagnostics)
    || typeof data.errorCount === 'number'
    || typeof data.warningCount === 'number'
    || typeof data.infoCount === 'number';
}

function checkFailureHeadline(name, parsed) {
  const error = typeof parsed?.error === 'string' ? parsed.error.trim() : '';
  if (error) return error;
  if (name === 'validate_st_code') return 'ST 校验未通过';
  return '检查未通过';
}

function isHistoricalArgumentGuardText(value) {
  if (typeof value !== 'string') return false;
  return /疑似沿用了历史对话中的资源参数|已阻止工具\s+.+\s+执行/.test(value);
}

function isHistoricalArgumentGuardResult(summary, result, parsed) {
  const candidates = [
    summary,
    typeof result === 'string' ? result : '',
    parsed?.error,
    ...(Array.isArray(parsed?.diagnostics)
      ? parsed.diagnostics.map((diagnostic) => diagnostic?.message)
      : []),
  ];
  return candidates.some(isHistoricalArgumentGuardText);
}

function formatToolResult(name, summary, result, run, durationMs) {
  const parsed = result && typeof result === 'object'
    ? result
    : parseJsonValue(summary);
  const args = parseJsonValue(run?.args);
  const duration = durationLabel(durationMs);
  const metaParts = [name, duration].filter(Boolean);
  const meta = metaParts.join(' · ');
  if (isHistoricalArgumentGuardResult(summary, result, parsed)) {
    return { hidden: true };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const text = typeof summary === 'string' ? summary.trim() : '';
    const inputError = formatToolInputError(name, text, meta, run?.args);
    if (inputError) return inputError;
    return {
      headline: text && !/^[\[{]/.test(text) ? text : '工具执行成功',
      summary: '',
      meta,
      detail: '',
    };
  }
  if (parsed.ok === false) {
    const inputError = formatToolInputError(name, parsed.error, meta, run?.args);
    if (inputError) {
      return {
        ...inputError,
        detail: {
          ...inputError.detail,
          toolResult: parsed,
        },
      };
    }
    if (isDiagnosticCheckTool(name) && hasStructuredCheckResult(parsed)) {
      return {
        headline: checkFailureHeadline(name, parsed),
        summary: toolArgsSummary(name, run?.args),
        meta,
        detail: parsed,
        suppressFailurePrefix: true,
      };
    }
    return {
      headline: parsed.error ? `执行失败：${parsed.error}` : '执行失败',
      summary: toolArgsSummary(name, run?.args),
      meta,
      detail: parsed,
    };
  }
  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
  if (name === 'read_file') {
    const path = args && typeof args.path === 'string' ? args.path : '文件';
    const lines = typeof data.totalLines === 'number' ? ` · ${data.totalLines} 行` : '';
    const content = typeof data.content === 'string' ? data.content : '';
    const bytes = content ? ` · ${byteLength(content)} 字节` : '';
    const complete = data.complete === true;
    const truncated = data.truncated === true;
    const range = typeof data.startLine === 'number' && typeof data.endLine === 'number'
      ? `第 ${data.startLine}-${data.endLine} 行`
      : '';
    const previewLabel = truncated
      ? `结果摘要（当前仅返回${range || '部分内容'}，共 ${data.totalLines ?? '?'} 行）`
      : complete
        ? '结果摘要（界面仅展示前 140 字符，文件内容完整）'
        : '结果摘要（请以执行详情中的完整字段为准）';
    return {
      headline: `已读取 ${path}${lines}`,
      summary: content ? `${previewLabel}：${truncateText(content)}` : '',
      meta: [
        ...metaParts,
        complete ? '完整读取' : truncated ? '分段读取' : '',
        bytes.replace(/^ · /, ''),
      ].filter(Boolean).join(' · '),
      detail: parsed,
    };
  }
  if (name === 'write_file' && typeof data.file === 'string') {
    const file = args && typeof args.path === 'string' ? args.path : data.file;
    return {
      headline: `已写入 ${file}${typeof data.bytes === 'number' ? ` · ${data.bytes} 字节` : ''}`,
      summary: '',
      meta: metaParts.join(' · '),
      detail: parsed,
    };
  }
  if (name === 'edit_file' && typeof data.file === 'string') {
    const file = args && typeof args.path === 'string' ? args.path : data.file;
    const changed = data.changed === true;
    const diff = typeof data.diff === 'string' ? data.diff : '';
    return {
      headline: `${changed ? '已修改' : '内容无变化'} ${file}`,
      summary: diff
        ? `本次编辑 ${typeof data.editsApplied === 'number' ? `${data.editsApplied} 处` : ''}，已生成变更 diff。`
        : '没有可展示的文件差异。',
      meta: metaParts.join(' · '),
      detail: parsed,
      diff,
    };
  }
  if (name === 'export_st_program' && typeof data.file === 'string') {
    return {
      headline: `已导出 ${data.file}`,
      summary: '',
      meta: metaParts.join(' · '),
      detail: parsed,
    };
  }
  if (name === 'run_command' && data && (typeof data.exitCode === 'number' || data.exitCode === null)) {
    const output = typeof data.output === 'string' ? data.output : '';
    return {
      headline: data.exitCode === 0 ? '命令执行成功 · 退出码 0' : `命令执行结束 · 退出码 ${data.exitCode}`,
      summary: output ? `输出摘要：${truncateText(output)}` : '',
      meta: metaParts.join(' · '),
      detail: parsed,
    };
  }
  if (name === 'list_files' && Array.isArray(data.files)) {
    return {
      headline: `已列出文件 · ${data.files.length} 项`,
      summary: `结果摘要：${truncateText(data.files.slice(0, 5).join('、'))}`,
      meta: metaParts.join(' · '),
      detail: parsed,
    };
  }
  if (name === 'search_files' && Array.isArray(data.matches)) {
    return {
      headline: `搜索完成 · ${data.matches.length} 条结果`,
      summary: data.matches.length ? `结果摘要：${truncateText(data.matches.slice(0, 3).join('；'))}` : '',
      meta: metaParts.join(' · '),
      detail: parsed,
    };
  }
  return {
    headline: '工具执行成功',
    summary: '',
    meta: metaParts.join(' · '),
    detail: parsed,
  };
}

// 工具跑完之后就地改写那一行：图标、动词、耗时都在原处换掉，不再另起一张卡。
// 补充信息（diff、结果摘要、完整 JSON、失败原因）挂在行下面，默认收起。
function finishToolLine(line, name, formatted, state, durationMs, run) {
  line.dataset.state = state;
  const icon = line.querySelector('.tool-line-icon');
  if (icon) icon.textContent = state === 'success' ? '✓' : state === 'failure' ? '!' : 'i';
  const text = line.querySelector('.tool-line-text');
  if (text) {
    const composed = toolLineText(name, run?.args, state);
    const headline = typeof formatted?.headline === 'string'
      ? truncateText(formatted.headline, TOOL_LINE_MAX_TARGET + 20)
      : '';
    // 参数里没有具体目标时（导出、重放里缺 tool.started）用结果标题兜底，
    // 否则这一行只剩一个光秃秃的动词。
    text.textContent = composed.includes(' · ') || !headline ? composed : headline;
    const target = toolLineTarget(name, run?.args);
    if (target) text.title = target;
    else text.removeAttribute('title');
  }
  const meta = line.querySelector('.tool-line-meta');
  if (meta) meta.textContent = toolLineMeta(name, formatted, durationMs);
  if (state === 'failure') {
    const reason = String(formatted?.headline || '').replace(/^执行失败[：:]\s*/, '').trim()
      || String(formatted?.summary || '').trim()
      || '执行失败';
    const errorEl = document.createElement('div');
    errorEl.className = 'tool-line-error';
    errorEl.textContent = truncateText(reason, 400);
    line.appendChild(errorEl);
  }
  if (formatted?.diff) {
    const diffDetails = document.createElement('details');
    diffDetails.className = 'tool-diff-details';
    diffDetails.open = true;
    const diffSummary = document.createElement('summary');
    diffSummary.textContent = '查看 Diff';
    const diffPre = document.createElement('pre');
    diffPre.className = 'tool-diff';
    for (const diffLine of String(formatted.diff).split('\n')) {
      const lineEl = document.createElement('span');
      lineEl.className = diffLine.startsWith('+') && !diffLine.startsWith('+++')
        ? 'diff-add'
        : diffLine.startsWith('-') && !diffLine.startsWith('---')
          ? 'diff-remove'
          : diffLine.startsWith('@@')
            ? 'diff-hunk'
            : diffLine.startsWith('---') || diffLine.startsWith('+++')
              ? 'diff-header'
              : '';
      lineEl.textContent = diffLine;
      diffPre.appendChild(lineEl);
      diffPre.appendChild(document.createTextNode('\n'));
    }
    diffDetails.append(diffSummary, diffPre);
    line.appendChild(diffDetails);
  }
  const summaryText = typeof formatted?.summary === 'string' ? formatted.summary.trim() : '';
  const detail = formatted?.detail;
  if (summaryText || detail) {
    const details = document.createElement('details');
    details.className = 'tool-line-details';
    const detailsSummary = document.createElement('summary');
    detailsSummary.textContent = '查看详情';
    details.appendChild(detailsSummary);
    if (summaryText) {
      const summaryEl = document.createElement('div');
      summaryEl.className = 'tool-line-summary';
      summaryEl.textContent = summaryText;
      details.appendChild(summaryEl);
    }
    if (detail) {
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(detail, null, 2);
      details.appendChild(pre);
    }
    line.appendChild(details);
  }
}

function addToolResult(name, ok, summary, result, run, durationMs) {
  const formatted = formatToolResult(name, summary, result, run, durationMs);
  if (formatted.hidden) {
    removeToolLine(run);
    return null;
  }
  const state = ok ? 'success' : 'failure';
  let line = run?.startNote;
  if (!line || !line.isConnected) {
    // 历史回放里可能只有 tool.completed、没有 tool.started，这里补一行终态。
    line = appendToolLine(name, createToolLine(name, run?.args ?? ''));
  }
  finishToolLine(line, name, formatted, state, durationMs, run);
  const group = line.closest('.tool-group');
  if (group) refreshCommandGroup(group);
  scrollBottom();
  return line;
}

function addDiagnosticReport(report) {
  if (!report || typeof report !== 'object') return;
  const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
  const counts = report.counts && typeof report.counts === 'object' ? report.counts : {};
  const target = report.validationTarget && typeof report.validationTarget === 'object'
    ? report.validationTarget
    : {};
  const note = document.createElement('div');
  note.className = 'diagnostic-report';
  const icon = document.createElement('span');
  icon.className = 'diagnostic-report-icon';
  icon.textContent = 'i';
  const body = document.createElement('div');
  body.className = 'diagnostic-report-body';
  const title = document.createElement('div');
  title.className = 'diagnostic-report-title';
  title.textContent = `完整诊断旁路 · ${report.toolName || 'diagnostics'} · ${diagnostics.length} 条`;
  body.appendChild(title);
  const summary = document.createElement('div');
  summary.className = 'diagnostic-report-summary';
  summary.textContent = [
    target.path ? `目标 ${target.path}` : '',
    `error=${counts.error || 0}`,
    `warning=${counts.warning || 0}`,
    `info=${counts.info || 0}`,
  ].filter(Boolean).join(' · ');
  body.appendChild(summary);
  const details = document.createElement('details');
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = '查看完整诊断';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(report, null, 2);
  details.append(detailsSummary, pre);
  body.appendChild(details);
  note.append(icon, body);
  messagesEl.appendChild(note);
  scrollBottom();
}

// 工具结果里可以带一份「动作」清单(形状见 src/protocol/results.ts 的 toolResultActionSchema):
// 界面上渲染成一行说明加一个可点的名字,点一下就把命令发给扩展去执行。
// 它不是工具卡——工具卡是"已经做完"的记录,点了没反应;这里点一下是发起动作,
// 由界面直接发给扩展,不经过模型。界面不认识具体是哪个工具,声明里写什么就照着做什么。
//
// 这份指纹只用来判断"同一条是不是已经渲染过"。它中间夹着不可见的 NUL,塞进
// CSS 选择器会被替换成别的字符,拿它当元素标识就永远找不回那一行 —— 所以元素
// 标识另外发流水号:标签上存号,回执也按号认,跟内容无关。
function toolActionFingerprint(action) {
  return `${action.command}\u0000${JSON.stringify(action.args ?? [])}`;
}

function toolActionsOf(result) {
  const actions = result && typeof result === 'object' ? result.actions : undefined;
  if (!Array.isArray(actions)) return [];
  return actions.filter((action) => !!action
    && typeof action === 'object'
    && typeof action.label === 'string' && action.label.trim()
    && typeof action.text === 'string' && action.text.trim()
    && typeof action.command === 'string' && action.command.trim());
}

// 本轮新冒出来的动作。先只把声明记下来,等这一轮的答复文本渲染完再建 DOM ——
// 在工具卡那一步就插会先露一次,答复渲染完又挪一次,看起来像渲染了两遍。
const pendingToolActions = [];

// 每渲染一行就发一个流水号。工具动作行的元素标识和回执标识都用它,
// 不用内容指纹(原因见上面 toolActionFingerprint 那段注释)。
let toolActionSeq = 0;
const toolActionLines = new Map();
const renderedToolActions = new Set();

function flushToolActions() {
  if (!pendingToolActions.length) return;
  for (const action of pendingToolActions.splice(0, pendingToolActions.length)) {
    addToolActionLine(action);
  }
}

function addToolActionLine(action) {
  const fingerprint = toolActionFingerprint(action);
  if (renderedToolActions.has(fingerprint)) return null;
  renderedToolActions.add(fingerprint);

  const actionKey = `tool-action-${++toolActionSeq}`;

  const line = document.createElement('div');
  line.className = 'tool-action-line';
  line.dataset.toolAction = actionKey;

  const label = document.createElement('span');
  label.className = 'tool-action-label';
  label.textContent = `${action.label.trim()} `;

  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'tool-action-link';
  link.textContent = action.text.trim();
  if (typeof action.title === 'string' && action.title) link.title = action.title;

  const status = document.createElement('span');
  status.className = 'tool-action-status';

  link.addEventListener('click', () => {
    if (line.classList.contains('pending')) return;
    line.classList.remove('failed');
    line.classList.add('pending');
    link.disabled = true;
    status.textContent = ' 执行中…';
    vscode.postMessage({
      type: 'pluginCommand',
      command: action.command,
      args: Array.isArray(action.args) ? action.args : [],
      actionKey,
    });
  });

  line.append(label, link, status);
  messagesEl.appendChild(line);
  toolActionLines.set(actionKey, line);
  scrollBottom();
  return line;
}

function markToolActionLine(actionKey, ok, error) {
  const key = String(actionKey ?? '');
  if (!key) return;
  const line = toolActionLines.get(key);
  if (!line) return;
  const link = line.querySelector('.tool-action-link');
  const status = line.querySelector('.tool-action-status');
  line.classList.remove('pending');
  if (ok) {
    // 打开工程这类动作,执行成功本身就是结果,不用再补一句状态。
    // 名字保持可点(想再开一个窗口还能点),状态位留空。
    if (status) status.textContent = '';
    return;
  }
  line.classList.add('failed');
  if (link) link.disabled = false;
  if (status) status.textContent = ` 失败：${error || '未知原因'}（可以再点一次）`;
}

// 本轮 token 用量(部分网关流式响应不带 usage 字段,拿不到就不显示)
// 调用次数只在日志里看,界面上不展示。
function showUsage(usage) {
  if (!usage) return;
  const total = (usage.inputTokens || 0) + (usage.outputTokens || 0);
  if (!total) return;
  addNote(
    'usage-note',
    `用量 · 输入 ${usage.inputTokens} / 输出 ${usage.outputTokens}`,
  );
}

function inlineTextNode(parent, text) {
  if (text) parent.appendChild(document.createTextNode(text));
}

function appendInlineMarkdown(parent, text) {
  const source = String(text ?? '');
  const tokenPattern = /(`[^`\n]+`|\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|(?<!\w)_([^_\n]+)_(?!\w))/g;
  let cursor = 0;
  let match;
  while ((match = tokenPattern.exec(source))) {
    inlineTextNode(parent, source.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith('`')) {
      const code = document.createElement('code');
      code.className = 'agent-inline-code';
      code.textContent = token.slice(1, -1);
      parent.appendChild(code);
    } else if (match[2] && match[3]) {
      const href = match[3];
      const link = document.createElement('a');
      link.className = 'agent-link';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = match[2];
      parent.appendChild(link);
    } else if (match[4] || match[5]) {
      const strong = document.createElement('strong');
      strong.textContent = match[4] || match[5];
      parent.appendChild(strong);
    } else if (match[6]) {
      const del = document.createElement('del');
      del.textContent = match[6];
      parent.appendChild(del);
    } else if (match[7] || match[8]) {
      const emphasis = document.createElement('em');
      emphasis.textContent = match[7] || match[8];
      parent.appendChild(emphasis);
    } else {
      inlineTextNode(parent, token);
    }
    cursor = tokenPattern.lastIndex;
  }
  inlineTextNode(parent, source.slice(cursor));
}

// 剪贴板交给宿主写。webview 是 iframe，navigator.clipboard 要看焦点和权限，
// execCommand('copy') 失败时只返回 false 不抛错，两条路都会出现「点了变 ✓、粘出来是空」。
let copyRequestSeq = 0;
const pendingCopyRequests = new Map();

function copyTextToClipboard(text) {
  const value = String(text ?? '');
  const requestId = ++copyRequestSeq;
  return new Promise((resolve, reject) => {
    // 宿主那边写入是排队的：连点两个代码块时，第二次要等第一次写完。
    // 超时给短了，大代码块排在后面还没轮到就被判失败。
    const timer = setTimeout(() => {
      pendingCopyRequests.delete(requestId);
      reject(new Error('复制超时'));
    }, 8000);
    pendingCopyRequests.set(requestId, { resolve, reject, timer });
    vscode.postMessage({ type: 'copyText', text: value, requestId });
  });
}

function resolveCopyRequest(msg) {
  const pending = pendingCopyRequests.get(msg.requestId);
  if (!pending) return;
  pendingCopyRequests.delete(msg.requestId);
  clearTimeout(pending.timer);
  if (msg.ok) pending.resolve();
  else pending.reject(new Error(typeof msg.error === 'string' ? msg.error : '复制失败'));
}

function createCodeAction(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'agent-code-action';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick(button);
  });
  return button;
}

function splitTableRow(line) {
  let source = String(line ?? '').trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|') && !source.endsWith('\\|')) source = source.slice(0, -1);
  const cells = [];
  let current = '';
  let escaped = false;
  for (const char of source) {
    if (char === '|' && !escaped) {
      cells.push(current.trim().replace(/\\\|/g, '|'));
      current = '';
      continue;
    }
    if (char === '\\' && !escaped) {
      escaped = true;
      current += char;
      continue;
    }
    escaped = false;
    current += char;
  }
  cells.push(current.trim().replace(/\\\|/g, '|'));
  return cells;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isMarkdownBlockStart(lines, index) {
  const line = lines[index] || '';
  return (
    /^\s*```[A-Za-z0-9_+#.-]*\s*$/.test(line) ||
    /^\s{0,3}#{1,6}\s+/.test(line) ||
    /^\s{0,3}>\s?/.test(line) ||
    /^\s{0,3}(?:[-*+•]\s+|\d+[.)、]\s+)/.test(line) ||
    /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    (index + 1 < lines.length && isTableSeparator(lines[index + 1]))
  );
}

function markdownBlockKey(type, value) {
  return `${type}:${JSON.stringify(value)}`;
}

function parseMarkdownBlocks(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] || '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = line.match(/^\s*```([A-Za-z0-9_+#.-]*)\s*$/);
    if (fence) {
      const codeLines = [];
      const language = fence[1] || '';
      index += 1;
      let closed = false;
      while (index < lines.length) {
        if (/^\s*```\s*$/.test(lines[index])) {
          closed = true;
          index += 1;
          break;
        }
        codeLines.push(lines[index]);
        index += 1;
      }
      const value = { language, text: codeLines.join('\n'), closed };
      blocks.push({ type: 'code', ...value, key: markdownBlockKey('code', value) });
      continue;
    }
    if (index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(line);
      const alignments = splitTableRow(lines[index + 1]).map((cell) => (
        cell.startsWith(':') && cell.endsWith(':')
          ? 'center'
          : cell.endsWith(':')
            ? 'right'
            : 'left'
      ));
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      const value = { headers, alignments, rows };
      blocks.push({ type: 'table', ...value, key: markdownBlockKey('table', value) });
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const value = { level: heading[1].length, text: heading[2] };
      blocks.push({ type: 'heading', ...value, key: markdownBlockKey('heading', value) });
      index += 1;
      continue;
    }
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'rule', key: 'rule' });
      index += 1;
      continue;
    }
    if (/^\s{0,3}>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^\s{0,3}>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ''));
        index += 1;
      }
      const value = { lines: quoteLines };
      blocks.push({ type: 'quote', ...value, key: markdownBlockKey('quote', value) });
      continue;
    }
    const listMatch = line.match(/^\s{0,3}((?:[-*+•])|(\d+)[.)、])\s+(.+)$/);
    if (listMatch) {
      const ordered = !!listMatch[2];
      const start = ordered ? Number(listMatch[2]) : 1;
      const items = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s{0,3}((?:[-*+•])|(\d+)[.)、])\s+(.+)$/);
        if (!itemMatch || (!!itemMatch[2] !== ordered)) break;
        items.push(itemMatch[3]);
        index += 1;
      }
      const value = { ordered, start, items };
      blocks.push({ type: 'list', ...value, key: markdownBlockKey('list', value) });
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    const value = { lines: paragraph };
    blocks.push({ type: 'paragraph', ...value, key: markdownBlockKey('paragraph', value) });
  }
  return blocks;
}

function renderMarkdownBlock(block) {
  if (block.type === 'code') {
    const wrapper = document.createElement('div');
    wrapper.className = 'agent-code-block';
    const toolbar = document.createElement('div');
    toolbar.className = 'agent-code-toolbar';
    const label = document.createElement('div');
    label.className = 'agent-code-label';
    label.textContent = block.language || 'code';
    toolbar.appendChild(label);
    const actions = document.createElement('div');
    actions.className = 'agent-code-actions';
    const wrapButton = createCodeAction('↵', '切换代码换行', (button) => {
      wrapper.classList.toggle('soft-wrap');
      button.classList.toggle('active', wrapper.classList.contains('soft-wrap'));
    });
    const copyButton = createCodeAction('⧉', '复制代码', async (button) => {
      if (copyButton.dataset.copying === '1') return;
      copyButton.dataset.copying = '1';
      try {
        await copyTextToClipboard(block.text);
        button.textContent = '✓';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = '⧉';
          button.classList.remove('copied');
        }, 1200);
      } catch (_error) {
        button.textContent = '!';
        button.classList.add('failed');
        setTimeout(() => {
          button.textContent = '⧉';
          button.classList.remove('failed');
        }, 1200);
      } finally {
        delete copyButton.dataset.copying;
      }
    });
    actions.append(wrapButton, copyButton);
    toolbar.appendChild(actions);
    wrapper.appendChild(toolbar);
    const pre = document.createElement('pre');
    pre.className = 'agent-code';
    pre.textContent = block.text;
    wrapper.appendChild(pre);
    return wrapper;
  }
  if (block.type === 'table') {
    const wrapper = document.createElement('div');
    wrapper.className = 'agent-table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    block.headers.forEach((header, index) => {
      const cell = document.createElement('th');
      cell.style.textAlign = block.alignments[index] || 'left';
      appendInlineMarkdown(cell, header);
      headerRow.appendChild(cell);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const row of block.rows) {
      const rowEl = document.createElement('tr');
      block.headers.forEach((_header, index) => {
        const cell = document.createElement('td');
        cell.style.textAlign = block.alignments[index] || 'left';
        appendInlineMarkdown(cell, row[index] || '');
        rowEl.appendChild(cell);
      });
      tbody.appendChild(rowEl);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }
  if (block.type === 'heading') {
    const heading = document.createElement(block.level <= 2 ? 'h2' : 'h3');
    heading.className = `agent-heading level-${block.level}`;
    appendInlineMarkdown(heading, block.text);
    return heading;
  }
  if (block.type === 'list') {
    const list = document.createElement(block.ordered ? 'ol' : 'ul');
    list.className = 'agent-list';
    if (block.ordered && block.start > 1) list.start = block.start;
    for (const item of block.items) {
      const listItem = document.createElement('li');
      appendInlineMarkdown(listItem, item);
      list.appendChild(listItem);
    }
    return list;
  }
  if (block.type === 'quote') {
    const quote = document.createElement('blockquote');
    block.lines.forEach((line, index) => {
      if (index) quote.appendChild(document.createElement('br'));
      appendInlineMarkdown(quote, line);
    });
    return quote;
  }
  if (block.type === 'rule') return document.createElement('hr');
  const paragraph = document.createElement('p');
  if (
    block.lines.length === 1 &&
    /^(\*\*|__)(.+?)\1$/.test(block.lines[0].trim())
  ) {
    paragraph.className = 'agent-section-title';
  }
  block.lines.forEach((line, index) => {
    if (index) paragraph.appendChild(document.createElement('br'));
    appendInlineMarkdown(paragraph, line);
  });
  return paragraph;
}

function renderRich(bubble, text) {
  const source = String(text ?? '');
  if (!source) {
    bubble.textContent = '';
    richRenderStates.delete(bubble);
    return;
  }
  const blocks = parseMarkdownBlocks(source);
  const previous = richRenderStates.get(bubble);
  const canReuse = !!previous && source.startsWith(previous.source);
  let common = 0;
  if (canReuse) {
    while (
      common < previous.blocks.length &&
      common < blocks.length &&
      previous.blocks[common].key === blocks[common].key
    ) {
      common += 1;
    }
    for (let index = previous.nodes.length - 1; index >= common; index -= 1) {
      previous.nodes[index]?.remove();
    }
  } else {
    bubble.textContent = '';
  }
  const nodes = canReuse ? previous.nodes.slice(0, common) : [];
  for (let index = common; index < blocks.length; index += 1) {
    const node = renderMarkdownBlock(blocks[index]);
    bubble.appendChild(node);
    nodes.push(node);
  }
  richRenderStates.set(bubble, { source, blocks, nodes });
}

function scrollBottom() {
  if (scrollFramePending) return;
  scrollFramePending = true;
  requestAnimationFrame(() => {
    scrollFramePending = false;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// ---------- 发送 ----------

function send() {
  if (runtimeMode !== 'idle') return;
  const text = inputEl.value.trim();
  if (!text) return;
  clearPauseNotice();
  inputEl.value = '';
  autoGrow();
  pendingLocalUserText = text;
  awaitingRunAck = true;
  stopRequestedBeforeRunAck = false;
  beginUserTurn(text);
  vscode.postMessage({ type: 'send', text });
}

sendBtn.addEventListener('click', send);
stopBtn.addEventListener('click', () => {
  if (runtimeMode !== 'running' && runtimeMode !== 'awaiting') return;
  if (awaitingRunAck && !currentRunId) stopRequestedBeforeRunAck = true;
  setRuntimeMode('stopping');
  vscode.postMessage({ type: 'stop' });
});
retryBtn.addEventListener('click', () => {
  if (runtimeMode !== 'idle' || !canRetry) return;
  vscode.postMessage({ type: 'retry' });
});
continueBtn.addEventListener('click', () => {
  if (runtimeMode !== 'idle' || !canContinue) return;
  clearPauseNotice();
  vscode.postMessage({ type: 'continue' });
});
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
});
inputEl.addEventListener('input', autoGrow);

function autoGrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
}

// ---------- 设置面板 ----------

function showSaveStatus(text, kind) {
  setSaveStatusEl.textContent = text || '';
  setSaveStatusEl.classList.toggle('error', kind === 'error');
  setSaveStatusEl.classList.toggle('ok', kind === 'ok');
}

function showSettingsPage(page) {
  const nextPage = page === 'tools' ? page : 'model';
  settingsPage = nextPage;
  for (const item of settingsEl.querySelectorAll('[data-settings-page]')) {
    const match = item.dataset.settingsPage === nextPage;
    if (item.classList.contains('settings-nav-item')) {
      item.classList.toggle('active', match);
    }
    if (item.classList.contains('settings-page')) {
      item.classList.toggle('hidden', !match);
    }
  }
}

function openSettings(page) {
  if (page) showSettingsPage(page);
  else showSettingsPage(settingsPage);
  settingsEl.classList.remove('hidden');
  settingsEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('settings-open');
  settingsSavePending = false;
  showSaveStatus('');
  hideMcpForm();
  requestSettings();
  if (settingsPage === 'model') setBaseEl.focus();
  else settingsCloseEl.focus();
}

function requestSettings(provider, apiFormat, vendorId) {
  const requestId = ++settingsRequestId;
  const message = { type: 'getSettings', requestId };
  if (provider) message.provider = provider;
  if (apiFormat) message.apiFormat = apiFormat;
  if (vendorId) message.vendorId = vendorId;
  vscode.postMessage(message);
}

function providerForFormat(format) {
  return format === 'messages' ? 'anthropic' : 'openai';
}

function closeSettings() {
  settingsSavePending = false;
  showSaveStatus('');
  settingsEl.classList.add('hidden');
  settingsEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('settings-open');
  inputEl.focus();
}

const permissionModeLabels = {
  ask: '请求批准',
  auto: '帮我批准',
  full_access: '完全访问权限',
};

function updatePermissionMode(mode) {
  permissionMode = Object.prototype.hasOwnProperty.call(permissionModeLabels, mode)
    ? mode
    : 'ask';
  modeChip.textContent = `Agent · ${permissionModeLabels[permissionMode]} ▾`;
  modeChip.setAttribute('aria-expanded', permissionMenuEl.classList.contains('hidden') ? 'false' : 'true');
  for (const option of permissionMenuEl.querySelectorAll('[data-permission-mode]')) {
    option.classList.toggle('selected', option.dataset.permissionMode === permissionMode);
  }
}

function togglePermissionMenu(open) {
  const shouldOpen = open === undefined
    ? permissionMenuEl.classList.contains('hidden')
    : open;
  permissionMenuEl.classList.toggle('hidden', !shouldOpen);
  modeChip.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

modeChip.addEventListener('click', (event) => {
  event.stopPropagation();
  togglePermissionMenu();
});
permissionMenuEl.addEventListener('click', (event) => {
  const nextMode = event.target.closest('[data-permission-mode]')?.dataset.permissionMode;
  if (!nextMode || !Object.prototype.hasOwnProperty.call(permissionModeLabels, nextMode)) return;
  updatePermissionMode(nextMode);
  togglePermissionMenu(false);
  vscode.postMessage({ type: 'setPermissionMode', permissionMode: nextMode });
});
document.addEventListener('click', (event) => {
  if (!permissionMenuEl.contains(event.target) && event.target !== modeChip) {
    togglePermissionMenu(false);
  }
});

gearBtn.addEventListener('click', () => openSettings());
modelChip.addEventListener('click', () => openSettings('model'));
settingsCloseEl.addEventListener('click', closeSettings);
settingsEl.querySelector('.settings-nav').addEventListener('click', (event) => {
  const item = event.target.closest('[data-settings-page]');
  if (!item || !item.classList.contains('settings-nav-item')) return;
  showSettingsPage(item.dataset.settingsPage);
});
settingsBuiltinToggleEl.addEventListener('click', () => {
  const expanded = settingsBuiltinToggleEl.getAttribute('aria-expanded') !== 'true';
  settingsBuiltinToggleEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  settingsBuiltinToolsEl.classList.toggle('hidden', !expanded);
  const chevron = settingsBuiltinToggleEl.querySelector('.settings-chevron');
  if (chevron) chevron.textContent = expanded ? '▾' : '▸';
});
function vendorOptionLabel(vendor) {
  if (vendor.name && vendor.model && vendor.name !== vendor.model) {
    return `${vendor.name} · ${vendor.model}`;
  }
  return vendor.name || vendor.model || vendor.id || '未命名供应商';
}

function renderVendorOptions(vendors, apiFormat, selectedId) {
  const list = (Array.isArray(vendors) ? vendors : []).filter((vendor) =>
    !apiFormat || vendor.apiFormat === apiFormat
  );
  knownVendors = Array.isArray(vendors) ? vendors : [];
  setVendorEl.replaceChildren();
  if (creatingVendor || !list.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '新供应商';
    setVendorEl.appendChild(option);
  }
  for (const vendor of list) {
    const option = document.createElement('option');
    option.value = vendor.id;
    option.textContent = vendorOptionLabel(vendor);
    setVendorEl.appendChild(option);
  }
  if (creatingVendor || !selectedId || !list.some((vendor) => vendor.id === selectedId)) {
    setVendorEl.value = creatingVendor || !list.length ? '' : list[0].id;
  } else {
    setVendorEl.value = selectedId;
  }
  currentVendorId = setVendorEl.value;
  setVendorDeleteEl.disabled = !currentVendorId;
}

function startNewVendor() {
  settingsRequestId += 1;
  creatingVendor = true;
  currentVendorId = '';
  setVendorNameEl.value = '';
  setBaseEl.value = '';
  setModelEl.value = '';
  setKeyEl.value = '';
  hasSavedKey = false;
  setKeyEl.placeholder = '必填';
  renderVendorOptions(knownVendors, setFormatEl.value, '');
  setVendorNameEl.focus();
}

setFormatEl.addEventListener('change', () => {
  creatingVendor = false;
  requestSettings(providerForFormat(setFormatEl.value), setFormatEl.value);
});
setVendorEl.addEventListener('change', () => {
  const vendorId = setVendorEl.value;
  if (!vendorId) {
    startNewVendor();
    return;
  }
  creatingVendor = false;
  requestSettings(providerForFormat(setFormatEl.value), setFormatEl.value, vendorId);
});
setVendorAddEl.addEventListener('click', startNewVendor);
setVendorDeleteEl.addEventListener('click', () => {
  if (!currentVendorId) return;
  vscode.postMessage({ type: 'deleteVendor', vendorId: currentVendorId });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsEl.classList.contains('hidden')) closeSettings();
});

setSaveEl.addEventListener('click', () => {
  settingsSavePending = true;
  showSaveStatus('正在保存…');
  vscode.postMessage({
    type: 'saveSettings',
    vendorId: currentVendorId || undefined,
    name: setVendorNameEl.value,
    baseUrl: setBaseEl.value,
    apiKey: setKeyEl.value, // 留空 = 不修改已保存的 key
    model: setModelEl.value,
    provider: providerForFormat(setFormatEl.value),
    apiFormat: setFormatEl.value,
  });
});

function updateModelChip(model, vendorName) {
  if (vendorName && model) {
    modelChip.textContent = `${vendorName} · ${model}`;
    return;
  }
  modelChip.textContent = vendorName || model || '未配置';
}

const builtinProviderLabels = {
  core: '核心',
  st: 'ST',
  devuni: 'DevUni',
};

function renderBuiltinTools(tools) {
  settingsBuiltinToolsEl.replaceChildren();
  const list = Array.isArray(tools) ? tools : [];
  settingsBuiltinCountEl.textContent = list.length ? `${list.length}` : '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-empty';
    empty.style.minHeight = '48px';
    empty.style.border = '0';
    empty.textContent = '暂无内置工具';
    settingsBuiltinToolsEl.appendChild(empty);
    return;
  }
  const groups = new Map();
  for (const tool of list) {
    const providerId = typeof tool.providerId === 'string' && tool.providerId.trim()
      ? tool.providerId.trim()
      : 'core';
    const items = groups.get(providerId) ?? [];
    items.push(tool);
    groups.set(providerId, items);
  }
  for (const [providerId, items] of groups) {
    const heading = document.createElement('div');
    heading.className = 'settings-tool-provider';
    heading.textContent = builtinProviderLabels[providerId] || providerId;
    settingsBuiltinToolsEl.appendChild(heading);
    for (const tool of items) {
      const row = document.createElement('div');
      row.className = 'settings-tool-row';
      const name = document.createElement('div');
      name.className = 'settings-tool-name';
      name.textContent = tool.name || '';
      if (tool.risk) {
        const badge = document.createElement('span');
        badge.className = 'settings-badge';
        badge.textContent = tool.risk;
        name.appendChild(badge);
      }
      row.appendChild(name);
      if (tool.description) {
        const desc = document.createElement('div');
        desc.className = 'settings-tool-desc';
        desc.textContent = tool.description;
        row.appendChild(desc);
      }
      settingsBuiltinToolsEl.appendChild(row);
    }
  }
}

function envToText(env) {
  if (!env || typeof env !== 'object') return '';
  return Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n');
}

function textToArgs(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function textToEnv(text) {
  const env = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1);
  }
  return Object.keys(env).length ? env : undefined;
}

function syncMcpTransportFields() {
  const http = mcpTransportEl.value === 'http';
  mcpStdioFieldsEl.classList.toggle('hidden', http);
  mcpHttpFieldsEl.classList.toggle('hidden', !http);
}

function hideMcpForm() {
  mcpFormEl.classList.add('hidden');
  mcpOriginalNameEl.value = '';
}

function showMcpForm(server) {
  mcpFormEl.classList.remove('hidden');
  mcpOriginalNameEl.value = server?.name || '';
  mcpNameEl.value = server?.name || '';
  mcpTransportEl.value = server?.transport === 'http' ? 'http' : 'stdio';
  mcpCommandEl.value = server?.command || '';
  mcpArgsEl.value = Array.isArray(server?.args) ? server.args.join('\n') : '';
  mcpCwdEl.value = server?.cwd || '';
  mcpEnvEl.value = envToText(server?.env);
  mcpUrlEl.value = server?.url || '';
  syncMcpTransportFields();
  mcpNameEl.focus();
}

function mcpDotClass(server) {
  if (server.enabled === false) return 'disabled';
  if (server.status === 'connected') return 'ok';
  if (server.status === 'error') return 'error';
  return 'connecting';
}

function mcpDotTitle(server) {
  if (server.enabled === false) return '已关闭';
  if (server.status === 'connected') {
    return typeof server.toolCount === 'number'
      ? `已连接 · ${server.toolCount} 个工具`
      : '已连接';
  }
  if (server.status === 'error') {
    return server.error ? `连接失败: ${server.error}` : '连接失败';
  }
  return '未检查';
}

function applyMcpDot(row, server) {
  const dot = row.querySelector('.settings-status-dot');
  if (!dot) return;
  dot.className = `settings-status-dot ${mcpDotClass(server)}`;
  dot.title = mcpDotTitle(server);
}

function renderMcpServers(servers, configPath, writable) {
  settingsMcpPathEl.textContent = configPath ? `(${configPath})` : '';
  const next = Array.isArray(servers) ? servers : [];
  knownMcpServers = next.map((server) => {
    return {
      ...server,
      status: server.enabled === false ? 'disabled' : 'unknown',
      error: undefined,
      toolCount: undefined,
    };
  });
  mcpConfigWritable = writable !== false && !!configPath;
  mcpAddEl.disabled = !mcpConfigWritable;
  mcpOpenEl.disabled = !mcpConfigWritable;
  settingsMcpListEl.replaceChildren();
  if (!knownMcpServers.length) {
    settingsMcpListEl.className = 'settings-empty';
    settingsMcpListEl.textContent = mcpConfigWritable ? '暂无 MCP 服务' : '打开工作区后才能配置项目级 MCP';
    return;
  }
  settingsMcpListEl.className = 'settings-mcp-list';
  for (const server of knownMcpServers) {
    const row = document.createElement('div');
    row.className = 'settings-mcp-row';
    row.dataset.mcpName = server.name;
    const main = document.createElement('div');
    main.className = 'settings-mcp-main';
    const name = document.createElement('div');
    name.className = 'settings-mcp-name';
    const dot = document.createElement('span');
    dot.className = `settings-status-dot ${mcpDotClass(server)}`;
    dot.title = mcpDotTitle(server);
    const label = document.createElement('span');
    label.textContent = server.name || '未命名服务';
    name.appendChild(dot);
    name.appendChild(label);
    const detail = document.createElement('div');
    detail.className = 'settings-mcp-detail';
    const transport = server.transport ? `${server.transport} · ` : '';
    detail.textContent = `${transport}${server.detail || ''}`.trim();
    main.appendChild(name);
    main.appendChild(detail);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'settings-switch';
    toggle.dataset.mcpToggle = server.name;
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', server.enabled === false ? 'false' : 'true');
    toggle.title = server.enabled === false ? '已关闭' : '已开启';
    const actions = document.createElement('div');
    actions.className = 'settings-mcp-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '编辑';
    editBtn.dataset.mcpEdit = server.name;
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '删除';
    deleteBtn.dataset.mcpDelete = server.name;
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    row.appendChild(main);
    row.appendChild(toggle);
    row.appendChild(actions);
    settingsMcpListEl.appendChild(row);
  }
}

function applyMcpStatus(payload) {
  const server = knownMcpServers.find((item) => item.name === payload.name);
  if (server) {
    server.status = payload.status;
    server.enabled = payload.status !== 'disabled';
    server.error = payload.error;
    server.toolCount = payload.toolCount;
  }
  const row = settingsMcpListEl.querySelector(`[data-mcp-name="${CSS.escape(payload.name)}"]`);
  if (!row) return;
  if (server) applyMcpDot(row, server);
  const toggle = row.querySelector('[data-mcp-toggle]');
  if (toggle && server) {
    toggle.setAttribute('aria-checked', server.enabled === false ? 'false' : 'true');
    toggle.title = server.enabled === false ? '已关闭' : '已开启';
  }
}

mcpAddEl.addEventListener('click', () => showMcpForm());
mcpOpenEl.addEventListener('click', () => {
  vscode.postMessage({ type: 'openMcpConfig' });
});
mcpCancelEl.addEventListener('click', hideMcpForm);
mcpTransportEl.addEventListener('change', syncMcpTransportFields);
mcpSaveEl.addEventListener('click', () => {
  const transport = mcpTransportEl.value === 'http' ? 'http' : 'stdio';
  vscode.postMessage({
    type: 'saveMcpServer',
    name: mcpNameEl.value,
    originalName: mcpOriginalNameEl.value || undefined,
    transport,
    command: mcpCommandEl.value,
    args: textToArgs(mcpArgsEl.value),
    cwd: mcpCwdEl.value,
    env: textToEnv(mcpEnvEl.value),
    url: mcpUrlEl.value,
  });
});
settingsMcpListEl.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-mcp-toggle]');
  if (toggle?.dataset.mcpToggle) {
    const enabled = toggle.getAttribute('aria-checked') !== 'true';
    vscode.postMessage({
      type: 'setMcpServerEnabled',
      name: toggle.dataset.mcpToggle,
      enabled,
    });
    return;
  }
  const edit = event.target.closest('[data-mcp-edit]');
  if (edit) {
    const server = knownMcpServers.find((item) => item.name === edit.dataset.mcpEdit);
    showMcpForm(server || { name: edit.dataset.mcpEdit });
    return;
  }
  const remove = event.target.closest('[data-mcp-delete]');
  if (remove?.dataset.mcpDelete) {
    vscode.postMessage({ type: 'deleteMcpServer', name: remove.dataset.mcpDelete });
  }
});

// ---------- 新会话 ----------

const newchatEl = document.getElementById('newchat');
function createNewSession() {
  if (runtimeMode !== 'idle') return;
  setSessionHistoryOpen(false);
  vscode.postMessage({ type: 'newSession' });
}
newchatEl.addEventListener('click', createNewSession);
sessionNewBtn.addEventListener('click', createNewSession);
sessionHistoryBtn.addEventListener('click', () => {
  setSessionHistoryOpen(!sessionHistoryOpen);
});
sessionSearchEl.addEventListener('input', () => {
  sessionSearchQuery = sessionSearchEl.value;
  renderSessions();
});
sessionSearchEl.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setSessionHistoryOpen(false);
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveSessionSelection(1);
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveSessionSelection(-1);
  }
  if (event.key === 'Enter' && selectedSessionId) {
    event.preventDefault();
    switchToSession(selectedSessionId);
  }
});
document.addEventListener('click', (event) => {
  if (!sessionHistoryOpen || !sessionsEl) return;
  if (sessionsEl.contains(event.target)) return;
  setSessionHistoryOpen(false);
});

function showWelcomeHint() {
  if (messagesEl.querySelector('.hint')) return;
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = '试试:"写一个电机星三角启动的 ST 程序,延时 5 秒切换" / "把上面的程序导出为文件"';
  messagesEl.appendChild(hint);
}

// ---------- 审批卡片 ----------

function addApprovalCard(runId, approval) {
  const { id, name, args } = approval;
  if (messagesEl.querySelector(`[data-approval-id="${CSS.escape(id)}"]`)) return;
  rememberWorkflowApproval(runId, id, name);
  const card = document.createElement('div');
  card.className = 'approval-card';
  card.dataset.approvalId = id;

  const title = document.createElement('div');
  title.className = 'approval-title';
  const titleText = document.createElement('span');
  titleText.textContent = `需要审批 · ${name}`;
  const status = document.createElement('span');
  status.className = 'approval-status';
  status.textContent = '等待决定';
  title.append(titleText, status);
  card.appendChild(title);

  const actionSummary = toolArgsSummary(name, args);
  if (actionSummary) {
    const summaryText = document.createElement('div');
    summaryText.className = 'approval-summary';
    summaryText.textContent = actionSummary;
    card.appendChild(summaryText);
  }

  if (args) {
    const detail = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '查看参数';
    const pre = document.createElement('pre');
    pre.textContent = args.length > 2000 ? args.slice(0, 2000) + '…' : args;
    detail.appendChild(summary);
    detail.appendChild(pre);
    card.appendChild(detail);
  }

  const bar = document.createElement('div');
  bar.className = 'approval-actions';
  const okBtn = document.createElement('button');
  okBtn.className = 'btn primary';
  okBtn.textContent = '✓ 允许';
  const noBtn = document.createElement('button');
  noBtn.className = 'btn';
  noBtn.textContent = '拒绝';
  const finish = (approve) => {
    markApprovalCard(id, approve, approve ? '已允许 · 执行中' : '已拒绝');
    vscode.postMessage({ type: 'approvalResponse', runId, approvalId: id, approve });
  };
  okBtn.addEventListener('click', () => finish(true));
  noBtn.addEventListener('click', () => finish(false));
  bar.appendChild(okBtn);
  bar.appendChild(noBtn);
  card.appendChild(bar);

  messagesEl.appendChild(card);
  scrollBottom();
}

function markApprovalCard(id, approved, statusText) {
  if (!id) return;
  resolveWorkflowApproval(id, approved);
  const card = messagesEl.querySelector(`[data-approval-id="${CSS.escape(id)}"]`);
  if (!card) return;
  const className = approved ? 'approved' : 'rejected';
  card.classList.add(className);
  const status = card.querySelector('.approval-status');
  if (status) {
    status.textContent = statusText || (approved ? '已允许' : '已拒绝');
    status.classList.add(className);
  }
  for (const button of card.querySelectorAll('button')) button.disabled = true;
}

function showApprovals(runId, approvals) {
  if (agentBubble) {
    agentBubble.classList.remove('streaming');
    if (!agentText) detachAgentBubbleFromTimeline();
    agentBubble = null;
  }
  currentRunId = runId;
  pendingToolCount = Math.max(pendingToolCount, (approvals || []).length);
  hadToolThisTurn = true;
  for (const approval of approvals || []) addApprovalCard(runId, approval);
  setRuntimeMode('awaiting');
}

function finishApprovalCards(className, statusText) {
  for (const card of messagesEl.querySelectorAll('.approval-card:not(.approved):not(.rejected)')) {
    card.classList.add(className);
    const status = card.querySelector('.approval-status');
    if (status) {
      status.textContent = statusText || (className === 'rejected' ? '已取消' : '已结束');
      status.classList.add(className);
    }
    for (const button of card.querySelectorAll('button')) button.disabled = true;
  }
}

// ---------- 澄清弹窗 ----------

function normalizedClarificationOptions(request) {
  return Array.isArray(request?.options)
    ? request.options
        .filter((option) => option && typeof option.id === 'string' && typeof option.label === 'string')
        .slice(0, 8)
    : [];
}

function clarificationProgressLabel(request) {
  const stepIndex = Number.isInteger(request?.stepIndex) ? request.stepIndex : 0;
  const stepCount = Number.isInteger(request?.stepCount) ? request.stepCount : 1;
  return stepCount > 1 ? `${stepIndex + 1}/${stepCount}` : '';
}

function addClarificationRequest(runId, request) {
  const requestId = request?.requestId;
  if (!requestId) return;
  if (clarificationRequests.has(requestId)) return;
  clarificationRequests.set(requestId, { runId, request, resolved: false });

  const card = document.createElement('div');
  card.className = 'clarification-card';
  card.dataset.clarificationId = requestId;

  const title = document.createElement('div');
  title.className = 'clarification-title';
  const titleText = document.createElement('span');
  titleText.textContent = request.title || '需要补充信息';
  title.appendChild(titleText);
  const progressText = clarificationProgressLabel(request);
  if (progressText) {
    const progress = document.createElement('span');
    progress.className = 'clarification-progress';
    progress.textContent = progressText;
    title.appendChild(progress);
  }
  const status = document.createElement('span');
  status.className = 'clarification-status';
  status.textContent = '等待回复';
  title.appendChild(status);
  card.appendChild(title);

  const question = document.createElement('div');
  question.className = 'clarification-question';
  question.textContent = request.question || '请补充必要信息。';
  card.appendChild(question);

  if (request.details) {
    const details = document.createElement('div');
    details.className = 'clarification-details';
    details.textContent = request.details;
    card.appendChild(details);
  }

  const options = normalizedClarificationOptions(request);
  if (options.length) {
    const list = document.createElement('div');
    list.className = 'clarification-options-preview';
    for (const option of options) {
      const chip = document.createElement('span');
      chip.textContent = option.label;
      list.appendChild(chip);
    }
    card.appendChild(list);
  }

  messagesEl.appendChild(card);
  if (!replayingHistory) showClarificationModal(runId, request);
  setRuntimeMode('awaiting');
  scrollBottom();
}

function closeClarificationModal(requestId) {
  const selector = requestId
    ? `.clarification-modal[data-clarification-id="${CSS.escape(requestId)}"]`
    : '.clarification-modal';
  for (const modal of document.querySelectorAll(selector)) modal.remove();
}

/*
 * 澄清弹窗里自定义输入的格式校验。
 *
 * 规则和 src/plc/plcRuntimeConfig.ts 的 checkIecIdentifier 必须保持一致：
 * 任务名会被原样拼进生成的 IEC 源码（TASK / RESOURCE / PROGRAM 三处），
 * 名字不合法不是风格问题，是编译不过。
 *
 * 前端这一份是为了"边打字边提示"，后端那份才是最终判定。前端漏掉的，
 * 后端还会挡一次，所以这里宁可简单，不要为了覆盖所有边界写复杂逻辑。
 */
const IEC_KEYWORDS = new Set([
  'BOOL', 'SINT', 'INT', 'DINT', 'LINT', 'USINT', 'UINT', 'UDINT', 'ULINT',
  'REAL', 'LREAL', 'BYTE', 'WORD', 'DWORD', 'LWORD', 'TIME', 'LTIME',
  'DATE', 'LDATE', 'TIME_OF_DAY', 'TOD', 'LTOD', 'DATE_AND_TIME', 'DT', 'LDT',
  'STRING', 'WSTRING', 'CHAR', 'WCHAR', 'ARRAY', 'STRUCT', 'UNION', 'ENUM',
  'SUBRANGE', 'POINTER', 'REFERENCE', 'ANY',
  'VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_GLOBAL', 'VAR_TEMP',
  'VAR_EXTERNAL', 'VAR_ACCESS', 'VAR_CONFIG', 'VAR_STAT', 'VAR_INST',
  'RETAIN', 'NON_RETAIN', 'CONSTANT', 'AT', 'END_VAR',
  'FUNCTION', 'FUNCTION_BLOCK', 'PROGRAM', 'INTERFACE', 'METHOD', 'PROPERTY',
  'ACTION', 'TRANSITION', 'STEP', 'INITIAL_STEP',
  'END_FUNCTION', 'END_FUNCTION_BLOCK', 'END_PROGRAM', 'END_INTERFACE',
  'END_METHOD', 'END_PROPERTY', 'END_ACTION', 'END_TRANSITION', 'END_STEP',
  'CONFIGURATION', 'END_CONFIGURATION', 'RESOURCE', 'END_RESOURCE',
  'TASK', 'END_TASK', 'ON', 'WITH', 'INTERVAL', 'PRIORITY', 'SINGLE', 'CYCLIC',
  'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'CASE', 'OF', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR', 'WHILE', 'END_WHILE',
  'REPEAT', 'UNTIL', 'END_REPEAT', 'EXIT', 'RETURN', 'CONTINUE', 'JMP',
  'AND', 'OR', 'XOR', 'NOT', 'MOD', 'TRUE', 'FALSE', 'NULL',
  'READ_ONLY', 'READ_WRITE',
]);

function checkIecIdentifierInput(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '不能为空';
  if (normalized.length > 128) return '不能超过 128 个字符';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    return '必须字母或下划线开头，只能包含字母、数字和下划线';
  }
  const upper = normalized.toUpperCase();
  if (IEC_KEYWORDS.has(upper)) return `不能使用 IEC 关键字 ${upper}`;
  return '';
}

/*
 * 工程名/目录路径的校验，规则和 src/runtime/clarificationInputRules.ts 一致。
 * 前端这份只为"边打字边提示"，后端那份才是最终判定。
 */
const PROJECT_NAME_MAX_LENGTH = 100;
const RESERVED_DEVICE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

function checkProjectNameInput(value) {
  const raw = String(value || '');
  const name = raw.trim();
  if (!name) return '不能为空';
  if (name !== raw) return '首尾不能有空格';
  if (name.length > PROJECT_NAME_MAX_LENGTH) {
    return `不能超过 ${PROJECT_NAME_MAX_LENGTH} 个字符`;
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) return '不能包含换行或控制字符';
  if (/[<>:"/\\|?*]/.test(name)) return '不能包含 < > : " / \\ | ? * 这些字符';
  if (name === '.' || name === '..') return '不能是 . 或 ..';
  if (name.startsWith('.')) return '不能以点开头';
  if (name.endsWith('.')) return '不能以点结尾';
  const base = (name.split('.')[0] || name).toUpperCase();
  if (RESERVED_DEVICE_NAMES.has(base)) return `不能使用系统保留名 ${base}`;
  return '';
}

function checkDirectoryPathInput(value) {
  const raw = String(value || '');
  const target = raw.trim();
  if (!target) return '不能为空';
  if (target !== raw) return '首尾不能有空格';
  if (/[\u0000-\u001f\u007f]/.test(target)) return '不能包含换行或控制字符';
  if (/[<>"|?*]/.test(target)) return '不能包含 < > " | ? * 这些字符';
  if (/^[A-Za-z]:([\\/]|$)/.test(target)) return '';
  if (/^\\\\[^\\/]+[\\/][^\\/]+/.test(target)) return '';
  return '必须是绝对路径，例如 E:\\projects';
}

/**
 * 任务组态那一行自由文本：可能只填周期（20ms），也可能连任务名一起填
 * （task=MainControlTask, 20ms）。只校验填了的部分，没填的交给后端用候选值。
 */
function validateTaskConfigurationInput(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  // 抓到逗号为止：名字里带空格时要整段报错，不能只取第一段当名字，
  // 否则 "task=has space" 会被当成合法的 "has"。
  const taskMatch = /(?:task|任务)\s*[=:：]\s*([^,，;；\r\n]*)/iu.exec(raw);
  if (taskMatch) {
    const problem = checkIecIdentifierInput(taskMatch[1]);
    if (problem) return `任务名${problem}`;
  }
  const unitMatch = /(\d+(?:\.\d+)?)\s*(ms|s)\b/iu.exec(raw);
  if (unitMatch) {
    const value = Number(unitMatch[1]);
    const milliseconds = unitMatch[2].toLowerCase() === 's' ? value * 1000 : value;
    if (!Number.isInteger(milliseconds)) return '任务周期必须是整数毫秒，例如 20ms';
    if (milliseconds < 1 || milliseconds > 60000) return '任务周期必须在 1~60000 ms 之间';
  }
  return '';
}

function validateClarificationInput(rule, text) {
  if (!rule) return '';
  const raw = String(text || '').trim();
  // 空值不报格式错，和 validateClarificationField 保持一致。
  // 选推荐卡会清空自定义框，不短路的话会立刻弹一句"目录不能为空"——
  // 用户明明已经选了卡片，却被自己没填的自定义框判错。
  if (!raw) return '';
  if (rule.type === 'plcTaskConfiguration') return validateTaskConfigurationInput(raw);
  if (rule.type === 'iecIdentifier') {
    const problem = checkIecIdentifierInput(raw);
    return problem ? `${rule.label || '名称'}${problem}` : '';
  }
  if (rule.type === 'projectName') {
    const problem = checkProjectNameInput(raw);
    return problem ? `${rule.label || '工程名'}${problem}` : '';
  }
  if (rule.type === 'directoryPath') {
    const problem = checkDirectoryPathInput(raw);
    return problem ? `${rule.label || '目录'}${problem}` : '';
  }
  if (rule.type === 'positiveInteger') {
    if (!/^\d+$/.test(raw)) return `${rule.label || '数值'}只能是正整数`;
    const value = Number(raw);
    const min = Number.isInteger(rule.min) ? rule.min : 1;
    const unit = rule.unit || '';
    if (value < min) return `${rule.label || '数值'}不能小于 ${min}${unit}`;
    if (Number.isInteger(rule.max) && value > rule.max) {
      return `${rule.label || '数值'}不能大于 ${rule.max}${unit}`;
    }
  }
  return '';
}

function normalizedClarificationFields(request) {
  const fields = Array.isArray(request?.inputFields) ? request.inputFields : [];
  return fields.filter((field) => field && typeof field.key === 'string' && field.key);
}

/**
 * 单个字段的格式校验。空值不报错——用户还没开始填就标红只会吓人，
 * "填没填"由提交按钮单独判断。
 */
function validateClarificationField(field, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const label = field.label || '该字段';
  if (field.type === 'iecIdentifier') {
    const problem = checkIecIdentifierInput(raw);
    return problem ? `${label}${problem}` : '';
  }
  if (field.type === 'projectName') {
    const problem = checkProjectNameInput(raw);
    return problem ? `${label}${problem}` : '';
  }
  if (field.type === 'directoryPath') {
    const problem = checkDirectoryPathInput(raw);
    return problem ? `${label}${problem}` : '';
  }
  if (field.type === 'positiveInteger') {
    if (!/^\d+$/.test(raw)) return `${label}只能填正整数`;
    const number = Number(raw);
    const unit = field.unit || '';
    const min = Number.isInteger(field.min) ? field.min : 1;
    if (number < min) return `${label}不能小于 ${min}${unit}`;
    if (Number.isInteger(field.max) && number > field.max) {
      return `${label}不能大于 ${field.max}${unit}`;
    }
  }
  return '';
}

function showClarificationModal(runId, request) {
  const requestId = request?.requestId;
  if (!requestId || document.querySelector(`.clarification-modal[data-clarification-id="${CSS.escape(requestId)}"]`)) {
    return;
  }
  const options = normalizedClarificationOptions(request);
  const fields = normalizedClarificationFields(request);
  const editableFields = fields.filter((field) => !field.readonly);
  const confirmedFields = fields.filter((field) => field.readonly);
  const formMode = editableFields.length > 0;
  // 只剩一个字段要填时，推荐值做成一行按钮；两个字段都缺时上面仍然是整条方案卡。
  const quickField = formMode && editableFields.length === 1 && editableFields[0].choices?.length
    ? editableFields[0]
    : null;

  const overlay = document.createElement('div');
  overlay.className = 'clarification-modal';
  overlay.dataset.clarificationId = requestId;

  const panel = document.createElement('div');
  panel.className = 'clarification-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  // 标题栏右侧放"已确认"标签：用户在前面已经说清楚的参数只在这里复述一遍，
  // 不给编辑。光写"任务名 MainTask"看不出是待填还是已定，加个状态词才读得懂。
  const header = document.createElement('div');
  header.className = 'clarification-header';
  const title = document.createElement('div');
  title.className = 'clarification-modal-title';
  title.textContent = request.title || '需要补充信息';
  header.appendChild(title);
  if (confirmedFields.length) {
    const confirmed = document.createElement('div');
    confirmed.className = 'clarification-confirmed';
    for (const field of confirmedFields) {
      const badge = document.createElement('span');
      badge.className = 'clarification-confirmed-badge';
      badge.innerHTML =
        '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.6 5.3 L3.9 7.6 L8.4 2.6"/></svg>已确认';
      const value = document.createElement('span');
      value.className = 'clarification-confirmed-value';
      value.textContent = `${field.label} `;
      const strong = document.createElement('strong');
      strong.textContent = `${field.value ?? ''}${field.unit || ''}`;
      value.appendChild(strong);
      confirmed.append(badge, value);
    }
    header.appendChild(confirmed);
  }
  panel.appendChild(header);

  const question = document.createElement('div');
  question.className = formMode
    ? 'clarification-modal-question compact'
    : 'clarification-modal-question';
  question.textContent = request.question || '请补充必要信息。';
  panel.appendChild(question);

  if (request.details) {
    const details = document.createElement('div');
    details.className = 'clarification-modal-details';
    details.textContent = request.details;
    panel.appendChild(details);
  }

  const optionInputs = [];
  const optionLabels = [];
  if (!quickField && options.length) {
    const group = document.createElement('div');
    group.className = 'clarification-option-list';
    options.forEach((option, index) => {
      const label = document.createElement('label');
      label.className = 'clarification-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `clarification-${requestId}`;
      input.value = option.id;
      input.dataset.value = option.value ?? '';
      // 推荐方案和自定义二选一：选了卡片就把自定义框清空，不再两边同时亮着。
      // 用户点回输入框会自动取消卡片选中。
      input.addEventListener('change', () => {
        if (!input.checked) return;
        // 选卡片就等于放弃自定义：字段和自由文本都清空，提交时只带卡片的值。
        for (const control of fieldControls) control.input.value = '';
        if (customInput) customInput.value = '';
        setCustomCollapsed(true);
        syncClarificationState();
      });
      optionInputs.push(input);
      // 序号方块代替原来的圆圈,选中时整行和方块一起高亮。
      const ordinal = document.createElement('span');
      ordinal.className = 'clarification-option-index';
      ordinal.setAttribute('aria-hidden', 'true');
      ordinal.textContent = String(index + 1);
      const text = document.createElement('span');
      text.className = 'clarification-option-text';
      const main = document.createElement('strong');
      main.textContent = option.label;
      text.appendChild(main);
      if (option.description) {
        const desc = document.createElement('small');
        desc.textContent = option.description;
        text.appendChild(desc);
      }
      label.append(input, ordinal, text);
      optionLabels.push(label);
      group.appendChild(label);
    });
    panel.appendChild(group);
  }

  // 单字段模式：只剩一个值要选，用一行按钮就够，不用三张整条方案卡。
  const pillButtons = [];
  if (quickField) {
    const pills = document.createElement('div');
    pills.className = 'clarification-pills';
    for (const choice of quickField.choices) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'clarification-pill';
      pill.textContent = `${choice}${quickField.unit || ''}`;
      pill.addEventListener('click', () => {
        const control = fieldControls.find((item) => item.field.key === quickField.key);
        if (!control) return;
        control.input.value = String(choice);
        syncClarificationState();
        control.input.focus();
      });
      pillButtons.push({ pill, choice });
      pills.appendChild(pill);
    }
    panel.appendChild(pills);
  }

  // 推荐区和自定义区之间画一条界。两区互斥，所以这条界同时也是"切到自定义"的入口：
  // 选中卡片后自定义区会收起，点这条界就把它放回来。
  let dividerEl = null;
  let customArea = null;
  if ((formMode || request.allowCustom !== false) && (quickField || options.length)) {
    dividerEl = document.createElement('div');
    dividerEl.className = 'clarification-divider clickable';
    dividerEl.setAttribute('role', 'button');
    dividerEl.setAttribute('tabindex', '0');
    dividerEl.title = '点击填写自定义内容';
    const dividerText = document.createElement('span');
    dividerText.textContent = '或自定义';
    dividerEl.append(document.createElement('i'), dividerText, document.createElement('i'));
    panel.appendChild(dividerEl);
  }

  // 只渲染用户还缺的字段。已确认的那些在标题栏，不占输入框。
  const fieldControls = [];
  if (formMode) {
    const wrap = document.createElement('div');
    wrap.className = 'clarification-fields';
    if (editableFields.length === 1) wrap.classList.add('single');
    for (const field of editableFields) {
      const box = document.createElement('div');
      box.className = 'clarification-field';
      if (field.type === 'positiveInteger') box.classList.add('clarification-field-narrow');
      const label = document.createElement('div');
      label.className = 'clarification-field-label';
      label.textContent = field.label;
      const row = document.createElement('div');
      row.className = 'clarification-field-input';
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = field.type === 'positiveInteger' ? 'numeric' : 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = field.placeholder || '';
      if (field.initialValue !== undefined) input.value = String(field.initialValue);
      row.appendChild(input);
      if (field.unit) {
        const unit = document.createElement('span');
        unit.className = 'clarification-field-unit';
        unit.textContent = field.unit;
        row.appendChild(unit);
      }
      const hint = document.createElement('div');
      hint.className = 'clarification-field-hint';
      hint.textContent = field.hint || '';
      box.append(label, row, hint);
      wrap.appendChild(box);
      fieldControls.push({ field, input, box, hint });
      // 不拦截输入：填了字母就当场标红说明原因，而不是把字符悄悄吃掉、
      // 让用户以为输入框坏了。校验交给 syncClarificationState 统一做。
      input.addEventListener('input', () => {
        // 动了自定义框就不算"选中了某张推荐卡"，两边不能同时生效。
        for (const radio of optionInputs) radio.checked = false;
        setCustomCollapsed(false);
        syncClarificationState();
      });
      input.addEventListener('focus', () => {
        if (!optionInputs.some((radio) => radio.checked)) return;
        for (const radio of optionInputs) radio.checked = false;
        setCustomCollapsed(false);
        syncClarificationState();
      });
    }
    panel.appendChild(wrap);
    customArea = wrap;
  }

  // 没有字段定义时退回原来那一行自由文本，老调用方不受影响。
  let customInput = null;
  if (!formMode && request.allowCustom !== false) {
    const customRow = document.createElement('div');
    customRow.className = 'clarification-custom-row';
    const customIcon = document.createElement('span');
    customIcon.className = 'clarification-custom-icon';
    customIcon.setAttribute('aria-hidden', 'true');
    customIcon.textContent = '✎';
    customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'clarification-custom';
    customInput.placeholder = request.customPlaceholder || '输入你的答案';
    customRow.append(customIcon, customInput);
    panel.appendChild(customRow);
    customArea = customRow;
    // 老式自由文本同样二选一：一开始打字就取消卡片选中。
    customInput.addEventListener('input', () => {
      for (const radio of optionInputs) radio.checked = false;
      setCustomCollapsed(false);
      syncClarificationState();
    });
  }

  // 推荐方案和自定义二选一：选卡片就收起自定义区，点分隔线或开始打字再展开。
  const setCustomCollapsed = (collapsed) => {
    if (!customArea) return;
    customArea.classList.toggle('collapsed', collapsed);
    dividerEl?.classList.toggle('collapsed', collapsed);
  };
  dividerEl?.addEventListener('click', () => {
    for (const radio of optionInputs) radio.checked = false;
    setCustomCollapsed(false);
    syncClarificationState();
    const target = fieldControls[0]?.input || customInput;
    target?.focus({ preventScroll: true });
  });
  dividerEl?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    dividerEl.click();
  });

  // 可跳过的步骤:把"不选会怎样"写出来,免得用户不知道跳过意味着什么。
  if (request.required === false) {
    const skipHint = document.createElement('div');
    skipHint.className = 'clarification-skip-hint';
    skipHint.textContent = options.length
      ? `可跳过 · 不选则用第一个:${options[0].label}`
      : '可跳过';
    panel.appendChild(skipHint);
  }

  // 格式错误就地提示，别等提交后才由后端回一句"无法解析"——那时候弹窗已经关了。
  const validationHint = document.createElement('div');
  validationHint.className = 'clarification-validation-hint';
  validationHint.hidden = true;
  panel.appendChild(validationHint);

  const actions = document.createElement('div');
  actions.className = 'clarification-actions';
  const cancel = document.createElement('button');
  cancel.className = 'btn';
  cancel.textContent = '取消';
  const confirm = document.createElement('button');
  confirm.className = 'btn primary';
  // 分页指示:参考样式是左右箭头夹着页码。当前是"一步一弹窗",答过的步骤翻不回去,
  // 所以箭头只是装饰、不是按钮 —— 别改成可点的,那会让人以为能翻页。
  const stepIndex = Number.isInteger(request.stepIndex) ? request.stepIndex : 0;
  const stepCount = Number.isInteger(request.stepCount) ? request.stepCount : 1;
  // 多步骤时按钮是"下一步"(点了只是交这一步,后面还有),最后一步才叫"提交"。
  // 只有一步的情况 stepCount=1,落到"提交"。
  confirm.textContent = stepIndex + 1 >= stepCount ? '提交' : '下一步';
  const pager = document.createElement('span');
  pager.className = 'clarification-pager';
  pager.textContent = `‹ ${stepIndex + 1}/${stepCount} ›`;
  actions.appendChild(pager);
  actions.append(cancel, confirm);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // 表单值单独收集：周期按数字发，任务名按字符串发，后端直接读，不再解析文本。
  // 空字段直接不发——某个任务本来就不需要周期时（事件任务），发个 0 过去会被当成非法值。
  const collectFieldValues = () => {
    const values = {};
    for (const control of fieldControls) {
      const raw = control.input.value.trim();
      if (!raw) continue;
      values[control.field.key] =
        control.field.type === 'positiveInteger' ? Number(raw) : raw;
    }
    return values;
  };

  const sendResponse = (cancelled) => {
    const selected = optionInputs.find((input) => input.checked);
    const customText = customInput?.value?.trim() || '';
    const selectedOptionId = selected?.value || undefined;
    const selectedValue = selected?.dataset.value || undefined;
    // 选了推荐卡就不再发字段值：发一个空对象会让后端把卡片选择盖掉。
    const collected = formMode && !cancelled ? collectFieldValues() : undefined;
    const fieldValues = collected && Object.keys(collected).length ? collected : undefined;
    markClarificationCard(requestId, {
      cancelled,
      selectedOptionId,
      customText,
      ...(fieldValues ? { fields: fieldValues } : {}),
    });
    closeClarificationModal(requestId);
    vscode.postMessage({
      type: 'clarificationResponse',
      runId,
      requestId,
      cancelled,
      ...(selectedOptionId ? { selectedOptionId } : {}),
      ...(customText ? { customText } : {}),
      ...(selectedValue ? { value: selectedValue } : {}),
      ...(fieldValues ? { fields: fieldValues } : {}),
    });
    if (!cancelled) setRuntimeMode('running');
  };

  cancel.addEventListener('click', () => sendResponse(true));
  confirm.addEventListener('click', () => sendResponse(false));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && request.required === false) sendResponse(true);
  });

  // 选中态高亮 + 必填的步骤没作答时"提交"不可点。
  // 后者不做的话,"必填"只是句提示:什么都不选照样能过,到了工具那边才报错,用户白跑一趟。
  const enforceAnswer =
    request.required !== false &&
    (options.length > 0 || formMode || request.allowCustom !== false);
  const syncClarificationState = () => {
    optionLabels.forEach((label, index) => {
      label.classList.toggle('selected', optionInputs[index].checked);
    });

    // 每个字段各自校验、各自出提示。没填不报红——用户还没动手就标红只会吓人，
    // "填没填"由提交按钮单独判。
    let formProblem = '';
    let formFilled = true;
    for (const control of fieldControls) {
      const raw = control.input.value.trim();
      const problem = validateClarificationField(control.field, raw);
      control.hint.textContent = problem || control.field.hint || '';
      control.hint.classList.toggle('error', !!problem);
      control.box.classList.toggle('invalid', !!problem);
      if (!raw) formFilled = false;
      if (!formProblem && problem) formProblem = problem;
    }
    // 快捷按钮跟着输入框走：值相等就点亮，用户改完数字也能同步回来。
    if (quickField) {
      const control = fieldControls.find((item) => item.field.key === quickField.key);
      const current = control?.input.value.trim() ?? '';
      for (const item of pillButtons) {
        item.pill.classList.toggle('active', String(item.choice) === current);
      }
    }

    const problem = customInput
      ? validateClarificationInput(request.inputValidation, customInput.value)
      : '';
    validationHint.textContent = problem;
    validationHint.hidden = !problem;
    customInput?.classList.toggle('invalid', !!problem);
    customInput?.parentElement?.classList.toggle('invalid', !!problem);
    if (!enforceAnswer) {
      confirm.disabled = false;
      return;
    }
    if (formMode) {
      // 推荐卡和自定义二选一：选了卡就把自定义区收起来（见 setCustomCollapsed）。
      const pickedCard = optionInputs.some((input) => input.checked);
      confirm.disabled = !!formProblem || (!formFilled && !pickedCard);
      return;
    }
    const picked = optionInputs.some((input) => input.checked);
    const typed = (customInput?.value ?? '').trim().length > 0;
    // 填了自定义内容就必须合法,哪怕同时选了候选:后端优先用 customText,
    // 这里放过去的话,非法文本照样会覆盖掉合法选项。
    confirm.disabled = !!problem || (!picked && !typed);
  };
  for (const input of optionInputs) input.addEventListener('change', syncClarificationState);
  customInput?.addEventListener('input', syncClarificationState);
  syncClarificationState();
  requestAnimationFrame(() => {
    const first = fieldControls[0]?.input || optionInputs[0] || customInput || confirm;
    // 聚焦第一个字段会把可滚动面板带到中间/底部，用户一睁眼看到的就是表单下半截。
    // 阻止聚焦滚动，再把面板拉回顶部。
    first?.focus({ preventScroll: true });
    panel.scrollTop = 0;
  });
}

function markClarificationCard(requestId, response = {}) {
  if (!requestId) return;
  const state = clarificationRequests.get(requestId);
  if (state) {
    clarificationRequests.set(requestId, { ...state, resolved: true, response });
  }
  closeClarificationModal(requestId);
  const card = messagesEl.querySelector(`[data-clarification-id="${CSS.escape(requestId)}"]`);
  if (!card) return;
  const cancelled = response.cancelled === true;
  card.classList.add(cancelled ? 'cancelled' : 'resolved');
  const status = card.querySelector('.clarification-status');
  if (status) {
    status.textContent = cancelled ? '已取消' : '已回复';
    status.classList.add(cancelled ? 'cancelled' : 'resolved');
  }
  if (cancelled) return;
  // 这条会被叫两次:用户点提交时本地先标一次(立刻有反馈),
  // 后端 clarification.resolved 事件回来再标一次(以服务端为准)。
  // 所以复用已有那一行改写,不能每次新建 —— 否则答案会显示两遍。
  let summary = card.querySelector('.clarification-answer');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'clarification-answer';
    card.appendChild(summary);
  }
  const parts = [];
  if (response.selectedOptionId) parts.push(`选项：${response.selectedOptionId}`);
  if (response.customText) parts.push(`补充：${response.customText}`);
  if (response.fields) {
    const labels = new Map(
      (state?.request?.inputFields || []).map((field) => [field.key, field]),
    );
    for (const [key, value] of Object.entries(response.fields)) {
      const field = labels.get(key);
      parts.push(`${field?.label || key}：${value}${field?.unit || ''}`);
    }
  }
  summary.textContent = parts.length ? parts.join('；') : '已确认当前选项';
}

function finishClarificationCards(statusText = '已取消') {
  closeClarificationModal();
  for (const card of messagesEl.querySelectorAll('.clarification-card:not(.resolved):not(.cancelled)')) {
    card.classList.add('cancelled');
    const status = card.querySelector('.clarification-status');
    if (status) {
      status.textContent = statusText;
      status.classList.add('cancelled');
    }
  }
  clarificationRequests.clear();
}

// Agent output and tool lifecycle are rendered from the protocol event stream.
function handleProtocolEvent(event) {
  if (!event || typeof event !== 'object') return;
  const payload = event.payload || {};
  switch (event.type) {
    case 'agent.started':
      clearPreflightNote();
      addNote('agent-note', `Agent: ${payload.agentName || 'unknown'}`);
      break;
    case 'agent.updated':
      addNote('agent-note', `切换 Agent: ${payload.agentName || 'unknown'}`);
      break;
    case 'handoff.started':
      addNote('agent-note', `交接: ${payload.fromAgent || 'agent'} -> ${payload.toAgent || 'agent'}`);
      break;
    case 'handoff.completed':
      addNote('agent-note', `已完成交接: ${payload.toAgent || 'agent'}`);
      break;
    case 'text.delta': {
      const text = typeof payload.text === 'string' ? payload.text : '';
      if (agentBubble && text) {
        clearPreflightNote();
        if (pendingToolCount > 0) {
          pendingAgentText += text;
        } else {
          agentText += text;
          const visibleText = sanitizeAssistantText(agentText);
          if (hadToolThisTurn && visibleText) appendAgentBubbleToTimelineEnd();
          renderRich(agentBubble, visibleText);
        }
        scrollBottom();
      }
      break;
    }
    case 'tool.started': {
      const name = payload.toolName || 'tool';
      if (name === 'report_plan_progress') break;
      clearPreflightNote();
      if (agentBubble) {
        agentText = '';
        renderRich(agentBubble, '');
        agentBubble.classList.remove('streaming');
        detachAgentBubbleFromTimeline();
      }
      closeThinkingAtBoundary(event.runId || currentRunId);
      const run = rememberToolRun(name, payload);
      updateWorkflowStage(event.runId, name, 'running');
      run.startNote = appendToolLine(name, createToolLine(name, payload.arguments));
      hadToolThisTurn = true;
      pendingToolCount += 1;
      break;
    }
    case 'tool.completed': {
      const name = payload.toolName || 'tool';
      if (name === 'report_plan_progress') break;
      const summary = typeof payload.summary === 'string'
        ? payload.summary
        : JSON.stringify(payload.result ?? '');
      const run = takeToolRun(name, payload);
      const measuredDuration = run ? Date.now() - run.startedAt : undefined;
      const durationMs = typeof payload.durationMs === 'number'
        ? payload.durationMs
        : measuredDuration;
      if (isHistoricalArgumentGuardResult(summary, payload.result, payload.result)) {
        removeToolLine(run);
        updateWorkflowStage(event.runId, name, 'completed');
        pendingToolCount = Math.max(0, pendingToolCount - 1);
        flushPendingAgentText();
        closeThinkingAtBoundary(event.runId || currentRunId);
        break;
      }
      addToolResult(name, payload.ok === true, summary, payload.result, run, durationMs);
      if (payload.ok === true) {
        for (const action of toolActionsOf(payload.result)) pendingToolActions.push(action);
      }
      updateWorkflowStage(event.runId, name, payload.ok === true ? 'completed' : 'failed', payload.result);
      pendingToolCount = Math.max(0, pendingToolCount - 1);
      flushPendingAgentText();
      closeThinkingAtBoundary(event.runId || currentRunId);
      break;
    }
    case 'run.completed': {
      closeThinkingAtBoundary(event.runId || currentRunId);
      finishWorkflowView(event.runId, 'completed');
      const result = payload.result;
      if (result && typeof result === 'object') {
        const output = result.output;
        const message = output && typeof output === 'object' ? output.message : undefined;
        if (typeof message === 'string') {
          if (pendingToolCount > 0) pendingFinalText = message;
          else renderAgentText(message);
        }
        const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
        const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
        if (diagnostics.length) addNote('tool-note', `结构化结果包含 ${diagnostics.length} 条诊断信息`);
        if (artifacts.length) {
          const names = artifacts
            .map((artifact) => artifact && (artifact.name || artifact.uri))
            .filter(Boolean)
            .join('、');
          addNote('tool-note', `已生成 ${artifacts.length} 个产物${names ? `：${names}` : ''}`);
        }
      }
      break;
    }
    case 'run.failed':
      // The host error control message owns the detailed error bubble.
      closeThinkingAtBoundary(event.runId || currentRunId);
      finishWorkflowView(event.runId, 'failed');
      flushToolActions();
      break;
    case 'run.cancelled':
      // The host cancelled control message owns the retry state and controls.
      closeThinkingAtBoundary(event.runId || currentRunId);
      finishWorkflowView(event.runId, 'cancelled');
      flushToolActions();
      break;
    case 'approval.requested':
      closeThinkingAtBoundary(event.runId || currentRunId);
      if (payload.approvalId && payload.toolName) {
        addApprovalCard(event.runId || currentRunId, {
          id: payload.approvalId,
          name: payload.toolName,
          args: typeof payload.args === 'string' ? payload.args : '',
        });
      }
      break;
    case 'approval.resolved':
      markApprovalCard(
        payload.approvalId,
        payload.approved === true,
        payload.approved === true ? '已允许' : '已拒绝',
      );
      break;
    case 'clarification.requested':
      closeThinkingAtBoundary(event.runId || currentRunId);
      addClarificationRequest(event.runId || currentRunId, payload);
      break;
    case 'clarification.resolved':
      markClarificationCard(payload.requestId, payload);
      break;
    case 'usage.updated':
      break;
    case 'reasoning.updated':
      addThinkingUpdate(event);
      break;
    case 'run.started':
      // 动作去重只针对当前运行。上一轮留下的动作行仍保留在时间线里,
      // 但同一个动作在新一轮里也必须重新显示。
      flushToolActions();
      renderedToolActions.clear();
      toolRuns.clear();
      anonymousToolRuns.clear();
      resetThinkingTracking(event.runId || currentRunId);
      if (payload.workflow) createWorkflowStageView(event.runId, payload.workflow);
      break;
    case 'model.event':
      // Model lifecycle events are observational. They can arrive before a
      // provider's final reasoning summary, so they must not split or close
      // the visible Thinking segment.
      break;
    case 'run.progress':
      if (typeof payload.stage === 'string' && payload.stage.startsWith('context.compaction.')) {
        const status = payload.stage.endsWith('.started')
          ? 'started'
          : payload.stage.endsWith('.failed')
            ? 'failed'
            : 'completed';
        showContextCompactionState(
          payload.message || (status === 'started' ? '正在压缩上下文…' : '上下文压缩完成'),
          event.runId || currentRunId,
          status,
        );
        break;
      }
      if (payload.stage === 'diagnostics.report' && payload.report) {
        addDiagnosticReport(payload.report);
        break;
      }
      if (typeof payload.stage === 'string' && payload.stage.startsWith('plan.')) {
        if (payload.stage === 'plan.created' && payload.plan && Array.isArray(payload.plan.steps)) {
          addNote('tool-note', `已生成线性计划：${payload.plan.steps.length} 步`);
        } else if (payload.stage === 'plan.restored' && payload.plan && Array.isArray(payload.plan.steps)) {
          const current = payload.plan.currentStepId ? `，当前 ${payload.plan.currentStepId}` : '';
          addNote('tool-note', `已恢复线性计划（${payload.plan.steps.length} 步${current}）`);
        } else if (payload.stage === 'plan.step.verification_failed') {
          addNote('tool-note', `计划 ${payload.stepId || ''} 自检未通过，正在调整${payload.message ? `：${payload.message}` : ''}`);
        } else if (payload.stage === 'plan.step.started' || payload.stage === 'plan.step.completed') {
          const phase = payload.stage.endsWith('completed') ? '完成' : '开始';
          addNote('tool-note', `计划 ${payload.stepId || ''} ${phase}${payload.message ? `：${payload.message}` : ''}`);
        }
      }
      break;
    case 'context.compacted':
      showContextCompactionState('上下文压缩完成', event.runId || currentRunId, 'completed');
      break;
  }
}

// ---------- host 消息 ----------

let agentBubble = null;
let agentText = '';
let pendingAgentText = '';
let pendingFinalText = null;
let pendingToolCount = 0;
let hadToolThisTurn = false;

function renderAgentText(text) {
  agentText = sanitizeAssistantText(text);
  if (agentBubble) {
    // The streaming bubble is created immediately after the user message.
    // Once tools were involved, move the final answer below tool results.
    if (!agentText) {
      renderRich(agentBubble, '');
      agentBubble.classList.remove('streaming');
      detachAgentBubbleFromTimeline();
      agentBubble = null;
    } else {
      if (hadToolThisTurn) appendAgentBubbleToTimelineEnd();
      renderRich(agentBubble, agentText);
      agentBubble.classList.remove('streaming');
    }
  }
  flushToolActions();
}

function flushPendingAgentText() {
  if (pendingToolCount > 0) return;
  if (pendingFinalText !== null) {
    pendingAgentText = '';
    renderAgentText(pendingFinalText);
    pendingFinalText = null;
    return;
  }
  if (pendingAgentText) {
    renderAgentText(sanitizeAssistantText(agentText + pendingAgentText));
    pendingAgentText = '';
  }
}

function renderHistoryMessage(m) {
  if (m.role === 'user') {
    addMessage('user', m.text);
    return;
  }
  const text = sanitizeAssistantText(m.text);
  if (text.trim()) {
    const b = addMessage('agent', '');
    renderRich(b, text);
  }
  flushToolActions();
}

function replayHistoryEvents(events) {
  if (!Array.isArray(events) || !events.length) return;
  toolRuns.clear();
  anonymousToolRuns.clear();
  pendingToolCount = 0;
  pendingAgentText = '';
  pendingFinalText = null;
  for (const event of events) handleProtocolEvent(event);
  pendingToolCount = 0;
  pendingAgentText = '';
  pendingFinalText = null;
  toolRuns.clear();
  anonymousToolRuns.clear();
}

function groupHistoryEvents(events) {
  const groups = [];
  const byRun = new Map();
  const legacy = [];
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || typeof event !== 'object') continue;
    if (event.type === 'run.started') {
      const group = {
        runId: event.runId,
        userText: typeof event.payload?.userText === 'string' ? event.payload.userText : '',
        events: [],
      };
      groups.push(group);
      if (event.runId) byRun.set(event.runId, group);
      continue;
    }
    const group = event.runId ? byRun.get(event.runId) : undefined;
    if (group) group.events.push(event);
    else legacy.push(event);
  }
  return { groups, legacy };
}

function takeNextHistoryEventGroup(groups, userText, consumed) {
  const normalized = String(userText ?? '').trim();
  const index = groups.findIndex((group, i) =>
    !consumed.has(i) &&
    group.userText.trim() === normalized &&
    group.events.length > 0);
  if (index < 0) return undefined;
  consumed.add(index);
  return groups[index];
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'agentEvent') {
    handleProtocolEvent(msg.event);
    return;
  }
  switch (msg.type) {
    case 'copyTextResult':
      resolveCopyRequest(msg);
      break;
    case 'preflight':
      showPreflightStage(msg);
      setRuntimeMode('running');
      break;
    case 'user': {
      beginUserTurn(msg.text, msg.runId, true);
      if (msg.runId) acknowledgeRunStart();
      break;
    }
    case 'done': {
      clearPendingRunAck();
      pendingLocalUserText = null;
      clearPreflightNote();
      flushPendingAgentText();
      const waitingForToolResult = pendingToolCount > 0;
      const empty = !sanitizeAssistantText(agentText).trim() && !waitingForToolResult;
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (empty) detachAgentBubbleFromTimeline(); // 空气泡看起来像卡死,换成明确说明
      }
      if (empty) {
        addNote(
          'tool-note',
          hadToolThisTurn
            ? '模型本轮没有追加文字总结(见上方工具执行回执)。若经常如此,是网关在工具结果回喂后返回了空回复。'
            : '模型本轮没有返回文本(网关返回了空内容),可直接重试。',
        );
      }
      if (!waitingForToolResult) agentBubble = null;
      showUsage(msg.usage);
      canRetry = msg.canRetry === true;
      canContinue = false;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    }
    case 'error':
      clearPendingRunAck();
      pendingLocalUserText = null;
      clearPreflightNote();
      finishClarificationCards('已结束');
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) detachAgentBubbleFromTimeline();
      }
      agentBubble = null;
      addNote('error-note', msg.message);
      if (msg.canRetry === true) canRetry = true;
      if (msg.canContinue === true) {
        canContinue = true;
        addNote(
          'tool-note',
          msg.resumeStrategy === 'safe_restart'
            ? '这是可恢复错误；输入“继续”会从最近安全位置恢复'
            : '这是可恢复错误；输入“继续”会从 SDK 断点恢复',
        );
      }
      if (msg.canContinue === false) canContinue = false;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    case 'busy':
      currentRunId = msg.runId || currentRunId;
      if (msg.runId) acknowledgeRunStart();
      if (runtimeMode !== 'stopping') setRuntimeMode('running');
      break;
    case 'planning':
      // Planning is an internal routing step. Keep the run busy so stop/cancel
      // remains available, but do not expose implementation details to users.
      setRuntimeMode('running');
      break;
    case 'idle':
      if (runtimeMode !== 'awaiting') setRuntimeMode('idle');
      inputEl.focus();
      break;
    case 'cleared':
      clearPendingRunAck();
      clearPauseNotice();
      clearPreflightNote();
      clearContextCompactionNote();
      closeClarificationModal();
      clarificationRequests.clear();
      pendingLocalUserText = null;
      messagesEl.textContent = '';
      workflowViews.clear();
      workflowApprovals.clear();
      clearThinkingState();
      finalAnswerAnchors.clear();
      agentBubble = null;
      agentText = '';
      pendingAgentText = '';
      pendingFinalText = null;
      pendingToolCount = 0;
      hadToolThisTurn = false;
      pendingToolActions.length = 0;
      toolActionLines.clear();
      renderedToolActions.clear();
      currentRunId = null;
      canRetry = false;
      canContinue = false;
      setRuntimeMode('idle');
      showWelcomeHint();
      break;
    case 'sessions':
      activeSessionId = typeof msg.activeSessionId === 'string' ? msg.activeSessionId : activeSessionId;
      knownSessions = Array.isArray(msg.sessions) ? msg.sessions : [];
      renderSessions();
      break;
    case 'history': {
      // 面板重开:host 回放持久化历史
      clearPendingRunAck();
      clearPauseNotice();
      clearPreflightNote();
      clearContextCompactionNote();
      closeClarificationModal();
      clarificationRequests.clear();
      pendingLocalUserText = null;
      messagesEl.textContent = '';
      workflowViews.clear();
      workflowApprovals.clear();
      clearThinkingState();
      finalAnswerAnchors.clear();
      agentBubble = null;
      agentText = '';
      pendingAgentText = '';
      pendingFinalText = null;
      pendingToolCount = 0;
      hadToolThisTurn = false;
      pendingToolActions.length = 0;
      toolActionLines.clear();
      renderedToolActions.clear();
      const messages = msg.messages || [];
      const events = Array.isArray(msg.events) ? msg.events : [];
      const { groups, legacy } = groupHistoryEvents(events);
      const consumedGroups = new Set();
      let pendingGroup;
      const legacyInsertIndex = legacy.length
        ? messages.map((m) => m.role).lastIndexOf('agent')
        : -1;
      replayingHistory = true;
      for (let i = 0; i < messages.length; i += 1) {
        const message = messages[i];
        if (i === legacyInsertIndex) replayHistoryEvents(legacy);
        if (message.role === 'user') {
          if (pendingGroup) {
            replayHistoryEvents(pendingGroup.events);
            pendingGroup = undefined;
          }
          renderHistoryMessage(message);
          pendingGroup = takeNextHistoryEventGroup(groups, message.text, consumedGroups);
          continue;
        }
        if (pendingGroup) {
          replayHistoryEvents(pendingGroup.events);
          pendingGroup = undefined;
        }
        renderHistoryMessage(message);
      }
      if (pendingGroup) replayHistoryEvents(pendingGroup.events);
      if (legacyInsertIndex < 0) replayHistoryEvents(legacy);
      replayingHistory = false;
      agentBubble = null;
      agentText = '';
      pendingAgentText = '';
      pendingFinalText = null;
      pendingToolCount = 0;
      hadToolThisTurn = false;
      currentRunId = null;
      setRuntimeMode('idle');
      if (!messages.length && !events.length) showWelcomeHint();
      break;
    }
    case 'awaitingApproval':
      showApprovals(msg.runId, msg.approvals);
      break;
    case 'runRestored':
      addNote('tool-note', '已恢复上次未完成的审批，请决定后继续运行');
      showApprovals(msg.runId, msg.approvals);
      break;
    case 'runAttached': {
      clearPendingRunAck();
      clearPreflightNote();
      pendingLocalUserText = null;
      const userBubbles = messagesEl.querySelectorAll('.msg.user .bubble');
      const lastUser = userBubbles.length ? userBubbles[userBubbles.length - 1].textContent : '';
      if (lastUser !== msg.userText) addMessage('user', msg.userText);
      currentRunId = msg.runId;
      agentText = msg.partialOutput || '';
      pendingAgentText = '';
      pendingFinalText = null;
      pendingToolCount = 0;
      hadToolThisTurn = false;
      agentBubble = addMessage('agent', '');
      rememberFinalAnswerAnchor(currentRunId, agentBubble);
      renderRich(agentBubble, sanitizeAssistantText(agentText));
      agentBubble.classList.add('streaming');
      setRuntimeMode('running');
      break;
    }
    case 'resumeStarted':
      clearPauseNotice();
      clearPreflightNote();
      canContinue = false;
      currentRunId = msg.runId || currentRunId;
      if (typeof msg.displayText === 'string' && msg.displayText.trim()) {
        const text = msg.displayText.trim();
        const userBubbles = messagesEl.querySelectorAll('.msg.user .bubble');
        const lastUser = userBubbles.length ? userBubbles[userBubbles.length - 1].textContent : '';
        if (lastUser !== text) addMessage('user', text);
      } else if (msg.userText) {
        const userBubbles = messagesEl.querySelectorAll('.msg.user .bubble');
        const lastUser = userBubbles.length ? userBubbles[userBubbles.length - 1].textContent : '';
        if (lastUser !== msg.userText) addMessage('user', msg.userText);
      }
      if (!agentBubble) {
        agentText = '';
        agentBubble = addMessage('agent', '');
        agentBubble.classList.add('streaming');
      }
      rememberFinalAnswerAnchor(currentRunId, agentBubble);
      if (msg.runId) acknowledgeRunStart();
      else setRuntimeMode('running');
      break;
    case 'stopping':
      setRuntimeMode('stopping');
      break;
    case 'cancelled':
      clearPendingRunAck();
      pendingLocalUserText = null;
      clearPreflightNote();
      finishClarificationCards('已取消');
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) detachAgentBubbleFromTimeline();
      }
      agentBubble = null;
      finishApprovalCards('rejected', '已取消');
      addNote('tool-note', '本轮已停止，可以安全重试');
      canRetry = msg.canRetry === true;
      canContinue = false;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    case 'paused':
      clearPendingRunAck();
      pendingLocalUserText = null;
      clearPreflightNote();
      finishClarificationCards('已暂停');
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) detachAgentBubbleFromTimeline();
      }
      agentBubble = null;
      const budgetPauseMessage = typeof msg.message === 'string' && msg.message.trim()
        ? msg.message.trim()
        : '';
      showPauseNotice(
        budgetPauseMessage ||
          (msg.resumeStrategy === 'safe_restart'
            ? '本轮停止较早；输入“继续”会从最近安全位置恢复，也可以重试本轮'
            : '本轮已暂停，可以输入“继续”从断点恢复，或重试本轮'),
      );
      canRetry = msg.canRetry === true;
      canContinue = msg.canContinue === true;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    case 'refused':
      clearPendingRunAck();
      pendingLocalUserText = null;
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) detachAgentBubbleFromTimeline();
      }
      agentBubble = null;
      finishApprovalCards('rejected', '已拒绝');
      addNote('tool-note', msg.message || '本轮已拒绝执行，未产生副作用。');
      canRetry = msg.canRetry === true;
      canContinue = false;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    case 'runRecovered':
      clearPendingRunAck();
      pendingLocalUserText = null;
      addNote('error-note', msg.message);
      canRetry = msg.canRetry === true;
      canContinue = false;
      setRuntimeMode('idle');
      break;
    case 'retryState':
      canRetry = msg.canRetry === true;
      canContinue = msg.canContinue === true;
      setRuntimeMode(runtimeMode);
      break;
    case 'settings':
      if (msg.requestId !== undefined && msg.requestId !== settingsRequestId) break;
      hasSavedKey = !!msg.hasKey;
      setBaseEl.value = msg.baseUrl || '';
      setModelEl.value = msg.model || '';
      setFormatEl.value = msg.apiFormat || (msg.baseUrl ? 'chat_completions' : 'responses');
      updatePermissionMode(msg.permissionMode || 'ask');
      creatingVendor = false;
      currentVendorId = msg.vendorId || '';
      setVendorNameEl.value = msg.vendorName || '';
      renderVendorOptions(msg.vendors, setFormatEl.value, currentVendorId);
      setKeyEl.value = '';
      setKeyEl.placeholder = hasSavedKey ? '已保存,留空则不修改' : '必填';
      updateModelChip(msg.model, msg.vendorName);
      setShowThinking(msg.showThinking !== false);
      renderBuiltinTools(msg.builtinTools);
      renderMcpServers(msg.mcpServers, msg.mcpConfigPath, msg.mcpConfigWritable);
      if (msg.mcpError) showSaveStatus(msg.mcpError, 'error');
      break;
    case 'settingsError':
      settingsSavePending = false;
      showSaveStatus(msg.message || '保存失败', 'error');
      addNote('error-note', msg.message || '保存模型配置失败');
      break;
    case 'settingsSaved':
      if (!settingsSavePending) break;
      settingsSavePending = false;
      creatingVendor = false;
      currentVendorId = msg.vendorId || currentVendorId;
      if (msg.vendorName) setVendorNameEl.value = msg.vendorName;
      renderVendorOptions(
        msg.vendors || knownVendors,
        msg.apiFormat || setFormatEl.value,
        currentVendorId,
      );
      updateModelChip(msg.model, msg.vendorName);
      showSaveStatus(
        msg.vendorName || msg.model
          ? `已保存:${msg.vendorName || msg.model}`
          : '已保存',
        'ok',
      );
      addNote(
        'tool-note',
        msg.vendorName || msg.model
          ? `已保存模型配置:${msg.vendorName || msg.model}`
          : '已保存模型配置',
      );
      break;
    case 'permissionModeSaved':
      updatePermissionMode(msg.permissionMode || 'ask');
      break;
    case 'mcpConfigSaved':
      hideMcpForm();
      showSaveStatus(
        msg.deleted
          ? (msg.name ? `已删除 MCP:${msg.name}` : '已删除 MCP 配置')
          : (msg.name ? `已保存 MCP:${msg.name}` : '已保存 MCP 配置'),
        'ok',
      );
      break;
    case 'mcpStatus':
      applyMcpStatus(msg);
      break;
    case 'pluginCommandResult':
      markToolActionLine(msg.actionKey, msg.ok === true, msg.error);
      break;
  }
});

// 启动时拉一次配置让模型标签显示真实值;先给个欢迎提示,
// 随后 host 会随 'history' 消息回放持久化历史(有历史时欢迎提示被替换)
requestSettings();
showWelcomeHint();
