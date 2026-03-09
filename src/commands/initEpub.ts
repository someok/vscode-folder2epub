import { promises as fs } from 'node:fs'
import * as vscode from 'vscode'

import { configureDefaultAuthorInteractively, getDefaultAuthor } from '../services/configuration'
import { toErrorMessage } from '../services/errorMessage'
import { getMetadataDirPath, getMetadataFilePath, hasMetadataFile, resolveFolderTarget } from '../services/folderMatcher'
import { createDefaultMetadata, stringifyMetadata } from '../services/metadata'

const CONFIGURE_AUTHOR_ACTION = '立即配置'
const CONTINUE_WITH_EMPTY_AUTHOR_ACTION = '本次留空'

export function registerInitEpubCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.initEpub', async (uri?: vscode.Uri) => {
    try {
      const target = await resolveFolderTarget(uri)

      if (await hasMetadataFile(target.fsPath)) {
        void vscode.window.showWarningMessage('`__t2e.data/metadata.yml` 已存在，已放弃初始化。')
        return
      }

      await fs.mkdir(getMetadataDirPath(target.fsPath), { recursive: true })

      let author = getDefaultAuthor()
      if (!author) {
        const selectedAction = await vscode.window.showWarningMessage(
          '当前 Workspace 尚未配置默认作者。是否现在配置？',
          CONFIGURE_AUTHOR_ACTION,
          CONTINUE_WITH_EMPTY_AUTHOR_ACTION,
        )

        if (selectedAction === CONFIGURE_AUTHOR_ACTION) {
          const configurationResult = await configureDefaultAuthorInteractively()
          if (!configurationResult?.applied) {
            return
          }

          author = configurationResult.author.trim()
        }
        else if (selectedAction !== CONTINUE_WITH_EMPTY_AUTHOR_ACTION) {
          return
        }
      }

      const metadata = createDefaultMetadata(target.name, author)
      await fs.writeFile(getMetadataFilePath(target.fsPath), stringifyMetadata(metadata), 'utf8')

      void vscode.window.showInformationMessage(`已初始化 EPUB 数据目录：${target.name}`)
    }
    catch (error) {
      void vscode.window.showErrorMessage(`初始化 epub 失败：${toErrorMessage(error)}`)
    }
  })
}
