import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pathFromWorkspaceEntry(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!isRecord(value)) return undefined;
  const candidate = value.path ?? value.uri;
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function toFilePath(value: string): string {
  if (!/^file:\/\//iu.test(value)) return value;
  try {
    return fileURLToPath(value);
  } catch {
    return value;
  }
}

/**
 * Resolve the real project folders from a VS Code `.code-workspace` file.
 * The bridge returns the workspace file path, while file tools need the
 * folder listed inside that file (for example `D:\\asdf\\SC5100`).
 */
export async function workspaceRootsFromWorkspaceFile(
  workspaceFile: string,
): Promise<readonly string[]> {
  const filePath = path.resolve(toFilePath(workspaceFile.trim()));
  const workspaceDir = path.dirname(filePath);
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const folders = isRecord(parsed) && Array.isArray(parsed.folders)
      ? parsed.folders
      : [];
    const roots = folders
      .map(pathFromWorkspaceEntry)
      .filter((entry): entry is string => !!entry)
      .map((entry) => path.resolve(workspaceDir, toFilePath(entry)))
      .filter((entry, index, all) => all.indexOf(entry) === index);
    if (roots.length) return roots;
  } catch {
    // Fall back to the workspace file's parent when the external plugin did
    // not write a parseable workspace file. It is still a useful authorization
    // boundary, and the next explicit path can narrow it further.
  }
  return [workspaceDir];
}

