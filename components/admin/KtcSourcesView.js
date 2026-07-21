import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// KTC 소싱 채널 비교 — KTC 공고에 지원자를 모아준 채널별 볼륨/추이/질.
// FYI가 채용 플랫폼으로서 유료 채널(ITviec/TopDev/…) 대비 얼마나 모으는지 판단하는 탭.
// 데이터: /api/admin/ktc-sources (타 플랫폼 = ktc_candidates 동기화본, FYI = salarymap 라이브)

const PLATFORM_LABEL = {
  'landing-page': 'KTC 랜딩',
  'ITviec-api': 'ITviec',
  'top-dev': 'TopDev',
  'jobs-go': 'JobsGO',
  'top-cv': 'TopCV',
  LinkedIn: 'LinkedIn',
  glint: 'Glint',
  YBOX: 'YBOX',
  'legacy-sheet': '레거시 시트',
  'Form Responses 1': '구글폼',
  'external-shu1102': '외부 스크리닝',
}
const label = (key) => PLATFORM_LABEL[key] || key
// 크로스탭에 개별 열로 보여줄 주요 채널 (나머지는 '기타'로 합산)
const MAIN_PLATFORMS = ['landing-page', 'ITviec-api', 'jobs-go', 'top-dev', 'LinkedIn', 'top-cv']
const FYI_COLOR = '#ff4400'

export default function KtcSourcesView({ token, lang }) {
  const ko = lang !== 'en'
  const { data, isLoading } = useAdmin('/api/admin/ktc-sources', token)
  const [showAllJobs, setShowAllJobs] = useState(false)

  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const { platforms, fyi, jobs, months, totals, syncedAt } = data
  const nowMonth = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
  const shownMonths = months.filter(m => m >= '2026-03' && m <= nowMonth)
  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

  // FYI를 플랫폼 목록에 합류시켜 볼륨순 정렬 (질 지표는 FYI엔 없음)
  const allRows = [
    ...platforms.map(p => ({ ...p, isFyi: false })),
    { key: 'FYI', total: fyi.total, months: fyi.months, fail: null, pass: null, finalPassed: null, isFyi: true },
  ].sort((a, b) => b.total - a.total)
  const grandTotal = allRows.reduce((s, r) => s + r.total, 0)
  const maxTotal = Math.max(1, ...allRows.map(r => r.total))
  const totalFinal = platforms.reduce((s, p) => s + p.finalPassed, 0)

  const stat = (labelTxt, value, sub) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{labelTxt}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const th = (txt, align = 'right', extra = {}) => (
    <th style={{ textAlign: align, padding: '10px 10px', fontWeight: 600, whiteSpace: 'nowrap', ...extra }}>{txt}</th>
  )

  const jobRows = showAllJobs ? jobs : jobs.slice(0, 25)

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 6 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{ko ? 'KTC 소싱 채널 비교' : 'KTC sourcing channels'}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {ko
            ? 'KTC 공고에 지원자를 모아준 채널별 볼륨·추이·질. FYI는 salarymap DB 라이브, 나머지는 ktc-support 동기화(1일 1회).'
            : 'Volume, trend and quality per sourcing channel for KTC jobs. FYI is live; others sync daily from ktc-support.'}
          {syncedAt && <span style={{ color: '#9CA3AF' }}> · {ko ? '마지막 동기화' : 'Last sync'} {new Date(syncedAt).toLocaleString('sv-SE').slice(0, 16)}</span>}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, margin: '14px 0 18px' }}>
        {stat(ko ? '총 지원자 (전 채널)' : 'Applicants (all)', grandTotal.toLocaleString(), ko ? '채널 내 유니크 기준' : 'unique per channel')}
        {stat('FYI', fyi.total.toLocaleString(), ko ? `지원 건수 ${fyi.applications} · 전체의 ${pct(fyi.total, grandTotal)}%` : `${fyi.applications} applications · ${pct(fyi.total, grandTotal)}% of all`)}
        {stat(ko ? '최종합격 (타 채널)' : 'Final passed', totalFinal, ko ? 'FYI 지원자는 상태 추적 없음' : 'FYI applicants not tracked')}
        {stat(ko ? 'KTC 공고' : 'KTC jobs', `${totals.activeKtcJobs} / ${totals.ktcJobs}`, ko ? '활성 / 전체' : 'active / all')}
      </div>

      {/* 채널별 표 */}
      <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              {th(ko ? '채널' : 'Channel', 'left', { paddingLeft: 14 })}
              {shownMonths.map(m => th(`${+m.slice(5)}${ko ? '월' : '/' + m.slice(2, 4)}`))}
              {th(ko ? '합계' : 'Total')}
              {th(ko ? '비중' : 'Share', 'left', { width: '18%' })}
              {th(ko ? '통과' : 'Passed')}
              {th(ko ? '최종합격' : 'Final')}
              {th(ko ? '통과율' : 'Pass %', 'right', { paddingRight: 14 })}
            </tr>
          </thead>
          <tbody>
            {allRows.map(r => (
              <tr key={r.key} style={{ borderTop: '1px solid #F1F5F9', background: r.isFyi ? '#FFF8F5' : undefined }}>
                <td style={{ padding: '9px 10px 9px 14px', fontWeight: r.isFyi ? 700 : 600, color: r.isFyi ? FYI_COLOR : '#0F172A' }}>{label(r.key)}</td>
                {shownMonths.map(m => (
                  <td key={m} style={{ padding: '9px 10px', textAlign: 'right', color: (r.months[m] || 0) > 0 ? '#374151' : '#CBD5E1' }}>{r.months[m] || 0}</td>
                ))}
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{r.total.toLocaleString()}</td>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                      <div style={{ width: `${(r.total / maxTotal) * 100}%`, height: '100%', background: r.isFyi ? FYI_COLOR : '#2563EB', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 11.5, color: '#6B7280', width: 34, textAlign: 'right' }}>{pct(r.total, grandTotal)}%</span>
                  </div>
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151' }}>{r.pass ?? '—'}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: r.finalPassed > 0 ? '#0D9488' : '#CBD5E1' }}>{r.finalPassed ?? '—'}</td>
                <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', color: '#374151' }}>{r.pass === null ? '—' : `${pct(r.pass, r.total)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 공고 × 채널 크로스탭 */}
      <h4 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px' }}>{ko ? '공고 × 채널' : 'Job × channel'}</h4>
      <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              {th(ko ? '공고' : 'Job', 'left', { paddingLeft: 14 })}
              {th('FYI', 'right', { color: FYI_COLOR })}
              {MAIN_PLATFORMS.map(p => th(label(p)))}
              {th(ko ? '기타' : 'Other')}
              {th(ko ? '합계' : 'Total', 'right', { paddingRight: 14 })}
            </tr>
          </thead>
          <tbody>
            {jobRows.map((j, i) => {
              const mainSum = MAIN_PLATFORMS.reduce((s, p) => s + (j.byPlatform[p] || 0), 0)
              const other = j.total - j.fyi - mainSum
              return (
                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '9px 10px 9px 14px', maxWidth: 340 }}>
                    <div style={{ fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.code && <span style={{ color: '#6B7280', fontWeight: 700, marginRight: 6 }}>{j.code}</span>}
                      {j.label}
                    </div>
                    {j.company && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{j.company}</div>}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: j.fyi > 0 ? FYI_COLOR : '#E5E8EB' }}>{j.fyi || 0}</td>
                  {MAIN_PLATFORMS.map(p => (
                    <td key={p} style={{ padding: '9px 10px', textAlign: 'right', color: (j.byPlatform[p] || 0) > 0 ? '#374151' : '#E5E8EB' }}>{j.byPlatform[p] || 0}</td>
                  ))}
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: other > 0 ? '#374151' : '#E5E8EB' }}>{other}</td>
                  <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{j.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {jobs.length > 25 && (
        <button onClick={() => setShowAllJobs(v => !v)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          {showAllJobs ? (ko ? '▾ 접기' : '▾ Collapse') : (ko ? `▸ 전체 ${jobs.length}개 공고 보기` : `▸ Show all ${jobs.length} jobs`)}
        </button>
      )}

      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.6 }}>
        {ko
          ? '지원자 수는 채널 내 유니크 기준(같은 사람이 한 채널에서 여러 공고 지원 시 1명). 통과 = passed·ai_interview_passed·final_passed, 통과율 = 통과/전체 — 진행중(new·인터뷰 대기) 포함이라 보수적 수치. FYI는 KTC 파이프라인 상태 추적이 없어 질 지표 없음. 시트의 FYI 탭은 갱신이 뒤처져 있어 사용하지 않고 salarymap DB에서 직접 집계. 크로스탭의 FYI는 회사·제목 매칭이라 일부 공고는 별도 행으로 나올 수 있음.'
          : 'Counts are unique applicants per channel. Passed = passed/ai_interview_passed/final_passed over all (incl. in-progress) — conservative. FYI rows have no pipeline tracking. FYI numbers come live from salarymap DB (the sheet FYI tab is stale). Cross-tab FYI matches by company+title; unmatched jobs appear as separate rows.'}
      </div>
    </div>
  )
}
