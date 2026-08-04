import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// "유진 작업실 > 어학 콜드메일" — 어학 정보 수집 콜드메일의 제목 A/B 판독.
//
// 승주 작업실의 캠페인 표와 분리한 이유: 그 표의 '전환'은 가입/등록/공개/지원 넷 중
// 하나인데 여기 전환은 '어학 입력'이라 같은 컬럼에 넣으면 세로 비교가 깨진다.
// 게다가 이 캠페인의 핵심 질문(제목 A/B, 어느 버튼이 눌렸나)은 그 표에 컬럼이 없다.
//
// arm = meta.campaign 값 그대로. coldmail-language-1(A: 주제를 감춘 제목) /
//       coldmail-language-2(B: 그대로 묻는 제목). 본문·버튼은 두 arm 이 동일하다.
//
// 퍼널: coldmail_lang_sent → coldmail_lang_click → coldmail_lang_fill
//       click 은 meta.cta(score|daily|basic|none)로 어느 버튼인지도 남는다.
//       none 은 카드 밖 회색 링크('영어·한국어 모두 못합니다')다. 다른 셋과 같은 줄에
//       세워 두면 잠식 여부를 못 본다 — 비율이 아니라 절대 수로 따로 읽을 것.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const EVENTS = ['coldmail_lang_sent', 'coldmail_lang_click', 'coldmail_lang_fill']

async function fetchAll(build) {
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/* 두 비율의 차이에 대한 양측 z-검정. 표본이 작을 때 "차이 없음"과 "모름"을 구분하려고
   p 값을 같이 낸다 — 화면에 비율만 띄우면 3%p 차이를 결론처럼 읽게 된다.
   정규근사라 성공/실패 기대빈도가 5 미만이면 신뢰할 수 없어 null 을 반환한다. */
function zTest(x1, n1, x2, n2) {
  if (!n1 || !n2) return null
  const p1 = x1 / n1, p2 = x2 / n2
  const p = (x1 + x2) / (n1 + n2)
  if (Math.min(n1 * p, n1 * (1 - p), n2 * p, n2 * (1 - p)) < 5) return null
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  if (!se) return null
  const z = (p1 - p2) / se
  // 표준정규 양측 p — Abramowitz & Stegun 26.2.17 근사
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp(-z * z / 2)
  const pv = 2 * d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return { z, p: Math.min(1, Math.max(0, pv)) }
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const evts = await fetchAll(() => supabase.from('events')
      .select('event, user_id, created_at, meta')
      .in('event', EVENTS)
      .order('created_at'))

    const arms = {}
    // 사람 단위로 센다 — 같은 사람의 재클릭(메일 스캐너 중복 포함)이 비율을 부풀리지 않게.
    const arm = (name) => (arms[name] = arms[name] || {
      campaign: name,
      sent: new Set(), click: new Set(), fill: new Set(),
      cta: { score: new Set(), daily: new Set(), basic: new Set(), none: new Set() },
      firstSentAt: null, lastSentAt: null,
    })

    for (const e of evts) {
      // 수신자는 전원 회원(이력서 보유자)이라 user_id 가 있다. 없으면 발송 스크립트가
      // 잘못 심은 것 — 사람을 못 세므로 조용히 버리지 않고 unattributed 로 센다.
      const pid = e.user_id || e.meta?.lead || null
      const a = arm(e.meta?.campaign || '(campaign 누락)')
      if (e.event === 'coldmail_lang_sent') {
        if (pid) a.sent.add(pid)
        if (!a.firstSentAt || e.created_at < a.firstSentAt) a.firstSentAt = e.created_at
        if (!a.lastSentAt || e.created_at > a.lastSentAt) a.lastSentAt = e.created_at
      } else if (e.event === 'coldmail_lang_click') {
        if (pid) a.click.add(pid)
        const c = e.meta?.cta
        if (pid && a.cta[c]) a.cta[c].add(pid)
      } else if (e.event === 'coldmail_lang_fill') {
        if (pid) a.fill.add(pid)
      }
    }

    const rows = Object.values(arms)
      .map((a) => ({
        campaign: a.campaign,
        sent: a.sent.size,
        clicked: a.click.size,
        filled: a.fill.size,
        clickRate: a.sent.size ? a.click.size / a.sent.size : 0,
        fillRate: a.sent.size ? a.fill.size / a.sent.size : 0,
        clickToFill: a.click.size ? a.fill.size / a.click.size : 0,
        cta: { score: a.cta.score.size, daily: a.cta.daily.size, basic: a.cta.basic.size, none: a.cta.none.size },
        firstSentAt: a.firstSentAt,
        lastSentAt: a.lastSentAt,
      }))
      .sort((x, y) => x.campaign.localeCompare(y.campaign))

    // A/B 판정은 두 arm 이 다 있을 때만. 세 개 이상이면 이름순 앞의 둘을 쓴다.
    const A = rows.find((r) => r.campaign === 'coldmail-language-1')
    const B = rows.find((r) => r.campaign === 'coldmail-language-2')
    const ab = (A && B) ? {
      a: A.campaign, b: B.campaign,
      click: zTest(A.clicked, A.sent, B.clicked, B.sent),
      fill: zTest(A.filled, A.sent, B.filled, B.sent),
    } : null

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      rows,
      ab,
      totals: {
        sent: rows.reduce((s, r) => s + r.sent, 0),
        clicked: rows.reduce((s, r) => s + r.clicked, 0),
        filled: rows.reduce((s, r) => s + r.filled, 0),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}