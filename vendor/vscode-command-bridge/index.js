'use strict';

/**
 * vscode-command-bridge
 *
 * Lets a VS Code extension call a method exported by this npm package, which in
 * turn invokes a command registered by ANOTHER VS Code extension.
 *
 * The `vscode` module only exists inside the VS Code extension host, so this
 * package resolves it lazily, or accepts an instance injected with initialize().
 */

/**
 * Commands of other extensions, keyed by the short name callers pass to
 * invokeExtensionCommand(). Add new entries here to expose more commands.
 */
const EXTENSION_ID = 'ytak.devuni-ide-vscode';

const COMMAND_REGISTRY = {
  createPrj: {
    extensionId: EXTENSION_ID,
    commandId: 'devUni.prjView.createPrj'
  },
  bridgeProjectInitInfo: {
    extensionId: EXTENSION_ID,
    commandId: 'devUni.prjView.bridgeProjectInitInfo'
  },
  bridgeCreateProject: {
    extensionId: EXTENSION_ID,
    commandId: 'devUni.prjView.bridgeCreateProject'
  },
  closePrj: {
    extensionId: EXTENSION_ID,
    commandId: 'devUni.prjView.closePrj'
  },
  bridgeOpenPrj: {
    extensionId: EXTENSION_ID,
    commandId: 'devUni.prjView.bridgeOpenPrj'
  }
};

let injectedVscode = null;

/**
 * Inject the VS Code API object. Call once from your extension's activate():
 *
 *   const bridge = require('vscode-command-bridge');
 *   bridge.initialize(vscode);
 *
 * @param {object} vscodeApi The object returned by require('vscode').
 * @returns {object} This module, for chaining.
 */
function initialize(vscodeApi) {
  if (
    !vscodeApi ||
    !vscodeApi.commands ||
    typeof vscodeApi.commands.executeCommand !== 'function'
  ) {
    throw new TypeError(
      'initialize() expects the VS Code API object (require("vscode")).'
    );
  }

  injectedVscode = vscodeApi;
  return module.exports;
}

/**
 * @returns {object} The VS Code API object.
 */
function resolveVscode() {
  if (injectedVscode) {
    return injectedVscode;
  }

  try {
    return require('vscode');
  } catch (error) {
    throw new Error(
      'Unable to load the "vscode" module. Call initialize(vscode) from your ' +
        "extension's activate() function, or run this package inside a " +
        'VS Code extension host.'
    );
  }
}

/**
 * Resolve a short command name to its extension and command id.
 *
 * @param {string} name The registered command name, e.g. "createPrj".
 * @returns {{ extensionId: string, commandId: string }} The matching entry.
 */
function resolveRegisteredCommand(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError(
      'invokeExtensionCommand() requires a non-empty command name string.'
    );
  }

  const entry = COMMAND_REGISTRY[name];
  if (!entry) {
    const known = Object.keys(COMMAND_REGISTRY).join(', ') || '(none)';
    throw new Error(`Unknown command name "${name}". Supported names: ${known}.`);
  }

  return entry;
}

/**
 * Activate the given extension (if needed) and execute one of its commands.
 *
 * @param {string} extensionId The target extension id, e.g. "publisher.name".
 * @param {string} commandId The command id to execute.
 * @param {unknown[]} args Arguments forwarded to the command.
 * @returns {Promise<unknown>} The value returned by the command.
 */
async function executeOnExtension(extensionId, commandId, args) {
  const vscode = resolveVscode();
  const extension = vscode.extensions.getExtension(extensionId);

  if (!extension) {
    throw new Error(`Extension "${extensionId}" is not installed.`);
  }

  if (!extension.isActive) {
    await extension.activate();
  }

  return vscode.commands.executeCommand(commandId, ...args);
}

/**
 * Invoke a command of another extension by its short registered name.
 *
 * @param {string} name The registered command name, e.g. "createPrj".
 * @param {...unknown} args Arguments forwarded to the command.
 * @returns {Promise<unknown>} The value returned by the command.
 */
async function invokeExtensionCommand(name, ...args) {
  const { extensionId, commandId } = resolveRegisteredCommand(name);
  return executeOnExtension(extensionId, commandId, args);
}

/**
 * Invoke any command by id, whether it lives in this extension or another one.
 *
 * @param {string} commandId The command id to execute.
 * @param {...unknown} args Arguments forwarded to the command.
 * @returns {Promise<unknown>} The value returned by the command.
 */
async function invokeCommand(commandId, ...args) {
  if (typeof commandId !== 'string' || commandId.length === 0) {
    throw new TypeError('invokeCommand() requires a non-empty command id string.');
  }

  const vscode = resolveVscode();
  return vscode.commands.executeCommand(commandId, ...args);
}

/**
 * Invoke a command contributed by another extension, resolved from the target's
 * package.json rather than a registered short name. Only the first contributed
 * command matching `title` is used when `title` is supplied.
 *
 * @param {string} extensionId The target extension id.
 * @param {object} [options]
 * @param {string} [options.title] Pick the contributed command with this title.
 * @param {...unknown} args Arguments forwarded to the command.
 * @returns {Promise<unknown>} The value returned by the command.
 */
async function invokeContributedCommand(extensionId, options = {}, ...args) {
  const vscode = resolveVscode();
  const extension = vscode.extensions.getExtension(extensionId);

  if (!extension) {
    throw new Error(`Extension "${extensionId}" is not installed.`);
  }

  const contributed =
    (extension.packageJSON &&
      extension.packageJSON.contributes &&
      extension.packageJSON.contributes.commands) ||
    [];

  const match = options.title
    ? contributed.find((command) => command.title === options.title)
    : contributed[0];

  if (!match) {
    throw new Error(
      `Extension "${extensionId}" does not contribute a matching command.`
    );
  }

  return executeOnExtension(extensionId, match.command, args);
}

/**
 * Check whether a command is currently registered in the host.
 *
 * @param {string} commandId The command id to look up.
 * @returns {Promise<boolean>} True when the command is registered.
 */
async function isCommandAvailable(commandId) {
  const vscode = resolveVscode();
  const commands = await vscode.commands.getCommands(true);
  return commands.includes(commandId);
}

/**
 * @returns {string[]} The short names accepted by invokeExtensionCommand().
 */
function listCommands() {
  return Object.keys(COMMAND_REGISTRY);
}

module.exports = {
  initialize,
  invokeCommand,
  invokeExtensionCommand,
  invokeContributedCommand,
  isCommandAvailable,
  listCommands
};
