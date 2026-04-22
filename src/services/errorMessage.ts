/**
 * 将未知错误统一转换成可展示给用户的消息文本。
 *
 * @param error 任意来源的错误对象或值。
 * @returns 可直接显示在 UI 上的错误文本。
 */
import { l10n } from './l10n'

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return l10n.t('An unknown error occurred.')
}
