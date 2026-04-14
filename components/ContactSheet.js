import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ContactSheet({ user, onClose }) {
  const [step, setStep] = useState('form') // 'form' | 'saving' | 'confirmed'
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [linkedinError, setLinkedinError] = useState(null)
  const [consentChecked, setConsentChecked] = useState(false)

  const validateLinkedin = (url) => {
    if (!url.trim()) return true // optional
    return /^https?:\/\/(www\.)?linkedin\.com\/in\/.+/i.test(url.trim())
  }

  const handleSubmit = async () => {
    if (!consentChecked) return
    if (linkedinUrl.trim() && !validateLinkedin(linkedinUrl)) {
      setLinkedinError('Please enter a valid LinkedIn URL (e.g. linkedin.com/in/name)')
      return
    }
    setStep('saving')
    try {
      await supabase
        .from('user_profiles')
        .update({
          linkedin_url: linkedinUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      setStep('confirmed')
    } catch {
      setStep('form')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => step === 'confirmed' && onClose()}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 400,
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: '#fff',
        borderRadius: '28px 28px 0 0',
        padding: '28px 0 0',
        zIndex: 500,
        boxShadow: '0 -20px 80px rgba(0,0,0,0.4)',
        animation: 'sheetSlideUp 0.5s cubic-bezier(0.22,0.9,0.36,1)',
        maxHeight: '85vh',
        overflowY: 'auto',
        fontFamily: "'Barlow', 'Inter', sans-serif",
      }}>
        <style>{`
          @keyframes sheetSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @keyframes sheetFadeSlide {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Handle */}
        <div style={{
          width: 56, height: 5,
          background: '#ddd',
          borderRadius: 3,
          margin: '0 auto 28px',
        }} />

        <div style={{ padding: '0 24px 40px', maxWidth: '600px', margin: '0 auto' }}>

          {/* FORM STEP */}
          {(step === 'form' || step === 'saving') && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease' }}>

              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
                <h3 style={{
                  fontSize: 24, fontWeight: 800, color: '#1a1a1a',
                  lineHeight: 1.35, margin: '0 0 10px',
                }}>
                  Almost there — one last thing.
                </h3>
                <p style={{
                  fontSize: 15, color: '#888', lineHeight: 1.6, margin: 0,
                }}>
                  So our headhunter can reach you about higher-paying roles.
                </p>
              </div>

              {/* Email (read-only) */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#aaa',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 8, fontFamily: "'Geist Mono', monospace",
                }}>
                  Email
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 0',
                  borderBottom: '1.5px solid rgba(12,12,11,0.14)',
                  fontSize: 14, color: '#1a1a1a',
                  fontFamily: "'Barlow', sans-serif",
                }}>
                  <span>{user.email}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="8" fill="#4ade80" opacity="0.15"/>
                    <path d="M5 8l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* LinkedIn URL */}
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#aaa',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 8, fontFamily: "'Geist Mono', monospace",
                }}>
                  LinkedIn Profile <span style={{ color: '#ccc', fontWeight: 400 }}>(optional)</span>
                </div>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => { setLinkedinUrl(e.target.value); setLinkedinError(null); }}
                  onBlur={() => {
                    if (linkedinUrl.trim() && !validateLinkedin(linkedinUrl)) {
                      setLinkedinError('Please enter a valid LinkedIn URL (e.g. linkedin.com/in/name)')
                    }
                  }}
                  placeholder="https://linkedin.com/in/yourname"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1.5px solid ${linkedinError ? '#f87171' : 'rgba(12,12,11,0.14)'}`,
                    color: '#1a1a1a',
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 14,
                    padding: '10px 0',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => {
                    if (!linkedinError) e.target.style.borderBottomColor = '#ff6000'
                  }}
                  onBlurCapture={(e) => {
                    if (!linkedinError) e.target.style.borderBottomColor = 'rgba(12,12,11,0.14)'
                  }}
                />
                {linkedinError && (
                  <div style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>
                    {linkedinError}
                  </div>
                )}
              </div>

              {/* Consent checkbox */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                cursor: 'pointer', userSelect: 'none',
                marginBottom: 28,
              }}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  style={{
                    width: 16, height: 16, accentColor: '#ff6000',
                    cursor: 'pointer', flexShrink: 0, marginTop: 2,
                  }}
                />
                <span style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
                  I agree to be contacted by a headhunter about relevant opportunities
                </span>
              </label>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!consentChecked || step === 'saving'}
                style={{
                  width: '100%', padding: '20px',
                  borderRadius: 16, border: 'none',
                  background: '#ff6000',
                  cursor: consentChecked && step !== 'saving' ? 'pointer' : 'not-allowed',
                  opacity: consentChecked && step !== 'saving' ? 1 : 0.4,
                  fontSize: 18, fontWeight: 800, color: '#fff',
                  marginBottom: 12, fontFamily: 'inherit',
                  boxShadow: consentChecked ? '0 6px 24px rgba(255,68,0,0.3)' : 'none',
                  transition: 'opacity 0.2s, transform 0.1s',
                }}
                onMouseDown={e => consentChecked && (e.currentTarget.style.transform = 'scale(0.98)')}
                onMouseUp={e => e.currentTarget.style.transform = ''}
              >
                {step === 'saving' ? 'Saving...' : 'Connect me'}
              </button>

              {/* Skip */}
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: 14,
                  background: 'transparent', border: 'none',
                  fontSize: 14, color: '#bbb', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Skip for now
              </button>
            </div>
          )}

          {/* CONFIRMED STEP */}
          {step === 'confirmed' && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease', textAlign: 'center', padding: '20px 0 12px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(74,222,128,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px',
              }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M9 16l5 5 9-9" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>
                You're all set.
              </div>
              <div style={{ fontSize: 16, color: '#999', lineHeight: 1.65, marginBottom: 32 }}>
                Our headhunter will review your profile and<br/>reach out within a few days.
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: 18,
                  borderRadius: 16, border: '2px solid #e8e8e8',
                  background: '#f7f7f7', fontSize: 17,
                  fontWeight: 700, color: '#555', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Close
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
