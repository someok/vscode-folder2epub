import * as vscode from 'vscode'

import { configureDefaultAuthorInteractively } from '../services/configuration'
import { toErrorMessage } from '../services/errorMessage'
import { l10n } from '../services/l10n'

/**
 * 注册“配置当前 Workspace 默认作者”命令。
 *
 * @returns 命令对应的可释放对象。
 */
export function registerConfigureDefaultAuthorCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.configureDefaultAuthor', async () => {
    try {
      return await configureDefaultAuthorInteractively()
    }
    catch (error) {
      void vscode.window.showErrorMessage(l10n.t('Failed to configure default author for workspace: {0}', toErrorMessage(error)))
      return {
        applied: false,
        author: '',
      }
    }
  })
}
