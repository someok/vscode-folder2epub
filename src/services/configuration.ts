import * as vscode from 'vscode'

const CONFIGURATION_SECTION = 'folder2epub'
const DEFAULT_AUTHOR_KEY = 'defaultAuthor'

export function getDefaultAuthor(): string {
  const inspectedValue = vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .inspect<string>(DEFAULT_AUTHOR_KEY)

  return inspectedValue?.workspaceValue?.trim() ?? ''
}

export async function setDefaultAuthor(author: string): Promise<void> {
  if (!vscode.workspace.workspaceFile && !vscode.workspace.workspaceFolders?.length) {
    throw new Error('请先打开一个 Workspace，然后再配置默认作者。')
  }

  await vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .update(DEFAULT_AUTHOR_KEY, author.trim(), vscode.ConfigurationTarget.Workspace)
}
