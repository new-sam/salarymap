import { useState, useEffect } from 'react'

// 앱(모바일) 행동지표 뷰 — /api/admin/app-metrics 집계를 렌더.
// 전략 톱라인(회의브리프: D7 잔존 · 글당 답글 · 푸시 재방문)을 최상단에 고정하고,
// 서브탭으로 리텐션 / 커뮤니티 / 전환 / 푸시 / 세그먼트를 분리.

const sectionStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }
const sectionTitle = { fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }
const thStyle = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }
const tdStyle = { padding: '8px 12px' }

const L = {
  ko: {
    loading: '앱 지표 불러오는 중...', empty: '앱 이벤트 데이터가 아직 없습니다.',
    metaLine: (m) => `집계: ${m.from} ~ ${m.to} · 범위 내 이벤트 ${m.rangeEvents.toLocaleString()}건 (앱 누적 ${m.totalAppEvents.toLocaleString()}건, ${m.appEventStart}~)`,
    toplineTitle: '전략 톱라인 — 한 달 뒤 볼 숫자 3개',
    d7: '앱 D7 잔존율', d7sub: '다시 오는가 (최우선)',
    cpp: '글당 답글 수', cppSub: '커뮤니티 생존 (0이면 사망)',
    pushRe: '푸시 재방문', pushReSub: '엔진이 도는가',
    tabs: { retention: '리텐션', community: '커뮤니티', conversion: '전환', push: '푸시', segments: '세그먼트' },
    dau: 'DAU (최근일)', wau: 'WAU (7일)', mau: 'MAU (30일)',
    cohortTitle: '주간 코호트 리텐션 (client_id 기준)', week: '가입 주차', users: '유저',
    cohortNote: '* 영속 익명 디바이스(client_id) 기준. 앱 재설치 시 새 ID 발급(동일인 신규로 카운트). 로그인 유저는 user_id로 보완.',
    dauTitle: '일별 활성 유저 (신규/재방문)', newU: '신규', retU: '재방문',
    funnelTitle: '커뮤니티 참여 퍼널', funnelUserNote: '괄호=동일유저(client_id) 도달 수',
    fView: '진입', fClick: '글 클릭', fViewPost: '상세 도달', fEngage: '가벼운 참여', fCreate: '글 작성',
    ctr: '글 클릭률', engageRate: '참여 전환율', writeConv: '작성 전환율',
    supplyTitle: '콘텐츠 공급 & 건강도', posts: '신규 글', comments: '신규 댓글',
    anonPost: '익명 글 비율', anonComment: '익명 댓글 비율',
    roles: '작성자 / 반응자 / 열람자 (1% 법칙)', creators: '작성자', reactors: '반응자', viewers: '열람자',
    catTitle: '카테고리 · 검색 인사이트', catViewed: '소비된 카테고리(상세 조회)', searches: '인기 검색어',
    jobsTitle: '채용 지원 퍼널', jView: '채용 진입', jCard: '공고 열람', jApply: '지원 시도', jSubmit: '지원 완료',
    viewRate: '열람률', applyRate: '지원 시도율', submitRate: '지원 완료율', saveRate: '저장률',
    submitLeak: '↑ 로그인·이력서 게이트 누수 지점',
    salaryTitle: '연봉 제출 (앱 핵심 전환)', salaryCount: '제출 수', salaryUsers: '제출 유저(고유)',
    byRole: '직군 분포', byExp: '연차 분포',
    resumeTitle: '이력서 등록', resumeUploads: '업로드 수', resumeUsers: '업로드 유저', uploadToApply: '업로드→지원 전환',
    pushTitle: '푸시 (재참여 엔진)', pushClicks: '클릭(재방문)', pushClickUsers: '클릭 유저', pushReceived: '수신(포그라운드)',
    pushByCat: '푸시 종류별 클릭', pushNote: '⚠ 정상 클릭률(클릭/발송)의 분모(발송 수)는 서버 발송 로그가 출처입니다. 여기선 클릭 볼륨·재방문 유저·종류별 분해를 봅니다. 수신은 OS 한계로 앱 실행 중(포그라운드)만 잡힙니다.',
    osTitle: 'OS 분포', verTitle: '앱 버전 분포 (릴리스 코호트)',
    count: '건', noData: '데이터 없음',
  },
  en: {
    loading: 'Loading app metrics...', empty: 'No app events yet.',
    metaLine: (m) => `Range: ${m.from} ~ ${m.to} · ${m.rangeEvents.toLocaleString()} events in range (${m.totalAppEvents.toLocaleString()} app events total, since ${m.appEventStart})`,
    toplineTitle: 'Strategy Topline — 3 numbers for next month',
    d7: 'App D7 Retention', d7sub: 'Do they come back (top priority)',
    cpp: 'Replies per Post', cppSub: 'Community survival (0 = dead)',
    pushRe: 'Push Re-engagement', pushReSub: 'Is the engine running',
    tabs: { retention: 'Retention', community: 'Community', conversion: 'Conversion', push: 'Push', segments: 'Segments' },
    dau: 'DAU (latest)', wau: 'WAU (7d)', mau: 'MAU (30d)',
    cohortTitle: 'Weekly Cohort Retention (by client_id)', week: 'Signup week', users: 'Users',
    cohortNote: '* By persistent anonymous device (client_id). Reinstall issues a new ID. Logged-in users supplemented by user_id.',
    dauTitle: 'Daily Active Users (new/returning)', newU: 'New', retU: 'Returning',
    funnelTitle: 'Community Engagement Funnel', funnelUserNote: '(parens) = unique users (client_id) reached',
    fView: 'Enter', fClick: 'Post click', fViewPost: 'Post detail', fEngage: 'Light engage', fCreate: 'Create post',
    ctr: 'Post CTR', engageRate: 'Engagement rate', writeConv: 'Write conversion',
    supplyTitle: 'Content Supply & Health', posts: 'New posts', comments: 'New comments',
    anonPost: 'Anon post rate', anonComment: 'Anon comment rate',
    roles: 'Creators / Reactors / Viewers (1% rule)', creators: 'Creators', reactors: 'Reactors', viewers: 'Viewers',
    catTitle: 'Category & Search Insights', catViewed: 'Consumed categories (detail views)', searches: 'Top searches',
    jobsTitle: 'Job Application Funnel', jView: 'Jobs enter', jCard: 'Card view', jApply: 'Apply attempt', jSubmit: 'Apply complete',
    viewRate: 'View rate', applyRate: 'Apply-attempt rate', submitRate: 'Apply-complete rate', saveRate: 'Save rate',
    submitLeak: '↑ login/resume gate leak point',
    salaryTitle: 'Salary Submission (core conversion)', salaryCount: 'Submissions', salaryUsers: 'Unique submitters',
    byRole: 'By role', byExp: 'By experience',
    resumeTitle: 'Resume Upload', resumeUploads: 'Uploads', resumeUsers: 'Upload users', uploadToApply: 'Upload→apply conv',
    pushTitle: 'Push (re-engagement engine)', pushClicks: 'Clicks (returns)', pushClickUsers: 'Click users', pushReceived: 'Received (foreground)',
    pushByCat: 'Clicks by push type', pushNote: '⚠ True CTR (clicks/sent) needs the sent-count from server push logs. Here we show click volume, return users, and per-type breakdown. Received only fires in foreground (OS limit).',
    osTitle: 'OS Breakdown', verTitle: 'App Version Breakdown (release cohort)',
    count: '', noData: 'No data',
  },
}

function Card({ label, value, sub, color = '#111', big }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: big ? 32 : 24, fontWeight: 700, color }}>{value}</div>
      {sub != null && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// 라벨 + 막대 + 값 (분포/퍼널용 경량 바)
function BarRow({ label, value, max, suffix = '', color = '#4F46E5', note }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <div style={{ width: 130, fontSize: 12, color: '#374151', flexShrink: 0, textAlign: 'right' }}>{label}</div>
      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 20, position: 'relative' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4 }} />
      </div>
      <div style={{ width: 110, fontSize: 12, fontWeight: 600, color: '#111', flexShrink: 0 }}>
        {value.toLocaleString()}{suffix}{note ? <span style={{ color: '#9CA3AF', fontWeight: 400 }}> {note}</span> : null}
      </div>
    </div>
  )
}

function rateColor(r) {
  const v = parseFloat(r); if (isNaN(v)) return '#ccc'
  if (v >= 50) return '#065F46'; if (v >= 30) return '#10B981'; if (v >= 15) return '#F59E0B'; return '#EF4444'
}
function rateBg(r) {
  const v = parseFloat(r); if (isNaN(v)) return '#f9fafb'
  if (v >= 50) return '#D1FAE5'; if (v >= 30) return '#ECFDF5'; if (v >= 15) return '#FFFBEB'; return '#FEF2F2'
}

function DistTable({ rows, t, headLabel }) {
  if (!rows || !rows.length) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>
  const max = rows[0].count
  return rows.map(r => <BarRow key={r.name} label={r.name} value={r.count} max={max} color="#6B7280" />)
}

export default function AppMetricsView({ token, dateRange, lang }) {
  const t = L[lang === 'en' ? 'en' : 'ko']
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState('retention')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/app-metrics?from=${dateRange.from}&to=${dateRange.to}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok && !cancelled) setData(await res.json())
      } catch (e) { console.error(e) }
      if (!cancelled) setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [token, dateRange])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.loading}</div>
  if (!data || !data.meta.totalAppEvents) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.empty}</div>

  const { meta, topline, retention, community, conversion, push, segments } = data
  const cppNum = parseFloat(topline.commentsPerPost)
  const SUB_TABS = ['retention', 'community', 'conversion', 'push', 'segments']

  return (
    <>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>{t.metaLine(meta)}</div>

      {/* 전략 톱라인 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>{t.toplineTitle}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Card big label={t.d7} value={`${topline.d7.rate}%`} sub={`${t.d7sub} · ${topline.d7.retained}/${topline.d7.eligible}`} color={rateColor(topline.d7.rate)} />
          <Card big label={t.cpp} value={topline.commentsPerPost} sub={t.cppSub} color={isNaN(cppNum) || cppNum < 1 ? '#EF4444' : '#10B981'} />
          <Card big label={t.pushRe} value={push.clicks.toLocaleString()} sub={`${t.pushReSub} · ${push.clickUsers} users`} color="#8B5CF6" />
        </div>
      </div>

      {/* 서브탭 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        {SUB_TABS.map(k => (
          <button key={k} onClick={() => setSub(k)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none',
            borderBottom: sub === k ? '2px solid #4F46E5' : '2px solid transparent', marginBottom: -2,
            color: sub === k ? '#4F46E5' : '#999',
          }}>{t.tabs[k]}</button>
        ))}
      </div>

      {/* ── 리텐션 ── */}
      {sub === 'retention' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <Card label={t.dau} value={retention.dau} color="#374151" />
            <Card label={t.wau} value={retention.wau} color="#2563EB" />
            <Card label={t.mau} value={retention.mau} color="#10B981" />
            <Card label="D1" value={`${retention.d1.rate}%`} sub={`${retention.d1.retained}/${retention.d1.eligible}`} color="#F59E0B" />
            <Card label="D7" value={`${retention.d7.rate}%`} sub={`${retention.d7.retained}/${retention.d7.eligible}`} color="#8B5CF6" />
            <Card label="D30" value={`${retention.d30.rate}%`} sub={`${retention.d30.retained}/${retention.d30.eligible}`} color="#EF4444" />
          </div>

          {retention.dauSeries.length > 0 && (
            <div style={sectionStyle}>
              <h3 style={sectionTitle}>{t.dauTitle}</h3>
              <DauChart series={retention.dauSeries} t={t} />
            </div>
          )}

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.cohortTitle}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>
                  <th style={thStyle}>{t.week}</th><th style={{ ...thStyle, textAlign: 'right' }}>{t.users}</th>
                  {['W1', 'W2', 'W3', 'W4'].map(w => <th key={w} style={{ ...thStyle, textAlign: 'center' }}>{w}</th>)}
                </tr></thead>
                <tbody>
                  {retention.cohorts.map((c, i) => (
                    <tr key={c.week} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{c.week}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{c.total}</td>
                      {c.weeks.map((w, wi) => (
                        <td key={wi} style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, background: w ? rateBg(w.rate) : '#f9fafb', color: w ? rateColor(w.rate) : '#ccc' }}>
                          {w ? `${w.rate}%` : '-'}
                          {w && <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{w.retained}/{w.eligible}</div>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>{t.cohortNote}</div>
          </div>
        </>
      )}

      {/* ── 커뮤니티 ── */}
      {sub === 'community' && (
        <>
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.funnelTitle}</h3>
            {(() => {
              const f = community.funnel
              const steps = [
                { label: t.fView, value: f.view, u: f.uView }, { label: t.fClick, value: f.click, u: f.uClick },
                { label: t.fViewPost, value: f.viewPost, u: f.uViewPost }, { label: t.fEngage, value: f.engage, u: f.uEngage },
                { label: t.fCreate, value: f.create, u: f.uCreate },
              ]
              const max = Math.max(1, ...steps.map(s => s.value))
              return steps.map(s => <BarRow key={s.label} label={s.label} value={s.value} max={max} color="#4F46E5" note={`(${s.u})`} />)
            })()}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>{t.funnelUserNote}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
              <Card label={t.ctr} value={community.ctr != null ? `${community.ctr}%` : '-'} color="#4F46E5" />
              <Card label={t.engageRate} value={community.engageRate != null ? `${community.engageRate}%` : '-'} color="#8B5CF6" />
              <Card label={t.writeConv} value={community.writeConv != null ? `${community.writeConv}%` : '-'} color="#10B981" />
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.supplyTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              <Card label={t.posts} value={community.posts} color="#2563EB" />
              <Card label={t.comments} value={community.comments} color="#2563EB" />
              <Card label={t.cpp} value={community.commentsPerPost} color={cppNum < 1 ? '#EF4444' : '#10B981'} />
              <Card label={t.anonPost} value={community.anonPostRate != null ? `${community.anonPostRate}%` : '-'} color="#6B7280" />
              <Card label={t.anonComment} value={community.anonCommentRate != null ? `${community.anonCommentRate}%` : '-'} color="#6B7280" />
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '20px 0 10px' }}>{t.roles}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Card label={t.creators} value={community.creators} color="#EF4444" />
              <Card label={t.reactors} value={community.reactors} color="#F59E0B" />
              <Card label={t.viewers} value={community.viewers} color="#6B7280" />
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.catTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.catViewed}</h4>
                <DistTable rows={community.categoriesViewed} t={t} />
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.searches}</h4>
                <DistTable rows={community.topSearches} t={t} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 전환 ── */}
      {sub === 'conversion' && (
        <>
          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.jobsTitle}</h3>
            {(() => {
              const j = conversion.jobs
              const steps = [
                { label: t.jView, value: j.view }, { label: t.jCard, value: j.card },
                { label: t.jApply, value: j.apply }, { label: t.jSubmit, value: j.submit },
              ]
              const max = Math.max(1, ...steps.map(s => s.value))
              return steps.map(s => <BarRow key={s.label} label={s.label} value={s.value} max={max} color="#2563EB" />)
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 16 }}>
              <Card label={t.viewRate} value={conversion.jobs.viewRate != null ? `${conversion.jobs.viewRate}%` : '-'} color="#2563EB" />
              <Card label={t.applyRate} value={conversion.jobs.applyRate != null ? `${conversion.jobs.applyRate}%` : '-'} color="#8B5CF6" />
              <Card label={t.submitRate} value={conversion.jobs.submitRate != null ? `${conversion.jobs.submitRate}%` : '-'} sub={t.submitLeak} color={rateColor(conversion.jobs.submitRate)} />
              <Card label={t.saveRate} value={conversion.jobs.saveRate != null ? `${conversion.jobs.saveRate}%` : '-'} color="#6B7280" />
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.salaryTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
              <Card label={t.salaryCount} value={conversion.salary.count} color="#10B981" />
              <Card label={t.salaryUsers} value={conversion.salary.uniqueUsers} color="#059669" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.byRole}</h4>
                <DistTable rows={conversion.salary.byRole} t={t} />
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.byExp}</h4>
                <DistTable rows={conversion.salary.byExperience} t={t} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={sectionTitle}>{t.resumeTitle}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Card label={t.resumeUploads} value={conversion.resume.uploads} color="#2563EB" />
              <Card label={t.resumeUsers} value={conversion.resume.uploadUsers} color="#2563EB" />
              <Card label={t.uploadToApply} value={conversion.resume.uploadToApply != null ? `${conversion.resume.uploadToApply}%` : '-'} color="#10B981" />
            </div>
          </div>
        </>
      )}

      {/* ── 푸시 ── */}
      {sub === 'push' && (
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>{t.pushTitle}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Card label={t.pushClicks} value={push.clicks} color="#8B5CF6" />
            <Card label={t.pushClickUsers} value={push.clickUsers} color="#7C3AED" />
            <Card label={t.pushReceived} value={push.received} color="#6B7280" />
          </div>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t.pushByCat}</h4>
          {push.byCategory.length ? (() => {
            const max = Math.max(1, ...push.byCategory.map(c => c.click))
            return push.byCategory.map(c => <BarRow key={c.name} label={c.name} value={c.click} max={max} color="#8B5CF6" note={`/ ${c.received} rcv`} />)
          })() : <div style={{ color: '#9CA3AF', fontSize: 13 }}>{t.noData}</div>}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.6 }}>{t.pushNote}</div>
        </div>
      )}

      {/* ── 세그먼트 ── */}
      {sub === 'segments' && (
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h3 style={sectionTitle}>{t.osTitle}</h3>
              <DistTable rows={segments.os} t={t} />
            </div>
            <div>
              <h3 style={sectionTitle}>{t.verTitle}</h3>
              <DistTable rows={segments.appVersion} t={t} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// 일별 활성 유저 — 신규/재방문 스택 막대(경량 div).
function DauChart({ series, t }) {
  const max = Math.max(1, ...series.map(s => s.active))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, overflowX: 'auto', paddingBottom: 4 }}>
        {series.map(s => (
          <div key={s.date} title={`${s.date}\n${t.newU}: ${s.new} / ${t.retU}: ${s.returning}`} style={{ flex: '1 0 14px', minWidth: 14, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ height: `${(s.returning / max) * 100}%`, background: '#2563EB', borderRadius: '3px 3px 0 0' }} />
            <div style={{ height: `${(s.new / max) * 100}%`, background: '#93C5FD' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: '#6B7280' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#93C5FD', borderRadius: 2, marginRight: 4 }} />{t.newU}</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2563EB', borderRadius: 2, marginRight: 4 }} />{t.retU}</span>
      </div>
    </div>
  )
}
