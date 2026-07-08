import { useState, useEffect, useCallback } from 'react'

// 개인용 "목표지표 - Sean" — 이번 달 두 KPI를 한 화면에.
//   KPI1: 일 평균 신규 가입자 100명
//   KPI2: 기업 고객 공고 당 30개 지원 (D+7)
// 어드민 인증 위에 개인 비밀번호를 한 겹 더 건다(서버 검증, sessionStorage 유지).

const PASS_KEY = 'goalPass'

export default function GoalMetricsView({ token, lang }) {
  const ko = lang !== 'en'
  const [pass, setPass] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p) => {
    if (!token || !p) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/goal-metrics', {
        headers: { Authorization: `Bearer ${token}`, 'x-goal-pass': p },
      })
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

  // 세션에 비번이 있으면 자동 진입
  useEffect(() => {
    let saved = ''
    try { saved = sessionStorage.getItem(PASS_KEY) || '' } catch {}
    if (saved) { setPass(saved); load(saved) }
  }, [load])

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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1d1d1f', marginBottom: 4 }}>
            {ko ? '목표지표 — Sean' : 'Goal metrics — Sean'}
          </div>
          <div style={{ fontSize: 12.5, color: '#86868b', marginBottom: 18 }}>
            {ko ? '개인 비밀번호를 입력하세요.' : 'Enter your personal password.'}
          </div>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder={ko ? '비밀번호' : 'Password'}
            style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '1px solid #d2d2d7', borderRadius: 10, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: '#ff4400', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '…' : ko ? '열기' : 'Unlock'}
          </button>
          {error && <div style={{ fontSize: 12.5, color: '#c00', marginTop: 12 }}>{error}</div>}
        </form>
      </div>
    )
  }

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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 48px' }}>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        {ko ? '기준: ' : 'As of '}{new Date(data.generatedAt).toLocaleString(ko ? 'ko-KR' : 'en-US')} · {s.month}
      </div>

      {/* 게이지 2개 */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <Gauge
          label={ko ? 'KPI 1 · 일 평균 신규 가입자' : 'KPI 1 · Avg daily sign-ups'}
          value={n1(s.avgPerDay.all)} target={s.target} unit={ko ? '명' : ''}
          pct={s.achievementPct}
          sub={`${ko ? '누적' : 'MTD'} ${s.totals.all}${ko ? '명' : ''} · web ${s.totals.web} / app ${s.totals.app} · ${s.daysElapsed}${ko ? '일 경과' : 'd'}`}
        />
        <Gauge
          label={ko ? 'KPI 2 · 기업공고 당 지원 (D+7)' : 'KPI 2 · Apps per enterprise post (D+7)'}
          value={n1(e.avgD7)} target={e.target} unit={ko ? '건' : ''}
          pct={e.achievementPct}
          sub={`${ko ? '측정대상(D+7경과)' : 'Matured'} ${e.maturedCount}${ko ? '건' : ''} · ${ko ? '전체 기업공고' : 'total'} ${e.totalPosts}`}
        />
      </div>

      {/* KPI1 일별 */}
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

      {/* KPI2 공고별 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
        {ko ? `기업 공고 · D+7 경과 (측정 대상 ${e.maturedCount}건)` : `Enterprise posts · matured (${e.maturedCount})`}
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 20, border: '1px solid #EEF0F2', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead><tr>
            <th style={th}>{ko ? '회사' : 'Company'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? 'D+7 지원' : 'Apps D+7'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '누적' : 'Total'}</th>
            <th style={{ ...th, textAlign: 'right' }}>{ko ? '경과일' : 'Age'}</th>
            <th style={th}></th>
          </tr></thead>
          <tbody>
            {e.matured.length === 0 && (
              <tr><td style={td} colSpan={5}>{ko ? 'D+7 경과한 기업 공고가 아직 없습니다.' : 'No matured enterprise posts yet.'}</td></tr>
            )}
            {e.matured.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.company || '—'}</td>
                <td style={{ ...num, fontWeight: 800, color: r.appsD7 >= e.target ? '#059669' : '#0F172A' }}>{r.appsD7}</td>
                <td style={num}>{r.appsTotal}</td>
                <td style={num}>{Math.floor(r.ageDays)}{ko ? '일' : 'd'}</td>
                <td style={td}>{!r.isActive && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{ko ? '비활성' : 'inactive'}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* KPI2 진행중 */}
      {e.young.length > 0 && (
        <details>
          <summary style={{ fontSize: 12.5, color: '#6B7280', cursor: 'pointer', marginBottom: 8 }}>
            {ko ? `아직 D+7 미도달 (진행중) ${e.young.length}건` : `In progress (pre-D+7): ${e.young.length}`}
          </summary>
          <div style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
              <thead><tr>
                <th style={th}>{ko ? '회사' : 'Company'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{ko ? '현재 지원' : 'Apps'}</th>
                <th style={{ ...th, textAlign: 'right' }}>{ko ? '경과일' : 'Age'}</th>
              </tr></thead>
              <tbody>
                {e.young.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...td, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.company || '—'}</td>
                    <td style={num}>{r.appsTotal}</td>
                    <td style={num}>{n1(r.ageDays)}{ko ? '일' : 'd'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
