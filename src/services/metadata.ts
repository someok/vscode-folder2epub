import { promises as fs } from 'node:fs'

import YAML from 'yaml'

import { getMetadataFilePath } from './folderMatcher'
import { l10n } from './l10n'

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
 *
 * @param folderName 当前书籍目录名。
 * @param author 初始化时要写入的作者名。
 * @returns 默认 metadata 对象。
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
 *
 * @param folderPath 书籍根目录绝对路径。
 * @returns 解析后的 metadata 对象。
 */
export async function readMetadata(folderPath: string): Promise<EpubMetadata> {
  const rawText = await fs.readFile(getMetadataFilePath(folderPath), 'utf8')
  const rawValue = YAML.parse(rawText)

  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error(l10n.t('Invalid metadata.yml content.'))
  }

  const metadata = rawValue as Record<string, unknown>

  return {
    title: toStringValue(metadata.title, l10n.t('Unnamed')),
    titleSuffix: toStringValue(metadata.titleSuffix),
    author: toStringValue(metadata.author),
    description: toStringValue(metadata.description),
    cover: toStringValue(metadata.cover),
    version: toStringValue(metadata.version, '1.0.0'),
  }
}

/**
 * 将 metadata 对象序列化为 YAML 文本。
 *
 * @param metadata 待序列化的 metadata 对象。
 * @returns YAML 文本。
 */
export function stringifyMetadata(metadata: EpubMetadata): string {
  return YAML.stringify(metadata)
}

/**
 * 返回用于展示和文件命名的作者，缺失时回退为“佚名”。
 *
 * @param metadata 书籍 metadata。
 * @returns 规范化后的作者名。
 */
export function getBookAuthor(metadata: EpubMetadata): string {
  return metadata.author.trim() || l10n.t('Unknown')
}

/**
 * 返回用于展示的书名，缺失时回退为“未命名”。
 *
 * @param metadata 书籍 metadata。
 * @returns 规范化后的书名。
 */
export function getBookTitle(metadata: EpubMetadata): string {
  return metadata.title.trim() || '未命名'
}

/**
 * 组合主标题和副标题，生成书籍展示标题。
 *
 * @param metadata 书籍 metadata。
 * @returns 用于展示的完整标题。
 */
export function getBookDisplayTitle(metadata: EpubMetadata): string {
  const title = getBookTitle(metadata)
  const suffix = metadata.titleSuffix.trim()

  return suffix ? `${title}（${suffix}）` : title
}

/**
 * 基于 metadata 生成最终输出的 EPUB 文件名。
 *
 * @param metadata 书籍 metadata。
 * @returns 适合作为文件名的 EPUB 文件名。
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
 *
 * @param input 原始文件名。
 * @returns 清洗后的文件名。
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
 *
 * @param value 原始字段值。
 * @param fallback 字段无效时的回退值。
 * @returns 最终使用的字符串值。
 */
function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
