import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build, context } from 'esbuild'

const currentFilePath = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(path.dirname(currentFilePath), '..')

const isWatch = process.argv.includes('--watch')

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: [path.join(projectRoot, 'src', 'extension.ts')],
  bundle: true,
  outfile: path.join(projectRoot, 'dist', 'extension.js'),
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external: ['vscode'],
  mainFields: ['module', 'main'],
}

async function main() {
  if (isWatch) {
    const ctx = await context({ ...config, logLevel: 'info' })
    await ctx.watch()
  }
  else {
    await build(config)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
