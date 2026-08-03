import { useState, useEffect, useRef } from 'react'

// 프로필 폼 공용 드롭다운 — pages/profile.js 에 있던 것을 어학 카드와 공유하려고 옮겼다.
// 옵션은 items([{value,label}]) 또는 options(string[]) 둘 중 하나로 준다.
export default function CustomSelect({ value, options, items, placeholder, onChange, displayValue, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" disabled={disabled} onClick={() => setOpen(v => !v)} style={{
        width: '100%', fontSize: 14, padding: '10px 12px', border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8, background: disabled ? '#f5f5f5' : '#fff', color: value ? '#111' : 'rgba(0,0,0,0.3)',
        fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'border-color .15s', outline: 'none', opacity: disabled ? 0.6 : 1,
        ...(open ? { borderColor: '#ff4400' } : {}),
      }}>
        <span>{displayValue || value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10,
          padding: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', scrollbarWidth: 'none',
        }} className="pselect-dropdown">
          {items
            ? items.map(o => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }} style={{
                display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderRadius: 6,
                background: value === o.value ? 'rgba(255,68,0,0.08)' : 'transparent',
                color: value === o.value ? '#ff4400' : 'rgba(0,0,0,0.6)',
                fontSize: 13, fontWeight: value === o.value ? 600 : 400, cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', transition: 'background .1s',
              }}
                onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                onMouseLeave={e => { if (value !== o.value) e.currentTarget.style.background = 'transparent' }}>
                {o.label}
              </button>
            ))
            : options.map(opt => (
              <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }} style={{
                display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderRadius: 6,
                background: value === opt ? 'rgba(255,68,0,0.08)' : 'transparent',
                color: value === opt ? '#ff4400' : 'rgba(0,0,0,0.6)',
                fontSize: 13, fontWeight: value === opt ? 600 : 400, cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', transition: 'background .1s',
              }}
                onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = 'transparent' }}>
                {opt}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
