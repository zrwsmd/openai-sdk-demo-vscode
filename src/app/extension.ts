import * as vscode from 'vscode';
import { ChatViewProvider } from './chatView';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('plcAgent.chatView', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('plcAgent.openChat', async () => {
      await vscode.commands.executeCommand('plcAgent.chatView.focus');
    }),
    vscode.commands.registerCommand('plcAgent.clearChat', () => provider.clear()),
  );
}

export function deactivate() {}
