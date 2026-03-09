import { promises as fs } from 'node:fs'
import path from 'node:path'

import { METADATA_DIRNAME } from './folderMatcher'

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt'])

export interface ContentFileNode {
  displayName: string
  extension: '.md' | '.txt'
  fsPath: string
  kind: 'file'
  name: string
  order: number | null
  relativePath: string
}

export interface ContentFolderNode {
  children: ContentNode[]
  displayName: string
  firstFile: ContentFileNode
  fsPath: string
  kind: 'folder'
  name: string
  order: number | null
  relativePath: string
}

export type ContentNode = ContentFileNode | ContentFolderNode

export interface ContentScanResult {
  files: ContentFileNode[]
  nodes: ContentNode[]
}

interface ParsedName {
  displayName: string
  order: number | null
}

/**
 * 扫描书籍目录，生成既保留层级又便于线性遍历的内容树。
 */
export async function scanContentTree(rootFolderPath: string): Promise<ContentScanResult> {
  const nodes = await scanDirectory(rootFolderPath, '')

  return {
    nodes,
    files: flattenFiles(nodes),
  }
}

/**
 * 依据数字前缀优先、名称次之的规则排序节点。
 */
function compareNodes(left: ContentNode, right: ContentNode): number {
  if (left.order !== null && right.order !== null) {
    return left.order - right.order || compareByName(left, right)
  }

  if (left.order !== null) {
    return -1
  }

  if (right.order !== null) {
    return 1
  }

  return compareByName(left, right)
}

/**
 * 使用中文友好的自然排序比较节点名称。
 */
function compareByName(left: ContentNode, right: ContentNode): number {
  const nameCompare = left.displayName.localeCompare(right.displayName, 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base',
  })

  if (nameCompare !== 0) {
    return nameCompare
  }

  if (left.kind === right.kind) {
    return 0
  }

  return left.kind === 'folder' ? -1 : 1
}

/**
 * 取得某个目录节点下用于代表该目录的首个文件。
 */
function findFirstFile(nodes: ContentNode[]): ContentFileNode | undefined {
  const firstNode = nodes[0]
  if (!firstNode) {
    return undefined
  }

  return firstNode.kind === 'file' ? firstNode : firstNode.firstFile
}

/**
 * 将树状节点拍平成文件列表，供后续章节线性编号使用。
 */
function flattenFiles(nodes: ContentNode[]): ContentFileNode[] {
  const files: ContentFileNode[] = []

  for (const node of nodes) {
    if (node.kind === 'file') {
      files.push(node)
      continue
    }

    files.push(...flattenFiles(node.children))
  }

  return files
}

/**
 * 解析类似 `001_序章.md` 的数字前缀排序信息。
 */
function parseOrderedName(name: string, isFile: boolean): ParsedName {
  const extension = isFile ? path.extname(name) : ''
  const rawName = isFile ? path.basename(name, extension) : name
  let cursor = 0

  // 先读出最前面的连续数字，只有紧跟下划线时才视为有效排序前缀。
  while (cursor < rawName.length && isDigit(rawName.charCodeAt(cursor))) {
    cursor += 1
  }

  if (cursor === 0 || cursor >= rawName.length || rawName[cursor] !== '_') {
    return {
      displayName: rawName.trim() || rawName,
      order: null,
    }
  }

  let nameStart = cursor
  while (nameStart < rawName.length && rawName[nameStart] === '_') {
    nameStart += 1
  }

  if (nameStart >= rawName.length) {
    return {
      displayName: rawName.trim() || rawName,
      order: null,
    }
  }

  return {
    displayName: rawName.slice(nameStart).trim() || rawName,
    order: Number.parseInt(rawName.slice(0, cursor), 10),
  }
}

/**
 * 递归扫描目录，忽略 `__t2e.data` 和非 md/txt 文件。
 */
async function scanDirectory(dirPath: string, relativePath: string): Promise<ContentNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: ContentNode[] = []

  for (const entry of entries) {
    if (entry.name === METADATA_DIRNAME) {
      continue
    }

    const entryPath = path.join(dirPath, entry.name)
    const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name

    if (entry.isDirectory()) {
      // 空目录不会进入结果，只有至少包含一个可用文件时才保留该目录节点。
      const children = await scanDirectory(entryPath, entryRelativePath)
      const firstFile = findFirstFile(children)
      if (!firstFile) {
        continue
      }

      const ordered = parseOrderedName(entry.name, false)
      nodes.push({
        kind: 'folder',
        name: entry.name,
        displayName: ordered.displayName,
        order: ordered.order,
        fsPath: entryPath,
        relativePath: entryRelativePath,
        children,
        firstFile,
      })
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue
    }

    const ordered = parseOrderedName(entry.name, true)
    nodes.push({
      kind: 'file',
      name: entry.name,
      displayName: ordered.displayName,
      order: ordered.order,
      fsPath: entryPath,
      relativePath: entryRelativePath,
      extension: extension as '.md' | '.txt',
    })
  }

  return nodes.sort(compareNodes)
}

/**
 * 判断字符编码是否为十进制数字。
 */
function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}
