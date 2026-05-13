import { useState, useEffect } from 'react'
import { HR_STATUS_COLORS } from '../../constants/dashboard'

export default function HRApprovalView({ token, lang }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { fetchUsers() }, [token])

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/hr-users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {}
    setLoading(false)
  }

  async function updateStatus(userId, status) {
    await fetch('/api/admin/hr-users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, status }),
    })
    fetchUsers()
  }

  const filtered = filter === 'all' ? users : users.filter(u => u.status === filter)
  const counts = {
    all: users.length,
    submitted: users.filter(u => u.status === 'submitted').length,
    approved: users.filter(u => u.status === 'approved').length,
    rejected: users.filter(u => u.status === 'rejected').length,
    pending: users.filter(u => u.status === 'pending').length,
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading...</div>

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { key: 'submitted', label: lang === 'ko' ? '승인 대기' : 'Pending Review', color: '#1E40AF', bg: '#EFF6FF', iconName: 'hourglass' },
          { key: 'approved', label: lang === 'ko' ? '승인됨' : 'Approved', color: '#065F46', bg: '#F0FDF4', iconName: 'check' },
          { key: 'rejected', label: lang === 'ko' ? '반려' : 'Rejected', color: '#991B1B', bg: '#FEF2F2', iconName: 'close' },
          { key: 'all', label: lang === 'ko' ? '전체' : 'Total', color: '#374151', bg: '#F9FAFB', iconName: null },
        ].map(c => (
          <div key={c.key} onClick={() => setFilter(c.key)}
            style={{
              background: filter === c.key ? c.bg : '#fff',
              border: filter === c.key ? `2px solid ${c.color}` : '1px solid #e5e7eb',
              borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'all .15s',
            }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{counts[c.key]}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          {lang === 'ko' ? '해당 상태의 HR 사용자가 없습니다.' : 'No HR users with this status.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(u => {
            const sc = HR_STATUS_COLORS[u.status] || HR_STATUS_COLORS.pending
            const isExpanded = expandedId === u.userId
            return (
              <div key={u.userId} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                overflow: 'hidden', transition: 'all .15s',
              }}>
                <div onClick={() => setExpandedId(isExpanded ? null : u.userId)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', cursor: 'pointer',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#ff6000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0,
                    }}>
                      {(u.fullName || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
                        {u.fullName || u.email}
                        {u.companyName && <span style={{ color: '#888', fontWeight: 400, marginLeft: 8 }}>@ {u.companyName}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {u.email} · {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                      background: sc.bg, color: sc.color,
                    }}>
                      {sc.label[lang] || sc.label.ko}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f3f3' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', padding: '16px 0' }}>
                      {[
                        { label: lang === 'ko' ? '회사명' : 'Company', value: u.companyName },
                        { label: lang === 'ko' ? '담당자' : 'Contact', value: u.contactName },
                        { label: lang === 'ko' ? '연락처' : 'Phone', value: u.phone },
                        { label: lang === 'ko' ? '직책' : 'Position', value: u.position },
                        { label: lang === 'ko' ? '회사 규모' : 'Size', value: u.companySize ? `${u.companySize}명` : '' },
                        { label: lang === 'ko' ? '사업자등록번호' : 'Biz No.', value: u.businessNumber },
                        { label: lang === 'ko' ? '신청일' : 'Submitted', value: u.submittedAt ? new Date(u.submittedAt).toLocaleString('ko-KR') : '' },
                      ].map((f, i) => (
                        <div key={i}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 2 }}>{f.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: f.value ? '#333' : '#ccc' }}>{f.value || '-'}</div>
                        </div>
                      ))}
                    </div>
                    {u.purpose && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 4 }}>{lang === 'ko' ? '이용 목적' : 'Purpose'}</div>
                        <div style={{ fontSize: 13, color: '#555', background: '#f9f9f9', padding: 12, borderRadius: 8, lineHeight: 1.6 }}>{u.purpose}</div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {u.status !== 'rejected' && (
                        <button onClick={() => updateStatus(u.userId, 'rejected')}
                          style={{
                            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            border: '1px solid #fca5a5', background: '#fff', color: '#dc2626',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          {lang === 'ko' ? '반려' : 'Reject'}
                        </button>
                      )}
                      {u.status !== 'approved' && (
                        <button onClick={() => updateStatus(u.userId, 'approved')}
                          style={{
                            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            border: 'none', background: '#16a34a', color: '#fff',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          {lang === 'ko' ? '승인' : 'Approve'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
