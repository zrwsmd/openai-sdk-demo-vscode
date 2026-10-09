import path from 'node:path';
import {
  PLC_RUNTIME_CONFIG_FILE_NAME,
  PlcRuntimeConfigError,
  PlcRuntimeConfigStore,
  type PlcRuntimeConfig,
} from './plcRuntimeConfig';

export type PlcRuntimeConfigState =
  | {
      status: 'missing';
      filePath: string;
    }
  | {
      status: 'ready';
      filePath: string;
      config: PlcRuntimeConfig;
    }
  | {
      status: 'invalid';
      filePath: string;
      error: PlcRuntimeConfigError;
    };

export interface PlcRuntimeConfigRepositoryOptions {
  workspaceRoot: string;
}

function normalizeWorkspaceRoot(workspaceRoot: string): string {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) {
    throw new PlcRuntimeConfigError('workspaceRoot: 必须是非空字符串');
  }
  return path.resolve(workspaceRoot);
}

/**
 * Workspace-facing access to the user-owned PLC task configuration.
 *
 * The repository deliberately reports malformed configuration as an explicit
 * state instead of silently falling back to a guessed task. Callers can use
 * that distinction to open a clarification dialog or show a repair action.
 */
export class PlcRuntimeConfigRepository {
  readonly workspaceRoot: string;
  readonly filePath: string;
  private readonly store: PlcRuntimeConfigStore;
  private state?: PlcRuntimeConfigState;

  constructor(options: PlcRuntimeConfigRepositoryOptions) {
    this.workspaceRoot = normalizeWorkspaceRoot(options.workspaceRoot);
    this.filePath = path.join(this.workspaceRoot, PLC_RUNTIME_CONFIG_FILE_NAME);
    this.store = new PlcRuntimeConfigStore(this.filePath);
  }

  getSnapshot(): PlcRuntimeConfigState | undefined {
    return this.state;
  }

  async refresh(): Promise<PlcRuntimeConfigState> {
    try {
      const config = await this.store.read();
      this.state = config
        ? { status: 'ready', filePath: this.filePath, config }
        : { status: 'missing', filePath: this.filePath };
    } catch (error) {
      const configError =
        error instanceof PlcRuntimeConfigError
          ? error
          : new PlcRuntimeConfigError(String(error));
      this.state = {
        status: 'invalid',
        filePath: this.filePath,
        error: configError,
      };
    }
    return this.state;
  }

  async save(value: unknown): Promise<PlcRuntimeConfigState & { status: 'ready' }> {
    const config = await this.store.write(value);
    this.state = { status: 'ready', filePath: this.filePath, config };
    return this.state;
  }

  /**
   * Do not overwrite a malformed file through a convenience method. Repair
   * needs an explicit user action so a popup cannot destroy useful context.
   */
  async assertReady(): Promise<PlcRuntimeConfig> {
    const state = await this.refresh();
    if (state.status === 'ready') return state.config;
    if (state.status === 'missing') {
      throw new PlcRuntimeConfigError(`未找到 ${state.filePath}`);
    }
    throw state.error;
  }
}

export function createPlcRuntimeConfigRepository(
  workspaceRoot: string,
): PlcRuntimeConfigRepository {
  return new PlcRuntimeConfigRepository({ workspaceRoot });
}

