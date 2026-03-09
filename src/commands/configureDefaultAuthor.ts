import * as vscode from 'vscode'

import { getDefaultAuthor, setDefaultAuthor } from '../services/configuration'
import { toErrorMessage } from '../services/errorMessage'

export interface ConfigureDefaultAuthorResult {
  applied: boolean
  author: string
}

export function registerConfigureDefaultAuthorCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('folder2epub.configureDefaultAuthor', async () => {
    try {
      const currentAuthor = getDefaultAuthor()
      const inputValue = await vscode.window.showInputBox({
        title: '配置当前 Workspace 默认作者',
        prompt: '用于初始化当前 Workspace 下 __t2e.data/metadata.yml 中的 author。留空表示清除此配置。',
        placeHolder: '例如：鲁迅',
        value: currentAuthor,
        ignoreFocusOut: true,
      })

      if (inputValue === undefined) {
        return {
          applied: false,
          author: currentAuthor,
        } satisfies ConfigureDefaultAuthorResult
      }

      const author = inputValue.trim()
      await setDefaultAuthor(author)

      if (author) {
        void vscode.window.showInformationMessage(`已更新当前 Workspace 默认作者：${author}`)
      }
      else {
        void vscode.window.showInformationMessage('已清除当前 Workspace 默认作者配置。')
      }

      return {
        applied: true,
        author,
      } satisfies ConfigureDefaultAuthorResult
    }
    catch (error) {
      void vscode.window.showErrorMessage(`配置当前 Workspace 默认作者失败：${toErrorMessage(error)}`)
      return {
        applied: false,
        author: getDefaultAuthor(),
      } satisfies ConfigureDefaultAuthorResult
    }
  })
}
