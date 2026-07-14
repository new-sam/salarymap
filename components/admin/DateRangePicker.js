import { useState, useEffect, useRef } from 'react'

// App Store Connect 스타일 날짜 범위 피커 (알약 버튼 + 팝오버: 사전설정/일/주/월/기간)
// 활성색은 어드민 브랜드 주황(#ff4400)으로 통일. value={from,to}(YYYY-MM-DD), onChange(from,to).

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DATA_START = '2026-04-20'
const ACCENT = '#ff4400'
const TINT = '#FFF1EC'

const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const labelShort = (s) => { const d = parse(s); return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}` }
const weekRange = (d) => { const mon = addDays(d, -((d.getDay() + 6) % 7)); return [mon, addDays(mon, 6)] }

const TABS = [['preset', '사전 설정'], ['day', '일'], ['week', '주'], ['month', '월'], ['custom', '기간']]

export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('preset')
  const ref = useRef(null)
  const today = new Date()

  const anchor = value?.to ? parse(value.to) : today
  const [viewY, setViewY] = useState(anchor.getFullYear())
  const [viewM, setViewM] = useState(anchor.getMonth())
  const [draft, setDraft] = useState({ from: value?.from || '', to: value?.to || '' })

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  useEffect(() => {
    if (!open) return
    setDraft({ from: value?.from || '', to: value?.to || '' })
    const a = value?.to ? parse(value.to) : today
    setViewY(a.getFullYear()); setViewM(a.getMonth())
    setTab('preset')
  }, [open]) // eslint-disable-line

  const apply = (from, to) => { onChange(from, to); setOpen(false) }

  const toS = fmt(today)
  const lastN = (n) => [fmt(addDays(today, -(n - 1))), toS]
  const [lwS, lwE] = weekRange(addDays(today, -7))
  const presets = [
    { label: '지난 7일', range: lastN(7) },
    { label: '지난 30일', range: lastN(30) },
    { label: '지난 90일', range: lastN(90) },
    { label: '지난주', range: [fmt(lwS), fmt(lwE)] },
    { label: '지난달', range: [fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)), fmt(new Date(today.getFullYear(), today.getMonth(), 0))] },
    { label: '올해 초부터 현재까지', range: [fmt(new Date(today.getFullYear(), 0, 1)), toS] },
    { label: '누적 기간', range: [DATA_START, toS] },
  ]

  const curLabel = value?.from ? `${labelShort(value.from)} ~ ${labelShort(value.to)}` : '기간 선택'

  // 월 캘린더 셀 (월요일 시작, 앞뒤 달 채움)
  function monthCells(y, m) {
    const first = new Date(y, m, 1)
    const off = (first.getDay() + 6) % 7
    const cells = []
    for (let i = 0; i < off; i++) cells.push(addDays(first, i - off))
    const dim = new Date(y, m + 1, 0).getDate()
    for (let d = 1; d <= dim; d++) cells.push(new Date(y, m, d))
    while (cells.length % 7 !== 0) cells.push(addDays(cells[cells.length - 1], 1))
    return cells
  }

  const stepMonth = (delta) => {
    let m = viewM + delta, y = viewY
    if (m < 0) { m = 11; y-- } else if (m > 11) { m = 0; y++ }
    setViewM(m); setViewY(y)
  }

  function onDayClick(d) {
    const s = fmt(d)
    if (tab === 'day') return apply(s, s)
    if (tab === 'week') { const [a, b] = weekRange(d); return apply(fmt(a), fmt(b)) }
    // custom
    if (!draft.from || (draft.from && draft.to)) setDraft({ from: s, to: '' })
    else if (s < draft.from) setDraft({ from: s, to: '' })
    else setDraft({ from: draft.from, to: s })
  }

  const S = {
    pop: { position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 360, maxWidth: '92vw', background: '#fff', border: '1px solid #E5E8EB', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.14)', padding: 12 },
    tabs: { display: 'flex', gap: 2, background: '#F2F4F6', borderRadius: 9, padding: 3, marginBottom: 12 },
    tab: (on) => ({ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: on ? '#fff' : 'transparent', color: on ? ACCENT : '#86868b', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }),
    navRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 12px' },
    navBtn: { border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#4E5968', padding: '2px 8px', borderRadius: 6 },
    navTitle: { fontSize: 13.5, fontWeight: 700, color: '#191F28' },
    wd: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 },
    wdCell: { textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#9AA0A6', padding: '4px 0' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' },
  }

  function dayCell(d, key) {
    const s = fmt(d)
    const inMonth = d.getMonth() === viewM
    const isToday = s === fmt(today)
    let bg = 'transparent', color = inMonth ? '#191F28' : '#C7CDD4', radius = 8, fw = 500
    if (tab === 'custom') {
      const a = draft.from, b = draft.to
      const isEnd = s === a || s === b
      const inRange = a && b && s > a && s < b
      if (isEnd) { bg = ACCENT; color = '#fff'; fw = 700 }
      else if (inRange) { bg = TINT; color = ACCENT; radius = 0 }
    } else if (tab === 'day' && value?.from === value?.to && s === value?.from) {
      bg = ACCENT; color = '#fff'; fw = 700
    }
    return (
      <div key={key} onClick={() => onDayClick(d)}
        style={{ textAlign: 'center', fontSize: 13, fontWeight: fw, color, cursor: 'pointer', padding: '8px 0', borderRadius: radius, background: bg, position: 'relative' }}
        onMouseEnter={e => { if (bg === 'transparent') e.currentTarget.style.background = '#F2F4F6' }}
        onMouseLeave={e => { if (bg === 'transparent') e.currentTarget.style.background = 'transparent' }}>
        {d.getDate()}
        {isToday && bg === 'transparent' && <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: ACCENT }} />}
      </div>
    )
  }

  function Calendar() {
    const cells = monthCells(viewY, viewM)
    return (
      <>
        <div style={S.navRow}>
          <button style={S.navBtn} onClick={() => stepMonth(-1)}>‹</button>
          <span style={S.navTitle}>{viewY}년 {MONTHS_EN[viewM]}</span>
          <button style={S.navBtn} onClick={() => stepMonth(1)}>›</button>
        </div>
        <div style={S.wd}>{WD.map((w, i) => <div key={i} style={S.wdCell}>{w}</div>)}</div>
        <div style={S.grid}>{cells.map((d, i) => dayCell(d, i))}</div>
      </>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, border: '1px solid #E5E8EB', background: '#fff', color: '#191F28', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <span>{curLabel}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" stroke="#86868b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={S.pop}>
          <div style={S.tabs}>
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={S.tab(tab === k)}>{label}</button>
            ))}
          </div>

          {tab === 'preset' && (
            <div>
              {presets.map((p) => {
                const on = value?.from === p.range[0] && value?.to === p.range[1]
                return (
                  <div key={p.label} onClick={() => apply(p.range[0], p.range[1])}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: on ? TINT : 'transparent' }}
                    onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#F8F9FA' }}
                    onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ width: 14, flexShrink: 0, color: ACCENT, fontWeight: 800, fontSize: 12 }}>{on ? '✓' : ''}</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? ACCENT : '#191F28' }}>{p.label}</span>
                    <span style={{ fontSize: 12.5, color: '#9AA0A6', fontVariantNumeric: 'tabular-nums' }}>{labelShort(p.range[0])} ~ {labelShort(p.range[1])}</span>
                  </div>
                )
              })}
            </div>
          )}

          {(tab === 'day' || tab === 'week') && <Calendar />}

          {tab === 'week' && (
            <div style={{ fontSize: 11.5, color: '#9AA0A6', textAlign: 'center', paddingTop: 8 }}>날짜를 누르면 그 주(월~일)가 선택됩니다</div>
          )}

          {tab === 'month' && (
            <div>
              <div style={S.navRow}>
                <button style={S.navBtn} onClick={() => setViewY(viewY - 1)}>‹</button>
                <span style={S.navTitle}>{viewY}년</span>
                <button style={S.navBtn} onClick={() => setViewY(viewY + 1)}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {MONTHS_EN.map((mn, m) => {
                  const start = fmt(new Date(viewY, m, 1)), end = fmt(new Date(viewY, m + 1, 0))
                  const on = value?.from === start && value?.to === end
                  return (
                    <div key={mn} onClick={() => apply(start, end)}
                      style={{ padding: '12px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', border: `1px solid ${on ? ACCENT : 'transparent'}`, background: on ? TINT : 'transparent' }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#F8F9FA' }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: on ? ACCENT : '#191F28', marginBottom: 8 }}>{mn}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, justifyItems: 'center' }}>
                        {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#DDE1E6' }} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'custom' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[['시작 날짜', draft.from], ['종료 날짜', draft.to]].map(([lab, v]) => (
                  <div key={lab} style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 600, marginBottom: 5 }}>{lab}</div>
                    <div style={{ fontSize: 13, padding: '9px 11px', border: '1px solid #E5E8EB', borderRadius: 8, color: v ? '#191F28' : '#ADB5BD', fontVariantNumeric: 'tabular-nums' }}>{v ? v.replace(/-/g, '. ') : 'YYYY. MM. DD'}</div>
                  </div>
                ))}
              </div>
              <Calendar />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid #E5E8EB', background: '#F8F9FA', color: '#4E5968', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>취소</button>
                <button disabled={!draft.from || !draft.to} onClick={() => apply(draft.from, draft.to)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: draft.from && draft.to ? ACCENT : '#E5E8EB', color: '#fff', fontWeight: 700, fontSize: 13, cursor: draft.from && draft.to ? 'pointer' : 'default' }}>적용</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
