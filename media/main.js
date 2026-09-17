// WebView 脚本:只负责界面与消息转发,agent 逻辑与配置持久化在扩展进程(src/chatView.ts)
const vscode = acquireVsCodeApi();

const messagesEl = document.getElementById('messages');
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
let settingsRequestId = 0;
let settingsSavePending = false;
const toolRuns = new Map();
const anonymousToolRuns = new Map();

function setRuntimeMode(mode) {
  runtimeMode = mode;
  const running = mode === 'running' || mode === 'stopping';
  const awaiting = mode === 'awaiting';
  sendBtn.disabled = running || awaiting;
  stopBtn.classList.toggle('hidden', !(running || awaiting));
  stopBtn.disabled = mode === 'stopping';
  retryBtn.disabled = !canRetry || running || awaiting;
  continueBtn.disabled = !canContinue || running || awaiting;
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

function addNote(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollBottom();
  return el;
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

function formatToolResult(name, summary, result, run, durationMs) {
  const parsed = result && typeof result === 'object'
    ? result
    : parseJsonValue(summary);
  const args = parseJsonValue(run?.args);
  const duration = durationLabel(durationMs);
  const metaParts = [name, duration].filter(Boolean);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const text = typeof summary === 'string' ? summary.trim() : '';
    return {
      headline: text && !/^[\[{]/.test(text) ? text : '工具执行成功',
      summary: '',
      meta: metaParts.join(' · '),
      detail: '',
    };
  }
  if (parsed.ok === false) {
    return {
      headline: parsed.error ? `执行失败：${parsed.error}` : '执行失败',
      summary: toolArgsSummary(name, run?.args),
      meta: metaParts.join(' · '),
      detail: parsed,
    };
  }
  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
  if (name === 'read_file') {
    const path = args && typeof args.path === 'string' ? args.path : '文件';
    const lines = typeof data.totalLines === 'number' ? ` · ${data.totalLines} 行` : '';
    const content = typeof data.content === 'string' ? data.content : '';
    const bytes = content ? ` · ${byteLength(content)} 字节` : '';
    return {
      headline: `已读取 ${path}${lines}`,
      summary: content ? `结果摘要：${truncateText(content)}` : '',
      meta: [...metaParts, bytes.replace(/^ · /, '')].filter(Boolean).join(' · '),
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
  if (!ok) formatted.headline = formatted.headline.startsWith('执行失败')
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

// 极简 markdown:围栏代码块,其余按纯文本(成熟化时换 marked/highlight.js)
function renderRich(bubble, text) {
  bubble.textContent = '';
  const parts = String(text).split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const pre = document.createElement('pre');
      pre.textContent = part.replace(/^[a-zA-Z0-9+#-]*\n/, '');
      bubble.appendChild(pre);
    } else if (part) {
      bubble.appendChild(document.createTextNode(part));
    }
  });
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------- 发送 ----------

function send() {
  if (runtimeMode !== 'idle') return;
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  autoGrow();
  vscode.postMessage({ type: 'send', text });
}

sendBtn.addEventListener('click', send);
stopBtn.addEventListener('click', () => {
  if (runtimeMode !== 'running' && runtimeMode !== 'awaiting') return;
  setRuntimeMode('stopping');
  vscode.postMessage({ type: 'stop' });
});
retryBtn.addEventListener('click', () => {
  if (runtimeMode !== 'idle' || !canRetry) return;
  vscode.postMessage({ type: 'retry' });
});
continueBtn.addEventListener('click', () => {
  if (runtimeMode !== 'idle' || !canContinue) return;
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
newchatEl.addEventListener('click', () => vscode.postMessage({ type: 'clear' }));

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
    if (!agentText) agentBubble.remove();
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

// Agent output and tool lifecycle are rendered from the protocol event stream.
function handleProtocolEvent(event) {
  if (!event || typeof event !== 'object') return;
  const payload = event.payload || {};
  switch (event.type) {
    case 'agent.started':
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
        if (pendingToolCount > 0) {
          pendingAgentText += text;
        } else {
          agentText += text;
          if (hadToolThisTurn) messagesEl.appendChild(agentBubble);
          renderRich(agentBubble, agentText);
        }
        scrollBottom();
      }
      break;
    }
    case 'tool.started': {
      const name = payload.toolName || 'tool';
      if (name === 'report_plan_progress') break;
      rememberToolRun(name, payload);
      addNote('tool-note', startToolHeadline(name, payload.arguments));
      hadToolThisTurn = true;
      pendingToolCount += 1;
      if (agentText) {
        pendingAgentText = agentText + pendingAgentText;
        agentText = '';
        if (agentBubble) renderRich(agentBubble, '');
      }
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
      pendingToolCount = Math.max(0, pendingToolCount - 1);
      flushPendingAgentText();
      break;
    }
    case 'run.completed': {
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
      break;
    case 'run.cancelled':
      // The host cancelled control message owns the retry state and controls.
      break;
    case 'approval.requested':
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
    case 'usage.updated':
    case 'reasoning.updated':
      // Reasoning is not a user-facing execution fact. Show tool calls,
      // file/command targets and results instead.
      break;
    case 'run.started':
      toolRuns.clear();
      anonymousToolRuns.clear();
      break;
    case 'run.progress':
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
  agentText = text;
  if (agentBubble) {
    // The streaming bubble is created immediately after the user message.
    // Once tools were involved, move the final answer below tool results.
    if (hadToolThisTurn) messagesEl.appendChild(agentBubble);
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
    renderAgentText(agentText + pendingAgentText);
    pendingAgentText = '';
  }
}

function renderHistoryMessage(m) {
  if (m.role === 'user') {
    addMessage('user', m.text);
    return;
  }
  const b = addMessage('agent', '');
  renderRich(b, m.text);
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

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'agentEvent') {
    handleProtocolEvent(msg.event);
    return;
  }
  switch (msg.type) {
    case 'user': {
      const hint = messagesEl.querySelector('.hint');
      if (hint) hint.remove();
      addMessage('user', msg.text);
      currentRunId = msg.runId || null;
      agentText = '';
      pendingAgentText = '';
      pendingFinalText = null;
      pendingToolCount = 0;
      hadToolThisTurn = false;
      canContinue = false;
      agentBubble = addMessage('agent', '');
      agentBubble.classList.add('streaming');
      break;
    }
    case 'done': {
      flushPendingAgentText();
      const waitingForToolResult = pendingToolCount > 0;
      const empty = !agentText && !waitingForToolResult;
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (empty) agentBubble.remove(); // 空气泡看起来像卡死,换成明确说明
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
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) agentBubble.remove();
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
      setRuntimeMode('running');
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
      messagesEl.textContent = '';
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
    case 'history': {
      // 面板重开:host 回放持久化历史
      messagesEl.textContent = '';
      agentBubble = null;
      agentText = '';
      pendingAgentText = '';
      pendingFinalText = null;
      pendingToolCount = 0;
      hadToolThisTurn = false;
      const messages = msg.messages || [];
      const events = Array.isArray(msg.events) ? msg.events : [];
      const eventInsertIndex = events.length
        ? messages.map((m) => m.role).lastIndexOf('agent')
        : -1;
      for (let i = 0; i < messages.length; i += 1) {
        if (i === eventInsertIndex) replayHistoryEvents(events);
        renderHistoryMessage(messages[i]);
      }
      if (eventInsertIndex < 0) replayHistoryEvents(events);
      agentBubble = null;
      agentText = '';
      pendingAgentText = '';
      pendingFinalText = null;
      pendingToolCount = 0;
      hadToolThisTurn = false;
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
      renderRich(agentBubble, agentText);
      agentBubble.classList.add('streaming');
      setRuntimeMode('running');
      break;
    }
    case 'resumeStarted':
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
      setRuntimeMode('running');
      break;
    case 'stopping':
      setRuntimeMode('stopping');
      break;
    case 'cancelled':
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) agentBubble.remove();
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
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) agentBubble.remove();
      }
      agentBubble = null;
      addNote(
        'tool-note',
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
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) agentBubble.remove();
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
