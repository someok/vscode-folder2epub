import * as vscode from 'vscode'

import { msg } from './l10n'

const CONFIGURATION_SECTION = 'folder2epub'
const DEFAULT_AUTHOR_KEY = 'defaultAuthor'

export interface ConfigureDefaultAuthorResult {
  applied: boolean
  author: string
}

/**
 * 读取当前 Workspace 级别保存的默认作者。
 *
 * @returns 当前 Workspace 中保存的默认作者；未配置时返回空字符串。
 */
export function getDefaultAuthor(): string {
  const inspectedValue = vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .inspect<string>(DEFAULT_AUTHOR_KEY)

  return inspectedValue?.workspaceValue?.trim() ?? ''
}

/**
 * 将默认作者写入当前 Workspace 配置。
 *
 * @param author 要保存的作者名；会在写入前执行 `trim`。
 * @returns 写入完成后返回的 Promise。
 */
export async function setDefaultAuthor(author: string): Promise<void> {
  if (!vscode.workspace.workspaceFile && !vscode.workspace.workspaceFolders?.length) {
    throw new Error(msg('error.noWorkspace'))
  }

  await vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .update(DEFAULT_AUTHOR_KEY, author.trim(), vscode.ConfigurationTarget.Workspace)
}

/**
 * 弹出输入框交互式配置默认作者，并返回本次配置结果。
 *
 * @returns 包含是否应用配置以及最终作者值的结果对象。
 */
export async function configureDefaultAuthorInteractively(): Promise<ConfigureDefaultAuthorResult> {
  const currentAuthor = getDefaultAuthor()
  const inputValue = await vscode.window.showInputBox({
    title: msg('ui.inputBox.authorTitle'),
    prompt: msg('ui.inputBox.authorPrompt'),
    placeHolder: msg('ui.inputBox.authorPlaceholder'),
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
    void vscode.window.showInformationMessage(msg('command.configureDefaultAuthor.updated', author))
  }
  else {
    void vscode.window.showInformationMessage(msg('command.configureDefaultAuthor.cleared'))
  }

  return {
    applied: true,
    author,
  }
}
