import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type AuditEventType =
  | 'run_started'
  | 'run_resumed'
  | 'run_completed'
  | 'run_failed'
  | 'run_cancelled'
  | 'approval_requested'
  | 'approval_decided'
  | 'guardrail_evaluated'
  | 'tool_requested'
  | 'tool_completed'
  | 'checkpoint_saved'
  | 'retry_started';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  runId?: string;
  operationId?: string;
  traceId?: string;
  toolName?: string;
  risk?: string;
  decision?: string;
  ok?: boolean;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditSink {
  append(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent>;
  read(limit?: number): Promise<AuditEvent[]>;
}

export class JsonAuditSink implements AuditSink {
  private writeChain: Promise<void> = Promise.resolve();
  constructor(private readonly filePath: string) {}

  async append(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent> {
    const full: AuditEvent = { ...event, id: randomUUID(), timestamp: new Date().toISOString() };
    await this.enqueue(async () => {
      const current = await this.readAll();
      current.push(full);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify({ schemaVersion: 1, events: current }, null, 2), 'utf8');
      await fs.rename(temp, this.filePath);
    });
    return full;
  }

  async read(limit = 500): Promise<AuditEvent[]> {
    const events = await this.readAll();
    return events.slice(Math.max(0, events.length - limit));
  }

  private async readAll(): Promise<AuditEvent[]> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as { schemaVersion?: number; events?: AuditEvent[] };
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.events)) throw new Error('invalid audit schema');
      return parsed.events;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new Error(`审计日志损坏，已停止写入: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.writeChain.then(task);
    this.writeChain = next.catch(() => {});
    return next;
  }
}

