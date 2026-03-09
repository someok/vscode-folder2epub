import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const width = 512
const height = 512
let pixels = new Uint8Array(width * height * 4)

const darkNavy = hex('#0E1A2B')
const navyBlue = hex('#133250')
const slateBlue = hex('#163A57')
const shadowColor = rgba(6, 12, 20, 0.18)
const amberTop = hex('#F6C15A')
const amberBody = hex('#E89A2D')
const amberDeep = hex('#C96B1F')
const pageWarm = hex('#FFF5DF')
const pageCool = hex('#FFFDF7')
const inkBlue = rgba(34, 52, 77, 0.22)
const teal = hex('#2BC3B0')
const tealDeep = hex('#198C80')
const highlight = rgba(255, 255, 255, 0.08)

try {
  main()
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}

/**
 * 解析命令行参数并派发对应的图标生成流程。
 */
function main() {
  const outputType = parseOutputType(process.argv.slice(2))
  const outputPath = resolveOutputPath(outputType)

  if (outputType === 'svg') {
    writeFileSync(outputPath, createSvgMarkup(), 'utf8')
    return
  }

  generatePngIcon(outputPath)
}

/**
 * 生成 PNG 图标，基于像素缓冲区逐层绘制形状。
 */
function generatePngIcon(filePath) {
  pixels = new Uint8Array(width * height * 4)

  // 整体图标按“背景 -> 主体 -> 高光细节”的顺序堆叠，便于控制覆盖关系。
  paintBackground()
  fillCircle(136, 136, 140, (_x, _y, coverage) => withCoverage(hex('#21466B'), coverage * 0.22))
  fillCircle(380, 384, 180, (_x, _y, coverage) => withCoverage(hex('#1E6A67'), coverage * 0.16))
  fillRoundedRect(110, 132, 146, 62, 18, (_x, y, coverage) => {
    const color = mixColor(amberTop, amberBody, normalize(y, 132, 194))
    return withCoverage(color, coverage)
  })
  fillRoundedRect(86, 164, 340, 228, 38, (_x, _y, coverage) => withCoverage(shadowColor, coverage))
  fillRoundedRect(98, 146, 322, 220, 34, (_x, y, coverage) => {
    const color = mixColor(amberTop, amberBody, normalize(y, 146, 366))
    return withCoverage(color, coverage)
  })
  fillRoundedRect(98, 230, 322, 136, 34, (_x, y, coverage) => {
    const color = mixColor(amberBody, amberDeep, normalize(y, 230, 366))
    return withCoverage(color, coverage * 0.98)
  })
  fillRoundedRect(98, 146, 322, 58, 34, (_x, _y, coverage) => withCoverage(highlight, coverage * 0.65))
  fillRoundedRect(148, 116, 236, 186, 26, (_x, _y, coverage) => withCoverage(shadowColor, coverage))
  fillRoundedRect(142, 108, 116, 176, 18, (x, y, coverage) => {
    const color = mixColor(pageCool, pageWarm, normalize(x, 142, 258) * 0.35 + normalize(y, 108, 284) * 0.25)
    return withCoverage(color, coverage)
  })
  fillRoundedRect(254, 108, 116, 176, 18, (x, y, coverage) => {
    const color = mixColor(pageCool, hex('#F3EAD9'), normalize(x, 254, 370) * 0.3 + normalize(y, 108, 284) * 0.2)
    return withCoverage(color, coverage)
  })
  fillRoundedRect(247, 118, 14, 162, 7, (_x, _y, coverage) => withCoverage(rgba(134, 101, 54, 0.18), coverage))
  fillRoundedRect(302, 108, 34, 116, 0, (x, y, coverage) => {
    const color = mixColor(teal, tealDeep, normalize(y, 108, 224) * 0.75 + normalize(x, 302, 336) * 0.25)
    return withCoverage(color, coverage)
  })
  fillPolygon(
    [
      [302, 224],
      [336, 224],
      [319, 248],
    ],
    () => tealDeep,
  )
  drawPageLines()
  fillPolygon(
    [
      [386, 104],
      [398, 128],
      [422, 140],
      [398, 152],
      [386, 176],
      [374, 152],
      [350, 140],
      [374, 128],
    ],
    () => hex('#66E7DE'),
  )
  fillCircle(386, 140, 12, (_x, _y, coverage) => withCoverage(rgba(255, 255, 255, 0.34), coverage))
  fillRoundedRect(148, 318, 224, 18, 9, (_x, _y, coverage) => withCoverage(rgba(255, 245, 223, 0.24), coverage))
  fillRoundedRect(148, 344, 176, 12, 6, (_x, _y, coverage) => withCoverage(rgba(255, 245, 223, 0.18), coverage))

  writePng(filePath, width, height, pixels)
}

/**
 * 绘制书页内部的文本行装饰。
 */
function drawPageLines() {
  const lines = [
    [168, 146, 60, 8],
    [168, 166, 74, 8],
    [168, 186, 58, 8],
    [278, 150, 54, 8],
    [278, 170, 62, 8],
    [278, 190, 48, 8],
  ]

  for (const [x, y, w, h] of lines) {
    fillRoundedRect(x, y, w, h, 4, (_px, _py, coverage) => withCoverage(inkBlue, coverage))
  }
}

/**
 * 使用简单抗锯齿覆盖率绘制圆形。
 */
function fillCircle(cx, cy, radius, shader) {
  const minX = Math.max(0, Math.floor(cx - radius - 1))
  const maxX = Math.min(width - 1, Math.ceil(cx + radius + 1))
  const minY = Math.max(0, Math.floor(cy - radius - 1))
  const maxY = Math.min(height - 1, Math.ceil(cy + radius + 1))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius
      const coverage = clamp(0.9 - distance, 0, 1)
      if (coverage <= 0) {
        continue
      }

      blendPixel(x, y, shader(x, y, coverage))
    }
  }
}

/**
 * 在像素缓冲区内填充任意多边形。
 */
function fillPolygon(points, shader) {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const minX = Math.max(0, Math.floor(Math.min(...xs)))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...xs)))
  const minY = Math.max(0, Math.floor(Math.min(...ys)))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pointInPolygon(x + 0.5, y + 0.5, points)) {
        continue
      }

      blendPixel(x, y, shader(x, y, 1))
    }
  }
}

/**
 * 在像素缓冲区内填充圆角矩形。
 */
function fillRoundedRect(x, y, w, h, radius, shader) {
  const minX = Math.max(0, Math.floor(x - 1))
  const maxX = Math.min(width - 1, Math.ceil(x + w + 1))
  const minY = Math.max(0, Math.floor(y - 1))
  const maxY = Math.min(height - 1, Math.ceil(y + h + 1))
  const centerX = x + w / 2
  const centerY = y + h / 2
  const halfWidth = w / 2
  const halfHeight = h / 2

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = Math.abs(px + 0.5 - centerX) - halfWidth + radius
      const dy = Math.abs(py + 0.5 - centerY) - halfHeight + radius
      const outsideX = Math.max(dx, 0)
      const outsideY = Math.max(dy, 0)
      // 通过签名距离场近似边缘，获得比硬切更平滑的圆角效果。
      const signedDistance = Math.hypot(outsideX, outsideY) + Math.min(Math.max(dx, dy), 0) - radius
      const coverage = clamp(0.9 - signedDistance, 0, 1)

      if (coverage <= 0) {
        continue
      }

      blendPixel(px, py, shader(px, py, coverage))
    }
  }
}

/**
 * 绘制背景渐变、暗角和细条纹纹理。
 */
function paintBackground() {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / (width - 1)
      const ny = y / (height - 1)
      const gradient = mixColor(darkNavy, navyBlue, ny * 0.72 + nx * 0.28)
      const accent = mixColor(gradient, slateBlue, radialFalloff(x, y, 152, 132, 280) * 0.26)
      const vignette = 0.84 + radialFalloff(x, y, width / 2, height / 2, 420) * 0.16
      const stripe = ((x + y) % 44 < 2) ? 10 : 0

      setPixel(x, y, {
        r: clamp(Math.round((accent.r + stripe) * vignette), 0, 255),
        g: clamp(Math.round((accent.g + stripe) * vignette), 0, 255),
        b: clamp(Math.round((accent.b + stripe * 1.4) * vignette), 0, 255),
        a: 1,
      })
    }
  }
}

/**
 * 按 alpha 混合规则把颜色叠加到目标像素上。
 */
function blendPixel(x, y, color) {
  if (color.a <= 0) {
    return
  }

  const index = (y * width + x) * 4
  const srcAlpha = clamp(color.a, 0, 1)
  const dstAlpha = pixels[index + 3] / 255
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha)

  if (outAlpha <= 0) {
    return
  }

  const srcWeight = srcAlpha / outAlpha
  const dstWeight = dstAlpha * (1 - srcAlpha) / outAlpha

  pixels[index] = Math.round(color.r * srcWeight + pixels[index] * dstWeight)
  pixels[index + 1] = Math.round(color.g * srcWeight + pixels[index + 1] * dstWeight)
  pixels[index + 2] = Math.round(color.b * srcWeight + pixels[index + 2] * dstWeight)
  pixels[index + 3] = Math.round(outAlpha * 255)
}

/**
 * 把数值限制在指定区间内。
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * 将十六进制颜色转换为 RGBA 对象。
 */
function hex(value) {
  const normalized = value.replace('#', '')
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
    a: 1,
  }
}

/**
 * 在线性空间内混合两种颜色。
 */
function mixColor(from, to, amount) {
  const t = clamp(amount, 0, 1)
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
    a: from.a + (to.a - from.a) * t,
  }
}

/**
 * 将区间内的值归一化到 0 到 1。
 */
function normalize(value, min, max) {
  return clamp((value - min) / (max - min), 0, 1)
}

/**
 * 使用射线法判断点是否落在多边形内部。
 */
function pointInPolygon(x, y, points) {
  let inside = false

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    const intersects = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

/**
 * 计算某点相对圆心和半径的径向衰减系数。
 */
function radialFalloff(x, y, centerX, centerY, radius) {
  return clamp(1 - Math.hypot(x - centerX, y - centerY) / radius, 0, 1)
}

/**
 * 解析 `-type` / `--type` 参数，决定生成 PNG 还是 SVG。
 */
function parseOutputType(args) {
  if (!args.length) {
    return 'png'
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument !== '-type' && argument !== '--type') {
      continue
    }

    const nextValue = args[index + 1]
    if (!nextValue) {
      throw new Error('缺少 -type 参数值，支持：png、svg')
    }

    if (nextValue === 'png' || nextValue === 'svg') {
      return nextValue
    }

    throw new Error(`不支持的 -type 参数值：${nextValue}，支持：png、svg`)
  }

  throw new Error(`不支持的参数：${args.join(' ')}`)
}

/**
 * 计算图标输出路径，统一写到项目 `media/` 目录。
 */
function resolveOutputPath(outputType) {
  const currentFilePath = fileURLToPath(import.meta.url)
  const projectRoot = path.resolve(path.dirname(currentFilePath), '..')
  const outputDir = path.join(projectRoot, 'media')

  mkdirSync(outputDir, { recursive: true })
  return path.join(outputDir, `icon.${outputType}`)
}

/**
 * 生成与 PNG 风格一致的 SVG 矢量图标。
 */
function createSvgMarkup() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <defs>
    <linearGradient id="bg-gradient" x1="56" y1="32" x2="456" y2="492" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${toCssColor(darkNavy)}" />
      <stop offset="100%" stop-color="${toCssColor(navyBlue)}" />
    </linearGradient>
    <radialGradient id="accent-gradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(152 132) rotate(33) scale(302 286)">
      <stop offset="0%" stop-color="${toCssColor(slateBlue)}" stop-opacity="0.52" />
      <stop offset="100%" stop-color="${toCssColor(slateBlue)}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="tab-gradient" x1="183" y1="132" x2="183" y2="194" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${toCssColor(amberTop)}" />
      <stop offset="100%" stop-color="${toCssColor(amberBody)}" />
    </linearGradient>
    <linearGradient id="folder-gradient" x1="259" y1="146" x2="259" y2="366" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${toCssColor(amberTop)}" />
      <stop offset="100%" stop-color="${toCssColor(amberBody)}" />
    </linearGradient>
    <linearGradient id="folder-deep-gradient" x1="259" y1="230" x2="259" y2="366" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${toCssColor(amberBody)}" />
      <stop offset="100%" stop-color="${toCssColor(amberDeep)}" />
    </linearGradient>
    <linearGradient id="page-left-gradient" x1="142" y1="108" x2="258" y2="284" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${toCssColor(pageCool)}" />
      <stop offset="100%" stop-color="${toCssColor(pageWarm)}" />
    </linearGradient>
    <linearGradient id="page-right-gradient" x1="254" y1="108" x2="370" y2="284" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${toCssColor(pageCool)}" />
      <stop offset="100%" stop-color="${toCssColor(hex('#F3EAD9'))}" />
    </linearGradient>
    <linearGradient id="bookmark-gradient" x1="319" y1="108" x2="319" y2="248" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${toCssColor(teal)}" />
      <stop offset="100%" stop-color="${toCssColor(tealDeep)}" />
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg-gradient)" />
  <rect width="${width}" height="${height}" fill="url(#accent-gradient)" />

  <circle cx="136" cy="136" r="140" fill="${toCssColor(hex('#21466B'))}" fill-opacity="0.22" />
  <circle cx="380" cy="384" r="180" fill="${toCssColor(hex('#1E6A67'))}" fill-opacity="0.16" />

  <rect x="110" y="132" width="146" height="62" rx="18" fill="url(#tab-gradient)" />
  <rect x="86" y="164" width="340" height="228" rx="38" fill="${toCssColor(shadowColor)}" />
  <rect x="98" y="146" width="322" height="220" rx="34" fill="url(#folder-gradient)" />
  <rect x="98" y="230" width="322" height="136" rx="34" fill="url(#folder-deep-gradient)" />
  <rect x="98" y="146" width="322" height="58" rx="34" fill="${toCssColor(highlight)}" />

  <rect x="148" y="116" width="236" height="186" rx="26" fill="${toCssColor(shadowColor)}" />
  <rect x="142" y="108" width="116" height="176" rx="18" fill="url(#page-left-gradient)" />
  <rect x="254" y="108" width="116" height="176" rx="18" fill="url(#page-right-gradient)" />
  <rect x="247" y="118" width="14" height="162" rx="7" fill="${toCssColor(rgba(134, 101, 54, 0.18))}" />

  <rect x="168" y="146" width="60" height="8" rx="4" fill="${toCssColor(inkBlue)}" />
  <rect x="168" y="166" width="74" height="8" rx="4" fill="${toCssColor(inkBlue)}" />
  <rect x="168" y="186" width="58" height="8" rx="4" fill="${toCssColor(inkBlue)}" />
  <rect x="278" y="150" width="54" height="8" rx="4" fill="${toCssColor(inkBlue)}" />
  <rect x="278" y="170" width="62" height="8" rx="4" fill="${toCssColor(inkBlue)}" />
  <rect x="278" y="190" width="48" height="8" rx="4" fill="${toCssColor(inkBlue)}" />

  <path d="M302 108H336V224L319 248L302 224V108Z" fill="url(#bookmark-gradient)" />

  <path d="M386 104L398 128L422 140L398 152L386 176L374 152L350 140L374 128L386 104Z" fill="${toCssColor(hex('#66E7DE'))}" />
  <circle cx="386" cy="140" r="12" fill="${toCssColor(rgba(255, 255, 255, 0.34))}" />

  <rect x="148" y="318" width="224" height="18" rx="9" fill="${toCssColor(rgba(255, 245, 223, 0.24))}" />
  <rect x="148" y="344" width="176" height="12" rx="6" fill="${toCssColor(rgba(255, 245, 223, 0.18))}" />
</svg>
`
}

/**
 * 创建 RGBA 颜色对象。
 */
function rgba(r, g, b, a = 1) {
  return { r, g, b, a }
}

/**
 * 将颜色对象转换为 SVG / CSS 可用的 rgba 文本。
 */
function toCssColor(color) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Number(color.a.toFixed(3))})`
}

/**
 * 直接写入像素缓冲区中的单个像素。
 */
function setPixel(x, y, color) {
  const index = (y * width + x) * 4
  pixels[index] = color.r
  pixels[index + 1] = color.g
  pixels[index + 2] = color.b
  pixels[index + 3] = Math.round(clamp(color.a, 0, 1) * 255)
}

/**
 * 根据采样覆盖率调整颜色透明度。
 */
function withCoverage(color, coverage) {
  return {
    ...color,
    a: color.a * coverage,
  }
}

/**
 * 将 RGBA 像素缓冲区编码成 PNG 文件。
 */
function writePng(filePath, pngWidth, pngHeight, rgbaPixels) {
  const rawRows = Buffer.alloc((pngWidth * 4 + 1) * pngHeight)

  for (let y = 0; y < pngHeight; y += 1) {
    // PNG 每行前面都需要带一个 filter byte，这里固定使用 0。
    const rowStart = y * (pngWidth * 4 + 1)
    rawRows[rowStart] = 0
    rgbaPixels.subarray(y * pngWidth * 4, (y + 1) * pngWidth * 4).forEach((value, index) => {
      rawRows[rowStart + 1 + index] = value
    })
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(pngWidth, 0)
  ihdr.writeUInt32BE(pngHeight, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const pngBuffer = Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflateSync(rawRows, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ])

  writeFileSync(filePath, pngBuffer)
}

/**
 * 创建 PNG 的单个数据块。
 */
function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32BE(data.length, 0)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer])
}

/**
 * 计算 PNG 数据块所需的 CRC32 校验值。
 */
function crc32(buffer) {
  let crc = 0xFFFFFFFF

  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xEDB88320 & mask)
    }
  }

  return (crc ^ 0xFFFFFFFF) >>> 0
}
