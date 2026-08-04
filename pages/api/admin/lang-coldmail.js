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

/* 들어온 값이 어떤 종류인지 — 이 캠페인의 원래 목적이 "자기서술 52% 를 자격증·점수로
   바꾸기"라, 전환율만큼이나 값의 생김새가 결론을 좌우한다. 전환 10% 를 넘겨도 전부
   자기서술이면 지금과 같은 데이터가 늘어난 것뿐이다.
   판정 기준은 LanguageCard 의 splitCert 와 같아야 한다 — 다르면 화면과 표가 어긋난다. */
const CERTS = ['TOEIC', 'IELTS', 'TOEFL', 'VSTEP', 'APTIS', 'TOPIK']
const LEVELS = ['Native', 'Fluent', 'Business', 'Intermediate', 'Basic', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']
function kindOf(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  if (s.toLowerCase() === 'none') return 'none'                               // 못한다고 명시
  if (CERTS.some((c) => new RegExp(`^${c}\\b`, 'i').test(s))) return 'score'  // "TOEIC 900"
  if (/^[A-C][12]$/i.test(s) || LEVELS.some((l) => l.toLowerCase() === s.toLowerCase())) return 'level'
  return 'other'                                                              // 미지의 자격증·자유서술
}

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

    /* 실제로 들어온 값 목록. 비율만 보면 "무엇이 들어왔는지"를 못 본다 — 이 캠페인의
       원래 목적이 자기서술 52% 를 자격증·점수로 바꾸는 거라, 들어온 값의 생김새가
       전환율만큼 중요하다. 프로필의 현재 값을 읽는다(이벤트에는 값을 안 남긴다).
       같은 사람이 두 번 저장하면 첫 저장 시각으로 한 줄만 남긴다 — 전환을 세는 방식과 같다. */
    const firstFill = {}
    for (const e of evts) {
      if (e.event !== 'coldmail_lang_fill' || !e.user_id) continue
      if (!firstFill[e.user_id]) firstFill[e.user_id] = { at: e.created_at, campaign: e.meta?.campaign || null }
    }
    const fillIds = Object.keys(firstFill)
    let fills = []
    if (fillIds.length) {
      // 200명 캠페인이라 한 번에 들어간다. 캠페인이 커지면 여기서 쪼개야 한다.
      const { data: profs } = await supabase
        .from('user_profiles').select('id, full_name, english_cert, korean_cert').in('id', fillIds)
      fills = (profs || [])
        .map((p) => ({
          name: p.full_name || '(이름 없음)',
          english_cert: p.english_cert || '',
          korean_cert: p.korean_cert || '',
          englishKind: kindOf(p.english_cert),
          koreanKind: kindOf(p.korean_cert),
          campaign: firstFill[p.id]?.campaign || null,
          at: firstFill[p.id]?.at || null,
        }))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    }

    // A/B 판정은 두 arm 이 다 있을 때만. 세 개 이상이면 이름순 앞의 둘을 쓴다.
    const A = rows.find((r) => r.campaign === 'coldmail-language-1')
    const B = rows.find((r) => r.campaign === 'coldmail-language-2')
    const ab = (A && B) ? {
      a: A.campaign, b: B.campaign,
      click: zTest(A.clicked, A.sent, B.clicked, B.sent),
      fill: zTest(A.filled, A.sent, B.filled, B.sent),
    } : null

    // 사람 단위 종류 — 한 사람이 영어·한국어 둘 다 넣었으면 더 구체적인 쪽으로 센다
    // (score > other > level > none). "점수를 받아냈나"가 질문이라 그쪽이 답에 가깝다.
    // 행마다 kind 를 같이 내려보낸다. 화면에서 다시 계산하면 칩의 숫자와 필터 결과가
    // 어긋날 수 있다 — 같은 판정을 두 곳에 두지 않는다.
    const RANK = { score: 3, other: 2, level: 1, none: 0 }
    const kinds = { score: 0, other: 0, level: 0, none: 0 }
    // arm 별로도 나눈다 — "제목이 주제를 밝히면(B) 실제로 어학이 되는 사람만 들어온다"는
    // 가설은 전환율이 아니라 들어온 값의 종류로만 확인된다. B 는 클릭이 적어도 점수 비율이
    // 높아야 가설이 맞는 것이므로, 두 수를 같은 카드에서 나란히 봐야 한다.
    const kindsByArm = {}
    for (const f of fills) {
      const ks = [f.englishKind, f.koreanKind].filter(Boolean)
      f.kind = ks.length ? ks.slice().sort((a, b) => RANK[b] - RANK[a])[0] : null
      if (!f.kind) continue
      kinds[f.kind]++
      const k = (kindsByArm[f.campaign] = kindsByArm[f.campaign] || { score: 0, other: 0, level: 0, none: 0 })
      k[f.kind]++
    }
    for (const r of rows) r.kinds = kindsByArm[r.campaign] || { score: 0, other: 0, level: 0, none: 0 }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      rows,
      ab,
      fills,
      kinds,
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