import path from 'node:path'

import * as vscode from 'vscode'

import { scanContentTree } from '../services/contentScanner'
import { toErrorMessage } from '../services/errorMessage'
import { hasMetadataFile, resolveFolderTarget } from '../services/folderMatcher'
import { l10n } from '../services/l10n'
import { buildMarkdown } from '../services/markdownService'
import { readMetadata } from '../services/metadata'

/**
 * 注册"生成合并 Markdown"命令，串联 metadata 读取、内容扫描和合并输出流程。
 *
 * @returns 命令对应的可释放对象。
 */
export function registerGenerateMarkdownCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.generateMarkdown', async (uri?: vscode.Uri) => {
    try {
      let targetUri = uri
      if (!targetUri) {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: l10n.t('Select'),
          title: l10n.t('Select a directory to merge into Markdown'),
        })
        if (!selected || !selected.length) {
          return
        }
        targetUri = selected[0]
      }

      const target = await resolveFolderTarget(targetUri)

      if (!await hasMetadataFile(target.fsPath)) {
        void vscode.window.showWarningMessage(l10n.t('The directory is missing `__t2e.data/metadata.yml`. Please run "Initialize EPUB" first.'))
        return
      }

      const metadata = await readMetadata(target.fsPath)
      const content = await scanContentTree(target.fsPath)
      if (!content.files.length) {
        throw new Error(l10n.t('No md/txt files available to generate EPUB in the current directory.'))
      }

      const defaultFileName = `${metadata.title.trim() || l10n.t('Unnamed')}.md`
      const defaultUri = vscode.Uri.file(path.join(target.fsPath, defaultFileName))
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          Markdown: ['md'],
        },
        title: l10n.t('Save merged Markdown'),
      })

      if (!saveUri) {
        return
      }

      const result = await buildMarkdown({
        metadata,
        content,
        outputFilePath: saveUri.fsPath,
      })

      void vscode.window.showInformationMessage(l10n.t('Markdown generated: {0}', result.outputFilePath))
    }
    catch (error) {
      void vscode.window.showErrorMessage(l10n.t('Failed to generate Markdown: {0}', toErrorMessage(error)))
    }
  })
}
