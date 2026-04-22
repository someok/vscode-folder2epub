import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const RELEASE_DIR = 'release'

try {
  await main()
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}

/**
 * 创建 `out/` 目录，并将 VSIX 输出到该目录下。
 */
async function main() {
  const currentFilePath = fileURLToPath(import.meta.url)
  const projectRoot = path.resolve(path.dirname(currentFilePath), '..')
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  const outputDirPath = path.join(projectRoot, RELEASE_DIR)
  const outputFilePath = path.join(outputDirPath, `${packageJson.name}-${packageJson.version}.vsix`)

  await mkdir(outputDirPath, { recursive: true })
  await runVscePackage(outputFilePath)
}

/**
 * 调用 `vsce package` 并继承终端输出。
 *
 * @param outputFilePath 最终生成的 VSIX 绝对路径。
 */
function runVscePackage(outputFilePath) {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const child = spawn(command, ['@vscode/vsce', 'package', '--out', outputFilePath], {
      cwd: process.cwd(),
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`vsce 打包失败，退出码：${code ?? 'unknown'}`))
    })
  })
}
