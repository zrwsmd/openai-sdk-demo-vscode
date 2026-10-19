import path from 'node:path';

export class WorkspaceScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceScopeError';
  }
}

export interface ResolvedWorkspacePath {
  root: string;
  absolutePath: string;
  relativePath: string;
  rootIndex: number;
}

/**
 * Resolves relative and explicit absolute paths against host-authorized
 * workspace roots. Relative paths always use the primary (first) root.
 */
export class WorkspaceScope {
  private rootsValue: string[];

  constructor(roots: readonly string[]) {
    const normalized = roots
      .map((root) => root.trim())
      .filter(Boolean)
      .map((root) => path.resolve(root));
    this.rootsValue = [...new Set(normalized)];
  }

  get roots(): readonly string[] {
    return this.rootsValue;
  }

  get primaryRoot(): string {
    return this.rootsValue[0] ?? '';
  }

  /**
   * Add a host-authorized root for the current tool run. Explicit paths use
   * the root that contains them; relative paths keep using the existing
   * primary root unless the caller deliberately promotes this root.
   */
  addRoot(root: string, promote = false): string {
    const trimmed = root.trim();
    if (!trimmed) return '';
    const normalized = path.resolve(trimmed);
    const remaining = this.rootsValue.filter((item) => item !== normalized);
    this.rootsValue = promote
      ? [normalized, ...remaining]
      : [...remaining, normalized];
    return normalized;
  }

  /** Resolve an input without applying the authorization check. */
  candidateAbsolutePath(input: string): string {
    const candidate = cleanPathInput(input);
    if (!candidate) return '';
    return path.isAbsolute(candidate) || /^[A-Za-z]:[\\/]/.test(candidate)
      ? path.resolve(candidate)
      : path.resolve(this.primaryRoot, candidate);
  }

  isAuthorizedAbsolutePath(absolutePath: string): boolean {
    return this.rootsValue.some((root) => isWithinRoot(root, absolutePath));
  }

  resolveAbsolutePath(absolutePath: string): ResolvedWorkspacePath {
    const normalizedPath = path.resolve(absolutePath);
    const index = this.rootsValue.findIndex((root) => isWithinRoot(root, normalizedPath));
    if (index < 0) {
      throw new WorkspaceScopeError(
        `路径不在已授权工作区内: ${absolutePath}。` +
          `当前已授权的工作区是 ${this.rootsValue.join('、')}；` +
          '请先将目标目录加入本轮授权。',
      );
    }
    const root = this.rootsValue[index];
    return {
      root,
      absolutePath: normalizedPath,
      relativePath: path.relative(root, normalizedPath) || '.',
      rootIndex: index,
    };
  }

  resolve(input: string): ResolvedWorkspacePath {
    if (!this.rootsValue.length) {
      throw new WorkspaceScopeError('未打开工作区文件夹，文件类工具不可用');
    }
    const candidate = cleanPathInput(input);
    if (!candidate) throw new WorkspaceScopeError('文件路径不能为空');

    if (path.isAbsolute(candidate) || /^[A-Za-z]:[\\/]/.test(candidate)) {
      const absolutePath = path.resolve(candidate);
      if (!this.isAuthorizedAbsolutePath(absolutePath)) {
        // 只报"不允许"等于把问题丢回给用户：他不知道允许的是什么，也不知道下一步该做什么。
        // 这句话会原样进工具账本、被模型读到，所以把"当前允许哪些目录 + 怎么解"一并写进去。
        throw new WorkspaceScopeError(
          `路径不在已授权工作区内: ${input}。` +
            `当前已授权的工作区是 ${this.rootsValue.join('、')}；` +
            '请改用工作区内的路径，或明确确认是否将该目录加入本轮授权后重试。',
        );
      }
      return this.resolveAbsolutePath(absolutePath);
    }

    const root = this.primaryRoot;
    const absolutePath = path.resolve(root, candidate);
    if (!isWithinRoot(root, absolutePath)) {
      throw new WorkspaceScopeError(
        `路径越界: ${input} 不在工作区 ${root} 内。` +
          `相对路径只能落在当前工作区内；要写到别处请改用已授权工作区的绝对路径，` +
          `或明确确认是否将该目录加入本轮授权。`,
      );
    }
    return {
      root,
      absolutePath,
      relativePath: path.relative(root, absolutePath) || '.',
      rootIndex: 0,
    };
  }
}

export function workspaceScopeFromRoots(workspaceRoot: string, workspaceRoots?: readonly string[]): WorkspaceScope {
  const roots = workspaceRoots?.length ? workspaceRoots : workspaceRoot ? [workspaceRoot] : [];
  return new WorkspaceScope(roots);
}

function cleanPathInput(input: string): string {
  return input.trim().replace(/^([`'"“”‘’])([\s\S]*)\1$/, '$2');
}

function isWithinRoot(root: string, candidate: string): boolean {
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidate);
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
