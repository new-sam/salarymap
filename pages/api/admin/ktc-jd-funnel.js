import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// KTC 공고별 퍼널 — JD EXECUTION(공고 원장, Master 시트 라이브) × 지원(ktc_applications)
// × 파이프라인(ktc_candidates) × 인터뷰(Master INTERVIEW 탭) × 입사(ktc_hires, 이메일→공고코드 귀속).
// 시트는 요청 시 라이브로 읽음 (소량·저빈도라 API 한도 문제 없음, SWR가 30초 dedupe).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const MASTER_SHEET_ID = '1mR1_-a3LmjxAbbox3tTKBu6WYwDbfBYKmPB6TP9EnKI'
// 비용 시트 (Alice 정리 — 통합 비교표 + Meta 캠페인별 성과). 지출은 KRW.
const COST_SHEET_ID = '1PEWHeAtx5nfxODQr_Db1soh-scl3Qg5Uw-fnjRziF8A'
// 통합 비교표의 채널명 → 우리 채널 키
const COST_CHANNEL_MAP = {
  TopDev: 'top-dev', ITviec: 'ITviec-api', 'Ybox*': 'YBOX', Ybox: 'YBOX',
  Glints: 'glint', LinkedIn: 'LinkedIn', JobsGO: 'jobs-go', TopCV: 'top-cv',
}
const parseKrw = (s) => {
  const n = parseFloat(String(s || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const CODE_RE = /[A-Z]{2,6}\d{3,4}/g
// VN(UTC+7) 기준 월 버킷
const toVNMonth = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 7)

const DOC_PASS = new Set(['passed', 'ai_interview_sent', 'ai_interview_done', 'ai_interview_passed', 'final_passed'])
const AI_PASS = new Set(['ai_interview_passed', 'final_passed'])

async function fetchAll(table, select, tweak) {
  let all = [], offset = 0
  for (;;) {
    let q = supabase.from(table).select(select).range(offset, offset + 999)
    if (tweak) q = tweak(q)
    const { data, error } = await q
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
    offset += 1000
  }
  return all
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { google } = await import('googleapis')
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const [jdRes, ivRes, applications, candidates, hires] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range: "'JD EXECUTION'!A1:N" }),
      sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range: "'INTERVIEW'!A1:N" }),
      fetchAll('ktc_applications', 'job_code'),
      fetchAll('ktc_candidates', 'job_code, email, pipeline_status, sheet_source, applied_at'),
      fetchAll('ktc_hires', 'email, full_name, company').catch(() => []),
    ])

    // FYI 지원자 이메일 (salarymap 라이브) — FYI 채널 퍼널 귀속용
    const ktcJobs = await fetchAll('jobs', 'id', q => q.eq('source', 'ktc')).catch(() => [])
    let fyiEmails = new Set()
    if (ktcJobs.length) {
      const ids = ktcJobs.map(j => j.id)
      let fyiApps = []
      for (let i = 0; i < ids.length; i += 50) {
        fyiApps = fyiApps.concat(await fetchAll('job_applications', 'applicant_email', q => q.in('job_id', ids.slice(i, i + 50))))
      }
      fyiEmails = new Set(fyiApps.map(a => (a.applicant_email || '').toLowerCase()).filter(e => e && !e.endsWith('@likelion.net')))
    }

    // JD 원장 (헤더 3행 스킵, Job ID 있는 행만)
    const jds = (jdRes.data.values || []).slice(3)
      .filter(r => (r[0] || '').trim())
      .map(r => ({
        code: r[0].trim(),
        company: (r[1] || '').trim(),
        title: (r[2] || '').trim(),
        yoe: (r[6] || '').trim(),
        korean: (r[7] || '').trim(),
        headcount: parseInt(r[8]) || null,
        dateReceived: (r[9] || '').trim(),
        status: (r[11] || '').trim(),
      }))

    // 지원 건 / 지원자·파이프라인 per 공고코드 + per 채널
    const apps = {}
    for (const a of applications) if (a.job_code) apps[a.job_code] = (apps[a.job_code] || 0) + 1
    const people = {}, docPass = {}, aiPass = {}, finalPass = {}
    const codeByEmail = {} // 입사 귀속용: 이메일 → 공고코드
    const chanByEmail = {} // 채널 귀속용: 이메일 → 채널 (최초 유입, FYI탭 포함)
    const chan = {} // 채널 퍼널: key → {people, docPass, ..., months: {'2026-05': {...}}} (월 = 지원월 코호트)
    const chanOf = (src) => src // sheet_source 그대로 (FYI 탭은 'FYI')
    const monthByEmail = {} // 이메일 → 지원월 (인터뷰/입사를 지원월 코호트에 귀속)
    const bump = (key, field, month) => {
      const c = chan[key] || (chan[key] = { key, people: 0, docPass: 0, aiPass: 0, finalPass: 0, interviews: 0, hires: 0, months: {} })
      c[field]++
      if (month) {
        const m = c.months[month] || (c.months[month] = { people: 0, docPass: 0, aiPass: 0, finalPass: 0, interviews: 0, hires: 0 })
        m[field]++
      }
    }
    const jobsByChannel = {} // 채널별 지원 발생 공고코드 (게재수 폴백)
    for (const c of candidates) {
      const e = (c.email || '').toLowerCase()
      const ch = chanOf(c.sheet_source)
      const month = c.applied_at ? toVNMonth(c.applied_at) : null
      if (c.job_code) (jobsByChannel[ch] || (jobsByChannel[ch] = new Set())).add(c.job_code)
      bump(ch, 'people', month)
      if (DOC_PASS.has(c.pipeline_status)) bump(ch, 'docPass', month)
      if (AI_PASS.has(c.pipeline_status)) bump(ch, 'aiPass', month)
      if (c.pipeline_status === 'final_passed') bump(ch, 'finalPass', month)
      if (e && !chanByEmail[e]) chanByEmail[e] = ch
      if (e && month && !monthByEmail[e]) monthByEmail[e] = month
      if (!c.job_code) continue
      people[c.job_code] = (people[c.job_code] || 0) + 1
      if (DOC_PASS.has(c.pipeline_status)) docPass[c.job_code] = (docPass[c.job_code] || 0) + 1
      if (AI_PASS.has(c.pipeline_status)) aiPass[c.job_code] = (aiPass[c.job_code] || 0) + 1
      if (c.pipeline_status === 'final_passed') finalPass[c.job_code] = (finalPass[c.job_code] || 0) + 1
      if (e && !codeByEmail[e]) codeByEmail[e] = c.job_code
    }
    // FYI 채널: 파이프라인(시트 FYI 탭) 인원 외에 전체 지원자 규모를 라이브로 덧붙임
    if (chan.FYI) chan.FYI.peopleLive = fyiEmails.size
    else if (fyiEmails.size) chan.FYI = { key: 'FYI', people: 0, peopleLive: fyiEmails.size, docPass: 0, aiPass: 0, finalPass: 0, interviews: 0, hires: 0 }

    // 채널 판정: 이메일 → 후보 채널, 없으면 FYI 지원자 집합, 그래도 없으면 미귀속
    const channelForEmail = (e) => chanByEmail[e] || (fyiEmails.has(e) ? 'FYI' : null)

    // 인터뷰 (Master INTERVIEW 탭): Job Application 텍스트에서 코드 추출, 이메일당 코드별 1회
    const interviews = {}
    const ivSeen = new Set()
    const ivChanSeen = new Set()
    for (const r of (ivRes.data.values || []).slice(2)) {
      const email = (r[2] || '').trim().toLowerCase()
      const name = (r[1] || '').trim()
      if (!name) continue
      // 채널 퍼널: 사람 단위 1회
      const personKey = email || name
      if (!ivChanSeen.has(personKey)) {
        ivChanSeen.add(personKey)
        const ch = channelForEmail(email) || '_unattributed'
        bump(ch, 'interviews', monthByEmail[email])
      }
      const codes = [...new Set(((r[13] || '').match(CODE_RE)) || [])]
      for (const code of codes) {
        const key = `${email || name}|${code}`
        if (ivSeen.has(key)) continue
        ivSeen.add(key)
        interviews[code] = (interviews[code] || 0) + 1
      }
    }

    // 입사 per 공고코드 + per 채널
    const hired = {}
    for (const h of hires) {
      const e = (h.email || '').toLowerCase()
      const code = codeByEmail[e]
      if (code) hired[code] = (hired[code] || 0) + 1
      bump(channelForEmail(e) || '_unattributed', 'hires', monthByEmail[e])
    }

    const rows = jds.map(j => ({
      ...j,
      apps: apps[j.code] || 0,
      people: people[j.code] || 0,
      docPass: docPass[j.code] || 0,
      aiPass: aiPass[j.code] || 0,
      interviews: interviews[j.code] || 0,
      finalPass: finalPass[j.code] || 0,
      hires: hired[j.code] || 0,
    }))

    const statusCounts = {}
    for (const j of rows) statusCounts[j.status || '(없음)'] = (statusCounts[j.status || '(없음)'] || 0) + 1

    // ---- 채널별 지출 (비용 시트 라이브, KRW) — 실패해도 퍼널은 정상 응답 ----
    let costMeta = null
    try {
      // 탭 이름이 수시로 바뀜(번호 접두 등) — 키워드로 실제 탭명을 탐지
      const costSheetMeta = await sheets.spreadsheets.get({ spreadsheetId: COST_SHEET_ID })
      const costTabs = (costSheetMeta.data.sheets || []).map(s => s.properties.title)
      const findTab = (kw) => costTabs.find(t => t.toLowerCase().includes(kw.toLowerCase()))
      const cmpTab = findTab('통합 비교표')
      const metaTab = findTab('캠페인별')
      const invTab = findTab('invoice')
      if (!cmpTab || !metaTab || !invTab) throw new Error(`비용 시트 탭 탐지 실패 (비교표:${cmpTab} 캠페인:${metaTab} 인보이스:${invTab})`)
      const [cmpRes, metaRes, invRes] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: COST_SHEET_ID, range: `'${cmpTab}'!A1:M15` }),
        sheets.spreadsheets.values.get({ spreadsheetId: COST_SHEET_ID, range: `'${metaTab}'!B6:C40` }),
        sheets.spreadsheets.values.get({ spreadsheetId: COST_SHEET_ID, range: `'${invTab}'!A1:M15` }),
      ])
      // Alice가 컬럼을 수시로 옮기므로 헤더 텍스트('채널'/'지출')로 위치 탐지
      const cmpRows = cmpRes.data.values || []
      const hIdx = cmpRows.findIndex(r => r.some(c => (c || '').trim() === '채널') && r.some(c => (c || '').startsWith('지출')))
      const spendByChannel = {}
      const postedByChannel = {}
      if (hIdx >= 0) {
        const H = cmpRows[hIdx]
        const chanCol = H.findIndex(c => (c || '').trim() === '채널')
        const spendCol = H.findIndex(c => (c || '').startsWith('지출'))
        const postedCol = H.findIndex(c => (c || '').includes('공고수'))
        for (const r of cmpRows.slice(hIdx + 1)) {
          const key = COST_CHANNEL_MAP[(r[chanCol] || '').trim()]
          if (!key) continue
          const spend = parseKrw(r[spendCol])
          if (spend != null) spendByChannel[key] = spend
          if (postedCol >= 0) {
            const posted = parseInt(String(r[postedCol] || '').replace(/[^0-9]/g, ''))
            if (Number.isFinite(posted)) postedByChannel[key] = posted
          }
        }
      }
      // VND→KRW 환율: 실시간 조회 (ECB 미지원이라 er-api 사용). 실패 시 인보이스 소계 유도 → 상수 순 폴백.
      let vndToKrw = null
      let fxSource = null
      try {
        const fx = await fetch('https://open.er-api.com/v6/latest/VND', { signal: AbortSignal.timeout(4000) }).then(r => r.json())
        if (fx?.rates?.KRW > 0) { vndToKrw = fx.rates.KRW; fxSource = 'live' }
      } catch { /* 폴백으로 */ }

      // Invoice 탭: 플랫폼별 소계는 원본 VND가 정확 — VND × 환율로 KRW 산출 ('≈만원' 손계산은 최후 폴백)
      const invRows = invRes.data.values || []
      const invH = invRows.findIndex(r => r.some(c => (c || '').startsWith('합계')))
      const invoiceVnd = {}
      if (invH >= 0) {
        const IH = invRows[invH]
        const krwCol = IH.findIndex(c => (c || '').includes('KRW'))
        const sumCol = IH.findIndex(c => (c || '').startsWith('합계'))
        // 소계 블록의 플랫폼 열 = 합계 열 바로 왼쪽 두 칸 (플랫폼|인보이스|합계|≈KRW)
        const platCol = sumCol - 2
        for (const r of invRows.slice(invH + 1)) {
          const key = COST_CHANNEL_MAP[(r[platCol] || '').trim()]
          const vnd = parseKrw(r[sumCol])
          const m = (r[krwCol] || '').match(/([\d,.]+)\s*만원/)
          if (vnd > 0 && m && vndToKrw == null) { vndToKrw = (parseFloat(m[1].replace(/,/g, '')) * 10000) / vnd; fxSource = 'invoice-derived' }
          if (key && vnd > 0) invoiceVnd[key] = vnd
        }
      }
      if (vndToKrw == null) { vndToKrw = 0.054; fxSource = 'fallback-const' }
      // 인보이스 확정 VND가 있는 채널은 그걸 캐넌으로 (통합 비교표의 반올림 KRW보다 정확)
      // 인보이스 소계는 VAT 포함(시트 명시) → ÷1.1로 VAT 제외 기준 통일 (LinkedIn 슬롯 상세와 동일 기준)
      for (const [key, vnd] of Object.entries(invoiceVnd)) {
        spendByChannel[key] = (vnd / 1.1) * vndToKrw
      }

      // LinkedIn 보정: 내부(자사) 채용 슬롯 제외 — LINKEDIN 탭에서 KTC 공고코드 있는 슬롯만 합산
      const liTab = costTabs.find(t => t.toUpperCase().includes('LINKEDIN'))
      if (liTab) {
        const liRes = await sheets.spreadsheets.values.get({ spreadsheetId: COST_SHEET_ID, range: `'${liTab}'!A1:N120` })
        const liRows = liRes.data.values || []
        const liH = liRows.findIndex(r => r.includes('Job code') && r.includes('Cost'))
        if (liH >= 0) {
          const LH = liRows[liH]
          const costCol = LH.indexOf('Cost')
          const codeCol = LH.indexOf('Job code')
          let ktcVnd = 0
          const liCodes = new Set()
          for (const r of liRows.slice(liH + 1)) {
            const code = ((r[codeCol] || '').trim().match(/^[A-Z]{2,6}\d{3,4}/) || [])[0]
            if (!code) continue // 코드 없음 = 자사 채용 또는 합계 행
            const cost = parseKrw(r[costCol])
            if (cost != null) { ktcVnd += cost; liCodes.add(code) }
          }
          if (ktcVnd > 0) {
            spendByChannel.LinkedIn = ktcVnd * vndToKrw
            if (postedByChannel.LinkedIn == null) postedByChannel.LinkedIn = liCodes.size
          }
        }
      }
      for (const c of Object.values(chan)) {
        if (postedByChannel[c.key] != null) c.jobsPosted = postedByChannel[c.key]
      }

      // Meta 광고비 중 KTC 몫 분해: KTC* 접두 = 랜딩 광고비, FYI_*KTC* = FYI를 통한 KTC 홍보 광고비
      let ktcMeta = 0
      let fyiKtcMeta = 0
      for (const r of (metaRes.data.values || [])) {
        const name = (r[0] || '').trim()
        const spend = parseKrw(r[1])
        if (spend == null) continue
        if (/^ktc/i.test(name)) ktcMeta += spend
        else if (/^fyi/i.test(name) && /ktc/i.test(name)) fyiKtcMeta += spend
      }
      // 지출을 성격별로 분리: 잡보드 지출 = 게재비(fees), Meta = 광고비(ads)
      for (const c of Object.values(chan)) {
        const fees = spendByChannel[c.key]
        const ads = c.key === 'landing-page' ? (ktcMeta || null) : c.key === 'FYI' ? (fyiKtcMeta || null) : null
        if (fees != null || ads != null || c.key === 'FYI') {
          c.spendFees = fees ?? 0
          c.spendAds = ads ?? 0
          c.spendKrw = (fees ?? 0) + (ads ?? 0)
        }
      }
      costMeta = { ktcMetaKrw: ktcMeta, fyiKtcMetaKrw: fyiKtcMeta, channelsWithCost: Object.keys(spendByChannel).length, vndToKrw, fxSource }
    } catch (e) {
      console.error('cost sheet read:', e.message)
      costMeta = { error: e.message } // 뷰에서 "비용 시트 조회 실패"로 노출 (열은 유지)
    }

    // 채널별 공고 수 (지원 발생 공고코드 distinct — 게재수 없을 때 폴백)
    for (const c of Object.values(chan)) {
      c.jobsApplied = jobsByChannel[c.key] ? jobsByChannel[c.key].size : 0
    }

    // 채널 퍼널 정렬: 지원자(파이프라인 인원) 많은 순, 미귀속은 맨 뒤
    const channels = Object.values(chan).sort((a, b) => {
      if (a.key === '_unattributed') return 1
      if (b.key === '_unattributed') return -1
      return (b.peopleLive || b.people) - (a.peopleLive || a.people)
    })

    res.json({ jds: rows, statusCounts, channels, costMeta })
  } catch (e) {
    console.error('ktc-jd-funnel:', e)
    res.status(500).json({ error: e.message })
  }
}
