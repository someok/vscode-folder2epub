import type { ExtensionContext } from 'vscode'

import { registerConfigureDefaultAuthorCommand } from './commands/configureDefaultAuthor'
import { registerCreateT2eIgnoreCommand } from './commands/createT2eIgnore'
import { registerGenerateEpubCommand } from './commands/generateEpub'
import { registerInitEpubCommand } from './commands/initEpub'

/**
 * 注册扩展生命周期内需要提供的全部命令。
 *
 * @param context VS Code 提供的扩展上下文。
 */
export function activate(context: ExtensionContext): void {
  context.subscriptions.push(registerConfigureDefaultAuthorCommand())
  context.subscriptions.push(registerCreateT2eIgnoreCommand())
  context.subscriptions.push(registerGenerateEpubCommand())
  context.subscriptions.push(registerInitEpubCommand())
}

/**
 * 预留的停用钩子，当前无需额外清理逻辑。
 */
export function deactivate(): void {}
