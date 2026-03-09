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

export async function scanContentTree(rootFolderPath: string): Promise<ContentScanResult> {
  const nodes = await scanDirectory(rootFolderPath, '')

  return {
    nodes,
    files: flattenFiles(nodes),
  }
}

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

function findFirstFile(nodes: ContentNode[]): ContentFileNode | undefined {
  const firstNode = nodes[0]
  if (!firstNode) {
    return undefined
  }

  return firstNode.kind === 'file' ? firstNode : firstNode.firstFile
}

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

function parseOrderedName(name: string, isFile: boolean): ParsedName {
  const extension = isFile ? path.extname(name) : ''
  const rawName = isFile ? path.basename(name, extension) : name
  let cursor = 0

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

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}
