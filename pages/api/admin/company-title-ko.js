import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { verifyAdminOrDevStub } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 기업 공고 제목(주로 베트남어) → 한국어. 메인 지표 엔드포인트와 분리해 비동기로 로드
// (표는 즉시 뜨고 번역은 뒤이어 채워짐). 짧은 제목 배치 1회(gpt-4o-mini)라 토큰 적음.
// 키 없거나 실패하면 빈 맵 반환(원문 유지).
export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data } = await supabase.from('jobs').select('title').not('company_id', 'is', null)
  const titles = [...new Set((data || []).map(j => j.title).filter(Boolean))]

  if (!process.env.OPENAI_API_KEY || titles.length === 0) {
    return res.status(200).json({ map: {} })
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You translate job titles (mostly Vietnamese) into short natural Korean. Return JSON: {"t": {"<original>": "<korean>", ...}}. Keep each translation concise (role name only).' },
        { role: 'user', content: JSON.stringify(titles) },
      ],
    })
    const map = JSON.parse(completion.choices[0].message.content || '{}').t || {}
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.status(200).json({ map })
  } catch {
    return res.status(200).json({ map: {} })
  }
}
