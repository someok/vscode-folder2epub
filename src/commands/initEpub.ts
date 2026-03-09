import { promises as fs } from 'node:fs'

import * as vscode from 'vscode'

import { toErrorMessage } from '../services/errorMessage'
import { getMetadataDirPath, getMetadataFilePath, hasMetadataFile, resolveFolderTarget } from '../services/folderMatcher'
import { createDefaultMetadata, stringifyMetadata } from '../services/metadata'

export function registerInitEpubCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.initEpub', async (uri?: vscode.Uri) => {
    try {
      const target = await resolveFolderTarget(uri)

      if (await hasMetadataFile(target.fsPath)) {
        void vscode.window.showWarningMessage('`__t2e.data/metadata.yml` 已存在，已放弃初始化。')
        return
      }

      await fs.mkdir(getMetadataDirPath(target.fsPath), { recursive: true })

      const metadata = createDefaultMetadata(target.name)
      await fs.writeFile(getMetadataFilePath(target.fsPath), stringifyMetadata(metadata), 'utf8')

      void vscode.window.showInformationMessage(`已初始化 EPUB 数据目录：${target.name}`)
    }
    catch (error) {
      void vscode.window.showErrorMessage(`初始化 epub 失败：${toErrorMessage(error)}`)
    }
  })
}
