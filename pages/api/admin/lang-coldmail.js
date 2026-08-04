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
/* 메일 버튼 → 랜딩이 미리 채워 넣는 값. pages/lang.js 의 LEVEL_OF + cta=none 처리와
   같아야 한다. 이 값이 그대로 저장됐다면 그 사람이 "수준을 서술한" 게 아니라 버튼을
   누르고 저장만 누른 것이다 — 정보량이 클릭한 버튼과 같다는 뜻이라, 'Intermediate 7건'
   을 자기서술 데이터로 읽으면 안 된다. */
const PRESET = { daily: 'Intermediate', basic: 'Basic', none: 'None' }

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

    /* wave — 같은 캠페인 ID 를 쓰되 모집단이 다른 코호트.
         wave 1 = 콜드메일을 한 번도 안 받은 사람 200명
         wave 2 = 이미 다른 콜드메일을 받은 적 있는 사람 260명
       두 코호트를 한 숫자로 뭉치면 전환율이 무엇을 뜻하는지 알 수 없게 된다. 제목 A/B 는
       wave 안에서 교대 배정하므로 wave 별로 봐도 비교는 그대로 성립한다.
       wave 는 발송 이벤트에만 있다 — 클릭·저장은 랜딩에서 찍히는데 거기선 wave 를 모른다.
       그래서 발송 기록으로 user_id → wave 를 만들어 클릭·저장에 되붙인다. */
    const waveOf = {}
    for (const e of evts) {
      if (e.event === 'coldmail_lang_sent' && e.user_id) waveOf[e.user_id] = Number(e.meta?.wave) || 1
    }

    const arms = {}
    // 사람 단위로 센다 — 같은 사람의 재클릭(메일 스캐너 중복 포함)이 비율을 부풀리지 않게.
    const arm = (name, wave) => (arms[`${name}::${wave}`] = arms[`${name}::${wave}`] || {
      campaign: name, wave,
      sent: new Set(), click: new Set(), fill: new Set(),
      cta: { score: new Set(), daily: new Set(), basic: new Set(), none: new Set() },
      firstSentAt: null, lastSentAt: null,
    })

    for (const e of evts) {
      // 수신자는 전원 회원(이력서 보유자)이라 user_id 가 있다. 없으면 발송 스크립트가
      // 잘못 심은 것 — 사람을 못 세므로 조용히 버리지 않고 unattributed 로 센다.
      const pid = e.user_id || e.meta?.lead || null
      const a = arm(e.meta?.campaign || '(campaign 누락)', waveOf[e.user_id] || 1)
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
        wave: a.wave,
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
    // 저장 직전에 누른 버튼 — 저장된 값이 본인 답인지 우리가 넣어준 값인지 가르는 기준이다.
    const ctaOf = {}
    for (const e of evts) {
      if (e.event !== 'coldmail_lang_click' || !e.user_id) continue
      if (firstFill[e.user_id] && e.created_at <= firstFill[e.user_id].at) ctaOf[e.user_id] = e.meta?.cta || null
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
          cta: ctaOf[p.id] ?? null,
          // 프리셀렉트 값을 손대지 않고 저장했는가. true 면 그 값은 '자기서술'이 아니라
          // '버튼 그대로'다.
          keptPreset: !!PRESET[ctaOf[p.id]] &&
            [p.english_cert, p.korean_cert].filter(Boolean).every((v) => v === PRESET[ctaOf[p.id]]),
          campaign: firstFill[p.id]?.campaign || null,
          wave: waveOf[p.id] || 1,
          at: firstFill[p.id]?.at || null,
        }))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    }

    // 사람 단위 종류 — 한 사람이 영어·한국어 둘 다 넣었으면 더 구체적인 쪽으로 센다
    // (score > other > level > none). "점수를 받아냈나"가 질문이라 그쪽이 답에 가깝다.
    // 행마다 kind 를 같이 내려보낸다. 화면에서 다시 계산하면 칩의 숫자와 필터 결과가
    // 어긋날 수 있다 — 같은 판정을 두 곳에 두지 않는다.
    const RANK = { score: 3, other: 2, level: 1, none: 0 }
    for (const f of fills) {
      const ks = [f.englishKind, f.koreanKind].filter(Boolean)
      f.kind = ks.length ? ks.slice().sort((a, b) => RANK[b] - RANK[a])[0] : null
    }

    /* wave 단위로 같은 묶음을 만든다. 두 코호트를 한 카드에 합치면 전환율이 무엇을 뜻하는지
       알 수 없다 — wave 1 은 콜드메일을 처음 받는 사람, wave 2 는 최근에 다른 메일을 받은
       사람이라 반응이 같을 이유가 없다. 나중에 합칠 땐 이 그룹핑만 걷어내면 된다. */
    const tally = (fs) => {
      const k = { score: 0, other: 0, level: 0, none: 0 }
      for (const f of fs) if (f.kind) k[f.kind]++
      return k
    }
    const waves = [...new Set(rows.map((r) => r.wave))].sort((a, b) => a - b).map((w) => {
      const wRows = rows.filter((r) => r.wave === w)
      const wFills = fills.filter((f) => f.wave === w)
      // arm 별 값 종류 — "제목이 주제를 밝히면(B) 어학 되는 사람만 온다"는 가설은
      // 전환 수가 아니라 이 분포로만 확인된다.
      for (const r of wRows) r.kinds = tally(wFills.filter((f) => f.campaign === r.campaign))
      const A = wRows.find((r) => r.campaign === 'coldmail-language-1')
      const B = wRows.find((r) => r.campaign === 'coldmail-language-2')
      return {
        wave: w,
        rows: wRows,
        fills: wFills,
        kinds: tally(wFills),
        /* 버튼 → 저장값 매핑. "Intermediate 7건"이 자기서술로 읽히면 안 되므로, 버튼별로
           프리셀렉트를 그대로 둔 사람과 직접 고친 사람을 나눠 센다. */
        mapping: ['score', 'daily', 'basic', 'none'].map((c) => {
          const g = wFills.filter((f) => f.cta === c)
          return {
            cta: c,
            preset: PRESET[c] || null,
            n: g.length,
            kept: g.filter((f) => f.keptPreset).length,
            changed: g.filter((f) => !f.keptPreset).length,
          }
        }).filter((m) => m.n > 0),
        ab: (A && B) ? {
          a: A.campaign, b: B.campaign,
          click: zTest(A.clicked, A.sent, B.clicked, B.sent),
          fill: zTest(A.filled, A.sent, B.filled, B.sent),
        } : null,
        totals: {
          sent: wRows.reduce((s, r) => s + r.sent, 0),
          clicked: wRows.reduce((s, r) => s + r.clicked, 0),
          filled: wRows.reduce((s, r) => s + r.filled, 0),
        },
      }
    })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      waves,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}