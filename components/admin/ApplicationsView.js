import { useState, useEffect, useRef } from 'react'
import { STATUS_OPTIONS } from '../../constants/dashboard'
import { useAdmin } from '../../lib/adminSwr'

// 상태 색 — 솔리드 채도 + 흰 글씨(또렷·구분). 기본(지원완료)은 차분한 슬레이트, 액션 상태만 컬러.
const STATUS_STYLE = {
  pending:   { bg: '#64748B', color: '#fff' },
  applied:   { bg: '#64748B', color: '#fff' },
  viewed:    { bg: '#D97706', color: '#fff' },
  reviewing: { bg: '#2563EB', color: '#fff' },
  accepted:  { bg: '#059669', color: '#fff' },
  rejected:  { bg: '#DC2626', color: '#fff' },
}
const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE.applied

// 지원 상태 라벨 (토글 언어). pending = 초기/미확인 상태.
const STATUS_LABEL = {
  pending:   { ko: '지원 완료',  en: 'Applied' }, // DB 초기 기본값 — applied 와 동일 취급
  applied:   { ko: '지원 완료',  en: 'Applied' },
  viewed:    { ko: '열람',      en: 'Viewed' },
  reviewing: { ko: '검토중',    en: 'Reviewing' },
  accepted:  { ko: '합격',      en: 'Accepted' },
  rejected:  { ko: '불합격',    en: 'Rejected' },
}
const statusLabel = (s, lang) => STATUS_LABEL[s]?.[lang === 'ko' ? 'ko' : 'en'] || s

// 유입 플랫폼 배지: app=앱 / web=웹 / null=미상(기록 전 행).
function PlatformBadge({ platform }) {
  const map = {
    app: { label: '앱', bg: '#1F2937', color: '#fff' },      // 다크 슬레이트
    web: { label: '웹', bg: '#EDEFF2', color: '#4E5968' },   // 라이트 그레이
  }
  const s = map[platform]
  if (!s) return <span style={{ color: '#C7CDD4', fontSize: 11 }}>미상</span>
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// 상태 드롭다운 (자체 디자인). 표가 가로 스크롤 안이라 팝업은 fixed 위치로 띄워 잘림 방지.
function StatusDropdown({ value, onChange, lang }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const cur = statusStyle(value)

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!btnRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 5, minWidth: 80, padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer', background: cur.bg, color: cur.color, whiteSpace: 'nowrap' }}>
        {statusLabel(value || 'applied', lang)}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" stroke={cur.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000, minWidth: 140, background: '#fff', border: '1px solid #E5E8EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4 }}>
          {STATUS_OPTIONS.map(s => {
            const c = statusStyle(s)
            const on = s === value
            return (
              <div key={s} onClick={() => { onChange(s); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: on ? '#F8F9FA' : 'transparent' }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#F8F9FA' }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.bg, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: on ? 700 : 500, color: '#191F28' }}>{statusLabel(s, lang)}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function ApplicationsView({ token, t, dateRange, lang = 'ko' }) {
  const [platformFilter, setPlatformFilter] = useState('all') // all, app, web

  const params = new URLSearchParams()
  if (dateRange?.from) params.set('from', dateRange.from)
  if (dateRange?.to) params.set('to', dateRange.to)
  const { data: apps, isLoading: loading, mutate } = useAdmin(`/api/admin/applications?${params}`, token)

  async function updateStatus(id, status) {
    await fetch('/api/admin/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    })
    mutate()
  }

  function downloadCsv() {
    if (!apps || apps.length === 0) return
    const headers = ['Name', 'Email', 'Source', 'Job', 'Company', 'Position', 'YoE', 'Skills', 'Headline', 'Status', 'Resume URL', 'Applied']
    const rows = visible.map(a => [
      a.user_name || a.applicant_name || '',
      a.user_email || a.applicant_email || '',
      a.platform || '',
      a.job_title || a.jobs?.title || '',
      a.job_company || a.jobs?.company || '',
      a.applicant_role || '',
      a.applicant_experience || '',
      a.parsed_skills || '',
      a.parsed_headline || '',
      a.status || '',
      a.resume_url || '',
      a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `applicants-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.appsLoading}</div>
  if (!apps || apps.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.appsEmpty}</div>

  const visible = apps.filter(a => platformFilter === 'all' || (a.platform || null) === platformFilter)
  const appCount = apps.filter(a => a.platform === 'app').length
  const webCount = apps.filter(a => a.platform === 'web').length

  const pillStyle = (on) => ({
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '6px 12px',
    border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
    background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968', whiteSpace: 'nowrap',
  })
  const th = { padding: '11px 12px', textAlign: 'left', fontWeight: 700, color: '#8B95A1', fontSize: 11.5, whiteSpace: 'nowrap' }
  const td = { padding: '11px 12px', verticalAlign: 'middle' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#191F28' }}>{t.appsTitle}</h3>
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            {t.appsTotal} <strong style={{ color: '#191F28' }}>{visible.length}</strong>
            <span style={{ margin: '0 6px', color: '#DDE1E6' }}>·</span>
            앱 <strong style={{ color: '#191F28' }}>{appCount}</strong>
            <span style={{ margin: '0 4px', color: '#DDE1E6' }}>·</span>
            웹 <strong style={{ color: '#191F28' }}>{webCount}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ key: 'all', label: '전체' }, { key: 'app', label: '앱' }, { key: 'web', label: '웹' }].map(f => (
              <button key={f.key} onClick={() => setPlatformFilter(f.key)} style={pillStyle(platformFilter === f.key)}>{f.label}</button>
            ))}
          </div>
          <button onClick={downloadCsv}
            style={{ padding: '8px 13px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: '#4E5968', cursor: 'pointer' }}>
            CSV
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EEF0F2', background: '#FAFBFC' }}>
                <th style={th}>{t.appsApplicant}</th>
                <th style={th}>{t.appsJob}</th>
                <th style={th}>유입</th>
                <th style={th}>직무</th>
                <th style={th}>경력</th>
                <th style={th}>{t.appsStatus}</th>
                <th style={th}>{t.appsDate}</th>
                <th style={th}>{t.appsResume}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const pos = a.applicant_role
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #F2F4F6' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#191F28' }}>{a.user_name || '-'}</div>
                      {a.user_email && <div style={{ fontSize: 11, color: '#ADB5BD', marginTop: 1 }}>{a.user_email}</div>}
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 500, color: '#191F28' }}>{a.job_title || a.jobs?.title || '-'}</div>
                      <div style={{ fontSize: 11.5, color: '#8B95A1', marginTop: 1 }}>{a.job_company || a.jobs?.company || '-'}</div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}><PlatformBadge platform={a.platform} /></td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {pos ? <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#F2F4F6', color: '#4E5968', whiteSpace: 'nowrap' }}>{pos}</span> : <span style={{ color: '#C7CDD4' }}>-</span>}
                    </td>
                    <td style={{ ...td, color: '#4E5968', whiteSpace: 'nowrap' }}>{a.applicant_experience || '-'}</td>
                    <td style={td}>
                      <StatusDropdown value={a.status} onChange={(s) => updateStatus(a.id, s)} lang={lang} />
                    </td>
                    <td style={{ ...td, color: '#868E96', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td style={td}>
                      {a.resume_url ? (
                        <a href={a.resume_url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff4400', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>PDF</a>
                      ) : <span style={{ color: '#C7CDD4' }}>-</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
