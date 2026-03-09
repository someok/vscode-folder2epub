import { promises as fs } from 'node:fs'

import YAML from 'yaml'

import { getMetadataFilePath } from './folderMatcher'

export interface EpubMetadata {
  author: string
  cover: string
  description: string
  title: string
  titleSuffix: string
  version: string
}

export function createDefaultMetadata(folderName: string, author: string): EpubMetadata {
  return {
    title: folderName,
    titleSuffix: '',
    author,
    description: '',
    cover: 'cover.jpg',
    version: '1.0.0',
  }
}

export async function readMetadata(folderPath: string): Promise<EpubMetadata> {
  const rawText = await fs.readFile(getMetadataFilePath(folderPath), 'utf8')
  const rawValue = YAML.parse(rawText)

  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error('metadata.yml 内容无效。')
  }

  const metadata = rawValue as Record<string, unknown>

  return {
    title: toStringValue(metadata.title, '未命名'),
    titleSuffix: toStringValue(metadata.titleSuffix),
    author: toStringValue(metadata.author),
    description: toStringValue(metadata.description),
    cover: toStringValue(metadata.cover),
    version: toStringValue(metadata.version, '1.0.0'),
  }
}

export function stringifyMetadata(metadata: EpubMetadata): string {
  return YAML.stringify(metadata)
}

export function getBookAuthor(metadata: EpubMetadata): string {
  return metadata.author.trim() || '佚名'
}

export function getBookTitle(metadata: EpubMetadata): string {
  return metadata.title.trim() || '未命名'
}

export function getBookDisplayTitle(metadata: EpubMetadata): string {
  const title = getBookTitle(metadata)
  const suffix = metadata.titleSuffix.trim()

  return suffix ? `${title}（${suffix}）` : title
}

export function formatBookFileName(metadata: EpubMetadata): string {
  const title = getBookTitle(metadata)
  const suffix = metadata.titleSuffix.trim()
  const suffixText = suffix ? `（${suffix}）` : ''
  const author = getBookAuthor(metadata)

  return sanitizeFileName(`《${title}》${suffixText}作者_${author}.epub`)
}

function sanitizeFileName(input: string): string {
  let sanitized = ''

  for (const character of input) {
    const code = character.charCodeAt(0)
    if (code >= 0 && code <= 31) {
      sanitized += '_'
      continue
    }

    if ('<>:"/\\|?*'.includes(character)) {
      sanitized += '_'
      continue
    }

    sanitized += character
  }

  sanitized = sanitized.trim()
  return sanitized || 'book.epub'
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
