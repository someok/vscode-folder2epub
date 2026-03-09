import path from 'node:path'

import * as vscode from 'vscode'

import { scanContentTree } from '../services/contentScanner'
import { buildEpub } from '../services/epubService'
import { toErrorMessage } from '../services/errorMessage'
import { hasMetadataFile, resolveFolderTarget } from '../services/folderMatcher'
import { formatBookFileName, readMetadata } from '../services/metadata'
import { resolveOutputDir } from '../services/outputResolver'

/**
 * 注册“生成 epub”命令，串联 metadata 读取、内容扫描和 EPUB 打包流程。
 */
export function registerGenerateEpubCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.generateEpub', async (uri?: vscode.Uri) => {
    try {
      const target = await resolveFolderTarget(uri)

      if (!await hasMetadataFile(target.fsPath)) {
        void vscode.window.showWarningMessage('当前目录缺少 `__t2e.data/metadata.yml`，请先执行“初始化 epub”。')
        return
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '生成 epub',
          cancellable: false,
        },
        async (progress) => {
          // 生成过程拆成几个明显阶段，便于在 VS Code 通知中给出可感知的进度反馈。
          progress.report({ message: '读取 metadata.yml' })
          const metadata = await readMetadata(target.fsPath)

          progress.report({ message: '扫描目录内容' })
          const content = await scanContentTree(target.fsPath)
          if (!content.files.length) {
            throw new Error('当前目录中没有可生成 EPUB 的 md/txt 文件。')
          }

          progress.report({ message: '解析输出目录' })
          const outputDir = await resolveOutputDir(target.fsPath)
          const outputFilePath = path.join(outputDir, formatBookFileName(metadata))

          progress.report({ message: '打包 EPUB 3' })
          return buildEpub({
            rootFolderPath: target.fsPath,
            metadata,
            nodes: content.nodes,
            outputFilePath,
          })
        },
      )

      void vscode.window.showInformationMessage(`EPUB 已生成：${result.outputFilePath}`)
    }
    catch (error) {
      void vscode.window.showErrorMessage(`生成 epub 失败：${toErrorMessage(error)}`)
    }
  })
}
