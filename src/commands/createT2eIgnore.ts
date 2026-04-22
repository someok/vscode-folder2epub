import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as vscode from 'vscode'

import { toErrorMessage } from '../services/errorMessage'
import { exists, resolveFolderTarget } from '../services/folderMatcher'
import { msg } from '../services/l10n'
import { T2E_IGNORE_FILENAME } from '../services/t2eIgnore'

/**
 * 注册"新增 .t2eignore"命令，在选定目录下创建空的 .t2eignore 文件。
 *
 * @returns 命令对应的可释放对象。
 */
export function registerCreateT2eIgnoreCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.createT2eIgnore', async (uri?: vscode.Uri) => {
    try {
      const target = await resolveFolderTarget(uri)
      const filePath = path.join(target.fsPath, T2E_IGNORE_FILENAME)

      if (await exists(filePath)) {
        void vscode.window.showWarningMessage(msg('command.createT2eIgnore.alreadyExists', T2E_IGNORE_FILENAME))
        return
      }

      await fs.writeFile(filePath, '', 'utf8')
      void vscode.window.showInformationMessage(msg('command.createT2eIgnore.success', T2E_IGNORE_FILENAME))
    }
    catch (error) {
      void vscode.window.showErrorMessage(msg('command.createT2eIgnore.error', T2E_IGNORE_FILENAME, toErrorMessage(error)))
    }
  })
}
