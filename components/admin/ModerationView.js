import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

const REASON = {
  spam: { label: '스팸/광고', dot: '#D97706' },
  abuse: { label: '욕설/괴롭힘', dot: '#DC2626' },
  sexual: { label: '음란물', dot: '#DB2777' },
  falseInfo: { label: '허위정보', dot: '#7C3AED' },
  other: { label: '기타', dot: '#94A3B8' },
}
const CATEGORY = {
  bug: { label: '버그', dot: '#DC2626' },
  feature: { label: '제안', dot: '#ff4400' },
  other: { label: '기타', dot: '#94A3B8' },
}

const card = { background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }
const th = { padding: '11px 12px', textAlign: 'left', fontWeight: 700, color: '#8B95A1', fontSize: 11.5, whiteSpace: 'nowrap' }
const td = { padding: '11px 12px', verticalAlign: 'top' }
const muted = { ...td, color: '#868E96', fontSize: 12 }
const fmt = (s) => (s ? new Date(s).toLocaleString('ko-KR') : '-')

function Badge({ label, dot }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#F2F4F6', color: '#4E5968', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      {label}
    </span>
  )
}

function SectionHead({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#191F28', margin: 0 }}>{title}</h3>
      <span style={{ fontSize: 13, color: '#6B7280' }}>총 <strong style={{ color: '#191F28' }}>{count}</strong>건</span>
    </div>
  )
}

const btnSolid = (bg) => ({ padding: '5px 11px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, background: bg, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' })
const btnGhost = (color) => ({ padding: '5px 11px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#fff', color, cursor: 'pointer', whiteSpace: 'nowrap' })

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
      <SectionHead title="콘텐츠 신고" count={reports.length} />
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EEF0F2', background: '#FAFBFC' }}>
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
                  <tr key={r.id} style={{ borderBottom: '1px solid #F2F4F6' }}>
                    <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                    <td style={td}><Badge label={meta.label} dot={meta.dot} /></td>
                    <td style={muted}>{r.target_type === 'post' ? '게시글' : '댓글'}</td>
                    <td style={{ ...td, maxWidth: 360, color: r.target_deleted ? '#bbb' : '#333' }}>
                      {r.target_deleted ? '(이미 삭제됨)' : (r.target_preview || '-')}
                    </td>
                    <td style={muted}>{r.reporter_email}</td>
                    <td style={{ ...muted, whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!r.target_deleted && (
                          <button disabled={isBusy} onClick={() => act(r, 'delete-content')} style={btnSolid(isBusy ? '#C7CDD4' : '#DC2626')}>
                            {r.target_type === 'post' ? '게시글 삭제' : '댓글 삭제'}
                          </button>
                        )}
                        <button disabled={isBusy} onClick={() => act(r, 'dismiss')} style={btnGhost('#4E5968')}>
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
      <SectionHead title="버그 리포트 / 문의" count={feedback.length} />
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EEF0F2', background: '#FAFBFC' }}>
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
                  <tr key={f.id} style={{ borderBottom: '1px solid #F2F4F6', background: f.handled ? '#F6FBF8' : '#fff', opacity: f.handled ? 0.55 : 1 }}>
                    <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                    <td style={td}><Badge label={meta.label} dot={meta.dot} /></td>
                    <td style={{ ...td, maxWidth: 420, color: '#333', whiteSpace: 'pre-wrap' }}>{f.message}</td>
                    <td style={muted}>
                      {f.user_email}
                      {f.contact_email && f.contact_email !== f.user_email ? <div style={{ color: '#999' }}>회신: {f.contact_email}</div> : null}
                    </td>
                    <td style={muted}>{[f.platform, f.app_version].filter(Boolean).join(' · ') || '-'}</td>
                    <td style={{ ...muted, whiteSpace: 'nowrap' }}>{fmt(f.created_at)}</td>
                    <td style={td}>
                      {replyTo ? (
                        <a href={`mailto:${replyTo}?subject=${subject}`} style={{ ...btnGhost('#ff4400'), textDecoration: 'none', display: 'inline-block' }}>
                          답장
                        </a>
                      ) : <span style={{ color: '#bbb', fontSize: 12 }}>이메일 없음</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button disabled={isBusy} onClick={() => toggleFeedback(f)} style={f.handled ? btnGhost('#4E5968') : btnSolid(isBusy ? '#C7CDD4' : '#059669')}>
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
