import type { ContentFileNode, ContentNode, ContentScanResult } from './contentScanner'
import type { EpubMetadata } from './metadata'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { parseMarkdownFrontmatter } from '../utils/markdownUtils'
import { l10n } from './l10n'

export interface BuildMarkdownInput {
  metadata: EpubMetadata
  content: ContentScanResult
  outputFilePath: string
}

export interface BuildMarkdownResult {
  chapterCount: number
  outputFilePath: string
}

const MARKDOWN_IMAGE_PATTERN = /!\[.*?\]\(.*?\)/g
const HTML_IMAGE_TAG_PATTERN = /<img\b[^>]*>/gi

/**
 * 将扫描出的内容树合并为单个 Markdown 文件。
 *
 * @param input 构建所需的 metadata、内容树和输出路径。
 * @returns 输出文件路径和章节数量。
 */
export async function buildMarkdown(input: BuildMarkdownInput): Promise<BuildMarkdownResult> {
  const lines: string[] = []

  // 小说标题
  lines.push(`# ${input.metadata.title.trim() || 'Untitled'}`)
  lines.push('')

  // 作者行
  const author = input.metadata.author.trim()
  if (author) {
    lines.push(`> ${l10n.t('Author: {0}', author)}`)
    lines.push('')
  }

  const chapterCount = await processNodes(input.content.nodes, lines)

  const markdownText = lines.join('\n')
  await fs.mkdir(path.dirname(input.outputFilePath), { recursive: true })
  await fs.writeFile(input.outputFilePath, markdownText, 'utf8')

  return {
    chapterCount,
    outputFilePath: input.outputFilePath,
  }
}

/**
 * 递归处理内容树，文件夹输出分组标题，文件输出标题与内容。
 *
 * @param nodes 当前层级的内容节点。
 * @param lines 输出行的收集数组。
 * @param depth 当前目录深度（根目录为 0）。
 * @param hiddenFilePath 需要隐藏的文件路径（如作为目录入口的 index 文件）。
 * @returns 处理的文件数量。
 */
async function processNodes(
  nodes: ContentNode[],
  lines: string[],
  depth: number = 0,
  hiddenFilePath?: string,
): Promise<number> {
  let count = 0

  for (const node of nodes) {
    if (node.kind === 'file' && node.fsPath === hiddenFilePath) {
      continue
    }

    const headingLevel = Math.min(depth + 2, 6)
    const headingPrefix = '#'.repeat(headingLevel)

    if (node.kind === 'file') {
      const { title, body } = await readFileContent(node, headingLevel)
      lines.push(`${headingPrefix} ${title}`)
      lines.push('')
      if (body) {
        lines.push(body)
        lines.push('')
      }
      count += 1
      continue
    }

    // 文件夹节点输出分组标题
    lines.push(`${headingPrefix} ${node.displayName}`)
    lines.push('')

    // 若文件夹有 index 文件，将其内容放在分组标题下，不额外输出章节标题
    if (node.indexFile) {
      const { body } = await readFileContent(node.indexFile, headingLevel)
      if (body) {
        lines.push(body)
        lines.push('')
      }
    }

    count += await processNodes(node.children, lines, depth + 1, node.indexFile?.fsPath)
  }

  return count
}

/**
 * 读取单个文件内容，处理 frontmatter、过滤图片并按当前章节层级调整子标题层级。
 *
 * @param file 文件节点。
 * @param parentHeadingLevel 该文件在输出中的章节标题层级（index 文件使用所属文件夹的层级）。
 * @returns 章节标题和处理后的正文。
 */
async function readFileContent(
  file: ContentFileNode,
  parentHeadingLevel: number,
): Promise<{ title: string, body: string }> {
  const rawText = await fs.readFile(file.fsPath, 'utf8')
  let title = file.displayName
  let content = rawText

  if (file.extension === '.md') {
    const parsed = parseMarkdownFrontmatter(rawText)
    if (parsed.title) {
      title = parsed.title
    }
    content = parsed.content
  }

  // 过滤 Markdown 图片和 HTML img 标签
  content = content
    .replace(MARKDOWN_IMAGE_PATTERN, '')
    .replace(HTML_IMAGE_TAG_PATTERN, '')

  // 根据所属章节层级调整内容中的子标题层级，避免与外层标题冲突
  if (file.extension === '.md' && parentHeadingLevel > 0) {
    content = adjustMarkdownHeadings(content, parentHeadingLevel)
  }

  // 清理多余空行
  content = content.replace(/\n{3,}/g, '\n\n').trim()

  return { title, body: content }
}

/**
 * 调整 Markdown 内容中的标题层级，跳过 fenced code block 内的行。
 *
 * @param content 原始 Markdown 内容。
 * @param offset 每个标题需要增加的 `#` 数量。
 * @returns 调整后的内容。
 */
function adjustMarkdownHeadings(content: string, offset: number): string {
  let inCodeBlock = false
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock
        return line
      }
      if (inCodeBlock) {
        return line
      }
      const match = line.match(/^(#{1,6})(\s.*)$/)
      if (!match) {
        return line
      }
      const newLevel = Math.min(match[1].length + offset, 6)
      return '#'.repeat(newLevel) + match[2]
    })
    .join('\n')
}
