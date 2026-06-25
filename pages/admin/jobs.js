import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/admin/AdminLayout'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin } from '../../lib/adminSwr'
import Icon from '../../components/Icon'

const EMPTY_JOB = {
  title: '', company: '', company_initials: '', location: '', type: 'remote',
  country: 'korea', role: 'Backend', experience_min: 1, experience_max: 5,
  salary_min: 50000000, salary_max: 80000000, description: '', is_active: true,
  image_url: '', logo_url: '', images: [],
  tech_stack: [], benefits: [], company_size: '', hiring_process: '',
  deadline: '', headcount: '', apply_url: '', is_featured: false,
}

const ROLES = ['Backend','Frontend','Fullstack','Mobile','Data','DevOps','PM','Design','QA','Non-IT']
const TYPES = ['remote','onsite','hybrid']
const COUNTRIES = ['korea','vietnam','global']

export default function AdminJobs() {
  const [auth, setAuth] = useState('loading')
  const [token, setToken] = useState(null)
  const [currentEmail, setCurrentEmail] = useState(null)
  const router = useRouter()
  const tab = router.query.tab || 'jobs'
  const [jobFilter, setJobFilter] = useState('all')
  const [logTag, setLogTag] = useState('all')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_JOB)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [targetForm, setTargetForm] = useState({ company_name: '', slug: '', source_type: 'greenhouse', career_url: '' })
  const [targetSaving, setTargetSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const imgInputRef = useRef(null)

  // Auth check — DB based
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuth('denied'); return }
      try {
        const res = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
        const { isAdmin } = await res.json()
        if (!isAdmin) { setAuth('denied'); return }
        setToken(session.access_token)
        setCurrentEmail(session.user.email)
        setAuth('ok')
      } catch {
        setAuth('denied')
      }
    })
  }, [])

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

  // 어드민 활동 로그 기록 (베스트에포트)
  const logAction = async (action, summary, category = 'action') => {
    try {
      await fetch('/api/admin/activity-log', { method: 'POST', headers: headers(), body: JSON.stringify({ action, summary, category }) })
      mutateLog?.()
    } catch (_) {}
  }

  // SWR: 캐시로 페이지 재방문 즉시 표시. 액션 후엔 해당 목록만 mutate()로 갱신.
  const { data: jobs = [], mutate: mutateJobs } = useAdmin('/api/admin/jobs', token)
  const { data: apps = [], mutate: mutateApps } = useAdmin('/api/admin/applications', token)
  const { data: admins = [], mutate: mutateAdmins } = useAdmin('/api/admin/users', token)
  const { data: targets = [], mutate: mutateTargets } = useAdmin('/api/admin/crawl-targets', token)
  const { data: companies = [], mutate: mutateCompanies } = useAdmin('/api/admin/companies', token)
  const { data: kpi = null } = useAdmin('/api/admin/company-kpi', token)
  const { data: activityLog = { changelog: [], actions: [] }, mutate: mutateLog } = useAdmin('/api/admin/activity-log', token)
  const handleAddTarget = async () => {
    if (!targetForm.company_name || !targetForm.slug) return
    setTargetSaving(true)
    const res = await fetch('/api/admin/crawl-targets', { method: 'POST', headers: headers(), body: JSON.stringify(targetForm) })
    if (res.ok) { flash('Target added'); setTargetForm({ company_name: '', slug: '', source_type: 'greenhouse', career_url: '' }); mutateTargets() }
    else { const d = await res.json(); flash(d.error || 'Failed') }
    setTargetSaving(false)
  }

  const handleToggleTarget = async (target) => {
    await fetch('/api/admin/crawl-targets', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: target.id, is_active: !target.is_active }) })
    mutateTargets()
  }

  const handleDeleteTarget = async (id) => {
    if (!confirm('Delete this target?')) return
    await fetch('/api/admin/crawl-targets', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    flash('Deleted'); mutateTargets()
  }

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(null), 3000) }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      ...form,
      salary_min: Number(form.salary_min),
      salary_max: Number(form.salary_max),
      experience_min: Number(form.experience_min),
      experience_max: Number(form.experience_max),
      image_url: form.image_url || null,
      logo_url: form.logo_url || null,
      images: (form.images && form.images.length > 0) ? form.images : null,
      tech_stack: (form.tech_stack && form.tech_stack.length > 0) ? form.tech_stack : [],
      benefits: (form.benefits && form.benefits.length > 0) ? form.benefits : [],
      company_size: form.company_size || null,
      hiring_process: form.hiring_process || null,
      deadline: form.deadline || null,
      headcount: form.headcount ? Number(form.headcount) : null,
      apply_url: form.apply_url || null,
    }
    if (editing) {
      await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: editing.id, ...payload }) })
      flash('Updated')
    } else {
      await fetch('/api/admin/jobs', { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
      flash('Created')
    }
    setSaving(false); setEditing(null); setForm(EMPTY_JOB); mutateJobs(); router.push({ pathname: '/admin/jobs', query: { tab: 'jobs' } }, undefined, { shallow: true })
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this job?')) return
    await fetch('/api/admin/jobs', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    flash('Deleted'); mutateJobs()
  }

  const handleToggle = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, is_active: !job.is_active }) })
    mutateJobs()
  }

  const handleToggleVerify = async (c) => {
    await fetch('/api/admin/companies', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: c.id, verified: !c.verified_at }) })
    flash(c.verified_at ? '인증 해제됨' : '✅ 인증 완료'); mutateCompanies()
    logAction(c.verified_at ? '회사 인증 해제' : '회사 인증', c.name, 'company')
  }

  const handleToggleFeatured = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, is_featured: !job.is_featured }) })
    flash(job.is_featured ? '프리미엄 해제됨' : '⭐ 프리미엄 등록됨 — 적극 채용 중 노출')
    mutateJobs()
    logAction(job.is_featured ? '프리미엄 해제' : '프리미엄 등록', `${job.title} (${job.company})`, 'premium')
  }

  const handleApprove = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, status: 'live', is_active: true }) })
    // 승인 알림 (기업에게, 베스트에포트)
    try { await fetch('/api/admin/notify-job-approved', { method: 'POST', headers: headers(), body: JSON.stringify({ jobId: job.id }) }) } catch (_) {}
    flash('✅ 승인됨 — 기업에 알림 발송'); mutateJobs()
    logAction('공고 승인', `${job.title} (${job.company})`, 'approval')
  }
  const handleReject = async (job) => {
    if (!confirm('이 공고를 반려하시겠습니까?')) return
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, status: 'rejected', is_active: false }) })
    flash('Rejected'); mutateJobs()
    logAction('공고 반려', `${job.title} (${job.company})`, 'approval')
  }

  const handleStatusChange = async (appId, status) => {
    await fetch('/api/admin/applications', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: appId, status }) })
    mutateApps()
  }

  const handleAddAdmin = async () => {
    if (!newAdminEmail.includes('@')) return
    const res = await fetch('/api/admin/users', { method: 'POST', headers: headers(), body: JSON.stringify({ email: newAdminEmail.trim() }) })
    if (res.ok) { flash('Admin added'); setNewAdminEmail(''); mutateAdmins() }
    else { const d = await res.json(); flash(d.error || 'Failed') }
  }

  const handleRemoveAdmin = async (email) => {
    if (!confirm(`Remove ${email} from admin?`)) return
    const res = await fetch('/api/admin/users', { method: 'DELETE', headers: headers(), body: JSON.stringify({ email }) })
    if (res.ok) { flash('Removed'); mutateAdmins() }
    else { const d = await res.json(); flash(d.error || 'Failed') }
  }

  const uploadFiles = async (files) => {
    if (!files.length) return
    setImageUploading(true)
    const newUrls = []
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { flash('Max 5MB per image'); continue }
      const ext = file.name?.split('.').pop() || 'png'
      const path = `jobs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('job-images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('job-images').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      } else {
        flash(error.message)
      }
    }
    if (newUrls.length) setForm(prev => ({ ...prev, images: [...(prev.images || []), ...newUrls] }))
    setImageUploading(false)
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  const handleImageUpload = async (e) => {
    await uploadFiles(Array.from(e.target.files || []))
  }

  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageFiles = items
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean)
    if (imageFiles.length) {
      e.preventDefault()
      await uploadFiles(imageFiles)
    }
  }

  const removeImage = (idx) => {
    setForm(prev => ({ ...prev, images: (prev.images || []).filter((_, i) => i !== idx) }))
  }

  const goTab = (t) => router.push({ pathname: '/admin/jobs', query: { tab: t } }, undefined, { shallow: true })
  const startEdit = (job) => { setEditing(job); setForm({ ...job, images: job.images || [] }); goTab('job-new') }
  const startNew = () => { setEditing(null); setForm(EMPTY_JOB); goTab('jobs') }

  if (auth === 'loading') return <div style={S.center}>Loading...</div>
  if (auth === 'denied') return (
    <div style={S.center}>
      <div style={{ marginBottom: 16 }}><Icon name="lock" size={48} color="#1a1a1a" /></div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Admin access required</div>
      <div style={{ color: '#888', marginBottom: 24 }}>Sign in with an admin account.</div>
      <button style={S.btnP} onClick={() => { window.location.href = '/api/auth/google?return=' + encodeURIComponent('/admin/jobs'); }}>
        Sign in with Google
      </button>
    </div>
  )

  return (
    <>
      <Head><title>Admin — Jobs</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
      `}</style>

      <AdminLayout>
      <div style={S.shell}>
        {msg && <div style={S.flash}>{msg}</div>}

        {/* JOBS TAB */}
        {tab === 'job-new' && (
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                {editing ? `Edit: ${editing.title}` : 'New Job'}
              </div>
              <div style={S.grid}>
                <F label="Title" value={form.title} set={v => setForm({ ...form, title: v })} />
                <F label="Company" value={form.company} set={v => setForm({ ...form, company: v })} />
                <F label="Initials" value={form.company_initials} set={v => setForm({ ...form, company_initials: v })} />
                <F label="Location" value={form.location} set={v => setForm({ ...form, location: v })} />
                <Sel label="Type" value={form.type} opts={TYPES} set={v => setForm({ ...form, type: v })} />
                <Sel label="Country" value={form.country} opts={COUNTRIES} set={v => setForm({ ...form, country: v })} />
                <Sel label="Role" value={form.role} opts={ROLES} set={v => setForm({ ...form, role: v })} />
                <F label="Exp Min" value={form.experience_min} type="number" set={v => setForm({ ...form, experience_min: v })} />
                <F label="Exp Max" value={form.experience_max} type="number" set={v => setForm({ ...form, experience_max: v })} />
                <F label="Salary Min (VND)" value={form.salary_min} type="number" set={v => setForm({ ...form, salary_min: v })} />
                <F label="Salary Max (VND)" value={form.salary_max} type="number" set={v => setForm({ ...form, salary_max: v })} />
              </div>
              {/* New fields */}
              <div style={{ marginTop: 14, borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ff4400', marginBottom: 10 }}>EXTENDED INFO</div>
                <div style={S.grid}>
                  <div>
                    <label style={S.lbl}>Tech Stack (comma separated)</label>
                    <input value={(form.tech_stack || []).join(', ')} onChange={e => setForm({ ...form, tech_stack: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={S.inp} placeholder="React, Node.js, PostgreSQL" />
                  </div>
                  <div>
                    <label style={S.lbl}>Benefits (comma separated)</label>
                    <input value={(form.benefits || []).join(', ')} onChange={e => setForm({ ...form, benefits: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={S.inp} placeholder="Flexible hours, Health insurance" />
                  </div>
                  <F label="Company Size" value={form.company_size} set={v => setForm({ ...form, company_size: v })} />
                  <F label="Hiring Process" value={form.hiring_process} set={v => setForm({ ...form, hiring_process: v })} />
                  <F label="Deadline" value={form.deadline} type="date" set={v => setForm({ ...form, deadline: v })} />
                  <F label="Headcount" value={form.headcount} type="number" set={v => setForm({ ...form, headcount: v })} />
                  <F label="Apply URL" value={form.apply_url} set={v => setForm({ ...form, apply_url: v })} />
                  <label style={{
                    gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    padding: '12px 14px', borderRadius: 8,
                    border: `1.5px solid ${form.is_featured ? '#ff4400' : '#eee'}`,
                    background: form.is_featured ? '#fff7ed' : '#fafafa',
                  }}>
                    <input type="checkbox" checked={form.is_featured || false} onChange={e => setForm({ ...form, is_featured: e.target.checked })} style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: form.is_featured ? '#92400e' : '#333' }}>
                        ⭐ 프리미엄 노출 {form.is_featured && '(활성)'}
                      </div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        구직 페이지 “적극 채용 중인 회사” 섹션 노출 + 목록 최상단 핀 + ★추천 배지
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginTop: 10 }}>
                <F label="Image URL (card thumbnail)" value={form.image_url} set={v => setForm({ ...form, image_url: v })} />
                <F label="Logo URL (small icon)" value={form.logo_url} set={v => setForm({ ...form, logo_url: v })} />
              </div>
              {form.image_url && (
                <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                  <img src={form.image_url} alt="preview" style={{ height: 80, borderRadius: 6, objectFit: 'cover' }} />
                  <button onClick={() => setForm({ ...form, image_url: '' })} style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                    borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none',
                    fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>×</button>
                </div>
              )}
              {form.logo_url && (
                <div style={{ marginTop: 8, position: 'relative', display: 'inline-block', marginLeft: 8 }}>
                  <img src={form.logo_url} alt="logo" style={{ height: 40, borderRadius: 4, objectFit: 'contain' }} />
                  <button onClick={() => setForm({ ...form, logo_url: '' })} style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                    borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none',
                    fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>×</button>
                </div>
              )}

              {/* Company photos */}
              <div style={{ marginTop: 14 }}>
                <label style={S.lbl}>Company Photos (carousel)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(form.images || []).map((url, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={url} alt="" style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
                      <button onClick={() => removeImage(i)} style={{
                        position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                        borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none',
                        fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>×</button>
                    </div>
                  ))}
                </div>
                <div
                  onClick={() => imgInputRef.current?.click()}
                  onPaste={handlePaste}
                  tabIndex={0}
                  style={{
                    border: '1.5px dashed #ddd', borderRadius: 8, padding: '14px 20px',
                    textAlign: 'center', cursor: 'pointer', fontSize: 12, color: '#aaa',
                    outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = '#ff4400'}
                  onBlur={e => e.target.style.borderColor = '#ddd'}
                >
                  {imageUploading ? 'Uploading...' : 'Click to browse · or Ctrl+V to paste from clipboard'}
                </div>
                <input ref={imgInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageUpload} />
              </div>

              <div style={{ marginTop: 8 }}>
                <label style={S.lbl}>Description</label>
                <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ ...S.inp, height: 80, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={S.btnP} onClick={handleSave} disabled={saving || !form.title || !form.company}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
                {editing && <button style={S.btnG} onClick={startNew}>Cancel</button>}
              </div>
            </div>
        )}

        {tab === 'jobs' && (
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>All Jobs</div>
              {jobs.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No jobs yet</div>}
              {(() => {
                const pendingCount = jobs.filter(j => j.status === 'pending_review').length;
                const premiumCount = jobs.filter(j => j.is_featured).length;
                const companyCount = jobs.filter(j => j.source === 'company_self').length;
                const filtered = jobs.filter(j => {
                  if (jobFilter === 'company') return j.source === 'company_self';
                  if (jobFilter === 'pending') return j.status === 'pending_review';
                  return true;
                });
                const sorted = [...filtered].sort((a, b) => {
                  const ap = a.status === 'pending_review' ? 0 : 1;
                  const bp = b.status === 'pending_review' ? 0 : 1;
                  if (ap !== bp) return ap - bp;
                  return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                });
                const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
                const FILTERS = [['all', '전체', jobs.length], ['company', '🏢 기업 등록', companyCount], ['pending', '⏳ 승인 대기', pendingCount]];
                return (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {FILTERS.map(([key, label, n]) => (
                        <button key={key} onClick={() => setJobFilter(key)}
                          style={{ ...S.tab, ...(jobFilter === key ? S.tabOn : {}), ...(key === 'pending' && n > 0 && jobFilter !== key ? { color: '#c2410c', borderColor: '#fdba74' } : {}) }}>
                          {label} ({n})
                        </button>
                      ))}
                    </div>
                    {pendingCount > 0 && (
                      <div style={{ background:'#fff7ed', border:'1px solid #fdba74', color:'#9a3412', padding:'8px 12px', borderRadius:6, marginBottom:10, fontSize:13, fontWeight:700 }}>
                        ⏳ 승인 대기 {pendingCount}건 — 각 줄의 Approve / Reject로 처리
                      </div>
                    )}
                    <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', color:'#92400e', padding:'8px 12px', borderRadius:6, marginBottom:10, fontSize:13, fontWeight:700 }}>
                      ⭐ 프리미엄 노출 {premiumCount}개 · “적극 채용 중인 회사” 섹션 + 최상단 노출
                    </div>
                    {sorted.length === 0 && <div style={{ color: '#aaa', fontSize: 13, padding: '8px 0' }}>해당 공고 없음</div>}
                    {sorted.map(job => (
                      <div key={job.id} style={S.row}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {job.title}
                            {job.status === 'pending_review' && (
                              <span style={{ ...S.badge, background: '#fff7ed', color: '#c2410c' }}>Pending Approval</span>
                            )}
                            {job.status === 'rejected' && (
                              <span style={{ ...S.badge, background: '#fee2e2', color: '#991b1b' }}>Rejected</span>
                            )}
                            {job.status !== 'pending_review' && job.status !== 'rejected' && (
                              <span style={{ ...S.badge, background: job.is_active ? '#dcfce7' : '#fee2e2', color: job.is_active ? '#166534' : '#991b1b' }}>
                                {job.is_active ? 'Active' : 'Inactive'}
                              </span>
                            )}
                            {job.source === 'company_self' && <span style={{ ...S.badge, background: '#eff6ff', color: '#1d4ed8' }}>🏢 기업등록</span>}
                            {job.is_featured && <span style={{ ...S.badge, background: '#fef3c7', color: '#92400e' }}>Featured</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#888' }}>
                            {job.company} · {job.location} · {job.type} · {Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M VND
                          </div>
                          {job.source === 'company_self' && (
                            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                              {job.account_company && <>🏢 계정: <b style={{ color: '#1d4ed8' }}>{job.account_company}</b> · </>}
                              👤 {job.poster_email || '(등록자 미상)'} · 등록 {fmtDate(job.created_at)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {job.status === 'pending_review' && (
                            <>
                              <button style={{ ...S.btnS, background:'#059669', color:'#fff', fontWeight:800 }} onClick={() => handleApprove(job)}>Approve</button>
                              <button style={{ ...S.btnS, color: '#dc2626' }} onClick={() => handleReject(job)}>Reject</button>
                            </>
                          )}
                          <button style={S.btnS} onClick={() => startEdit(job)}>Edit</button>
                          {job.status !== 'pending_review' && (
                            <button
                              style={{ ...S.btnS, ...(job.is_featured ? { background: '#fef3c7', color: '#92400e', fontWeight: 800 } : { color: '#92400e' }) }}
                              onClick={() => handleToggleFeatured(job)}
                              title="적극 채용 중 섹션 노출 토글"
                            >
                              {job.is_featured ? '★ 프리미엄' : '프리미엄 등록'}
                            </button>
                          )}
                          {job.status !== 'pending_review' && (
                            <button style={S.btnS} onClick={() => handleToggle(job)}>{job.is_active ? 'Deactivate' : 'Activate'}</button>
                          )}
                          <button style={{ ...S.btnS, color: '#dc2626' }} onClick={() => handleDelete(job.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
        )}

        {/* LOG TAB (기능별 변경 이력 changelog + 운영 액션) */}
        {tab === 'log' && (() => {
          const CAT = { feat: ['#059669', '#ecfdf5'], fix: ['#b45309', '#fffbeb'], perf: ['#1d4ed8', '#eff6ff'], style: ['#7c3aed', '#f5f3ff'], docs: ['#555', '#f3f4f6'], approval: ['#059669', '#ecfdf5'], premium: ['#92400e', '#fef3c7'], company: ['#1d4ed8', '#eff6ff'], data: ['#7c3aed', '#f5f3ff'], action: ['#555', '#f3f4f6'] }
          const badge = (cat, text) => { const [fg, bg] = CAT[cat] || CAT.action; return <span style={{ ...S.badge, marginLeft: 0, background: bg, color: fg, flexShrink: 0 }}>{text}</span> }
          // changelog를 라우트별로 그룹
          const groups = {}
          ;(activityLog.changelog || []).forEach(c => { const k = c.routeLabel || '기타'; (groups[k] = groups[k] || []).push(c) })
          const groupKeys = Object.keys(groups).sort()
          return (
            <>
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📝 변경 이력 (기능별)</div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>태그(라우트)를 눌러 기능별로 모아 보세요.</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {[['all', `전체 ${(activityLog.changelog || []).length}`]].concat(groupKeys.map(k => [k, `${k} ${groups[k].length}`])).map(([key, label]) => (
                    <button key={key} onClick={() => setLogTag(key)} style={{ ...S.tab, fontSize: 12, padding: '5px 12px', ...(logTag === key ? S.tabOn : {}) }}>{label}</button>
                  ))}
                </div>
                {groupKeys.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>changelog 없음</div>}
                {(logTag === 'all' ? groupKeys : groupKeys.filter(k => k === logTag)).map(k => (
                  <div key={k} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#111', padding: '6px 0', borderBottom: '2px solid #f0f0f0', marginBottom: 6 }}>
                      {k} <span style={{ color: '#bbb', fontWeight: 600 }}>· {groups[k].length}</span>
                    </div>
                    {groups[k].map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid #f7f7f7' }}>
                        {badge(c.category, c.category)}
                        <span style={{ flex: 1, fontSize: 13, color: '#333' }}>{c.summary}</span>
                        {c.actor && c.actor !== 'deploy' && <span style={{ fontSize: 11, color: '#888', flexShrink: 0, fontWeight: 600 }}>{c.actor}</span>}
                        {c.commit && <code style={{ fontSize: 11, color: '#aaa' }}>{c.commit}</code>}
                        <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>운영 액션</div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>어드민이 누른 조치(승인·프리미엄·인증) 기록.</div>
                {(activityLog.actions || []).length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>액션 없음</div>}
                {(activityLog.actions || []).map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
                    {badge(l.category, l.action)}
                    <span style={{ flex: 1, fontSize: 13, color: '#333' }}>{l.summary}</span>
                    <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{l.actor ? l.actor.split('@')[0] + ' · ' : ''}{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</span>
                  </div>
                ))}
              </div>
            </>
          )
        })()}

        {/* KPI TAB (기업/채용 지표 요약) */}
        {tab === 'kpi' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 기업·채용 지표</div>
            {!kpi && <div style={{ color: '#aaa', fontSize: 13 }}>불러오는 중...</div>}
            {kpi && (() => {
              const Stat = ({ label, value, sub }) => (
                <div style={{ flex: '1 1 140px', minWidth: 140, background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#999', fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{value}</div>
                  {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>}
                </div>
              )
              const fc = kpi.forCompanies
              return (
                <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                    <Stat label="가입 회사" value={kpi.companies} sub={`멤버 ${kpi.members}명`} />
                    <Stat label="기업 등록 공고" value={kpi.jobs.companySelf} sub={`크롤 ${kpi.jobs.crawled} · 전체 ${kpi.jobs.total}`} />
                    <Stat label="승인 대기" value={kpi.jobs.pending} sub={`노출중 ${kpi.jobs.live}`} />
                    <Stat label="총 지원" value={kpi.applications.total} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 8px' }}>for-companies 퍼널 <span style={{ fontWeight: 500, color: '#999', fontSize: 11 }}>(전체 · 30일 · 7일)</span></div>
                  <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
                    {[['진입(nav 클릭)', fc.enter], ['공고 등록 클릭', fc.postJob], ['문의 클릭', fc.contact]].map(([label, m], i) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: i ? '1px solid #f0f0f0' : 'none' }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 13 }}><b>{m.all}</b> <span style={{ color: '#999' }}>· {m.d30} · {m.d7}</span></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 10 }}>※ for-companies는 페이지뷰 이벤트 미계측 — 진입은 nav 클릭 기준. 문의 리드는 Slack으로 전송됨.</div>
                </>
              )
            })()}
          </div>
        )}

        {/* COMPANIES TAB (가입 회사 계정 + 인증) */}
        {tab === 'companies' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>가입 회사 계정</div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>공고를 등록할 수 있는 기업 계정. 인증(verified) 상태를 관리합니다.</div>
            {companies.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>가입 회사 없음</div>}
            {companies.map(c => (
              <div key={c.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {c.name}
                    {c.verified_at
                      ? <span style={{ ...S.badge, background: '#dcfce7', color: '#166534' }}>✓ 인증됨</span>
                      : <span style={{ ...S.badge, background: '#f3f4f6', color: '#6b7280' }}>미인증</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {c.email_domain || '도메인 없음'} · 멤버 {c.member_count}명 · 공고 {c.job_count}개(노출 {c.live_count}) · 가입 {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}
                  </div>
                </div>
                <button
                  style={{ ...S.btnS, ...(c.verified_at ? { color: '#dc2626' } : { background: '#059669', color: '#fff', fontWeight: 800 }) }}
                  onClick={() => handleToggleVerify(c)}
                >
                  {c.verified_at ? '인증 해제' : '인증하기'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {tab === 'applications' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Applications</div>
            {apps.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No applications yet</div>}
            {apps.map(app => (
              <div key={app.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {app.user_name} <span style={{ fontWeight: 400, color: '#888' }}>({app.user_email})</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    Applied for: {app.jobs?.title || '—'} at {app.jobs?.company || '—'}
                    {app.applicant_role && <> · {app.applicant_role}</>}
                    {app.applicant_salary && <> · {Math.round(app.applicant_salary/1e6)}M VND</>}
                    {app.applicant_company && <> · {app.applicant_company}</>}
                    {app.resume_url && <> · <a href={app.resume_url} target="_blank" rel="noopener" style={{ color: '#ff4400' }}>Resume</a></>}
                  </div>
                  {(() => {
                    const refHost = app.referrer ? (() => { try { return new URL(app.referrer).hostname } catch { return app.referrer } })() : null
                    const src = app.utm_source || refHost || 'direct'
                    const detail = [app.utm_medium, app.utm_campaign, app.utm_content].filter(Boolean).join(' / ')
                    return (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        <span style={{ ...S.badge, background: '#ecfdf5', color: '#047857' }}>Source: {src}</span>
                        {detail && <span style={{ marginLeft: 6 }}>{detail}</span>}
                        {app.referrer && <span style={{ marginLeft: 6, color: '#bbb' }} title={app.referrer}>· ref: {refHost}</span>}
                      </div>
                    )
                  })()}
                  <div style={{ fontSize: 11, color: '#bbb' }}>{new Date(app.created_at).toLocaleString()}</div>
                </div>
                <select value={app.status || 'applied'} onChange={e => handleStatusChange(app.id, e.target.value)} style={S.sel}>
                  <option value="applied">지원 완료</option>
                  <option value="viewed">담당자 열람</option>
                  <option value="reviewing">검토중</option>
                  <option value="decided">결과 확인</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {/* CRAWL TARGETS TAB */}
        {tab === 'crawl' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Crawl Targets</div>

            <div style={{ ...S.grid, marginBottom: 16 }}>
              <F label="Company Name" value={targetForm.company_name} set={v => setTargetForm({ ...targetForm, company_name: v })} />
              <F label="Slug" value={targetForm.slug} set={v => setTargetForm({ ...targetForm, slug: v })} />
              <Sel label="Source Type" value={targetForm.source_type} opts={['greenhouse', 'lever', 'workable', 'greetinghr']} set={v => setTargetForm({ ...targetForm, source_type: v })} />
              <F label="Career URL (optional)" value={targetForm.career_url} set={v => setTargetForm({ ...targetForm, career_url: v })} />
            </div>
            <button style={S.btnP} onClick={handleAddTarget} disabled={targetSaving || !targetForm.company_name || !targetForm.slug}>
              {targetSaving ? 'Adding...' : 'Add Target'}
            </button>

            <div style={{ marginTop: 20 }}>
              {targets.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No targets yet</div>}
              {targets.map(t => (
                <div key={t.id} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {t.company_name}
                      <span style={{ ...S.badge, background: '#eef2ff', color: '#4338ca', marginLeft: 8 }}>{t.source_type}</span>
                      <span style={{ ...S.badge, background: t.is_active ? '#dcfce7' : '#fee2e2', color: t.is_active ? '#166534' : '#991b1b' }}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      slug: {t.slug}
                      {t.career_url && <> · <a href={t.career_url} target="_blank" rel="noopener" style={{ color: '#ff4400' }}>{t.career_url}</a></>}
                      {t.last_crawled_at && <> · Last crawled: {new Date(t.last_crawled_at).toLocaleString()}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={S.btnS} onClick={() => handleToggleTarget(t)}>{t.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button style={{ ...S.btnS, color: '#dc2626' }} onClick={() => handleDeleteTarget(t.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMINS TAB */}
        {tab === 'admins' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Admin Users</div>

            {/* Add new admin */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                type="email"
                placeholder="email@example.com"
                value={newAdminEmail}
                onChange={e => setNewAdminEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddAdmin() }}
                style={{ ...S.inp, flex: 1 }}
              />
              <button style={S.btnP} onClick={handleAddAdmin} disabled={!newAdminEmail.includes('@')}>
                Add Admin
              </button>
            </div>

            {/* Admin list */}
            {admins.map(a => (
              <div key={a.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{a.email}</div>
                  <div style={{ fontSize: 11, color: '#bbb' }}>
                    Added by {a.added_by || 'system'} · {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
                {a.email !== currentEmail ? (
                  <button style={{ ...S.btnS, color: '#dc2626' }} onClick={() => handleRemoveAdmin(a.email)}>Remove</button>
                ) : (
                  <span style={{ fontSize: 11, color: '#aaa' }}>You</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </AdminLayout>
    </>
  )
}

function F({ label, value, set, type = 'text' }) {
  return (
    <div>
      <label style={S.lbl}>{label}</label>
      <input type={type} value={value || ''} onChange={e => set(e.target.value)} style={S.inp} />
    </div>
  )
}
function Sel({ label, value, opts, set }) {
  return (
    <div>
      <label style={S.lbl}>{label}</label>
      <select value={value || ''} onChange={e => set(e.target.value)} style={S.inp}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

const S = {
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif" },
  shell: { maxWidth: 900, margin: '0 auto', padding: '24px 20px 60px' },
  tab: { fontSize: 13, fontWeight: 600, color: '#888', background: '#fff', border: '1px solid #eee', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' },
  tabOn: { background: '#111', color: '#fff', borderColor: '#111' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: '20px 24px', marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  lbl: { display: 'block', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  inp: { width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 6, outline: 'none', fontFamily: 'inherit' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' },
  badge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginLeft: 8 },
  btnP: { fontSize: 13, fontWeight: 700, color: '#fff', background: '#ff4400', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer' },
  btnG: { fontSize: 13, fontWeight: 600, color: '#888', background: 'none', border: '1px solid #ddd', padding: '10px 24px', borderRadius: 8, cursor: 'pointer' },
  btnS: { fontSize: 11, fontWeight: 600, color: '#555', background: '#f5f5f5', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' },
  sel: { fontSize: 12, padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 6, outline: 'none', fontFamily: 'inherit', flexShrink: 0 },
  flash: { background: '#dcfce7', color: '#166534', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, marginBottom: 12 },
}
