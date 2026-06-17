import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

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
const fmt = (s) => (s ? new Date(s).toLocaleString('ko-KR') : '-')

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

const btn = (bg) => ({
  padding: '4px 10px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: bg, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
})

export default function ModerationView({ token }) {
  const { data, isLoading: loading, mutate } = useAdmin('/api/admin/reports', token)
  const [busy, setBusy] = useState(null) // `${target_type}:${target_id}` 처리 중

  async function act(report, action) {
    const what = report.target_type === 'post' ? '게시글' : '댓글'
    const msg = action === 'delete-content'
      ? `이 ${what}을(를) 삭제할까요? 되돌릴 수 없습니다.`
      : '이 신고를 무시(큐에서 제거)할까요? 콘텐츠는 유지됩니다.'
    if (!window.confirm(msg)) return
    const key = `${report.target_type}:${report.target_id}`
    setBusy(key)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, target_type: report.target_type, target_id: report.target_id }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('실패: ' + (e.error || res.status)) }
      else mutate()
    } catch (e) {
      alert('실패: ' + e.message)
    }
    setBusy(null)
  }

  async function toggleFeedback(f) {
    setBusy('fb:' + f.id)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'feedback-handled', id: f.id, handled: !f.handled }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('실패: ' + (e.error || res.status)) }
      else mutate()
    } catch (e) {
      alert('실패: ' + e.message)
    }
    setBusy(null)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>불러오는 중...</div>
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>데이터를 불러오지 못했어요</div>

  const { reports = [], feedback = [] } = data

  return (
    <>
      {/* 신고 — 처리 가능 */}
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
                <th style={th}>처리</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td style={muted} colSpan={7}>아직 신고가 없어요</td></tr>
              ) : reports.map((r, i) => {
                const meta = REASON[r.reason] || REASON.other
                const key = `${r.target_type}:${r.target_id}`
                const isBusy = busy === key
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                    <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                    <td style={td}><Badge label={meta.label} color={meta.color} /></td>
                    <td style={muted}>{r.target_type === 'post' ? '게시글' : '댓글'}</td>
                    <td style={{ ...td, maxWidth: 360, color: r.target_deleted ? '#bbb' : '#333' }}>
                      {r.target_deleted ? '(이미 삭제됨)' : (r.target_preview || '-')}
                    </td>
                    <td style={muted}>{r.reporter_email}</td>
                    <td style={{ ...muted, whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!r.target_deleted && (
                          <button disabled={isBusy} onClick={() => act(r, 'delete-content')} style={btn(isBusy ? '#9CA3AF' : '#ef4444')}>
                            {r.target_type === 'post' ? '게시글 삭제' : '댓글 삭제'}
                          </button>
                        )}
                        <button disabled={isBusy} onClick={() => act(r, 'dismiss')} style={btn(isBusy ? '#9CA3AF' : '#6b7280')}>
                          무시
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 버그 리포트 / 문의 — 회신 이메일로 답장 */}
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
                <th style={th}>환경</th>
                <th style={th}>시각</th>
                <th style={th}>답장</th>
                <th style={th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {feedback.length === 0 ? (
                <tr><td style={muted} colSpan={8}>아직 들어온 피드백이 없어요</td></tr>
              ) : feedback.map((f, i) => {
                const meta = CATEGORY[f.category] || CATEGORY.other
                const replyTo = f.contact_email || (f.user_email && f.user_email.includes('@') ? f.user_email : null)
                const subject = encodeURIComponent('[salary.fyi] 문의 답변')
                const isBusy = busy === 'fb:' + f.id
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6', background: f.handled ? '#f3faf4' : (i % 2 ? '#fafafa' : '#fff'), opacity: f.handled ? 0.6 : 1 }}>
                    <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                    <td style={td}><Badge label={meta.label} color={meta.color} /></td>
                    <td style={{ ...td, maxWidth: 420, color: '#333', whiteSpace: 'pre-wrap' }}>{f.message}</td>
                    <td style={muted}>
                      {f.user_email}
                      {f.contact_email && f.contact_email !== f.user_email ? <div style={{ color: '#999' }}>회신: {f.contact_email}</div> : null}
                    </td>
                    <td style={muted}>{[f.platform, f.app_version].filter(Boolean).join(' · ') || '-'}</td>
                    <td style={{ ...muted, whiteSpace: 'nowrap' }}>{fmt(f.created_at)}</td>
                    <td style={td}>
                      {replyTo ? (
                        <a href={`mailto:${replyTo}?subject=${subject}`} style={{ ...btn('#4F46E5'), textDecoration: 'none', display: 'inline-block' }}>
                          답장
                        </a>
                      ) : <span style={{ color: '#bbb', fontSize: 12 }}>이메일 없음</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button disabled={isBusy} onClick={() => toggleFeedback(f)} style={btn(isBusy ? '#9CA3AF' : (f.handled ? '#6b7280' : '#10b981'))}>
                        {f.handled ? '완료취소' : '처리완료'}
                      </button>
                    </td>
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
