/**
 * JSON 文件版会话持久化,实现 @openai/agents 的 Session 接口。
 *
 * 为什么不用官方 @openai/agents-sqlite:它依赖 better-sqlite3 原生模块,
 * VSCode 插件分发要按平台重新编译,代价不值;对话规模用 JSON 文件足够,
 * 以后真要大数据量再换后端,接口不变。
 *
 * 落盘位置:扩展 globalStorage 目录/session.json —— 跨窗口、跨重启有效,
 * 卸载插件时 VSCode 会一并清理。
 */
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentInputItem, Session } from '@openai/agents';

export class JsonFileSession implements Session {
  private items: AgentInputItem[] = [];
  private sessionId = '';
  private loaded = false;
  private saveChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as {
        sessionId?: string;
        items?: unknown;
      };
      this.sessionId = data.sessionId ?? randomUUID();
      this.items = Array.isArray(data.items) ? (data.items as AgentInputItem[]) : [];
    } catch {
      // 文件不存在/损坏:当作新会话
      this.sessionId = randomUUID();
      this.items = [];
    }
    this.loaded = true;
  }

  /** 串行化写入,避免连续 addItems 并发写同一文件 */
  private persist(): Promise<void> {
    this.saveChain = this.saveChain.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify({ sessionId: this.sessionId, items: this.items }), 'utf8');
    });
    return this.saveChain;
  }

  async getSessionId(): Promise<string> {
    await this.ensureLoaded();
    return this.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    await this.ensureLoaded();
    return limit === undefined ? [...this.items] : this.items.slice(-limit);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    await this.ensureLoaded();
    this.items.push(...items);
    await this.persist();
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    await this.ensureLoaded();
    const last = this.items.pop();
    await this.persist();
    return last;
  }

  async clearSession(): Promise<void> {
    this.items = [];
    this.sessionId = randomUUID();
    this.loaded = true;
    await this.persist();
  }
}

/** 从会话条目里抽取可展示的 user/assistant 文本(用于面板重开时回放历史) */
export function extractChatMessages(items: AgentInputItem[]): { role: 'user' | 'agent'; text: string }[] {
  const out: { role: 'user' | 'agent'; text: string }[] = [];
  for (const item of items) {
    const it = item as { type?: string; role?: string; content?: unknown };
    if (it.type !== 'message' || (it.role !== 'user' && it.role !== 'assistant')) continue;
    let text = '';
    if (typeof it.content === 'string') {
      text = it.content;
    } else if (Array.isArray(it.content)) {
      text = it.content
        .map((p) => (typeof p === 'string' ? p : (p as { text?: string })?.text ?? ''))
        .join('');
    }
    if (text.trim()) out.push({ role: it.role === 'user' ? 'user' : 'agent', text });
  }
  return out;
}
