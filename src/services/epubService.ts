import type { Buffer } from 'node:buffer'
import type { ContentFileNode, ContentNode } from './contentScanner'
import type { EpubMetadata } from './metadata'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import JSZip from 'jszip'
import MarkdownIt from 'markdown-it'

import { exists, METADATA_DIRNAME } from './folderMatcher'
import { getBookAuthor, getBookDisplayTitle } from './metadata'

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`

const MAIN_CSS = `html,
body {
  margin: 0;
  padding: 0;
}

body {
  line-height: 1.8;
  color: #222;
  background: #fff;
  padding: 0 1.25rem 2rem;
}

.chapter {
  max-width: 44rem;
  margin: 0 auto;
}

.chapter h1 {
  font-size: 1.6rem;
  margin: 2rem 0 1.5rem;
}

.chapter p {
  margin: 0 0 1em;
  text-indent: 2em;
}

.chapter img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.5rem auto;
}

.chapter pre,
.chapter code {
  white-space: pre-wrap;
}
`

const HTML_IMAGE_TAG_PATTERN = /<img\b[^>]*>/gi
const HTML_IMAGE_SOURCE_PATTERN = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i

interface BuildEpubInput {
  metadata: EpubMetadata
  nodes: ContentNode[]
  outputFilePath: string
  rootFolderPath: string
}

interface BuildEpubResult {
  chapterCount: number
  outputFilePath: string
}

interface Chapter {
  href: string
  id: string
  sourcePath: string
  title: string
  xhtml: string
}

interface CreateChaptersResult {
  chapters: Chapter[]
  contentImages: EpubAsset[]
}

interface EpubAsset {
  buffer: Buffer
  href: string
  id: string
  mediaType: string
  sourcePath: string
}

interface NavEntry {
  children: NavEntry[]
  href: string
  title: string
}

type CoverAsset = EpubAsset

export async function buildEpub(input: BuildEpubInput): Promise<BuildEpubResult> {
  const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    xhtmlOut: true,
  })

  const { chapters, contentImages } = await createChapters(input.nodes, markdown, input.rootFolderPath)
  if (!chapters.length) {
    throw new Error('目录中没有可生成 EPUB 的 md/txt 文件。')
  }

  const chapterMap = new Map(chapters.map(chapter => [chapter.sourcePath, chapter] as const))
  const navEntries = buildNavEntries(input.nodes, chapterMap)
  const cover = await loadCoverAsset(input.rootFolderPath, input.metadata.cover)
  const identifier = `urn:uuid:${randomUUID()}`
  const modifiedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.folder('META-INF')?.file('container.xml', CONTAINER_XML)

  const oebps = zip.folder('OEBPS')
  if (!oebps) {
    throw new Error('创建 EPUB 目录结构失败。')
  }

  oebps.file('content.opf', createContentOpf(input.metadata, chapters, cover, contentImages, identifier, modifiedAt))
  oebps.file('nav.xhtml', createNavXhtml(input.metadata, navEntries))
  oebps.file('toc.ncx', createTocNcx(input.metadata, navEntries, identifier))
  oebps.folder('styles')?.file('main.css', MAIN_CSS)

  const textFolder = oebps.folder('text')
  if (!textFolder) {
    throw new Error('创建 EPUB 文本目录失败。')
  }

  for (const chapter of chapters) {
    textFolder.file(path.posix.basename(chapter.href), chapter.xhtml)
  }

  if (cover) {
    oebps.file(cover.href, cover.buffer)
  }

  for (const asset of contentImages) {
    oebps.file(asset.href, asset.buffer)
  }

  await fs.mkdir(path.dirname(input.outputFilePath), { recursive: true })
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/epub+zip',
  })

  await fs.writeFile(input.outputFilePath, buffer)

  return {
    chapterCount: chapters.length,
    outputFilePath: input.outputFilePath,
  }
}

function buildNavEntries(nodes: ContentNode[], chapterMap: Map<string, Chapter>): NavEntry[] {
  return nodes.map((node) => {
    if (node.kind === 'file') {
      const chapter = chapterMap.get(node.fsPath)
      if (!chapter) {
        throw new Error(`缺少章节映射：${node.relativePath}`)
      }

      return {
        title: node.displayName,
        href: chapter.href,
        children: [],
      }
    }

    const firstChapter = chapterMap.get(node.firstFile.fsPath)
    if (!firstChapter) {
      throw new Error(`缺少目录章节映射：${node.relativePath}`)
    }

    return {
      title: node.displayName,
      href: firstChapter.href,
      children: buildNavEntries(node.children, chapterMap),
    }
  })
}

function createChapterDocument(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="../styles/main.css" />
  </head>
  <body>
    <article class="chapter">
      <h1>${escapeXml(title)}</h1>
      ${bodyHtml}
    </article>
  </body>
</html>
`
}

function createContentOpf(
  metadata: EpubMetadata,
  chapters: Chapter[],
  cover: CoverAsset | undefined,
  contentImages: EpubAsset[],
  identifier: string,
  modifiedAt: string,
): string {
  const title = getBookDisplayTitle(metadata)
  const author = getBookAuthor(metadata)
  const description = metadata.description.trim()

  const manifestLines = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />',
    '<item id="main-css" href="styles/main.css" media-type="text/css" />',
    ...chapters.map(chapter => `<item id="${chapter.id}" href="${chapter.href}" media-type="application/xhtml+xml" />`),
    ...contentImages.map(asset => `<item id="${asset.id}" href="${asset.href}" media-type="${asset.mediaType}" />`),
  ]

  if (cover) {
    manifestLines.push(`<item id="${cover.id}" href="${cover.href}" media-type="${cover.mediaType}" properties="cover-image" />`)
  }

  const spineLines = chapters.map(chapter => `<itemref idref="${chapter.id}" />`)
  const descriptionXml = description ? `    <dc:description>${escapeXml(description)}</dc:description>\n` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
${descriptionXml}    <meta property="dcterms:modified">${modifiedAt}</meta>
  </metadata>
  <manifest>
    ${manifestLines.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineLines.join('\n    ')}
  </spine>
</package>
`
}

function createNavList(entries: NavEntry[]): string {
  return entries.map((entry) => {
    const children = entry.children.length ? `\n        <ol>\n${indentLines(createNavList(entry.children), 10)}\n        </ol>` : ''
    return `      <li><a href="${escapeXml(entry.href)}">${escapeXml(entry.title)}</a>${children}</li>`
  }).join('\n')
}

function createNavXhtml(metadata: EpubMetadata, navEntries: NavEntry[]): string {
  const title = getBookDisplayTitle(metadata)
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeXml(title)} - 目录</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>目录</h1>
      <ol>
${createNavList(navEntries)}
      </ol>
    </nav>
  </body>
</html>
`
}

function createTocNcx(metadata: EpubMetadata, navEntries: NavEntry[], identifier: string): string {
  const title = getBookDisplayTitle(metadata)
  const author = getBookAuthor(metadata)
  let playOrder = 1

  const navMap = createNcxPoints(navEntries, () => playOrder++)

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}" />
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <docAuthor>
    <text>${escapeXml(author)}</text>
  </docAuthor>
  <navMap>
${navMap}
  </navMap>
</ncx>
`
}

function createNcxPoints(entries: NavEntry[], nextPlayOrder: () => number, depth = 2): string {
  return entries.map((entry) => {
    const currentOrder = nextPlayOrder()
    const children = entry.children.length
      ? `\n${createNcxPoints(entry.children, nextPlayOrder, depth + 1)}\n${'  '.repeat(depth)}`
      : ''

    return `${'  '.repeat(depth)}<navPoint id="nav-${currentOrder}" playOrder="${currentOrder}">
${'  '.repeat(depth + 1)}<navLabel><text>${escapeXml(entry.title)}</text></navLabel>
${'  '.repeat(depth + 1)}<content src="${escapeXml(entry.href)}" />${children}</navPoint>`
  }).join('\n')
}

async function createChapters(
  nodes: ContentNode[],
  markdown: MarkdownIt,
  rootFolderPath: string,
): Promise<CreateChaptersResult> {
  const files = flattenFiles(nodes)
  const chapters: Chapter[] = []
  const contentImagesBySourcePath = new Map<string, EpubAsset>()
  let contentImageIndex = 0

  for (const [index, file] of files.entries()) {
    const rawText = await fs.readFile(file.fsPath, 'utf8')
    let bodyHtml: string

    if (file.extension === '.md') {
      bodyHtml = await renderMarkdownChapter(
        file,
        rawText,
        markdown,
        rootFolderPath,
        contentImagesBySourcePath,
        () => {
          contentImageIndex += 1
          return contentImageIndex
        },
      )
    }
    else {
      bodyHtml = renderPlainText(rawText)
    }

    const order = String(index + 1).padStart(4, '0')
    chapters.push({
      id: `chapter-${order}`,
      href: `text/chapter-${order}.xhtml`,
      sourcePath: file.fsPath,
      title: file.displayName,
      xhtml: createChapterDocument(file.displayName, bodyHtml),
    })
  }

  return {
    chapters,
    contentImages: [...contentImagesBySourcePath.values()],
  }
}

function escapeXml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
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

function indentLines(text: string, spaces: number): string {
  const indentation = ' '.repeat(spaces)
  return text
    .split('\n')
    .map(line => `${indentation}${line}`)
    .join('\n')
}

async function loadCoverAsset(rootFolderPath: string, configuredCover: string): Promise<CoverAsset | undefined> {
  const coverName = configuredCover.trim()
  if (!coverName) {
    return undefined
  }

  const coverPath = path.join(rootFolderPath, METADATA_DIRNAME, coverName)
  if (!await exists(coverPath)) {
    throw new Error(`封面文件不存在：__t2e.data/${coverName}`)
  }

  const stat = await fs.stat(coverPath)
  if (!stat.isFile()) {
    throw new Error(`封面路径不是文件：__t2e.data/${coverName}`)
  }

  const extension = path.extname(coverPath).toLowerCase()
  const mediaType = getMediaType(extension)
  if (!mediaType) {
    throw new Error(`封面格式不支持：${coverName}`)
  }

  return {
    href: `images/${path.basename(coverPath)}`,
    id: 'cover-image',
    mediaType,
    sourcePath: coverPath,
    buffer: await fs.readFile(coverPath),
  }
}

function getMediaType(extension: string): string | undefined {
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    default:
      return undefined
  }
}

function renderPlainText(rawText: string): string {
  const normalizedText = rawText.replace(/\r\n/g, '\n')
  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${paragraph.split('\n').map(escapeXml).join('<br />')}</p>`)

  if (!paragraphs.length) {
    return '<p></p>'
  }

  return paragraphs.join('\n      ')
}

async function renderMarkdownChapter(
  file: ContentFileNode,
  rawText: string,
  markdown: MarkdownIt,
  rootFolderPath: string,
  contentImagesBySourcePath: Map<string, EpubAsset>,
  nextAssetIndex: () => number,
): Promise<string> {
  const tokens = markdown.parse(rawText, {})
  await rewriteTokenImageSources(
    tokens,
    file.fsPath,
    rootFolderPath,
    contentImagesBySourcePath,
    nextAssetIndex,
  )

  return markdown.renderer.render(tokens, markdown.options, {})
}

async function rewriteTokenImageSources(
  tokens: MarkdownIt.Token[],
  markdownFilePath: string,
  rootFolderPath: string,
  contentImagesBySourcePath: Map<string, EpubAsset>,
  nextAssetIndex: () => number,
): Promise<void> {
  for (const token of tokens) {
    if (token.type === 'image') {
      await rewriteImageTokenSource(
        token,
        markdownFilePath,
        rootFolderPath,
        contentImagesBySourcePath,
        nextAssetIndex,
      )
    }

    if (token.type === 'html_inline' || token.type === 'html_block') {
      token.content = await rewriteHtmlImageSources(
        token.content,
        markdownFilePath,
        rootFolderPath,
        contentImagesBySourcePath,
        nextAssetIndex,
      )
    }

    if (token.children?.length) {
      await rewriteTokenImageSources(
        token.children,
        markdownFilePath,
        rootFolderPath,
        contentImagesBySourcePath,
        nextAssetIndex,
      )
    }
  }
}

async function rewriteImageTokenSource(
  token: MarkdownIt.Token,
  markdownFilePath: string,
  rootFolderPath: string,
  contentImagesBySourcePath: Map<string, EpubAsset>,
  nextAssetIndex: () => number,
): Promise<void> {
  const rawSource = token.attrGet('src')?.trim()
  if (!rawSource || isExternalImageSource(rawSource)) {
    return
  }

  const sourcePath = resolveMarkdownImagePath(rootFolderPath, markdownFilePath, rawSource)
  const asset = await getOrCreateImageAsset(
    sourcePath,
    rawSource,
    markdownFilePath,
    contentImagesBySourcePath,
    nextAssetIndex,
  )
  token.attrSet('src', `../${asset.href}`)
}

async function getOrCreateImageAsset(
  sourcePath: string,
  rawSource: string,
  markdownFilePath: string,
  contentImagesBySourcePath: Map<string, EpubAsset>,
  nextAssetIndex: () => number,
): Promise<EpubAsset> {
  const cachedAsset = contentImagesBySourcePath.get(sourcePath)
  if (cachedAsset) {
    return cachedAsset
  }

  if (!await exists(sourcePath)) {
    throw new Error(createMarkdownImageErrorMessage('Markdown 图片不存在', markdownFilePath, sourcePath, rawSource))
  }

  const stat = await fs.stat(sourcePath)
  if (!stat.isFile()) {
    throw new Error(createMarkdownImageErrorMessage('Markdown 图片路径不是文件', markdownFilePath, sourcePath, rawSource))
  }

  const extension = path.extname(sourcePath).toLowerCase()
  const mediaType = getMediaType(extension)
  if (!mediaType) {
    throw new Error(createMarkdownImageErrorMessage('Markdown 图片格式不支持', markdownFilePath, sourcePath, rawSource))
  }

  const index = String(nextAssetIndex()).padStart(4, '0')
  const asset: EpubAsset = {
    href: path.posix.join('images', 'content', `image-${index}${extension}`),
    id: `image-${index}`,
    mediaType,
    sourcePath,
    buffer: await fs.readFile(sourcePath),
  }

  contentImagesBySourcePath.set(sourcePath, asset)
  return asset
}

function isExternalImageSource(source: string): boolean {
  return /^(?:https?:)?\/\//i.test(source) || /^data:/i.test(source)
}

function resolveMarkdownImagePath(rootFolderPath: string, markdownFilePath: string, rawSource: string): string {
  const source = stripQueryAndHash(rawSource)
  if (!source) {
    throw new Error(`Markdown 图片路径为空：${path.basename(markdownFilePath)}`)
  }

  const decodedSource = safeDecodeUri(source)
  const resolvedPath = decodedSource.startsWith('/')
    ? path.resolve(rootFolderPath, `.${decodedSource}`)
    : path.resolve(path.dirname(markdownFilePath), decodedSource)

  const relativeToRoot = path.relative(rootFolderPath, resolvedPath)
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Markdown 图片超出当前目录范围：${rawSource}（文件：${toPortableRelativePath(rootFolderPath, markdownFilePath)}）`)
  }

  return resolvedPath
}

async function rewriteHtmlImageSources(
  html: string,
  markdownFilePath: string,
  rootFolderPath: string,
  contentImagesBySourcePath: Map<string, EpubAsset>,
  nextAssetIndex: () => number,
): Promise<string> {
  let rewrittenHtml = ''
  let cursor = 0

  for (const match of html.matchAll(HTML_IMAGE_TAG_PATTERN)) {
    const matchedTag = match[0]
    const startIndex = match.index ?? 0
    const endIndex = startIndex + matchedTag.length
    const rewrittenTag = await rewriteHtmlImageTag(
      matchedTag,
      markdownFilePath,
      rootFolderPath,
      contentImagesBySourcePath,
      nextAssetIndex,
    )

    rewrittenHtml += html.slice(cursor, startIndex)
    rewrittenHtml += rewrittenTag
    cursor = endIndex
  }

  if (cursor === 0) {
    return html
  }

  rewrittenHtml += html.slice(cursor)
  return rewrittenHtml
}

async function rewriteHtmlImageTag(
  htmlTag: string,
  markdownFilePath: string,
  rootFolderPath: string,
  contentImagesBySourcePath: Map<string, EpubAsset>,
  nextAssetIndex: () => number,
): Promise<string> {
  const sourceMatch = HTML_IMAGE_SOURCE_PATTERN.exec(htmlTag)
  if (!sourceMatch) {
    return htmlTag
  }

  const rawSource = sourceMatch[1] ?? sourceMatch[2] ?? sourceMatch[3] ?? ''
  if (!rawSource || isExternalImageSource(rawSource)) {
    return htmlTag
  }

  const sourcePath = resolveMarkdownImagePath(rootFolderPath, markdownFilePath, rawSource)
  const asset = await getOrCreateImageAsset(
    sourcePath,
    rawSource,
    markdownFilePath,
    contentImagesBySourcePath,
    nextAssetIndex,
  )
  const quote = sourceMatch[1] !== undefined ? '"' : sourceMatch[2] !== undefined ? '\'' : '"'
  const replacedAttribute = `src=${quote}../${asset.href}${quote}`

  return `${htmlTag.slice(0, sourceMatch.index)}${replacedAttribute}${htmlTag.slice(sourceMatch.index + sourceMatch[0].length)}`
}

function createMarkdownImageErrorMessage(
  prefix: string,
  markdownFilePath: string,
  resolvedPath: string,
  rawSource: string,
): string {
  return `${prefix}：${formatPathRelativeToMarkdown(markdownFilePath, resolvedPath, rawSource)}（文件：${path.basename(markdownFilePath)}）`
}

function formatPathRelativeToMarkdown(markdownFilePath: string, resolvedPath: string, rawSource: string): string {
  const normalizedSource = stripQueryAndHash(rawSource).trim()
  if (normalizedSource.startsWith('.')) {
    return normalizeRelativePath(normalizedSource)
  }

  const relativePath = path.relative(path.dirname(markdownFilePath), resolvedPath)
  return normalizeRelativePath(relativePath)
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURI(value)
  }
  catch {
    return value
  }
}

function stripQueryAndHash(value: string): string {
  return value.replace(/[?#].*$/, '')
}

function toPortableRelativePath(fromPath: string, targetPath: string): string {
  const relativePath = path.relative(fromPath, targetPath)
  return normalizeRelativePath(relativePath)
}

function normalizeRelativePath(value: string): string {
  const portablePath = value.split(path.sep).join('/')

  if (!portablePath || portablePath === '.') {
    return './'
  }

  if (portablePath.startsWith('./')) {
    return portablePath
  }

  if (portablePath.startsWith('../')) {
    return portablePath
  }

  return `./${portablePath}`
}
