import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// FYI 12주 KPI 트래커 — /api/admin/kpi 실측 + 주차밴드별 가목표(아래 TARGETS).
//  · 유입단: CPI · 가입당비용 · CTR · 설치→가입전환율  (Meta API 연동 필요)
//  · 작동단: ⭐작성자비율 · ⭐참여vs비참여 치환율 + 보조지표
// 행=주차(W1~W12), 열=지표. 각 칸 = 실측 / (가목표). 마일스톤 W4·W8·W12 강조.

const sectionStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }
const sectionTitle = { fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }
const sub = { fontSize: 12, color: '#9ca3af', margin: '0 0 16px 0' }
const th = { padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: 12 }
const thL = { ...th, textAlign: 'left' }
const thP = { ...th, color: '#ff6000' } // 플랫폼 토글이 적용되는 열
const td = { padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #f3f4f6' }
const tdL = { ...td, textAlign: 'left', fontWeight: 600 }

// 주차밴드별 가목표(사용자 KPI 트래커). null=측정 단계(W1~2).
// 유입: cpi/cps 낮을수록 좋음, i2s 높을수록 좋음. 작동: 높을수록 좋음.
const TARGETS = {
  // [cpi, costPerSignup, ctr, installToSignup, writerRatio, convRatio]
  1: { cpi: 2500, cps: 4000, writerRatio: null, convRatio: null, label: '베이스라인' },
  2: { cpi: 2500, cps: 4000, writerRatio: null, convRatio: null, label: '베이스라인' },
  3: { cpi: 2300, cps: 3700, writerRatio: 3, convRatio: 1.2 },
  4: { cpi: 2300, cps: 3700, writerRatio: 3, convRatio: 1.2, milestone: '1개월' },
  5: { cpi: 2100, cps: 3400, writerRatio: 6, convRatio: 1.4 },
  6: { cpi: 2100, cps: 3400, writerRatio: 6, convRatio: 1.4 },
  7: { cpi: 2000, cps: 3200, writerRatio: 7, convRatio: 1.6 },
  8: { cpi: 2000, cps: 3200, writerRatio: 7, convRatio: 1.6, milestone: '2개월' },
  9: { cpi: 1900, cps: 3000, writerRatio: 9, convRatio: 1.8 },
  10: { cpi: 1900, cps: 3000, writerRatio: 9, convRatio: 1.8 },
  11: { cpi: 1800, cps: 2800, writerRatio: 10, convRatio: 2 },
  12: { cpi: 1800, cps: 2800, writerRatio: 10, convRatio: 2, milestone: '3개월' },
}

const won = (n) => (n == null ? null : '₩' + Math.round(n).toLocaleString())
const pct = (n) => (n == null ? null : n + '%')
const mult = (n) => (n == null ? null : n + '배')

// 실측 vs 목표 → 색. lowerBetter면 실측<=목표가 달성.
function tone(actual, target, lowerBetter) {
  if (actual == null) return '#9ca3af' // 측정대기
  if (target == null) return '#111827' // 측정 단계(목표 없음)
  const hit = lowerBetter ? actual <= target : actual >= target
  return hit ? '#059669' : '#dc2626'
}

function Cell({ actual, display, target, targetDisplay, lowerBetter }) {
  return (
    <td style={td}>
      <div style={{ fontWeight: 700, color: tone(actual, target, lowerBetter) }}>{display ?? '·'}</div>
      {targetDisplay && (
        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 1, fontWeight: 600 }}>목표 {targetDisplay}</div>
      )}
    </td>
  )
}

const PLATFORMS = [
  { key: 'all', label: '합계' },
  { key: 'app', label: 'App' },
  { key: 'web', label: 'Web' },
]

export default function KPIView({ token }) {
  const { data, isLoading } = useAdmin('/api/admin/kpi', token)
  const [plat, setPlat] = useState('all')

  if (isLoading && !data) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>KPI 불러오는 중...</div>
  if (!data) return null

  const rows = data.rows || []
  const cur = data.currentWeek

  const rowBg = (w) => (w === cur ? 'rgba(255,96,0,0.05)' : TARGETS[w]?.milestone ? '#fafafa' : '#fff')
  const wLabel = (r) => {
    const t = TARGETS[r.w]
    return (
      <td style={{ ...tdL, whiteSpace: 'nowrap' }}>
        <span style={{ color: r.w === cur ? '#ff6000' : '#111' }}>W{r.w}</span>
        {r.w === cur && <span style={{ fontSize: 10, color: '#ff6000', marginLeft: 5 }}>지금</span>}
        {t?.milestone && <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 5 }}>· {t.milestone}</span>}
        {t?.label && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 5 }}>· {t.label}</span>}
        <div style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 400 }}>{r.start.slice(5)}~{r.end.slice(5)}</div>
      </td>
    )
  }

  return (
    <div>
      {/* 유입단 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>🎯 유입단 (Acquisition)</h3>
        <p style={sub}>
          얼마에(CPI) 얼마나(가입) 데려오는가 ·{' '}
          {data.meta.configured
            ? data.meta.error
              ? <span style={{ color: '#dc2626' }}>Meta API 오류: {data.meta.error}</span>
              : <span style={{ color: '#059669' }}>Meta 연동됨</span>
            : <span style={{ color: '#d97706' }}>⚠ Meta 미연동 — META_ACCESS_TOKEN·META_AD_ACCOUNT_ID 설정 시 비용지표 자동 채움</span>}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thL}>주차</th>
                <th style={th}>광고비</th>
                <th style={th}>설치</th>
                <th style={th}>가입</th>
                <th style={th}>CPI</th>
                <th style={th}>가입당비용</th>
                <th style={th}>CTR</th>
                <th style={th}>설치→가입</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = TARGETS[r.w]
                const a = r.acq
                if (r.isFuture) return <tr key={r.w} style={{ opacity: 0.45 }}>{wLabel(r)}<td style={td} colSpan={7}>—</td></tr>
                return (
                  <tr key={r.w} style={{ background: rowBg(r.w) }}>
                    {wLabel(r)}
                    <Cell actual={a.spend} display={won(a.spend)} />
                    <Cell actual={a.installs} display={a.installs} />
                    <Cell actual={a.signups} display={a.signups} />
                    <Cell actual={a.cpi} display={won(a.cpi)} target={t.cpi} targetDisplay={won(t.cpi)} lowerBetter />
                    <Cell actual={a.costPerSignup} display={won(a.costPerSignup)} target={t.cps} targetDisplay={won(t.cps)} lowerBetter />
                    <Cell actual={a.ctr} display={pct(a.ctr)} />
                    <Cell actual={a.installToSignup} display={pct(a.installToSignup)} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 작동단 */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={sectionTitle}>⚙️ 작동단 (Activation — 커뮤니티)</h3>
            <p style={sub}>공간이 살아있고(건강성) + 그 활동이 인재로 이어지나(치환). ⭐ = 북극성 지표</p>
          </div>
          {/* 플랫폼 토글 — 활성·작성자·작성자비율·글댓글에만 적용(목표는 합산 기준) */}
          <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
            {PLATFORMS.map((p) => (
              <button key={p.key} onClick={() => setPlat(p.key)}
                style={{
                  padding: '5px 14px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer',
                  background: plat === p.key ? '#fff' : 'transparent',
                  color: plat === p.key ? '#111' : '#9ca3af',
                  boxShadow: plat === p.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thL}>주차</th>
                <th style={thP}>⭐작성자비율</th>
                <th style={th}>⭐치환율차이</th>
                <th style={thP}>활성</th>
                <th style={thP}>작성자</th>
                <th style={thP}>글/댓글</th>
                <th style={th}>리텐션<br/>W→W+1</th>
                <th style={th}>팔로우</th>
                <th style={th}>인증재직</th>
                <th style={th}>이력서등록</th>
                <th style={th}>공개ON</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = TARGETS[r.w]
                const x = r.act
                const b = x.byPlatform[plat]
                if (r.isFuture) return <tr key={r.w} style={{ opacity: 0.45 }}>{wLabel(r)}<td style={td} colSpan={10}>—</td></tr>
                return (
                  <tr key={r.w} style={{ background: rowBg(r.w) }}>
                    {wLabel(r)}
                    <Cell actual={b.writerRatio} display={pct(b.writerRatio)} target={t.writerRatio} targetDisplay={t.writerRatio ? t.writerRatio + '%' : null} />
                    <Cell actual={x.convRatio} display={mult(x.convRatio)} target={t.convRatio} targetDisplay={t.convRatio ? t.convRatio + '배' : null} />
                    <Cell actual={b.activeUsers} display={b.activeUsers} />
                    <Cell actual={b.writers} display={b.writers} />
                    <Cell actual={b.posts} display={`${b.posts}/${b.comments}`} />
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: x.retention == null ? '#9ca3af' : '#111827' }}>
                        {x.retention == null ? '·' : pct(x.retention)}{x.retentionPartial ? '*' : ''}
                      </div>
                      {x.retentionCohort > 0 && <div style={{ color: '#6b7280', fontSize: 11, marginTop: 1, fontWeight: 600 }}>n={x.retentionCohort}</div>}
                    </td>
                    <Cell actual={x.follows} display={x.follows} />
                    <Cell actual={x.verifiedWorkers} display={x.verifiedWorkers} />
                    <Cell actual={x.resumeRate} display={pct(x.resumeRate)} />
                    <Cell actual={x.publicToggleRate} display={pct(x.publicToggleRate)} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ ...sub, marginTop: 14, marginBottom: 0 }}>
          <span style={{ color: '#ff6000', fontWeight: 700 }}>주황 열</span>(작성자비율·활성·작성자·글댓글)만 App/Web 토글 적용 · 나머지(치환율·팔로우·인증재직·이력서·공개ON)는 플랫폼 컬럼이 없어 항상 합산 ·
          ⭐작성자비율 = 그 주 활성(로그인) 유저 중 글·댓글 쓴 % · ⭐치환율차이 = 작성자 이력서등록률 ÷ 비작성자 등록률(배수, 주말 누적) ·
          리텐션 = 그 주 가입 유저(n) 중 다음 주에도 활성(이벤트 1건+)인 비율(합산, *=다음주 진행중 부분집계) · 시드봇/내부계정 제외
        </p>
      </div>
    </div>
  )
}
