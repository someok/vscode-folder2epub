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

/**
 * 生成初始化时写入磁盘的默认 metadata 模板。
 */
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

/**
 * 读取并解析目录下的 `metadata.yml`。
 */
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

/**
 * 将 metadata 对象序列化为 YAML 文本。
 */
export function stringifyMetadata(metadata: EpubMetadata): string {
  return YAML.stringify(metadata)
}

/**
 * 返回用于展示和文件命名的作者，缺失时回退为“佚名”。
 */
export function getBookAuthor(metadata: EpubMetadata): string {
  return metadata.author.trim() || '佚名'
}

/**
 * 返回用于展示的书名，缺失时回退为“未命名”。
 */
export function getBookTitle(metadata: EpubMetadata): string {
  return metadata.title.trim() || '未命名'
}

/**
 * 组合主标题和副标题，生成书籍展示标题。
 */
export function getBookDisplayTitle(metadata: EpubMetadata): string {
  const title = getBookTitle(metadata)
  const suffix = metadata.titleSuffix.trim()

  return suffix ? `${title}（${suffix}）` : title
}

/**
 * 基于 metadata 生成最终输出的 EPUB 文件名。
 */
export function formatBookFileName(metadata: EpubMetadata): string {
  const title = getBookTitle(metadata)
  const suffix = metadata.titleSuffix.trim()
  const suffixText = suffix ? `（${suffix}）` : ''
  const author = getBookAuthor(metadata)

  return sanitizeFileName(`《${title}》${suffixText}作者_${author}.epub`)
}

/**
 * 清洗文件系统不允许的字符，避免输出文件名非法。
 */
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

/**
 * 将未知类型的 metadata 字段收敛为字符串。
 */
function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
