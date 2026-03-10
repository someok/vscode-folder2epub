import { promises as fs } from 'node:fs'
import os from 'node:os'
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
      const saveTo = readSaveTo(configText)

      if (saveTo) {
        // `saveTo` 允许写相对路径，解析时始终以配置文件所在目录为基准。
        const resolvedSaveTo = expandHomeDir(saveTo)
        return path.isAbsolute(resolvedSaveTo)
          ? resolvedSaveTo
          : path.resolve(currentDir, resolvedSaveTo)
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

/**
 * 从 `__epub.yml` 文本中读取 `saveTo` 配置，兼容 bare `~` 被 YAML 识别为 `null` 的情况。
 *
 * @param configText 配置文件原始文本。
 * @returns 规范化后的 `saveTo` 原始值；无有效配置时返回 `undefined`。
 */
function readSaveTo(configText: string): string | undefined {
  const document = YAML.parseDocument(configText)
  const configValue = document.toJS()
  if (configValue && typeof configValue === 'object') {
    const saveTo = (configValue as Record<string, unknown>).saveTo
    if (typeof saveTo === 'string' && saveTo.trim()) {
      return saveTo
    }
  }

  const saveToNode = document.get('saveTo', true)
  if (
    saveToNode
    && typeof saveToNode === 'object'
    && 'source' in saveToNode
    && saveToNode.source === '~'
  ) {
    return '~'
  }

  return undefined
}

/**
 * 将 `~` 或 `~/...` 形式的路径展开为当前用户目录。
 *
 * @param input `__epub.yml` 中配置的原始路径。
 * @returns 展开后的路径；若不匹配 `~` 规则则原样返回。
 */
function expandHomeDir(input: string): string {
  if (input === '~') {
    return os.homedir()
  }

  if (!input.startsWith('~/') && !input.startsWith('~\\')) {
    return input
  }

  return path.resolve(os.homedir(), `.${input.slice(1)}`)
}
