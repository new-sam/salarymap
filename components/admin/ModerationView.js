import { useState, useEffect } from 'react'

const REASON = {
  spam: { label: '스팸/광고', color: '#f59e0b' },
  abuse: { label: '욕설/괴롭힘', color: '#ef4444' },
  sexual: { label: '음란물', color: '#ec4899' },
  falseInfo: { label: '허위정보', color: '#8b5cf6' },
  other: { label: '기타', color: '#6b7280' },
}
const CATEGORY = {
  bug: { label: '버그', color: '#ef4444' },
  feature: { label: '제안', color: '#3b82f6' },
  other: { label: '기타', color: '#6b7280' },
}

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }
const th = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }
const td = { padding: '8px 12px', verticalAlign: 'top' }
const muted = { ...td, color: '#666', fontSize: 12 }

function Badge({ label, color }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: color + '22', color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function SectionHead({ title, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h3>
      <span style={{ fontSize: 14, color: '#6B7280' }}>총 <strong style={{ color }}>{count}</strong>건</span>
    </div>
  )
}

const fmt = (s) => (s ? new Date(s).toLocaleString('ko-KR') : '-')

export default function ModerationView({ token }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/reports', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok && alive) setData(await res.json())
      } catch (e) {
        console.error(e)
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [token])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>불러오는 중...</div>
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>데이터를 불러오지 못했어요</div>

  const { reports = [], feedback = [], blocks = [] } = data

  return (
    <>
      {/* 신고 */}
      <SectionHead title="🚩 콘텐츠 신고" count={reports.length} color="#ef4444" />
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={th}>#</th>
                <th style={th}>사유</th>
                <th style={th}>대상</th>
                <th style={th}>내용 미리보기</th>
                <th style={th}>신고자</th>
                <th style={th}>신고 시각</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td style={muted} colSpan={6}>아직 신고가 없어요</td></tr>
              ) : reports.map((r, i) => {
                const meta = REASON[r.reason] || REASON.other
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                    <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                    <td style={td}><Badge label={meta.label} color={meta.color} /></td>
                    <td style={muted}>{r.target_type === 'post' ? '게시글' : '댓글'}</td>
                    <td style={{ ...td, maxWidth: 360, color: '#333' }}>{r.target_preview || '-'}</td>
                    <td style={muted}>{r.reporter_email}</td>
                    <td style={{ ...muted, whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 버그 리포트 / 문의 */}
      <SectionHead title="🐞 버그 리포트 / 문의" count={feedback.length} color="#4F46E5" />
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={th}>#</th>
                <th style={th}>분류</th>
                <th style={th}>내용</th>
                <th style={th}>보낸 사람</th>
                <th style={th}>회신 이메일</th>
                <th style={th}>환경</th>
                <th style={th}>시각</th>
              </tr>
            </thead>
            <tbody>
              {feedback.length === 0 ? (
                <tr><td style={muted} colSpan={7}>아직 들어온 피드백이 없어요</td></tr>
              ) : feedback.map((f, i) => {
                const meta = CATEGORY[f.category] || CATEGORY.other
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                    <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                    <td style={td}><Badge label={meta.label} color={meta.color} /></td>
                    <td style={{ ...td, maxWidth: 420, color: '#333', whiteSpace: 'pre-wrap' }}>{f.message}</td>
                    <td style={muted}>{f.user_email}</td>
                    <td style={muted}>{f.contact_email || '-'}</td>
                    <td style={muted}>{[f.platform, f.app_version].filter(Boolean).join(' · ') || '-'}</td>
                    <td style={{ ...muted, whiteSpace: 'nowrap' }}>{fmt(f.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 차단 */}
      <SectionHead title="🚫 사용자 차단" count={blocks.length} color="#6b7280" />
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={th}>#</th>
                <th style={th}>차단한 사람</th>
                <th style={th}>차단당한 사람</th>
                <th style={th}>시각</th>
              </tr>
            </thead>
            <tbody>
              {blocks.length === 0 ? (
                <tr><td style={muted} colSpan={4}>아직 차단 내역이 없어요</td></tr>
              ) : blocks.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                  <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                  <td style={muted}>{b.blocker_email}</td>
                  <td style={muted}>{b.blocked_email}</td>
                  <td style={{ ...muted, whiteSpace: 'nowrap' }}>{fmt(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
