import type { ContentFileNode, ContentNode } from './contentScanner'
import type { EpubMetadata } from './metadata'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { parseMarkdownFrontmatter } from '../utils/markdownUtils'

export interface BuildMarkdownInput {
  metadata: EpubMetadata
  nodes: ContentNode[]
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
  const chapters = collectChapters(input.nodes)
  const lines: string[] = []

  // 小说标题
  lines.push(`# ${input.metadata.title.trim() || 'Untitled'}`)
  lines.push('')

  for (const { file, depth } of chapters) {
    const rawText = await fs.readFile(file.fsPath, 'utf8')
    const headingLevel = Math.min(depth + 2, 6)
    const headingPrefix = '#'.repeat(headingLevel)
    let chapterTitle = file.displayName
    let content = rawText

    if (file.extension === '.md') {
      const parsed = parseMarkdownFrontmatter(rawText)
      if (parsed.title) {
        chapterTitle = parsed.title
      }
      content = parsed.content
    }

    // 过滤 Markdown 图片和 HTML img 标签
    content = content
      .replace(MARKDOWN_IMAGE_PATTERN, '')
      .replace(HTML_IMAGE_TAG_PATTERN, '')

    // 清理多余空行
    content = content.replace(/\n{3,}/g, '\n\n').trim()

    lines.push(`${headingPrefix} ${chapterTitle}`)
    lines.push('')
    if (content) {
      lines.push(content)
      lines.push('')
    }
  }

  const markdownText = lines.join('\n')
  await fs.mkdir(path.dirname(input.outputFilePath), { recursive: true })
  await fs.writeFile(input.outputFilePath, markdownText, 'utf8')

  return {
    chapterCount: chapters.length,
    outputFilePath: input.outputFilePath,
  }
}

/**
 * 带深度遍历内容树，收集所有文件节点。
 */
function* walkNodes(nodes: ContentNode[], depth: number = 0): Generator<{ file: ContentFileNode, depth: number }> {
  for (const node of nodes) {
    if (node.kind === 'file') {
      yield { file: node, depth }
      continue
    }
    yield* walkNodes(node.children, depth + 1)
  }
}

function collectChapters(nodes: ContentNode[]): { file: ContentFileNode, depth: number }[] {
  return Array.from(walkNodes(nodes))
}
