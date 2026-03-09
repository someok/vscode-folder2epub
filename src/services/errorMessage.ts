export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '发生未知错误。'
}
