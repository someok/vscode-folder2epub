import { promises as fs } from 'node:fs'
import path from 'node:path'

import YAML from 'yaml'

import { EPUB_CONFIG_FILENAME, exists } from './folderMatcher'

/**
 * 自当前目录向上查找 `__epub.yml`，解析最终输出目录。
 *
 * @param folderPath 当前书籍目录绝对路径。
 * @returns 解析后的输出目录绝对路径。
 */
export async function resolveOutputDir(folderPath: string): Promise<string> {
  let currentDir = folderPath

  while (true) {
    const configPath = path.join(currentDir, EPUB_CONFIG_FILENAME)
    if (await exists(configPath)) {
      const configText = await fs.readFile(configPath, 'utf8')
      const configValue = YAML.parse(configText)

      if (configValue && typeof configValue === 'object') {
        // `saveTo` 允许写相对路径，解析时始终以配置文件所在目录为基准。
        const saveTo = (configValue as Record<string, unknown>).saveTo
        if (typeof saveTo === 'string' && saveTo.trim()) {
          return path.isAbsolute(saveTo)
            ? saveTo
            : path.resolve(currentDir, saveTo)
        }
      }
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  return folderPath
}
