import type { ExtensionContext } from 'vscode'

import { registerConfigureDefaultAuthorCommand } from './commands/configureDefaultAuthor'
import { registerGenerateEpubCommand } from './commands/generateEpub'
import { registerInitEpubCommand } from './commands/initEpub'

export function activate(context: ExtensionContext): void {
  console.log('Congratulations, your extension "folder2epub" is now active!')
  context.subscriptions.push(registerConfigureDefaultAuthorCommand())
  context.subscriptions.push(registerGenerateEpubCommand())
  context.subscriptions.push(registerInitEpubCommand())
}

export function deactivate(): void {}
