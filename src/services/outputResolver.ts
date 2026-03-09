import { promises as fs } from 'node:fs'
import path from 'node:path'

import YAML from 'yaml'

import { EPUB_CONFIG_FILENAME, exists } from './folderMatcher'

export async function resolveOutputDir(folderPath: string): Promise<string> {
  let currentDir = folderPath

  while (true) {
    const configPath = path.join(currentDir, EPUB_CONFIG_FILENAME)
    if (await exists(configPath)) {
      const configText = await fs.readFile(configPath, 'utf8')
      const configValue = YAML.parse(configText)

      if (configValue && typeof configValue === 'object') {
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
