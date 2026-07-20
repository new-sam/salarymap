import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'
import BehaviorFunnel from './BehaviorFunnel'

// 메인 퍼널 대시보드 — 유입(GA4) → 가입 → 지원 → 합격.
// 단계 카드를 클릭하면 아래에 해당 단계의 세부(채널/유입경로/공고/합격 목록)가 열린다.
// 유입은 /api/admin/ga4, 나머지는 /api/admin/main-funnel 에서 로드 (둘 다 SWR 캐시).

const STAGES = [
  { key: 'traffic', ko: '유입', en: 'Traffic', sub: { ko: 'GA4 방문자', en: 'GA4 users' }, color: '#2563EB' },
  { key: 'signup', ko: '가입', en: 'Sign-ups', sub: { ko: '신규 가입', en: 'New users' }, color: '#F59E0B' },
  { key: 'apply', ko: '지원', en: 'Applies', sub: { ko: '지원자 (유니크)', en: 'Applicants (unique)' }, color: '#0D9488' },
  { key: 'accepted', ko: '합격', en: 'Accepted', sub: { ko: '합격자', en: 'Accepted users' }, color: '#16A34A' },
]


// 진입면별 → 가입 퍼널 (main-funnel.js pathFunnels 와 키 일치)
const EV_LABEL = {
  landing: ['홈 랜딩', 'Home landing'],
  wizard_step_1: ['위저드 시작', 'Wizard start'],
  wizard_step_4: ['위저드 완료', 'Wizard done'],
  result_gate_view: ['게이트 노출', 'Gate view'],
  view_jobs_page: ['공고 목록 뷰', 'Jobs list'],
  view_job_detail: ['공고 상세 뷰', 'Job detail'],
  click_apply_button: ['지원 버튼 클릭', 'Apply click'],
  cv_view: ['CV 페이지 뷰', 'CV view'],
  cv_oauth_start: ['CV 로그인 시작', 'CV login start'],
  sign_up: ['가입', 'Sign-up'],
}
const PATH_META = [
  { key: 'wizard', title: ['① 홈 → 위저드 → 게이트 → 가입', '① Home → wizard → gate → signup'] },
  { key: 'jobs', title: ['② 공고 → 상세 → 지원클릭 → 가입', '② Jobs → detail → apply → signup'] },
  { key: 'cv', title: ['③ CV → 로그인 → 가입', '③ CV → login → signup'] },
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

// 유입→가입 이탈 지도의 경로 한 줄 — 단계 박스 사이에 전 단계 대비 전환율 표시.
function StepChain({ title, steps, lang }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#555', marginBottom: 8 }}>{title}</div>
      <div className="adm-m-scroll" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null
          const conv = i > 0 && prev > 0 ? ((s.value / prev) * 100).toFixed(1) : null
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              {i > 0 && (
                <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 2px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: conv === null ? '#bbb' : conv >= 50 ? '#10B981' : conv >= 20 ? '#F59E0B' : '#EF4444' }}>
                    {conv === null ? '—' : `${conv}%`}
                  </div>
                  <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1 }}>→</div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 76, background: '#F6F8FA', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#191F28' }}>{s.value.toLocaleString()}</div>
                <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 2, whiteSpace: 'nowrap' }}>
                  {s.label}{s.isNew ? <span style={{ color: '#ff4400', fontWeight: 700 }}> {lang === 'ko' ? '·신규계측' : '·new'}</span> : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MainFunnelView({ token, lang, dateRange }) {
  const L = (ko, en) => (lang === 'ko' ? ko : en)
  const [stage, setStage] = useState('traffic')

  // 퍼널 계측(landing client_id·공고 상세뷰)이 완비된 배포일. 이 탭만 이 날짜로 하한을 둔다
  // (그 이전은 진입 단계가 덜 잡혀 전환율이 왜곡됨). 다른 탭의 공유 dateRange 는 건드리지 않는다.
  const FUNNEL_FLOOR = '2026-07-16'
  const effFrom = dateRange.from < FUNNEL_FLOOR ? FUNNEL_FLOOR : dateRange.from
  const clamped = dateRange.from < FUNNEL_FLOOR
  const qs = `from=${effFrom}&to=${dateRange.to}`
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
    apply: L(
      `지원 ${fmt(funnel.applications.total)}건 · 실공고 ${fmt(funnel.applications.realFake?.real.count)}건`,
      `${fmt(funnel.applications.total)} applies · ${fmt(funnel.applications.realFake?.real.count)} real`,
    ),
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
    signup: L('가입 상세 — 이탈 지도 · 유입 경로', 'Sign-up detail — drop-off map & source'),
    apply: L('지원 상세', 'Apply detail'),
    accepted: L('합격 상세', 'Accepted detail'),
  }

  return (
    <>
      {/* ── 퍼널 스트립: 4단계 카드 + 단계간 전환율 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: '#666' }}>
          {effFrom} ~ {dateRange.to} · {L('기간 내 발생 기준 (코호트 아님)', 'Period-based, not cohort')}
          {clamped && <span style={{ color: '#ff4400', marginLeft: 6 }}>{L('· 퍼널 계측 시작 7/16로 하한', '· floored to Jul 16')}</span>}
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

      {/* ── 일별 퍼널 (매일 보는 메인 표 — 단계 상세보다 위) ── */}
      <div style={{ ...sectionStyle, paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{L('일별 퍼널 (최신순)', 'Daily funnel (latest first)')}</span>
          <span style={{ fontSize: 11, color: '#8B95A1' }}>{L('가입률 = 가입/유입 · 지원자 단위 지표는 지원 카드에서', 'Signup% = signups/users')}</span>
        </div>
        <div className="adm-m-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff' }}>
                <th style={thLeft}>{L('날짜', 'Date')}</th>
                <th style={thStyle}>{L('유입', 'Users')}</th>
                <th style={thStyle}>{L('가입', 'Sign-ups')}</th>
                <th style={thStyle}>{L('가입률', 'Signup %')}</th>
                <th style={thStyle}>{L('지원 건', 'Applies')}</th>
                <th style={thStyle}>{L('실공고 건', 'Real jobs')}</th>
                <th style={thStyle}>{L('합격', 'Accepted')}</th>
              </tr>
            </thead>
            <tbody>
              {allDates.map(d => {
                const u = ga4Daily[d]?.totalUsers ?? null
                const sg = funnel.signups.daily[d] || 0
                const ap = funnel.applications.daily[d] || { count: 0, real: 0, users: 0 }
                const ac = funnel.accepted.daily[d] || 0
                const signupRate = pct(sg, u)
                return (
                  <tr key={d} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ ...tdLeft, fontWeight: 600 }}>{d}</td>
                    <td style={tdStyle}>{fmt(u)}</td>
                    <td style={tdStyle}>{sg || '·'}</td>
                    <td style={{ ...tdStyle, color: rateColor(signupRate), fontWeight: 600 }}>{signupRate === null ? '—' : `${signupRate}%`}</td>
                    <td style={tdStyle}>{ap.count || '·'}</td>
                    <td style={{ ...tdStyle, color: '#16A34A', fontWeight: ap.real ? 600 : 400 }}>{ap.real || '·'}</td>
                    <td style={{ ...tdStyle, fontWeight: ac ? 700 : 400, color: ac ? '#16A34A' : '#191F28' }}>{ac || '·'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
            rows={(ga4.landingPages || []).filter(p => !String(p.page).startsWith('/admin')).slice(0, 10).map(p => [
              p.page, fmt(p.sessions), fmt(p.totalUsers), `${(p.bounceRate * 100).toFixed(0)}%`,
            ])}
          />
        </>
      ) : (
        <div style={{ ...sectionStyle, color: '#999', fontSize: 13 }}>{ga4Error ? L('GA4 데이터를 불러오지 못했습니다.', 'Failed to load GA4 data.') : L('GA4 로딩 중…', 'Loading GA4…')}</div>
      ))}

      {stage === 'signup' && (
        <>
          {/* 진입면별 → 가입 퍼널 (per-user dedup·순차, sign_up 종료) */}
          {funnel.pathFunnels && (
            <div style={{ ...sectionStyle, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>
                  {L('진입면별 → 가입 전환 퍼널', 'Entry surface → signup funnels')}
                </span>
                <span style={{ fontSize: 12, color: '#8B95A1' }}>
                  {L('총 가입', 'Sign-ups')} <b style={{ color: '#191F28' }}>{fmt(signups)}</b>
                </span>
              </div>
              {PATH_META.map(pm => {
                const rows = funnel.pathFunnels[pm.key]
                if (!rows) return (
                  <div key={pm.key} style={{ fontSize: 12, color: '#C2452B', marginBottom: 12 }}>
                    {L(`${L(...pm.title)} — 퍼널 RPC 미적용 (20260716 + 20260720 마이그레이션 실행 필요)`,
                       'Funnel RPC not applied')}
                  </div>
                )
                return (
                  <StepChain key={pm.key} lang={lang} title={L(...pm.title)}
                    steps={rows.map(r => ({ label: L(...(EV_LABEL[r.event] || [r.event, r.event])), value: r.users }))} />
                )
              })}
              <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 4 }}>
                {L('유저 단위 dedup · 순차 · t0(1단계 최초 발생) 기준 1일 윈도우 · 마지막 단계=가입. 로그아웃→가입 연결은 client_id 스티칭(ev 뷰)에 의존. 위저드·게이트 계측은 7/14 저녁, 공고 상세뷰는 7/16 배포부터 — 그 이전 기간은 낮게 보임.',
                   'Per-user, sequential, 1-day window from t0, final step = signup. Depends on client_id stitching (ev view).')}
              </div>
            </div>
          )}
          <DetailTable
            title={L('가입 유입 경로 (utm_source / campaign, 미기록=organic/direct)', 'Signup source (utm_source / campaign)')}
            columns={[L('경로', 'Source'), L('가입자', 'Sign-ups'), L('비중', 'Share')]}
            rows={funnel.signups.bySource.map(r => [r.key, fmt(r.count), `${pct(r.count, signups) ?? 0}%`])}
          />
        </>
      )}

      {stage === 'apply' && (
        <>
          {/* real(기업등록+KTC) vs fake(크롤/수동) 공고 지원 분리 */}
          {funnel.applications.realFake && (
            <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { k: 'real', label: L('실공고 지원 (기업등록 + KTC)', 'Real jobs (company + KTC)'), color: '#16A34A' },
                { k: 'fake', label: L('크롤 공고 지원 (wanted/topdev 등)', 'Crawled jobs (wanted/topdev …)'), color: '#8B95A1' },
              ].map(({ k, label, color }) => {
                const v = funnel.applications.realFake[k]
                return (
                  <div key={k} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: '#191F28' }}>{fmt(v.count)}{L('건', '')}</span>
                      <span style={{ fontSize: 12, color: '#8B95A1' }}>
                        {v.users}{L('명', ' users')} · {pct(v.count, funnel.applications.total) ?? 0}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ ...sectionStyle, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>
                {L('지원 횟수 분포 — n회 지원한 사람 수', 'Applies per user — distribution')}
              </span>
              <span style={{ fontSize: 12, color: '#8B95A1' }}>
                {L('인당 평균', 'Avg per user')} <b style={{ color: '#191F28' }}>{applicants > 0 ? (funnel.applications.total / applicants).toFixed(1) : '—'}</b>{L('회', '')}
              </span>
            </div>
            {(() => {
              const dist = funnel.applications.applyDist || []
              const maxUsers = Math.max(...dist.map(d => d.users), 1)
              const BAR_H = 120
              return (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  {dist.map(d => (
                    <div key={d.bucket} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', marginBottom: 4 }}>{d.users}</div>
                      <div style={{ width: '60%', height: Math.max(4, (d.users / maxUsers) * BAR_H), background: '#0D9488', borderRadius: '4px 4px 0 0' }} />
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginTop: 6 }}>{d.bucket}{L('회', 'x')}</div>
                      <div style={{ fontSize: 10, color: '#8B95A1' }}>{pct(d.users, applicants) ?? 0}%</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
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
            title={L('공고 출처별 지원 (real = company_self·ktc)', 'Applies by job source (real = company_self·ktc)')}
            columns={[L('공고 출처', 'Job source'), L('건수', 'Count'), L('비중', 'Share')]}
            rows={(funnel.applications.byJobSource || []).map(r => [
              ['company_self', 'ktc'].includes(r.key) ? `${r.key} ✓real` : r.key,
              fmt(r.count), `${pct(r.count, funnel.applications.total) ?? 0}%`,
            ])}
          />
          <DetailTable
            title={L('지원 많은 공고 Top 15', 'Top 15 jobs by applications')}
            columns={[L('회사 · 공고', 'Company · Job'), L('구분', 'Type'), L('지원', 'Applies'), L('합격', 'Accepted')]}
            rows={funnel.applications.topJobs.map(j => [
              `${j.company} · ${j.title}`,
              ['company_self', 'ktc'].includes(j.source) ? `✓ real (${j.source})` : j.source,
              fmt(j.count), fmt(j.accepted),
            ])}
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

      {/* ── 행동 퍼널 (암플리튜드식 단계 선택) ── */}
      <BehaviorFunnel token={token} lang={lang} dateRange={dateRange} />
    </>
  )
}
