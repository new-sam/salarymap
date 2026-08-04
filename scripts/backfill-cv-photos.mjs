// photo_url 없는 인재의 이력서 PDF에서 증명사진을 추출해 profiles 버킷에 올리고 photo_url 백필.
// 휴리스틱은 profile/parse-resume·lib/parseResume(extractPhotoJpegFromPdf)와 동일 — JPEG 스캔 10KB~2MB.
// 멱등: 경로가 <userId>/photo_cv.jpg 고정 + upsert, photo_url 있는 행은 건너뜀. node scripts/backfill-cv-photos.mjs
import { sb, fetchAll } from './outreach/lib.mjs'
import { extractPhotoJpegFromPdf } from '../lib/parseResume.js'

const rows = await fetchAll(() => sb
  .from('user_profiles')
  .select('id, resume_url, photo_url')
  .not('resume_url', 'is', null)
  .neq('resume_url', '')
)
const targets = rows.filter(r => !r.photo_url)
console.log(`이력서 보유 ${rows.length}명 / photo_url 없음 ${targets.length}명 → 추출 시작`)

let ok = 0, noPhoto = 0, notPdf = 0, fail = 0, done = 0
const CONCURRENCY = 8

async function processOne(r) {
  try {
    const res = await fetch(r.resume_url)
    if (!res.ok) throw new Error(`download ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.subarray(0, 1024).indexOf('%PDF-') === -1) { notPdf++; return }
    const jpeg = extractPhotoJpegFromPdf(buf)
    if (!jpeg) { noPhoto++; return }
    const path = `${r.id}/photo_cv.jpg`
    const { error: upErr } = await sb.storage.from('profiles').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true })
    if (upErr) throw new Error(`upload: ${upErr.message}`)
    const url = sb.storage.from('profiles').getPublicUrl(path).data?.publicUrl
    if (!url) throw new Error('no public url')
    const { error: dbErr } = await sb.from('user_profiles').update({ photo_url: url }).eq('id', r.id)
    if (dbErr) throw new Error(`db: ${dbErr.message}`)
    ok++
  } catch (e) {
    fail++
    if (fail <= 5) console.warn(`  실패 ${r.id}: ${e.message}`)
  } finally {
    done++
    if (done % 100 === 0) console.log(`  ${done}/${targets.length} (성공 ${ok})`)
  }
}

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  await Promise.all(targets.slice(i, i + CONCURRENCY).map(processOne))
}
console.log(`\n완료: 사진추출 ${ok} / PDF에 사진없음 ${noPhoto} / PDF아님 ${notPdf} / 실패 ${fail}`)
