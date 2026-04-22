import { l10n } from 'vscode'

/**
 * 获取本地化消息文本。
 *
 * @param key 消息键名，对应 l10n/bundle.l10n*.json 中的 key。
 * @param args 模板参数，支持 {0}、{1} 等占位符替换。
 * @returns 本地化后的文本。
 */
export function msg(key: string, ...args: any[]): string {
  return l10n.t(key, ...args)
}
