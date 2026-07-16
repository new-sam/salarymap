import { useState, Fragment } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 기업 지표 (초안) — 핵심 퍼널: 회사 유입 → 공고 등록 → 지원.
// 광고로 들어오는 기업이 실제로 공고를 올리고 지원을 받는지 한눈에.
// 데이터: /api/admin/company-metrics

// 실제 기업 채용 칸반 단계 (job_applications.status + rejected_at)
const STAGE = {
  pending: { ko: '서류 평가', en: 'Resume', color: '#94A3B8' },
  applied: { ko: '서류 평가', en: 'Resume', color: '#94A3B8' },
  viewed: { ko: '1차 인터뷰', en: '1st interview', color: '#0891B2' },
  reviewing: { ko: '2차 인터뷰', en: '2nd interview', color: '#7C3AED' },
  decided: { ko: '최종 합격', en: 'Final', color: '#059669' },
  accepted: { ko: '최종 합격', en: 'Final', color: '#059669' },
  rejected: { ko: '불합격', en: 'Rejected', color: '#DC2626' },
}
// 회사별 상세 표의 단계 컬럼 (순서 + 짧은 헤더)
const STAGE_COLS = ['pending', 'viewed', 'reviewing', 'decided', 'rejected']
const STAGE_SHORT = { pending: '서류', viewed: '1차', reviewing: '2차', decided: '최종', rejected: '불합격' }

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '-')
const dayNum = (d) => String(parseInt(d.slice(8), 10)) // '2026-07-04' → '4'

export default function CompanyView({ token, lang }) {
  const ko = lang !== 'en'
  const { data, isLoading } = useAdmin('/api/admin/company-metrics', token)
  const { data: koData } = useAdmin('/api/admin/company-title-ko', token) // 번역: 비동기(표를 막지 않음)
  const [openCard, setOpenCard] = useState(null)
  const [openCompany, setOpenCompany] = useState(null)
  const [showOther, setShowOther] = useState(false)
  const [openRole, setOpenRole] = useState(null)

  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const { overview, signups, daily, monthLabel, byCategory, otherTitles, jobsList: jobsRaw, stageTotals, stageOrder } = data
  const koMap = koData?.map || {}
  const jobsList = jobsRaw.map(j => ({ ...j, titleKo: koMap[j.title] || null }))
  const maxCatApps = Math.max(1, ...byCategory.map(c => c.applications))

  // 핵심 퍼널 3단 (누르면 상세)
  const funnel = [
    { key: 'companies', label: ko ? '가입 기업' : 'Companies', value: overview.companies, desc: ko ? 'FYI에 들어온 기업 수' : 'Companies joined', drill: 'companies' },
    { key: 'jobs', label: ko ? '올라온 공고' : 'Jobs posted', value: overview.jobsCompanySelf, desc: ko ? '기업이 올린 채용공고 수' : 'Jobs companies posted', drill: 'jobs' },
    { key: 'apps', label: ko ? '받은 지원' : 'Applications', value: overview.applications, desc: ko ? '공고에 들어온 지원(이력서) 수' : 'Applications received', drill: 'apps' },
  ]

  const th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }
  const thR = { ...th, textAlign: 'right' }
  const td = { padding: '9px 12px', color: '#374151' }
  const tdR = { ...td, textAlign: 'right' }
  const badge = (bg, color, text) => <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: bg, color }}>{text}</span>

  function downloadSignupsCsv() {
    const headers = ['Company', 'Domain', 'Verified', 'Jobs', 'Live', 'Applications', '서류', '1차인터뷰', '2차인터뷰', '최종합격', '불합격', 'Created']
    const body = signups.map(c => [c.name, c.email_domain, c.verified ? 'Y' : 'N', c.jobs, c.live, c.applications, ...STAGE_COLS.map(s => c.stages[s] || 0), fmtDate(c.created_at)])
    const csv = [headers, ...body].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `company-signups-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // 카드 클릭 시 바로 아래로 펼치는 드릴다운
  const drillPanel = () => {
    if (!['companies', 'jobs', 'apps'].includes(openCard)) return null
    const wrap = (title, child) => (
      <div className="adm-m-scroll" style={{ border: '1px solid #E5E8EB', borderRadius: 12, background: '#fff', padding: 14, marginBottom: 22, maxHeight: 340, overflowY: 'auto' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>{title}</div>
        {child}
      </div>
    )
    if (openCard === 'companies') {
      return wrap(ko ? `가입한 기업 ${signups.length}곳` : `${signups.length} companies`,
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ color: '#94A3B8', textAlign: 'left' }}>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>{ko ? '회사' : 'Company'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>{ko ? '도메인' : 'Domain'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>{ko ? '인증' : 'Verified'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>{ko ? '공고' : 'Jobs'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>{ko ? '지원' : 'Apps'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>{ko ? '가입일' : 'Joined'}</th>
          </tr></thead>
          <tbody>
            {signups.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '6px 8px', color: '#0F172A', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '6px 8px', color: '#6B7280' }}>{c.email_domain}</td>
                <td style={{ padding: '6px 8px' }}>{c.verified ? badge('#ECFDF5', '#059669', ko ? '인증' : 'Yes') : badge('#F1F5F9', '#94A3B8', ko ? '미인증' : 'No')}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>{c.jobs}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{c.applications}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    if (openCard === 'jobs') {
      return wrap(ko ? `올라온 공고 ${jobsList.length}건` : `${jobsList.length} jobs`,
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ color: '#94A3B8', textAlign: 'left' }}>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>{ko ? '공고' : 'Job'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>{ko ? '회사' : 'Company'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600 }}>{ko ? '상태' : 'Status'}</th>
            <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>{ko ? '지원' : 'Apps'}</th>
          </tr></thead>
          <tbody>
            {jobsList.map(j => (
              <tr key={j.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '6px 8px', color: '#0F172A', fontWeight: 600 }}>{j.title}</td>
                <td style={{ padding: '6px 8px', color: '#6B7280' }}>{j.company}</td>
                <td style={{ padding: '6px 8px' }}>
                  {j.pending ? badge('#FEF3C7', '#D97706', ko ? '승인대기' : 'pending')
                    : j.live ? badge('#FFF1EC', '#ff6000', ko ? '라이브' : 'live')
                    : badge('#F1F5F9', '#94A3B8', ko ? '내림' : 'off')}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{j.applications}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    if (openCard === 'apps') {
      const total = overview.applications || 1
      return wrap(ko ? `지원 ${overview.applications}건 · 단계별` : `${overview.applications} applications by stage`,
        <div>
          <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid #E5E8EB', marginBottom: 12 }}>
            {stageOrder.map(s => {
              const n = stageTotals[s] || 0
              if (!n) return null
              return <div key={s} title={`${STAGE[s] ? (ko ? STAGE[s].ko : STAGE[s].en) : s}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: STAGE[s]?.color || '#94A3B8' }} />
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {stageOrder.map(s => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: STAGE[s]?.color || '#94A3B8' }} />
                {STAGE[s] ? (ko ? STAGE[s].ko : STAGE[s].en) : s} <b style={{ color: '#0F172A' }}>{stageTotals[s] || 0}</b>
              </span>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  // 이번 달 일별 차트 스케일
  const maxDaily = Math.max(1, ...daily.flatMap(d => [d.companies, d.jobs, d.apps]))
  const mNum = parseInt(monthLabel.slice(5), 10) // 7
  const monthCompanies = daily.reduce((s, d) => s + d.companies, 0)
  const monthJobs = daily.reduce((s, d) => s + d.jobs, 0)
  const monthApps = daily.reduce((s, d) => s + (d.apps || 0), 0)

  // 공용 공고 한 줄 — 한국어 제목(있으면) + 원문 + 회사/직군/상태/지원
  // 공고별 미니 테이블 (공고 | 지원 | 서류 | 1차 | 2차 | 최종 | 불합격) — 상단 표와 양식 통일
  const jobsMiniTable = (arr, { showCompany = false } = {}) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
      <thead>
        <tr style={{ color: '#94A3B8', textAlign: 'left' }}>
          <th style={{ padding: '4px 8px', fontWeight: 600 }}>{ko ? '공고' : 'Job'}</th>
          <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>{ko ? '지원' : 'Apps'}</th>
          {STAGE_COLS.map(s => <th key={s} style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>{ko ? STAGE_SHORT[s] : STAGE[s].en}</th>)}
        </tr>
      </thead>
      <tbody>
        {arr.map(j => (
          <tr key={j.id} style={{ borderTop: '1px solid #F6E9E2' }}>
            <td style={{ padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{j.titleKo || j.title}</div>
                  {(j.titleKo || showCompany) && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{j.titleKo ? j.title : ''}{j.titleKo && showCompany ? ' · ' : ''}{showCompany ? j.company : ''}</div>}
                </div>
                <span style={{ fontSize: 11, color: '#6B7280', background: '#EEF0F2', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{j.categoryKo}</span>
                {j.pending ? badge('#FEF3C7', '#D97706', ko ? '승인대기' : 'pending') : j.live ? badge('#FFF1EC', '#ff6000', ko ? '라이브' : 'live') : badge('#F1F5F9', '#94A3B8', ko ? '내림' : 'off')}
              </div>
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{j.applications}</td>
            {STAGE_COLS.map(s => { const n = (j.stages || {})[s] || 0; return <td key={s} style={{ padding: '6px 8px', textAlign: 'right', color: n > 0 ? STAGE[s].color : '#CBD5E1', fontWeight: n > 0 ? 700 : 400 }}>{n}</td> })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{ko ? '기업 지표' : 'Company metrics'}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {ko ? '광고로 들어온 기업이 공고를 올리고 지원을 받는 흐름. 카드를 누르면 바로 아래에 상세가 열립니다.' : 'Company → job → application funnel. Click a card to expand details below it.'}
        </div>
      </div>

      {/* 핵심 퍼널: 회사 → 공고 → 지원 */}
      <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: 0, marginBottom: 10 }}>
        {funnel.map((c, i) => {
          const active = openCard === c.drill
          return (
            <Fragment key={c.key}>
              <div
                onClick={() => setOpenCard(active ? null : c.drill)}
                style={{
                  flex: '1 1 190px', background: '#fff', border: `1.5px solid ${active ? '#ff6000' : '#E5E8EB'}`,
                  borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color .12s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{`${i + 1}. ${c.label}`}</span>
                  <span style={{ fontSize: 12, color: active ? '#ff6000' : '#C4C9D0', fontWeight: 700 }}>{active ? '▾' : '▸'}</span>
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: '#0F172A', lineHeight: 1, margin: '8px 0 5px' }}>{c.value.toLocaleString()}</div>
                <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.4 }}>{c.desc}</div>
              </div>
              {i < funnel.length - 1 && (
                <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', fontSize: 22, padding: '0 4px' }}>→</div>
              )}
            </Fragment>
          )
        })}
      </div>

      {/* 드릴다운 — 누른 카드 바로 아래 */}
      {drillPanel()}

      {/* 파생 지표 — 쉬운 설명 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 26 }}>
        <div style={{ flex: '1 1 200px', background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{overview.medianAppsPerJob}<span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}> {ko ? '명' : ''}</span></div>
          <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginTop: 2 }}>{ko ? '공고당 지원 (중위)' : 'Median apps / job'}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{ko ? '지원이 들어온 공고 기준 (빈 공고 제외)' : 'Over jobs that got applications'}</div>
        </div>
        <div style={{ flex: '1 1 200px', background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{overview.activeCompanies}<span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}> / {overview.companies}</span></div>
          <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginTop: 2 }}>{ko ? '실제 공고 올린 기업' : 'Companies that posted'}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{ko ? '가입만 하고 공고 안 올린 기업 제외 (활성화율)' : 'Excludes sign-up-only companies'}</div>
        </div>
      </div>

      {/* 이번 달 일별 성과 — 하루마다 신규 기업/공고 */}
      <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{ko ? `${monthLabel} 일별 성과` : `${monthLabel} daily`}</h4>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        {ko ? `하루마다 새 기업/공고 + 기업 공고에 들어온 지원 (이번 달 기업 ${monthCompanies} · 공고 ${monthJobs} · 지원 ${monthApps}, 멋사 제외).` : `New companies/jobs + applications to company jobs per day this month.`}
      </div>
      <div style={{ background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 12, padding: '14px 16px', marginBottom: 30 }}>
        {/* 범례 */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#ff6000' }} />{ko ? '신규 기업' : 'Companies'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#2563EB' }} />{ko ? '신규 공고' : 'Jobs'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#059669' }} />{ko ? '지원' : 'Apps'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          {daily.map(d => {
            const bar = (val, color) => (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 72 }}>
                {val > 0 && <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 2 }}>{val}</div>}
                <div style={{ width: 9, height: `${(val / maxDaily) * 56}px`, minHeight: val > 0 ? 4 : 0, background: color, borderRadius: 2 }} />
              </div>
            )
            const busy = d.companies > 0 || d.jobs > 0 || d.apps > 0
            return (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div title={`${d.date} · ${ko ? '기업' : 'co'} ${d.companies} · ${ko ? '공고' : 'jobs'} ${d.jobs} · ${ko ? '지원' : 'apps'} ${d.apps}`} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, width: '100%' }}>
                  {bar(d.companies, '#ff6000')}
                  {bar(d.jobs, '#2563EB')}
                  {bar(d.apps, '#059669')}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: busy ? 700 : 500, color: busy ? '#475569' : '#B6BBC2', marginTop: 6 }}>{mNum}/{dayNum(d.date)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 회사 가입내역 (표) */}
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{ko ? '회사별 상세' : 'By company'}</h4>
        <button onClick={downloadSignupsCsv} style={{ padding: '7px 14px', border: 'none', borderRadius: 8, fontSize: 12.5, background: '#ff6000', color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>CSV</button>
      </div>
      <div style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden', marginBottom: 30 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                <th style={th}>{ko ? '회사' : 'Company'}</th>
                <th style={th}>{ko ? '인증' : 'Verified'}</th>
                <th style={thR}>{ko ? '공고' : 'Jobs'}</th>
                <th style={thR}>{ko ? '지원' : 'Apps'}</th>
                {STAGE_COLS.map(s => <th key={s} style={thR}>{ko ? STAGE_SHORT[s] : STAGE[s].en}</th>)}
                <th style={thR}>{ko ? '가입일' : 'Joined'}</th>
              </tr>
            </thead>
            <tbody>
              {signups.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: '#9CA3AF' }} colSpan={10}>{ko ? '가입 기업 없음' : 'No companies'}</td></tr>
              )}
              {signups.map(c => {
                const open = openCompany === c.id
                const cJobs = jobsList.filter(j => j.company_id === c.id)
                const expandable = c.jobs > 0
                return (
                  <Fragment key={c.id}>
                    <tr
                      onClick={expandable ? () => setOpenCompany(open ? null : c.id) : undefined}
                      style={{ borderTop: '1px solid #F1F5F9', cursor: expandable ? 'pointer' : 'default', background: open ? '#FFF7F3' : 'transparent' }}
                    >
                      <td style={{ ...td, fontWeight: 600, color: '#0F172A' }}>
                        {expandable && <span style={{ color: open ? '#ff6000' : '#C4C9D0', fontWeight: 700, marginRight: 6 }}>{open ? '▾' : '▸'}</span>}
                        {c.name}
                      </td>
                      <td style={td}>{c.verified ? badge('#ECFDF5', '#059669', ko ? '인증' : 'Yes') : badge('#F1F5F9', '#94A3B8', ko ? '미인증' : 'No')}</td>
                      <td style={tdR}>{c.jobs}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: '#0F172A' }}>{c.applications}</td>
                      {STAGE_COLS.map(s => { const n = c.stages[s] || 0; return <td key={s} style={{ ...tdR, color: n > 0 ? STAGE[s].color : '#CBD5E1', fontWeight: n > 0 ? 700 : 400 }}>{n}</td> })}
                      <td style={{ ...tdR, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                    </tr>
                    {open && (
                      <tr style={{ background: '#FFF7F3' }}>
                        <td colSpan={10} style={{ padding: '4px 12px 12px 30px' }}>
                          <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 600, margin: '4px 0 8px' }}>{ko ? `올린 포지션 ${cJobs.length}건` : `${cJobs.length} positions`}</div>
                          {cJobs.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>{ko ? '공고 없음' : 'No jobs'}</div>
                          ) : jobsMiniTable(cJobs)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 직군별 공고·지원 — 클릭 시 실제 공고 펼침 */}
      <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{ko ? '직군별 공고·지원' : 'Jobs & applications by role'}</h4>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        {ko ? '어떤 직군에 지원이 오고 안 오는지. 직군을 누르면 실제 공고가 펼쳐집니다. (제목 자동 분류·번역)' : 'Which roles attract applications. Click a role to see the actual jobs.'}
      </div>
      <div className="adm-m-scroll" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              <th style={th}>{ko ? '직군' : 'Role'}</th>
              <th style={thR}>{ko ? '공고' : 'Jobs'}</th>
              <th style={thR}>{ko ? '지원' : 'Apps'}</th>
              <th style={thR}>{ko ? '공고당' : '/ job'}</th>
              <th style={{ ...th, width: '30%' }}>{ko ? '지원' : 'Apps'}</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map(c => {
              const none = c.applications === 0
              const open = openRole === c.key
              const cj = jobsList.filter(j => j.category === c.key)
              return (
                <Fragment key={c.key}>
                  <tr onClick={() => setOpenRole(open ? null : c.key)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: open ? '#FFF7F3' : 'transparent' }}>
                    <td style={{ ...td, fontWeight: 600, color: '#0F172A' }}>
                      <span style={{ color: open ? '#ff6000' : '#C4C9D0', fontWeight: 700, marginRight: 6 }}>{open ? '▾' : '▸'}</span>{c.ko}
                    </td>
                    <td style={tdR}>{c.jobs}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: none ? '#DC2626' : '#0F172A' }}>{c.applications}</td>
                    <td style={{ ...tdR, fontWeight: 600, color: c.avgApps >= 1 ? '#059669' : none ? '#DC2626' : '#9CA3AF' }}>{c.avgApps}</td>
                    <td style={td}>
                      {none ? (
                        <span style={{ fontSize: 11.5, color: '#DC2626', fontWeight: 600 }}>{ko ? '지원 없음' : 'none'}</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${(c.applications / maxCatApps) * 100}%`, height: '100%', background: '#ff6000', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11.5, color: '#6B7280', width: 24, textAlign: 'right' }}>{c.applications}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr style={{ background: '#FFF7F3' }}>
                      <td colSpan={5} style={{ padding: '4px 14px 12px 30px' }}>
                        {jobsMiniTable(cj, { showCompany: true })}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {otherTitles.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <button onClick={() => setShowOther(v => !v)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {showOther ? '▾' : '▸'} {ko ? `기타(미분류) ${otherTitles.length}건 원문` : `${otherTitles.length} uncategorized`}
          </button>
          {showOther && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {otherTitles.map((t, i) => (
                <span key={i} style={{ fontSize: 11.5, padding: '3px 9px', background: '#F1F5F9', borderRadius: 999, color: '#475569' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
