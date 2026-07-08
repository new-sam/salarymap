import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/admin/AdminLayout'
import { useT } from '../../lib/i18n'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin } from '../../lib/adminSwr'
import Icon from '../../components/Icon'
import { ROLE_GROUPS } from '../../constants/jobs'

const EMPTY_JOB = {
  title: '', company: '', company_initials: '', location: '', type: 'remote',
  country: 'korea', role: 'Backend', experience_min: 1, experience_max: 5,
  salary_min: 50000000, salary_max: 80000000, description: '', is_active: true,
  image_url: '', logo_url: '', images: [],
  tech_stack: [], benefits: [], company_size: '', hiring_process: '',
  deadline: '', headcount: '', apply_url: '', is_featured: false,
}

const TYPES = ['remote','onsite','hybrid']
const COUNTRIES = ['korea','vietnam','global']

export default function AdminJobs() {
  const [auth, setAuth] = useState('loading')
  const [token, setToken] = useState(null)
  const [currentEmail, setCurrentEmail] = useState(null)
  const { lang: globalLang } = useT()
  const L = (ko, en) => (globalLang === 'ko' ? ko : en) // admin은 ko/en 2개
  const router = useRouter()
  const tab = router.query.tab || 'jobs'
  const [jobFilter, setJobFilter] = useState('all')
  const [jobSearch, setJobSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_JOB)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [acct, setAcct] = useState({ email: '', companyName: '', contactName: '' })
  const [acctIssuing, setAcctIssuing] = useState(false)
  const [acctResult, setAcctResult] = useState(null)
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

  // SWR: 캐시로 페이지 재방문 즉시 표시. 액션 후엔 해당 목록만 mutate()로 갱신.
  const { data: jobs = [], mutate: mutateJobs } = useAdmin('/api/admin/jobs', token)
  const { data: admins = [], mutate: mutateAdmins } = useAdmin('/api/admin/users', token)
  const { data: companies = [], mutate: mutateCompanies } = useAdmin('/api/admin/companies', token)
  const { data: kpi = null } = useAdmin('/api/admin/company-kpi', token)
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
      flash(L('수정됨', 'Updated'))
    } else {
      await fetch('/api/admin/jobs', { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
      flash(L('등록됨', 'Created'))
    }
    setSaving(false); setEditing(null); setForm(EMPTY_JOB); mutateJobs(); router.push({ pathname: '/admin/jobs', query: { tab: 'jobs' } }, undefined, { shallow: true })
  }

  const handleDelete = async (id) => {
    if (!confirm(L('이 공고를 삭제하시겠습니까?', 'Delete this job?'))) return
    await fetch('/api/admin/jobs', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    flash(L('삭제됨', 'Deleted')); mutateJobs()
  }

  const handleToggle = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, is_active: !job.is_active }) })
    mutateJobs()
  }

  const handleToggleVerify = async (c) => {
    await fetch('/api/admin/companies', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: c.id, verified: !c.verified_at }) })
    flash(c.verified_at ? L('인증 해제됨', 'Verification removed') : L('✅ 인증 완료', '✅ Verified')); mutateCompanies()
  }

  const handleIssueAccount = async () => {
    if (!acct.email.includes('@') || !acct.companyName.trim()) return
    setAcctIssuing(true); setAcctResult(null)
    try {
      const res = await fetch('/api/admin/companies', { method: 'POST', headers: headers(), body: JSON.stringify(acct) })
      const data = await res.json()
      if (!res.ok) { flash('❌ ' + (data.error || L('발급 실패', 'Failed to issue'))); return }
      setAcctResult(data)
      setAcct({ email: '', companyName: '', contactName: '' })
      flash(data.reused ? L('기존 계정 비번 재설정됨', 'Existing account password reset') : L('✅ 계정 발급 완료', '✅ Account issued')); mutateCompanies()
    } catch (e) {
      flash('❌ ' + (e.message || L('발급 실패', 'Failed to issue')))
    } finally {
      setAcctIssuing(false)
    }
  }

  const handleToggleFeatured = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, is_featured: !job.is_featured }) })
    flash(job.is_featured ? L('프리미엄 해제됨', 'Premium removed') : L('⭐ 프리미엄 등록됨 — 적극 채용 중 노출', '⭐ Premium enabled — shown in “Actively hiring”'))
    mutateJobs()
  }

  const handleApprove = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, status: 'live', is_active: true }) })
    // 승인 알림 (기업에게, 베스트에포트)
    try { await fetch('/api/admin/notify-job-approved', { method: 'POST', headers: headers(), body: JSON.stringify({ jobId: job.id }) }) } catch (_) {}
    flash(L('✅ 승인됨 — 기업에 알림 발송', '✅ Approved — company notified')); mutateJobs()
  }
  const handleReject = async (job) => {
    if (!confirm(L('이 공고를 반려하시겠습니까?', 'Reject this job posting?'))) return
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, status: 'rejected', is_active: false }) })
    flash(L('반려됨', 'Rejected')); mutateJobs()
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
      <button style={S.btnP} onClick={() => { window.location.href = '/api/auth/google?return=' + encodeURIComponent('/admin/dashboard'); }}>
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
        {tab === 'job-new' && (() => {
          const sec = { marginBottom: 26 };
          const secTitle = { fontSize: 13, fontWeight: 700, color: '#191F28', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #F2F4F6' };
          const col = { display: 'flex', flexDirection: 'column', gap: 14 };
          const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
          const hint = { fontWeight: 400, color: '#ADB5BD' };
          return (
            <div style={{ ...S.card, maxWidth: 720, padding: '24px 28px' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#191F28', marginBottom: 22 }}>
                {editing ? L('공고 수정', 'Edit job') : L('새 공고 등록', 'New job')}
              </div>

              <div style={sec}>
                <div style={secTitle}>{L('기본 정보', 'Basics')}</div>
                <div style={col}>
                  <F label={L('직무명', 'Job title')} value={form.title} set={v => setForm({ ...form, title: v })} />
                  <div style={row2}>
                    <F label={L('회사명', 'Company')} value={form.company} set={v => setForm({ ...form, company: v })} />
                    <F label={L('회사 약자', 'Company initials')} value={form.company_initials} set={v => setForm({ ...form, company_initials: v })} />
                  </div>
                  <div style={row2}>
                    <Sel label={L('국가', 'Country')} value={form.country} opts={COUNTRIES} set={v => setForm({ ...form, country: v })} />
                    <F label={L('근무지', 'Location')} value={form.location} set={v => setForm({ ...form, location: v })} />
                  </div>
                  <div style={row2}>
                    <Sel label={L('고용형태', 'Employment type')} value={form.type} opts={TYPES} set={v => setForm({ ...form, type: v })} />
                    <Sel label={L('직군', 'Role')} value={form.role} groups={ROLE_GROUPS} set={v => setForm({ ...form, role: v })} />
                  </div>
                </div>
              </div>

              <div style={sec}>
                <div style={secTitle}>{L('채용 조건', 'Requirements')}</div>
                <div style={col}>
                  <div style={row2}>
                    <F label={L('경력 최소 (년)', 'Min experience (yrs)')} value={form.experience_min} type="number" set={v => setForm({ ...form, experience_min: v })} />
                    <F label={L('경력 최대 (년)', 'Max experience (yrs)')} value={form.experience_max} type="number" set={v => setForm({ ...form, experience_max: v })} />
                  </div>
                  <div style={row2}>
                    <F label={L('연봉 최소 (VND)', 'Min salary (VND)')} value={form.salary_min} type="number" set={v => setForm({ ...form, salary_min: v })} />
                    <F label={L('연봉 최대 (VND)', 'Max salary (VND)')} value={form.salary_max} type="number" set={v => setForm({ ...form, salary_max: v })} />
                  </div>
                  <div style={row2}>
                    <F label={L('모집 인원', 'Headcount')} value={form.headcount} type="number" set={v => setForm({ ...form, headcount: v })} />
                    <F label={L('마감일', 'Deadline')} value={form.deadline} type="date" set={v => setForm({ ...form, deadline: v })} />
                  </div>
                </div>
              </div>

              <div style={sec}>
                <div style={secTitle}>{L('상세 내용', 'Details')}</div>
                <div style={col}>
                  <div>
                    <label style={S.lbl}>{L('상세 설명', 'Description')}</label>
                    <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
                      style={{ ...S.inp, height: 130, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={S.lbl}>{L('기술 스택', 'Tech stack')} <span style={hint}>{L('쉼표로 구분', 'comma-separated')}</span></label>
                    <input value={(form.tech_stack || []).join(', ')} onChange={e => setForm({ ...form, tech_stack: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={S.inp} placeholder="React, Node.js, PostgreSQL" />
                  </div>
                  <div>
                    <label style={S.lbl}>{L('복지', 'Benefits')} <span style={hint}>{L('쉼표로 구분', 'comma-separated')}</span></label>
                    <input value={(form.benefits || []).join(', ')} onChange={e => setForm({ ...form, benefits: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={S.inp} placeholder={L('유연근무, 4대보험', 'Flexible hours, insurance')} />
                  </div>
                  <div style={row2}>
                    <F label={L('회사 규모', 'Company size')} value={form.company_size} set={v => setForm({ ...form, company_size: v })} />
                    <F label={L('채용 절차', 'Hiring process')} value={form.hiring_process} set={v => setForm({ ...form, hiring_process: v })} />
                  </div>
                </div>
              </div>

              <div style={sec}>
                <div style={secTitle}>{L('미디어', 'Media')}</div>
                <div style={col}>
                  <div style={row2}>
                    <F label={L('로고 URL', 'Logo URL')} value={form.logo_url} set={v => setForm({ ...form, logo_url: v })} />
                    <F label={L('썸네일 URL', 'Thumbnail URL')} value={form.image_url} set={v => setForm({ ...form, image_url: v })} />
                  </div>
                  {(form.logo_url || form.image_url) && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      {form.logo_url && (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img src={form.logo_url} alt="logo" style={{ height: 40, borderRadius: 6, objectFit: 'contain', border: '1px solid #EEF0F2' }} />
                          <button onClick={() => setForm({ ...form, logo_url: '' })} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#C92A2A', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer' }}>×</button>
                        </div>
                      )}
                      {form.image_url && (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img src={form.image_url} alt="preview" style={{ height: 70, borderRadius: 6, objectFit: 'cover', border: '1px solid #EEF0F2' }} />
                          <button onClick={() => setForm({ ...form, image_url: '' })} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#C92A2A', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer' }}>×</button>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label style={S.lbl}>{L('회사 사진', 'Company photos')} <span style={hint}>{L('캐러셀', 'carousel')}</span></label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {(form.images || []).map((url, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={url} alt="" style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid #EEF0F2' }} />
                          <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#C92A2A', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer' }}>×</button>
                        </div>
                      ))}
                    </div>
                    <div
                      onClick={() => imgInputRef.current?.click()}
                      onPaste={handlePaste}
                      tabIndex={0}
                      style={{ border: '1.5px dashed #D7DBE0', borderRadius: 10, padding: '16px 20px', textAlign: 'center', cursor: 'pointer', fontSize: 12.5, color: '#868E96', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#ff4400'}
                      onBlur={e => e.target.style.borderColor = '#D7DBE0'}
                    >
                      {imageUploading ? L('업로드 중...', 'Uploading…') : L('클릭해서 선택 · 또는 Ctrl+V로 붙여넣기', 'Click to select · or paste with Ctrl+V')}
                    </div>
                    <input ref={imgInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageUpload} />
                  </div>
                </div>
              </div>

              <div style={sec}>
                <div style={secTitle}>{L('지원 · 노출', 'Apply · Visibility')}</div>
                <div style={col}>
                  <F label={L('지원 URL', 'Apply URL')} value={form.apply_url} set={v => setForm({ ...form, apply_url: v })} />
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    padding: '14px 16px', borderRadius: 10,
                    border: `1.5px solid ${form.is_featured ? '#ff4400' : '#E5E8EB'}`,
                    background: form.is_featured ? '#FFF7F4' : '#fff',
                  }}>
                    <input type="checkbox" checked={form.is_featured || false} onChange={e => setForm({ ...form, is_featured: e.target.checked })} style={{ width: 18, height: 18, flexShrink: 0, accentColor: '#ff4400' }} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: form.is_featured ? '#ff4400' : '#191F28' }}>{L('프리미엄 노출', 'Premium placement')}{form.is_featured && L(' · 활성', ' · active')}</div>
                      <div style={{ fontSize: 11.5, color: '#868E96', marginTop: 2 }}>{L('“적극 채용 중인 회사” 섹션 + 목록 최상단 노출', 'Shown in the “Actively hiring” section and at the top of the list')}</div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button style={S.btnP} onClick={handleSave} disabled={saving || !form.title || !form.company}>
                  {saving ? L('저장 중...', 'Saving…') : editing ? L('수정', 'Save') : L('등록', 'Create')}
                </button>
                {editing && <button style={S.btnG} onClick={startNew}>{L('취소', 'Cancel')}</button>}
              </div>
            </div>
          );
        })()}

        {tab === 'jobs' && (
          <div style={{ minHeight: '70vh' }}>
            {jobs.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No jobs yet</div>}
            {(() => {
              const q = jobSearch.trim().toLowerCase();
              const searched = q ? jobs.filter(j => [j.title, j.company, j.location, j.role].some(v => (v || '').toLowerCase().includes(q))) : jobs;
              const pendingCount = searched.filter(j => j.status === 'pending_review').length;
              const companyCount = searched.filter(j => j.source === 'company_self').length;
              const filtered = searched.filter(j => {
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
              const FILTERS = [['all', L('전체', 'All'), searched.length], ['company', L('기업 등록', 'Company-posted'), companyCount], ['pending', L('승인 대기', 'Pending'), pendingCount]];
              const chip = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#4E5968', background: '#F2F4F6', borderRadius: 8, padding: '4px 9px' };
              const actBtn = { fontSize: 12, fontWeight: 600, color: '#4E5968', background: '#fff', border: '1px solid #E5E8EB', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' };
              return (
                <>
                  <input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder={L('검색  ·  직무 · 회사 · 지역', 'Search  ·  title · company · location')}
                    style={{ width: '100%', maxWidth: 380, fontSize: 13.5, padding: '10px 13px', border: '1px solid #E5E8EB', borderRadius: 10, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {FILTERS.map(([key, label, n]) => {
                      const on = jobFilter === key;
                      return (
                        <button key={key} onClick={() => setJobFilter(key)}
                          style={{
                            fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '7px 14px',
                            border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
                            background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968',
                          }}>
                          {label} <span style={{ opacity: on ? 0.7 : 0.5 }}>{n}</span>
                        </button>
                      );
                    })}
                  </div>
                  {sorted.length === 0 && <div style={{ color: '#aaa', fontSize: 13, padding: '8px 0' }}>{L('해당 공고 없음', 'No matching jobs')}</div>}
                  {sorted.map(job => {
                    const st = job.status === 'pending_review'
                      ? { label: L('승인 대기', 'Pending'), bg: '#FFF4E5', color: '#C2410C' }
                      : job.status === 'rejected'
                      ? { label: L('반려', 'Rejected'), bg: '#FEE2E2', color: '#991B1B' }
                      : job.is_active
                      ? { label: L('노출중', 'Live'), bg: '#E7F6EC', color: '#1B7A43' }
                      : { label: L('비노출', 'Hidden'), bg: '#F1F3F5', color: '#868E96' };
                    return (
                      <div key={job.id} style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, padding: '15px 17px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8B95A1', marginBottom: 3 }}>{job.company}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#191F28', letterSpacing: '-0.01em' }}>{job.title}</div>
                          </div>
                          <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {job.location && <span style={chip}>{job.location}</span>}
                          {job.type && <span style={chip}>{job.type}</span>}
                          <span style={{ ...chip, color: '#191F28', fontWeight: 700 }}>{Math.round(job.salary_min/1e6)}–{Math.round(job.salary_max/1e6)}M</span>
                          {job.source === 'company_self' && <span style={{ ...chip, background: '#EAF2FE', color: '#1D4ED8' }}>{L('기업등록', 'Company')}</span>}
                          {job.is_featured && <span style={{ ...chip, background: '#FEF6E0', color: '#92660E' }}>{L('프리미엄', 'Premium')}</span>}
                        </div>
                        {job.source === 'company_self' && (
                          <div style={{ fontSize: 11.5, color: '#ADB5BD', marginTop: 8 }}>
                            {job.account_company && <>{L('계정', 'Account')} {job.account_company} · </>}{job.poster_email || L('등록자 미상', 'Unknown poster')} · {fmtDate(job.created_at)}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 13, paddingTop: 13, borderTop: '1px solid #F2F4F6' }}>
                          {job.status === 'pending_review' && (
                            <>
                              <button style={{ ...actBtn, border: 'none', background: '#1B7A43', color: '#fff' }} onClick={() => handleApprove(job)}>{L('승인', 'Approve')}</button>
                              <button style={{ ...actBtn, border: 'none', background: '#FEE2E2', color: '#C92A2A' }} onClick={() => handleReject(job)}>{L('반려', 'Reject')}</button>
                            </>
                          )}
                          <button style={actBtn} onClick={() => startEdit(job)}>{L('수정', 'Edit')}</button>
                          {job.status !== 'pending_review' && (
                            <button style={job.is_featured ? { ...actBtn, borderColor: '#F3D98B', background: '#FEF6E0', color: '#92660E' } : actBtn} onClick={() => handleToggleFeatured(job)} title={L('적극 채용 중 섹션 노출 토글', 'Toggle “Actively hiring” placement')}>
                              {job.is_featured ? L('프리미엄 해제', 'Remove premium') : L('프리미엄', 'Premium')}
                            </button>
                          )}
                          {job.status !== 'pending_review' && (
                            <button style={actBtn} onClick={() => handleToggle(job)}>{job.is_active ? L('비노출', 'Hide') : L('노출', 'Show')}</button>
                          )}
                          <button style={{ ...actBtn, marginLeft: 'auto', color: '#C92A2A', borderColor: '#F5D5D5' }} onClick={() => handleDelete(job.id)}>{L('삭제', 'Delete')}</button>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}

        {/* KPI TAB (기업/채용 지표 요약) */}
        {tab === 'kpi' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 {L('기업·채용 지표', 'Company & hiring metrics')}</div>
            {!kpi && <div style={{ color: '#aaa', fontSize: 13 }}>{L('불러오는 중...', 'Loading…')}</div>}
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
                    <Stat label={L('가입 회사', 'Companies')} value={kpi.companies} sub={L(`멤버 ${kpi.members}명`, `${kpi.members} members`)} />
                    <Stat label={L('기업 등록 공고', 'Company-posted jobs')} value={kpi.jobs.companySelf} sub={L(`크롤 ${kpi.jobs.crawled} · 전체 ${kpi.jobs.total}`, `crawled ${kpi.jobs.crawled} · total ${kpi.jobs.total}`)} />
                    <Stat label={L('승인 대기', 'Pending')} value={kpi.jobs.pending} sub={L(`노출중 ${kpi.jobs.live}`, `${kpi.jobs.live} live`)} />
                    <Stat label={L('총 지원', 'Total applications')} value={kpi.applications.total} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 8px' }}>{L('for-companies 퍼널', 'for-companies funnel')} <span style={{ fontWeight: 500, color: '#999', fontSize: 11 }}>{L('(전체 · 30일 · 7일)', '(all · 30d · 7d)')}</span></div>
                  <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
                    {[[L('진입(nav 클릭)', 'Enter (nav click)'), fc.enter], [L('공고 등록 클릭', 'Post-job click'), fc.postJob], [L('문의 클릭', 'Contact click'), fc.contact]].map(([label, m], i) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: i ? '1px solid #f0f0f0' : 'none' }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 13 }}><b>{m.all}</b> <span style={{ color: '#999' }}>· {m.d30} · {m.d7}</span></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 10 }}>{L('※ for-companies는 페이지뷰 이벤트 미계측 — 진입은 nav 클릭 기준. 문의 리드는 Slack으로 전송됨.', '※ for-companies pageviews aren’t tracked — “enter” counts nav clicks. Contact leads are sent to Slack.')}</div>
                </>
              )
            })()}
          </div>
        )}

        {/* COMPANIES TAB (가입 회사 계정 + 인증) */}
        {tab === 'companies' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{L('가입 회사 계정', 'Company accounts')}</div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>{L('공고를 등록할 수 있는 기업 계정. 인증(verified) 상태를 관리합니다.', 'Company accounts that can post jobs. Manage their verified status here.')}</div>

            {/* 계정 발급 — Google 안 되는 회사용 이메일/비번 로그인 계정 생성 */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 20, background: '#fafafa' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>＋ {L('계정 발급', 'Issue account')}</div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>{L('이메일/비밀번호 로그인 계정을 만들어 자격증명을 고객에게 전달합니다. gmail 등 개인메일도 가능(계정별 독립 회사).', 'Create an email/password login account and hand the credentials to the customer. Personal emails like gmail are fine (each becomes its own company).')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <input type="email" placeholder={L('로그인 이메일', 'Login email')} value={acct.email}
                  onChange={e => setAcct({ ...acct, email: e.target.value })}
                  style={{ ...S.inp, flex: '1 1 200px' }} />
                <input type="text" placeholder={L('회사명(표시)', 'Company name (display)')} value={acct.companyName}
                  onChange={e => setAcct({ ...acct, companyName: e.target.value })}
                  style={{ ...S.inp, flex: '1 1 200px' }} />
                <input type="text" placeholder={L('담당자명(선택)', 'Contact name (optional)')} value={acct.contactName}
                  onChange={e => setAcct({ ...acct, contactName: e.target.value })}
                  style={{ ...S.inp, flex: '1 1 160px' }} />
              </div>
              <button style={S.btnP} onClick={handleIssueAccount}
                disabled={acctIssuing || !acct.email.includes('@') || !acct.companyName.trim()}>
                {acctIssuing ? L('발급 중…', 'Issuing…') : L('계정 발급', 'Issue account')}
              </button>

              {acctResult && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#065f46', marginBottom: 6 }}>
                    {acctResult.reused
                      ? L('기존 계정 비밀번호 재설정됨 — 아래를 전달하세요', 'Existing account password reset — share the details below')
                      : L('✅ 발급 완료 — 아래를 고객에게 전달하세요', '✅ Issued — hand the details below to the customer')}
                  </div>
                  <div style={{ fontFamily: 'monospace', lineHeight: 1.7, userSelect: 'all' }}>
                    <div>URL: {acctResult.url}</div>
                    <div>{L('이메일', 'Email')}: {acctResult.email}</div>
                    <div>{L('비밀번호', 'Password')}: <b>{acctResult.password}</b></div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button style={S.btnS}
                      onClick={() => { navigator.clipboard.writeText(`URL: ${acctResult.url}\n${L('이메일', 'Email')}: ${acctResult.email}\n${L('비밀번호', 'Password')}: ${acctResult.password}`); flash(L('복사됨', 'Copied')) }}>
                      {L('복사', 'Copy')}
                    </button>
                    <button style={S.btnS} onClick={() => setAcctResult(null)}>{L('닫기', 'Close')}</button>
                  </div>
                  <div style={{ marginTop: 8, color: '#059669', fontSize: 11 }}>{L('※ 비밀번호는 지금만 표시됩니다. 창을 닫으면 다시 볼 수 없어요.', '※ The password is shown only now. Once you close this, it cannot be viewed again.')}</div>
                </div>
              )}
            </div>

            {companies.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>{L('가입 회사 없음', 'No companies yet')}</div>}
            {companies.map(c => (
              <div key={c.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {c.name}
                    {c.verified_at
                      ? <span style={{ ...S.badge, background: '#dcfce7', color: '#166534' }}>{L('✓ 인증됨', '✓ Verified')}</span>
                      : <span style={{ ...S.badge, background: '#f3f4f6', color: '#6b7280' }}>{L('미인증', 'Unverified')}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {c.email_domain || L('도메인 없음', 'no domain')} · {L(`멤버 ${c.member_count}명`, `${c.member_count} members`)} · {L(`공고 ${c.job_count}개(노출 ${c.live_count})`, `${c.job_count} jobs (${c.live_count} live)`)} · {L('가입', 'Joined')} {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}
                  </div>
                </div>
                <button
                  style={{ ...S.btnS, ...(c.verified_at ? { color: '#dc2626' } : { background: '#059669', color: '#fff', fontWeight: 800 }) }}
                  onClick={() => handleToggleVerify(c)}
                >
                  {c.verified_at ? L('인증 해제', 'Unverify') : L('인증하기', 'Verify')}
                </button>
              </div>
            ))}
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
function Sel({ label, value, opts, set, groups }) {
  const { lang } = useT()
  const [open, setOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState(null) // 펼쳐진 대분류 key (아코디언)
  const ref = useRef(null)
  // groups 가 주어지면 대분류 헤더 + 소분류(로컬라이즈 라벨)로 렌더. 저장값은 영어 canonical(r.value).
  const labelFor = (v) => {
    if (!groups) return v
    for (const g of groups) for (const r of g.roles) if (r.value === v) return r.label[lang] || r.label.en
    return v
  }
  // 열 때 현재 선택된 값이 속한 대분류를 자동으로 펼침
  const toggleOpen = () => {
    const next = !open
    if (next && groups && value) {
      const g = groups.find(gr => gr.roles.some(r => r.value === value))
      setOpenGroup(g ? g.key : null)
    }
    setOpen(next)
  }
  const renderItem = (val, text) => {
    const on = val === value
    return (
      <div key={val} onClick={() => { set(val); setOpen(false) }}
        style={{ padding: '9px 11px', borderRadius: 7, fontSize: 13.5, cursor: 'pointer', color: on ? '#ff4400' : '#191F28', fontWeight: on ? 700 : 500, background: on ? '#FFF1EC' : 'transparent' }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#F8F9FA' }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
        {text}
      </div>
    )
  }
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={S.lbl}>{label}</label>
      <button type="button" onClick={toggleOpen}
        style={{ ...S.inp, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#fff', borderColor: open ? '#ff4400' : '#E5E8EB' }}>
        <span style={{ color: value ? '#191F28' : '#ADB5BD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ? labelFor(value) : (lang === 'ko' ? '선택' : 'Select')}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" stroke="#868E96" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid #E5E8EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', padding: 4, maxHeight: 320, overflowY: 'auto' }}>
          {groups
            ? groups.map(g => {
                const gExpanded = openGroup === g.key
                const gActive = g.roles.some(r => r.value === value)
                return (
                  <div key={g.key}>
                    <div onClick={() => setOpenGroup(gExpanded ? null : g.key)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 11px', borderRadius: 7, fontSize: 13.5, cursor: 'pointer', fontWeight: gActive ? 700 : 600, color: gActive ? '#ff4400' : '#191F28' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F8F9FA' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      <span>{g.label[lang] || g.label.en} <span style={{ color: '#C1C7CD', fontWeight: 500, fontSize: 12 }}>{g.roles.length}</span></span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transition: 'transform .15s', transform: gExpanded ? 'rotate(180deg)' : 'none' }}>
                        <path d="M6 9l6 6 6-6" stroke="#BBB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {gExpanded && <div style={{ paddingLeft: 12 }}>{g.roles.map(r => renderItem(r.value, r.label[lang] || r.label.en))}</div>}
                  </div>
                )
              })
            : opts.map(o => renderItem(o, o))}
        </div>
      )}
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
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 6 },
  inp: { width: '100%', fontSize: 13.5, padding: '10px 12px', border: '1px solid #E5E8EB', borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' },
  badge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginLeft: 8 },
  btnP: { fontSize: 13, fontWeight: 700, color: '#fff', background: '#ff4400', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer' },
  btnG: { fontSize: 13, fontWeight: 600, color: '#888', background: 'none', border: '1px solid #ddd', padding: '10px 24px', borderRadius: 8, cursor: 'pointer' },
  btnS: { fontSize: 11, fontWeight: 600, color: '#555', background: '#f5f5f5', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' },
  sel: { fontSize: 12, padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 6, outline: 'none', fontFamily: 'inherit', flexShrink: 0 },
  flash: { background: '#dcfce7', color: '#166534', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, marginBottom: 12 },
}
