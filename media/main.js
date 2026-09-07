// WebView 脚本:只负责界面与消息转发,agent 逻辑在扩展进程(src/agent.ts)
const vscode = acquireVsCodeApi();

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

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
  }
});

// 初始欢迎提示
if (!messagesEl.childElementCount) {
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = '试试:"写一个电机星三角启动的 ST 程序,延时 5 秒切换"';
  messagesEl.appendChild(hint);
}
