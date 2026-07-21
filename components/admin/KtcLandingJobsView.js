import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// KTC 랜딩 공고 관리 — ktc-landing(별도 Supabase)의 jobs를 FYI 어드민에서 목록/등록/수정/노출 토글.
// 저장 즉시 랜딩 사이트(활성 공고만 노출)에 반영된다. 데이터: /api/admin/ktc-landing-jobs

const EMPTY = {
  company_name: '', title: '', job_id: '', location: '', work_type: '', category: '', industry: '',
  experience: '', headcount: '', salary_min: '', salary_max: '', company_website: '', company_logo: '',
  description: '', responsibilities: '', requirements: '', benefits: '',
  is_matching_week: false, is_active: true,
}

const input = { width: '100%', fontSize: 13.5, padding: '9px 12px', border: '1px solid #E5E8EB', borderRadius: 10, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5, display: 'block' }

export default function KtcLandingJobsView({ token, lang }) {
  const ko = lang === 'ko'
  const L = (k, e, v) => (lang === 'vi' ? (v ?? e) : ko ? k : e)
  const { data, error, isLoading, mutate } = useAdmin('/api/admin/ktc-landing-jobs', token)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | job.id
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const jobs = data?.jobs || []

  const openEdit = (job) => {
    const f = { ...EMPTY }
    for (const k of Object.keys(EMPTY)) f[k] = job[k] ?? EMPTY[k]
    setForm(f); setEditing(job.id); setMsg(null)
  }

  async function save() {
    if (!form.company_name.trim() || !form.title.trim()) {
      setMsg(L('회사명과 공고 제목은 필수야', 'Company and title are required', 'Bắt buộc nhập công ty và tiêu đề'))
      return
    }
    setSaving(true); setMsg(null)
    try {
      const body = {
        ...form,
        salary_min: form.salary_min === '' ? null : Number(form.salary_min),
        salary_max: form.salary_max === '' ? null : Number(form.salary_max),
        headcount: form.headcount === '' ? null : Number(form.headcount),
      }
      if (editing !== 'new') body.id = editing
      const res = await fetch('/api/admin/ktc-landing-jobs', {
        method: editing === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`)
      setEditing(null)
      mutate()
    } catch (e) {
      setMsg((L('저장 실패: ', 'Save failed: ', 'Lưu thất bại: ')) + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(job) {
    try {
      const res = await fetch('/api/admin/ktc-landing-jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: job.id, is_active: !job.is_active }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      mutate()
    } catch (e) {
      alert((L('변경 실패: ', 'Failed: ', 'Thất bại: ')) + e.message)
    }
  }

  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{L('불러오기 실패', 'Failed to load', 'Tải thất bại')} — {error.message}</div>
  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const q = search.trim().toLowerCase()
  const searched = q ? jobs.filter(j => [j.title, j.company_name, j.job_id, j.category].some(v => (v || '').toLowerCase().includes(q))) : jobs
  const filtered = searched.filter(j => (filter === 'active' ? j.is_active : filter === 'hidden' ? !j.is_active : true))
  const activeCount = searched.filter(j => j.is_active).length

  const field = (key, labelTxt, props = {}) => (
    <div style={{ flex: props.flex || 1, minWidth: props.minWidth || 140 }}>
      <label style={lbl}>{labelTxt}</label>
      <input style={input} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} {...(props.placeholder ? { placeholder: props.placeholder } : {})} />
    </div>
  )
  const area = (key, labelTxt) => (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{labelTxt}</label>
      <textarea style={{ ...input, minHeight: 88, resize: 'vertical', lineHeight: 1.5 }} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={L('• 항목별로 줄바꿈', '• one item per line', '• mỗi dòng một mục')} />
    </div>
  )

  // ── 등록/수정 폼 ──
  if (editing !== null) {
    return (
      <div style={{ minHeight: '70vh', paddingBottom: 60 }}>
        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
          ← {L('목록으로', 'Back to list', 'Về danh sách')}
        </button>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 16px' }}>
          {editing === 'new' ? L('KTC 랜딩 공고 등록', 'New landing job', 'Đăng tin landing mới') : L('KTC 랜딩 공고 수정', 'Edit landing job', 'Sửa tin landing')}
        </h3>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {field('company_name', L('회사명 *', 'Company *', 'Công ty *'))}
          {field('title', L('공고 제목 *', 'Title *', 'Tiêu đề *'), { flex: 2, minWidth: 220 })}
          {field('job_id', L('공고 코드', 'Job code', 'Mã tin'), { placeholder: 'YD1904', minWidth: 100 })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {field('location', L('근무지', 'Location', 'Địa điểm'), { placeholder: 'Ho Chi Minh City' })}
          {field('work_type', L('근무 형태', 'Work type', 'Hình thức'), { placeholder: 'Full-time / Remote' })}
          {field('category', L('직군', 'Category', 'Nhóm ngành'), { placeholder: 'Development / Marketing' })}
          {field('industry', L('산업', 'Industry', 'Ngành'), { placeholder: 'E-commerce' })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {field('salary_min', L('급여 최소 (VND)', 'Salary min (VND)', 'Lương tối thiểu (VND)'), { placeholder: '15000000' })}
          {field('salary_max', L('급여 최대 (VND)', 'Salary max (VND)', 'Lương tối đa (VND)'), { placeholder: '25000000' })}
          {field('experience', L('경력', 'Experience', 'Kinh nghiệm'), { placeholder: '2+ years' })}
          {field('headcount', L('채용 인원', 'Headcount', 'Số lượng'), { placeholder: '1', minWidth: 90 })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          {field('company_website', L('회사 웹사이트', 'Company website', 'Website'), { placeholder: 'https://…' })}
          {field('company_logo', L('로고 URL', 'Logo URL', 'URL logo'), { placeholder: 'https://…' })}
        </div>

        {area('description', L('회사/포지션 소개', 'Description', 'Giới thiệu'))}
        {area('responsibilities', L('담당 업무', 'Responsibilities', 'Công việc'))}
        {area('requirements', L('자격 요건', 'Requirements', 'Yêu cầu'))}
        {area('benefits', L('복지·혜택', 'Benefits', 'Phúc lợi'))}

        <div style={{ display: 'flex', gap: 20, alignItems: 'center', margin: '4px 0 18px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: '#191F28', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            {L('랜딩에 노출', 'Visible on landing', 'Hiển thị trên landing')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: '#191F28', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.is_matching_week} onChange={e => setForm(f => ({ ...f, is_matching_week: e.target.checked }))} />
            {L('매칭위크 공고', 'Matching week', 'Matching week')}
          </label>
        </div>

        {msg && <div style={{ fontSize: 13, color: '#c00', fontWeight: 600, marginBottom: 12 }}>{msg}</div>}
        <button onClick={save} disabled={saving} style={{
          padding: '11px 26px', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
          background: saving ? '#E5E8EB' : '#ff4400', color: saving ? '#9CA3AF' : '#fff', cursor: saving ? 'default' : 'pointer',
        }}>
          {saving ? L('저장 중…', 'Saving…', 'Đang lưu…') : editing === 'new' ? L('등록', 'Create', 'Đăng') : L('저장', 'Save', 'Lưu')}
        </button>
      </div>
    )
  }

  // ── 목록 ──
  const FILTERS = [
    ['all', L('전체', 'All', 'Tất cả'), searched.length],
    ['active', L('노출중', 'Live', 'Đang hiển thị'), activeCount],
    ['hidden', L('비노출', 'Hidden', 'Đang ẩn'), searched.length - activeCount],
  ]
  const fmtSalary = (j) => {
    if (!j.salary_min && !j.salary_max) return null
    const m = (n) => (n ? `${Math.round(n / 1e6)}M` : '?')
    return `${m(j.salary_min)}–${m(j.salary_max)} VND`
  }

  return (
    <div style={{ minHeight: '70vh' }}>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('검색  ·  제목 · 회사 · 코드', 'Search  ·  title · company · code', 'Tìm  ·  tiêu đề · công ty · mã')}
        style={{ ...input, maxWidth: 380, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(([key, labelTxt, n]) => {
          const on = filter === key
          return (
            <button key={key} onClick={() => setFilter(key)} style={{
              fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '7px 14px',
              border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
              background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968',
            }}>
              {labelTxt} <span style={{ opacity: on ? 0.7 : 0.5 }}>{n}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && <div style={{ color: '#aaa', fontSize: 13, padding: '8px 0' }}>{L('해당 공고 없음', 'No matching jobs', 'Không có tin phù hợp')}</div>}
      {filtered.map(job => (
        <div key={job.id} style={{ background: '#fff', border: '1px solid #EEF0F2', borderRadius: 14, padding: '15px 17px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8B95A1', marginBottom: 3 }}>
                {job.company_name}{job.job_id ? ` · ${job.job_id}` : ''}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#191F28', letterSpacing: '-0.01em' }}>{job.title}</div>
              <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[job.category, job.location, fmtSalary(job), job.created_at ? new Date(job.created_at).toLocaleDateString() : null]
                  .filter(Boolean).map((t, i) => <span key={i}>{t}</span>)}
              </div>
            </div>
            <span style={{
              flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: job.is_active ? '#E7F6EC' : '#F1F3F5', color: job.is_active ? '#1B7A43' : '#868E96',
            }}>
              {job.is_active ? L('노출중', 'Live', 'Hiển thị') : L('비노출', 'Hidden', 'Ẩn')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => openEdit(job)} style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', background: '#fff', border: '1px solid #E5E8EB', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
              {L('수정', 'Edit', 'Sửa')}
            </button>
            <button onClick={() => toggleActive(job)} style={{ fontSize: 12, fontWeight: 600, color: job.is_active ? '#C2410C' : '#1B7A43', background: '#fff', border: '1px solid #E5E8EB', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
              {job.is_active ? L('내리기', 'Hide', 'Ẩn tin') : L('노출하기', 'Publish', 'Hiển thị')}
            </button>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.5 }}>
        {L(
          'ktc-landing 별도 DB의 공고를 직접 관리 — 저장/토글 즉시 랜딩 사이트에 반영됨. 랜딩 지원자는 시트→ktc-support 경유로 KTC 소싱 탭에 집계돼.',
          'Manages jobs in the separate ktc-landing DB — changes go live on the landing site immediately. Landing applicants flow into the KTC sources tab via the sheet.',
          'Quản lý tin trong DB riêng của ktc-landing — thay đổi hiển thị ngay trên trang landing. Ứng viên landing được tổng hợp ở tab Nguồn KTC.'
        )}
      </div>
    </div>
  )
}
