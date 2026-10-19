import * as vscode from 'vscode';
import { ChatViewProvider } from './chatView';

export async function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context);

  let restoredProjectHandoff = false;
  try {
    // Restore before registering the view provider. Otherwise a visible
    // sidebar can initialize the previous active session before the handoff
    // session has been created.
    restoredProjectHandoff = await provider.restoreProjectWindowHandoff();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`新工程会话初始化失败：${message}`);
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('plcAgent.chatView', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('plcAgent.openChat', async () => {
      await vscode.commands.executeCommand('plcAgent.chatView.focus');
    }),
    vscode.commands.registerCommand('plcAgent.clearChat', () => provider.clear()),
  );

  if (restoredProjectHandoff) {
    await vscode.commands.executeCommand('plcAgent.chatView.focus');
  }
}

export function deactivate() {}
