// WebView 脚本:只负责界面与消息转发,agent 逻辑与配置持久化在扩展进程(src/chatView.ts)
const vscode = acquireVsCodeApi();

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const gearBtn = document.getElementById('gear');
const modelChip = document.getElementById('model-chip');
const settingsEl = document.getElementById('settings');
const setBaseEl = document.getElementById('set-base');
const setKeyEl = document.getElementById('set-key');
const setModelEl = document.getElementById('set-model');
const setSaveEl = document.getElementById('set-save');
const setCancelEl = document.getElementById('set-cancel');

let hasSavedKey = false;

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
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  autoGrow();
  vscode.postMessage({ type: 'send', text });
}

sendBtn.addEventListener('click', send);
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

// ---------- host 消息 ----------

let agentBubble = null;
let agentText = '';

window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'user':
      addMessage('user', msg.text);
      agentText = '';
      agentBubble = addMessage('agent', '');
      agentBubble.classList.add('streaming');
      break;
    case 'delta':
      if (agentBubble) {
        agentText += msg.text;
        renderRich(agentBubble, agentText);
        scrollBottom();
      }
      break;
    case 'tool':
      addNote('tool-note', `调用工具 ${msg.name}`);
      break;
    case 'done':
      if (agentBubble) agentBubble.classList.remove('streaming');
      agentBubble = null;
      showUsage(msg.usage);
      break;
    case 'error':
      if (agentBubble) {
        agentBubble.classList.remove('streaming');
        if (!agentText) agentBubble.textContent = '(无输出)';
      }
      agentBubble = null;
      addNote('error-note', msg.message);
      break;
    case 'busy':
      sendBtn.disabled = true;
      break;
    case 'idle':
      sendBtn.disabled = false;
      inputEl.focus();
      break;
    case 'cleared':
      messagesEl.textContent = '';
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

// 启动时拉一次配置,让模型标签显示真实值
vscode.postMessage({ type: 'getSettings' });

// 初始欢迎提示
if (!messagesEl.childElementCount) {
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = '试试:"写一个电机星三角启动的 ST 程序,延时 5 秒切换"';
  messagesEl.appendChild(hint);
}
