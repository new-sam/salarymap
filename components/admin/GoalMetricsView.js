import { useState, useEffect, useCallback } from 'react'
import MetricChart from '../DashboardCharts'
import { templateFor, localizeTemplate, DRAFT_CAMPAIGNS } from './coldmailTemplates'
import { ROLE_GROUPS } from '../../constants/jobs'

// "승주 작업실" — 어드민 인증으로만 접근(개인 비밀번호 게이트 제거).
// 기본 탭은 목표지표인 [이력서 공개].

export default function GoalMetricsView({ token, lang }) {
  const ko = lang !== 'en'
  const [view, setView] = useState('resumePublic')

  const [rpData, setRpData] = useState(null) // 이력서 공개 전환 (목표지표)
  const [rpError, setRpError] = useState('')
  const [rpLoading, setRpLoading] = useState(false)

  const [cmData, setCmData] = useState(null) // 콜드메일 공개 전환
  const [cmError, setCmError] = useState('')
  const [cmLoading, setCmLoading] = useState(false)

  const [spData, setSpData] = useState(null) // 가입 경로 (가입자별 유입)
  const [spError, setSpError] = useState('')
  const [spLoading, setSpLoading] = useState(false)

  const [phData, setPhData] = useState(null) // 프로필 사진 현황
  const [phError, setPhError] = useState('')
  const [phLoading, setPhLoading] = useState(false)

  const [reData, setReData] = useState(null) // 전직군 개편
  const [reError, setReError] = useState('')
  const [reLoading, setReLoading] = useState(false)

  const [hkData, setHkData] = useState(null) // 홍익 QR 캠페인
  const [hkError, setHkError] = useState('')
  const [hkLoading, setHkLoading] = useState(false)

  const loadRp = useCallback(async () => {
    if (!token) return
    setRpLoading(true)
    setRpError('')
    try {
      const res = await fetch('/api/admin/resume-public-metrics', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setRpData(await res.json())
    } catch (e) {
      setRpError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setRpLoading(false)
    }
  }, [token, ko])

  const loadCm = useCallback(async () => {
    if (!token) return
    setCmLoading(true)
    setCmError('')
    try {
      const res = await fetch('/api/admin/campaign-resume-public-metrics', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setCmData(await res.json())
    } catch (e) {
      setCmError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setCmLoading(false)
    }
  }, [token, ko])

  const loadSp = useCallback(async () => {
    if (!token) return
    setSpLoading(true)
    setSpError('')
    try {
      const res = await fetch('/api/admin/signup-paths', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setSpData(await res.json())
    } catch (e) {
      setSpError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setSpLoading(false)
    }
  }, [token, ko])

  const loadPh = useCallback(async () => {
    if (!token) return
    setPhLoading(true)
    setPhError('')
    try {
      const res = await fetch('/api/admin/photo-stats', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setPhData(await res.json())
    } catch (e) {
      setPhError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setPhLoading(false)
    }
  }, [token, ko])

  const loadRe = useCallback(async () => {
    if (!token) return
    setReLoading(true)
    setReError('')
    try {
      const res = await fetch('/api/admin/role-expansion', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setReData(await res.json())
    } catch (e) {
      setReError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setReLoading(false)
    }
  }, [token, ko])

  const loadHk = useCallback(async () => {
    if (!token) return
    setHkLoading(true)
    setHkError('')
    try {
      const res = await fetch('/api/admin/hongik-metrics', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setHkData(await res.json())
    } catch (e) {
      setHkError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setHkLoading(false)
    }
  }, [token, ko])

  // 전직군 개편 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'roleExpansion' && !reData && !reLoading) loadRe()
  }, [view, reData, reLoading, loadRe])

  // 홍익 QR 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'hongik' && !hkData && !hkLoading) loadHk()
  }, [view, hkData, hkLoading, loadHk])

  // 프로필 사진 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'photos' && !phData && !phLoading) loadPh()
  }, [view, phData, phLoading, loadPh])

  // 이력서 공개 전환 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'resumePublic' && !rpData && !rpLoading) loadRp()
  }, [view, rpData, rpLoading, loadRp])

  // 콜드메일 공개 전환 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'coldmail' && !cmData && !cmLoading) loadCm()
  }, [view, cmData, cmLoading, loadCm])

  // 가입 경로 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'paths' && !spData && !spLoading) loadSp()
  }, [view, spData, spLoading, loadSp])

  const tabBtn = (key, label) => (
    <button onClick={() => setView(key)} style={{
      padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 9,
      background: view === key ? '#1d1d1f' : 'transparent', color: view === key ? '#fff' : '#6B7280',
    }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 16px 48px' }}>
      <div style={{ display: 'inline-flex', gap: 2, background: '#F1F1F4', borderRadius: 11, padding: 3, marginBottom: 18 }}>
        {tabBtn('resumePublic', ko ? '이력서 공개' : 'Resume public')}
        {tabBtn('roleExpansion', ko ? '전직군 개편' : 'Role expansion')}
        {tabBtn('coldmail', ko ? '콜드메일' : 'Cold email')}
        {tabBtn('photos', ko ? '프로필 사진' : 'Profile photos')}
        {tabBtn('paths', ko ? '가입 경로' : 'Signup paths')}
        {tabBtn('hongik', ko ? '홍익 QR' : 'Hongik QR')}
      </div>
      {view === 'roleExpansion' && <RoleExpansionTab data={reData} loading={reLoading} error={reError} ko={ko} lang={lang} />}
      {view === 'photos' && <PhotoStatsTab data={phData} loading={phLoading} error={phError} ko={ko} />}
      {view === 'paths' && <SignupPathsTab data={spData} loading={spLoading} error={spError} ko={ko} />}
      {view === 'resumePublic' && <ResumePublicTab data={rpData} loading={rpLoading} error={rpError} ko={ko} lang={lang} onRefresh={loadRp} />}
      {view === 'coldmail' && <ColdmailPublicTab data={cmData} loading={cmLoading} error={cmError} ko={ko} lang={lang} />}
      {view === 'hongik' && <HongikTab data={hkData} loading={hkLoading} error={hkError} ko={ko} onRefresh={loadHk} />}
    </div>
  )
}

// ============ 전직군 개편 탭 ============
// 직군 선택을 2단계(대분류 12 → 소분류 48)로 바꾸고 비개발까지 넓힌 개편이 먹히는지.
// 판단 기준: (1) 신규 직군(영업·마케팅·생산·재무 등) 제출 비중이 개편 전보다 올랐나
//           (2) 대분류를 눌러놓고 소분류에서 이탈하는 구간이 큰가
function RoleExpansionTab({ data, loading, error, ko, lang }) {
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const { deployed, rolloutDate, compareDays, totals, mix, cats, subRoles, daily } = data
  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }
  const L = (o) => (ko ? o.ko : o.en)
  const rate = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')

  const beforeAll = mix.before.dev + mix.before.expand
  const afterAll = mix.after.dev + mix.after.expand
  const beforePct = beforeAll ? Math.round((mix.before.expand / beforeAll) * 100) : 0
  const afterPct = afterAll ? Math.round((mix.after.expand / afterAll) * 100) : 0
  const maxSub = Math.max(1, ...cats.map(c => c.subs))
  const maxSubRole = Math.max(1, ...subRoles.map(s => s.n))

  const Card = ({ label, value, sub, accent }) => (
    <div style={{ flex: '1 1 180px', background: '#fff', border: '1px solid #E5E8EB', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || '#0F172A', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>}
    </div>
  )
  const Bar = ({ n, max, color }) => (
    <div style={{ height: 6, background: '#F1F2F4', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${Math.round((n / max) * 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
        {ko ? '전직군 개편' : 'Role expansion'}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        {ko
          ? `대분류 12 → 소분류 48 2단계 선택 · 시드 제출 제외 · 기준 ${new Date(data.generatedAt).toLocaleString('ko-KR')}`
          : `12 categories → 48 sub-roles · seed submissions excluded · as of ${new Date(data.generatedAt).toLocaleString('en-US')}`}
      </div>

      {!deployed && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, color: '#9A3412' }}>
          {ko
            ? '아직 배포 전 — 클릭·단계 지표는 배포 후부터 쌓인다. 아래 제출 구성은 최근 30일 현재 값(개편 전 기준선).'
            : 'Not deployed yet — click/step metrics start after deploy. Submission mix below is the last 30 days (pre-change baseline).'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Card label={ko ? '신규 직군 제출 비중' : 'New-role share'} value={`${afterPct}%`}
          sub={ko ? `개편 전 ${compareDays}일 ${beforePct}% → 개편 후 ${afterPct}%` : `${beforePct}% before → ${afterPct}% after`}
          accent={afterPct >= beforePct ? '#059669' : '#DC2626'} />
        <Card label={ko ? '신규 직군 제출' : 'New-role submissions'} value={mix.after.expand.toLocaleString()}
          sub={ko ? `개편 후 전체 ${afterAll.toLocaleString()}건 중` : `of ${afterAll.toLocaleString()} after rollout`} accent="#0D9488" />
        <Card label={ko ? '대분류 클릭' : 'Category clicks'} value={totals.clicks.toLocaleString()}
          sub={ko ? `신규 직군 ${totals.expandClicks.toLocaleString()} (${rate(totals.expandClicks, totals.clicks)})` : `new roles ${totals.expandClicks.toLocaleString()} (${rate(totals.expandClicks, totals.clicks)})`}
          accent="#7C3AED" />
        <Card label={ko ? '클릭 → 제출 완주율' : 'Click → submit'} value={rate(totals.submits, totals.clicks)}
          sub={ko ? `소분류 선택 ${rate(totals.starts, totals.clicks)} · 제출 ${totals.submits.toLocaleString()}건` : `sub-role ${rate(totals.starts, totals.clicks)} · ${totals.submits.toLocaleString()} submits`} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>{ko ? '대분류별 퍼널' : 'Funnel by category'}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>
        {ko
          ? '클릭 = 대분류 버튼 · 소분류 = 세부 직무 확정(위저드 시작) · 제출 = 위저드 완료. 클릭 대비 소분류가 크게 빠지면 소분류 명칭이 안 맞는 것'
          : 'Click = category button · Sub-role = wizard start · Submit = wizard done'}
      </div>
      <div className="adm-m-scroll" style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12, marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr>
            <th style={th}>{ko ? '대분류' : 'Category'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '클릭' : 'Clicks'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '소분류 선택' : 'Sub-role'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '제출 완료' : 'Submit'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '완주율' : 'Rate'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '실제 제출(건)' : 'Submissions'}</th>
          </tr></thead>
          <tbody>
            {cats.map(c => (
              <tr key={c.key}>
                <td style={{ ...td, fontWeight: 700 }}>
                  {L(c.label)}
                  {!c.dev && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#0D9488', background: '#ECFDF5', borderRadius: 5, padding: '2px 5px' }}>{ko ? '신규' : 'NEW'}</span>}
                </td>
                <td style={num}>{c.clicks.toLocaleString()}</td>
                <td style={num}>{c.starts.toLocaleString()}</td>
                <td style={num}>{c.submits.toLocaleString()}</td>
                <td style={{ ...num, fontWeight: 800 }}>{rate(c.submits, c.clicks)}</td>
                <td style={num}>
                  {c.subs.toLocaleString()}
                  <Bar n={c.subs} max={maxSub} color={c.dev ? '#94A3B8' : '#0D9488'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>{ko ? '신규 직군 소분류 제출' : 'New-role submissions by sub-role'}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>
        {ko ? '시드 제외 실제 제출 · 상위 20개 — 0건이 오래가는 소분류는 명칭을 의심' : 'Real submissions (seed excluded) · top 20'}
      </div>
      <div className="adm-m-scroll" style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12, marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
          <thead><tr>
            <th style={th}>{ko ? '소분류' : 'Sub-role'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '제출' : 'Submissions'}</th>
          </tr></thead>
          <tbody>
            {subRoles.length === 0 && (
              <tr><td style={{ ...td, color: '#9CA3AF' }} colSpan={2}>{ko ? '아직 없음' : 'None yet'}</td></tr>
            )}
            {subRoles.map(s => (
              <tr key={s.role}>
                <td style={td}>{L(s.label)}</td>
                <td style={num}>
                  {s.n.toLocaleString()}
                  <Bar n={s.n} max={maxSubRole} color="#0D9488" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, padding: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px 0', color: '#191F28' }}>{ko ? '일별 제출 구성' : 'Daily submissions'}</h4>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
          {ko ? '시드 제외 · 세로선 = 개편 배포' : 'Seed excluded · vertical line = rollout'}
        </div>
        <MetricChart
          daily={daily}
          metrics={[
            { key: 're-expand', dataKey: 'expand', label: ko ? '신규 직군' : 'New roles', color: '#0D9488' },
            { key: 're-dev', dataKey: 'dev', label: ko ? '기존 직군' : 'Existing roles', color: '#94A3B8' },
          ]}
          experiments={rolloutDate ? [{ id: 'rollout', date: rolloutDate, title: ko ? '전직군 개편' : 'Role expansion', color: '#7C3AED' }] : []}
          lang={lang}
        />
      </div>
    </div>
  )
}

// ============ 가입 경로 탭 ============
// 일별로 가입자 한 명 한 명의 유입 경로 — 가입이 튄 날 어떤 채널/캠페인이 만든 건지 확인용.
// 귀속: user_profiles.utm(가입 시점) > 첫 이벤트 utm > referrer.
function SignupPathsTab({ data, loading, error, ko }) {
  const [open, setOpen] = useState({}) // 날짜별 펼침 (최신 날짜는 기본 펼침)
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중… (가입자별 이벤트 조회에 몇 초 걸립니다)' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 12.5, color: '#1F2937', padding: '6px 10px', borderBottom: '1px solid #F5F6F7', whiteSpace: 'nowrap' }

  // 채널별 색 — 광고(주황), 검색/소셜(파랑), direct(회색), 미귀속(빨강)
  const chanColor = (c) => {
    if (c === 'meta_ad' || c === 'other_ad' || c.startsWith('utm:')) return { bg: '#FFF1EA', fg: '#C2410C' }
    if (c === 'organic_search' || c === 'social' || c === 'threads' || c.startsWith('ref:')) return { bg: '#EFF6FF', fg: '#1D4ED8' }
    if (c === 'no_event') return { bg: '#FEF2F2', fg: '#B91C1C' }
    return { bg: '#F3F4F6', fg: '#4B5563' } // direct/internal 등
  }
  const Chip = ({ name, count }) => {
    const { bg, fg } = chanColor(name)
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: fg, background: bg, padding: '2px 8px', borderRadius: 100 }}>
        {name}{count != null && <span style={{ fontWeight: 800, marginLeft: 4 }}>{count}</span>}
      </span>
    )
  }

  const isOpen = (date, i) => (date in open ? open[date] : i === 0)

  return (
    <div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>
        {ko ? `최근 ${data.windowDays}일 · 기준 ` : `Last ${data.windowDays}d · as of `}{new Date(data.generatedAt).toLocaleString(ko ? 'ko-KR' : 'en-US')}
      </div>
      <div style={{ fontSize: 11.5, color: '#B0B0B8', marginBottom: 16 }}>
        {ko
          ? '※ 경로 = 가입 시점 utm > 첫 이벤트 utm > referrer 순으로 귀속. no_event는 이벤트가 하나도 없어 귀속 불가(앱 초기 유저 등).'
          : '* Path = signup-time utm > first-event utm > referrer. no_event = no events to attribute.'}
      </div>

      {data.days.map((d, i) => (
        <div key={d.date} style={{ marginBottom: 12, border: '1px solid #EEF0F2', borderRadius: 12, overflow: 'hidden' }}>
          <div onClick={() => setOpen((o) => ({ ...o, [d.date]: !isOpen(d.date, i) }))}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: '#FAFAFB', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{isOpen(d.date, i) ? '▾' : '▸'}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{d.date}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#6B7280' }}>{d.total}{ko ? '명' : ''}</span>
            <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {d.channels.map((c) => <Chip key={c.name} name={c.name} count={c.count} />)}
            </span>
          </div>
          {isOpen(d.date, i) && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead><tr>
                  <th style={th}>{ko ? '시각' : 'Time'}</th>
                  <th style={th}>{ko ? '이메일' : 'Email'}</th>
                  <th style={th}>{ko ? '플랫폼' : 'Platform'}</th>
                  <th style={th}>{ko ? '경로' : 'Channel'}</th>
                  <th style={th}>{ko ? '캠페인' : 'Campaign'}</th>
                  <th style={th}>referrer</th>
                  <th style={th}>{ko ? '첫 페이지' : 'First page'}</th>
                </tr></thead>
                <tbody>
                  {d.signups.map((s, j) => (
                    <tr key={j}>
                      <td style={{ ...td, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })}
                      </td>
                      <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email || <span style={{ color: '#C0C4CC' }}>—</span>}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: s.platform === 'app' ? '#EDE9FE' : '#E0F2FE', color: s.platform === 'app' ? '#6D28D9' : '#0369A1' }}>{s.platform}</span>
                      </td>
                      <td style={td}><Chip name={s.channel} /></td>
                      <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', color: s.campaign ? '#1F2937' : '#C0C4CC' }} title={s.campaign || ''}>{s.campaign || '—'}</td>
                      <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', color: s.referrer ? '#4B5563' : '#C0C4CC' }} title={s.referrer || ''}>{s.referrer || '—'}</td>
                      <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', color: s.firstPage ? '#4B5563' : '#C0C4CC' }} title={s.firstPage || ''}>{s.firstPage || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============ 이력서 공개 전환 (목표지표) ============
// 공개 = 우리 공개 인재풀 노출(is_resume_public). 외부 인재마켓(VTM) 전송은 폐지됐다.
// 일별 전환은 DB 트리거가 심는 resume_public_on/off 이벤트로만 센다 — 프로필 updated_at 버킷은
// '오늘 공개함'이 아니라 '오늘 프로필 수정함'이라 지표를 부풀린다(7/14 착시의 원인).
// 콜드메일 전환을 따로 떼는 이유: 웹 공개의 대부분이 콜드메일 1회성이라, 섞어 보면
// 제품 자체의 전환율(유기적)이 실제보다 몇 배 높아 보인다.
function ResumePublicTab({ data, loading, error, ko, lang, onRefresh }) {
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const pct = (v) => `${Math.round(v * 1000) / 10}%`
  const t = data.totals
  const pp = data.privatePool
  const web = data.platforms.find((p) => p.key === 'web') || { reg: 0, pub: 0, organic: 0, organicRate: 0 }
  const last7 = data.daily.slice(-7)
  const on7 = last7.reduce((a, d) => a + d.on, 0)
  const off7 = last7.reduce((a, d) => a + d.off, 0)

  const Card = ({ label, value, sub, accent }) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 16, padding: '18px 20px', flex: '1 1 220px', minWidth: 200 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6B7280', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || '#0F172A', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>}
    </div>
  )

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }
  const PLAT_LABEL = { app: ko ? '앱' : 'App', web: ko ? '웹' : 'Web', unknown: ko ? '구데이터' : 'Legacy' }

  return (
    <div>
      {data.goal && <AugustGoalPanel g={data.goal} ko={ko} lang={lang} onRefresh={onRefresh} generatedAt={data.generatedAt} />}

      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
        {ko ? '이력서 공개 전환' : 'Resume-public conversion'}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        {ko
          ? `공개 = 공개 인재풀 노출(is_resume_public) · 기준 ${new Date(data.generatedAt).toLocaleString('ko-KR')}`
          : `Public = listed in the public talent pool · as of ${new Date(data.generatedAt).toLocaleString('en-US')}`}
      </div>

      <div className="adm-m-1col" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Card label={ko ? '공개 이력서' : 'Public resumes'} value={t.public.toLocaleString()}
          sub={ko ? `이력서 ${t.resumes.toLocaleString()}건 중 ${pct(t.rate)}` : `${pct(t.rate)} of ${t.resumes.toLocaleString()} resumes`}
          accent="#0D9488" />
        <Card label={ko ? '최근 7일 신규 공개' : 'New public (7d)'} value={`+${on7}`}
          sub={ko ? `해제 ${off7}건 · 순증 ${on7 - off7}` : `${off7} turned off · net ${on7 - off7}`}
          accent={on7 ? '#059669' : '#9CA3AF'} />
        <Card label={ko ? '웹 전환율' : 'Web rate'} value={pct(web.rate)}
          sub={ko ? `공개 ${web.pub}건 중 콜드메일 ${web.coldmail}건 · 그 외 ${web.organic}건` : `${web.coldmail} of ${web.pub} from cold-email`}
          accent={web.organicRate < 0.05 ? '#DC2626' : '#0F172A'} />
        <Card label={ko ? '비공개 풀 (전환 재고)' : 'Private pool'} value={pp.total.toLocaleString()}
          sub={ko
            ? `콜드메일 미발송 ${pp.unsent}명 · 발송했던 ${pp.coldmailed}명 · 30일 내 가입 ${pp.d30}명`
            : `${pp.unsent} never cold-emailed · ${pp.coldmailed} already · ${pp.d30} joined in 30d`}
          accent="#D97706" />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>{ko ? '플랫폼별 전환율' : 'By platform'}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>
        {ko
          ? '콜드메일 열 = 그 공개가 메일 원클릭으로 켜진 건수 — 나머지가 제품 안에서 켜진 것'
          : 'Cold-email column = conversions from the one-click email link'}
      </div>
      <div className="adm-m-scroll" style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12, marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead><tr>
            <th style={th}>{ko ? '플랫폼' : 'Platform'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '이력서' : 'Resumes'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '공개' : 'Public'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '전환율' : 'Rate'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '콜드메일' : 'Cold-email'}</th>
          </tr></thead>
          <tbody>
            {data.platforms.map((p) => (
              <tr key={p.key}>
                <td style={{ ...td, fontWeight: 700 }}>{PLAT_LABEL[p.key]}</td>
                <td style={num}>{p.reg.toLocaleString()}</td>
                <td style={{ ...num, color: '#0D9488' }}>{p.pub.toLocaleString()}</td>
                <td style={{ ...num, fontWeight: 800 }}>{p.reg ? pct(p.rate) : '—'}</td>
                <td style={{ ...num, color: p.coldmail ? '#2563EB' : '#C0C4CC' }}>{p.coldmail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>{ko ? '가입 주차별 코호트' : 'Weekly cohorts'}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>
        {ko
          ? '그 주에 가입해 이력서를 올린 사람 중 지금 공개 상태인 비율 — 최근 주차가 떨어지면 신규 유입이 안 켜지고 있다는 뜻'
          : 'Of those who joined that week and uploaded a resume, share now public'}
      </div>
      <div className="adm-m-scroll" style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12, marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr>
            <th style={th}>{ko ? '주차' : 'Week'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹 등록' : 'Web reg'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹 공개' : 'Web pub'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹 유기적' : 'Web organic'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹 유기적률' : 'Web org. rate'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '앱 등록' : 'App reg'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '앱 공개' : 'App pub'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '앱 전환율' : 'App rate'}</th>
          </tr></thead>
          <tbody>
            {[...data.weekly].reverse().map((w) => (
              <tr key={w.week}>
                <td style={td}>{w.week.slice(5)}</td>
                <td style={num}>{w.web.reg || ''}</td>
                <td style={{ ...num, color: w.web.pub ? '#0D9488' : undefined }}>{w.web.pub || ''}</td>
                <td style={num}>{w.web.organic || ''}</td>
                <td style={{ ...num, fontWeight: 800, color: w.web.reg && w.web.organic / w.web.reg < 0.05 ? '#DC2626' : undefined }}>
                  {w.web.reg ? pct(w.web.organic / w.web.reg) : ''}
                </td>
                <td style={num}>{w.app.reg || ''}</td>
                <td style={num}>{w.app.pub || ''}</td>
                <td style={{ ...num, fontWeight: 800 }}>{w.app.reg ? pct(w.app.pub / w.app.reg) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>{ko ? '일별 공개 전환' : 'Daily conversions'}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>
        {ko ? '실제 공개 ON/OFF 이벤트' : 'Actual ON/OFF events'}
      </div>
      <div className="adm-m-scroll" style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
          <thead><tr>
            <th style={th}>{ko ? '날짜' : 'Date'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '공개' : 'ON'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '해제' : 'OFF'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '순증' : 'Net'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹' : 'Web'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '앱' : 'App'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '콜드메일' : 'Cold-email'}</th>
          </tr></thead>
          <tbody>
            {[...data.daily].reverse().map((d) => (
              <tr key={d.day}>
                <td style={td}>{d.day.slice(5)}</td>
                <td style={{ ...num, fontWeight: 800, color: d.on ? '#0D9488' : undefined }}>{d.on || ''}</td>
                <td style={{ ...num, color: d.off ? '#DC2626' : undefined }}>{d.off || ''}</td>
                <td style={num}>{d.on || d.off ? d.net : ''}</td>
                <td style={num}>{d.web || ''}</td>
                <td style={num}>{d.app || ''}</td>
                <td style={{ ...num, color: d.coldmail ? '#2563EB' : undefined }}>{d.coldmail || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ 목표 현황 ============
// "등록 인재풀" = 이력서를 올린 회원, "등록 비율" = 가입자 중 그 비율(유저 확정 정의).
// 개발:비개발은 비개발 비중을 목표(40%)에 대고 재고, 기획·디자인은 비개발에 넣는다.
// 어학은 목표선 없이 현황만 — 수준을 나눌 기준이 없어 '이력서에 기재됨'으로만 센다.
function AugustGoalPanel({ g, ko, onRefresh, generatedAt, lang }) {
  const [trendOpen, setTrendOpen] = useState(true)
  const [trendMode, setTrendMode] = useState('cum')
  const pct = (v) => `${Math.round(v * 1000) / 10}%`
  const mr = g.mix.registered
  const lr = g.lang.registered
  const lp = g.lang.public
  const nontechShare = mr.classified ? mr.nontech / mr.classified : 0
  const nontechTarget = 1 - g.mix.targetTech

  const rows = [
    {
      key: 'pool',
      label: ko ? '등록 인재풀' : 'Registered talent pool',
      now: `${g.pool.current.toLocaleString()}${ko ? '명' : ''}`,
      target: `${g.pool.target.toLocaleString()}${ko ? '명' : ''}`,
      ratio: g.pool.current / g.pool.target,
      note: ko
        ? `최근 7일 +${g.pool.d7}명(하루 ${g.pool.actualPerDay}명) · 목표까지 ${Math.max(0, g.pool.target - g.pool.current).toLocaleString()}명`
        : `+${g.pool.d7} in 7d (${g.pool.actualPerDay}/day) · ${Math.max(0, g.pool.target - g.pool.current).toLocaleString()} to go`,
    },
    {
      key: 'rate',
      label: ko ? '등록 비율' : 'Registration rate',
      now: pct(g.rate.current),
      target: pct(g.rate.target),
      ratio: g.rate.current / g.rate.target,
      note: ko
        ? `가입 ${g.rate.signups.toLocaleString()}명 중 ${g.pool.current.toLocaleString()}명이 이력서 등록`
        : `${g.pool.current.toLocaleString()} of ${g.rate.signups.toLocaleString()} sign-ups uploaded a resume`,
    },
    {
      key: 'mix',
      label: ko ? '개발 : 비개발' : 'Tech : non-tech',
      now: `${Math.round(mr.techShare * 100)} : ${Math.round(nontechShare * 100)}`,
      target: `${Math.round(g.mix.targetTech * 100)} : ${Math.round(nontechTarget * 100)}`,
      ratio: nontechShare / nontechTarget,
      note: ko
        ? `직군이 분류된 ${mr.classified.toLocaleString()}명 기준(개발 ${mr.tech} · 비개발 ${mr.nontech}) — 미분류 ${mr.unknown.toLocaleString()}명은 빠져 있어 하한. 기획·디자인은 비개발에 포함.`
        : `Of ${mr.classified.toLocaleString()} classified (tech ${mr.tech}, non-tech ${mr.nontech}) — ${mr.unknown.toLocaleString()} unclassified excluded.`,
    },
    {
      key: 'lang',
      label: ko ? '한국어 · 영어 가능 인재' : 'Korean / English speakers',
      now: ko ? `영어 ${lr.en} · 한국어 ${lr.ko}` : `EN ${lr.en} · KO ${lr.ko}`,
      target: ko ? '추이만' : 'tracking only',
      ratio: null,
      note: ko
        ? `등록 ${lr.total.toLocaleString()}명 중 영어 ${pct(lr.total ? lr.en / lr.total : 0)} · 한국어 ${pct(lr.total ? lr.ko / lr.total : 0)} · 둘 다 ${lr.both}명. 이력서에 어학을 적은 경우만 잡혀 실제보다 낮게 나온다(수준 무관·초급 포함).`
        : `Of ${lr.total.toLocaleString()} registered · both ${lr.both}. Counted only when the resume states a language — a lower bound.`,
    },
  ]

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }
  const share = (n, d) => (d ? ` (${Math.round((n / d) * 100)}%)` : '')

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 16, padding: '16px 18px 6px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{ko ? '목표' : 'Goals'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 수치는 열 때 한 번만 불러온다 — 열어둔 채로는 안 오르므로 기준 시각과 갱신 버튼을 같이 둔다 */}
          {generatedAt && (
            <span style={{ fontSize: 11, color: '#B0B6BE', fontVariantNumeric: 'tabular-nums' }}>
              {new Date(generatedAt).toLocaleTimeString(ko ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })} {ko ? '기준' : ''}
            </span>
          )}
          {onRefresh && (
            <button onClick={onRefresh} style={{
              border: '1px solid #E5E8EB', background: '#fff', borderRadius: 8, padding: '4px 10px',
              fontSize: 11.5, fontWeight: 700, color: '#4E5968', cursor: 'pointer',
            }}>{ko ? '갱신' : 'Refresh'}</button>
          )}
        </div>
      </div>

      {rows.map((r, i) => (
        <div key={r.key} style={{ padding: '12px 0', borderTop: i ? '1px solid #F5F6F7' : '1px solid #EEF0F2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 7 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{r.label}</div>
            <div style={{ fontSize: 12.5, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <b style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{r.now}</b>
              {' / '}{r.target}
            </div>
          </div>
          {r.ratio != null && (
            <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, r.ratio * 100))}%`, height: '100%', background: r.ratio >= 1 ? '#059669' : '#0D9488' }} />
            </div>
          )}
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 6, lineHeight: 1.55 }}>{r.note}</div>
        </div>
      ))}

      {Array.isArray(g.trend) && g.trend.length > 1 && (
        <div style={{ borderTop: '1px solid #F5F6F7', paddingTop: 14, marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: trendOpen ? 8 : 0 }}>
            <button onClick={() => setTrendOpen((v) => !v)} style={{
              border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'baseline', gap: 6,
            }}>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{trendOpen ? '▼' : '▶'}</span>
              <span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                  {ko ? `추이 (${g.trend[0].date.slice(5).replace('-', '/')}~)` : `Trend (since ${g.trend[0].date.slice(5)})`}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>
                  {!trendOpen
                    ? (ko ? '눌러서 펼치기' : 'Click to expand')
                    : trendMode === 'cum'
                      ? (ko ? '누적 — 개발·비개발이 각각 얼마나 쌓였나' : 'Cumulative')
                      : trendMode === 'w7'
                        ? (ko ? '7일 이동합계 — 각각 지금 얼마나 빨리 늘고 있나' : '7-day rolling sum')
                        : (ko ? '가입자 중 이력서 등록 비율' : 'Share of sign-ups with a resume')}
                </span>
              </span>
            </button>
            {trendOpen && (
              <div style={{ display: 'inline-flex', gap: 2, background: '#F1F1F4', borderRadius: 9, padding: 3 }}>
                {[
                  ['cum', ko ? '누적' : 'Cumulative'],
                  ['w7', ko ? '신규 속도' : 'Velocity'],
                  ['rate', ko ? '등록 비율' : 'Rate'],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => setTrendMode(key)} style={{
                    padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 7,
                    background: trendMode === key ? '#1d1d1f' : 'transparent', color: trendMode === key ? '#fff' : '#6B7280',
                  }}>{label}</button>
                ))}
              </div>
            )}
          </div>
          {trendOpen && <>
          <MetricChart
            daily={g.trend}
            metrics={trendMode === 'rate'
              ? [
                { key: 'g-rate', dataKey: 'rate', label: ko ? '누적 등록 비율(%)' : 'Cumulative rate (%)', color: '#0F172A' },
                { key: 'g-rate7', dataKey: 'w7Rate', label: ko ? '최근 7일(%)' : 'Last 7 days (%)', color: '#D97706' },
              ]
              : [
                { key: 'g-pool', dataKey: trendMode === 'cum' ? 'pool' : 'w7Pool', label: ko ? '등록 인재풀' : 'Registered', color: '#94A3B8' },
                { key: 'g-tech', dataKey: trendMode === 'cum' ? 'tech' : 'w7Tech', label: ko ? '개발' : 'Tech', color: '#2563EB' },
                { key: 'g-nontech', dataKey: trendMode === 'cum' ? 'nontech' : 'w7Nontech', label: ko ? '비개발' : 'Non-tech', color: '#0D9488' },
              ]}
            lang={lang}
            dualAxis={false}
            lineType="linear"
            dots={false}
          />
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 6, lineHeight: 1.55 }}>
            {ko
              ? '⚠️ 이력서를 언제 올렸는지 컬럼이 없어 가입일에 얹은 재구성이다(직군도 현재값). 끝값은 위 카드 숫자와 같고, 과거 구간은 근사치라 추세로만 본다.'
              : '⚠️ Reconstructed from signup date (no resume-upload timestamp; role is the current value). The endpoint matches the cards above; earlier points are approximate.'}
          </div>
          </>}
        </div>
      )}

      <div className="adm-m-scroll" style={{ overflowX: 'auto', margin: '4px -4px 14px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 340 }}>
          <thead><tr>
            <th style={th}>{ko ? '인재풀 구성' : 'Pool composition'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '등록' : 'Registered'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '공개' : 'Public'}</th>
          </tr></thead>
          <tbody>
            {[
              { label: ko ? '개발' : 'Tech', r: g.mix.registered.tech, p: g.mix.public.tech },
              { label: ko ? '비개발(기획·디자인 포함)' : 'Non-tech (incl. design/PM)', r: g.mix.registered.nontech, p: g.mix.public.nontech },
              { label: ko ? '직군 미분류' : 'Unclassified', r: g.mix.registered.unknown, p: g.mix.public.unknown, muted: true },
              { label: ko ? '영어 기재' : 'States English', r: lr.en, p: lp.en, gap: true },
              { label: ko ? '한국어 기재' : 'States Korean', r: lr.ko, p: lp.ko },
            ].map((row) => (
              <tr key={row.label}>
                <td style={{ ...td, color: row.muted ? '#9CA3AF' : '#1F2937', borderTop: row.gap ? '1px solid #EEF0F2' : undefined }}>{row.label}</td>
                <td style={{ ...num, color: row.muted ? '#9CA3AF' : '#1F2937', borderTop: row.gap ? '1px solid #EEF0F2' : undefined }}>
                  {row.r.toLocaleString()}<span style={{ color: '#C0C4CC', fontWeight: 500 }}>{share(row.r, lr.total)}</span>
                </td>
                <td style={{ ...num, color: row.muted ? '#9CA3AF' : '#1F2937', borderTop: row.gap ? '1px solid #EEF0F2' : undefined }}>
                  {row.p.toLocaleString()}<span style={{ color: '#C0C4CC', fontWeight: 500 }}>{share(row.p, lp.total)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ 콜드메일 공개 전환 탭 ============
// 비공개 이력서 보유자에게 "공개하면 축하금 이벤트 참여 가능" 콜드메일 → 원클릭 링크로 공개 전환.
// 퍼널: 발송 → 클릭 → 전환. 발송/전환 모두 events(coldmail_public_*)로 집계.

// 캠페인은 성격별로 나눠 본다 — 한 표에 섞으면 '전환'이 그룹마다 다른 걸 뜻해서(가입/공개/지원)
// 숫자를 세로로 비교할 수 없다. 그룹 판정은 API(groupOf)가 하고 여기선 라벨만 붙인다.
const CAMPAIGN_GROUPS = [
  {
    key: 'signup', ko: '① 회원 가입 유도', en: '(1) Signup',
    koDesc: 'FYI 계정이 없는 KTC 지원자 대상 · 전환 = FYI 가입',
    enDesc: 'KTC applicants without an FYI account · convert = signup',
    convKo: '가입', convEn: 'Signups',
  },
  {
    key: 'register', ko: '② 이력서 등록 유도', en: '(2) Resume upload',
    koDesc: '가입했지만 이력서가 없는 회원 대상 · 전환 = 이력서 등록(파일 업로드)',
    enDesc: 'Members with an account but no resume · convert = uploaded a file',
    convKo: '등록', convEn: 'Uploaded',
  },
  {
    key: 'resume', ko: '③ 이력서 공개 전환', en: '(3) Resume public',
    koDesc: '이미 가입한 회원 중 이력서 비공개자 대상 · 전환 = 이력서 공개',
    enDesc: 'Existing members with a private resume · convert = made public',
    convKo: '공개 전환', convEn: 'Converted',
  },
  {
    key: 'recommend', ko: '④ 공고 추천 → 지원', en: '(4) Job recommend',
    koDesc: '이력서 공개 회원에게 맞는 공고 추천 · 전환 = 해당 공고 지원',
    enDesc: 'Matched job recommendations to public-resume members · convert = applied',
    convKo: '지원자', convEn: 'Applicants',
    // 이 그룹의 전환은 coldmail_public_convert 가 아니라 지원(coldmail_job_apply)이다.
    // 같은 컬럼에 convert 를 넣으면 전부 0으로 보인다.
    convertFrom: 'apply',
  },
  {
    key: 'photo', ko: '⑤ 프로필 사진 등록', en: '(5) Profile photo',
    koDesc: '이력서 보유·사진 없는 회원 대상 · 클릭 = 랜딩 조회 · 전환 = 사진 업로드(원클릭 랜딩)',
    enDesc: 'Members with a resume but no photo · click = landing view · convert = photo uploaded',
    convKo: '사진 등록', convEn: 'Uploaded',
  },
]

// 그룹이 정한 소스에서 전환 인원을 꺼낸다(공개전환 = converted / 추천 = 지원자 수).
const convertedOf = (c, g) => (g.convertFrom === 'apply' ? c.appliers : c.converted)

function ColdmailPublicTab({ data, loading, error, ko, lang }) {
  const [mailPreview, setMailPreview] = useState(null) // { campaign, tpl } — 캠페인명 클릭 시 발송 메일 양식 모달
  // 토글 언어로 subject/html 해석 — vi=발송 원문, ko/en=열람용 번역본.
  const mailTpl = mailPreview ? localizeTemplate(mailPreview.tpl, lang) : null
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const pct = (v) => `${Math.round(v * 100)}%`
  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

  return (
    <div>
      {(data.campaigns || []).length > 0 && CAMPAIGN_GROUPS.map((g) => {
        const rows = data.campaigns.filter((c) => (c.group || 'resume') === g.key)
        // 발송 전 초안 캠페인도 행으로 띄운다(양식 검수용) — 발송이 시작되면 실측 행이 대체.
        const drafts = DRAFT_CAMPAIGNS
          .filter((d) => d.group === g.key && !data.campaigns.some((c) => c.campaign === d.campaign))
          .map((d) => ({ campaign: d.campaign, group: d.group, sent: 0, clicked: 0, converted: 0, clickRate: 0, convertRate: 0, applies: 0, appliers: 0, firstSentDay: null, lastSentDay: null, draft: true }))
        if (!rows.length && !drafts.length) return null
        // 소계는 캠페인별 비율의 평균이 아니라 합계끼리 나눈다 — 발송량이 다른 캠페인을 섞어야 해서.
        const sum = rows.reduce((a, c) => ({
          sent: a.sent + c.sent, clicked: a.clicked + c.clicked,
          converted: a.converted + convertedOf(c, g), applies: a.applies + c.applies,
          appliers: a.appliers + c.appliers,
        }), { sent: 0, clicked: 0, converted: 0, applies: 0, appliers: 0 })
        return (
          <div key={g.key} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>
              {ko ? g.ko : g.en}
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', margin: '0 0 8px' }}>
              {ko ? g.koDesc : g.enDesc}
            </div>
            <div className="adm-m-scroll" style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead><tr>
                  <th style={th}>{ko ? '캠페인' : 'Campaign'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{ko ? '발송' : 'Sent'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{ko ? '클릭' : 'Clicks'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>CTR</th>
                  <th style={{ ...th, textAlign: 'right' }}>{ko ? g.convKo : g.convEn}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{ko ? '전환율' : 'Rate'}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{ko ? '지원 건수' : 'Applies'}</th>
                </tr></thead>
                <tbody>
                  {[...rows, ...drafts].map((c) => {
                    const conv = convertedOf(c, g)
                    const tpl = templateFor(c.campaign)
                    return (
                    <tr key={c.campaign}>
                      <td style={{ ...td, fontWeight: 700 }}>
                        {tpl ? (
                          <span onClick={() => setMailPreview({ campaign: c.campaign, tpl })} title={ko ? '발송 메일 양식 보기' : 'View email template'}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed #C4C9CF' }}>{c.campaign}</span>
                        ) : c.campaign}
                        {c.firstSentDay && <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 11.5 }}> · {c.firstSentDay.slice(5)}{c.lastSentDay && c.lastSentDay !== c.firstSentDay ? `~${c.lastSentDay.slice(5)}` : ''}</span>}
                        {c.draft && <span style={{ fontWeight: 600, color: '#D97706', fontSize: 11 }}> · {ko ? '미발송' : 'draft'}</span>}
                      </td>
                      <td style={num}>{c.sent}</td>
                      <td style={{ ...num, color: '#2563EB' }}>{c.clicked}</td>
                      <td style={num}>{c.sent ? pct(c.clickRate) : '—'}</td>
                      <td style={{ ...num, color: '#0D9488' }}>{conv}</td>
                      <td style={num}>{c.sent ? pct(conv / c.sent) : '—'}</td>
                      <td style={{ ...num, color: c.applies ? '#D97706' : undefined, fontWeight: 800 }}>
                        {c.applies ? `${c.applies}${ko ? '건' : ''}` : '—'}
                      </td>
                    </tr>
                    )
                  })}
                  {rows.length > 1 && (
                    <tr style={{ background: '#FAFBFC' }}>
                      <td style={{ ...td, fontWeight: 800, color: '#6B7280' }}>{ko ? '소계' : 'Subtotal'}</td>
                      <td style={{ ...num, fontWeight: 800 }}>{sum.sent}</td>
                      <td style={{ ...num, fontWeight: 800, color: '#2563EB' }}>{sum.clicked}</td>
                      <td style={{ ...num, fontWeight: 800 }}>{sum.sent ? pct(sum.clicked / sum.sent) : '—'}</td>
                      <td style={{ ...num, fontWeight: 800, color: '#0D9488' }}>{sum.converted}</td>
                      <td style={{ ...num, fontWeight: 800 }}>{sum.sent ? pct(sum.converted / sum.sent) : '—'}</td>
                      <td style={{ ...num, fontWeight: 800, color: sum.applies ? '#D97706' : undefined }}>
                        {sum.applies ? `${sum.applies}${ko ? '건' : ''}` : '—'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {mailPreview && (
        <div onClick={() => setMailPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEF0F2', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{mailPreview.campaign}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>✉️ {mailTpl.subject}</div>
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55 }}>{mailTpl.desc}</div>
                <div style={{ fontSize: 11, color: '#B0B0B8', marginTop: 6 }}>{mailTpl.source}</div>
                {lang !== 'vi' && mailTpl.html && (
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 6 }}>
                    {ko ? '열람용 번역본입니다 — 실제 발송 원문은 베트남어(VI 토글로 확인)' : 'Translated for viewing — the actual mail was sent in Vietnamese (see VI toggle)'}
                  </div>
                )}
              </div>
              <button onClick={() => setMailPreview(null)}
                style={{ border: 'none', background: '#F2F4F6', borderRadius: 8, width: 28, height: 28, fontSize: 14, cursor: 'pointer', color: '#4E5968', flexShrink: 0 }}>✕</button>
            </div>
            {mailTpl.html ? (
              <iframe title="mail-preview" sandbox="" srcDoc={mailTpl.html}
                style={{ border: 'none', width: '100%', flex: 1, minHeight: 420, background: '#f2f4f6' }} />
            ) : (
              <div style={{ padding: '28px 20px', fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
                {ko ? '본문 원문이 보존돼 있지 않은 캠페인입니다 (git 히스토리 참조).' : 'Original body not preserved (see git history).'}
              </div>
            )}
          </div>
        </div>
      )}

      {data.daily.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>{ko ? '일별 (클릭·전환 — 인원 기준, 첫 발생일)' : 'Daily (unique people, first occurrence)'}</div>
          <div style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
              <thead><tr>
                <th style={th}>{ko ? '날짜' : 'Date'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{ko ? '클릭' : 'Clicks'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{ko ? '공개 전환' : 'Converts'}</th>
              </tr></thead>
              <tbody>
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.day}>
                    <td style={td}>{d.day.slice(5)}</td>
                    <td style={num}>{d.clicks || ''}</td>
                    <td style={{ ...num, color: d.converts ? '#0D9488' : undefined, fontWeight: 800 }}>{d.converts || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ============ 프로필 사진 탭 ============
// 인재풀 사진 보유 현황 — 기업 쇼케이스 카드 품질 지표이자 사진 등록 유도 콜드메일의 베이스라인.
// 사진은 전부 검증된 것(직접 업로드 / CV 추출·소셜 아바타는 vision 인물사진 검증 통과분).
function PhotoStatsTab({ data, loading, error, ko }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#DC2626' }}>{error}</div>
  if (!data) return null
  const { total, withPhoto, sources, segments } = data
  const noPhoto = total - withPhoto
  const pct = total ? Math.round((withPhoto / total) * 100) : 0

  const SOURCES = [
    ['upload', ko ? '직접 업로드' : 'User upload'],
    ['cv', ko ? 'CV 추출 (검증)' : 'CV extracted (verified)'],
    ['webParse', ko ? '웹 /cv 파싱' : 'Web /cv parse'],
    ['social', ko ? '소셜 아바타 (검증)' : 'Social avatar (verified)'],
  ]
  const SEGS = [
    ['dev', ko ? '개발' : 'Tech'],
    ['nondev', ko ? '비개발' : 'Non-tech'],
    ['unclassified', ko ? '직군 미분류' : 'Unclassified'],
    ['public', ko ? '공개 이력서' : 'Public resume'],
    ['private', ko ? '비공개' : 'Private'],
  ]
  const maxSrc = Math.max(...SOURCES.map(([k]) => sources[k] || 0), 1)

  const th = { padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', fontSize: 12.5 }
  const td = { padding: '7px 12px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', fontSize: 13 }
  const section = { background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '16px 18px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 목표 프로그레스: 전체 인재 사진 보유를 목표로 채워가는 바 */}
      <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {ko ? '사진 보유' : 'Photo coverage'}
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginLeft: 8 }}>{ko ? '목표: 전체 인재풀' : 'Goal: entire pool'}</span>
          </div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            <strong style={{ fontSize: 22, fontWeight: 800, color: '#15803D' }}>{pct}%</strong>
            <span style={{ marginLeft: 10 }}><strong style={{ color: '#0F172A' }}>{withPhoto}</strong> / {total}{ko ? '명' : ''}</span>
          </div>
        </div>
        <div style={{ position: 'relative', height: 22, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(1, pct)}%`, height: '100%', background: '#15803D', borderRadius: 999, transition: 'width 0.6s ease' }} />
          {pct >= 12 && (
            <span style={{ position: 'absolute', top: 0, left: 10, lineHeight: '22px', fontSize: 11.5, fontWeight: 800, color: '#fff' }}>{withPhoto}</span>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#9CA3AF' }}>
          {ko ? `목표까지 ${noPhoto}명 남음` : `${noPhoto} to go`}
        </div>
      </div>

      <div style={section}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{ko ? '사진 출처 구성' : 'Photo sources'}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>{ko ? '출처' : 'Source'}</th>
              <th style={th}>{ko ? '인원' : 'Count'}</th>
              <th style={{ ...th, width: '45%' }} />
            </tr>
          </thead>
          <tbody>
            {SOURCES.map(([k, label]) => (
              <tr key={k}>
                <td style={{ ...td, textAlign: 'left', color: '#374151' }}>{label}</td>
                <td style={{ ...td, fontWeight: 700 }}>{sources[k] || 0}</td>
                <td style={td}>
                  <div style={{ width: `${Math.max(2, ((sources[k] || 0) / maxSrc) * 100)}%`, height: 14, background: '#0F172A', opacity: 0.75, borderRadius: 3, marginLeft: 'auto' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={section}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{ko ? '세그먼트별 보유율' : 'Coverage by segment'}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>{ko ? '세그먼트' : 'Segment'}</th>
              <th style={th}>{ko ? '사진 있음' : 'With photo'}</th>
              <th style={th}>{ko ? '전체' : 'Total'}</th>
              <th style={th}>{ko ? '보유율' : 'Rate'}</th>
              <th style={{ ...th, width: '38%' }} />
            </tr>
          </thead>
          <tbody>
            {SEGS.map(([k, label]) => {
              const s = segments[k] || { total: 0, withPhoto: 0 }
              const rate = s.total ? Math.round((s.withPhoto / s.total) * 100) : 0
              return (
                <tr key={k}>
                  <td style={{ ...td, textAlign: 'left', color: '#374151' }}>{label}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.withPhoto}</td>
                  <td style={{ ...td, color: '#8B95A1' }}>{s.total}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{rate}%</td>
                  <td style={td}>
                    <div style={{ width: `${Math.max(2, rate)}%`, height: 14, background: '#0D9488', opacity: 0.75, borderRadius: 3, marginLeft: 'auto' }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 홍익 QR — /hongik 현장 캠페인 트래킹 (유입 → 가입·인증 → TOPIK/직무 → CV + 명단)
const HK_ROLE_LABEL = {}
ROLE_GROUPS.forEach(g => g.roles.forEach(r => { HK_ROLE_LABEL[r.value] = r.label.ko }))

function HongikTab({ data, loading, error, ko, onRefresh }) {
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 12.5, color: '#1F2937', padding: '6px 10px', borderBottom: '1px solid #F5F6F7', whiteSpace: 'nowrap' }
  const card = { border: '1px solid #EEF0F2', borderRadius: 12, padding: '14px 16px', background: '#fff' }
  const num = { fontSize: 24, fontWeight: 800, color: '#1d1d1f', lineHeight: 1.2 }
  const cap = { fontSize: 11.5, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }
  const sub = { fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }
  const secH = { fontSize: 13.5, fontWeight: 800, color: '#1d1d1f', margin: '22px 0 8px' }

  const ictTime = (iso) => new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ')
  const roleLabel = (v) => HK_ROLE_LABEL[v] || v
  const topikDist = data.topik?.dist || {}
  const roleRows = Object.entries(data.roles?.freq || {}).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {ko ? '/hongik 현장 QR — 팀 계정은 카운트 제외, 명단엔 회색 표시. 비로그인 유입 수는 참고치.' : '/hongik QR campaign.'}
        </div>
        <button onClick={onRefresh} style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#374151' }}>
          {ko ? '새로고침' : 'Refresh'}
        </button>
      </div>

      <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        <div style={card}><div style={cap}>{ko ? 'QR 유입' : 'Views'}</div><div style={num}>{data.views.uniq}</div><div style={sub}>{ko ? `총 ${data.views.total}뷰` : `${data.views.total} views`}</div></div>
        <div style={card}><div style={cap}>{ko ? '로그인 시작' : 'Login starts'}</div><div style={num}>{data.starts}</div></div>
        <div style={{ ...card, borderColor: 'rgba(255,96,0,0.45)' }}><div style={{ ...cap, color: '#e05400' }}>{ko ? '가입·인증' : 'Verified'}</div><div style={{ ...num, color: '#e05400' }}>{data.verified}</div><div style={sub}>{ko ? '한국어 인증 완료' : 'Korean verified'}</div></div>
        <div style={card}><div style={cap}>TOPIK</div><div style={num}>{data.topik.answered - data.topik.none}</div><div style={sub}>{ko ? `없음 ${data.topik.none}` : `none ${data.topik.none}`}</div></div>
        <div style={card}><div style={cap}>{ko ? '직무 선택' : 'Roles'}</div><div style={num}>{data.roles.chosen}</div><div style={sub}>{ko ? `건너뜀 ${data.roles.skipped}` : `skipped ${data.roles.skipped}`}</div></div>
        <div style={card}><div style={cap}>CV</div><div style={num}>{data.cv}</div><div style={sub}>{ko ? '이력서 등록' : 'resumes'}</div></div>
      </div>

      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div>
          <div style={secH}>{ko ? 'TOPIK 분포' : 'TOPIK levels'}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>{ko ? '급수' : 'Level'}</th><th style={{ ...th, textAlign: 'right' }}>{ko ? '명' : '#'}</th></tr></thead>
            <tbody>
              {[6, 5, 4, 3, 2, 1].map(n => (
                <tr key={n}><td style={td}>{n}{ko ? '급' : ''}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{topikDist[n] || 0}</td></tr>
              ))}
              <tr><td style={{ ...td, color: '#9CA3AF' }}>{ko ? '아직 없음' : 'None yet'}</td><td style={{ ...td, textAlign: 'right', color: '#9CA3AF' }}>{data.topik.none}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <div style={secH}>{ko ? '희망 직무' : 'Desired roles'}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>{ko ? '직무' : 'Role'}</th><th style={{ ...th, textAlign: 'right' }}>{ko ? '명' : '#'}</th></tr></thead>
            <tbody>
              {roleRows.length === 0 && <tr><td style={{ ...td, color: '#9CA3AF' }} colSpan={2}>{ko ? '아직 없음' : 'No data'}</td></tr>}
              {roleRows.slice(0, 10).map(([r, c]) => (
                <tr key={r}><td style={td}>{roleLabel(r)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div style={secH}>{ko ? '일별' : 'Daily'}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>{ko ? '날짜' : 'Day'}</th><th style={{ ...th, textAlign: 'right' }}>{ko ? '유입' : 'Views'}</th><th style={{ ...th, textAlign: 'right' }}>{ko ? '가입' : 'Verified'}</th></tr></thead>
            <tbody>
              {data.daily.length === 0 && <tr><td style={{ ...td, color: '#9CA3AF' }} colSpan={3}>{ko ? '아직 없음' : 'No data'}</td></tr>}
              {data.daily.map(d => (
                <tr key={d.day}><td style={td}>{d.day.slice(5)}</td><td style={{ ...td, textAlign: 'right' }}>{d.views}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{d.verified}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={secH}>{ko ? `명단 (${data.people.length})` : `People (${data.people.length})`}</div>
      <div className="adm-m-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{ko ? '인증 시각(ICT)' : 'Verified at'}</th>
              <th style={th}>{ko ? '이름' : 'Name'}</th>
              <th style={th}>{ko ? '이메일' : 'Email'}</th>
              <th style={th}>TOPIK</th>
              <th style={th}>{ko ? '희망 직무' : 'Roles'}</th>
              <th style={th}>CV</th>
            </tr>
          </thead>
          <tbody>
            {data.people.length === 0 && <tr><td style={{ ...td, color: '#9CA3AF' }} colSpan={6}>{ko ? '아직 아무도 없어요 — QR이 찍히면 여기 실시간으로 쌓입니다.' : 'Nobody yet.'}</td></tr>}
            {data.people.map(p => (
              <tr key={p.userId} style={p.excluded ? { opacity: 0.45 } : undefined}>
                <td style={td}>{ictTime(p.verifiedAt)}</td>
                <td style={td}>
                  {p.name || '—'}
                  {p.excluded && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6B7280', background: '#F3F4F6', borderRadius: 100, padding: '1px 7px', marginLeft: 6 }}>{ko ? '팀' : 'team'}</span>}
                </td>
                <td style={td}>{p.email || '—'}</td>
                <td style={td}>{p.topik === 'none' ? (ko ? '없음' : 'none') : p.topik != null ? `${p.topik}${ko ? '급' : ''}` : (p.koreanCert || '—')}</td>
                <td style={{ ...td, whiteSpace: 'normal', maxWidth: 260 }}>
                  {p.roles === 'skip' ? (ko ? '건너뜀' : 'skipped') : Array.isArray(p.roles) ? p.roles.map(roleLabel).join(', ') : '—'}
                </td>
                <td style={{ ...td, fontWeight: 700, color: p.hasCv ? '#15803d' : '#9CA3AF' }}>{p.hasCv ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
