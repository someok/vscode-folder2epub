import type { Uri } from 'vscode'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const METADATA_DIRNAME = '__t2e.data'
export const METADATA_FILENAME = 'metadata.yml'
export const EPUB_CONFIG_FILENAME = '__epub.yml'

export interface FolderTarget {
  fsPath: string
  name: string
  uri: Uri
}

/**
 * 校验命令触发对象是否为资源管理器中的本地目录，并返回统一结构。
 */
export async function resolveFolderTarget(uri?: Uri): Promise<FolderTarget> {
  if (!uri || uri.scheme !== 'file') {
    throw new Error('请在资源管理器中对本地目录执行此命令。')
  }

  const stat = await fs.stat(uri.fsPath).catch(() => undefined)
  if (!stat?.isDirectory()) {
    throw new Error('当前选中的资源不是目录。')
  }

  return {
    fsPath: uri.fsPath,
    name: path.basename(uri.fsPath),
    uri,
  }
}

/**
 * 计算目录下 `__t2e.data` 的绝对路径。
 */
export function getMetadataDirPath(folderPath: string): string {
  return path.join(folderPath, METADATA_DIRNAME)
}

/**
 * 计算目录下 `metadata.yml` 的绝对路径。
 */
export function getMetadataFilePath(folderPath: string): string {
  return path.join(getMetadataDirPath(folderPath), METADATA_FILENAME)
}

/**
 * 判断某个路径当前是否可访问。
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

/**
 * 判断目标目录是否已经初始化过 `metadata.yml`。
 */
export async function hasMetadataFile(folderPath: string): Promise<boolean> {
  return exists(getMetadataFilePath(folderPath))
}
