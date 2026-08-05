import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { makeToken, normCompany } from '../../../lib/showcaseToken'

/* 기업별 전시장 링크 — 만들고(POST), 보고(GET), 추적을 끊는다(DELETE).

   주소를 서버가 만드는 이유: 서명 시크릿이 서버에만 있다. 브라우저에서 만들면 시크릿을
   내보내야 하고, 그러면 누구나 아무 기업 이름으로 유효한 링크를 찍어낼 수 있다.

   도메인은 접속한 주소가 아니라 NEXT_PUBLIC_SITE_URL 을 쓴다 — 이 링크는 곧바로
   콜드메일에 붙는 값이라, 로컬에서 눌렀다고 localhost 주소가 메일에 들어가면 안 된다.
   (콜드메일 스크립트들과 같은 기본값)

   건수는 showcase_links 가 아니라 events 에서 센다. 링크를 만들 때 0 을 적어 두고
   올려 가는 방식이면 이벤트와 카운터가 언젠가 어긋나고, 어긋난 걸 알아챌 방법이 없다. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const PAGE = '/private/showcasing'
const urlOf = (token) => `${SITE}${PAGE}?c=${token}`

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'POST') {
      const company = normCompany(req.body?.company)
      if (!company) return res.status(400).json({ error: '기업명을 입력해주세요' })
      const campaign = String(req.body?.campaign || 'showcase1').trim() || 'showcase1'
      const token = makeToken(company, campaign)

      // 같은 기업명을 다시 넣으면 같은 토큰이라 같은 행이다 — 중복 발급이 안 생긴다.
      const { error } = await supabase
        .from('showcase_links')
        .upsert({ token, company, campaign }, { onConflict: 'token', ignoreDuplicates: true })
      if (error) throw error

      return res.status(200).json({ token, company, campaign, url: urlOf(token) })
    }

    if (req.method === 'DELETE') {
      const token = String(req.query.token || '')
      if (!token) return res.status(400).json({ error: 'token required' })
      const { error } = await supabase.from('showcase_links').delete().eq('token', token)
      if (error) throw error
      // 이미 찍힌 이벤트는 남겨 둔다 — 링크를 그만 쓰기로 한 것과 그동안 일어난 일을
      // 없던 일로 하는 것은 다르다. 목록에서 빠지고, 앞으로가 안 세질 뿐이다.
      return res.status(200).json({ ok: true })
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const [{ data: links, error: e1 }, { data: evts, error: e2 }] = await Promise.all([
      supabase.from('showcase_links').select('token, company, campaign, created_at').order('created_at', { ascending: false }),
      supabase.from('events').select('event, created_at, meta, client_id').eq('page', PAGE).limit(5000),
    ])
    if (e1) throw e1
    if (e2) throw e2

    // 이벤트는 기업명으로 붙인다 — 토큰 payload 가 곧 기업명이라 둘이 같은 값이다.
    const stat = {}
    for (const e of evts || []) {
      const co = e.meta?.co
      if (!co) continue
      const s = stat[co] || (stat[co] = { opens: 0, submits: 0, meetings: 0, last: null, cids: new Set() })
      if (e.event === 'psc_open') s.opens += 1
      if (e.event === 'psc_submit') s.submits += 1
      if (e.event === 'psc_meeting') s.meetings += 1
      if (e.client_id) s.cids.add(e.client_id)
      if (!s.last || e.created_at > s.last) s.last = e.created_at
    }

    const rows = (links || []).map((l) => {
      const s = stat[l.company]
      return {
        ...l,
        url: urlOf(l.token),
        opens: s?.opens || 0,
        submits: s?.submits || 0,
        meetings: s?.meetings || 0,
        visitors: s ? s.cids.size : 0,
        lastAt: s?.last || null,
      }
    })

    return res.status(200).json({ rows })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
