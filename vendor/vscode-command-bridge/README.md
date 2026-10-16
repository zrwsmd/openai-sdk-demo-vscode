# vscode-command-bridge

Call a command registered by **another** VS Code extension from your own
extension through a single npm method.

The target extension and command are configured inside this package
(`COMMAND_REGISTRY`), so callers only pass a short command name.

## Install

```powershell
npm install vscode-command-bridge
```

## Registry

```js
const COMMAND_REGISTRY = {
  createPrj: {
    extensionId: 'ytak.devuni-ide-vscode',
    commandId: 'devUni.prjView.createPrj'
  },
  bridgeProjectInitInfo: {
    extensionId: 'ytak.devuni-ide-vscode',
    commandId: 'devUni.prjView.bridgeProjectInitInfo'
  },
  bridgeCreateProject: {
    extensionId: 'ytak.devuni-ide-vscode',
    commandId: 'devUni.prjView.bridgeCreateProject'
  },
  closePrj: {
    extensionId: 'ytak.devuni-ide-vscode',
    commandId: 'devUni.prjView.closePrj'
  },
  bridgeOpenPrj: {
    extensionId: 'ytak.devuni-ide-vscode',
    commandId: 'devUni.prjView.bridgeOpenPrj'
  }
};
```

Add new entries here to expose more commands under a short name.

## Usage

```js
const vscode = require('vscode');
const bridge = require('vscode-command-bridge');

function activate(context) {
  bridge.initialize(vscode); // optional; the package can also lazy-load "vscode"

  context.subscriptions.push(
    vscode.commands.registerCommand('my-ext.run', async () => {
      // Single call: run a registered command by its short name.
      await bridge.invokeExtensionCommand('createPrj');

      // Two explicit steps: first get the init info from the target extension,
      // then pass that returned info as the argument of the create-project
      // command.
      const initInfo = await bridge.invokeExtensionCommand('bridgeProjectInitInfo');
      const result = await bridge.invokeExtensionCommand('bridgeCreateProject', initInfo);
    })
  );
}
```

## API

| Method | Description |
| --- | --- |
| `initialize(vscode)` | Inject the VS Code API so the package never needs to `require('vscode')`. |
| `invokeExtensionCommand(name, ...args)` | Run the registered command `name` (e.g. `"createPrj"`). |
| `invokeCommand(commandId, ...args)` | Execute any command by id. |
| `invokeContributedCommand(extensionId, { title }, ...args)` | Resolve the command id from a target extension's `package.json`. |
| `isCommandAvailable(commandId)` | Check whether a command is currently registered. |
| `listCommands()` | List the short names accepted by `invokeExtensionCommand`. |

## Notes

VS Code has a single global command namespace, so `executeCommand` reaches any
extension's command as long as the command is registered and the target
extension is active. This package activates the target extension by id so the
call succeeds even when it has not been activated yet.
