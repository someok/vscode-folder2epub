const assert = require('node:assert/strict')
const { promises: fs } = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const JSZip = require('jszip')

const { scanContentTree } = require('../dist/services/contentScanner')
const { buildEpub } = require('../dist/services/epubService')

async function withTempBook(structure, run) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'folder2epub-'))

  try {
    await writeTree(rootDir, structure)
    await run(rootDir)
  }
  finally {
    await fs.rm(rootDir, { recursive: true, force: true })
  }
}

async function writeTree(rootDir, structure) {
  for (const [name, value] of Object.entries(structure)) {
    const targetPath = path.join(rootDir, name)

    if (typeof value === 'string') {
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.writeFile(targetPath, value, 'utf8')
      continue
    }

    await fs.mkdir(targetPath, { recursive: true })
    await writeTree(targetPath, value)
  }
}

async function buildBook(rootDir) {
  const content = await scanContentTree(rootDir)
  const outputFilePath = path.join(rootDir, 'output.epub')
  const result = await buildEpub({
    rootFolderPath: rootDir,
    outputFilePath,
    nodes: content.nodes,
    metadata: {
      title: '测试书籍',
      titleSuffix: '',
      author: '测试作者',
      description: '',
      cover: '',
      version: '1.0.0',
    },
  })
  const archive = await JSZip.loadAsync(await fs.readFile(outputFilePath))
  const navFile = archive.file('OEBPS/nav.xhtml')
  if (!navFile) {
    throw new Error('生成结果缺少导航文件。')
  }

  const firstChapterFile = archive.file('OEBPS/text/chapter-0001.xhtml')
  if (!firstChapterFile) {
    throw new Error('生成结果缺少首章文件。')
  }

  return {
    content,
    chapterCount: result.chapterCount,
    navXhtml: await navFile.async('string'),
    firstChapterXhtml: await firstChapterFile.async('string'),
  }
}

test('子目录存在 index 文件时，目录优先链接该文件且不展示独立目录项', async () => {
  await withTempBook({
    '0010_正文': {
      '0000__index.md': '# 正文首页',
      '0010_第一章.md': '# 第一章',
    },
  }, async (rootDir) => {
    const { content, chapterCount, navXhtml, firstChapterXhtml } = await buildBook(rootDir)
    const folderNode = content.nodes[0]

    assert.equal(folderNode.kind, 'folder')
    assert.equal(folderNode.firstFile.displayName, 'index')
    assert.equal(folderNode.indexFile?.displayName, 'index')
    assert.equal(chapterCount, 2)
    assert.match(navXhtml, /<a href="text\/chapter-0001\.xhtml">正文<\/a>/)
    assert.doesNotMatch(navXhtml, />index<\/a>/)
    assert.match(navXhtml, />第一章<\/a>/)
    assert.doesNotMatch(firstChapterXhtml, /<h1>index<\/h1>/)
    assert.match(firstChapterXhtml, /<h1>正文首页<\/h1>/)
  })
})

test('子目录不存在 index 文件时，保持原有首文件跳转规则', async () => {
  await withTempBook({
    '0010_正文': {
      '0010_第一章.md': '# 第一章',
      '0020_第二章.txt': '第二章',
    },
  }, async (rootDir) => {
    const { content, chapterCount, navXhtml } = await buildBook(rootDir)
    const folderNode = content.nodes[0]

    assert.equal(folderNode.kind, 'folder')
    assert.equal(folderNode.firstFile.displayName, '第一章')
    assert.equal(folderNode.indexFile, undefined)
    assert.equal(chapterCount, 2)
    assert.match(navXhtml, /<a href="text\/chapter-0001\.xhtml">正文<\/a>/)
    assert.match(navXhtml, />第一章<\/a>/)
    assert.match(navXhtml, />第二章<\/a>/)
  })
})

test('上层目录没有直接 index 时，可回退到更深层子目录中的 index 文件', async () => {
  await withTempBook({
    '0010_正文': {
      '0010_卷一': {
        '0000__index.md': '# 卷一首页',
        '0010_第一章.md': '# 卷一第一章',
      },
      '0020_卷二': {
        '0010_第二章.md': '# 卷二第二章',
      },
    },
  }, async (rootDir) => {
    const { content, chapterCount, navXhtml } = await buildBook(rootDir)
    const folderNode = content.nodes[0]

    assert.equal(folderNode.kind, 'folder')
    assert.equal(folderNode.firstFile.relativePath, path.join('0010_正文', '0010_卷一', '0000__index.md'))
    assert.equal(folderNode.indexFile, undefined)
    assert.equal(chapterCount, 3)
    assert.match(navXhtml, /<a href="text\/chapter-0001\.xhtml">正文<\/a>/)
    assert.match(navXhtml, /<a href="text\/chapter-0001\.xhtml">卷一<\/a>/)
    assert.doesNotMatch(navXhtml, />index<\/a>/)
  })
})
