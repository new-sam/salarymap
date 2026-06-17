import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)

  const type = fields.type?.[0] // 'photo' or 'resume'
  const file = files.file?.[0]
  if (!file || !type) return res.status(400).json({ error: 'file and type required' })

  const bucket = type === 'photo' ? 'profiles' : 'resumes'
  const ext = type === 'photo' ? 'jpg' : 'pdf'
  const path = `${user.id}.${ext}`

  const fileBuffer = fs.readFileSync(file.filepath)
  const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType: file.mimetype,
    upsert: true,
  })
  if (uploadErr) return res.status(500).json({ error: uploadErr.message })

  // 경로가 user.id로 고정(upsert)이라 public URL이 매번 동일하다.
  // 그대로 두면 (1) 앱의 resume_url/photo_url이 안 바뀌어 변경을 못 알아채고
  // (2) Storage CDN 캐시(기본 max-age=3600)가 교체 전 옛 파일을 계속 서빙한다.
  // 업로드마다 바뀌는 버전 쿼리를 붙여 URL을 갱신 → 캐시 우회 + 클라이언트 변경 감지.
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // Update profile (upsert, not update: mobile OAuth users may not have a user_profiles
  // row yet — they never hit the web /auth/callback that inserts it — so a plain .update()
  // would silently affect 0 rows and the uploaded URL would never be saved).
  const updateField = type === 'photo' ? 'photo_url' : 'resume_url'
  const profileRow = {
    id: user.id,
    email: user.email,
    [updateField]: publicUrl,
    updated_at: new Date().toISOString(),
  }
  // 이력서 업로드 출처(app/web) 기록. 앱(salary-fyi)은 X-Client-Platform: app 헤더를 붙인다.
  if (type === 'resume') {
    profileRow.resume_platform = req.headers['x-client-platform'] === 'app' ? 'app' : 'web'
  }

  const upsert = (row) => supabase.from('user_profiles').upsert(row, { onConflict: 'id' })
  let { error: profileErr } = await upsert(profileRow)
  // resume_platform 컬럼은 20260617 마이그레이션이 추가한다. 아직 미적용이면 PostgREST가
  // 컬럼 부재(PGRST204)를 알린다 — 업로드 자체는 막지 말고 출처 없이 재시도해 URL은 저장한다.
  if (profileErr && (profileErr.code === 'PGRST204' || /resume_platform/.test(profileErr.message || ''))) {
    const { resume_platform, ...withoutPlatform } = profileRow
    await upsert(withoutPlatform)
  }

  res.json({ url: publicUrl })
}
