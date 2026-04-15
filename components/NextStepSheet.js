import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function NextStepSheet({ role, experience, percentile, topCompanies }) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState('cta') // 'cta' | 'auth' | 'done'

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  const companyNames = (topCompanies || []).slice(0, 3).map(c => c.name)
  const companyText = companyNames.length > 0
    ? companyNames.join(', ')
    : 'top companies in Vietnam'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => step === 'done' && setVisible(false)}
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

          {/* ═══ STEP: CTA ═══ */}
          {step === 'cta' && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease' }}>

              {/* Headline */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
                <h3 style={{
                  fontSize: 26, fontWeight: 800, color: '#1a1a1a',
                  lineHeight: 1.35, margin: '0 0 12px',
                }}>
                  These companies pay more<br/>for your exact role.
                </h3>
                <p style={{
                  fontSize: 16, color: '#777', lineHeight: 1.65,
                  margin: 0, maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto',
                }}>
                  You just saw that <strong style={{ color: '#1a1a1a' }}>{companyText}</strong> pay
                  more for <strong style={{ color: '#1a1a1a' }}>{role}</strong> engineers.
                  Our headhunter can personally introduce you — no job boards, no spam.
                </p>
              </div>

              {/* What happens */}
              <div style={{
                background: '#f8f8f8', borderRadius: 18, padding: '22px 24px', marginBottom: 28,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  How it works
                </div>
                {[
                  { icon: '1️⃣', text: 'Sign in so our headhunter can reach you' },
                  { icon: '2️⃣', text: 'They review your profile & find matching roles' },
                  { icon: '3️⃣', text: 'You get introduced only to companies paying more' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '8px 0',
                  }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 15, color: '#444', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') localStorage.setItem('fyi_intent', 'open')
                  setStep('auth')
                }}
                style={{
                  width: '100%', padding: '20px',
                  borderRadius: 16, border: 'none',
                  background: '#ff6000', cursor: 'pointer',
                  fontSize: 18, fontWeight: 800, color: '#fff',
                  marginBottom: 12, fontFamily: 'inherit',
                  boxShadow: '0 6px 24px rgba(255,68,0,0.3)',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = ''}
              >
                Yes — connect me with the headhunter
              </button>

              <button
                onClick={() => setStep('done')}
                style={{
                  width: '100%', padding: 14,
                  background: 'transparent', border: 'none',
                  fontSize: 14, color: '#bbb', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                No thanks, I'm happy where I am
              </button>
            </div>
          )}

          {/* ═══ STEP: AUTH ═══ */}
          {step === 'auth' && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease' }}>

              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
                <h3 style={{
                  fontSize: 24, fontWeight: 800, color: '#1a1a1a',
                  lineHeight: 1.35, margin: '0 0 10px',
                }}>
                  Sign in so we can reach you
                </h3>
                <p style={{
                  fontSize: 15, color: '#888', lineHeight: 1.6, margin: 0,
                }}>
                  We only use this to contact you about matching roles. Nothing else.
                </p>
              </div>

              <button
                onClick={async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } }); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
                  width: '100%', padding: '18px',
                  borderRadius: 16, border: '2px solid #e8e8e8',
                  background: '#fff', cursor: 'pointer',
                  fontSize: 18, fontWeight: 700, color: '#1a1a1a',
                  marginBottom: 14, fontFamily: 'inherit',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={async () => { await supabase.auth.signInWithOAuth({ provider: 'linkedin_oidc', options: { redirectTo: window.location.origin + '/auth/callback', scopes: 'openid profile email' } }); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
                  width: '100%', padding: '18px',
                  borderRadius: 16, border: '2px solid #0077b5',
                  background: '#0077b5', cursor: 'pointer',
                  fontSize: 18, fontWeight: 700, color: '#fff',
                  marginBottom: 18, fontFamily: 'inherit',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Continue with LinkedIn
              </button>

              <button
                onClick={() => setStep('cta')}
                style={{
                  width: '100%', padding: 12,
                  background: 'transparent', border: 'none',
                  fontSize: 14, color: '#bbb', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ← Back
              </button>
            </div>
          )}

          {/* ═══ STEP: DONE ═══ */}
          {step === 'done' && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease', textAlign: 'center', padding: '20px 0 12px' }}>
              <div style={{ fontSize: 64, marginBottom: 18 }}>👋</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>
                No worries!
              </div>
              <div style={{ fontSize: 16, color: '#999', lineHeight: 1.65, marginBottom: 32 }}>
                Your salary data is saved. If you ever want to explore,<br/>FYI will always be here.
              </div>
              <button
                onClick={() => setVisible(false)}
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
