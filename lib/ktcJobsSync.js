// KTC 랜딩 공고(별도 Supabase) → FYI jobs 로 합치는 **일회성 임포트**.
//
// 구 랜딩(ktc-landing2026.vercel.app)은 /ktc 로 대체되어 종료하므로, 임포트 이후에는
// FYI jobs 가 유일한 원본이다. 지속 동기화(cron)는 두지 않는다.
//
// 기존 FYI 의 source='ktc' 행 62건은 어드민에서 손질돼 있다(예: KTC 는 category='IT' /
// work_type='0n-site' 인데 FYI 는 role='Fullstack' / type='remote'). 그래서 덮어쓰지 않는다:
//   · KTC 에만 있는 공고        → 새로 등록
//   · 양쪽에 있는 공고          → is_active(노출 여부)만 맞춘다
//   · raw_payload 가 비어 있으면 → KTC 원문을 채운다(전 소스 통틀어 미사용 컬럼이라 덮어쓸 게 없음)
//   · FYI 에만 있는 행          → 그대로 둔다
//
// FYI jobs 는 본문이 description 한 칸인데 KTC 는 소개/담당업무/자격요건/복리후생 4칸이고,
// /ktc 상세는 그 4블록을 그대로 보여준다. 컬럼을 새로 파지 않고 raw_payload.ktc 에 원문을
// 담아 /ktc 가 복원해 쓰게 한다(lib/ktcJobs.js).
//
// 매칭 키는 KTC job_id 공고코드(WF1502) ↔ FYI jobs.source_id.
// 재게시로 같은 코드가 여러 건인 경우가 있어 source_id 는 CODE, CODE#2 … 형태다
// (lib/ktcCandidatesSync.js 의 syncKtcJobCodes 와 같은 규칙).
import { createClient } from '@supabase/supabase-js'
// 확장자 명시 — 이 모듈은 Next 번들러뿐 아니라 node 로도 직접 실행된다(scripts/sync-ktc-jobs.mjs)
import { normalizeWorkType } from './ktcJobs.js'

const FYI_TYPE = { Remote: 'remote', Hybrid: 'hybrid', Onsite: 'onsite' }

function clients() {
  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const landing = createClient(process.env.KTC_LANDING_SUPABASE_URL, process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return { fyi, landing }
}

// source_id 'WF1502#2' → 'WF1502'
const baseCode = (s) => (String(s || '').match(/^([A-Z]{2,6}\d{3,4})/) || [])[1] || null

const oneLine = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '') || null
const multiLine = (v) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '') || null

// "3+ year" / "1-2 year" / "5+ year" → [min, max]. 못 읽으면 [0, 0](= FYI 기본값).
export function parseExperience(raw) {
  const s = String(raw || '').toLowerCase()
  const range = s.match(/(\d+)\s*[-~]\s*(\d+)/)
  if (range) return [Number(range[1]), Number(range[2])]
  const plus = s.match(/(\d+)\s*\+/)
  if (plus) return [Number(plus[1]), 0]
  const one = s.match(/(\d+)/)
  if (one) return [Number(one[1]), Number(one[1])]
  return [0, 0]
}

/* FYI jobs.description 은 한 칸이라 4블록을 이어 붙인다. 원본 소제목이 본문 안에 이미
   들어 있는 경우가 많아(responsibilities 가 "Về vị trí\n..." 로 시작) 머리말은 붙이지 않는다.
   블록 구조 자체는 raw_payload.ktc 에 따로 남으므로 여기서 잃는 정보는 없다. */
export function composeDescription(k) {
  return [k.description, k.responsibilities, k.requirements, k.benefits]
    .map(multiLine).filter(Boolean).join('\n\n') || null
}

// /ktc 가 4블록·경력표기·직무칩을 복원하는 데 필요한 KTC 원문. raw_payload 아래 'ktc' 로 격리한다.
export function ktcPayload(k) {
  return {
    ktc: {
      job_id: oneLine(k.job_id),
      category: oneLine(k.category),
      industry: oneLine(k.industry),
      experience: oneLine(k.experience),
      work_type: normalizeWorkType(k.work_type),
      is_matching_week: !!k.is_matching_week,
      company_logo: oneLine(k.company_logo),
      company_website: oneLine(k.company_website),
      description: multiLine(k.description),
      responsibilities: multiLine(k.responsibilities),
      requirements: multiLine(k.requirements),
      benefits: multiLine(k.benefits),
    },
  }
}

// KTC 랜딩 행 → FYI jobs 행. 신규 등록에만 쓴다(기존 행은 덮어쓰지 않음).
export function toFyiJob(k, sourceId) {
  const [expMin, expMax] = parseExperience(k.experience)
  const wt = normalizeWorkType(k.work_type)
  return {
    title: oneLine(k.title),
    company: oneLine(k.company_name),
    logo_url: oneLine(k.company_logo),
    company_url: oneLine(k.company_website),
    location: oneLine(k.location),
    type: FYI_TYPE[wt] || null,
    role: oneLine(k.category),
    country: 'korea', // 한국 기업이 베트남 인재를 뽑는 프로그램 — 기존 KTC 행과 같은 값
    experience_min: expMin,
    experience_max: expMax,
    salary_min: k.salary_min ?? 0,
    salary_max: k.salary_max ?? 0,
    headcount: k.headcount ?? null,
    description: composeDescription(k),
    is_active: !!k.is_active,
    source: 'ktc',
    source_id: sourceId,
    raw_payload: ktcPayload(k),
  }
}

/* dry 면 아무것도 쓰지 않고 계획만 돌려준다. 기본이 dry — 실서비스 jobs 테이블을
   건드리므로 호출부가 명시적으로 dry:false 를 넘겨야 반영된다. */
export async function importKtcLandingJobs({ dry = true } = {}) {
  const { fyi, landing } = clients()

  const { data: K, error: kErr } = await landing.from('jobs').select('*')
  if (kErr) throw new Error(`KTC 랜딩 조회: ${kErr.message}`)
  const { data: F, error: fErr } = await fyi
    .from('jobs').select('id, title, company, source_id, is_active, raw_payload, created_at')
    .eq('source', 'ktc').order('created_at', { ascending: true })
  if (fErr) throw new Error(`FYI jobs 조회: ${fErr.message}`)

  const fyiByCode = new Map()
  for (const r of F) {
    const b = baseCode(r.source_id)
    if (!b) continue
    if (!fyiByCode.has(b)) fyiByCode.set(b, [])
    fyiByCode.get(b).push(r)
  }
  const taken = new Set(F.map(r => r.source_id).filter(Boolean))

  const toInsert = [], toActivate = [], toFill = [], notes = []
  for (const k of K) {
    const code = String(k.job_id || '').trim()
    if (!code) { notes.push({ reason: '공고코드 없음 — 건너뜀', title: k.title }); continue }

    const rows = fyiByCode.get(code)
    if (!rows?.length) {
      let sid = code
      for (let n = 2; taken.has(sid); n++) sid = `${code}#${n}`
      taken.add(sid)
      toInsert.push({ code, row: toFyiJob(k, sid) })
      continue
    }

    /* 같은 코드가 FYI 에 여러 건(재게시)이면 가장 최근 행만 KTC 상태를 따르고,
       이전 게재분은 건드리지 않는다 — 한꺼번에 켜면 목록에 중복 공고가 뜬다. */
    const target = rows[rows.length - 1]
    if (rows.length > 1) notes.push({ reason: `중복 게재 ${rows.length}건 중 최신만 반영`, code })
    if (!!target.is_active !== !!k.is_active) {
      toActivate.push({ id: target.id, code, from: !!target.is_active, to: !!k.is_active, label: `${target.company} / ${target.title}` })
    }
    // 본문 4블록 복원용 원문 채우기 — 이미 들어 있으면 손대지 않는다
    for (const r of rows) if (!r.raw_payload) toFill.push({ id: r.id, code, payload: ktcPayload(k) })
  }

  const ktcCodes = new Set(K.map(r => String(r.job_id || '').trim()).filter(Boolean))
  const orphans = F.filter(r => { const b = baseCode(r.source_id); return !b || !ktcCodes.has(b) })

  const plan = {
    dry,
    counts: { ktc: K.length, fyi: F.length, insert: toInsert.length, activate: toActivate.length, fill: toFill.length, orphan: orphans.length },
    insert: toInsert.map(x => ({ code: x.code, company: x.row.company, title: x.row.title, active: x.row.is_active })),
    activate: toActivate,
    orphans: orphans.map(r => ({ source_id: r.source_id, company: r.company, title: r.title, active: r.is_active })),
    notes,
  }
  if (dry) return plan

  const inserted = []
  for (const x of toInsert) {
    const { data, error } = await fyi.from('jobs').insert(x.row).select('id').single()
    if (error) throw new Error(`등록 실패(${x.code}): ${error.message}`)
    inserted.push({ code: x.code, id: data.id })
  }
  for (const u of toActivate) {
    const { error } = await fyi.from('jobs').update({ is_active: u.to }).eq('id', u.id)
    if (error) throw new Error(`노출상태 변경 실패(${u.code}): ${error.message}`)
  }
  for (const f of toFill) {
    const { error } = await fyi.from('jobs').update({ raw_payload: f.payload }).eq('id', f.id)
    if (error) throw new Error(`원문 채우기 실패(${f.code}): ${error.message}`)
  }
  return { ...plan, inserted }
}
