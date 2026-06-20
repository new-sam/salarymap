import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

/**
 * Flood-fill chroma key from image borders.
 * - Only removes WHITE pixels connected to the edges (true background).
 * - Internal white regions (clothes, paper, laptop) preserved.
 * - Soft alpha on near-edge pixels (anti-alias preserved).
 */
async function transparentBg(input, output, opts = {}) {
  const HARD = opts.hard ?? 245   // strict white → fully transparent
  const SOFT = opts.soft ?? 215   // light gray → fade
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const ch = 4
  const buf = Buffer.from(data)
  const visited = new Uint8Array(width * height)

  const avg = (bi) => (buf[bi] + buf[bi + 1] + buf[bi + 2]) / 3
  const isStrongBg = (bi) => buf[bi] >= HARD && buf[bi + 1] >= HARD && buf[bi + 2] >= HARD
  const isLooseBg = (bi) => buf[bi] >= SOFT && buf[bi + 1] >= SOFT && buf[bi + 2] >= SOFT

  // Seed DFS stack with all border pixels
  const stack = []
  for (let x = 0; x < width; x++) {
    stack.push(x)
    stack.push((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y++) {
    stack.push(y * width)
    stack.push(y * width + width - 1)
  }

  // Flood fill: mark BG-connected pixels.
  while (stack.length) {
    const p = stack.pop()
    if (visited[p]) continue
    const bi = p * ch
    if (!isLooseBg(bi)) continue
    visited[p] = 1
    // Apply alpha based on brightness — soft edge near content
    if (isStrongBg(bi)) {
      buf[bi + 3] = 0
    } else {
      const a = avg(bi)
      const fade = Math.max(0, Math.min(1, (a - SOFT) / (HARD - SOFT)))
      buf[bi + 3] = Math.round(255 * (1 - fade))
    }
    const x = p % width
    const y = (p / width) | 0
    if (x > 0) stack.push(p - 1)
    if (x < width - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - width)
    if (y < height - 1) stack.push(p + width)
  }

  await sharp(buf, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output)
  console.log('  ✓', path.basename(output))
}

const ROOT = 'public/cv'

async function main() {
  // Backup originals once
  const backupDir = path.join(ROOT, '_originals')
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  if (!fs.existsSync(path.join(backupDir, 'avatars'))) fs.mkdirSync(path.join(backupDir, 'avatars'))

  const targets = [
    'hero-prize.png',
    ...Array.from({ length: 8 }, (_, i) => `avatars/${String(i + 1).padStart(2, '0')}.png`),
  ]

  console.log('Backing up + processing:')
  for (const rel of targets) {
    const src = path.join(ROOT, rel)
    const bak = path.join(backupDir, rel)
    if (!fs.existsSync(bak)) fs.copyFileSync(src, bak)
    const tmp = src + '.tmp.png'
    await transparentBg(src, tmp)
    fs.renameSync(tmp, src)
  }
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
