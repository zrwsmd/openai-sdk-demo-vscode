// WebView 脚本:只负责界面与消息转发,agent 逻辑与配置持久化在扩展进程(src/chatView.ts)
const vscode = acquireVsCodeApi();

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const stopBtn = document.getElementById('stop');
const retryBtn = document.getElementById('retry');
const gearBtn = document.getElementById('gear');
const modelChip = document.getElementById('model-chip');
const settingsEl = document.getElementById('settings');
const setBaseEl = document.getElementById('set-base');
const setKeyEl = document.getElementById('set-key');
const setModelEl = document.getElementById('set-model');
const setSaveEl = document.getElementById('set-save');
const setCancelEl = document.getElementById('set-cancel');

let hasSavedKey = false;
let runtimeMode = 'idle';
let currentRunId = null;
let canRetry = false;

function setRuntimeMode(mode) {
  runtimeMode = mode;
  const running = mode === 'running' || mode === 'stopping';
  const awaiting = mode === 'awaiting';
  sendBtn.disabled = running || awaiting;
  stopBtn.classList.toggle('hidden', !(running || awaiting));
  stopBtn.disabled = mode === 'stopping';
  retryBtn.disabled = !canRetry || running || awaiting;
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

// 本轮 token 用量(部分网关流式响应不带 usage 字段,拿不到就不显示)
function showUsage(usage) {
  if (!usage) return;
  const total = (usage.inputTokens || 0) + (usage.outputTokens || 0);
  if (!total) return;
  addNote(
    'usage-note',
    `📊 本轮 tokens:输入 ${usage.inputTokens} / 输出 ${usage.outputTokens},模型调用 ${usage.requests} 次`,
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
  vscode.postMessage({ type: 'getSettings' }); // host 回 'settings' 时填充表单
  settingsEl.classList.remove('hidden');
  setBaseEl.focus();
}

function closeSettings() {
  settingsEl.classList.add('hidden');
  inputEl.focus();
}

gearBtn.addEventListener('click', openSettings);
modelChip.addEventListener('click', openSettings);
setCancelEl.addEventListener('click', closeSettings);
settingsEl.addEventListener('click', (e) => {
  if (e.target === settingsEl) closeSettings(); // 点遮罩关闭
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsEl.classList.contains('hidden')) closeSettings();
});

setSaveEl.addEventListener('click', () => {
  vscode.postMessage({
    type: 'saveSettings',
    baseUrl: setBaseEl.value,
    apiKey: setKeyEl.value, // 留空 = 不修改已保存的 key
    model: setModelEl.value,
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
  title.textContent = `⚠ Agent 请求执行工具:${name}`;
  card.appendChild(title);

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
  okBtn.textContent = '允许';
  const noBtn = document.createElement('button');
  noBtn.className = 'btn';
  noBtn.textContent = '拒绝';
  const finish = (approve) => {
    okBtn.disabled = noBtn.disabled = true;
    card.classList.add(approve ? 'approved' : 'rejected');
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

function showApprovals(runId, approvals) {
  if (agentBubble) {
    agentBubble.classList.remove('streaming');
    if (!agentText) agentBubble.remove();
    agentBubble = null;
  }
  currentRunId = runId;
  for (const approval of approvals || []) addApprovalCard(runId, approval);
  setRuntimeMode('awaiting');
}

function finishApprovalCards(className) {
  for (const card of messagesEl.querySelectorAll('.approval-card:not(.approved):not(.rejected)')) {
    card.classList.add(className);
    for (const button of card.querySelectorAll('button')) button.disabled = true;
  }
}

// ---------- host 消息 ----------

let agentBubble = null;
let agentText = '';
let hadToolThisTurn = false;

window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'user': {
      const hint = messagesEl.querySelector('.hint');
      if (hint) hint.remove();
      addMessage('user', msg.text);
      currentRunId = msg.runId || null;
      agentText = '';
      hadToolThisTurn = false;
      agentBubble = addMessage('agent', '');
      agentBubble.classList.add('streaming');
      break;
    }
    case 'delta':
      if (agentBubble) {
        agentText += msg.text;
        renderRich(agentBubble, agentText);
        scrollBottom();
      }
      break;
    case 'tool':
      addNote('tool-note', `调用工具 ${msg.name}`);
      hadToolThisTurn = true;
      break;
    case 'toolResult':
      // 工具执行回执:即使网关在工具后返回空文本,用户也能看到成败
      addNote(
        msg.ok ? 'tool-note ok-note' : 'error-note',
        `${msg.ok ? '✓' : '✗'} ${msg.name}: ${msg.summary}`,
      );
      break;
    case 'done': {
      const empty = !agentText;
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
      agentBubble = null;
      showUsage(msg.usage);
      canRetry = msg.canRetry === true;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    }
    case 'error':
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) agentBubble.textContent = '(无输出)';
      }
      agentBubble = null;
      addNote('error-note', msg.message);
      if (msg.canRetry === true) canRetry = true;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    case 'busy':
      currentRunId = msg.runId || currentRunId;
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
      currentRunId = null;
      canRetry = false;
      setRuntimeMode('idle');
      showWelcomeHint();
      break;
    case 'history': {
      // 面板重开:host 回放持久化历史
      messagesEl.textContent = '';
      agentBubble = null;
      agentText = '';
      for (const m of msg.messages || []) {
        if (m.role === 'user') addMessage('user', m.text);
        else {
          const b = addMessage('agent', '');
          renderRich(b, m.text);
        }
      }
      if (!(msg.messages || []).length) showWelcomeHint();
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
      hadToolThisTurn = false;
      agentBubble = addMessage('agent', '');
      renderRich(agentBubble, agentText);
      agentBubble.classList.add('streaming');
      setRuntimeMode('running');
      break;
    }
    case 'resumeStarted':
      if (!agentBubble) {
        agentText = '';
        hadToolThisTurn = false;
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
      finishApprovalCards('rejected');
      addNote('tool-note', '本轮已停止，可以安全重试');
      canRetry = msg.canRetry === true;
      currentRunId = null;
      setRuntimeMode('idle');
      break;
    case 'runRecovered':
      addNote('error-note', msg.message);
      canRetry = msg.canRetry === true;
      setRuntimeMode('idle');
      break;
    case 'retryState':
      canRetry = msg.canRetry === true;
      setRuntimeMode(runtimeMode);
      break;
    case 'settings':
      hasSavedKey = !!msg.hasKey;
      setBaseEl.value = msg.baseUrl || '';
      setModelEl.value = msg.model || '';
      setKeyEl.value = '';
      setKeyEl.placeholder = hasSavedKey ? '已保存,留空则不修改' : '必填';
      updateModelChip(msg.model);
      break;
    case 'settingsSaved':
      closeSettings();
      updateModelChip(msg.model);
      addNote('tool-note', msg.model ? `已保存模型配置:${msg.model}` : '已保存模型配置');
      break;
  }
});

// 启动时拉一次配置让模型标签显示真实值;先给个欢迎提示,
// 随后 host 会随 'history' 消息回放持久化历史(有历史时欢迎提示被替换)
vscode.postMessage({ type: 'getSettings' });
showWelcomeHint();
