import { useState, useEffect } from 'react'

export default function NextStepSheet({ role, experience, percentile }) {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState('choose')
  const [intent, setIntent] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(t)
  }, [])

  function handleOption(opt) {
    if (opt === 'done') {
      setState('done')
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fyi_intent', opt)
      }
      setIntent(opt)
      setState('connect')
    }
  }

  const copy = {
    open: {
      emoji: '🎯',
      title: 'Our headhunter will reach out to you directly.',
      sub: "We personally match you with companies paying 20\u201340% more \u2014 no job board, no spam. Just a real person finding your next move.",
    },
    selective: {
      emoji: '🔍',
      title: 'We only send offers worth your time.',
      sub: "Our headhunter reviews your profile first, then reaches out only when there's a role that genuinely pays more and fits your stack.",
    },
  }

  const c = copy[intent] || copy.open

  if (!visible) return null

  return (
    <>
      <div
        onClick={() => state === 'choose' && setVisible(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 40,
        }}
      />

      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        padding: '16px 20px 40px',
        zIndex: 50,
        boxShadow: '0 -12px 40px rgba(0,0,0,0.3)',
        animation: 'sheetSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        maxWidth: '480px',
        margin: '0 auto',
        fontFamily: "'Barlow', 'Inter', sans-serif",
      }}>
        <style>{`
          @keyframes sheetSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @keyframes sheetFadeSlide {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div style={{
          width: 36, height: 4,
          background: '#e0e0e0',
          borderRadius: 2,
          margin: '0 auto 20px',
        }} />

        {state === 'choose' && (
          <div style={{ animation: 'sheetFadeSlide 0.3s ease' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#f7f4ff',
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 18,
            }}>
              <div style={{
                width: 52, height: 52, flexShrink: 0,
                background: '#7c6aff',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26,
              }}>🧑‍💻</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, marginBottom: 3 }}>
                  You're earning <span style={{ color: '#7c6aff' }}>way above average.</span>
                </div>
                <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>
                  Companies are actively looking for engineers like you.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div
                onClick={() => handleOption('open')}
                style={{
                  background: '#fff4f0',
                  border: '1.5px solid #ff4400',
                  borderRadius: 18,
                  padding: '14px 8px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 8 }}>🚀</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ff4400', lineHeight: 1.3, marginBottom: 3 }}>
                  Yes, find me<br/>better offers
                </div>
                <div style={{ fontSize: 9, color: '#bbb', lineHeight: 1.3 }}>
                  I'm open now
                </div>
              </div>

              <div
                onClick={() => handleOption('selective')}
                style={{
                  background: '#fffbf0',
                  border: '1.5px solid #ffb300',
                  borderRadius: 18,
                  padding: '14px 8px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 8 }}>👀</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e09000', lineHeight: 1.3, marginBottom: 3 }}>
                  Only if it's<br/>the right fit
                </div>
                <div style={{ fontSize: 9, color: '#bbb', lineHeight: 1.3 }}>
                  Good match only
                </div>
              </div>

              <div
                onClick={() => handleOption('done')}
                style={{
                  background: '#f7f7f7',
                  border: '1.5px solid #e8e8e8',
                  borderRadius: 18,
                  padding: '14px 8px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 8 }}>😌</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', lineHeight: 1.3, marginBottom: 3 }}>
                  All good here
                </div>
                <div style={{ fontSize: 9, color: '#bbb', lineHeight: 1.3 }}>
                  Happy where I am
                </div>
              </div>
            </div>
          </div>
        )}

        {state === 'connect' && (
          <div style={{ animation: 'sheetFadeSlide 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>{c.emoji}</div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: '#1a1a1a',
                lineHeight: 1.35, marginBottom: 8,
              }}>
                {c.title}
              </div>
              <div style={{
                fontSize: 12, color: '#999', lineHeight: 1.6,
                padding: '0 8px',
              }}>
                {c.sub}
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/api/auth/google'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '14px',
                borderRadius: 14, border: '1.5px solid #e8e8e8',
                background: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: '#1a1a1a',
                marginBottom: 10, fontFamily: 'inherit',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Start with Google
            </button>

            <button
              onClick={() => window.location.href = '/api/auth/linkedin'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '14px',
                borderRadius: 14, border: '1.5px solid #0077b5',
                background: '#0077b5', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: '#fff',
                marginBottom: 14, fontFamily: 'inherit',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Start with LinkedIn
            </button>

            <button
              onClick={() => setState('choose')}
              style={{
                width: '100%', padding: 8,
                background: 'transparent', border: 'none',
                fontSize: 12, color: '#ccc', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← Back
            </button>
          </div>
        )}

        {state === 'done' && (
          <div style={{ animation: 'sheetFadeSlide 0.3s ease', textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>😌</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
              Glad you're happy there!
            </div>
            <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, marginBottom: 20 }}>
              If things change, FYI will always be here.
            </div>
            <button
              onClick={() => setVisible(false)}
              style={{
                width: '100%', padding: 13,
                borderRadius: 14, border: '1.5px solid #e8e8e8',
                background: '#f7f7f7', fontSize: 13,
                fontWeight: 600, color: '#555', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  )
}
