import path from 'node:path'

import * as vscode from 'vscode'

import { scanContentTree } from '../services/contentScanner'
import { buildEpub } from '../services/epubService'
import { toErrorMessage } from '../services/errorMessage'
import { hasMetadataFile, resolveFolderTarget } from '../services/folderMatcher'
import { l10n } from '../services/l10n'
import { formatBookFileName, readMetadata } from '../services/metadata'
import { resolveOutputDir } from '../services/outputResolver'

/**
 * 注册“生成 epub”命令，串联 metadata 读取、内容扫描和 EPUB 打包流程。
 *
 * @returns 命令对应的可释放对象。
 */
export function registerGenerateEpubCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.generateEpub', async (uri?: vscode.Uri) => {
    try {
      const target = await resolveFolderTarget(uri)

      if (!await hasMetadataFile(target.fsPath)) {
        void vscode.window.showWarningMessage(l10n.t('The directory is missing \`__t2e.data/metadata.yml\`. Please run "Initialize EPUB" first.'))
        return
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: l10n.t('Generating EPUB'),
          cancellable: false,
        },
        async (progress) => {
          // 生成过程拆成几个明显阶段，便于在 VS Code 通知中给出可感知的进度反馈。
          progress.report({ message: l10n.t('Reading metadata.yml') })
          const metadata = await readMetadata(target.fsPath)

          progress.report({ message: l10n.t('Scanning directory content') })
          const content = await scanContentTree(target.fsPath)
          if (!content.files.length) {
            throw new Error(l10n.t('No md/txt files available to generate EPUB in the current directory.'))
          }

          progress.report({ message: l10n.t('Resolving output directory') })
          const outputDir = await resolveOutputDir(target.fsPath)
          const outputFilePath = path.join(outputDir, formatBookFileName(metadata))

          progress.report({ message: l10n.t('Packaging EPUB 3') })
          return buildEpub({
            rootFolderPath: target.fsPath,
            metadata,
            nodes: content.nodes,
            outputFilePath,
          })
        },
      )

      void vscode.window.showInformationMessage(l10n.t('EPUB generated: {0}', result.outputFilePath))
    }
    catch (error) {
      void vscode.window.showErrorMessage(l10n.t('Failed to generate EPUB: {0}', toErrorMessage(error)))
    }
  })
}
