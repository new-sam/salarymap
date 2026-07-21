import { useState } from 'react'
import UserAssetCards from './UserAssetCards'
import { useAdmin } from '../../lib/adminSwr'
import { getSalaryTier, normalizeTrieu } from '../../lib/salaryTiers'

const STATUS = {
  pending:  { ko: '검토 대기', en: 'Pending',  vi: 'Chờ duyệt',   bg: '#D97706' },
  approved: { ko: '승인됨',   en: 'Approved', vi: 'Đã duyệt',    bg: '#059669' },
  rejected: { ko: '반려됨',   en: 'Rejected', vi: 'Đã từ chối',  bg: '#DC2626' },
}

const DOC_LABELS = {
  payslip:    { ko: '급여명세서',      en: 'Payslip',                 vi: 'Phiếu lương' },
  contract:   { ko: '근로계약서',      en: 'Employment contract',     vi: 'Hợp đồng lao động' },
  tax_return: { ko: '원천징수영수증',  en: 'Tax withholding receipt', vi: 'Chứng từ khấu trừ thuế' },
  other:      { ko: '기타',           en: 'Other',                   vi: 'Khác' },
}

export default function VerificationsView({ token, lang }) {
  const vi = lang === 'vi'
  const ko = !vi && lang !== 'en'
  const lk = vi ? 'vi' : ko ? 'ko' : 'en' // {ko,en,vi} 딕셔너리 조회 키
  const L = vi ? {
    needSalary: 'Cần nhập lương tháng (triệu VND) để duyệt.',
    loading: 'Đang tải…', empty: 'Không có yêu cầu', all: 'Tất cả',
    docType: 'Loại giấy tờ', salary: 'Lương tháng', requested: 'Ngày yêu cầu',
    viewDoc: 'Xem giấy tờ chứng minh', salaryPh: 'Lương xác minh', unit: 'triệu VND',
    approve: 'Duyệt', reject: 'Từ chối',
  } : ko ? {
    needSalary: '월급(백만 VND)을 입력해야 승인할 수 있습니다.',
    loading: '불러오는 중…', empty: '요청이 없습니다', all: '전체',
    docType: '서류 종류', salary: '월급', requested: '요청일',
    viewDoc: '증빙 서류 보기', salaryPh: '인증 월급', unit: '백만 VND',
    approve: '승인', reject: '반려',
  } : {
    needSalary: 'Enter the monthly salary (million VND) to approve.',
    loading: 'Loading…', empty: 'No requests', all: 'All',
    docType: 'Document', salary: 'Salary', requested: 'Requested',
    viewDoc: 'View document', salaryPh: 'Verified salary', unit: 'M VND',
    approve: 'Approve', reject: 'Reject',
  }
  const locale = vi ? 'vi-VN' : ko ? 'ko-KR' : 'en-US'
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
        alert(L.needSalary)
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
  const FILTERS = [['pending', STATUS.pending[lk]], ['approved', STATUS.approved[lk]], ['rejected', STATUS.rejected[lk]], ['all', L.all]]

  return (
    <div>
      <UserAssetCards token={token} keys={['verifiedWorkers', 'approvedVerifications']} lang={lang} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={pill(filter === k)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#ADB5BD' }}>{L.loading}</div>
      ) : verifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#ADB5BD', fontSize: 14 }}>{L.empty}</div>
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
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: st.bg, color: '#fff' }}>{st[lk]}</span>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                {[
                  [L.docType, (DOC_LABELS[v.document_type] && DOC_LABELS[v.document_type][lk]) || v.document_type],
                  [L.salary, v.salary_amount ? `${normalizeTrieu(v.salary_amount).toLocaleString()}M VND` : '-'],
                  [L.requested, new Date(v.created_at).toLocaleDateString(locale)],
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
                {L.viewDoc}
              </a>

              {/* Admin Actions */}
              {v.status === 'pending' && (() => {
                const trieu = normalizeTrieu(parseInt(salaryInput[v.id], 10))
                const tier = trieu > 0 ? getSalaryTier(trieu * 1000000) : null
                return (
                <div style={{ borderTop: '1px solid #F2F4F6', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 120 }}>
                      <input type="number" value={salaryInput[v.id] || ''} onChange={e => setSalaryInput(prev => ({ ...prev, [v.id]: e.target.value }))} placeholder={L.salaryPh}
                        style={{ ...inp, padding: '7px 70px 7px 11px', fontWeight: 600 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#ADB5BD' }}>{L.unit}</span>
                    </div>
                    {tier && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, background: tier.grad, color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>→ {ko ? tier.defaultLabel : tier.enLabel}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAction(v.id, 'approved')} disabled={actionLoading === v.id}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: actionLoading === v.id ? 0.5 : 1 }}>{L.approve}</button>
                    <button onClick={() => handleAction(v.id, 'rejected')} disabled={actionLoading === v.id}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff', color: '#DC2626', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: actionLoading === v.id ? 0.5 : 1 }}>{L.reject}</button>
                  </div>
                </div>
                )
              })()}

              {/* Reviewer info */}
              {v.status !== 'pending' && v.reviewed_by && (
                <div style={{ fontSize: 11.5, color: '#ADB5BD', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F2F4F6' }}>
                  {v.reviewed_by} · {v.reviewed_at ? new Date(v.reviewed_at).toLocaleString(locale) : ''}{v.admin_note && ` · ${v.admin_note}`}
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
