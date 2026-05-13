// Run: node scripts/upload-featured-images-v2.js
require('dotenv').config({ path: '.env.local' })
const https = require('https')
const http = require('http')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 실제 고화질 이미지 소스
const IMAGES = {
  'FPT Software': {
    url: 'https://fptsoftware.com/-/media/project/fpt-software/global/common/fptsoftware_building_d.png',
    ext: 'png',
  },
  'Mutistation': {
    url: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/social%20media-rj5ECUs2rmOgMrXtwsLVds9f2GXkOm.jpg',
    ext: 'jpg',
  },
  'Nexacode': {
    url: 'https://nexacode.co.kr/og-image.png',
    ext: 'png',
  },
  'Wellpod': {
    url: 'https://wellpod.com/cdn/shop/files/2026-03-29_9.38.11_580x.png?v=1774788013',
    ext: 'png',
  },
  'Jinosys': {
    url: 'https://img.youtube.com/vi/fgJQwsS7nOM/maxresdefault.jpg',
    ext: 'jpg',
  },
  'Shupia': {
    url: 'https://resource.clickn.co.kr/storage/466713473',
    ext: 'jpg',
  },
  'Andwise': {
    url: 'https://resource.clickn.co.kr/storage/537261454',
    ext: 'jpg',
  },
  'ONSQUARE': {
    url: 'https://resource.clickn.co.kr/storage/312402420',
    ext: 'jpg',
  },
}

function download(imageUrl) {
  return new Promise((resolve, reject) => {
    const lib = imageUrl.startsWith('https') ? https : http
    const opts = typeof imageUrl === 'string' ? imageUrl : imageUrl
    lib.get(opts, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function run() {
  for (const [company, config] of Object.entries(IMAGES)) {
    try {
      process.stdout.write(`  ${company}... `)

      let buffer
      let ext = config.ext
      try {
        buffer = await download(config.url)
        if (buffer.length < 5000 && config.fallback) {
          console.log(`too small (${buffer.length}B), using fallback...`)
          buffer = await download(config.fallback)
          ext = config.fallbackExt || ext
        }
      } catch (e) {
        if (config.fallback) {
          buffer = await download(config.fallback)
          ext = config.fallbackExt || ext
        } else {
          throw e
        }
      }

      const path = `jobs/featured_${company.toLowerCase().replace(/\s+/g, '_')}_v2.${ext}`
      const contentType = ext === 'jpg' ? 'image/jpeg' : 'image/png'

      const { error: upErr } = await supabase.storage.from('job-images').upload(path, buffer, {
        contentType,
        upsert: true,
      })
      if (upErr) { console.log('UPLOAD ERROR:', upErr.message); continue }

      const { data } = supabase.storage.from('job-images').getPublicUrl(path)
      const publicUrl = data.publicUrl

      const { error: dbErr } = await supabase
        .from('jobs')
        .update({ image_url: publicUrl })
        .eq('company', company)
        .eq('is_featured', true)

      if (dbErr) console.log('DB ERROR:', dbErr.message)
      else console.log(`OK (${Math.round(buffer.length/1024)}KB) → ${publicUrl}`)
    } catch (e) {
      console.log('FAILED:', e.message)
    }
  }

  // Lumicraft, MNF Solution → NULL (기본 이미지 fallback)
  const { error } = await supabase
    .from('jobs')
    .update({ image_url: null })
    .in('company', ['Lumicraft', 'MNF Solution', 'SeedLab'])
    .eq('is_featured', true)
  console.log(error ? `  NULL group: ERROR ${error.message}` : '  SeedLab/Lumicraft/MNF → NULL (default fallback)')

  console.log('\nDone!')
}

run()
