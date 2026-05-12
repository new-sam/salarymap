import { useState, useEffect } from 'react'
import Link from 'next/link'
import HRLayout from '../../components/HRLayout'
import { supabase } from '../../lib/supabaseClient'

const JOB_TYPES = [
  { value: 'full-time', label: '정규직' },
  { value: 'contract', label: '계약직' },
  { value: 'intern', label: '인턴' },
  { value: 'part-time', label: '파트타임' },
]

const EXP_LEVELS = [
  { value: 'entry', label: '신입' },
  { value: 'junior', label: '주니어 (1~3년)' },
  { value: 'mid', label: '미드 (3~5년)' },
  { value: 'senior', label: '시니어 (5년+)' },
  { value: 'any', label: '경력무관' },
]

function JobForm({ onSubmit, onCancel, initial }) {
  const [form, setForm] = useState({
    title: '', company: '', description: '', location: '',
    tech_stack: '', benefits: '', deadline: '', headcount: '',
    salary_min: '', salary_max: '', salary_currency: 'KRW',
    job_type: 'full-time', experience_level: 'any',
    ...initial,
    tech_stack: initial?.tech_stack?.join(', ') || '',
    benefits: initial?.benefits?.join(', ') || '',
    headcount: initial?.headcount || '',
    salary_min: initial?.salary_min || '',
    salary_max: initial?.salary_max || '',
  })
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handle = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.company.trim()) return alert('공고 제목과 회사명은 필수입니다.')
    setSubmitting(true)
    await onSubmit({
      ...form,
      tech_stack: form.tech_stack ? form.tech_stack.split(',').map(s => s.trim()).filter(Boolean) : [],
      benefits: form.benefits ? form.benefits.split(',').map(s => s.trim()).filter(Boolean) : [],
      headcount: form.headcount ? parseInt(form.headcount) : null,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
    })
    setSubmitting(false)
  }

  const inputStyle = {
    width: '100%', background: '#fff', border: '1px solid #eee', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, color: '#111', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, display: 'block' }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  return (
    <form onSubmit={handle}>
      <style>{`
        .hjf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .hjf-full { grid-column: 1 / -1; }
        .hjf-group { margin-bottom: 0; }
        .hjf-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0f0; }
        .hjf-submit { background: #ff6000; color: #fff; border: none; border-radius: 8px; padding: 10px 28px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .hjf-submit:disabled { opacity: 0.5; }
        .hjf-cancel { background: #fff; color: #888; border: 1px solid #eee; border-radius: 8px; padding: 10px 24px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
        @media (max-width: 600px) { .hjf-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="hjf-grid">
        <div className="hjf-group">
          <label style={labelStyle}>공고 제목 *</label>
          <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="예: Frontend Developer" required />
        </div>
        <div className="hjf-group">
          <label style={labelStyle}>회사명 *</label>
          <input style={inputStyle} value={form.company} onChange={e => set('company', e.target.value)} placeholder="예: 멋쟁이사자처럼" required />
        </div>

        <div className="hjf-group hjf-full">
          <label style={labelStyle}>상세 설명</label>
          <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="직무 설명, 자격 요건, 우대 사항 등..." />
        </div>

        <div className="hjf-group">
          <label style={labelStyle}>근무 형태</label>
          <select style={selectStyle} value={form.job_type} onChange={e => set('job_type', e.target.value)}>
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="hjf-group">
          <label style={labelStyle}>경력 수준</label>
          <select style={selectStyle} value={form.experience_level} onChange={e => set('experience_level', e.target.value)}>
            {EXP_LEVELS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="hjf-group">
          <label style={labelStyle}>근무지</label>
          <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="예: 서울 강남구" />
        </div>
        <div className="hjf-group">
          <label style={labelStyle}>채용 인원</label>
          <input style={inputStyle} type="number" min="1" value={form.headcount} onChange={e => set('headcount', e.target.value)} placeholder="예: 2" />
        </div>

        <div className="hjf-group">
          <label style={labelStyle}>기술 스택 (쉼표 구분)</label>
          <input style={inputStyle} value={form.tech_stack} onChange={e => set('tech_stack', e.target.value)} placeholder="예: React, TypeScript, Node.js" />
        </div>
        <div className="hjf-group">
          <label style={labelStyle}>복리후생 (쉼표 구분)</label>
          <input style={inputStyle} value={form.benefits} onChange={e => set('benefits', e.target.value)} placeholder="예: 유연근무, 점심제공, 스톡옵션" />
        </div>

        <div className="hjf-group">
          <label style={labelStyle}>연봉 범위 (최소)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} placeholder="예: 40000000" />
            <select style={{ ...selectStyle, width: 80, flex: 'none' }} value={form.salary_currency} onChange={e => set('salary_currency', e.target.value)}>
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="VND">VND</option>
            </select>
          </div>
        </div>
        <div className="hjf-group">
          <label style={labelStyle}>연봉 범위 (최대)</label>
          <input style={inputStyle} type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} placeholder="예: 60000000" />
        </div>

        <div className="hjf-group">
          <label style={labelStyle}>마감일</label>
          <input style={inputStyle} type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
        </div>
      </div>

      <div className="hjf-actions">
        {onCancel && <button type="button" className="hjf-cancel" onClick={onCancel}>취소</button>}
        <button type="submit" className="hjf-submit" disabled={submitting}>
          {submitting ? '등록중...' : (initial ? '수정하기' : '공고 등록')}
        </button>
      </div>
    </form>
  )
}

export default function HRHiring() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState(null)

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const fetchJobs = async () => {
    const token = await getToken()
    if (!token) return

    setLoading(true)
    try {
      const r = await fetch('/api/hr/my-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const data = await r.json()
        setJobs(data.jobs || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchJobs() }, [])

  const createJob = async (form) => {
    const token = await getToken()
    if (!token) return

    const r = await fetch('/api/hr/my-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    if (r.ok) {
      setShowForm(false)
      fetchJobs()
    } else {
      const err = await r.json()
      alert(err.error || '등록 실패')
    }
  }

  const updateJob = async (form) => {
    const token = await getToken()
    if (!token) return

    const r = await fetch('/api/hr/my-jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: editingJob.id, ...form }),
    })
    if (r.ok) {
      setEditingJob(null)
      fetchJobs()
    }
  }

  const toggleActive = async (job) => {
    const token = await getToken()
    if (!token) return

    await fetch('/api/hr/my-jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: job.id, is_active: !job.is_active }),
    })
    fetchJobs()
  }

  const deleteJob = async (job) => {
    if (!confirm(`'${job.title}' 공고를 삭제하시겠습니까?`)) return
    const token = await getToken()
    if (!token) return

    await fetch('/api/hr/my-jobs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: job.id }),
    })
    fetchJobs()
  }

  const activeCount = jobs.filter(j => j.is_active).length

  return (
    <HRLayout title="채용 관리">
      <style>{`
        .hrh-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .hrh-new-btn { background: #ff6000; color: #fff; border: none; border-radius: 8px; padding: 10px 24px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px; transition: opacity .15s; }
        .hrh-new-btn:hover { opacity: 0.85; }
        .hrh-form-wrap { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 28px; margin-bottom: 24px; }
        .hrh-form-title { font-size: 16px; font-weight: 700; color: #111; margin: 0 0 20px; }
        .hrh-list { display: flex; flex-direction: column; gap: 12px; }
        .hrh-card { background: #fff; border: 1px solid #eee; border-radius: 14px; padding: 20px 24px; transition: all .2s; }
        .hrh-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.05); border-color: #ddd; }
        .hrh-card-top { display: flex; align-items: flex-start; gap: 14px; }
        .hrh-card-info { flex: 1; min-width: 0; }
        .hrh-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .hrh-card-btn { font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .hrh-app-bar { display: flex; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #f5f5f5; }
        .hrh-app-stat { flex: 1; text-align: center; padding: 10px 0; border-radius: 8px; }
        .hrh-summary { display: flex; gap: 12px; margin-bottom: 24px; }
        .hrh-summary-card { flex: 1; background: #fff; border: 1px solid #f0f0f0; border-radius: 10px; padding: 16px; text-align: center; }
        .hrh-summary-num { font-size: 24px; font-weight: 800; color: #111; }
        .hrh-summary-label { font-size: 11px; color: #999; margin-top: 2px; }
        .hrh-empty { text-align: center; padding: 60px 20px; }
      `}</style>

      {/* Top bar */}
      <div className="hrh-top">
        <div>
          <span style={{ fontSize: 13, color: '#999' }}>등록된 공고 <strong style={{ color: '#111' }}>{jobs.length}</strong>건 (진행중 {activeCount}건)</span>
        </div>
        {!showForm && !editingJob && (
          <button className="hrh-new-btn" onClick={() => setShowForm(true)}>
            <span style={{ fontSize: 16 }}>+</span> 새 공고 등록
          </button>
        )}
      </div>

      {/* New job form */}
      {showForm && (
        <div className="hrh-form-wrap">
          <h3 className="hrh-form-title">새 채용 공고 등록</h3>
          <JobForm onSubmit={createJob} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Edit job form */}
      {editingJob && (
        <div className="hrh-form-wrap">
          <h3 className="hrh-form-title">공고 수정: {editingJob.title}</h3>
          <JobForm initial={editingJob} onSubmit={updateJob} onCancel={() => setEditingJob(null)} />
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div>
          <style>{`@keyframes hrhShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } } .hrh-sk { background: linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%); background-size: 200% 100%; animation: hrhShimmer 1.5s ease infinite; border-radius: 14px; }`}</style>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="hrh-sk" style={{ height: 130 }} />
            <div className="hrh-sk" style={{ height: 130, animationDelay: '0.1s' }} />
            <div className="hrh-sk" style={{ height: 130, animationDelay: '0.2s' }} />
          </div>
        </div>
      ) : jobs.length > 0 ? (
        <div className="hrh-list">
          {jobs.map(job => {
            const apps = job.applications
            const isExpired = job.deadline && new Date(job.deadline) < new Date()
            return (
              <div key={job.id} className="hrh-card">
                <div className="hrh-card-top">
                  <div className="hrh-card-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{job.title}</span>
                      {job.is_active && !isExpired ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: 4 }}>진행중</span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#999', background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>마감</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span>{job.company}</span>
                      {job.location && <><span>·</span><span>{job.location}</span></>}
                      {job.headcount && <><span>·</span><span>{job.headcount}명</span></>}
                      {job.deadline && <><span>·</span><span>마감 {new Date(job.deadline).toLocaleDateString('ko-KR')}</span></>}
                      {job.job_type && <><span>·</span><span>{JOB_TYPES.find(t => t.value === job.job_type)?.label || job.job_type}</span></>}
                    </div>
                    {job.tech_stack && job.tech_stack.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {job.tech_stack.map((s, i) => (
                          <span key={i} style={{ fontSize: 10, color: '#666', background: '#f0f0f0', padding: '2px 8px', borderRadius: 3 }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="hrh-card-actions">
                    <button className="hrh-card-btn"
                      style={{ background: '#fff', border: '1px solid #eee', color: '#666' }}
                      onClick={() => setEditingJob(job)}>
                      수정
                    </button>
                    <button className="hrh-card-btn"
                      style={{ background: job.is_active ? '#fff7ed' : '#f0fdf4', border: 'none', color: job.is_active ? '#f59e0b' : '#16a34a' }}
                      onClick={() => toggleActive(job)}>
                      {job.is_active ? '마감하기' : '재등록'}
                    </button>
                    <button className="hrh-card-btn"
                      style={{ background: '#fff', border: '1px solid #fecaca', color: '#ef4444' }}
                      onClick={() => deleteJob(job)}>
                      삭제
                    </button>
                    <Link href={`/hr/applicants?jobId=${job.id}`} className="hrh-card-btn"
                      style={{ background: '#ff6000', border: 'none', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                      지원자 →
                    </Link>
                  </div>
                </div>

                {/* Application stats */}
                <div className="hrh-app-bar">
                  {[
                    { key: 'total', label: '전체 지원', color: '#111', bg: '#f5f5f5' },
                    { key: 'applied', label: '신규', color: '#2563eb', bg: '#eff6ff' },
                    { key: 'viewed', label: '검토중', color: '#f59e0b', bg: '#fff7ed' },
                    { key: 'reviewing', label: '면접', color: '#7c3aed', bg: '#faf5ff' },
                    { key: 'decided', label: '결정', color: '#16a34a', bg: '#f0fdf4' },
                  ].map(s => (
                    <div key={s.key} className="hrh-app-stat" style={{ background: s.bg }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{apps[s.key] || 0}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : !showForm ? (
        <div className="hrh-empty">
          <svg width="200" height="140" viewBox="0 0 200 140" fill="none" style={{ margin: '0 auto 20px', display: 'block' }}>
            <style>{`
              @keyframes hrh-doc { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
              @keyframes hrh-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
              @keyframes hrh-ping { 0%,100% { r:3; opacity:0.3; } 50% { r:6; opacity:0; } }
              .hrh-svg-doc { animation: hrh-doc 0.7s ease both; }
              .hrh-svg-float { animation: hrh-float 3s ease-in-out infinite; }
              .hrh-svg-ping { animation: hrh-ping 2.5s ease-in-out infinite; }
            `}</style>
            <rect className="hrh-svg-doc" x="45" y="15" width="110" height="110" rx="12" fill="#fff" stroke="#f0f0f0" strokeWidth="1.5"/>
            <rect className="hrh-svg-doc" x="60" y="32" width="55" height="7" rx="3.5" fill="#ff6000" opacity="0.2" style={{animationDelay:'0.1s'}}/>
            <rect className="hrh-svg-doc" x="60" y="50" width="80" height="4" rx="2" fill="#e5e5e5" style={{animationDelay:'0.2s'}}/>
            <rect className="hrh-svg-doc" x="60" y="60" width="65" height="4" rx="2" fill="#e5e5e5" style={{animationDelay:'0.3s'}}/>
            <rect className="hrh-svg-doc" x="60" y="70" width="72" height="4" rx="2" fill="#e5e5e5" style={{animationDelay:'0.4s'}}/>
            <rect className="hrh-svg-doc" x="60" y="88" width="44" height="14" rx="7" fill="#ff6000" opacity="0.12" style={{animationDelay:'0.5s'}}/>
            <text className="hrh-svg-doc" x="82" y="98" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ff6000" style={{animationDelay:'0.5s'}}>POST</text>
            <g className="hrh-svg-float">
              <circle cx="142" cy="30" r="13" fill="#ff6000"/>
              <line x1="136" y1="30" x2="148" y2="30" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="142" y1="24" x2="142" y2="36" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </g>
            <circle className="hrh-svg-ping" cx="38" cy="50" r="3" fill="#ff6000"/>
            <circle className="hrh-svg-ping" cx="170" cy="75" r="3" fill="#2563eb" style={{animationDelay:'0.8s'}}/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 8 }}>아직 등록한 채용 공고가 없습니다</div>
          <div style={{ fontSize: 13, color: '#bbb', marginBottom: 24 }}>새 공고를 등록하면 매일 1,000명 이상의 구직자에게 노출됩니다</div>
          <button className="hrh-new-btn" onClick={() => setShowForm(true)} style={{ margin: '0 auto' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            첫 공고 등록하기
          </button>
        </div>
      ) : null}
    </HRLayout>
  )
}
