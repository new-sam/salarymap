import { useState, useEffect, useRef } from 'react'
import { isRawVndMistake } from '../../lib/salaryTiers'

// 프로필 > 재직 인증 탭 — 회사 이메일 인증 + 급여 인증 + 인증 이력.
// cvStep/cvCompany는 헤더 인증칩과 공유되므로 부모(profile.js)가 소유.
export default function EmploymentTab({ token, t, active, cvStep, setCvStep, cvCompany, setCvCompany }) {
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [cvMsg, setCvMsg] = useState(null) // { ok, key }
  const [cvLoading, setCvLoading] = useState(false)
  const [verifications, setVerifications] = useState([])
  const [verificationsLoading, setVerificationsLoading] = useState(false)
  const [verifyForm, setVerifyForm] = useState({ document_type: 'payslip', salary_amount: '' })
  const [verifyUploading, setVerifyUploading] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState(null)
  const salaryDocRef = useRef(null)

  useEffect(() => {
    if (!active || !token) return
    setVerificationsLoading(true)
    fetch('/api/salary-verification', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setVerifications(d.verifications || []))
      .catch(() => {})
      .finally(() => setVerificationsLoading(false))
    // Current company-verification status
    fetch('/api/company-verification', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.verified) { setCvStep('verified'); setCvCompany(d.company_name) } })
      .catch(() => {})
  }, [active, token])

  const handleSendCompanyCode = async () => {
    setCvLoading(true)
    setCvMsg(null)
    try {
      const res = await fetch('/api/company-verification/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: companyEmail.trim() }),
      })
      const d = await res.json()
      if (res.ok) {
        setCvStep('sent')
        setCvMsg({ ok: true, text: t('profile.cv.sent') })
      } else {
        setCvMsg({ ok: false, text: d.message || t('profile.cv.sendFailed') })
      }
    } catch (e) {
      setCvMsg({ ok: false, text: t('profile.cv.sendFailed') })
    }
    setCvLoading(false)
  }

  const handleVerifyCompanyCode = async () => {
    setCvLoading(true)
    setCvMsg(null)
    try {
      const res = await fetch('/api/company-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: companyEmail.trim(), code: companyCode.trim() }),
      })
      const d = await res.json()
      if (res.ok) {
        setCvStep('verified')
        setCvCompany(d.company_name)
        setCvMsg(null)
      } else {
        setCvMsg({ ok: false, text: d.message || t('profile.cv.verifyFailed') })
      }
    } catch (e) {
      setCvMsg({ ok: false, text: t('profile.cv.verifyFailed') })
    }
    setCvLoading(false)
  }

  const handleVerifyUpload = async () => {
    const file = salaryDocRef.current?.files?.[0]
    if (!file) return
    if (isRawVndMistake(verifyForm.salary_amount)) {
      alert(t('profile.employment.salaryUnitError'))
      return
    }
    setVerifyUploading(true)
    setVerifyMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', verifyForm.document_type)
    if (verifyForm.salary_amount) fd.append('salary_amount', String(parseInt(verifyForm.salary_amount)))
    try {
      const res = await fetch('/api/salary-verification/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) {
        const { verification } = await res.json()
        setVerifications(prev => [verification, ...prev])
        setVerifyMsg(t('profile.employment.success'))
        salaryDocRef.current.value = ''
        setVerifyForm({ document_type: 'payslip', salary_amount: '' })
        setTimeout(() => setVerifyMsg(null), 3000)
      }
    } catch (e) {}
    setVerifyUploading(false)
  }

  return (<>
    {/* Company email verification — work-email ownership grants a verified-company badge */}
    <div className="pcard">
      <div className="pcard-h">{t('profile.cv.title')}</div>
      {cvStep === 'verified' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#0a7d4b" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" stroke="none" /><path d="M8 12.5l2.5 2.5L16 9.5" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0a7d4b' }}>{t('profile.cv.verified', { company: cvCompany || '' })}</span>
        </div>
      ) : (<>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
          {t('profile.cv.desc')}
        </div>
        <div className="pfield">
          <div className="pfield-label">{t('profile.cv.emailLabel')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="pinput" type="email" value={companyEmail}
              disabled={cvStep === 'sent'}
              onChange={e => setCompanyEmail(e.target.value)}
              placeholder="you@company.com" style={{ flex: 1 }} />
            <button type="button" onClick={handleSendCompanyCode}
              disabled={cvLoading || !companyEmail.trim()}
              style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: '#ff4400', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: (cvLoading || !companyEmail.trim()) ? 0.5 : 1 }}>
              {cvStep === 'sent' ? t('profile.cv.resend') : t('profile.cv.sendCode')}
            </button>
          </div>
        </div>
        {cvStep === 'sent' && (
          <div className="pfield">
            <div className="pfield-label">{t('profile.cv.codeLabel')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="pinput" type="text" inputMode="numeric" maxLength={6} value={companyCode}
                onChange={e => setCompanyCode(e.target.value.replace(/\D/g, ''))}
                placeholder={t('profile.cv.codePh')} style={{ flex: 1, letterSpacing: 4 }} />
              <button type="button" onClick={handleVerifyCompanyCode}
                disabled={cvLoading || companyCode.length !== 6}
                style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: (cvLoading || companyCode.length !== 6) ? 0.5 : 1 }}>
                {t('profile.cv.verify')}
              </button>
            </div>
          </div>
        )}
        {cvMsg && (
          <div className="pmsg" style={cvMsg.ok
            ? { background: 'rgba(34,197,94,0.08)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }
            : { background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
            {cvMsg.text}
          </div>
        )}
      </>)}
    </div>

    <div className="pcard">
      <div className="pcard-h">{t('profile.employment.title')}</div>
      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
        {t('profile.employment.desc')}
      </div>

      {/* Document Type */}
      <div className="pfield">
        <div className="pfield-label">{t('profile.employment.docType')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['payslip', 'contract', 'tax_return', 'other'].map(dt => (
            <button key={dt} type="button"
              className={`psignal-btn${verifyForm.document_type === dt ? ' on' : ''}`}
              style={{ minWidth: 'auto', flex: 'none', padding: '8px 14px' }}
              onClick={() => setVerifyForm(prev => ({ ...prev, document_type: dt }))}>
              {t(`profile.employment.docType.${dt}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Salary Amount */}
      <div className="pfield">
        <div className="pfield-label">{t('profile.employment.salary')}</div>
        <input className="pinput" type="number" value={verifyForm.salary_amount}
          onChange={e => setVerifyForm(prev => ({ ...prev, salary_amount: e.target.value }))}
          placeholder={t('profile.employment.salaryPh')} />
      </div>

      {/* File Upload */}
      <div className="pfield">
        <div className="pfield-label">{t('profile.employment.upload')}</div>
        <input ref={salaryDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }} />
        <button type="button" className="presume-upload-btn" onClick={() => salaryDocRef.current?.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {t('profile.employment.upload')}
        </button>
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 6 }}>{t('profile.employment.uploadHint')}</div>
      </div>

      {verifyMsg && <div className="pmsg" style={{ background: 'rgba(34,197,94,0.08)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>{verifyMsg}</div>}

      <button type="button" onClick={handleVerifyUpload} disabled={verifyUploading}
        style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#ff4400', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: verifyUploading ? 0.5 : 1 }}>
        {verifyUploading ? t('profile.employment.submitting') : t('profile.employment.submit')}
      </button>
    </div>

    {/* Verification History */}
    <div className="pcard">
      <div className="pcard-h">{t('profile.employment.history')}</div>
      {verificationsLoading ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>Loading...</div>
      ) : verifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>{t('profile.employment.noHistory')}</div>
      ) : (
        <div>
          {verifications.map(v => (
            <div key={v.id} style={{ padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                  {t(`profile.employment.docType.${v.document_type}`)}
                  {v.salary_amount ? ` — ${v.salary_amount.toLocaleString()} ${t('salary.unitMonthly')}` : ''}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 2 }}>
                  {new Date(v.created_at).toLocaleDateString()}
                </div>
                {v.admin_note && (
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 4, fontStyle: 'italic' }}>{v.admin_note}</div>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                ...(v.status === 'pending' ? { background: 'rgba(245,158,11,0.1)', color: '#d97706' }
                  : v.status === 'approved' ? { background: 'rgba(34,197,94,0.1)', color: '#16a34a' }
                  : { background: 'rgba(239,68,68,0.1)', color: '#dc2626' })
              }}>
                {t(`profile.employment.status.${v.status}`)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </>)
}
