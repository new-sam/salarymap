import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'

const ADMIN_EMAILS = ['slsvm@hotmail.com', 'kee@likelion.net']

const EMPTY_JOB = {
  title: '', company: '', company_initials: '', location: '', type: 'remote',
  country: 'korea', role: 'Backend', experience_min: 1, experience_max: 5,
  salary_min: 50000000, salary_max: 80000000, description: '', is_active: true,
}

const ROLES = ['Backend','Frontend','Mobile','Data · AI','DevOps','PM · PO','Design','QA']
const TYPES = ['remote','onsite','hybrid']
const COUNTRIES = ['korea','vietnam','global']

export default function AdminJobs() {
  const [auth, setAuth] = useState('loading') // loading | denied | ok
  const [token, setToken] = useState(null)
  const [jobs, setJobs] = useState([])
  const [apps, setApps] = useState([])
  const [tab, setTab] = useState('jobs') // jobs | applications
  const [editing, setEditing] = useState(null) // null or job object
  const [form, setForm] = useState(EMPTY_JOB)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setAuth('denied'); return }
      if (!ADMIN_EMAILS.includes(session.user.email)) { setAuth('denied'); return }
      setToken(session.access_token)
      setAuth('ok')
    })
  }, [])

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

  // Fetch data
  useEffect(() => {
    if (auth !== 'ok') return
    fetchJobs()
    fetchApps()
  }, [auth])

  const fetchJobs = async () => {
    const res = await fetch('/api/admin/jobs', { headers: headers() })
    if (res.ok) setJobs(await res.json())
  }

  const fetchApps = async () => {
    const res = await fetch('/api/admin/applications', { headers: headers() })
    if (res.ok) setApps(await res.json())
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
    }
    if (editing) {
      await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: editing.id, ...payload }) })
      flash('Updated')
    } else {
      await fetch('/api/admin/jobs', { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
      flash('Created')
    }
    setSaving(false)
    setEditing(null)
    setForm(EMPTY_JOB)
    fetchJobs()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this job?')) return
    await fetch('/api/admin/jobs', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    flash('Deleted')
    fetchJobs()
  }

  const handleToggle = async (job) => {
    await fetch('/api/admin/jobs', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: job.id, is_active: !job.is_active }) })
    fetchJobs()
  }

  const handleStatusChange = async (appId, status) => {
    await fetch('/api/admin/applications', { method: 'PUT', headers: headers(), body: JSON.stringify({ id: appId, status }) })
    fetchApps()
  }

  const startEdit = (job) => {
    setEditing(job)
    setForm({ ...job })
  }

  const startNew = () => {
    setEditing(null)
    setForm(EMPTY_JOB)
  }

  if (auth === 'loading') return <div style={styles.center}>Loading...</div>
  if (auth === 'denied') return (
    <div style={styles.center}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Admin access required</div>
      <div style={{ color: '#888', marginBottom: 24 }}>Sign in with an admin account.</div>
      <button style={styles.btnPrimary} onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback?next=/admin/jobs' } })}>
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

      <div style={styles.shell}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Jobs Admin</div>
            <div style={{ fontSize: 12, color: '#aaa' }}>Manage job listings & applications</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...styles.tab, ...(tab === 'jobs' ? styles.tabActive : {}) }} onClick={() => setTab('jobs')}>
              Jobs ({jobs.length})
            </button>
            <button style={{ ...styles.tab, ...(tab === 'applications' ? styles.tabActive : {}) }} onClick={() => setTab('applications')}>
              Applications ({apps.length})
            </button>
          </div>
        </div>

        {msg && <div style={styles.flash}>{msg}</div>}

        {/* JOBS TAB */}
        {tab === 'jobs' && (
          <>
            {/* Form */}
            <div style={styles.card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                {editing ? `Edit: ${editing.title}` : 'New Job'}
              </div>

              <div style={styles.formGrid}>
                <Field label="Title" value={form.title} onChange={v => setForm({ ...form, title: v })} />
                <Field label="Company" value={form.company} onChange={v => setForm({ ...form, company: v })} />
                <Field label="Initials" value={form.company_initials} onChange={v => setForm({ ...form, company_initials: v })} half />
                <Field label="Location" value={form.location} onChange={v => setForm({ ...form, location: v })} half />
                <Select label="Type" value={form.type} options={TYPES} onChange={v => setForm({ ...form, type: v })} />
                <Select label="Country" value={form.country} options={COUNTRIES} onChange={v => setForm({ ...form, country: v })} />
                <Select label="Role" value={form.role} options={ROLES} onChange={v => setForm({ ...form, role: v })} />
                <Field label="Exp Min (yrs)" value={form.experience_min} type="number" onChange={v => setForm({ ...form, experience_min: v })} half />
                <Field label="Exp Max (yrs)" value={form.experience_max} type="number" onChange={v => setForm({ ...form, experience_max: v })} half />
                <Field label="Salary Min (VND)" value={form.salary_min} type="number" onChange={v => setForm({ ...form, salary_min: v })} />
                <Field label="Salary Max (VND)" value={form.salary_max} type="number" onChange={v => setForm({ ...form, salary_max: v })} />
              </div>

              <div style={{ marginTop: 8 }}>
                <label style={styles.label}>Description</label>
                <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ ...styles.input, height: 80, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={styles.btnPrimary} onClick={handleSave} disabled={saving || !form.title || !form.company}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
                {editing && <button style={styles.btnGhost} onClick={startNew}>Cancel</button>}
              </div>
            </div>

            {/* Job list */}
            <div style={styles.card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>All Jobs</div>
              {jobs.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No jobs yet</div>}
              {jobs.map(job => (
                <div key={job.id} style={styles.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {job.title}
                      <span style={{ ...styles.badge, background: job.is_active ? '#dcfce7' : '#fee2e2', color: job.is_active ? '#166534' : '#991b1b' }}>
                        {job.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {job.company} · {job.location} · {job.type} · {Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M VND
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={styles.btnSmall} onClick={() => startEdit(job)}>Edit</button>
                    <button style={styles.btnSmall} onClick={() => handleToggle(job)}>
                      {job.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button style={{ ...styles.btnSmall, color: '#dc2626' }} onClick={() => handleDelete(job.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* APPLICATIONS TAB */}
        {tab === 'applications' && (
          <div style={styles.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Applications</div>
            {apps.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No applications yet</div>}
            {apps.map(app => (
              <div key={app.id} style={styles.row}>
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
                <select
                  value={app.status}
                  onChange={e => handleStatusChange(app.id, e.target.value)}
                  style={styles.statusSelect}
                >
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
      </div>
    </>
  )
}

function Field({ label, value, onChange, type = 'text', half }) {
  return (
    <div style={half ? { gridColumn: 'span 1' } : {}}>
      <label style={styles.label}>{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={styles.input} />
    </div>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} style={styles.input}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

const styles = {
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif" },
  shell: { maxWidth: 900, margin: '0 auto', padding: '0 20px 60px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0 20px', flexWrap: 'wrap', gap: 12 },
  tab: { fontSize: 13, fontWeight: 600, color: '#888', background: '#fff', border: '1px solid #eee', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' },
  tabActive: { background: '#111', color: '#fff', borderColor: '#111' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: '20px 24px', marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  label: { display: 'block', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input: { width: '100%', fontSize: 13, padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 6, outline: 'none', fontFamily: 'inherit' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' },
  badge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginLeft: 8 },
  btnPrimary: { fontSize: 13, fontWeight: 700, color: '#fff', background: '#ff4400', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer' },
  btnGhost: { fontSize: 13, fontWeight: 600, color: '#888', background: 'none', border: '1px solid #ddd', padding: '10px 24px', borderRadius: 8, cursor: 'pointer' },
  btnSmall: { fontSize: 11, fontWeight: 600, color: '#555', background: '#f5f5f5', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' },
  statusSelect: { fontSize: 12, padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 6, outline: 'none', fontFamily: 'inherit', flexShrink: 0 },
  flash: { background: '#dcfce7', color: '#166534', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, marginBottom: 12 },
}
