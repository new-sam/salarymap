import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']

const PERSONAL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.kr', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'naver.com', 'hanmail.net', 'daum.net', 'kakao.com',
  'nate.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'mail.com', 'aol.com', 'zoho.com', 'yandex.com', 'qq.com', '163.com', '126.com',
]

function isPersonalEmail(email) {
  if (!email) return true
  const domain = email.split('@')[1]?.toLowerCase()
  return !domain || PERSONAL_DOMAINS.includes(domain)
}

export default function HROnboarding() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [bizVerify, setBizVerify] = useState(null) // null | 'loading' | { valid, message }
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    position: '',
    companySize: '',
    purpose: '',
    businessNumber: '',
  })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/hr/login'); return }
      setUser(session.user)

      const res = await fetch('/api/hr/onboarding', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const { hr } = await res.json()
        if (!hr) { router.replace('/hr/login'); return }
        if (hr.status === 'approved') { router.replace('/hr'); return }
        setStatus(hr.status)
        if (hr.company_name) setForm(f => ({ ...f, companyName: hr.company_name }))
        if (hr.contact_name) setForm(f => ({ ...f, contactName: hr.contact_name }))
        if (hr.phone) setForm(f => ({ ...f, phone: hr.phone }))
        if (hr.position) setForm(f => ({ ...f, position: hr.position }))
        if (hr.company_size) setForm(f => ({ ...f, companySize: hr.company_size }))
        if (hr.purpose) setForm(f => ({ ...f, purpose: hr.purpose }))
        if (hr.business_number) setForm(f => ({ ...f, businessNumber: hr.business_number }))
      }
    })
  }, [])

  const personal = user ? isPersonalEmail(user.email) : false
  const emailDomain = user?.email?.split('@')[1] || ''

  const bizRaw = form.businessNumber.replace(/[^0-9]/g, '')
  const bizComplete = bizRaw.length === 10
  const bizVerified = bizVerify && bizVerify !== 'loading' && bizVerify.valid

  const canSubmit = form.companyName && form.contactName && form.phone
    && (!personal || bizVerified)

  const handleVerifyBiz = async () => {
    if (!bizComplete) return
    setBizVerify('loading')
    try {
      const res = await fetch('/api/hr/verify-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessNumber: form.businessNumber }),
      })
      const data = await res.json()
      setBizVerify(data)
    } catch {
      setBizVerify({ valid: false, message: '조회 중 오류가 발생했습니다.' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/hr/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    })
    if (res.ok) setStatus('submitted')
    setSubmitting(false)
  }

  if (!user || status === null) return null

  const isSubmitted = status === 'submitted'
  const isRejected = status === 'rejected'

  return (
    <>
      <Head><title>HR Onboarding - FYI</title></Head>
      <style>{`
        .onb { min-height: 100vh; background: #f8f8f8; font-family: 'Barlow', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
        .onb-card { max-width: 520px; width: 100%; background: #fff; border-radius: 20px; padding: 48px 40px; box-shadow: 0 2px 20px rgba(0,0,0,0.04); }
        .onb-logo { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #111; margin-bottom: 32px; text-decoration: none; }
        .onb-logo img { width: 24px; height: 24px; }
        .onb-logo span { color: #ff6000; }
        .onb-title { font-size: 24px; font-weight: 900; color: #111; margin: 0 0 8px; }
        .onb-desc { font-size: 14px; color: #888; margin: 0 0 32px; line-height: 1.6; }
        .onb-field { margin-bottom: 20px; }
        .onb-label { display: block; font-size: 12px; font-weight: 700; color: #555; margin-bottom: 6px; }
        .onb-label .req { color: #ff6000; margin-left: 2px; }
        .onb-input { width: 100%; padding: 12px 14px; border: 1.5px solid #e5e5e5; border-radius: 10px; font-size: 14px; font-family: inherit; transition: border-color .2s; background: #fff; box-sizing: border-box; }
        .onb-input:focus { outline: none; border-color: #ff6000; }
        .onb-input.filled { border-color: #ccc; background: #fafafa; }
        .onb-sizes { display: flex; gap: 8px; flex-wrap: wrap; }
        .onb-size { padding: 8px 16px; border: 1.5px solid #e5e5e5; border-radius: 8px; font-size: 13px; font-weight: 600; color: #888; cursor: pointer; transition: all .2s; background: #fff; font-family: inherit; }
        .onb-size.active { border-color: #ff6000; color: #ff6000; background: #fff7ed; }
        .onb-textarea { width: 100%; padding: 12px 14px; border: 1.5px solid #e5e5e5; border-radius: 10px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 80px; transition: border-color .2s; box-sizing: border-box; }
        .onb-textarea:focus { outline: none; border-color: #ff6000; }
        .onb-submit { width: 100%; padding: 14px; border-radius: 12px; border: none; background: #ff6000; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .2s; margin-top: 8px; }
        .onb-submit:hover { background: #e55500; }
        .onb-submit:disabled { background: #ccc; cursor: not-allowed; }

        .onb-email-badge { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 10px; margin-bottom: 24px; font-size: 13px; }
        .onb-email-badge.corp { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .onb-email-badge.personal { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
        .onb-email-badge .icon { width: 20px; height: 20px; flex-shrink: 0; }

        .onb-biz-hint { font-size: 11px; color: #999; margin-top: 4px; }

        .onb-pending { text-align: center; padding: 20px 0; }
        .onb-pending-icon { width: 64px; height: 64px; border-radius: 50%; background: #fff7ed; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .onb-pending-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
        .onb-pending-desc { font-size: 14px; color: #999; line-height: 1.7; margin: 0 0 24px; }
        .onb-pending-status { display: inline-block; padding: 6px 16px; border-radius: 100px; font-size: 12px; font-weight: 700; }

        .onb-rejected { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
        .onb-rejected-title { font-size: 13px; font-weight: 700; color: #dc2626; margin: 0 0 4px; }
        .onb-rejected-desc { font-size: 12px; color: #999; margin: 0; line-height: 1.5; }
      `}</style>

      <div className="onb">
        <div className="onb-card">
          <a href="/hr/home" className="onb-logo">
            <img src="/logo.png" alt="FYI" />
            FYI <span>for HR</span>
          </a>

          {isSubmitted ? (
            <div className="onb-pending">
              <div className="onb-pending-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <h2 className="onb-pending-title">승인 대기 중입니다</h2>
              <p className="onb-pending-desc">
                입력하신 정보를 확인 중입니다.<br />
                승인이 완료되면 HR 서비스를 이용하실 수 있습니다.<br />
                보통 1 영업일 이내에 처리됩니다.
              </p>
              <span className="onb-pending-status" style={{ background: '#fff7ed', color: '#ff6000' }}>
                승인 대기중
              </span>
            </div>
          ) : (
            <>
              <h1 className="onb-title">HR 서비스 신청</h1>
              <p className="onb-desc">
                서비스 이용을 위해 기본 정보를 입력해 주세요.<br />
                검토 후 승인이 완료되면 인재 검색, 채용 관리 등 모든 기능을 이용할 수 있습니다.
              </p>

              {/* Email domain badge */}
              {personal ? (
                <div className="onb-email-badge personal">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <strong>{user.email}</strong> 은 개인 이메일입니다.<br />
                    <span style={{ fontSize: 12, color: '#b91c1c' }}>기업 인증을 위해 사업자등록번호를 입력해 주세요.</span>
                  </div>
                </div>
              ) : (
                <div className="onb-email-badge corp">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div>
                    <strong>{user.email}</strong><br />
                    <span style={{ fontSize: 12, color: '#15803d' }}>회사 이메일(@{emailDomain})이 확인되었습니다.</span>
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="onb-rejected">
                  <p className="onb-rejected-title">승인이 반려되었습니다</p>
                  <p className="onb-rejected-desc">정보를 수정하여 다시 신청해 주세요.</p>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="onb-field">
                  <label className="onb-label">회사명 <span className="req">*</span></label>
                  <input className={`onb-input${form.companyName ? ' filled' : ''}`} placeholder="예: 주식회사 FYI"
                    value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
                </div>

                {/* Business number - required for personal email */}
                {personal && (
                  <div className="onb-field">
                    <label className="onb-label">사업자등록번호 <span className="req">*</span></label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className={`onb-input${form.businessNumber ? ' filled' : ''}`}
                        placeholder="000-00-00000"
                        style={{ flex: 1 }}
                        value={form.businessNumber}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                          const formatted = raw.length > 5
                            ? `${raw.slice(0,3)}-${raw.slice(3,5)}-${raw.slice(5)}`
                            : raw.length > 3
                              ? `${raw.slice(0,3)}-${raw.slice(3)}`
                              : raw
                          setForm(f => ({ ...f, businessNumber: formatted }))
                          setBizVerify(null)
                        }} />
                      <button type="button" onClick={handleVerifyBiz}
                        disabled={!bizComplete || bizVerify === 'loading'}
                        style={{
                          padding: '0 20px', borderRadius: 10, border: 'none',
                          background: bizComplete ? '#111' : '#e5e5e5',
                          color: bizComplete ? '#fff' : '#bbb',
                          fontSize: 13, fontWeight: 700, cursor: bizComplete ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .2s',
                        }}>
                        {bizVerify === 'loading' ? '조회중...' : '인증'}
                      </button>
                    </div>
                    {bizVerify && bizVerify !== 'loading' && (
                      <div style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: bizVerify.valid ? '#f0fdf4' : '#fef2f2',
                        color: bizVerify.valid ? '#166534' : '#991b1b',
                        border: `1px solid ${bizVerify.valid ? '#bbf7d0' : '#fecaca'}`,
                      }}>
                        {bizVerify.valid ? '✓' : '✕'} {bizVerify.message}
                      </div>
                    )}
                    {!bizVerify && <div className="onb-biz-hint">개인 이메일 사용 시 국세청 인증이 필요합니다</div>}
                  </div>
                )}

                <div className="onb-field">
                  <label className="onb-label">담당자 이름 <span className="req">*</span></label>
                  <input className={`onb-input${form.contactName ? ' filled' : ''}`} placeholder="홍길동"
                    value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
                </div>

                <div className="onb-field">
                  <label className="onb-label">연락처 <span className="req">*</span></label>
                  <input className={`onb-input${form.phone ? ' filled' : ''}`} placeholder="010-1234-5678" type="tel"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>

                <div className="onb-field">
                  <label className="onb-label">직책</label>
                  <input className={`onb-input${form.position ? ' filled' : ''}`} placeholder="예: HR 매니저"
                    value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                </div>

                <div className="onb-field">
                  <label className="onb-label">회사 규모</label>
                  <div className="onb-sizes">
                    {COMPANY_SIZES.map(s => (
                      <button type="button" key={s} className={`onb-size${form.companySize === s ? ' active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, companySize: s }))}>
                        {s}명
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onb-field">
                  <label className="onb-label">이용 목적</label>
                  <textarea className="onb-textarea" placeholder="예: 베트남 현지 개발자 채용을 위해 이용하려 합니다."
                    value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
                </div>

                <button type="submit" className="onb-submit" disabled={submitting || !canSubmit}>
                  {submitting ? '제출 중...' : isRejected ? '다시 신청하기' : '신청하기'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
