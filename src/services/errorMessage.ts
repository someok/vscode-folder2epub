/**
 * 将未知错误统一转换成可展示给用户的消息文本。
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '发生未知错误。'
}
