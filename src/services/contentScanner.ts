import type { IgnoreFilter } from './t2eIgnore'
import { promises as fs } from 'node:fs'

import path from 'node:path'
import { METADATA_DIRNAME } from './folderMatcher'
import { createIgnoreFilter, readT2eIgnore } from './t2eIgnore'

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt'])

export interface ContentFileNode {
  displayName: string
  extension: '.md' | '.txt'
  fsPath: string
  isIndexFile: boolean
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
  indexFile?: ContentFileNode
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
 *
 * @param rootFolderPath 书籍根目录绝对路径。
 * @returns 包含树状节点和线性文件列表的扫描结果。
 */
export async function scanContentTree(rootFolderPath: string): Promise<ContentScanResult> {
  const nodes = await scanDirectory(rootFolderPath, '', createIgnoreFilter())

  return {
    nodes,
    files: flattenFiles(nodes),
  }
}

/**
 * 依据数字前缀优先、名称次之的规则排序节点。
 *
 * @param left 左侧节点。
 * @param right 右侧节点。
 * @returns 排序比较结果。
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
 *
 * @param left 左侧节点。
 * @param right 右侧节点。
 * @returns 排序比较结果。
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
 * 优先查找当前目录直接包含的 `index` 文件。
 *
 * @param nodes 目录节点的直接子节点列表。
 * @returns 当前目录下排序最靠前的 `index` 文件；若不存在则返回 `undefined`。
 */
function findDirectIndexFile(nodes: ContentNode[]): ContentFileNode | undefined {
  return nodes.find((node): node is ContentFileNode => node.kind === 'file' && node.isIndexFile)
}

/**
 * 在当前目录及其子目录中查找可用于目录跳转的 `index` 文件。
 *
 * @param nodes 目录节点的直接子节点列表。
 * @returns 找到的首个 `index` 文件；若不存在则返回 `undefined`。
 */
function findIndexFile(nodes: ContentNode[]): ContentFileNode | undefined {
  const directIndexFile = findDirectIndexFile(nodes)
  if (directIndexFile) {
    return directIndexFile
  }

  for (const node of nodes) {
    if (node.kind !== 'folder') {
      continue
    }

    const nestedIndexFile = findIndexFile(node.children)
    if (nestedIndexFile) {
      return nestedIndexFile
    }
  }

  return undefined
}

/**
 * 取得某个目录节点下用于代表该目录的目标文件：若存在 `index` 文件则优先使用，否则回退到原有首个文件规则。
 *
 * @param nodes 目录节点的直接子节点列表。
 * @returns 目录下用于跳转的目标文件；若不存在则返回 `undefined`。
 */
function findFirstFile(nodes: ContentNode[]): ContentFileNode | undefined {
  const indexFile = findIndexFile(nodes)
  if (indexFile) {
    return indexFile
  }

  const firstNode = nodes[0]
  if (!firstNode) {
    return undefined
  }

  return firstNode.kind === 'file' ? firstNode : firstNode.firstFile
}

/**
 * 将树状节点拍平成文件列表，供后续章节线性编号使用。
 *
 * @param nodes 树状内容节点。
 * @returns 线性文件列表。
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
 *
 * @param name 原始文件名或目录名。
 * @param isFile 当前名称是否来自文件。
 * @returns 解析出的展示名和排序序号。
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
    // 特殊处理形如 __xxx 的名称，也就是可能有一个或多个连续下划线开头的情况，视作 displayName 为 xxx，order 为 0
    if (cursor === 0 && rawName.length > 1 && rawName[0] === '_') {
      let nameStart = 0
      while (nameStart < rawName.length && rawName[nameStart] === '_') {
        nameStart += 1
      }
      if (nameStart < rawName.length) {
        return {
          displayName: rawName.slice(nameStart).trim() || rawName,
          order: 0,
        }
      }
    }

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
 * 判断去除数字前缀后的名称是否为目录索引名 `index`。
 *
 * @param displayName 去除排序前缀后的展示名。
 * @returns 若名称为 `index` 则返回 `true`。
 */
function isIndexDisplayName(displayName: string): boolean {
  return displayName.trim().toLowerCase() === 'index'
}

/**
 * 递归扫描目录，忽略 `__t2e.data` 和非 md/txt 文件。
 *
 * @param dirPath 当前扫描目录绝对路径。
 * @param relativePath 相对于书籍根目录的相对路径。
 * @param ignoreFilter 忽略过滤器。
 * @returns 当前目录下的有效内容节点。
 */
async function scanDirectory(dirPath: string, relativePath: string, ignoreFilter: IgnoreFilter): Promise<ContentNode[]> {
  // 读取当前目录的 .t2eignore 规则并合并到过滤器
  const localRules = await readT2eIgnore(dirPath)
  if (localRules.length > 0) {
    ignoreFilter.add(localRules)
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: ContentNode[] = []

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name)
    const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name

    // __t2e.data 最高优先级硬过滤，不受 .t2eignore 影响
    if (entry.name === METADATA_DIRNAME) {
      continue
    }

    // .t2eignore 过滤
    if (ignoreFilter.ignores(entryRelativePath)) {
      continue
    }

    if (entry.isDirectory()) {
      // 空目录不会进入结果，只有至少包含一个可用文件时才保留该目录节点。
      const children = await scanDirectory(entryPath, entryRelativePath, ignoreFilter)
      const indexFile = findDirectIndexFile(children)
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
        indexFile,
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
      isIndexFile: isIndexDisplayName(ordered.displayName),
    })
  }

  return nodes.sort(compareNodes)
}

/**
 * 判断字符编码是否为十进制数字。
 *
 * @param code 单个字符的 charCode。
 * @returns 若为数字字符则返回 `true`。
 */
function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}
