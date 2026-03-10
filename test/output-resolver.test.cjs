const assert = require('node:assert/strict')
const { promises: fs } = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { resolveOutputDir } = require('../dist/services/outputResolver')

async function withTempTree(structure, run) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'folder2epub-output-'))

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

test('`saveTo` 支持 `~/...` 展开到用户目录', async () => {
  await withTempTree({
    '__epub.yml': 'saveTo: ~/Documents/folder2epub\n',
    'book': {},
  }, async (rootDir) => {
    const outputDir = await resolveOutputDir(path.join(rootDir, 'book'))

    assert.equal(outputDir, path.join(os.homedir(), 'Documents', 'folder2epub'))
  })
})

test('`saveTo` 为 `~` 时直接指向用户目录', async () => {
  await withTempTree({
    '__epub.yml': 'saveTo: ~\n',
    'book': {},
  }, async (rootDir) => {
    const outputDir = await resolveOutputDir(path.join(rootDir, 'book'))

    assert.equal(outputDir, os.homedir())
  })
})

test('相对路径仍然基于 `__epub.yml` 所在目录解析', async () => {
  await withTempTree({
    workspace: {
      '__epub.yml': 'saveTo: ./out\n',
      'books': {
        demo: {},
      },
    },
  }, async (rootDir) => {
    const outputDir = await resolveOutputDir(path.join(rootDir, 'workspace', 'books', 'demo'))

    assert.equal(outputDir, path.join(rootDir, 'workspace', 'out'))
  })
})
