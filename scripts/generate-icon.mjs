import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const width = 512
const height = 512
const pixels = new Uint8Array(width * height * 4)

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

paintBackground()
fillCircle(136, 136, 140, (_x, _y, coverage) => withCoverage(hex('#21466B'), coverage * 0.22))
fillCircle(380, 384, 180, (_x, _y, coverage) => withCoverage(hex('#1E6A67'), coverage * 0.16))
fillRoundedRect(110, 132, 146, 62, 18, (x, y, coverage) => {
  const color = mixColor(amberTop, amberBody, normalize(y, 132, 194))
  return withCoverage(color, coverage)
})
fillRoundedRect(86, 164, 340, 228, 38, (_x, _y, coverage) => withCoverage(shadowColor, coverage))
fillRoundedRect(98, 146, 322, 220, 34, (x, y, coverage) => {
  const color = mixColor(amberTop, amberBody, normalize(y, 146, 366))
  return withCoverage(color, coverage)
})
fillRoundedRect(98, 230, 322, 136, 34, (x, y, coverage) => {
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

writePng(resolveOutputPath(), width, height, pixels)

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
      const signedDistance = Math.hypot(outsideX, outsideY) + Math.min(Math.max(dx, dy), 0) - radius
      const coverage = clamp(0.9 - signedDistance, 0, 1)

      if (coverage <= 0) {
        continue
      }

      blendPixel(px, py, shader(px, py, coverage))
    }
  }
}

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function hex(value) {
  const normalized = value.replace('#', '')
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
    a: 1,
  }
}

function mixColor(from, to, amount) {
  const t = clamp(amount, 0, 1)
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
    a: from.a + (to.a - from.a) * t,
  }
}

function normalize(value, min, max) {
  return clamp((value - min) / (max - min), 0, 1)
}

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

function radialFalloff(x, y, centerX, centerY, radius) {
  return clamp(1 - Math.hypot(x - centerX, y - centerY) / radius, 0, 1)
}

function resolveOutputPath() {
  const currentFilePath = fileURLToPath(import.meta.url)
  const projectRoot = path.resolve(path.dirname(currentFilePath), '..')
  const outputDir = path.join(projectRoot, 'media')

  mkdirSync(outputDir, { recursive: true })
  return path.join(outputDir, 'icon.png')
}

function rgba(r, g, b, a = 1) {
  return { r, g, b, a }
}

function setPixel(x, y, color) {
  const index = (y * width + x) * 4
  pixels[index] = color.r
  pixels[index + 1] = color.g
  pixels[index + 2] = color.b
  pixels[index + 3] = Math.round(clamp(color.a, 0, 1) * 255)
}

function withCoverage(color, coverage) {
  return {
    ...color,
    a: color.a * coverage,
  }
}

function writePng(filePath, pngWidth, pngHeight, rgbaPixels) {
  const rawRows = Buffer.alloc((pngWidth * 4 + 1) * pngHeight)

  for (let y = 0; y < pngHeight; y += 1) {
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

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32BE(data.length, 0)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer])
}

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
