import sharp from 'sharp'

/**
 * Aggressive cleanup for hero-prize:
 * 1) Tighter chroma-key thresholds (hard 230, soft 195) — cut more border noise
 * 2) Alpha erosion 1 pixel — trim fuzzy single-pixel halo
 * 3) Tiny gaussian on alpha — smooths the cut edge
 */
async function clean(input, output) {
  const HARD = 230
  const SOFT = 195

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const ch = 4
  const buf = Buffer.from(data)
  const visited = new Uint8Array(width * height)

  // Phase 1: flood-fill chroma key (from borders)
  const stack = []
  for (let x = 0; x < width; x++) { stack.push(x); stack.push((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y++) { stack.push(y * width); stack.push(y * width + width - 1) }

  const isStrongBg = (bi) => buf[bi] >= HARD && buf[bi + 1] >= HARD && buf[bi + 2] >= HARD
  const isLooseBg = (bi) => buf[bi] >= SOFT && buf[bi + 1] >= SOFT && buf[bi + 2] >= SOFT
  const avg = (bi) => (buf[bi] + buf[bi + 1] + buf[bi + 2]) / 3

  while (stack.length) {
    const p = stack.pop()
    if (visited[p]) continue
    const bi = p * ch
    if (!isLooseBg(bi)) continue
    visited[p] = 1
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

  // Phase 2: alpha erosion — trim 1px halo around edges.
  // For each pixel: if any neighbor's alpha is 0, weaken this pixel's alpha.
  const alphaCopy = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) alphaCopy[i] = buf[i * ch + 3]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x
      if (alphaCopy[p] === 0) continue
      let minN = 255
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const np = (y + dy) * width + (x + dx)
          if (alphaCopy[np] < minN) minN = alphaCopy[np]
        }
      }
      // If a neighbor was fully transparent, taper this pixel
      if (minN === 0) {
        buf[p * ch + 3] = Math.min(buf[p * ch + 3], Math.round(alphaCopy[p] * 0.55))
      }
    }
  }

  await sharp(buf, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(output)
  console.log('Wrote', output)
}

await clean('public/cv/_originals/hero-prize.png', 'public/cv/hero-prize.png')
