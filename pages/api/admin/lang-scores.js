import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// "어학 점수" 페이지(/admin/lang-scores)의 데이터 — 어학 콜드메일로 실제로 받아낸
// 자격증·점수만 모은다.
//
// lang-coldmail.js 와 분리한 이유: 그쪽은 '제목 A/B 가 먹혔나'를 묻는 표라 모집단
// (wave·계열)을 절대 섞으면 안 된다. 여기 질문은 '무슨 점수를 받아냈나'뿐이라 전환율이
// 없고, 그래서 캠페인을 가로질러 한 목록으로 봐야 시험별 분포가 보인다.
//
// 한 사람이 영어·한국어를 둘 다 넣었으면 두 줄이다 — 시험별 칩의 숫자는 '값의 수'고,
// 사람 수는 따로 센다(people). 둘을 같은 숫자로 만들려면 한쪽을 버려야 하는데,
// 버리는 쪽이 바로 우리가 제일 받고 싶었던 TOPIK 이다.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

// 칩이 될 시험. 나머지 자격증(TOEFL·APTIS…)은 ETC 로 떨어진다 — 칩을 늘리기보다
// 한 칸에 모아 두는 편이 "우리가 안 세던 시험이 들어왔다"를 놓치지 않는다.
const CHIP_CERTS = ['TOEIC', 'IELTS', 'VSTEP', 'TOPIK']
const OTHER_CERTS = ['TOEFL', 'APTIS']
const ALL_CERTS = [...CHIP_CERTS, ...OTHER_CERTS]

// 자격증명으로 시작하면 점수. lang-coldmail.js 의 kindOf 와 같은 기준이어야 두 화면의
// '점수 47' 이 같은 47 을 가리킨다.
const certOf = (raw) => {
  const s = String(raw || '').trim()
  if (!s) return null
  return ALL_CERTS.find((c) => new RegExp(`^${c}\\b`, 'i').test(s)) || null
}

// 정렬용 숫자. 시험마다 척도가 달라(990 vs 7.5 vs 6급) 같은 시험 안에서만 쓴다.
// "TOEIC 935/990" → 935, "VSTEP B2" → B2 를 등급 순위로. 숫자가 없는 값
// ("TOEIC", "TOEIC Basic")은 null 이라 목록 끝으로 간다.
const CEFR = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }
function scoreOf(value) {
  const cefr = value.match(/\b([ABC][12])\b/i)
  if (cefr) return CEFR[cefr[1].toUpperCase()]
  const num = value.match(/(\d+(?:\.\d+)?)/)
  return num ? Number(num[1]) : null
}

// 시험별 등급. 척도가 제각각이라(990점 / 9.0밴드 / 6급 / CEFR) 한 줄로 세울 수 없고,
// 같은 시험 안에서만 나눈다. 값이 자격증명뿐이거나("TOEIC", "TOPIK I") 숫자가 없으면
// null → '미상'. 등급을 못 매긴 값도 세어야 "점수 몇 명"과 등급 합이 어긋나지 않는다.
const GRADES = {
  TOEIC: ['900+', '800–899', '700–799', '600–699', '~599'],
  TOEFL: ['100+', '90–99', '80–89', '~79'],
  IELTS: ['7.0+', '6.0–6.5', '5.0–5.5', '~4.5'],
  TOPIK: ['6급', '5급', '4급', '3급', '1–2급'],
  // VSTEP·APTIS 는 CEFR 등급으로 발급된다. "Vstep 6.0"·"Level 4" 처럼 원점수/레벨로
  // 적은 값은 두 척도가 섞여 있어(0–10점 vs 1–6레벨) 임의로 환산하지 않고 미상에 둔다.
  VSTEP: ['C1+', 'B2', 'B1', 'A1–A2'],
  APTIS: ['C1+', 'B2', 'B1', 'A1–A2'],
}

function gradeOf(cert, raw) {
  if (cert === 'VSTEP' || cert === 'APTIS') {
    const m = raw.match(/\b([ABC][12])\b/i)
    if (!m) return null
    const lv = m[1].toUpperCase()
    return lv[0] === 'C' ? 'C1+' : lv === 'B2' ? 'B2' : lv === 'B1' ? 'B1' : 'A1–A2'
  }
  const m = raw.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  if (cert === 'TOEIC') return n >= 900 ? '900+' : n >= 800 ? '800–899' : n >= 700 ? '700–799' : n >= 600 ? '600–699' : '~599'
  if (cert === 'TOEFL') return n >= 100 ? '100+' : n >= 90 ? '90–99' : n >= 80 ? '80–89' : '~79'
  if (cert === 'IELTS') return n >= 7 ? '7.0+' : n >= 6 ? '6.0–6.5' : n >= 5 ? '5.0–5.5' : '~4.5'
  if (cert === 'TOPIK') return n >= 6 ? '6급' : n >= 5 ? '5급' : n >= 4 ? '4급' : n >= 3 ? '3급' : '1–2급'
  return null
}

const hasText = (v) => !!String(v || '').trim()

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

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const evts = await fetchAll(() => supabase.from('events')
      .select('event, user_id, created_at, meta')
      .in('event', ['coldmail_lang_sent', 'coldmail_lang_fill'])
      .order('created_at'))

    // wave 는 발송에만 있다 — 저장은 랜딩에서 찍히는데 거기선 wave 를 모른다.
    const waveOf = {}
    for (const e of evts) {
      if (e.event === 'coldmail_lang_sent' && e.user_id) waveOf[e.user_id] = Number(e.meta?.wave) || 1
    }

    // 같은 사람이 두 번 저장하면 첫 저장으로 센다 — lang-coldmail.js 의 전환 세는 방식과 같다.
    const firstFill = {}
    for (const e of evts) {
      if (e.event !== 'coldmail_lang_fill' || !e.user_id) continue
      if (!firstFill[e.user_id]) firstFill[e.user_id] = { at: e.created_at, campaign: e.meta?.campaign || null }
    }

    const ids = Object.keys(firstFill)
    let profs = []
    if (ids.length) {
      const { data, error } = await supabase
        .from('user_profiles').select('id, full_name, email, english_cert, korean_cert').in('id', ids)
      if (error) throw error
      profs = data || []
    }

    // 값 하나가 한 줄. 이벤트에는 값을 안 남기므로 프로필의 현재 값을 읽는다 —
    // 저장 후 본인이 프로필에서 고쳤다면 고친 값이 보인다.
    const rows = []
    for (const p of profs) {
      for (const [field, value] of [['english', p.english_cert], ['korean', p.korean_cert]]) {
        const cert = certOf(value)
        if (!cert) continue
        rows.push({
          cert,
          chip: CHIP_CERTS.includes(cert) ? cert : 'ETC',
          field,
          value: String(value).trim(),
          score: scoreOf(String(value)),
          name: p.full_name || '(이름 없음)',
          email: p.email || '',
          campaign: firstFill[p.id]?.campaign || null,
          wave: waveOf[p.id] || 1,
          at: firstFill[p.id]?.at || null,
        })
      }
    }

    // 시험 순 → 같은 시험 안에서 점수 내림차순 → 숫자 없는 값은 끝으로.
    const chipOrder = [...CHIP_CERTS, 'ETC']
    rows.sort((a, b) =>
      chipOrder.indexOf(a.chip) - chipOrder.indexOf(b.chip) ||
      a.cert.localeCompare(b.cert) ||
      (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
      String(a.at).localeCompare(String(b.at)))

    const counts = Object.fromEntries(chipOrder.map((c) => [c, rows.filter((r) => r.chip === c).length]))

    /* 회원 전체를 이력서 × 어학 2×2 로 — 위 47명이 전체의 어디쯤인지 보려면 모수가 필요하다.
       hr 계정은 뺀다(구직자 지표에 기업 계정이 섞이면 분모가 틀어진다).
       카운트 쿼리 대신 세 칼럼을 다 읽는 이유: '어학 있음'과 '점수'의 판정을 위 목록과
       같은 함수로 해야 한다. PostgREST 필터로 같은 규칙을 다시 쓰면 두 정의가 갈라진다.
       화면으로는 숫자만 나가고 행은 나가지 않는다. */
    const profilesAll = await fetchAll(() => supabase
      .from('user_profiles').select('role, resume_url, english_cert, korean_cert'))
    const seekers = profilesAll.filter((p) => p.role !== 'hr')
    const bucket = (withResume) => {
      const pool = seekers.filter((p) => hasText(p.resume_url) === withResume)
      const lang = pool.filter((p) => hasText(p.english_cert) || hasText(p.korean_cert))
      return {
        total: pool.length,
        lang: lang.length,
        noLang: pool.length - lang.length,
        score: lang.filter((p) => certOf(p.english_cert) || certOf(p.korean_cert)).length,
      }
    }
    const base = { members: seekers.length, resume: bucket(true), noResume: bucket(false) }

    /* 총 회원(콜드메일 응답자만이 아니라) 기준 자격증별 등급 분포.
       한 사람이 TOEIC 과 TOPIK 을 둘 다 가졌으면 두 시험 모두에 한 번씩 세지만,
       같은 시험 안에서는 영어·한국어 칸이 겹쳐도 한 번만 센다 — 시험별 합이 곧
       '그 시험 가진 사람 수'여야 등급 비율을 읽을 수 있다. */
    const tally = {}
    for (const p of seekers) {
      const done = new Set()
      for (const v of [p.english_cert, p.korean_cert]) {
        const cert = certOf(v)
        if (!cert || done.has(cert)) continue
        done.add(cert)
        const g = gradeOf(cert, String(v).trim()) || '미상'
        tally[cert] = tally[cert] || {}
        tally[cert][g] = (tally[cert][g] || 0) + 1
      }
    }
    const certGrades = ALL_CERTS
      .filter((c) => tally[c])
      .map((c) => {
        // i·scale 은 색을 칠할 때 쓴다 — 아무도 없는 등급은 화면에서 빠지므로(B2·B1만
        // 남은 VSTEP 처럼) 남은 것끼리 다시 세면 중간 등급이 최상위 색을 쓰게 된다.
        const bands = [...GRADES[c], '미상']
          .map((label, i) => ({ label, i, n: tally[c][label] || 0 }))
          .filter((b) => b.n > 0)
        return {
          cert: c,
          chip: CHIP_CERTS.includes(c) ? c : 'ETC',
          scale: GRADES[c].length,
          total: bands.reduce((s, b) => s + b.n, 0),
          bands,
        }
      })
      // 한국어 → 영어(칩) → 기타 순. TOPIK 이 맨 위인 건 인원이 많아서가 아니라
      // 우리가 제일 받고 싶은 값이라서다 — 인원순으로 세우면 24명짜리가 맨 밑에 깔린다.
      // 그룹 안에서만 인원순.
      .sort((a, b) => {
        const rank = (c) => (c.cert === 'TOPIK' ? 0 : c.chip === 'ETC' ? 2 : 1)
        return rank(a) - rank(b) || b.total - a.total
      })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      rows,
      counts,
      base,
      certGrades,
      people: new Set(rows.map((r) => r.email || r.name)).size,
      filled: ids.length, // 어학 칸을 저장한 사람 전체 — 그중 몇 명이 점수였나의 분모
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}