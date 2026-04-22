import { promises as fs } from 'node:fs'
import * as vscode from 'vscode'

import { configureDefaultAuthorInteractively, getDefaultAuthor } from '../services/configuration'
import { toErrorMessage } from '../services/errorMessage'
import { getMetadataDirPath, getMetadataFilePath, hasMetadataFile, resolveFolderTarget } from '../services/folderMatcher'
import { msg } from '../services/l10n'
import { createDefaultMetadata, stringifyMetadata } from '../services/metadata'

const CONFIGURE_AUTHOR_ACTION = msg('command.initEpub.action.configure')
const CONTINUE_WITH_EMPTY_AUTHOR_ACTION = msg('command.initEpub.action.skip')

/**
 * 注册“初始化 epub”命令，负责创建 `__t2e.data/metadata.yml`。
 *
 * @returns 命令对应的可释放对象。
 */
export function registerInitEpubCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.initEpub', async (uri?: vscode.Uri) => {
    try {
      const target = await resolveFolderTarget(uri)

      if (await hasMetadataFile(target.fsPath)) {
        void vscode.window.showWarningMessage(msg('command.initEpub.alreadyExists'))
        return
      }

      await fs.mkdir(getMetadataDirPath(target.fsPath), { recursive: true })

      let author = getDefaultAuthor()
      if (!author) {
        // 初始化模板时优先使用当前 Workspace 的默认作者，缺失时再引导用户补充。
        const selectedAction = await vscode.window.showWarningMessage(
          msg('command.initEpub.noAuthorPrompt'),
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

      // metadata 模板只在这里落盘，后续生成阶段统一从 metadata.yml 读取。
      const metadata = createDefaultMetadata(target.name, author)
      await fs.writeFile(getMetadataFilePath(target.fsPath), stringifyMetadata(metadata), 'utf8')

      void vscode.window.showInformationMessage(msg('command.initEpub.success', target.name))
    }
    catch (error) {
      void vscode.window.showErrorMessage(msg('command.initEpub.error', toErrorMessage(error)))
    }
  })
}
