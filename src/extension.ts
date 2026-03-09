import type { ExtensionContext } from 'vscode'

import { registerGenerateEpubCommand } from './commands/generateEpub'
import { registerInitEpubCommand } from './commands/initEpub'

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(registerGenerateEpubCommand())
  context.subscriptions.push(registerInitEpubCommand())
}

export function deactivate(): void {}
