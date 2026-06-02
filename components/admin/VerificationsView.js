import { useState, useEffect } from 'react'
import { getSalaryTier } from '../../lib/salaryTiers'

const STATUS_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
  approved: { bg: 'rgba(34,197,94,0.1)', color: '#16a34a' },
  rejected: { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' },
}

const DOC_LABELS = {
  payslip: '급여명세서',
  contract: '근로계약서',
  tax_return: '원천징수영수증',
  other: '기타',
}

export default function VerificationsView({ token }) {
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [actionLoading, setActionLoading] = useState(null)
  const [noteInput, setNoteInput] = useState({})
  const [salaryInput, setSalaryInput] = useState({}) // per-id, in 만원

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/salary-verification/admin?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { verifications: data } = await res.json()
        setVerifications(data)
        // Prefill the salary input with the user-submitted amount (converted to 만원).
        setSalaryInput(prev => {
          const next = { ...prev }
          data.forEach(v => {
            if (next[v.id] === undefined && v.salary_amount) next[v.id] = String(Math.round(v.salary_amount / 10000))
          })
          return next
        })
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [token, filter])

  const handleAction = async (id, status) => {
    // Approval requires an admin-entered salary amount (만원) → stored as won.
    let salaryWon = null
    if (status === 'approved') {
      const man = parseInt(salaryInput[id], 10)
      if (!man || man <= 0) {
        alert('연봉 금액(만원)을 입력해야 승인할 수 있습니다.')
        return
      }
      salaryWon = man * 10000
    }
    setActionLoading(id)
    try {
      const res = await fetch('/api/salary-verification/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status, admin_note: noteInput[id] || '', salary_amount: salaryWon }),
      })
      if (res.ok) {
        setVerifications(prev => prev.filter(v => v.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
    setActionLoading(null)
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid',
              borderColor: filter === s ? '#ff6000' : 'rgba(0,0,0,0.1)',
              background: filter === s ? 'rgba(255,96,0,0.08)' : '#fff',
              color: filter === s ? '#ff6000' : '#888',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {s === 'pending' ? '검토 대기' : s === 'approved' ? '승인됨' : s === 'rejected' ? '반려됨' : '전체'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div>
      ) : verifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 14 }}>
          요청이 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {verifications.map(v => (
            <div key={v.id} style={{
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {v.profile?.photo_url ? (
                    <img src={v.profile.photo_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                      {v.profile?.full_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>
                      {v.profile?.current_company || '-'}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                  background: STATUS_COLORS[v.status]?.bg, color: STATUS_COLORS[v.status]?.color,
                }}>
                  {v.status === 'pending' ? '검토 대기' : v.status === 'approved' ? '승인됨' : '반려됨'}
                </span>
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12, fontSize: 12 }}>
                <div>
                  <div style={{ color: 'rgba(0,0,0,0.4)', marginBottom: 2 }}>서류 종류</div>
                  <div style={{ fontWeight: 600, color: '#111' }}>{DOC_LABELS[v.document_type] || v.document_type}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(0,0,0,0.4)', marginBottom: 2 }}>연봉</div>
                  <div style={{ fontWeight: 600, color: '#111' }}>{v.salary_amount ? `${(v.salary_amount / 10000).toLocaleString()}만원` : '-'}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(0,0,0,0.4)', marginBottom: 2 }}>요청일</div>
                  <div style={{ fontWeight: 600, color: '#111' }}>{new Date(v.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Document Link */}
              <a href={v.document_url} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  borderRadius: 8, background: 'rgba(0,0,0,0.04)', color: '#333', fontSize: 12,
                  fontWeight: 600, textDecoration: 'none', marginBottom: 12,
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                증빙 서류 보기
              </a>

              {/* Admin Actions */}
              {v.status === 'pending' && (() => {
                const man = parseInt(salaryInput[v.id], 10)
                const tier = man > 0 ? getSalaryTier(man * 10000) : null
                return (
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12, marginTop: 4 }}>
                  {/* Verified salary amount → determines the badge tier */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        value={salaryInput[v.id] || ''}
                        onChange={e => setSalaryInput(prev => ({ ...prev, [v.id]: e.target.value }))}
                        placeholder="인증 연봉 (만원)"
                        style={{ width: '100%', padding: '8px 44px 8px 12px', border: '1px solid rgba(255,96,0,0.3)', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none' }}
                      />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>만원</span>
                    </div>
                    {tier && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: tier.grad, color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                        → {tier.defaultLabel}
                      </span>
                    )}
                  </div>
                  <input
                    value={noteInput[v.id] || ''}
                    onChange={e => setNoteInput(prev => ({ ...prev, [v.id]: e.target.value }))}
                    placeholder="관리자 메모 (선택사항)"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', marginBottom: 8, outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAction(v.id, 'approved')} disabled={actionLoading === v.id}
                      style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading === v.id ? 0.5 : 1 }}>
                      승인
                    </button>
                    <button onClick={() => handleAction(v.id, 'rejected')} disabled={actionLoading === v.id}
                      style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading === v.id ? 0.5 : 1 }}>
                      반려
                    </button>
                  </div>
                </div>
                )
              })()}

              {/* Show reviewer info for non-pending */}
              {v.status !== 'pending' && v.reviewed_by && (
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>
                  {v.reviewed_by} | {v.reviewed_at ? new Date(v.reviewed_at).toLocaleString() : ''}
                  {v.admin_note && ` | ${v.admin_note}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
