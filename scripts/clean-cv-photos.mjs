// 8/5 사고 청소: CV에서 추출해 올린 프로필 사진(<id>/photo_*.jpg — 백필분 photo_cv +
// 웹 /cv 파싱분 photo_<hex>) 중 실제 인물사진이 아닌 것(템플릿 배너/로고/장식)과 손상
// JPEG(vision 400)를 photo_url 해제 + 파일 삭제. 직접 업로드(<id>.jpg 루트)는 안 건드린다.
// photo_url 은 유저 대면 프로필에도 쓰이는 컬럼이라 오염분 방치 불가. 멱등(재실행 안전).
// node scripts/clean-cv-photos.mjs
import { sb, fetchAll } from './outreach/lib.mjs'
import { isPortraitPhoto } from '../lib/parseResume.js'

const rows = await fetchAll(() => sb
  .from('user_profiles')
  .select('id, photo_url')
  .like('photo_url', '%/photo\\_%')
)
console.log(`CV 추출 사진 ${rows.length}건 검증 시작`)

let keep = 0, removed = 0, fail = 0, done = 0
const CONCURRENCY = 5

const storagePath = (url) => decodeURIComponent(url.split('/object/public/profiles/')[1] || '')

async function processOne(r) {
  try {
    const res = await fetch(r.photo_url)
    if (!res.ok) throw new Error(`download ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    let ok = false
    try {
      ok = await isPortraitPhoto(buf)
    } catch (e) {
      if (!/unsupported image/i.test(e.message || '')) throw e
      ok = false // 손상 JPEG — 표시도 제대로 안 되니 제거
    }
    if (ok) { keep++; return }
    // 인물사진 아님/손상 → photo_url 해제 + 스토리지 파일 삭제
    const { error: dbErr } = await sb.from('user_profiles').update({ photo_url: null }).eq('id', r.id)
    if (dbErr) throw new Error(`db: ${dbErr.message}`)
    const p = storagePath(r.photo_url)
    if (p) await sb.storage.from('profiles').remove([p])
    removed++
  } catch (e) {
    fail++
    if (fail <= 5) console.warn(`  실패 ${r.id}: ${e.message}`)
  } finally {
    done++
    if (done % 50 === 0) console.log(`  ${done}/${rows.length} (유지 ${keep} / 제거 ${removed})`)
  }
}

for (let i = 0; i < rows.length; i += CONCURRENCY) {
  await Promise.all(rows.slice(i, i + CONCURRENCY).map(processOne))
}
console.log(`\n완료: 인물사진 유지 ${keep} / 제거 ${removed} / 실패 ${fail}`)
