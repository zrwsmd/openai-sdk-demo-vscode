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
const modelChip = document.getElementById('model-chip');
const settingsEl = document.getElementById('settings');
const setBaseEl = document.getElementById('set-base');
const setKeyEl = document.getElementById('set-key');
const setModelEl = document.getElementById('set-model');
const setProviderEl = document.getElementById('set-provider');
const setFormatEl = document.getElementById('set-format');
const setSaveEl = document.getElementById('set-save');
const setCancelEl = document.getElementById('set-cancel');

let hasSavedKey = false;
let runtimeMode = 'idle';
let currentRunId = null;
let canRetry = false;
let canContinue = false;
let pauseNoticeEl = null;
let preflightNoteEl = null;
let settingsRequestId = 0;
let settingsSavePending = false;
let pendingLocalUserText = null;
let awaitingRunAck = false;
let stopRequestedBeforeRunAck = false;
let activeSessionId = null;
let showThinking = true;
let knownSessions = [];
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

function startToolHeadline(name, args) {
  const target = toolArgsSummary(name, args);
  if (name === 'read_file') return `正在读取${target ? ` · ${target.replace(/^文件 /, '')}` : '文件'}`;
  if (name === 'write_file') return `正在写入${target ? ` · ${target.replace(/^文件 /, '')}` : '文件'}`;
  if (name === 'list_files') return `正在列出${target ? ` · ${target.replace(/^目录 /, '')}` : '文件'}`;
  if (name === 'search_files') return `正在搜索${target ? ` · ${target.replace(/^搜索：/, '')}` : '文件'}`;
  if (name === 'run_command') return `正在运行${target ? ` · ${target.replace(/^命令：/, '')}` : '命令'}`;
  if (name === 'export_st_program') return '正在导出 ST 程序';
  return `正在执行 · ${name}`;
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

function formatToolResult(name, summary, result, run, durationMs) {
  const parsed = result && typeof result === 'object'
    ? result
    : parseJsonValue(summary);
  const args = parseJsonValue(run?.args);
  const duration = durationLabel(durationMs);
  const metaParts = [name, duration].filter(Boolean);
  const meta = metaParts.join(' · ');
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

function addToolResult(name, ok, summary, result, run, durationMs) {
  const note = document.createElement('div');
  note.className = `tool-result ${ok ? 'success' : 'failure'}`;
  const icon = document.createElement('span');
  icon.className = 'tool-result-icon';
  icon.textContent = ok ? '✓' : '!';
  const body = document.createElement('div');
  body.className = 'tool-result-body';
  const formatted = formatToolResult(name, summary, result, run, durationMs);
  if (!ok && !formatted.suppressFailurePrefix) formatted.headline = formatted.headline.startsWith('执行失败')
    ? formatted.headline
    : `执行失败：${formatted.headline}`;
  const title = document.createElement('div');
  title.className = 'tool-result-title';
  title.textContent = formatted.headline;
  body.appendChild(title);
  if (formatted.summary) {
    const summaryEl = document.createElement('div');
    summaryEl.className = 'tool-result-summary';
    summaryEl.textContent = formatted.summary;
    body.appendChild(summaryEl);
  }
  const meta = document.createElement('div');
  meta.className = 'tool-result-meta';
  meta.textContent = formatted.meta || name;
  body.appendChild(meta);
  if (formatted.diff) {
    const diffDetails = document.createElement('details');
    diffDetails.className = 'tool-diff-details';
    diffDetails.open = true;
    const diffSummary = document.createElement('summary');
    diffSummary.textContent = '查看 Diff';
    const diffPre = document.createElement('pre');
    diffPre.className = 'tool-diff';
    for (const line of String(formatted.diff).split('\n')) {
      const lineEl = document.createElement('span');
      lineEl.className = line.startsWith('+') && !line.startsWith('+++')
        ? 'diff-add'
        : line.startsWith('-') && !line.startsWith('---')
          ? 'diff-remove'
          : line.startsWith('@@')
            ? 'diff-hunk'
            : line.startsWith('---') || line.startsWith('+++')
              ? 'diff-header'
              : '';
      lineEl.textContent = line;
      diffPre.appendChild(lineEl);
      diffPre.appendChild(document.createTextNode('\n'));
    }
    diffDetails.append(diffSummary, diffPre);
    body.appendChild(diffDetails);
  }
  if (formatted.detail) {
    const details = document.createElement('details');
    const summaryEl = document.createElement('summary');
    summaryEl.textContent = '查看执行详情';
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(formatted.detail, null, 2);
    details.append(summaryEl, pre);
    body.appendChild(details);
  }
  note.append(icon, body);
  messagesEl.appendChild(note);
  scrollBottom();
  return note;
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

// 本轮 token 用量(部分网关流式响应不带 usage 字段,拿不到就不显示)
function showUsage(usage) {
  if (!usage) return;
  const total = (usage.inputTokens || 0) + (usage.outputTokens || 0);
  if (!total) return;
  addNote(
    'usage-note',
    `用量 · 输入 ${usage.inputTokens} / 输出 ${usage.outputTokens} · 模型调用 ${usage.requests} 次`,
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

function copyTextToClipboard(text) {
  const value = String(text ?? '');
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  } finally {
    textarea.remove();
  }
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

function openSettings() {
  settingsEl.classList.remove('hidden');
  settingsSavePending = false;
  requestSettings();
  setBaseEl.focus();
}

function requestSettings(provider, apiFormat) {
  const requestId = ++settingsRequestId;
  const message = { type: 'getSettings', requestId };
  if (provider) message.provider = provider;
  if (apiFormat) message.apiFormat = apiFormat;
  vscode.postMessage(message);
}

function closeSettings() {
  settingsSavePending = false;
  settingsEl.classList.add('hidden');
  inputEl.focus();
}

gearBtn.addEventListener('click', openSettings);
modelChip.addEventListener('click', openSettings);
setCancelEl.addEventListener('click', closeSettings);
settingsEl.addEventListener('click', (e) => {
  if (e.target === settingsEl) closeSettings(); // 点遮罩关闭
});
function syncFormatOptions(provider) {
  const anthropic = provider === 'anthropic';
  for (const option of setFormatEl.options) {
    option.disabled = anthropic
      ? option.value !== 'messages'
      : option.value === 'messages';
  }
}
setProviderEl.addEventListener('change', () => {
  if (setProviderEl.value === 'anthropic') {
    setFormatEl.value = 'messages';
  } else if (setFormatEl.value === 'messages') {
    setFormatEl.value = 'chat_completions';
  }
  syncFormatOptions(setProviderEl.value);
  requestSettings(setProviderEl.value, setFormatEl.value);
});
setFormatEl.addEventListener('change', () => {
  requestSettings(setProviderEl.value, setFormatEl.value);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsEl.classList.contains('hidden')) closeSettings();
});

setSaveEl.addEventListener('click', () => {
  settingsSavePending = true;
  vscode.postMessage({
    type: 'saveSettings',
    baseUrl: setBaseEl.value,
    apiKey: setKeyEl.value, // 留空 = 不修改已保存的 key
    model: setModelEl.value,
    provider: setProviderEl.value,
    apiFormat: setFormatEl.value,
  });
});

function updateModelChip(model) {
  modelChip.textContent = model || '未配置';
}

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
  const status = document.createElement('span');
  status.className = 'clarification-status';
  status.textContent = '等待回复';
  title.append(titleText, status);
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

function showClarificationModal(runId, request) {
  const requestId = request?.requestId;
  if (!requestId || document.querySelector(`.clarification-modal[data-clarification-id="${CSS.escape(requestId)}"]`)) {
    return;
  }
  const options = normalizedClarificationOptions(request);
  const overlay = document.createElement('div');
  overlay.className = 'clarification-modal';
  overlay.dataset.clarificationId = requestId;

  const panel = document.createElement('div');
  panel.className = 'clarification-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const title = document.createElement('div');
  title.className = 'clarification-modal-title';
  title.textContent = request.title || '需要补充信息';
  panel.appendChild(title);

  const question = document.createElement('div');
  question.className = 'clarification-modal-question';
  question.textContent = request.question || '请补充必要信息。';
  panel.appendChild(question);

  if (request.details) {
    const details = document.createElement('div');
    details.className = 'clarification-modal-details';
    details.textContent = request.details;
    panel.appendChild(details);
  }

  const optionInputs = [];
  if (options.length) {
    const group = document.createElement('div');
    group.className = 'clarification-option-list';
    for (const option of options) {
      const label = document.createElement('label');
      label.className = 'clarification-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `clarification-${requestId}`;
      input.value = option.id;
      input.dataset.value = option.value ?? '';
      optionInputs.push(input);
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
      label.append(input, text);
      group.appendChild(label);
    }
    panel.appendChild(group);
  }

  let customInput = null;
  if (request.allowCustom !== false) {
    customInput = document.createElement('textarea');
    customInput.className = 'clarification-custom';
    customInput.rows = 3;
    customInput.placeholder = request.customPlaceholder || '填写自定义答案';
    panel.appendChild(customInput);
  }

  const actions = document.createElement('div');
  actions.className = 'clarification-actions';
  const cancel = document.createElement('button');
  cancel.className = 'btn';
  cancel.textContent = '取消';
  const confirm = document.createElement('button');
  confirm.className = 'btn primary';
  confirm.textContent = '确认';
  actions.append(cancel, confirm);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const sendResponse = (cancelled) => {
    const selected = optionInputs.find((input) => input.checked);
    const customText = customInput?.value?.trim() || '';
    const selectedOptionId = selected?.value || undefined;
    const selectedValue = selected?.dataset.value || undefined;
    markClarificationCard(requestId, {
      cancelled,
      selectedOptionId,
      customText,
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
    });
    if (!cancelled) setRuntimeMode('running');
  };

  cancel.addEventListener('click', () => sendResponse(true));
  confirm.addEventListener('click', () => sendResponse(false));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && request.required === false) sendResponse(true);
  });
  requestAnimationFrame(() => {
    const first = optionInputs[0] || customInput || confirm;
    first?.focus();
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
  if (!cancelled) {
    const summary = document.createElement('div');
    summary.className = 'clarification-answer';
    const parts = [];
    if (response.selectedOptionId) parts.push(`选项：${response.selectedOptionId}`);
    if (response.customText) parts.push(`补充：${response.customText}`);
    summary.textContent = parts.length ? parts.join('；') : '已确认当前选项';
    card.appendChild(summary);
  }
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
      rememberToolRun(name, payload);
      updateWorkflowStage(event.runId, name, 'running');
      addNote('tool-note', startToolHeadline(name, payload.arguments));
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
      addToolResult(name, payload.ok === true, summary, payload.result, run, durationMs);
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
      break;
    case 'run.cancelled':
      // The host cancelled control message owns the retry state and controls.
      closeThinkingAtBoundary(event.runId || currentRunId);
      finishWorkflowView(event.runId, 'cancelled');
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
      return;
    }
    if (hadToolThisTurn) appendAgentBubbleToTimelineEnd();
    renderRich(agentBubble, agentText);
    agentBubble.classList.remove('streaming');
  }
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
  if (!text.trim()) return;
  const b = addMessage('agent', '');
  renderRich(b, text);
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
      showPauseNotice(
        msg.resumeStrategy === 'safe_restart'
          ? '本轮停止较早；输入“继续”会从最近安全位置恢复，也可以重试本轮'
          : '本轮已暂停，可以输入“继续”从断点恢复，或重试本轮',
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
      setProviderEl.value = msg.provider || (msg.apiFormat === 'messages' ? 'anthropic' : 'openai');
      setFormatEl.value = msg.apiFormat || (msg.baseUrl ? 'chat_completions' : 'responses');
      syncFormatOptions(setProviderEl.value);
      setKeyEl.value = '';
      setKeyEl.placeholder = hasSavedKey ? '已保存,留空则不修改' : '必填';
      updateModelChip(msg.model);
      setShowThinking(msg.showThinking !== false);
      break;
    case 'settingsError':
      settingsSavePending = false;
      addNote('error-note', msg.message || '保存模型配置失败');
      break;
    case 'settingsSaved':
      if (!settingsSavePending) break;
      settingsSavePending = false;
      closeSettings();
      updateModelChip(msg.model);
      addNote('tool-note', msg.model ? `已保存模型配置:${msg.model}` : '已保存模型配置');
      break;
  }
});

// 启动时拉一次配置让模型标签显示真实值;先给个欢迎提示,
// 随后 host 会随 'history' 消息回放持久化历史(有历史时欢迎提示被替换)
requestSettings();
showWelcomeHint();
