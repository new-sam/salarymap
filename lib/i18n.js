import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import vi from './translations/vi'
import en from './translations/en'
import ko from './translations/ko'
import Icon from '../components/Icon'

const translations = { vi, en, ko }
const STORAGE_KEY = 'fyi_lang'

function defaultT(key, params) {
  let str = vi[key] ?? key
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    })
  }
  return str
}

const I18nContext = createContext({ lang: 'vi', t: defaultT, setLang: () => {} })

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('vi')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && translations[saved]) setLangState(saved)
  }, [])

  // Keep <html lang="..."> in sync with the active locale so language-scoped
  // CSS (특히 베트남어 전용 폰트) can target the right document state.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l) => {
    if (translations[l]) {
      setLangState(l)
      localStorage.setItem(STORAGE_KEY, l)
    }
  }, [])

  const t = useCallback((key, params) => {
    let str = translations[lang]?.[key] ?? translations.vi[key] ?? key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      })
    }
    return str
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT() {
  return useContext(I18nContext)
}

// Korean-only hook for HR pages
export function useKo() {
  const t = useCallback((key, params) => {
    let str = ko[key] ?? key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      })
    }
    return str
  }, [])
  return { t, lang: 'ko' }
}

export function LanguageSwitcher() {
  const { lang, setLang } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const langs = [
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'en', label: 'English' },
    { code: 'ko', label: '한국어' },
  ]
  const current = langs.find(l => l.code === lang) || langs[0]

  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Language"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px', padding: '0 8px', height: '28px', cursor: 'pointer',
          fontFamily: "'Barlow', sans-serif", color: 'rgba(229,231,235,0.85)',
          transition: 'border-color .15s, color .15s, background .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(229,231,235,0.85)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.7px' }}>{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          zIndex: 600, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px', padding: '4px', minWidth: '150px',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
        }}>
          {langs.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '9px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: lang === l.code ? 'rgba(255,96,0,0.12)' : 'transparent',
                color: lang === l.code ? '#ff6000' : 'rgba(255,255,255,0.6)',
                fontSize: '13px', fontWeight: lang === l.code ? 700 : 500,
                fontFamily: "'Barlow', sans-serif", textAlign: 'left',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (lang !== l.code) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (lang !== l.code) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ flex: 1 }}>{l.label}</span>
              {lang === l.code && <span style={{ marginLeft: 'auto' }}><Icon name="check" size={11} color="currentColor" /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
