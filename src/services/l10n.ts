import * as vscode from 'vscode'

/**
 * VS Code 本地化对象，供业务代码直接调用 l10n.t()。
 *
 * 注意：vscode.l10n.t 的第一个参数必须是默认英文消息文本（而非自定义 key），
 * 否则静态提取工具和运行时回退都无法正确工作。
 */
export const l10n = vscode.l10n
