import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatSessionIndex {
  schemaVersion: 1;
  activeSessionId: string;
  sessions: ChatSessionSummary[];
}

export interface ChatSessionPaths {
  dir: string;
  sessionFile: string;
  runStoreFile: string;
  auditFile: string;
  exportDir: string;
}

const INDEX_FILE = 'index.json';
const SESSIONS_DIR = 'sessions';
const DEFAULT_TITLE = '新会话';

export class ChatSessionCatalog {
  private initialized = false;

  constructor(private readonly storageRoot: string) {}

  async initialize(): Promise<ChatSessionIndex> {
    if (this.initialized) return this.readIndex();
    await fs.mkdir(this.sessionsRoot(), { recursive: true });
    try {
      const index = await this.readIndex();
      this.initialized = true;
      return index;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const migrated = await this.createInitialIndex();
    this.initialized = true;
    return migrated;
  }

  async list(): Promise<ChatSessionIndex> {
    return this.initialize();
  }

  async create(title = DEFAULT_TITLE): Promise<ChatSessionSummary> {
    const index = await this.initialize();
    const now = new Date().toISOString();
    const session: ChatSessionSummary = {
      id: randomUUID(),
      title: normalizeTitle(title),
      createdAt: now,
      updatedAt: now,
    };
    await fs.mkdir(this.pathsFor(session.id).dir, { recursive: true });
    index.sessions.unshift(session);
    index.activeSessionId = session.id;
    await this.writeIndex(index);
    return session;
  }

  async setActive(sessionId: string): Promise<ChatSessionSummary> {
    const index = await this.initialize();
    const session = index.sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error(`会话不存在: ${sessionId}`);
    index.activeSessionId = session.id;
    await this.writeIndex(index);
    return session;
  }

  async touch(sessionId: string, titleHint?: string): Promise<void> {
    const index = await this.initialize();
    const session = index.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    session.updatedAt = new Date().toISOString();
    const title = normalizeTitle(titleHint ?? '');
    if (title && (session.title === DEFAULT_TITLE || !session.title.trim())) {
      session.title = title;
    }
    index.sessions = sortSessions(index.sessions);
    await this.writeIndex(index);
  }

  pathsFor(sessionId: string): ChatSessionPaths {
    const dir = path.join(this.sessionsRoot(), sessionId);
    return {
      dir,
      sessionFile: path.join(dir, 'session.json'),
      runStoreFile: path.join(dir, 'runs.json'),
      auditFile: path.join(dir, 'audit.json'),
      exportDir: path.join(dir, 'exports'),
    };
  }

  private sessionsRoot(): string {
    return path.join(this.storageRoot, SESSIONS_DIR);
  }

  private indexPath(): string {
    return path.join(this.sessionsRoot(), INDEX_FILE);
  }

  private async readIndex(): Promise<ChatSessionIndex> {
    const parsed = JSON.parse(await fs.readFile(this.indexPath(), 'utf8')) as Partial<ChatSessionIndex>;
    if (!parsed || parsed.schemaVersion !== 1 || typeof parsed.activeSessionId !== 'string' || !Array.isArray(parsed.sessions)) {
      throw new Error('invalid chat session index');
    }
    const sessions = parsed.sessions.map(parseSessionSummary);
    const activeSessionId = sessions.some((session) => session.id === parsed.activeSessionId)
      ? parsed.activeSessionId
      : sessions[0]?.id;
    if (!activeSessionId) throw new Error('empty chat session index');
    return {
      schemaVersion: 1,
      activeSessionId,
      sessions: sortSessions(sessions),
    };
  }

  private async writeIndex(index: ChatSessionIndex): Promise<void> {
    const normalized: ChatSessionIndex = {
      schemaVersion: 1,
      activeSessionId: index.activeSessionId,
      sessions: sortSessions(index.sessions),
    };
    await fs.mkdir(this.sessionsRoot(), { recursive: true });
    const target = this.indexPath();
    const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(normalized), 'utf8');
    await fs.rename(temp, target);
  }

  private async createInitialIndex(): Promise<ChatSessionIndex> {
    const now = new Date().toISOString();
    const first: ChatSessionSummary = {
      id: randomUUID(),
      title: await legacyTitle(this.storageRoot) ?? DEFAULT_TITLE,
      createdAt: now,
      updatedAt: now,
    };
    const paths = this.pathsFor(first.id);
    await fs.mkdir(paths.dir, { recursive: true });
    await copyIfExists(path.join(this.storageRoot, 'session.json'), paths.sessionFile);
    await copyIfExists(path.join(this.storageRoot, 'runs.json'), paths.runStoreFile);
    await copyIfExists(path.join(this.storageRoot, 'audit.json'), paths.auditFile);
    const index: ChatSessionIndex = {
      schemaVersion: 1,
      activeSessionId: first.id,
      sessions: [first],
    };
    await this.writeIndex(index);
    return index;
  }
}

function parseSessionSummary(value: unknown): ChatSessionSummary {
  const record = value as Partial<ChatSessionSummary> | undefined;
  if (
    !record ||
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    throw new Error('invalid chat session summary');
  }
  return {
    id: record.id,
    title: normalizeTitle(record.title),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function sortSessions(sessions: ChatSessionSummary[]): ChatSessionSummary[] {
  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function titleFromUserText(text: string): string {
  return normalizeTitle(String(text ?? '').replace(/\s+/g, ' '));
}

function normalizeTitle(title: string): string {
  const text = String(title ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return DEFAULT_TITLE;
  return text.length > 32 ? `${text.slice(0, 32)}…` : text;
}

async function copyIfExists(from: string, to: string): Promise<void> {
  try {
    await fs.copyFile(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function legacyTitle(storageRoot: string): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(storageRoot, 'session.json'), 'utf8')) as {
      items?: Array<{ type?: string; role?: string; content?: unknown }>;
    };
    const user = parsed.items?.find((item) => item?.type === 'message' && item.role === 'user');
    const content = typeof user?.content === 'string'
      ? user.content
      : Array.isArray(user?.content)
        ? user.content.map((item) => typeof item === 'string' ? item : (item as { text?: unknown })?.text ?? '').join('')
        : '';
    return content ? titleFromUserText(content) : undefined;
  } catch {
    return undefined;
  }
}
