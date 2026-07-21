import { useState, useEffect, useRef } from 'react'

// 어드민 공고 폼 공용 커스텀 컨트롤 — 네이티브 select/date 대신 자체 UI.
// DateRangePicker와 같은 스타일 언어 (#ff4400 악센트, 팝오버, 알약 버튼).

const ACCENT = '#ff4400'
const TINT = '#FFF1EC'
const LBL = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }
const BTN = {
  width: '100%', textAlign: 'left', fontSize: 13.5, padding: '10px 12px', boxSizing: 'border-box',
  border: '1px solid #E5E8EB', borderRadius: 10, background: '#fff', cursor: 'pointer', color: '#191F28',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
}
const POP = {
  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: '100%',
  background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
  padding: 6, maxHeight: 320, overflowY: 'auto',
}

function useClickOutside(open, setOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open, setOpen])
  return ref
}

// ── 알약 단일선택 (고용형태 등 옵션 2~4개짜리) ──────────────────────────────
export function Chips({ label, value, options, onChange }) {
  return (
    <div>
      {label && <label style={LBL}>{label}</label>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(o => {
          const on = value === o.value
          return (
            <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
              fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '8px 15px',
              border: '1px solid', borderColor: on ? ACCENT : '#E5E8EB',
              background: on ? TINT : '#fff', color: on ? ACCENT : '#4E5968',
            }}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 커스텀 드롭다운 (그룹 지원 + 직접 입력) ─────────────────────────────────
export function Dropdown({ label, value, options = [], groups = null, onChange, allowCustom = false, placeholder = '—', customLabel = '직접 입력…' }) {
  const [open, setOpen] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const ref = useClickOutside(open, setOpen)
  const customRef = useRef(null)
  useEffect(() => { if (customMode) customRef.current?.focus() }, [customMode])

  const flat = groups ? groups.flatMap(g => g.options) : options
  const current = flat.find(o => o.value === value)
  // 목록에 없는 값(직접 입력됐던 값)도 라벨로 표시
  const display = current ? current.label : (value || '')

  const item = (o) => {
    const on = o.value === value
    return (
      <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
        fontSize: 13.5, padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        background: on ? TINT : 'transparent', color: on ? ACCENT : '#191F28', fontWeight: on ? 700 : 500,
      }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#F5F6F8' }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
      >
        {o.label}{on && <span>✓</span>}
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={LBL}>{label}</label>}
      {customMode ? (
        <input
          ref={customRef}
          defaultValue={value || ''}
          onBlur={e => { onChange(e.target.value.trim()); setCustomMode(false) }}
          onKeyDown={e => { if (e.key === 'Enter') { onChange(e.target.value.trim()); setCustomMode(false) } }}
          style={{ width: '100%', fontSize: 13.5, padding: '10px 12px', boxSizing: 'border-box', border: `1px solid ${ACCENT}`, borderRadius: 10, outline: 'none' }}
        />
      ) : (
        <button type="button" onClick={() => setOpen(v => !v)} style={BTN}>
          <span style={{ color: display ? '#191F28' : '#ADB5BD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display || placeholder}</span>
          <span style={{ color: '#ADB5BD', fontSize: 11 }}>▾</span>
        </button>
      )}
      {open && (
        <div style={POP}>
          {groups
            ? groups.map(g => (
                <div key={g.key || g.label}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 10px 4px' }}>{g.label}</div>
                  {g.options.map(item)}
                </div>
              ))
            : options.map(item)}
          {allowCustom && (
            <button type="button" onClick={() => { setOpen(false); setCustomMode(true) }} style={{
              display: 'block', width: '100%', fontSize: 13, padding: '8px 10px', border: 'none', borderTop: '1px solid #F2F4F6',
              borderRadius: 0, cursor: 'pointer', textAlign: 'left', background: 'transparent', color: '#6B7280', fontWeight: 600, marginTop: 4,
            }}>
              {customLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── 단일 날짜 피커 (마감일 등) — 달력 팝오버 + 프리셋 ───────────────────────
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function DatePickerSingle({ label, value, onChange, emptyLabel = '상시 채용', presets = [7, 14, 30] }) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, setOpen)
  const today = new Date()
  const anchor = value ? new Date(value) : today
  const [viewY, setViewY] = useState(anchor.getFullYear())
  const [viewM, setViewM] = useState(anchor.getMonth())
  useEffect(() => {
    if (!open) return
    const a = value ? new Date(value) : new Date()
    setViewY(a.getFullYear()); setViewM(a.getMonth())
  }, [open]) // eslint-disable-line

  const first = new Date(viewY, viewM, 1)
  const startPad = (first.getDay() + 6) % 7
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const todayS = fmt(today)

  const navBtn = { width: 26, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', color: '#4E5968', fontSize: 14, borderRadius: 6 }
  const presetBtn = { fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '5px 11px', border: '1px solid #E5E8EB', background: '#fff', color: '#4E5968' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={LBL}>{label}</label>}
      <button type="button" onClick={() => setOpen(v => !v)} style={BTN}>
        <span style={{ color: value ? '#191F28' : '#ADB5BD' }}>{value || emptyLabel}</span>
        <span style={{ color: '#ADB5BD', fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div style={{ ...POP, width: 252, padding: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" style={{ ...presetBtn, ...(value ? {} : { borderColor: ACCENT, background: TINT, color: ACCENT }) }} onClick={() => { onChange(''); setOpen(false) }}>{emptyLabel}</button>
            {presets.map(d => (
              <button key={d} type="button" style={presetBtn} onClick={() => {
                const t = new Date(); t.setDate(t.getDate() + d); onChange(fmt(t)); setOpen(false)
              }}>+{d}d</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <button type="button" style={navBtn} onClick={() => { const m = viewM - 1; setViewM((m + 12) % 12); if (m < 0) setViewY(viewY - 1) }}>‹</button>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#191F28' }}>{MONTHS_EN[viewM]} {viewY}</div>
            <button type="button" style={navBtn} onClick={() => { const m = viewM + 1; setViewM(m % 12); if (m > 11) setViewY(viewY + 1) }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {WD.map((w, i) => <div key={i} style={{ fontSize: 10.5, fontWeight: 700, color: '#9AA0A6', textAlign: 'center', padding: '2px 0' }}>{w}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const s = `${viewY}-${pad(viewM + 1)}-${pad(d)}`
              const sel = s === value
              const isToday = s === todayS
              return (
                <button key={i} type="button" onClick={() => { onChange(s); setOpen(false) }} style={{
                  width: '100%', aspectRatio: '1', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12.5,
                  fontWeight: sel || isToday ? 700 : 500,
                  background: sel ? ACCENT : 'transparent',
                  color: sel ? '#fff' : isToday ? ACCENT : '#191F28',
                }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#F5F6F8' }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
                >{d}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
