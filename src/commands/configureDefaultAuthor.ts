import * as vscode from 'vscode'

import { configureDefaultAuthorInteractively } from '../services/configuration'
import { toErrorMessage } from '../services/errorMessage'

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
      void vscode.window.showErrorMessage(`配置当前 Workspace 默认作者失败：${toErrorMessage(error)}`)
      return {
        applied: false,
        author: '',
      }
    }
  })
}
