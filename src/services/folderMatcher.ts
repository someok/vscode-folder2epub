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

export function getMetadataDirPath(folderPath: string): string {
  return path.join(folderPath, METADATA_DIRNAME)
}

export function getMetadataFilePath(folderPath: string): string {
  return path.join(getMetadataDirPath(folderPath), METADATA_FILENAME)
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

export async function hasMetadataFile(folderPath: string): Promise<boolean> {
  return exists(getMetadataFilePath(folderPath))
}
