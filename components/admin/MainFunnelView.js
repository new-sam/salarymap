import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'

// 메인 퍼널 대시보드 — 유입(GA4) → 가입 → 지원 → 합격.
// 단계 카드를 클릭하면 아래에 해당 단계의 세부(채널/유입경로/공고/합격 목록)가 열린다.
// 유입은 /api/admin/ga4, 나머지는 /api/admin/main-funnel 에서 로드 (둘 다 SWR 캐시).

const STAGES = [
  { key: 'traffic', ko: '유입', en: 'Traffic', sub: { ko: 'GA4 방문자', en: 'GA4 users' }, color: '#2563EB' },
  { key: 'signup', ko: '가입', en: 'Sign-ups', sub: { ko: '신규 가입', en: 'New users' }, color: '#F59E0B' },
  { key: 'apply', ko: '지원', en: 'Applies', sub: { ko: '지원자 (유니크)', en: 'Applicants (unique)' }, color: '#0D9488' },
  { key: 'accepted', ko: '합격', en: 'Accepted', sub: { ko: '합격자', en: 'Accepted users' }, color: '#16A34A' },
]

const fmt = (n) => (n === null || n === undefined ? '—' : n.toLocaleString())
const pct = (a, b, digits = 1) => (b > 0 && a !== null && a !== undefined ? ((a / b) * 100).toFixed(digits) : null)
const rateColor = (v) => (v === null ? '#999' : '#191F28')

const thStyle = { padding: '7px 10px', textAlign: 'right', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }
const thLeft = { ...thStyle, textAlign: 'left' }
const tdStyle = { padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }
const tdLeft = { ...tdStyle, textAlign: 'left' }

function DetailTable({ title, columns, rows }) {
  return (
    <div style={{ ...sectionStyle, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 10 }}>{title}</div>
      <div className="adm-m-scroll">
        <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {columns.map((c, i) => <th key={c} style={i === 0 ? thLeft : thStyle}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} style={{ ...tdLeft, color: '#999', padding: 16 }}>—</td></tr>
            )}
            {rows.map((r, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {r.map((cell, ci) => <td key={ci} style={ci === 0 ? tdLeft : tdStyle}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function MainFunnelView({ token, lang, dateRange }) {
  const L = (ko, en) => (lang === 'ko' ? ko : en)
  const [stage, setStage] = useState('traffic')

  const qs = `from=${dateRange.from}&to=${dateRange.to}`
  const { data: ga4, error: ga4Error } = useAdmin(`/api/admin/ga4?${qs}`, token)
  const { data: funnel, isLoading } = useAdmin(`/api/admin/main-funnel?${qs}`, token)

  if (isLoading && !funnel) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…')}</div>
  }
  if (!funnel) return null

  // 단계별 대표 숫자 (전환율은 이 숫자 기준: 방문자→가입자→지원자→합격자)
  const visitors = ga4?.totals?.totalUsers ?? null
  const signups = funnel.signups.total
  const applicants = funnel.applications.uniqueUsers
  const acceptedUsers = funnel.accepted.uniqueUsers
  const values = { traffic: visitors, signup: signups, apply: applicants, accepted: acceptedUsers }
  const secondary = {
    traffic: ga4 ? L(`세션 ${fmt(ga4.totals.sessions)}`, `${fmt(ga4.totals.sessions)} sessions`) : (ga4Error ? L('GA4 로드 실패', 'GA4 failed') : L('GA4 로딩…', 'GA4 loading…')),
    signup: null,
    apply: L(`지원 ${fmt(funnel.applications.total)}건`, `${fmt(funnel.applications.total)} applications`),
    accepted: L(`합격 ${fmt(funnel.accepted.total)}건`, `${fmt(funnel.accepted.total)} accepted`),
  }
  const overall = pct(acceptedUsers, visitors, 2)

  // ── 일별 테이블 데이터: GA4 일별 + 가입/지원/합격 일별을 날짜로 병합 ──
  const ga4Daily = Object.fromEntries((ga4?.daily || []).map(d => [d.date, d]))
  const allDates = [...new Set([
    ...Object.keys(ga4Daily),
    ...Object.keys(funnel.signups.daily),
    ...Object.keys(funnel.applications.daily),
    ...Object.keys(funnel.accepted.daily),
  ])].sort().reverse()

  const detailTitle = {
    traffic: L('유입 상세 — 채널·랜딩 페이지 (GA4)', 'Traffic detail — channels & landing pages (GA4)'),
    signup: L('가입 상세 — 유입 경로 (가입 시점 UTM)', 'Sign-up detail — acquisition source (UTM at signup)'),
    apply: L('지원 상세', 'Apply detail'),
    accepted: L('합격 상세', 'Accepted detail'),
  }

  return (
    <>
      {/* ── 퍼널 스트립: 4단계 카드 + 단계간 전환율 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: '#666' }}>
          {dateRange.from} ~ {dateRange.to} · {L('기간 내 발생 기준 (코호트 아님)', 'Period-based, not cohort')}
        </span>
        <span style={{ fontSize: 13, color: '#666' }}>
          {L('전체 전환', 'Overall')} {L('유입→합격', 'traffic→accepted')}:{' '}
          <b style={{ fontSize: 16, color: '#191F28' }}>{overall === null ? '—' : `${overall}%`}</b>
        </span>
      </div>
      <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {STAGES.map((s, i) => {
          const val = values[s.key]
          const prevVal = i > 0 ? values[STAGES[i - 1].key] : null
          const conv = i > 0 ? pct(val, prevVal, val !== null && prevVal > 0 && (val / prevVal) < 0.1 ? 2 : 1) : null
          const active = stage === s.key
          return (
            <div key={s.key} onClick={() => setStage(s.key)}
              style={{
                background: '#fff', borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                border: active ? `2px solid ${s.color}` : '1px solid #e5e7eb',
                transition: 'border-color 0.15s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{i + 1}. {L(s.ko, s.en)}</span>
                {i > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#F6F8FA', color: conv === null ? '#999' : '#444' }}>
                    ← {conv === null ? '—' : `${conv}%`}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#191F28', marginTop: 8, lineHeight: 1.1 }}>{fmt(val)}</div>
              <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 4 }}>
                {L(s.sub.ko, s.sub.en)}{secondary[s.key] ? ` · ${secondary[s.key]}` : ''}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 선택 단계 드릴다운 ── */}
      <div style={{ fontSize: 15, fontWeight: 700, color: '#333', margin: '0 0 12px' }}>{detailTitle[stage]}</div>

      {stage === 'traffic' && (ga4 ? (
        <>
          <DetailTable
            title={L('채널별', 'By channel')}
            columns={[L('채널', 'Channel'), L('세션', 'Sessions'), L('방문자', 'Users'), L('신규 방문자', 'New users'), L('참여 세션', 'Engaged'), L('이탈률', 'Bounce')]}
            rows={(ga4.channels || []).map(c => [
              c.channel, fmt(c.sessions), fmt(c.totalUsers), fmt(c.newUsers), fmt(c.engagedSessions), `${(c.bounceRate * 100).toFixed(0)}%`,
            ])}
          />
          <DetailTable
            title={L('랜딩 페이지 Top 10', 'Top 10 landing pages')}
            columns={[L('페이지', 'Page'), L('세션', 'Sessions'), L('방문자', 'Users'), L('이탈률', 'Bounce')]}
            rows={(ga4.landingPages || []).slice(0, 10).map(p => [
              p.page, fmt(p.sessions), fmt(p.totalUsers), `${(p.bounceRate * 100).toFixed(0)}%`,
            ])}
          />
        </>
      ) : (
        <div style={{ ...sectionStyle, color: '#999', fontSize: 13 }}>{ga4Error ? L('GA4 데이터를 불러오지 못했습니다.', 'Failed to load GA4 data.') : L('GA4 로딩 중…', 'Loading GA4…')}</div>
      ))}

      {stage === 'signup' && (
        <DetailTable
          title={L('가입 유입 경로 (utm_source / campaign, 미기록=organic/direct)', 'Signup source (utm_source / campaign)')}
          columns={[L('경로', 'Source'), L('가입자', 'Sign-ups'), L('비중', 'Share')]}
          rows={funnel.signups.bySource.map(r => [r.key, fmt(r.count), `${pct(r.count, signups) ?? 0}%`])}
        />
      )}

      {stage === 'apply' && (
        <>
          <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <DetailTable
              title={L('지원 경로', 'By source')}
              columns={[L('경로', 'Source'), L('건수', 'Count'), L('비중', 'Share')]}
              rows={funnel.applications.bySource.map(r => [r.key, fmt(r.count), `${pct(r.count, funnel.applications.total) ?? 0}%`])}
            />
            <DetailTable
              title={L('지원 상태', 'By status')}
              columns={[L('상태', 'Status'), L('건수', 'Count'), L('비중', 'Share')]}
              rows={funnel.applications.byStatus.map(r => [r.key, fmt(r.count), `${pct(r.count, funnel.applications.total) ?? 0}%`])}
            />
          </div>
          <DetailTable
            title={L('지원 많은 공고 Top 15', 'Top 15 jobs by applications')}
            columns={[L('회사 · 공고', 'Company · Job'), L('지원', 'Applies'), L('합격', 'Accepted')]}
            rows={funnel.applications.topJobs.map(j => [`${j.company} · ${j.title}`, fmt(j.count), fmt(j.accepted)])}
          />
        </>
      )}

      {stage === 'accepted' && (
        <DetailTable
          title={L('합격 목록 (기간 내 지원 중 accepted)', 'Accepted list (applications in range)')}
          columns={[L('지원일', 'Applied'), L('회사', 'Company'), L('공고', 'Job'), L('지원 경로', 'Source')]}
          rows={funnel.accepted.items.map(a => [a.date, a.company, a.title, a.source])}
        />
      )}

      {/* ── 일별 퍼널 테이블 ── */}
      <div style={{ ...sectionStyle, paddingBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 10 }}>
          {L('일별 퍼널 (최신순)', 'Daily funnel (latest first)')}
        </div>
        <div className="adm-m-scroll" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff' }}>
                <th style={thLeft}>{L('날짜', 'Date')}</th>
                <th style={thStyle}>{L('유입', 'Users')}</th>
                <th style={thStyle}>{L('가입', 'Sign-ups')}</th>
                <th style={thStyle}>{L('가입률', 'Signup %')}</th>
                <th style={thStyle}>{L('지원자', 'Applicants')}</th>
                <th style={thStyle}>{L('지원 건', 'Applies')}</th>
                <th style={thStyle}>{L('지원률', 'Apply %')}</th>
                <th style={thStyle}>{L('합격', 'Accepted')}</th>
              </tr>
            </thead>
            <tbody>
              {allDates.map(d => {
                const u = ga4Daily[d]?.totalUsers ?? null
                const sg = funnel.signups.daily[d] || 0
                const ap = funnel.applications.daily[d] || { count: 0, users: 0 }
                const ac = funnel.accepted.daily[d] || 0
                const signupRate = pct(sg, u)
                const applyRate = pct(ap.users, sg)
                return (
                  <tr key={d} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ ...tdLeft, fontWeight: 600 }}>{d}</td>
                    <td style={tdStyle}>{fmt(u)}</td>
                    <td style={tdStyle}>{sg || '·'}</td>
                    <td style={{ ...tdStyle, color: rateColor(signupRate) }}>{signupRate === null ? '—' : `${signupRate}%`}</td>
                    <td style={tdStyle}>{ap.users || '·'}</td>
                    <td style={tdStyle}>{ap.count || '·'}</td>
                    <td style={{ ...tdStyle, color: rateColor(applyRate) }}>{applyRate === null ? '—' : `${applyRate}%`}</td>
                    <td style={{ ...tdStyle, fontWeight: ac ? 700 : 400, color: ac ? '#16A34A' : '#191F28' }}>{ac || '·'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
