import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
// 점수/자기서술 판정은 어학 점수 패널·발송 스크립트와 같은 함수를 쓴다.
import { certOf } from '../../../lib/langTier'

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

/* coldmail_lang_same — 5차 재확인의 '그대로입니다'. fill 과 이름을 나눈 이유: 그건
   새로 받아낸 입력이 아니라 기존 값의 확인이라, 같은 칸에 세면 전환율이 부풀어 오른다.
   그래서 세는 것도 따로 세고 화면에도 따로 그린다. */
const EVENTS = ['coldmail_lang_sent', 'coldmail_lang_click', 'coldmail_lang_view', 'coldmail_lang_fill', 'coldmail_lang_same']

/* 같은 이벤트 이름을 쓰는 캠페인이 여럿이다 — 전환 정의가 '어학 입력'으로 같아서다.
   그러나 모집단이 달라 한 표에 합치면 전환율이 무엇의 전환율인지 알 수 없다.
     language = 제목 A/B (coldmail-language-1/2), wave 로 코호트가 또 갈린다
     ktc      = KTC 유입자 (coldmail-ktc-lang-1)
     resume   = 이력서 O · FYI 지원 0 (coldmail-lang-resume-1)
     ghost    = 이력서 X · FYI 지원 0 (coldmail-lang-ghost-1)
     nocert   = 이력서 O · 어학 빔 · 지원 여부 무관 (coldmail-lang-nocert-*)
     recheck  = 어학은 적었지만 점수가 아닌 층의 재확인 (coldmail-lang-recheck-*)
   language 외에는 wave 를 안 쓴다 — meta.wave 가 없어 1 로 떨어지는데, 계열로 먼저
   가르지 않으면 그대로 어학 wave 1 숫자에 섞인다. */
const familyOf = (campaign) =>
  /^coldmail-ktc-lang/.test(campaign) ? 'ktc'
    : /^coldmail-lang-resume/.test(campaign) ? 'resume'
      : /^coldmail-lang-ghost/.test(campaign) ? 'ghost'
        : /^coldmail-lang-exam/.test(campaign) ? 'exam'
          : /^coldmail-lang-recheck/.test(campaign) ? 'recheck'
            : /^coldmail-lang-nocert/.test(campaign) ? 'nocert'
              : /^coldmail-language/.test(campaign) ? 'language'
                : 'other'

/* 들어온 값이 어떤 종류인지 — 이 캠페인의 원래 목적이 "자기서술 52% 를 자격증·점수로
   바꾸기"라, 전환율만큼이나 값의 생김새가 결론을 좌우한다. 전환 10% 를 넘겨도 전부
   자기서술이면 지금과 같은 데이터가 늘어난 것뿐이다.
   판정 기준은 LanguageCard 의 splitCert 와 같아야 한다 — 다르면 화면과 표가 어긋난다. */
// CEFR 은 시험이 아니라 척도지만 langTier 가 급수를 매기는 값이라 여기서도 점수로 센다.
// 빠뜨리면 CEFR 로 저장된 값이 '미지의 자격증'으로 떨어져 회수 실적이 0 으로 보인다.
const CERTS = ['TOEIC', 'IELTS', 'TOEFL', 'VSTEP', 'APTIS', 'TOPIK', 'CEFR']
const LEVELS = ['Native', 'Fluent', 'Business', 'Intermediate', 'Basic', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']
/* 베트남어 수준 표현 — 이게 없으면 'Co ban'(기초)·'Giao tiep'(회화) 같은 값이 전부
   '기타'로 떨어져, 실제로는 자기서술인데 "우리가 못 읽는 값"처럼 보인다.
   실발송이 베트남어인 캠페인에서 영어 단어만 수준으로 인정하고 있었다. */
const VI_LEVELS = /(co\u0301? ?ba\u0309n|c\u01a1 b\u1ea3n|s\u01a1 c\u1ea5p|trung c\u1ea5p|cao c\u1ea5p|giao ti\u1ebfp|th\u00e0nh th\u1ea1o|b\u1ea3n ng\u1eef|ti\u1ebfng m\u1eb9 \u0111\u1ebb|ng\u00f4n ng\u1eef ch\u00ednh|kh\u00e1|t\u1ed1t|trung b\u00ecnh|\u0111\u1ecdc hi\u1ec3u|nghe|n\u00f3i|vi\u1ebft)/i
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
  if (VI_LEVELS.test(s)) return 'level'                    // 베트남어 수준 표현도 자기서술이다
  return 'other'                                                              // 미지의 자격증·자유서술
}

/* 넘겨받는 쿼리에는 반드시 유일한 정렬키가 있어야 한다 — ORDER BY 없이(또는 created_at
   처럼 값이 겹칠 수 있는 키만으로) range() 페이지를 넘기면 Postgres 가 행 순서를
   보장하지 않아 페이지마다 행이 중복되거나 빠진다. events 의 coldmail 행이 17,621개라
   실제로 이게 터졌다(같은 집계가 실행마다 1072/1452/670 으로 달라졌다). */
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
      .order('created_at').order('id'))

    /* 응답 원본(append-only). 계측이 바뀌기 전 회차를 여기서 읽는다.

       '점수 갱신'은 fill 이벤트의 meta.saved 로, '그대로 확인'은 coldmail_lang_same
       이벤트로 센다. 둘 다 2026-08-21 에 붙인 계측이라 5차(8/19)에는 한 줄도 없다.
       그렇다고 0 으로 두면 "안 됐다"로 읽히는데, 실제로는 자격증 5건·그대로 11건이
       들어왔다. 그때 값이 이 표에 그대로 남아 있으므로 회차별로 여기서 채운다.
       events 와 큰 쪽을 쓴다 — 6차부터는 이벤트가 더 정확하고(응답 로그 insert 가
       실패해도 이벤트는 남는다), 5차는 이쪽에만 있다. */
    const legacy = {}
    const isCertText = (v) => CERTS.some((c) => new RegExp(`^${c}\\b`, 'i').test(String(v || '').trim()))
    for (const r of await fetchAll(() => supabase.from('coldmail_lang_responses')
      .select('user_id, campaign, cta, english_cert, korean_cert').order('id'))) {
      if (!r.user_id || !r.campaign) continue
      const g = legacy[r.campaign] = legacy[r.campaign] || { scored: new Set(), same: new Set() }
      if (isCertText(r.english_cert) || isCertText(r.korean_cert)) g.scored.add(r.user_id)
      if (r.cta === 'same') g.same.add(r.user_id)
    }

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

    /* round — 어학 재확인 시리즈의 몇 번째 회차인가('R7' 등). wave 와 같은 이유로
       발송 이벤트에만 실려 있어 캠페인 단위로 되읽는다. 캠페인 ID 는 '무엇을 물었나'를,
       round 는 '몇 번째였나'를 뜻해서 둘을 따로 둔다 — 계열로 묶는 것과 순서대로
       세우는 것을 한 값으로는 둘 다 할 수 없다.
       round 를 안 실은 옛 캠페인은 null 로 남는다(표시하지 않으면 그만이다). */
    const roundOfCampaign = {}
    for (const e of evts) {
      if (e.event !== 'coldmail_lang_sent') continue
      const c = e.meta?.campaign, r = e.meta?.round
      if (c && r && !roundOfCampaign[c]) roundOfCampaign[c] = String(r)
    }

    const arms = {}
    // 사람 단위로 센다 — 같은 사람의 재클릭(메일 스캐너 중복 포함)이 비율을 부풀리지 않게.
    // 캠페인 하나가 한 줄이다. wave 로 쪼개던 것을 합쳤으므로 language 는 A/B 두 줄
    // (230/230)이 된다. 다시 쪼개려면 키에 wave 를 되붙이면 된다 — waveOf 는 남아 있고
    // fills 에도 wave 가 그대로 실린다.
    const arm = (name) => (arms[name] = arms[name] || {
      campaign: name,
      sent: new Set(), click: new Set(), fill: new Set(), same: new Set(),
      // same = 재확인 회차의 '그대로입니다' 버튼. 다른 회차엔 없어 항상 0 이다.
      cta: {
        score: new Set(), daily: new Set(), basic: new Set(), none: new Set(), same: new Set(),
        // 7차('어느 시험이었나요') — vstep·aptis 는 원탭 확정, exam 은 폼, self 는 이탈구.
        vstep: new Set(), aptis: new Set(), exam: new Set(), self: new Set(),
      },
      view: new Set(),
      // 저장된 값이 실제 자격증 형태였는지. 저장(fill)만 세면 cta=score 를 눌러놓고
      // "Basic" 을 저장한 사람까지 점수 갱신으로 잡힌다 — 1 차에서 실제로 나왔다.
      fillCert: new Set(),
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
      } else if (e.event === 'coldmail_lang_view') {
        if (pid) a.view.add(pid)
      } else if (e.event === 'coldmail_lang_fill') {
        if (pid) a.fill.add(pid)
        if (pid && e.meta?.saved === 'cert') a.fillCert.add(pid)
      } else if (e.event === 'coldmail_lang_same') {
        if (pid) a.same.add(pid)
      }
    }

    const rows = Object.values(arms)
      .map((a) => ({
        campaign: a.campaign,
        round: roundOfCampaign[a.campaign] || null,   // 'R7' — 없으면 표시하지 않는다
        sent: a.sent.size,
        clicked: a.click.size,
        // 사람이 브라우저로 연 수. click 과의 차이가 메일 스캐너 프리페치다.
        viewed: a.view.size,
        filled: a.fill.size,
        // 재확인 회차의 결론. filled 와 달리 자격증 형태로 들어온 것만 센다.
        // meta.saved 는 2026-08-21 부터 실린다 — 그 이전 회차는 응답 원본에서 채운다.
        scored: Math.max(a.fillCert.size, legacy[a.campaign]?.scored.size || 0),
        same: Math.max(a.same.size, legacy[a.campaign]?.same.size || 0),
        clickRate: a.sent.size ? a.click.size / a.sent.size : 0,
        sameRate: a.sent.size ? Math.max(a.same.size, legacy[a.campaign]?.same.size || 0) / a.sent.size : 0,
        fillRate: a.sent.size ? a.fill.size / a.sent.size : 0,
        clickToFill: a.click.size ? a.fill.size / a.click.size : 0,
        cta: {
          score: a.cta.score.size, daily: a.cta.daily.size, basic: a.cta.basic.size,
          none: a.cta.none.size, same: a.cta.same.size,
          vstep: a.cta.vstep.size, aptis: a.cta.aptis.size, exam: a.cta.exam.size, self: a.cta.self.size,
        },
        scoredRate: a.sent.size ? Math.max(a.fillCert.size, legacy[a.campaign]?.scored.size || 0) / a.sent.size : 0,
        firstSentAt: a.firstSentAt,
        lastSentAt: a.lastSentAt,
      }))
      /* 카드 안 arm 순서 = 보낸 순서. 캠페인명 알파벳순으로 두면 4차가 again → applied →
         fresh(=N3 → N1 → N2)로 뒤집혀 뜬다 — 이름이 우연히 그렇게 정렬될 뿐, 우리가
         보낸 순서도 읽는 순서도 아니다. 아직 안 나간 arm 은 맨 뒤로. */
      .sort((x, y) =>
        String(x.firstSentAt || '9999').localeCompare(String(y.firstSentAt || '9999')) ||
        x.campaign.localeCompare(y.campaign))

    /* 실제로 들어온 값 목록. 비율만 보면 "무엇이 들어왔는지"를 못 본다 — 이 캠페인의
       원래 목적이 자기서술 52% 를 자격증·점수로 바꾸는 거라, 들어온 값의 생김새가
       전환율만큼 중요하다. 프로필의 현재 값을 읽는다(이벤트에는 값을 안 남긴다).
       같은 사람이 두 번 저장하면 마지막 저장으로 남긴다.

       원래는 첫 저장만 남겼다(전환 세는 방식과 같게). 캠페인끼리 대상이 안 겹칠 때는
       맞았는데, 재확인 회차는 이미 답한 사람에게 일부러 다시 보낸다 — 8/4 에 'Fluent'
       를 저장했던 사람이 6차에서 'TOEIC 750' 을 넣었더니 첫 저장 기준으로 8/4 캠페인에
       잡혀 R6 목록에서 사라졌다. 목록이 보여주는 값은 현재 프로필 값이므로, 그 값을
       만든 마지막 저장에 붙이는 것이 맞다.
       전환 수(filled)는 이벤트별로 세므로 이 변경과 무관하다. */
    const lastFill = {}
    for (const e of evts) {
      if (e.event !== 'coldmail_lang_fill' || !e.user_id) continue
      lastFill[e.user_id] = { at: e.created_at, campaign: e.meta?.campaign || null }
    }
    // 저장 직전에 누른 버튼 — 저장된 값이 본인 답인지 우리가 넣어준 값인지 가르는 기준이다.
    const ctaOf = {}
    for (const e of evts) {
      if (e.event !== 'coldmail_lang_click' || !e.user_id) continue
      if (lastFill[e.user_id] && e.created_at <= lastFill[e.user_id].at) ctaOf[e.user_id] = e.meta?.cta || null
    }
    const fillIds = Object.keys(lastFill)
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
          campaign: lastFill[p.id]?.campaign || null,
          wave: waveOf[p.id] || 1,
          at: lastFill[p.id]?.at || null,
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

    /* 카드 하나가 될 묶음을 만든다. 합치면 전환율이 무엇의 전환율인지 알 수 없다:
         language wave 1 = 콜드메일을 처음 받는 사람 200명
         language wave 2 = 최근에 다른 메일을 받은 적 있는 사람 260명
         ktc             = K-Tech College 로 들어온 사람 123명 (제목 A/B 없음)
       계열로 먼저 가르는 게 핵심이다 — ktc 는 meta.wave 를 안 남겨 1 로 떨어지므로,
       wave 로만 나누면 어학 wave 1 숫자에 그대로 섞인다.
       language 를 합칠 땐 keyOf 에서 wave 만 빼면 된다. */
    // language 는 wave 1(미수신자 200) / wave 2(기수신자 260)로 나눠 보다가 합쳤다.
    // 두 코호트의 입력률이 21.0% vs 24.6% 로 크게 벌어지지 않았고, 제목 A/B 판정에는
    // 230/230 한 덩어리로 보는 편이 검정력이 높다. 다시 가르려면 아래를
    // `language::${wave}` 로 되돌리면 된다 — rows/fills 에 wave 는 그대로 남아 있다.
    const keyOf = (campaign) => familyOf(campaign)

    const tally = (fs) => {
      const k = { score: 0, other: 0, level: 0, none: 0 }
      for (const f of fs) if (f.kind) k[f.kind]++
      return k
    }
    /* 카드 순서는 보낸 순서다. 키 알파벳순으로 두면 ghost → ktc → language → resume 이
       되어 실제 발송 순서(language → ktc → resume → ghost)와 어긋난다. 캠페인을 시간순으로
       읽어야 "앞 캠페인 결과를 보고 다음을 정했다"는 흐름이 그대로 보인다. */
    const firstSentOf = (key) => rows
      .filter((r) => keyOf(r.campaign) === key)
      .map((r) => r.firstSentAt).filter(Boolean)
      .sort()[0] || '9999'
    const keys = [...new Set(rows.map((r) => keyOf(r.campaign)))]
      .sort((a, b) => String(firstSentOf(a)).localeCompare(String(firstSentOf(b))))
    const groups = keys.map((key) => {
      const wRows = rows.filter((r) => keyOf(r.campaign) === key)
      const wFills = fills.filter((f) => keyOf(f.campaign) === key)
      // arm 별 값 종류 — "제목이 주제를 밝히면(B) 어학 되는 사람만 온다"는 가설은
      // 전환 수가 아니라 이 분포로만 확인된다.
      for (const r of wRows) r.kinds = tally(wFills.filter((f) => f.campaign === r.campaign))
      const A = wRows.find((r) => r.campaign === 'coldmail-language-1')
      const B = wRows.find((r) => r.campaign === 'coldmail-language-2')
      return {
        key,
        family: familyOf(wRows[0].campaign),
        // 카드 제목에 붙일 회차. 한 카드에 회차가 여럿이면 모두 넘긴다.
        rounds: [...new Set(wRows.map((r) => r.round).filter(Boolean))],
        rows: wRows,
        fills: wFills,
        kinds: tally(wFills),
        /* 버튼 → 저장값 매핑. "Intermediate 7건"이 자기서술로 읽히면 안 되므로, 버튼별로
           프리셀렉트를 그대로 둔 사람과 직접 고친 사람을 나눠 센다. */
        mapping: ['score', 'daily', 'basic', 'none', 'vstep', 'aptis', 'exam', 'self'].map((c) => {
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
          viewed: wRows.reduce((s, r) => s + r.viewed, 0),
          filled: wRows.reduce((s, r) => s + r.filled, 0),
          scored: wRows.reduce((s, r) => s + r.scored, 0),
          same: wRows.reduce((s, r) => s + r.same, 0),
        },
      }
    })

    /* 4차 모수 — 이력서는 있는데 어학이 빈 회원. 판정은 send.mjs 의 noLanguage 와
       같아야 한다(languages jsonb 까지 본다) — 다르면 이미 어학을 넣은 사람에게
       "어학이 비었다"고 보내게 된다.
       셋으로 가르는 이유는 메일 문구가 다르기 때문이다. 같은 "어학을 넣어라"라도
       근거로 댈 수 있는 사실이 층마다 다르다:
         applied 미수신 · 지원 경험 O — "지원까지 했는데 어학만 비었다"
         fresh   미수신 · 지원 0     — "어학이 있으면 지원해 볼 자리가 있다"
         again   기수신             — 한 번 받고도 안 넣은 층. 새 근거가 없으니 재확인.
       기수신을 버리지 않는 이유: 이 층의 60%가 거기 있어서 빼면 보낼 사람이 337명뿐이다. */
    const allProfiles = await fetchAll(() => supabase.from('user_profiles')
      .select('id, role, resume_url, english_cert, korean_cert, languages').order('id'))
    /* '지원 경험'이 아니라 '최근 지원'이다 — applied 메일이 "얼마 전 {회사}의 {직무}에
       지원하셨죠"로 시작하므로 오래된 지원자에게는 그 문장이 거짓이 된다.
       send.mjs 의 RECENT_DAYS 와 같은 값이어야 화면의 대상 수와 실제 발송 수가 맞는다. */
    const RECENT_DAYS = 90
    const cutoff = new Date(Date.now() - RECENT_DAYS * 86400e3).toISOString()
    const appliedIds = new Set((await fetchAll(() => supabase.from('job_applications')
      .select('id, user_id, created_at').not('user_id', 'is', null).order('id')))
      .filter((a) => a.created_at >= cutoff).map((a) => a.user_id))
    const sentTo = new Set(evts
      .filter((e) => e.event === 'coldmail_lang_sent' && e.user_id).map((e) => e.user_id))
    const blank = (v) => !String(v || '').trim()
    const noLanguage = (p) => blank(p.english_cert) && blank(p.korean_cert)
      && !(Array.isArray(p.languages) && p.languages.some((l) => String(l?.name || '').trim()))
    const poolRows = allProfiles.filter((p) => p.role !== 'hr' && !blank(p.resume_url) && noLanguage(p))
    const seg = (f) => poolRows.filter(f).length

    /* 5차 모수 — 어학을 적긴 했는데 자격증·점수가 아닌 사람. 이 수는 우리가 점수로
       바꿔낸 만큼 줄어들므로, 발송 뒤에도 '아직 남은 확인 대상'으로 계속 읽힌다. */
    const selfDesc = allProfiles.filter((p) => p.role !== 'hr' && !blank(p.resume_url)
      && (!blank(p.english_cert) || !blank(p.korean_cert))
      && !certOf(p.english_cert) && !certOf(p.korean_cert)
      && ![p.english_cert, p.korean_cert].some((v) => String(v || '').trim().toLowerCase() === 'none')).length

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      groups,
      selfDesc,
      pool: {
        total: poolRows.length,
        applied: seg((p) => !sentTo.has(p.id) && appliedIds.has(p.id)),
        fresh: seg((p) => !sentTo.has(p.id) && !appliedIds.has(p.id)),
        again: seg((p) => sentTo.has(p.id)),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}