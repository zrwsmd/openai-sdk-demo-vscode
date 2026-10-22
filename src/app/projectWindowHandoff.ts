import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonFileSession } from '../runtime/session';
import { TRUSTED_CONTEXT_PROVIDER_DATA_KEY } from '../runtime/agentHistory';
import { ChatSessionCatalog, type ChatSessionSummary } from './chatSessions';

const HANDOFF_SCHEMA_VERSION = 1;
const HANDOFF_DIR = 'project-window-handoffs';
const HANDOFF_TTL_MS = 24 * 60 * 60 * 1_000;

export interface ProjectWindowHandoffInput {
  workspaceFile: string;
  projectRoots: readonly string[];
  projectName?: string;
  parentDirectory?: string;
  deviceModel?: string;
  language?: string;
  projectType?: string;
}

export interface ProjectWindowHandoff {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  expiresAt: string;
  workspaceFile: string;
  projectRoots: string[];
  projectName: string;
  parentDirectory?: string;
  deviceModel?: string;
  language?: string;
  projectType?: string;
}

export interface ProjectWindowHandoffClaim {
  handoff: ProjectWindowHandoff;
  complete(): Promise<void>;
  release(): Promise<void>;
}

export class ProjectWindowHandoffStore {
  constructor(private readonly globalStorageRoot: string) {}

  async enqueue(input: ProjectWindowHandoffInput): Promise<ProjectWindowHandoff> {
    const workspaceFile = normalizeFsPath(input.workspaceFile);
    const projectRoots = uniquePaths(input.projectRoots);
    if (!workspaceFile) throw new Error('新工程工作区文件路径为空');
    if (!projectRoots.length) throw new Error('新工程没有可用的工程根目录');

    const now = Date.now();
    const handoff: ProjectWindowHandoff = {
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      id: randomUUID(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + HANDOFF_TTL_MS).toISOString(),
      workspaceFile,
      projectRoots,
      projectName: cleanText(input.projectName) || projectNameFromWorkspaceFile(workspaceFile),
      ...(cleanText(input.parentDirectory) ? { parentDirectory: cleanText(input.parentDirectory) } : {}),
      ...(cleanText(input.deviceModel) ? { deviceModel: cleanText(input.deviceModel) } : {}),
      ...(cleanText(input.language) ? { language: cleanText(input.language) } : {}),
      ...(cleanText(input.projectType) ? { projectType: cleanText(input.projectType) } : {}),
    };

    await fs.mkdir(this.handoffRoot(), { recursive: true });
    const target = this.pendingPath(handoff.id);
    const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(handoff), 'utf8');
    await fs.rename(temp, target);
    return handoff;
  }

  async discard(id: string): Promise<void> {
    if (!/^[0-9a-f-]+$/i.test(id)) return;
    await fs.rm(this.pendingPath(id), { force: true });
  }

  async claimForWorkspace(
    workspaceFile: string | undefined,
    workspaceRoots: readonly string[],
  ): Promise<ProjectWindowHandoffClaim | undefined> {
    let names: string[];
    try {
      names = await fs.readdir(this.handoffRoot());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }

    const currentWorkspaceFile = normalizeFsPath(workspaceFile ?? '');
    const currentRoots = uniquePaths(workspaceRoots);
    const candidates: Array<{ handoff: ProjectWindowHandoff; pendingPath: string }> = [];
    for (const name of names.filter((item) => /^[0-9a-f-]+\.json$/i.test(item))) {
      const pendingPath = path.join(this.handoffRoot(), name);
      let handoff: ProjectWindowHandoff;
      try {
        handoff = parseHandoff(JSON.parse(await fs.readFile(pendingPath, 'utf8')));
      } catch {
        await fs.rm(pendingPath, { force: true });
        continue;
      }
      if (Date.parse(handoff.expiresAt) <= Date.now()) {
        await fs.rm(pendingPath, { force: true });
        continue;
      }
      if (handoffMatchesWorkspace(handoff, currentWorkspaceFile, currentRoots)) {
        candidates.push({ handoff, pendingPath });
      }
    }

    candidates.sort((a, b) => b.handoff.createdAt.localeCompare(a.handoff.createdAt));
    for (const candidate of candidates) {
      const claimedPath = `${candidate.pendingPath}.claimed.${process.pid}.${randomUUID()}`;
      try {
        await fs.rename(candidate.pendingPath, claimedPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      return {
        handoff: candidate.handoff,
        complete: async () => {
          await fs.rm(claimedPath, { force: true });
          await Promise.all(
            candidates
              .filter((item) => item.handoff.id !== candidate.handoff.id)
              .map((item) => fs.rm(item.pendingPath, { force: true })),
          );
        },
        release: async () => {
          try {
            await fs.rename(claimedPath, candidate.pendingPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        },
      };
    }
    return undefined;
  }

  private handoffRoot(): string {
    return path.join(this.globalStorageRoot, HANDOFF_DIR);
  }

  private pendingPath(id: string): string {
    return path.join(this.handoffRoot(), `${id}.json`);
  }
}

export function renderProjectWindowSummary(handoff: ProjectWindowHandoff): string {
  const lines = [
    '工程已创建，并已在新窗口打开。',
    '',
    `工程名称：${handoff.projectName}`,
    `工程目录：${handoff.projectRoots[0]}`,
    ...(handoff.deviceModel ? [`设备型号：${handoff.deviceModel}`] : []),
    ...(handoff.projectType ? [`工程类型：${handoff.projectType}`] : []),
    ...(handoff.language ? [`工程语言：${handoff.language}`] : []),
    '',
    `后续操作默认以 ${handoff.projectRoots[0]} 为工程根目录。`,
  ];
  return lines.join('\n');
}

export async function createProjectHandoffSession(
  catalog: ChatSessionCatalog,
  handoff: ProjectWindowHandoff,
): Promise<ChatSessionSummary> {
  const session = await catalog.create(`工程：${handoff.projectName}`);
  try {
    await catalog.setWorkspaceRoots(session.id, handoff.projectRoots);
    const history = new JsonFileSession(catalog.pathsFor(session.id).sessionFile);
    await history.addItems([
      {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: renderProjectWindowSummary(handoff) }],
        providerData: { [TRUSTED_CONTEXT_PROVIDER_DATA_KEY]: true },
      },
    ]);
    await catalog.touch(session.id);
    return session;
  } catch (error) {
    await catalog.delete(session.id).catch(() => undefined);
    throw error;
  }
}

function parseHandoff(value: unknown): ProjectWindowHandoff {
  const record = value as Partial<ProjectWindowHandoff> | undefined;
  if (
    !record ||
    record.schemaVersion !== HANDOFF_SCHEMA_VERSION ||
    typeof record.id !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.expiresAt !== 'string' ||
    typeof record.workspaceFile !== 'string' ||
    typeof record.projectName !== 'string' ||
    !Array.isArray(record.projectRoots)
  ) {
    throw new Error('invalid project window handoff');
  }
  const workspaceFile = normalizeFsPath(record.workspaceFile);
  const projectRoots = uniquePaths(record.projectRoots);
  if (!workspaceFile || !projectRoots.length || !cleanText(record.projectName)) {
    throw new Error('incomplete project window handoff');
  }
  return {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    id: record.id,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    workspaceFile,
    projectRoots,
    projectName: cleanText(record.projectName),
    ...(cleanText(record.parentDirectory) ? { parentDirectory: cleanText(record.parentDirectory) } : {}),
    ...(cleanText(record.deviceModel) ? { deviceModel: cleanText(record.deviceModel) } : {}),
    ...(cleanText(record.language) ? { language: cleanText(record.language) } : {}),
    ...(cleanText(record.projectType) ? { projectType: cleanText(record.projectType) } : {}),
  };
}

function handoffMatchesWorkspace(
  handoff: ProjectWindowHandoff,
  workspaceFile: string,
  workspaceRoots: readonly string[],
): boolean {
  if (workspaceFile && samePath(handoff.workspaceFile, workspaceFile)) return true;
  return handoff.projectRoots.some((root) => workspaceRoots.some((candidate) => samePath(root, candidate)));
}

function uniquePaths(values: readonly unknown[]): string[] {
  const paths: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = normalizeFsPath(value);
    if (normalized && !paths.some((candidate) => samePath(candidate, normalized))) {
      paths.push(normalized);
    }
  }
  return paths;
}

function normalizeFsPath(value: string): string {
  const text = cleanText(value);
  if (!text) return '';
  try {
    return path.resolve(/^file:\/\//i.test(text) ? fileURLToPath(text) : text);
  } catch {
    return path.resolve(text);
  }
}

function samePath(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32'
    ? a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
    : a === b;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function projectNameFromWorkspaceFile(workspaceFile: string): string {
  return path.basename(workspaceFile).replace(/\.code-workspace$/i, '') || path.basename(workspaceFile);
}
