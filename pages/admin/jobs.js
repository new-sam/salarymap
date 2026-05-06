import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'

const EMPTY_JOB = {
  title: '', company: '', company_initials: '', location: '', type: 'remote',
  country: 'korea', role: 'Backend', experience_min: 1, experience_max: 5,
  salary_min: 50000000, salary_max: 80000000, description: '', is_active: true,
  image_url: '', logo_url: '', images: [],
  tech_stack: [], benefits: [], company_size: '', hiring_process: '',
  deadline: '', headcount: '', apply_url: '',
}

const ROLES = ['Backend','Frontend','Fullstack','Mobile','Data','DevOps','PM','Design','QA']
const TYPES = ['remote','onsite','hybrid']
const COUNTRIES = ['korea','vietnam','global']

export default function AdminJobs() {
  const [auth, setAuth] = useState('loading')
  const [token, setToken] = useState(null)
  const [currentEmail, setCurrentEmail] = useState(null)
  const [jobs, setJobs] = useState([])
  const [apps, setApps] = useState([])
  const [admins, setAdmins] = useState([])
  const [tab, setTab] = useState('jobs')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_JOB)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [newAdminEmail, setNewAdminEmail] = useState('')
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

  useEffect(() => {
    if (auth !== 'ok') return
    fetchJobs(); fetchApps(); fetchAdmins()
  }, [auth])

  const fetchJobs = async () => {
    const res = await fetch('/api/admin/jobs', { headers: headers() })
    if (res.ok) setJobs(await res.json())
  }
  const fetchApps = async () => {
    const res = await fetch('/api/admin/applications', { headers: headers() })
    if (res.ok) setApps(await res.json())
  }
  const fetchAdmins = async () => {
    const res = await fetch('/api/admin/users', { headers: headers() })
    if (res.ok) setAdmins(await res.json())
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
    setSaving(false); setEditing(null); setForm(EMPTY_JOB); fetchJobs()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this job?')) return
    await fetch('/api/admin/jobs', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    flash('Deleted'); fetchJobs()
  }

  const handleToggle = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, is_active: !job.is_active }) })
    fetchJobs()
  }

  const handleStatusChange = async (appId, status) => {
    await fetch('/api/admin/applications', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: appId, status }) })
    fetchApps()
  }

  const handleAddAdmin = async () => {
    if (!newAdminEmail.includes('@')) return
    const res = await fetch('/api/admin/users', { method: 'POST', headers: headers(), body: JSON.stringify({ email: newAdminEmail.trim() }) })
    if (res.ok) { flash('Admin added'); setNewAdminEmail(''); fetchAdmins() }
    else { const d = await res.json(); flash(d.error || 'Failed') }
  }

  const handleRemoveAdmin = async (email) => {
    if (!confirm(`Remove ${email} from admin?`)) return
    const res = await fetch('/api/admin/users', { method: 'DELETE', headers: headers(), body: JSON.stringify({ email }) })
    if (res.ok) { flash('Removed'); fetchAdmins() }
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

  const startEdit = (job) => { setEditing(job); setForm({ ...job, images: job.images || [] }) }
  const startNew = () => { setEditing(null); setForm(EMPTY_JOB) }

  if (auth === 'loading') return <div style={S.center}>Loading...</div>
  if (auth === 'denied') return (
    <div style={S.center}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Admin access required</div>
      <div style={{ color: '#888', marginBottom: 24 }}>Sign in with an admin account.</div>
      <button style={S.btnP} onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })}>
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

      <div style={S.shell}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Admin Dashboard</div>
            <div style={{ fontSize: 12, color: '#aaa' }}>{currentEmail}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['jobs','applications','admins'].map(t => (
              <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }} onClick={() => setTab(t)}>
                {t === 'jobs' ? `Jobs (${jobs.length})` : t === 'applications' ? `Applications (${apps.length})` : `Admins (${admins.length})`}
              </button>
            ))}
          </div>
        </div>

        {msg && <div style={S.flash}>{msg}</div>}

        {/* JOBS TAB */}
        {tab === 'jobs' && (
          <>
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

            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>All Jobs</div>
              {jobs.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No jobs yet</div>}
              {jobs.map(job => (
                <div key={job.id} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {job.title}
                      <span style={{ ...S.badge, background: job.is_active ? '#dcfce7' : '#fee2e2', color: job.is_active ? '#166534' : '#991b1b' }}>
                        {job.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {job.company} · {job.location} · {job.type} · {Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M VND
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={S.btnS} onClick={() => startEdit(job)}>Edit</button>
                    <button style={S.btnS} onClick={() => handleToggle(job)}>{job.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button style={{ ...S.btnS, color: '#dc2626' }} onClick={() => handleDelete(job.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
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
                  <div style={{ fontSize: 11, color: '#bbb' }}>{new Date(app.created_at).toLocaleString()}</div>
                </div>
                <select value={app.status} onChange={e => handleStatusChange(app.id, e.target.value)} style={S.sel}>
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="contacted">Contacted</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                </select>
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
                onKeyDown={e => e.key === 'Enter' && handleAddAdmin()}
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
  shell: { maxWidth: 900, margin: '0 auto', padding: '0 20px 60px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0 20px', flexWrap: 'wrap', gap: 12 },
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
