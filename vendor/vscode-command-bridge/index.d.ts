import type * as vscode from 'vscode';

/**
 * Inject the VS Code API object, usually from an extension's activate().
 */
export function initialize(vscodeApi: typeof vscode): typeof import('./index');

/**
 * Invoke a command of another extension by its short registered name,
 * e.g. "createPrj".
 */
export function invokeExtensionCommand<T = unknown>(
  name: string,
  ...args: unknown[]
): Promise<T>;

/**
 * Invoke any command by id.
 */
export function invokeCommand<T = unknown>(
  commandId: string,
  ...args: unknown[]
): Promise<T>;

/**
 * Invoke a command contributed by another extension, resolved from that
 * extension's package.json rather than a registered short name.
 */
export function invokeContributedCommand<T = unknown>(
  extensionId: string,
  options?: { title?: string },
  ...args: unknown[]
): Promise<T>;

/**
 * Check whether a command is currently registered in the host.
 */
export function isCommandAvailable(commandId: string): Promise<boolean>;

/**
 * List the short names accepted by invokeExtensionCommand().
 */
export function listCommands(): string[];
