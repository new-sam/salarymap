import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import vi from './translations/vi'
import en from './translations/en'
import ko from './translations/ko'

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

export function LanguageSwitcher() {
  const { lang, setLang } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const langs = [
    { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'ko', flag: '🇰🇷', label: '한국어' },
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
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '5px 10px', cursor: 'pointer',
          fontSize: '13px', fontFamily: "'Barlow', sans-serif", color: 'rgba(255,255,255,0.7)',
          transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{current.flag}</span>
        <span style={{ fontSize: '11px', fontWeight: 600 }}>{current.code.toUpperCase()}</span>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginLeft: '2px' }}>{open ? '▴' : '▾'}</span>
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
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{l.flag}</span>
              <span>{l.label}</span>
              {lang === l.code && <span style={{ marginLeft: 'auto', fontSize: '11px' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
