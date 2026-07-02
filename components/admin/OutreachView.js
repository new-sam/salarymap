import { useState, useMemo } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 콜드메일 영업 대상/진행 관리. 발송은 외부에서 하고 여기선 대상·상태만 추적한다.
// 단일 테이블(cold_outreach) CRUD — 컬럼은 차차 바뀔 수 있어 뼈대만.
const STATUS = {
  todo:    { ko: '발송 전', en: 'To send', bg: '#6B7280' },
  sent:    { ko: '발송',    en: 'Sent',    bg: '#2563EB' },
  replied: { ko: '회신',    en: 'Replied', bg: '#ff4400' },
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
  const [selected, setSelected] = useState(() => new Set())
  const [sendModal, setSendModal] = useState(null) // [{id,company,email,subject,body}]
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectMode, setSelectMode] = useState(false)

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
  const openedCount = rows.filter(r => r.opened_at && r.status !== 'todo').length
  const openRate = sentPlus ? Math.min(100, Math.round((openedCount / sentPlus) * 100)) : 0

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

  // 선택 + 발송 모달
  const toggleSel = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(prev => {
    const allSel = filtered.length > 0 && filtered.every(r => prev.has(r.id))
    return allSel ? new Set() : new Set(filtered.map(r => r.id))
  })
  async function openSend() {
    const items = rows.filter(r => selected.has(r.id)).map(r => {
      const c = splitName(r.company_name)
      const round = (r.send_count || 0) + 1
      const useExisting = round === 1 && !!r.email_body   // 1차인데 이미 초안 있으면 재사용, 2차+는 팔로업 새로 생성
      return { id: r.id, company: c.ko || c.en || r.company_name, email: r.email, round,
        subject: useExisting ? (r.email_subject || '') : '', body: useExisting ? r.email_body : '' }
    })
    setSendModal(items)
    const round1 = items.filter(x => x.round === 1 && !x.body.trim()).map(x => x.id)
    const round2 = items.filter(x => x.round >= 2).map(x => x.id)
    if (!round1.length && !round2.length) return
    setGenerating(true)
    try {
      const genFor = async (idList, round) => {
        if (!idList.length) return
        const res = await fetch('/api/admin/outreach-generate', { method: 'POST', headers: reqHeaders, body: JSON.stringify({ ids: idList, owner, round }) })
        const { drafts } = await res.json()
        const map = Object.fromEntries((drafts || []).filter(d => d.subject).map(d => [d.id, d]))
        setSendModal(prev => prev && prev.map(x => map[x.id] ? { ...x, subject: map[x.id].subject, body: map[x.id].body } : x))
        if (round === 1) mutate(prev => (prev || []).map(r => map[r.id] ? { ...r, email_subject: map[r.id].subject, email_body: map[r.id].body } : r), false)
      }
      await Promise.all([genFor(round1, 1), genFor(round2, 2)])
    } finally { setGenerating(false) }
  }
  async function doSend() {
    const items = sendModal.filter(x => x.subject.trim() && x.body.trim())
    if (!items.length) { alert(ko ? '발송할 초안이 없습니다. (제목/본문 필요)' : 'Nothing to send.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/admin/outreach-send', { method: 'POST', headers: reqHeaders,
        body: JSON.stringify({ owner, items: items.map(x => ({ id: x.id, subject: x.subject, body: x.body })) }) })
      const { results } = await res.json()
      const okIds = new Set((results || []).filter(r => r.ok).map(r => r.id))
      const fails = (results || []).filter(r => !r.ok)
      mutate(prev => (prev || []).map(r => okIds.has(r.id)
        ? { ...r, status: 'sent', sent_at: new Date().toISOString().slice(0, 10),
            email_subject: sendModal.find(x => x.id === r.id)?.subject, email_body: sendModal.find(x => x.id === r.id)?.body }
        : r), false)
      setSelected(new Set()); setSendModal(null)
      if (fails.length) alert(`${ko ? '발송' : 'Sent'} ${okIds.size} · ${ko ? '실패' : 'failed'} ${fails.length}\n` + fails.map(f => f.error).join('\n'))
    } finally { setSending(false) }
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
            { label: ko ? '회신율' : 'Reply rate', big: `${replyRate}%`, sub: `${repliedPlus}/${sentPlus}`, color: '#ff4400', note: '' },
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
        <button onClick={() => { if (selectMode) setSelected(new Set()); setSelectMode(v => !v) }}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', borderColor: selectMode ? '#ff4400' : '#E5E8EB', background: selectMode ? '#FFF1EC' : '#fff', color: selectMode ? '#ff4400' : '#4E5968', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {selectMode ? (ko ? '✓ 선택 종료' : 'Done') : (ko ? '다중 선택' : 'Select')}
        </button>
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
              <col style={{ width: '4%' }} />
              <col style={{ width: '15%' }} />
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
                <th style={{ ...th, textAlign: 'center' }}>
                  <input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))} onChange={toggleAll} />
                </th>
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
                  <td style={{ ...td, padding: 10 }} colSpan={9}>
                    {formFields(editForm, setEditForm)}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button onClick={() => setEditingId(null)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff', color: '#4E5968', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{L.cancel}</button>
                      <button onClick={saveEdit} disabled={busy} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#191F28', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>{L.save}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}
                  onClick={selectMode ? () => toggleSel(r.id) : undefined}
                  style={{ ...(selected.has(r.id) ? { background: '#FFF1EC' } : {}), cursor: selectMode ? 'pointer' : 'default' }}>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} onClick={e => e.stopPropagation()} style={{ width: 17, height: 17, cursor: 'pointer' }} />
                  </td>
                  {nameCell(r.company_name, true)}
                  {nameCell(r.contact_name, false)}
                  <td style={{ ...td, wordBreak: 'break-all' }}>{r.email ? <a href={`mailto:${r.email}`} style={{ color: '#2563EB', textDecoration: 'none' }}>{r.email}</a> : '-'}</td>
                  <td style={{ ...td, whiteSpace: 'normal', wordBreak: 'keep-all' }}>{r.industry || '-'}</td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <select value={r.status} onChange={e => quickStatus(r, e.target.value)}
                      style={{ border: 'none', cursor: 'pointer', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#fff', background: (STATUS[r.status] || STATUS.todo).bg, appearance: 'none', WebkitAppearance: 'none', textAlign: 'center' }}>
                      {STATUS_ORDER.map(s => <option key={s} value={s} style={{ background: '#fff', color: '#191F28' }}>{STATUS[s][ko ? 'ko' : 'en']}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {r.send_count > 0 && <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#fff', background: r.send_count >= 2 ? '#ff4400' : '#8B95A1', borderRadius: 4, padding: '1px 6px', marginBottom: 3 }}>{r.send_count}차</div>}
                    <div>{r.sent_at || '-'}</div>
                    {r.open_count > 0 && <div style={{ fontSize: 11, color: '#2563EB', marginTop: 2 }} title={r.opened_at ? new Date(r.opened_at).toLocaleString() : ''}>👁 {r.open_count}</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#8B95A1', fontSize: 11 }}>{r.memo || '-'}</td>
                  <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
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

      {/* 하단 고정 선택 액션바 */}
      {selected.size > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 900, background: '#191F28', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 -2px 14px rgba(0,0,0,0.18)' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{ko ? `${selected.size}건 선택됨` : `${selected.size} selected`}</span>
          <button onClick={() => setSelected(new Set())} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #4E5968', background: 'transparent', color: '#E5E8EB', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{ko ? '선택 해제' : 'Clear'}</button>
          <button onClick={openSend} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#ff4400', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{ko ? `${selected.size}건 발송` : `Send ${selected.size}`}</button>
        </div>
      )}

      {/* 발송 검토 모달 */}
      {sendModal && (
        <div onClick={() => !sending && setSendModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto', padding: '40px 16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 720, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: '#191F28' }}>{ko ? '발송 검토' : 'Review & send'} ({sendModal.length})</h3>
              <button onClick={() => !sending && setSendModal(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#8B95A1', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12.5, color: '#8B95A1', marginBottom: 16 }}>
              {ko ? `발신: ${owner === 'younghun' ? '남영훈 <younghun@likelion.net>' : '위승주 <wsj@likelion.net>'} · 각 메일 확인·수정 후 발송` : 'Review each email, edit if needed, then send'}
            </div>
            {sendModal.map((it, i) => (
              <div key={it.id} style={{ border: '1px solid #EEF0F2', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, color: '#4E5968', marginBottom: 8, fontWeight: 600 }}>
                  {it.round >= 2 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#ff4400', borderRadius: 4, padding: '1px 6px', marginRight: 6 }}>{it.round}차</span>}
                  {it.company} <span style={{ color: '#8B95A1', fontWeight: 400 }}>· {it.email}</span>
                </div>
                {!it.subject.trim() && !it.body.trim() ? (
                  <div style={{ fontSize: 12.5, color: generating ? '#8B95A1' : '#DC2626' }}>{generating ? (ko ? '초안 생성 중…' : 'Generating…') : (ko ? '생성 실패 — 닫고 다시 시도' : 'Failed')}</div>
                ) : (
                  <>
                    <input value={it.subject} onChange={e => setSendModal(m => m.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))}
                      style={{ ...inp, marginBottom: 8, fontWeight: 600 }} placeholder={ko ? '제목' : 'Subject'} />
                    <textarea value={it.body} onChange={e => setSendModal(m => m.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                      rows={8} style={{ ...inp, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} placeholder={ko ? '본문' : 'Body'} />
                    <div style={{ fontSize: 11, color: '#C1C7CD', marginTop: 4 }}>{ko ? `※ 아래에 서명 자동 첨부${it.body.includes('[[IMAGE]]') ? ' · [[IMAGE]] 자리에 인건비 비주얼 삽입' : ''}` : ''}</div>
                  </>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setSendModal(null)} disabled={sending} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #E5E8EB', background: '#fff', color: '#4E5968', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{L.cancel}</button>
              <button onClick={doSend} disabled={sending || generating} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#ff4400', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (sending || generating) ? 0.5 : 1 }}>
                {generating ? (ko ? '초안 생성 중…' : 'Generating…') : sending ? (ko ? '발송 중…' : 'Sending…') : (ko ? `${sendModal.filter(x => x.subject.trim() && x.body.trim()).length}건 발송` : 'Send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
