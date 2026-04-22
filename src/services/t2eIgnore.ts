import { promises as fs } from 'node:fs'
import path from 'node:path'
import ignore from 'ignore'

export const T2E_IGNORE_FILENAME = '.t2eignore'

/**
 * 读取指定目录下的 `.t2eignore` 文件内容，过滤空行与注释行。
 *
 * @param dirPath 目标目录绝对路径。
 * @returns 解析后的规则列表；若文件不存在则返回空数组。
 */
export async function readT2eIgnore(dirPath: string): Promise<string[]> {
  const filePath = path.join(dirPath, T2E_IGNORE_FILENAME)

  try {
    const content = await fs.readFile(filePath, 'utf8')
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
  }
  catch {
    return []
  }
}

export type IgnoreFilter = ReturnType<typeof ignore>

/**
 * 创建一个新的 ignore 过滤器；若提供父级过滤器，则继承其规则。
 *
 * @param parentFilter 可选的父级 ignore 过滤器。
 * @returns 新的 ignore 实例。
 */
export function createIgnoreFilter(parentFilter?: IgnoreFilter): IgnoreFilter {
  const instance = ignore()

  if (parentFilter) {
    instance.add(parentFilter)
  }

  return instance
}
