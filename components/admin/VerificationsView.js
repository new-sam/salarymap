import { useState } from 'react'
import UserAssetCards from './UserAssetCards'
import { useAdmin } from '../../lib/adminSwr'
import { getSalaryTier, normalizeTrieu } from '../../lib/salaryTiers'

const STATUS = {
  pending:  { label: '검토 대기', bg: '#D97706' },
  approved: { label: '승인됨',   bg: '#059669' },
  rejected: { label: '반려됨',   bg: '#DC2626' },
}

const DOC_LABELS = {
  payslip: '급여명세서',
  contract: '근로계약서',
  tax_return: '원천징수영수증',
  other: '기타',
}

export default function VerificationsView({ token }) {
  const [filter, setFilter] = useState('pending')
  const [actionLoading, setActionLoading] = useState(null)
  const [salaryInput, setSalaryInput] = useState({}) // per-id, monthly in 백만 VND (triệu)

  const { data, isLoading: loading, mutate } = useAdmin(
    `/api/salary-verification/admin?status=${filter}`,
    token,
    {
      onSuccess: ({ verifications: list }) => {
        // Prefill the salary input with the user-submitted amount, expected in
        // 백만 VND (triệu). normalizeTrieu coerces a raw-VND amount typed by
        // mistake (e.g. 50000000) back into triệu so the prefill — and any
        // approval taken from it — uses the correct unit.
        setSalaryInput(prev => {
          const next = { ...prev }
          list.forEach(v => {
            if (next[v.id] === undefined && v.salary_amount) next[v.id] = String(normalizeTrieu(v.salary_amount))
          })
          return next
        })
      },
    }
  )
  const verifications = data?.verifications || []

  const handleAction = async (id, status) => {
    // Approval requires an admin-entered monthly salary in 백만 VND (triệu). Sent as-is;
    // stored on the verification row in triệu, converted to VND for the badge tier server-side.
    let salaryTrieu = null
    if (status === 'approved') {
      const trieu = normalizeTrieu(parseInt(salaryInput[id], 10))
      if (!trieu || trieu <= 0) {
        alert('월급(백만 VND)을 입력해야 승인할 수 있습니다.')
        return
      }
      salaryTrieu = trieu
    }
    setActionLoading(id)
    try {
      const res = await fetch('/api/salary-verification/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status, admin_note: '', salary_amount: salaryTrieu }),
      })
      if (res.ok) {
        mutate(prev => ({ ...prev, verifications: (prev?.verifications || []).filter(v => v.id !== id) }), false)
      }
    } catch (e) {
      console.error(e)
    }
    setActionLoading(null)
  }

  const pill = (on) => ({ fontSize: 12.5, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '6px 14px', border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB', background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968' })
  const inp = { width: '100%', padding: '7px 11px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const FILTERS = [['pending', '검토 대기'], ['approved', '승인됨'], ['rejected', '반려됨'], ['all', '전체']]

  return (
    <div>
      <UserAssetCards token={token} keys={['verifiedWorkers', 'approvedVerifications']} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={pill(filter === k)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#ADB5BD' }}>불러오는 중…</div>
      ) : verifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#ADB5BD', fontSize: 14 }}>요청이 없습니다</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
          {verifications.map(v => {
            const st = STATUS[v.status] || STATUS.pending
            return (
            <div key={v.id} style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 12, padding: '13px 15px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  {v.profile?.photo_url ? (
                    <img src={v.profile.photo_url} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F2F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ADB5BD" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#191F28' }}>{v.profile?.full_name || 'Unknown'}</div>
                    <div style={{ fontSize: 11.5, color: '#8B95A1', marginTop: 1 }}>{v.profile?.verified_company_name || '-'}</div>
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: st.bg, color: '#fff' }}>{st.label}</span>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                {[
                  ['서류 종류', DOC_LABELS[v.document_type] || v.document_type],
                  ['월급', v.salary_amount ? `${normalizeTrieu(v.salary_amount).toLocaleString()}M VND` : '-'],
                  ['요청일', new Date(v.created_at).toLocaleDateString('ko-KR')],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12.5 }}>
                    <span style={{ color: '#8B95A1' }}>{label}</span>
                    <span style={{ color: '#191F28', fontWeight: 600, textAlign: 'right' }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Document Link */}
              <a href={v.document_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff', color: '#4E5968', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginBottom: v.status === 'pending' ? 12 : 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                증빙 서류 보기
              </a>

              {/* Admin Actions */}
              {v.status === 'pending' && (() => {
                const trieu = normalizeTrieu(parseInt(salaryInput[v.id], 10))
                const tier = trieu > 0 ? getSalaryTier(trieu * 1000000) : null
                return (
                <div style={{ borderTop: '1px solid #F2F4F6', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 120 }}>
                      <input type="number" value={salaryInput[v.id] || ''} onChange={e => setSalaryInput(prev => ({ ...prev, [v.id]: e.target.value }))} placeholder="인증 월급"
                        style={{ ...inp, padding: '7px 70px 7px 11px', fontWeight: 600 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#ADB5BD' }}>백만 VND</span>
                    </div>
                    {tier && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, background: tier.grad, color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>→ {tier.defaultLabel}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAction(v.id, 'approved')} disabled={actionLoading === v.id}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: actionLoading === v.id ? 0.5 : 1 }}>승인</button>
                    <button onClick={() => handleAction(v.id, 'rejected')} disabled={actionLoading === v.id}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff', color: '#DC2626', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: actionLoading === v.id ? 0.5 : 1 }}>반려</button>
                  </div>
                </div>
                )
              })()}

              {/* Reviewer info */}
              {v.status !== 'pending' && v.reviewed_by && (
                <div style={{ fontSize: 11.5, color: '#ADB5BD', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F2F4F6' }}>
                  {v.reviewed_by} · {v.reviewed_at ? new Date(v.reviewed_at).toLocaleString('ko-KR') : ''}{v.admin_note && ` · ${v.admin_note}`}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
