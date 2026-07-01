import { useState, useMemo } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 콜드메일 영업 대상/진행 관리. 발송은 외부에서 하고 여기선 대상·상태만 추적한다.
// 단일 테이블(cold_outreach) CRUD — 컬럼은 차차 바뀔 수 있어 뼈대만.
const STATUS = {
  todo:    { ko: '발송 전', en: 'To send', bg: '#6B7280' },
  sent:    { ko: '발송',    en: 'Sent',    bg: '#2563EB' },
  replied: { ko: '회신',    en: 'Replied', bg: '#7C3AED' },
  meeting: { ko: '미팅',    en: 'Meeting', bg: '#D97706' },
  won:     { ko: '계약',    en: 'Won',     bg: '#059669' },
  lost:    { ko: '거절',    en: 'Lost',    bg: '#DC2626' },
}
const STATUS_ORDER = ['todo', 'sent', 'replied', 'meeting', 'won', 'lost']

const EMPTY = { company_name: '', contact_name: '', email: '', industry: '', campaign: '', status: 'todo', sent_at: '', memo: '' }

// 코참 포맷 "ENGLISH ( 한글 )" → { en, ko }. 끝 괄호가 중첩될 수 있어 균형괄호로 매칭.
function splitName(s) {
  s = (s || '').trim()
  if (!s) return { en: '', ko: '' }
  if (s.endsWith(')')) {
    let depth = 0
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === ')') depth++
      else if (s[i] === '(') {
        depth--
        if (depth === 0) {
          const before = s.slice(0, i).trim()
          const inner = s.slice(i + 1, -1).trim()
          if (/[가-힣]/.test(inner)) return { en: before, ko: inner }
          return { en: before || inner, ko: '' }
        }
      }
    }
  }
  return /[가-힣]/.test(s) ? { en: '', ko: s } : { en: s, ko: '' }
}

export default function OutreachView({ token, lang, owner = 'wsj' }) {
  const ko = lang !== 'en'
  const L = ko ? {
    loading: '불러오는 중…', empty: '등록된 대상이 없습니다', all: '전체', allCampaigns: '전체 캠페인',
    add: '+ 대상 추가', save: '저장', cancel: '취소', edit: '편집', del: '삭제',
    delConfirm: '이 대상을 삭제할까요?', search: '회사·담당자·이메일 검색',
    company: '회사', contact: '담당자', email: '이메일', industry: '업종',
    campaign: '캠페인/라운드', status: '상태', sentAt: '발송일', memo: '메모', actions: '',
    needCompany: '회사명을 입력하세요.',
  } : {
    loading: 'Loading…', empty: 'No leads yet', all: 'All', allCampaigns: 'All campaigns',
    add: '+ Add lead', save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete',
    delConfirm: 'Delete this lead?', search: 'Search company/contact/email',
    company: 'Company', contact: 'Contact', email: 'Email', industry: 'Industry',
    campaign: 'Campaign', status: 'Status', sentAt: 'Sent', memo: 'Memo', actions: '',
    needCompany: 'Enter a company name.',
  }

  const { data, isLoading: loading, mutate } = useAdmin('/api/admin/outreach', token)
  const rows = (data || []).filter(r => (r.owner || 'wsj') === owner)

  const [statusFilter, setStatusFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  const campaigns = useMemo(
    () => [...new Set(rows.map(r => r.campaign).filter(Boolean))].sort(),
    [rows]
  )
  const counts = useMemo(() => {
    const c = {}
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1
    return c
  }, [rows])
  const sentPlus = ['sent', 'replied', 'meeting', 'won', 'lost'].reduce((s, k) => s + (counts[k] || 0), 0)
  const repliedPlus = ['replied', 'meeting', 'won', 'lost'].reduce((s, k) => s + (counts[k] || 0), 0)
  const replyRate = sentPlus ? Math.round((repliedPlus / sentPlus) * 100) : 0
  const openedCount = rows.filter(r => r.opened_at).length
  const openRate = sentPlus ? Math.round((openedCount / sentPlus) * 100) : 0

  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (campaignFilter && r.campaign !== campaignFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = `${r.company_name} ${r.contact_name || ''} ${r.email || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const reqHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const clean = (f) => ({ ...f, sent_at: f.sent_at || null })

  async function addLead() {
    if (!addForm.company_name.trim()) { alert(L.needCompany); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/outreach', { method: 'POST', headers: reqHeaders, body: JSON.stringify({ ...clean(addForm), owner }) })
      if (res.ok) {
        const created = await res.json()
        mutate(prev => [created, ...(prev || [])], false)
        setAddForm(EMPTY); setShowAdd(false)
      }
    } finally { setBusy(false) }
  }

  async function saveEdit() {
    if (!editForm.company_name.trim()) { alert(L.needCompany); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/outreach', { method: 'PUT', headers: reqHeaders, body: JSON.stringify({ id: editingId, ...clean(editForm) }) })
      if (res.ok) {
        const updated = await res.json()
        mutate(prev => (prev || []).map(r => r.id === editingId ? updated : r), false)
        setEditingId(null)
      }
    } finally { setBusy(false) }
  }

  // 파이프라인에서 가장 잦은 동작 — 상태만 즉시 변경
  async function quickStatus(row, status) {
    mutate(prev => (prev || []).map(r => r.id === row.id ? { ...r, status } : r), false)
    await fetch('/api/admin/outreach', { method: 'PUT', headers: reqHeaders, body: JSON.stringify({ id: row.id, status }) })
  }

  async function removeLead(id) {
    if (!confirm(L.delConfirm)) return
    mutate(prev => (prev || []).filter(r => r.id !== id), false)
    await fetch('/api/admin/outreach', { method: 'DELETE', headers: reqHeaders, body: JSON.stringify({ id }) })
  }

  const inp = { width: '100%', padding: '7px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const pill = (on) => ({ fontSize: 12.5, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '6px 14px', border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB', background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968' })

  // 폼(추가/편집 공용)
  const formFields = (form, set) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
      <input style={inp} placeholder={`${L.company} *`} value={form.company_name} onChange={e => set(f => ({ ...f, company_name: e.target.value }))} />
      <input style={inp} placeholder={L.contact} value={form.contact_name || ''} onChange={e => set(f => ({ ...f, contact_name: e.target.value }))} />
      <input style={inp} placeholder={L.email} value={form.email || ''} onChange={e => set(f => ({ ...f, email: e.target.value }))} />
      <input style={inp} placeholder={L.industry} value={form.industry || ''} onChange={e => set(f => ({ ...f, industry: e.target.value }))} />
      <input style={inp} placeholder={L.campaign} value={form.campaign || ''} onChange={e => set(f => ({ ...f, campaign: e.target.value }))} list="outreach-campaigns" />
      <select style={inp} value={form.status} onChange={e => set(f => ({ ...f, status: e.target.value }))}>
        {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS[s][ko ? 'ko' : 'en']}</option>)}
      </select>
      <input style={inp} type="date" value={form.sent_at || ''} onChange={e => set(f => ({ ...f, sent_at: e.target.value }))} />
      <input style={{ ...inp, gridColumn: '1 / -1' }} placeholder={L.memo} value={form.memo || ''} onChange={e => set(f => ({ ...f, memo: e.target.value }))} />
    </div>
  )

  const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#8B95A1', fontSize: 11.5, whiteSpace: 'nowrap', borderBottom: '1px solid #EEF0F2' }
  const td = { padding: '8px 10px', fontSize: 12.5, color: '#191F28', borderBottom: '1px solid #F2F4F6', verticalAlign: 'top' }

  // 회사/담당자: EN 위 · KO 아래로 한 셀에 표시 (가로 폭 절약)
  const nameCell = (raw, bold) => {
    const n = splitName(raw)
    const main = n.en || n.ko || '-'
    const sub = n.en ? n.ko : ''
    return (
      <td style={{ ...td, fontWeight: bold ? 600 : 400 }}>
        <div style={{ wordBreak: 'keep-all' }}>{main}</div>
        {sub && <div style={{ fontWeight: 400, color: '#8B95A1', fontSize: 11, marginTop: 2, wordBreak: 'keep-all' }}>{sub}</div>}
      </td>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
      <datalist id="outreach-campaigns">{campaigns.map(c => <option key={c} value={c} />)}</datalist>

      {/* 퍼널 지표 (발송 → 오픈 → 회신) */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 0' }}>
          {[
            { label: ko ? '발송' : 'Sent', big: `${sentPlus}`, sub: ko ? '총 발송' : 'emails', color: '#191F28', note: '' },
            { label: ko ? '오픈율' : 'Open rate', big: `${openRate}%`, sub: `${openedCount}/${sentPlus}`, color: '#2563EB', note: ko ? '애플MPP로 과대·참고용' : 'approx' },
            { label: ko ? '회신율' : 'Reply rate', big: `${replyRate}%`, sub: `${repliedPlus}/${sentPlus}`, color: '#7C3AED', note: '' },
          ].map((m, i) => (
            <div key={i} style={{ flex: '1 1 150px', minWidth: 140, background: '#fff', border: '1px solid #EEF0F2', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: m.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{m.big}</div>
              <div style={{ fontSize: 11, color: '#ADB5BD', marginTop: 6 }}>{m.sub}{m.note ? ` · ${m.note}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* 상태별 요약 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {STATUS_ORDER.map(s => (
          <div key={s} style={{ flex: '1 1 100px', minWidth: 90, background: '#fff', border: '1px solid #EEF0F2', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS[s].bg }} />{STATUS[s][ko ? 'ko' : 'en']}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#191F28' }}>{counts[s] || 0}</div>
          </div>
        ))}
      </div>

      {/* 필터 + 추가 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={pill(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>{L.all}</button>
        {STATUS_ORDER.map(s => (
          <button key={s} style={pill(statusFilter === s)} onClick={() => setStatusFilter(s)}>{STATUS[s][ko ? 'ko' : 'en']}</button>
        ))}
        <div style={{ flex: 1 }} />
        {campaigns.length > 0 && (
          <select style={{ ...inp, width: 'auto' }} value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
            <option value="">{L.allCampaigns}</option>
            {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input style={{ ...inp, width: 200 }} placeholder={L.search} value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ff4400', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{L.add}</button>
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <div style={{ background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          {formFields(addForm, setAddForm)}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => { setShowAdd(false); setAddForm(EMPTY) }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff', color: '#4E5968', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{L.cancel}</button>
            <button onClick={addLead} disabled={busy} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#191F28', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>{L.save}</button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#ADB5BD' }}>{L.loading}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#ADB5BD', fontSize: 14 }}>{L.empty}</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '19%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th}>{L.company}</th>
                <th style={th}>{L.contact}</th>
                <th style={th}>{L.email}</th>
                <th style={th}>{L.industry}</th>
                <th style={th}>{L.status}</th>
                <th style={th}>{L.sentAt}</th>
                <th style={th}>{L.memo}</th>
                <th style={{ ...th, textAlign: 'right' }}>{L.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => editingId === r.id ? (
                <tr key={r.id}>
                  <td style={{ ...td, padding: 10 }} colSpan={8}>
                    {formFields(editForm, setEditForm)}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button onClick={() => setEditingId(null)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff', color: '#4E5968', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{L.cancel}</button>
                      <button onClick={saveEdit} disabled={busy} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#191F28', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>{L.save}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  {nameCell(r.company_name, true)}
                  {nameCell(r.contact_name, false)}
                  <td style={{ ...td, wordBreak: 'break-all' }}>{r.email ? <a href={`mailto:${r.email}`} style={{ color: '#2563EB', textDecoration: 'none' }}>{r.email}</a> : '-'}</td>
                  <td style={{ ...td, whiteSpace: 'normal', wordBreak: 'keep-all' }}>{r.industry || '-'}</td>
                  <td style={td}>
                    <select value={r.status} onChange={e => quickStatus(r, e.target.value)}
                      style={{ border: 'none', cursor: 'pointer', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#fff', background: (STATUS[r.status] || STATUS.todo).bg, appearance: 'none', WebkitAppearance: 'none', textAlign: 'center' }}>
                      {STATUS_ORDER.map(s => <option key={s} value={s} style={{ background: '#fff', color: '#191F28' }}>{STATUS[s][ko ? 'ko' : 'en']}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div>{r.sent_at || '-'}</div>
                    {r.open_count > 0 && <div style={{ fontSize: 11, color: '#2563EB', marginTop: 2 }} title={r.opened_at ? new Date(r.opened_at).toLocaleString() : ''}>👁 {r.open_count}</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#8B95A1', fontSize: 11 }}>{r.memo || '-'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => { setEditingId(r.id); setEditForm({ ...EMPTY, ...r, sent_at: r.sent_at || '' }) }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E8EB', background: '#fff', color: '#4E5968', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', marginRight: 6 }}>{L.edit}</button>
                    <button onClick={() => removeLead(r.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FBD5D5', background: '#fff', color: '#DC2626', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>{L.del}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
