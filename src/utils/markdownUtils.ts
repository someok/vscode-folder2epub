import YAML from 'yaml'

const FRONTMATTER_PATTERN = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/

/**
 * 解析 Markdown 文件开头的 YAML frontmatter，提取 title 并返回清除 frontmatter 后的内容。
 *
 * @param rawText Markdown 原始文本。
 * @returns 提取的 title（若存在）和清除 frontmatter 后的内容。
 */
export function parseMarkdownFrontmatter(rawText: string): { title?: string, content: string } {
  const match = rawText.match(FRONTMATTER_PATTERN)
  if (!match) {
    return { content: rawText }
  }

  try {
    const frontmatter = YAML.parse(match[1])
    const title = typeof frontmatter?.title === 'string' ? frontmatter.title.trim() : undefined
    return { title, content: rawText.slice(match[0].length) }
  }
  catch {
    return { content: rawText }
  }
}
