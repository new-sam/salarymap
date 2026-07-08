import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { verifyAdminOrDevStub } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 기업 공고 제목(주로 베트남어) → 한국어. 번역 결과는 events 테이블에 캐시
// (event='job_title_ko', meta={title, ko}) — 활동로그와 같은 "별도 테이블 없이 events
// 재사용, 마이그레이션 0" 패턴. 이미 번역된 제목은 DB에서 읽고, 새 제목만 gpt-4o-mini
// 배치 1회로 번역해 캐시에 적재한다. 반복 로드는 OpenAI 호출 0회.
// 키 없거나 실패해도 캐시분은 반환(신규분만 원문 유지) — 절대 화면을 깨지 않음.
export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // 제목과 캐시는 독립 — 병렬 조회
  const [titlesRes, cacheRes] = await Promise.all([
    supabase.from('jobs').select('title').not('company_id', 'is', null),
    supabase.from('events').select('meta').eq('event', 'job_title_ko').limit(2000),
  ])
  const titles = [...new Set((titlesRes.data || []).map(j => j.title).filter(Boolean))]
  const map = {}
  for (const r of cacheRes.data || []) {
    if (r.meta?.title && r.meta?.ko) map[r.meta.title] = r.meta.ko
  }

  const missing = titles.filter(t => !map[t])
  if (missing.length > 0 && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You translate job titles (mostly Vietnamese) into short natural Korean. Return JSON: {"t": {"<original>": "<korean>", ...}}. Keep each translation concise (role name only).' },
          { role: 'user', content: JSON.stringify(missing) },
        ],
      })
      const fresh = JSON.parse(completion.choices[0].message.content || '{}').t || {}
      const rows = Object.entries(fresh)
        .filter(([t, k]) => missing.includes(t) && k)
        .map(([t, k]) => ({ event: 'job_title_ko', meta: { title: t, ko: k } }))
      if (rows.length) await supabase.from('events').insert(rows)
      Object.assign(map, fresh)
    } catch {
      // 번역 실패 — 캐시분만 반환
    }
  }

  res.setHeader('Cache-Control', 'private, max-age=300')
  return res.status(200).json({ map })
}
