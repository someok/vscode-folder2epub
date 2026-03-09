import * as vscode from 'vscode'

const CONFIGURATION_SECTION = 'folder2epub'
const DEFAULT_AUTHOR_KEY = 'defaultAuthor'

export interface ConfigureDefaultAuthorResult {
  applied: boolean
  author: string
}

/**
 * 读取当前 Workspace 级别保存的默认作者。
 */
export function getDefaultAuthor(): string {
  const inspectedValue = vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .inspect<string>(DEFAULT_AUTHOR_KEY)

  return inspectedValue?.workspaceValue?.trim() ?? ''
}

/**
 * 将默认作者写入当前 Workspace 配置。
 */
export async function setDefaultAuthor(author: string): Promise<void> {
  if (!vscode.workspace.workspaceFile && !vscode.workspace.workspaceFolders?.length) {
    throw new Error('请先打开一个 Workspace，然后再配置默认作者。')
  }

  await vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .update(DEFAULT_AUTHOR_KEY, author.trim(), vscode.ConfigurationTarget.Workspace)
}

/**
 * 弹出输入框交互式配置默认作者，并返回本次配置结果。
 */
export async function configureDefaultAuthorInteractively(): Promise<ConfigureDefaultAuthorResult> {
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
    }
  }

  const author = inputValue.trim()
  await setDefaultAuthor(author)

  // 这里顺手返回最新值，便于调用方直接继续初始化流程而无需再次读取配置。
  if (author) {
    void vscode.window.showInformationMessage(`已更新当前 Workspace 默认作者：${author}`)
  }
  else {
    void vscode.window.showInformationMessage('已清除当前 Workspace 默认作者配置。')
  }

  return {
    applied: true,
    author,
  }
}
