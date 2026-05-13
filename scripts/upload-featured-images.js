// Run: node scripts/upload-featured-images.js
// Downloads company images and uploads to Supabase job-images bucket
require('dotenv').config({ path: '.env.local' })
const https = require('https')
const http = require('http')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const IMAGES = {
  'SeedLab': 'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20SEEDLAB.png',
  'Jinosys': 'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-Jinosys.png',
  'FPT Software': 'https://fptsoftware.com/-/media/project/fpt-software/global/common/fptsoftware_building_d.png',
  'Nexacode': 'https://nexacode.co.kr/og-image.png',
  'Wellpod': 'https://wellpod.com/cdn/shop/files/2026-03-29_9.38.11_580x.png?v=1774788013',
  'Mutistation': 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/social%20media-rj5ECUs2rmOgMrXtwsLVds9f2GXkOm.jpg',
  'Andwise': 'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Andwise%20(1).png',
  'ONSQUARE': 'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-ONSQUARE.png',
  'Shupia': 'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Shupia.png',
  'FPT Software Korea': 'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20FPT.png',
}

function download(imageUrl) {
  return new Promise((resolve, reject) => {
    const lib = imageUrl.startsWith('https') ? https : http
    lib.get(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), type: res.headers['content-type'] }))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function run() {
  for (const [company, url] of Object.entries(IMAGES)) {
    try {
      process.stdout.write(`  ${company}... `)
      const { buffer, type } = await download(url)
      const ext = type?.includes('jpeg') || type?.includes('jpg') ? 'jpg' : 'png'
      const path = `jobs/featured_${company.toLowerCase().replace(/\s+/g, '_')}.${ext}`

      const { error: upErr } = await supabase.storage.from('job-images').upload(path, buffer, {
        contentType: type || 'image/png',
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
      else console.log('OK →', publicUrl)
    } catch (e) {
      console.log('FAILED:', e.message)
    }
  }
  console.log('\nDone!')
}

run()
