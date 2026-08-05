// 사진 없는 인재의 소셜 로그인 아바타(구글/링크드인)를 vision 으로 "실제 인물사진"인지
// 검증해 통과분만 프로필 사진으로 채운다. 기본 이니셜 아바타/만화/로고는 vision 이 거른다.
// 구글 URL 직링크는 만료·403 이슈가 있어 profiles 버킷에 복사(<id>/photo_social.<ext>).
// CV 추출 사진(photo_cv)이 있는 사람은 대상 아님 — CV 사진이 항상 우선.
// 멱등: photo_url 있는 행은 건너뜀. node scripts/backfill-social-photos.mjs
import { sb, fetchAll } from './outreach/lib.mjs'
import { isPortraitPhoto } from '../lib/parseResume.js'

const rows = await fetchAll(() => sb
  .from('user_profiles')
  .select('id, photo_url')
  .not('resume_url', 'is', null)
  .neq('resume_url', '')
)
const targetIds = new Set(rows.filter(r => !r.photo_url).map(r => r.id))

// auth 메타데이터에서 아바타 URL 수집
const avatars = {}
let page = 1
while (true) {
  const { data: { users }, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
  if (error || !users?.length) break
  for (const u of users) {
    if (!targetIds.has(u.id)) continue
    const av = u.user_metadata?.avatar_url || u.user_metadata?.picture
    if (av) avatars[u.id] = av
  }
  if (users.length < 1000) break
  page++
}
const targets = Object.entries(avatars)
console.log(`사진 없음 ${targetIds.size}명 중 소셜 아바타 보유 ${targets.length}명 → 검증 시작`)

// 구글 아바타는 기본 96px — 크게 요청 (=s400-c)
const upsize = (url) => /googleusercontent\.com/.test(url)
  ? (url.includes('=') ? url.replace(/=s\d+(-c)?/, '=s400-c') : `${url}=s400-c`)
  : url

const sniff = (buf) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: 'image/png', ext: 'png' }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

let ok = 0, rejected = 0, fail = 0, done = 0
const CONCURRENCY = 5

async function processOne([userId, url]) {
  try {
    const res = await fetch(upsize(url))
    if (!res.ok) throw new Error(`download ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const kind = sniff(buf)
    if (!kind || buf.length < 2000) { rejected++; return } // 미지원 포맷/깡통 이미지
    let pass = false
    try { pass = await isPortraitPhoto(buf, kind.mime) } catch (e) {
      if (!/unsupported image/i.test(e.message || '')) throw e
    }
    if (!pass) { rejected++; return }
    const path = `${userId}/photo_social.${kind.ext}`
    const { error: upErr } = await sb.storage.from('profiles').upload(path, buf, { contentType: kind.mime, upsert: true })
    if (upErr) throw new Error(`upload: ${upErr.message}`)
    const publicUrl = sb.storage.from('profiles').getPublicUrl(path).data?.publicUrl
    if (!publicUrl) throw new Error('no public url')
    const { error: dbErr } = await sb.from('user_profiles').update({ photo_url: publicUrl }).eq('id', userId)
    if (dbErr) throw new Error(`db: ${dbErr.message}`)
    ok++
  } catch (e) {
    fail++
    if (fail <= 5) console.warn(`  실패 ${userId}: ${e.message}`)
  } finally {
    done++
    if (done % 100 === 0) console.log(`  ${done}/${targets.length} (채움 ${ok} / 탈락 ${rejected})`)
  }
}

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  await Promise.all(targets.slice(i, i + CONCURRENCY).map(processOne))
}
console.log(`\n완료: 인물사진 채움 ${ok} / vision 탈락 ${rejected} / 실패 ${fail}`)
