import { useState, useEffect, useCallback, Fragment } from 'react'

// 개인용 "목표지표 - Sean" — 어드민 인증 위에 개인 비밀번호를 한 겹 더(서버 검증).
// 상단 탭: [목표 KPI] 이번 달 2 KPI  ·  [광고 성과] 유입/광고 실시간 추적.

const PASS_KEY = 'goalPass'

export default function GoalMetricsView({ token, lang }) {
  const ko = lang !== 'en'
  const [pass, setPass] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [view, setView] = useState('kpi')

  const [data, setData] = useState(null) // 목표 KPI
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [adData, setAdData] = useState(null) // 광고 성과
  const [adError, setAdError] = useState('')
  const [adLoading, setAdLoading] = useState(false)

  const [expData, setExpData] = useState(null) // 실험 (가입 게이트)
  const [expError, setExpError] = useState('')
  const [expLoading, setExpLoading] = useState(false)

  const [rpData, setRpData] = useState(null) // 실험 (이력서 공개 전환)
  const [rpError, setRpError] = useState('')
  const [rpLoading, setRpLoading] = useState(false)

  const [cmData, setCmData] = useState(null) // 콜드메일 공개 전환
  const [cmError, setCmError] = useState('')
  const [cmLoading, setCmLoading] = useState(false)

  const load = useCallback(async (p) => {
    if (!token || !p) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/goal-metrics', { headers: { Authorization: `Bearer ${token}`, 'x-goal-pass': p } })
      if (res.status === 403) {
        try { sessionStorage.removeItem(PASS_KEY) } catch {}
        setUnlocked(false)
        setPass('')
        setError(ko ? '비밀번호가 틀렸습니다.' : 'Wrong password.')
        return
      }
      if (!res.ok) throw new Error(`(${res.status})`)
      setData(await res.json())
      setUnlocked(true)
    } catch (e) {
      setError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setLoading(false)
    }
  }, [token, ko])

  const loadAd = useCallback(async (p) => {
    if (!token || !p) return
    setAdLoading(true)
    setAdError('')
    try {
      const res = await fetch('/api/admin/ad-metrics', { headers: { Authorization: `Bearer ${token}`, 'x-goal-pass': p } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setAdData(await res.json())
    } catch (e) {
      setAdError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setAdLoading(false)
    }
  }, [token, ko])

  const loadExp = useCallback(async (p) => {
    if (!token || !p) return
    setExpLoading(true)
    setExpError('')
    try {
      const res = await fetch('/api/admin/experiment-metrics', { headers: { Authorization: `Bearer ${token}`, 'x-goal-pass': p } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setExpData(await res.json())
    } catch (e) {
      setExpError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setExpLoading(false)
    }
  }, [token, ko])

  const loadRp = useCallback(async (p) => {
    if (!token || !p) return
    setRpLoading(true)
    setRpError('')
    try {
      const res = await fetch('/api/admin/experiment-resume-public-metrics', { headers: { Authorization: `Bearer ${token}`, 'x-goal-pass': p } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setRpData(await res.json())
    } catch (e) {
      setRpError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setRpLoading(false)
    }
  }, [token, ko])

  const loadCm = useCallback(async (p) => {
    if (!token || !p) return
    setCmLoading(true)
    setCmError('')
    try {
      const res = await fetch('/api/admin/campaign-resume-public-metrics', { headers: { Authorization: `Bearer ${token}`, 'x-goal-pass': p } })
      if (!res.ok) throw new Error(`(${res.status})`)
      setCmData(await res.json())
    } catch (e) {
      setCmError((ko ? '불러오기 실패 ' : 'Load failed ') + e.message)
    } finally {
      setCmLoading(false)
    }
  }, [token, ko])

  useEffect(() => {
    let saved = ''
    try { saved = sessionStorage.getItem(PASS_KEY) || '' } catch {}
    if (saved) { setPass(saved); load(saved) }
  }, [load])

  // 광고 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'ad' && unlocked && pass && !adData && !adLoading) loadAd(pass)
  }, [view, unlocked, pass, adData, adLoading, loadAd])

  // 실험 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'exp' && unlocked && pass && !expData && !expLoading) loadExp(pass)
  }, [view, unlocked, pass, expData, expLoading, loadExp])

  // 이력서 공개 전환 실험 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'resumePublic' && unlocked && pass && !rpData && !rpLoading) loadRp(pass)
  }, [view, unlocked, pass, rpData, rpLoading, loadRp])

  // 콜드메일 공개 전환 탭 최초 진입 시 lazy 로드
  useEffect(() => {
    if (view === 'coldmail' && unlocked && pass && !cmData && !cmLoading) loadCm(pass)
  }, [view, unlocked, pass, cmData, cmLoading, loadCm])

  function submit(e) {
    e.preventDefault()
    const p = input.trim()
    if (!p) return
    try { sessionStorage.setItem(PASS_KEY, p) } catch {}
    setPass(p)
    setInput('')
    load(p)
  }

  // ---- 잠금 화면 ----
  if (!unlocked) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 16px' }}>
        <form onSubmit={submit} style={{ maxWidth: 320, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1d1d1f', marginBottom: 4 }}>{ko ? '목표지표 — Sean' : 'Goal metrics — Sean'}</div>
          <div style={{ fontSize: 12.5, color: '#86868b', marginBottom: 18 }}>{ko ? '개인 비밀번호를 입력하세요.' : 'Enter your personal password.'}</div>
          <input type="password" value={input} onChange={(e) => setInput(e.target.value)} autoFocus placeholder={ko ? '비밀번호' : 'Password'}
            style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '1px solid #d2d2d7', borderRadius: 10, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: '#ff4400', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '…' : ko ? '열기' : 'Unlock'}
          </button>
          {error && <div style={{ fontSize: 12.5, color: '#c00', marginTop: 12 }}>{error}</div>}
        </form>
      </div>
    )
  }

  const tabBtn = (key, label) => (
    <button onClick={() => setView(key)} style={{
      padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 9,
      background: view === key ? '#1d1d1f' : 'transparent', color: view === key ? '#fff' : '#6B7280',
    }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 16px 48px' }}>
      <div style={{ display: 'inline-flex', gap: 2, background: '#F1F1F4', borderRadius: 11, padding: 3, marginBottom: 18 }}>
        {tabBtn('kpi', ko ? '목표 KPI' : 'Goal KPI')}
        {tabBtn('ad', ko ? '광고 성과' : 'Ad performance')}
        {tabBtn('exp', ko ? '실험' : 'Experiments')}
        {tabBtn('resumePublic', ko ? '이력서 공개 실험' : 'Resume-public exp')}
        {tabBtn('coldmail', ko ? '콜드메일 공개' : 'Cold-email public')}
      </div>
      {view === 'kpi' && <KpiTab data={data} ko={ko} />}
      {view === 'ad' && <AdTab data={adData} loading={adLoading} error={adError} ko={ko} />}
      {view === 'exp' && <ExperimentTab data={expData} loading={expLoading} error={expError} ko={ko} token={token} pass={pass} />}
      {view === 'resumePublic' && <ResumePublicTab data={rpData} loading={rpLoading} error={rpError} ko={ko} />}
      {view === 'coldmail' && <ColdmailPublicTab data={cmData} loading={cmLoading} error={cmError} ko={ko} />}
    </div>
  )
}

// ============ 목표 KPI 탭 ============
function KpiTab({ data, ko }) {
  const [open, setOpen] = useState({}) // 지원자 명단 펼침 상태 (공고 id별)
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const s = data.signups
  const e = data.enterpriseApps
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString()
  const pctColor = (p) => (p >= 100 ? '#059669' : p >= 60 ? '#D97706' : '#DC2626')

  const Gauge = ({ label, value, target, unit, pct, sub }) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 16, padding: '20px 22px', flex: '1 1 340px', minWidth: 300 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 38, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 15, color: '#9CA3AF', fontWeight: 600 }}>/ {target}{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>{sub}</div>}
      <div style={{ height: 8, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden', margin: '4px 0 6px' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pctColor(pct), transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: pctColor(pct) }}>{n1(pct)}% {ko ? '달성' : 'of goal'}</div>
    </div>
  )

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        {ko ? '기준: ' : 'As of '}{new Date(data.generatedAt).toLocaleString(ko ? 'ko-KR' : 'en-US')} · {s.month}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <Gauge label={ko ? 'KPI 1 · 일 평균 신규 가입자' : 'KPI 1 · Avg daily sign-ups'} value={n1(s.avgPerDay.all)} target={s.target} unit={ko ? '명' : ''} pct={s.achievementPct}
          sub={`${ko ? '누적' : 'MTD'} ${s.totals.all}${ko ? '명' : ''} · web ${s.totals.web} / app ${s.totals.app} · ${s.daysElapsed}${ko ? '일 경과' : 'd'}`} />
        <Gauge label={ko ? 'KPI 2 · 기업공고 당 지원 (실시간)' : 'KPI 2 · Apps per enterprise post (live)'} value={n1(e.avgApps)} target={e.target} unit={ko ? '건' : ''} pct={e.achievementPct}
          sub={`${ko ? '누적 지원' : 'Total apps'} ${e.totalApps}${ko ? '건' : ''} · ${ko ? '고객공고' : 'posts'} ${e.totalPosts}${ko ? '건' : ''}`} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>{ko ? '일별 신규 가입' : 'Daily sign-ups'}</div>
      <div style={{ overflowX: 'auto', marginBottom: 32, border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead><tr>
            <th style={th}>{ko ? '날짜' : 'Date'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '전체' : 'Total'}</th>
            <th style={{ ...th, textAlign: 'right' }}>web</th>
            <th style={{ ...th, textAlign: 'right' }}>app</th>
            <th style={{ ...th, textAlign: 'right', width: '30%' }}>{ko ? '목표대비' : 'vs target'}</th>
          </tr></thead>
          <tbody>
            {[...s.daily].reverse().map((d) => (
              <tr key={d.date}>
                <td style={td}>{d.date.slice(5)}</td>
                <td style={{ ...num, fontWeight: 800, color: d.total >= s.target ? '#059669' : '#0F172A' }}>{d.total}</td>
                <td style={num}>{d.web}</td>
                <td style={num}>{d.app}</td>
                <td style={{ ...td, width: '30%' }}>
                  <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (d.total / s.target) * 100)}%`, height: '100%', background: d.total >= s.target ? '#059669' : '#94A3B8' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
        {ko ? `기업 공고 실시간 지원 현황 (${e.totalPosts}건)` : `Enterprise posts · live (${e.totalPosts})`}
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 20, border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead><tr>
            <th style={{ ...th, width: 22 }}></th>
            <th style={th}>{ko ? '회사' : 'Company'}</th>
            <th style={th}>{ko ? '공고' : 'Title'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '지원' : 'Apps'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '경과일' : 'Age'}</th>
            <th style={th}></th>
          </tr></thead>
          <tbody>
            {e.posts.length === 0 && <tr><td style={td} colSpan={6}>{ko ? '고객 공고가 아직 없습니다.' : 'No customer posts yet.'}</td></tr>}
            {e.posts.map((r) => {
              const canOpen = r.appsTotal > 0
              const isOpen = !!open[r.id]
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={canOpen ? () => setOpen((o) => ({ ...o, [r.id]: !o[r.id] })) : undefined}
                    style={{ background: r.appsTotal > 0 ? '#ECFDF5' : undefined, cursor: canOpen ? 'pointer' : 'default' }}
                  >
                    <td style={{ ...td, textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>{canOpen ? (isOpen ? '▾' : '▸') : ''}</td>
                    <td style={{ ...td, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.company || '—'}</td>
                    <td style={{ ...td, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#6B7280' }}>{r.title || '—'}</td>
                    <td style={{ ...num, fontWeight: 800, color: r.appsTotal > 0 ? '#059669' : '#9CA3AF' }}>{r.appsTotal}</td>
                    <td style={num}>{r.ageDays < 1 ? (ko ? '오늘' : 'today') : `${Math.floor(r.ageDays)}${ko ? '일' : 'd'}`}</td>
                    <td style={td}>{!r.isActive && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{ko ? '비활성' : 'inactive'}</span>}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0, background: '#F9FBFA', borderBottom: '1px solid #F5F6F7' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr>
                            <th style={{ ...th, width: 22, borderBottom: 'none' }}></th>
                            <th style={{ ...th, borderBottom: 'none' }}>{ko ? '이름' : 'Name'}</th>
                            <th style={{ ...th, borderBottom: 'none' }}>{ko ? '이메일' : 'Email'}</th>
                            <th style={{ ...th, textAlign: 'right', borderBottom: 'none' }}>{ko ? '지원 시각' : 'Applied at'}</th>
                          </tr></thead>
                          <tbody>
                            {r.applicants.map((a, i) => (
                              <tr key={i}>
                                <td style={{ ...td, borderBottom: 'none' }}></td>
                                <td style={{ ...td, borderBottom: 'none' }}>{a.name || <span style={{ color: '#C0C4CC' }}>—</span>}</td>
                                <td style={{ ...td, borderBottom: 'none', color: '#4B5563' }}>{a.email || <span style={{ color: '#C0C4CC' }}>—</span>}</td>
                                <td style={{ ...num, borderBottom: 'none', fontWeight: 500, color: '#6B7280' }}>{new Date(a.at).toLocaleString(ko ? 'ko-KR' : 'en-US')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
  )
}

// ============ 광고 성과 탭 ============
function AdTab({ data, loading, error, ko }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중… (유입 집계는 몇 초 걸립니다)' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>

  const t = data.totals
  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

  const Stat = ({ label, value, sub, color }) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '13px 16px', minWidth: 120, flex: '1 1 120px' }}>
      <div style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const BarList = ({ title, rows, hint }) => {
    const max = Math.max(1, ...rows.map((r) => r.count))
    return (
      <div style={{ flex: '1 1 320px', minWidth: 300 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 3px' }}>{title}</div>
        {hint && <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{hint}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {rows.map((r) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 130, fontSize: 12, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>{r.name}</div>
              <div style={{ flex: 1, height: 16, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: '#ff6b35', borderRadius: 4 }} />
              </div>
              <div style={{ width: 84, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>
                {r.count.toLocaleString()} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{r.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>
        {ko ? `최근 ${data.windowDays}일 · 기준 ` : `Last ${data.windowDays}d · as of `}{new Date(data.generatedAt).toLocaleString(ko ? 'ko-KR' : 'en-US')}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26 }}>
        <Stat label={ko ? '가입 (30일)' : 'Sign-ups (30d)'} value={t.signups.toLocaleString()} sub={`web ${t.web} / app ${t.app}`} />
        <Stat label={ko ? '유입 landing' : 'Landings'} value={t.landings.toLocaleString()} />
        <Stat label={ko ? '전환율 (가입/landing)' : 'CVR'} value={`${t.landings ? Math.round((t.signups / t.landings) * 1000) / 10 : 0}%`} />
        <Stat label={ko ? '소스 미귀속' : 'Unattributed'} value={`${t.noEventPct}%`} sub={`${t.noEvent}${ko ? '명 이벤트無' : ' no-event'}`} color="#DC2626" />
      </div>

      {/* 가입 캠페인별 — 실제 가입 기준 (핵심) */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 3px' }}>{ko ? '가입 캠페인별 성과 (실제 가입 기준)' : 'Sign-ups by campaign (actual)'}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
        {ko
          ? `트래픽(landing)이 아니라 가입 전환 기준 · 귀속 ${data.signupAttribution.attributed}/${data.signupAttribution.total} (${data.signupAttribution.pct}%, user_profiles.utm)`
          : `Ranked by sign-up conversion, not traffic · attributed ${data.signupAttribution.attributed}/${data.signupAttribution.total} (${data.signupAttribution.pct}%)`}
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 30, border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
          <thead><tr>
            <th style={th}>{ko ? '캠페인' : 'Campaign'}</th>
            <th style={{ ...th, textAlign: 'right' }}>landing</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '가입' : 'sign-ups'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '가입 전환율' : 'sign-up CVR'}</th>
            <th style={{ ...th, textAlign: 'right', width: '24%' }}>{ko ? '가입 볼륨' : 'sign-ups'}</th>
          </tr></thead>
          <tbody>
            {(() => {
              const maxS = Math.max(1, ...data.campaignFunnel.map((c) => c.signups))
              return data.campaignFunnel.map((c) => (
                <tr key={c.campaign}>
                  <td style={{ ...td, fontWeight: 600, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.campaign}>{c.campaign}</td>
                  <td style={{ ...num, color: '#9CA3AF' }}>{c.landings.toLocaleString()}</td>
                  <td style={{ ...num, fontWeight: 800 }}>{c.signups}</td>
                  <td style={{ ...num, color: c.cvr == null ? '#9CA3AF' : c.cvr >= 10 ? '#059669' : c.cvr >= 2 ? '#D97706' : '#DC2626' }}>
                    {c.cvr == null ? '—' : `${c.cvr}%`}
                  </td>
                  <td style={{ ...td, width: '24%' }}>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(c.signups / maxS) * 100}%`, height: '100%', background: '#059669' }} />
                    </div>
                  </td>
                </tr>
              ))
            })()}
          </tbody>
        </table>
      </div>

      {/* 일별 퍼널 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>{ko ? '일별 유입 → 가입 퍼널' : 'Daily landing → sign-up funnel'}</div>
      <div style={{ overflowX: 'auto', marginBottom: 30, border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead><tr>
            <th style={th}>{ko ? '날짜' : 'Date'}</th>
            <th style={{ ...th, textAlign: 'right' }}>landing</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '가입' : 'signup'}</th>
            <th style={{ ...th, textAlign: 'right' }}>CVR</th>
            <th style={{ ...th, textAlign: 'right', width: '26%' }}>{ko ? '가입 볼륨' : 'signups'}</th>
          </tr></thead>
          <tbody>
            {(() => {
              const maxS = Math.max(1, ...data.funnel.map((f) => f.signups))
              return [...data.funnel].reverse().map((f) => (
                <tr key={f.date}>
                  <td style={td}>{f.date.slice(5)}</td>
                  <td style={num}>{f.landings.toLocaleString()}</td>
                  <td style={{ ...num, fontWeight: 800 }}>{f.signups}</td>
                  <td style={{ ...num, color: '#6B7280' }}>{f.cvr == null ? '—' : `${f.cvr}%`}</td>
                  <td style={{ ...td, width: '26%' }}>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(f.signups / maxS) * 100}%`, height: '100%', background: '#ff6b35' }} />
                    </div>
                  </td>
                </tr>
              ))
            })()}
          </tbody>
        </table>
      </div>

      {/* 소재 + 소스 */}
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 28 }}>
        <BarList title={ko ? '광고 소재별 유입 (utm_content)' : 'By creative (utm_content)'} hint={ko ? '어떤 앵글이 트래픽을 만드나 — 피로도 감시' : 'Which angle drives traffic'} rows={data.creatives} />
        <BarList title={ko ? '유입 소스 (utm_source)' : 'By source'} rows={data.sources} />
      </div>

      {/* 캠페인 + 가입채널 */}
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <BarList title={ko ? '캠페인별 유입 (utm_campaign)' : 'By campaign'} rows={data.campaigns} />
        <BarList title={ko ? '가입자 유입 채널 (첫 이벤트)' : 'Sign-up channel (first event)'} hint={ko ? 'no_event/direct 비중이 크면 귀속 사각지대' : 'Attribution of who converted'} rows={data.signupChannels} />
      </div>
    </div>
  )
}

// ============ 실험 탭 — 가입 게이트 (2026-07-13~) ============
// 회사 데이터 언락 조건을 "제출" → "제출+로그인"으로 바꾼 실험의 일별 추적.
// 핵심: 게이트 클릭→로그인 전환율 / 가드: 제출 수(광고 성과 훼손 여부).
// 실험 스위치 — app_flags 원클릭 롤백. 끄면 재배포 없이 즉시(최대 60초 캐시) 반영.
function FlagSwitches({ token, pass, ko }) {
  const [flags, setFlags] = useState(null)
  const [busy, setBusy] = useState('')
  const headers = { Authorization: `Bearer ${token}`, 'x-goal-pass': pass, 'Content-Type': 'application/json' }

  const loadFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/flags', { headers })
      if (res.ok) setFlags(await res.json())
      else setFlags({ error: `(${res.status})` })
    } catch { setFlags({ error: 'load failed' }) }
  }, [token, pass]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadFlags() }, [loadFlags])

  const LABELS = {
    hero_wizard: ko ? '히어로 직무 그리드 (P3)' : 'Hero role grid (P3)',
    hard_gate: ko ? '결과 하드 게이트 (P2)' : 'Result hard gate (P2)',
    one_tap: ko ? 'Google One Tap (P2)' : 'Google One Tap (P2)',
  }

  const toggle = async (key, next) => {
    const label = LABELS[key] || key
    const msg = next
      ? (ko ? `"${label}" 실험을 다시 켤까요?` : `Turn "${label}" back ON?`)
      : (ko ? `"${label}" 실험을 끕니다(롤백). 유저에게 최대 60초 내 반영됩니다. 진행할까요?` : `Roll back "${label}"? Takes effect within 60s.`)
    if (!window.confirm(msg)) return
    setBusy(key)
    try {
      const res = await fetch('/api/admin/flags', { method: 'POST', headers, body: JSON.stringify({ key, enabled: next }) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert((ko ? '실패: ' : 'Failed: ') + (j.error || res.status))
      }
      await loadFlags()
    } finally { setBusy('') }
  }

  if (!flags) return null
  if (flags.error) {
    return (
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#9A3412' }}>
        {ko ? `실험 스위치 로드 실패 ${flags.error} — app_flags 테이블(DDL) 적용 여부 확인` : `Flag switches unavailable ${flags.error} — check app_flags DDL`}
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 16, padding: '14px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
        {ko ? '실험 스위치 (원클릭 롤백)' : 'Experiment switches (one-click rollback)'}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.keys(LABELS).map((key) => {
          const on = flags[key]?.enabled !== false
          return (
            <button key={key} disabled={busy === key} onClick={() => toggle(key, !on)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${on ? '#A7F3D0' : '#FECACA'}`, background: on ? '#ECFDF5' : '#FEF2F2',
                fontSize: 12.5, fontWeight: 700, color: on ? '#065F46' : '#991B1B', opacity: busy === key ? 0.5 : 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#059669' : '#DC2626' }} />
              {LABELS[key]}
              <span style={{ fontSize: 10.5, fontWeight: 800, color: on ? '#059669' : '#DC2626' }}>{on ? 'ON' : 'OFF'}</span>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
        {ko ? '버튼을 누르면 확인 후 즉시 전환 — 재배포 불필요, 60초 캐시 내 전 유저 반영' : 'Click to toggle after confirm — no redeploy, applies to all users within 60s cache'}
      </div>
    </div>
  )
}

function ExperimentTab({ data, loading, error, ko, token, pass }) {
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString()
  const pct = (v) => `${Math.round(v * 100)}%`
  const b = data.before
  const a = data.after
  const gateCvr = a.gateClicks ? a.gateLogins / a.gateClicks : 0

  // 롤백 판정 색 — ok(초록)/warn(주황)/rollback(빨강)/pending(회색)
  const RB_COLORS = { ok: '#059669', warn: '#D97706', rollback: '#DC2626', pending: '#9CA3AF' }
  const RB_LABELS = ko
    ? { ok: '정상', warn: '주의', rollback: '롤백 기준 도달', pending: '수집중' }
    : { ok: 'OK', warn: 'Warning', rollback: 'ROLLBACK', pending: 'Collecting' }

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
          {ko ? '가입 게이트 — 회사 데이터 열람에 로그인 요구' : 'Signup gate — login required to view company data'}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F3EEFF', padding: '3px 9px', borderRadius: 100 }}>
          {ko ? `실험 시작 ${data.experimentStart}` : `Started ${data.experimentStart}`}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        {ko
          ? `베이스라인 ${b.days}일 평균과 비교 · 기준: ${new Date(data.generatedAt).toLocaleString('ko-KR')}`
          : `vs ${b.days}-day baseline · as of ${new Date(data.generatedAt).toLocaleString('en-US')}`}
      </div>

      <FlagSwitches token={token} pass={pass} ko={ko} />

      {/* 롤백 기준 — 실험 전 7일 평균 대비 최근 3 완결일 평균. 기준 도달 시 즉시 롤백 */}
      {data.rollback && (
        <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{ko ? '롤백 기준' : 'Rollback criteria'}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
              {ko
                ? `실험 전 ${data.rollback.baselineDays}일 평균 대비 최근 ${data.rollback.sampleDays || 0}완결일 평균 (오늘 제외)`
                : `vs pre-experiment ${data.rollback.baselineDays}d avg, last ${data.rollback.sampleDays || 0} complete days (excl. today)`}
            </span>
          </div>
          {data.rollback.rules.map((r) => {
            const color = RB_COLORS[r.status]
            return (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid #F5F6F7', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', minWidth: 72 }}>{r.labelKo}</span>
                <span style={{ fontSize: 12, color: '#6B7280', flex: '1 1 260px' }}>
                  {ko
                    ? `베이스라인 ${n1(r.baseline)} 대비 ${Math.round(r.rollbackBelow * 100)}% 미만이면 롤백 · ${Math.round(r.warnBelow * 100)}% 미만이면 주의`
                    : `rollback below ${Math.round(r.rollbackBelow * 100)}% of baseline ${n1(r.baseline)} · warn below ${Math.round(r.warnBelow * 100)}%`}
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                  {r.current == null ? '—' : n1(r.current)}
                  {r.ratio != null && <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 6 }}>({pct(r.ratio)})</span>}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: color, padding: '3px 10px', borderRadius: 100 }}>
                  {RB_LABELS[r.status]}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <Card label={ko ? '가입 / 일 (실험 후)' : 'Signups / day (after)'}
          value={n1(a.signupsPerDay)}
          sub={`${ko ? '이전' : 'before'} ${n1(b.signupsPerDay)}`}
          accent={a.signupsPerDay >= b.signupsPerDay ? '#059669' : '#DC2626'} />
        <Card label={ko ? '제출 / 일 (가드지표)' : 'Submissions / day (guardrail)'}
          value={n1(a.submissionsPerDay)}
          sub={`${ko ? '이전' : 'before'} ${n1(b.submissionsPerDay)} · ${ko ? '떨어지면 광고 훼손 신호' : 'drop = ad funnel damage'}`}
          accent={a.submissionsPerDay >= b.submissionsPerDay * 0.85 ? '#0F172A' : '#DC2626'} />
        <Card label={ko ? '제출 로그인 연결률' : 'Submission login-link rate'}
          value={pct(a.linkedRate)}
          sub={`${ko ? '이전' : 'before'} ${pct(b.linkedRate)}`}
          accent={a.linkedRate > b.linkedRate ? '#059669' : '#0F172A'} />
        <Card label={ko ? '게이트 클릭 → 로그인' : 'Gate click → login'}
          value={`${a.gateLogins} / ${a.gateClicks}`}
          sub={`${ko ? '전환율' : 'CVR'} ${a.gateClicks ? pct(gateCvr) : '—'}`}
          accent="#7C3AED" />
        <Card label={ko ? '결과게이트 노출 (P2 하드게이트)' : 'Result-gate views (P2 hard gate)'}
          value={(a.resultGateViews || 0).toLocaleString()}
          sub={ko ? `노출→클릭 ${a.resultGateViews ? pct(a.gateClicks / a.resultGateViews) : '—'} · ${data.phase2Start}~` : `view→click ${a.resultGateViews ? pct(a.gateClicks / a.resultGateViews) : '—'} · since ${data.phase2Start}`}
          accent="#7C3AED" />
        <Card label={ko ? 'One Tap 가입 (P2)' : 'One Tap signups (P2)'}
          value={(a.oneTapSignups || 0).toLocaleString()}
          sub={ko ? '게이트 안 거친 순증 가입' : 'incremental, bypasses funnel'}
          accent="#059669" />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>{ko ? '일별 추이' : 'Daily'}</div>
      <div style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr>
            <th style={th}>{ko ? '날짜' : 'Date'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '가입' : 'Signups'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '제출' : 'Subs'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '연결률' : 'Linked'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '게이트클릭' : 'Gate clicks'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '게이트로그인' : 'Gate logins'}</th>
            <th style={{ ...th, textAlign: 'right' }}>CVR</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '결과게이트뷰' : 'Result views'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '원탭가입' : 'One Tap'}</th>
          </tr></thead>
          <tbody>
            {[...data.daily].reverse().map((d) => {
              const inExp = d.day >= data.experimentStart
              const inP2 = data.phase2Start && d.day >= data.phase2Start
              return (
                <tr key={d.day} style={inExp ? { background: inP2 ? '#F5F0FF' : '#FBF9FF' } : undefined}>
                  <td style={{ ...td, fontWeight: inExp ? 800 : 400 }}>
                    {d.day.slice(5)}{inExp && <span style={{ fontSize: 10, color: '#7C3AED', marginLeft: 6 }}>{inP2 ? 'P2' : 'EXP'}</span>}
                  </td>
                  <td style={{ ...num, fontWeight: 800 }}>{d.signups}</td>
                  <td style={num}>{d.submissions}</td>
                  <td style={num}>{d.submissions ? pct(d.linked / d.submissions) : '—'}</td>
                  <td style={num}>{d.gateClicks || ''}</td>
                  <td style={{ ...num, color: d.gateLogins ? '#059669' : undefined }}>{d.gateLogins || ''}</td>
                  <td style={num}>{d.gateClicks ? pct(d.gateLogins / d.gateClicks) : ''}</td>
                  <td style={num}>{d.resultGateViews || ''}</td>
                  <td style={{ ...num, color: d.oneTapSignups ? '#059669' : undefined }}>{d.oneTapSignups || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ 이력서 공개 전환 실험 탭 (2026-07-14~) ============
// 웹 /cv 등록에 공개(오퍼 수신) 기본 ON 토글 추가 → 웹 공개 전환율 상승 여부.
// 앱은 예전부터 공개를 기본 안내(전환율 높음) → baseline. 공개는 상태 스냅샷(updated_at 버킷팅).
function ResumePublicTab({ data, loading, error, ko }) {
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const pct = (v) => `${Math.round(v * 100)}%`
  const c = data.cumulative
  const b = data.before
  const a = data.after

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
  const rate = (pub, reg) => (reg ? pct(pub / reg) : '—')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
          {ko ? '이력서 공개 전환 — 웹 /cv 등록 시 공개 토글 기본 ON' : 'Resume-public conversion — default-ON toggle on web /cv'}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0D9488', background: '#E7F7F4', padding: '3px 9px', borderRadius: 100 }}>
          {ko ? `실험 시작 ${data.experimentStart}` : `Started ${data.experimentStart}`}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        {ko
          ? `공개 = 프로필 상태 스냅샷(updated_at 기준) · 앱은 baseline · 기준: ${new Date(data.generatedAt).toLocaleString('ko-KR')}`
          : `Public = profile state snapshot (by updated_at) · app is baseline · as of ${new Date(data.generatedAt).toLocaleString('en-US')}`}
      </div>

      {/* 누적 전환율 (전 기간 스냅샷) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Card label={ko ? '웹 공개 전환율 (누적)' : 'Web public rate (all-time)'}
          value={pct(c.webRate)}
          sub={`${ko ? '공개' : 'public'} ${c.webPublic} / ${ko ? '등록' : 'reg'} ${c.webReg}`}
          accent="#0D9488" />
        <Card label={ko ? '앱 공개 전환율 (baseline)' : 'App public rate (baseline)'}
          value={pct(c.appRate)}
          sub={`${ko ? '공개' : 'public'} ${c.appPublic} / ${ko ? '등록' : 'reg'} ${c.appReg}`}
          accent="#6B7280" />
        <Card label={ko ? '웹 공개 전환율 (실험 후)' : 'Web public rate (after)'}
          value={a.webReg ? pct(a.webRate) : '—'}
          sub={`${ko ? '실험 전' : 'before'} ${b.webReg ? pct(b.webRate) : '—'} · ${a.webPublic}/${a.webReg}`}
          accent={a.webRate >= b.webRate ? '#059669' : '#DC2626'} />
      </div>
      <div style={{ fontSize: 11.5, color: '#B0B0B8', marginBottom: 24 }}>
        {ko
          ? '※ 20260617 이전 등록분은 플랫폼 정보(null)라 앱/웹 어디에도 안 잡힘 → 앱+웹 < 전체 공개.'
          : '* Resumes registered before 20260617 have null platform and count in neither app nor web.'}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>{ko ? '일별 추이' : 'Daily'}</div>
      <div style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr>
            <th style={th}>{ko ? '날짜' : 'Date'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹 등록' : 'Web reg'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹 공개' : 'Web pub'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '웹 전환율' : 'Web rate'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '앱 등록' : 'App reg'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '앱 공개' : 'App pub'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '앱 전환율' : 'App rate'}</th>
          </tr></thead>
          <tbody>
            {[...data.daily].reverse().map((d) => {
              const inExp = d.day >= data.experimentStart
              return (
                <tr key={d.day} style={inExp ? { background: '#EFFBF8' } : undefined}>
                  <td style={{ ...td, fontWeight: inExp ? 800 : 400 }}>
                    {d.day.slice(5)}{inExp && <span style={{ fontSize: 10, color: '#0D9488', marginLeft: 6 }}>EXP</span>}
                  </td>
                  <td style={num}>{d.webReg || ''}</td>
                  <td style={{ ...num, color: d.webPublic ? '#0D9488' : undefined }}>{d.webPublic || ''}</td>
                  <td style={{ ...num, fontWeight: 800 }}>{d.webReg ? rate(d.webPublic, d.webReg) : ''}</td>
                  <td style={num}>{d.appReg || ''}</td>
                  <td style={num}>{d.appPublic || ''}</td>
                  <td style={num}>{d.appReg ? rate(d.appPublic, d.appReg) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ 콜드메일 공개 전환 탭 ============
// 비공개 이력서 보유자에게 "공개하면 축하금 이벤트 참여 가능" 콜드메일 → 원클릭 링크로 공개 전환.
// 퍼널: 발송 → 클릭 → 전환. 발송/전환 모두 events(coldmail_public_*)로 집계.
function ColdmailPublicTab({ data, loading, error, ko }) {
  if (loading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{error}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const pct = (v) => `${Math.round(v * 100)}%`
  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
  const td = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

  const Card = ({ label, value, sub, accent }) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 16, padding: '18px 20px', flex: '1 1 200px', minWidth: 180 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6B7280', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || '#0F172A', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>}
    </div>
  )

  const notSent = data.sent === 0

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
        {ko ? '콜드메일 공개 전환 — 비공개 이력서 → 공개 유도' : 'Cold-email public conversion'}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        {ko
          ? `퍼널: 발송 → 클릭 → 공개 전환 · 기준: ${new Date(data.generatedAt).toLocaleString('ko-KR')}`
          : `Funnel: sent → click → public · as of ${new Date(data.generatedAt).toLocaleString('en-US')}`}
      </div>

      {notSent ? (
        <div style={{ background: '#FFF9E6', border: '1px solid #FCE7A2', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#92700E', marginBottom: 6 }}>
            {ko ? '아직 발송 기록이 없습니다.' : 'No sends recorded yet.'}
          </div>
          <div style={{ fontSize: 12.5, color: '#A8842A', lineHeight: 1.5 }}>
            {ko
              ? `발송 대상(현재 비공개 이력서 보유자): ${data.targetRemaining}명. scripts/outreach/resume-public-coldmail.mjs --commit 로 발송 코호트를 기록하면 여기에 rate가 집계됩니다.`
              : `Target pool (currently private): ${data.targetRemaining}. Run the coldmail script with --commit to record the send cohort.`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <Card label={ko ? '발송' : 'Sent'} value={data.sent}
            sub={data.firstSentDay ? `${data.firstSentDay}${data.lastSentDay && data.lastSentDay !== data.firstSentDay ? `~${data.lastSentDay}` : ''}` : ''} />
          <Card label={ko ? '클릭' : 'Clicked'} value={data.clicked}
            sub={`CTR ${pct(data.clickRate)}`} accent="#2563EB" />
          <Card label={ko ? '공개 전환' : 'Converted'} value={data.converted}
            sub={`${ko ? '전환율' : 'rate'} ${pct(data.convertRate)}`} accent="#0D9488" />
          <Card label={ko ? '클릭→전환' : 'Click→convert'} value={data.clicked ? pct(data.clickToConvert) : '—'}
            sub={ko ? '클릭한 사람 중 공개' : 'of clickers'} accent="#059669" />
        </div>
      )}

      <div style={{ fontSize: 11.5, color: '#B0B0B8', marginBottom: 24 }}>
        {ko
          ? `※ 현재 비공개 이력서 보유자(발송 가능 풀): ${data.targetRemaining}명. 전환율 = 공개 전환 / 발송.`
          : `* Current private-resume pool: ${data.targetRemaining}. Rate = converted / sent.`}
      </div>

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
