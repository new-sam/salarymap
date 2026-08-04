import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'

// "유진 작업실" 마이페이지 수정 3단 — 진입 → 수정 시작 → 저장 완료. VN(UTC+7) 일별.
// 이력서 이탈 탭(funnel-explore RPC)은 이벤트 건수 기준이라 "몇 명인지"를 못 본다.
// 여기는 고유 유저 기준 + 단계 간 교집합이라 "진입한 사람 중 몇 명이 손을 댔고,
// 그중 몇 명이 저장까지 갔나"를 센다. 손 댔지만 저장 안 한 사람(unsaved)이 핵심 지표.
//
// AI 파싱은 별도로 센다 — 파싱이 죽으면(크레딧 소진 등) 유저는 빈 프로필을 직접 채워야 해서
// 수정 퍼널이 같이 망가진다. 실패 사유를 분류해 원인을 바로 알 수 있게 한다.
//
// ⚠️ profile_* 계측은 2026-07-30 부터다. 그 이전 기간을 조회하면 0으로 나오는 게 정상 —
//    응답의 measuredFrom 을 화면에 같이 띄워 "데이터 없음"과 "계측 전"을 구분한다.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const MEASURED_FROM = '2026-07-30'

const vnDay = (iso) => new Date(new Date(iso).getTime() + 7 * 36e5).toISOString().slice(0, 10)
// 로그인 전 이벤트도 있어 user_id 가 없을 수 있다 — client_id 로 보완해야 사람 수가 안 샌다.
const who = (e) => e.user_id || e.client_id || null

// 실패 사유 분류 — 원인이 우리 쪽(크레딧)인지 파일 쪽(스캔 PDF)인지 갈라야 대응이 달라진다.
const REASONS = [
  { key: 'credit', re: /no credits remaining|429|quota|rate limit/i },
  { key: 'image_pdf', re: /image-based|could not extract text/i },
  { key: 'download', re: /failed to download|no resume found/i },
]
const classify = (msg) => REASONS.find((r) => r.re.test(String(msg || '')))?.key || 'other'

// 이력서에 언어를 적는 사람의 비율 — "한국 이력서처럼 언어 기재가 국룰인가"를 확인하는 지표.
// 기간과 무관한 현재 스냅샷이다(이력서에 언제 적었는지는 알 수 없으므로).
//
// 분모를 둘 다 낸다. 승주 작업실(resume-public-metrics)의 어학 현황과 숫자가 어긋나 보이지 않게:
//  · allResumes  = 이력서 등록자 전체 — 승주 작업실과 같은 모수. "우리가 어학을 아는 비율"
//  · parsedOnly  = 그중 파싱 성공분 — "적는 문화가 있는가". 미파싱분을 넣으면
//                  '안 적었다'와 '못 읽었다'가 섞여 문화 질문의 답이 안 된다.
// hasCert/isExcludedSignup 도 같은 것을 써야 두 페이지가 같은 사람을 센다.
//
// 공인점수 여부까지 세는 이유: 자기서술("Fluent", "Good")은 기업이 필터할 수 없어 사실상 미기재다.
// VSTEP 은 베트남 국가 영어능력시험 — 빼면 현지 응시자가 통째로 '자기서술'로 잘못 잡힌다.
const SCORED = /ielts|toeic|toefl|topik|opic|vstep|\b[abc][12]\b/i

// 승주 작업실(resume-public-metrics.js)의 hasCert 와 동일 — 명시적 '없음'만 걸러낸다.
const hasCert = (v) => {
  const s = String(v || '').trim()
  return !!s && !/^(none|n\/a|na|no|없음|không|-)$/i.test(s)
}

// 공인점수 카드를 펼쳤을 때 보여줄 시험 종류. 순서대로 첫 매칭 승 —
// CEFR(\b[abc][12]\b)은 "IELTS 6.5 (B2)" 같은 병기 표기에 걸리므로 반드시 마지막.
const CERT_TYPES = [
  ['IELTS', /ielts/i],
  ['TOEIC', /toeic/i],
  ['TOEFL', /toefl/i],
  ['VSTEP', /vstep/i],   // 베트남 국가 영어능력시험
  ['OPIc', /opic/i],
  ['TOPIK', /topik/i],
  ['CEFR', /\b[abc][12]\b/i],
]
const certType = (v) => CERT_TYPES.find(([, re]) => re.test(v))?.[0] || '기타'

function tally(list) {
  const t = { total: list.length, en: 0, ko: 0, both: 0, neither: 0, enScored: 0 }
  const byType = {}   // 시험 종류 → { type, count, values: {원본값: 건수} }
  for (const r of list) {
    const e = hasCert(r.english_cert), k = hasCert(r.korean_cert)
    if (e) {
      t.en++
      if (SCORED.test(r.english_cert)) {
        t.enScored++
        const v = String(r.english_cert).trim()
        const g = byType[certType(v)] || (byType[certType(v)] = { type: certType(v), count: 0, values: {} })
        g.count++
        g.values[v] = (g.values[v] || 0) + 1
      }
    }
    if (k) t.ko++
    if (e && k) t.both++
    if (!e && !k) t.neither++
  }
  // 원본 값은 건수 내림차순으로 펴서 내려준다(화면에서 그대로 그리게).
  t.scoredBreakdown = Object.values(byType)
    .map((g) => ({
      type: g.type,
      count: g.count,
      values: Object.entries(g.values).map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n),
    }))
    .sort((a, b) => b.count - a.count)
  return t
}

async function languageSnapshot() {
  const rows = await fetchAll(() => supabase.from('user_profiles')
    .select('email, resume_url, resume_summary, korean_cert, english_cert'))

  const withResume = rows.filter((r) => !isExcludedSignup(r) && r.resume_url)
  return {
    allResumes: tally(withResume),
    parsedOnly: tally(withResume.filter((r) => r.resume_summary)),
  }
}

async function fetchAll(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from/to required' })
  const gte = `${from}T00:00:00+07:00`
  const lte = `${to}T23:59:59+07:00`

  try {
    const events = await fetchAll(() => supabase.from('events')
      .select('event, meta, user_id, client_id, created_at')
      .like('event', 'profile%')
      .gte('created_at', gte).lte('created_at', lte)
      .order('created_at', { ascending: true }))

    const uniq = {}   // event → Set(사람)
    const count = {}  // event → 건수
    const byDay = {}
    const day = (d) => byDay[d] || (byDay[d] = {
      date: d, view: 0, editStart: 0, save: 0, parseStart: 0, parseDone: 0, parseError: 0,
    })
    const DAY_KEY = {
      profile_view: 'view', profile_edit_start: 'editStart', profile_save_success: 'save',
      profile_ai_parse_start: 'parseStart', profile_ai_parse_done: 'parseDone',
      profile_ai_parse_error: 'parseError',
    }

    const errors = {}       // 사유 → { reason, count, lastAt, sample }
    const abandonTypes = {} // tab / route / unload

    for (const e of events) {
      count[e.event] = (count[e.event] || 0) + 1
      const id = who(e)
      if (id) (uniq[e.event] || (uniq[e.event] = new Set())).add(id)

      const dk = DAY_KEY[e.event]
      if (dk) day(vnDay(e.created_at))[dk]++

      if (e.event === 'profile_ai_parse_error') {
        const msg = e.meta?.error_message || ''
        const key = classify(msg)
        const r = errors[key] || (errors[key] = { reason: key, count: 0, lastAt: null, sample: String(msg).slice(0, 160) })
        r.count++
        r.lastAt = e.created_at
      }
      if (e.event === 'profile_abandon_dirty') {
        const t = e.meta?.type || 'unknown'
        abandonTypes[t] = (abandonTypes[t] || 0) + 1
      }
    }

    const S = (k) => uniq[k] || new Set()
    const inter = (a, b) => [...a].filter((x) => b.has(x)).length
    const V = S('profile_view'), E = S('profile_edit_start'), OK = S('profile_save_success')

    res.json({
      language: await languageSnapshot(),
      measuredFrom: MEASURED_FROM,
      // 3단 — 고유 사람 수. reached 는 직전 단계를 실제로 거친 사람만 센 값(교집합).
      funnel: {
        view: V.size,
        editStart: E.size,
        editStartFromView: inter(V, E),
        save: OK.size,
        saveFromEdit: inter(E, OK),
        // 손은 댔는데 저장 안 한 사람 — 이 탭의 주인공
        unsaved: [...E].filter((x) => !OK.has(x)).length,
      },
      parse: {
        start: count.profile_ai_parse_start || 0,
        done: count.profile_ai_parse_done || 0,
        error: count.profile_ai_parse_error || 0,
        startUsers: S('profile_ai_parse_start').size,
      },
      parseErrors: Object.values(errors).sort((a, b) => b.count - a.count),
      abandon: { total: count.profile_abandon_dirty || 0, types: abandonTypes },
      counts: count,
      days: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    })
  } catch (e) {
    console.error('profile-edit-funnel:', e.message)
    res.status(500).json({ error: e.message })
  }
}