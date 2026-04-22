import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as vscode from 'vscode'

import { toErrorMessage } from '../services/errorMessage'
import { exists, resolveFolderTarget } from '../services/folderMatcher'
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
        void vscode.window.showWarningMessage(`该目录下已存在 ${T2E_IGNORE_FILENAME} 文件。`)
        return
      }

      await fs.writeFile(filePath, '', 'utf8')
      void vscode.window.showInformationMessage(`已创建 ${T2E_IGNORE_FILENAME} 文件。`)
    }
    catch (error) {
      void vscode.window.showErrorMessage(`创建 ${T2E_IGNORE_FILENAME} 失败：${toErrorMessage(error)}`)
    }
  })
}
