import { useState, useEffect } from 'react'

export default function ResumesView({ token, t }) {
  const [resumes, setResumes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, public, private

  useEffect(() => {
    async function fetchResumes() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/resumes', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setResumes(await res.json())
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    fetchResumes()
  }, [token])

  function downloadCsv() {
    if (!resumes || resumes.length === 0) return
    const headers = ['Name', 'Email', 'Position', 'YoE (months)', 'Location', 'University', 'Work Type', 'Public', 'Resume URL', 'Updated']
    const rows = resumes.map(r => [
      r.full_name,
      r.email,
      r.position || '',
      r.yoe_months ?? '',
      r.location || '',
      r.university || '',
      r.work_type || '',
      r.is_resume_public ? 'Yes' : 'No',
      r.resume_url,
      r.updated_at ? new Date(r.updated_at).toLocaleString('ko-KR') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resume-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.resumesLoading}</div>
  if (!resumes || resumes.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.resumesEmpty}</div>

  const filtered = resumes.filter(r => {
    if (filter === 'public' && !r.is_resume_public) return false
    if (filter === 'private' && r.is_resume_public) return false
    if (search) {
      const q = search.toLowerCase()
      return (r.full_name || '').toLowerCase().includes(q)
        || (r.email || '').toLowerCase().includes(q)
        || (r.position || '').toLowerCase().includes(q)
        || (r.university || '').toLowerCase().includes(q)
    }
    return true
  })

  const publicCount = resumes.filter(r => r.is_resume_public).length

  function formatYoe(months) {
    if (months === null || months === undefined) return '-'
    if (months === 0) return 'New grad'
    const y = Math.floor(months / 12)
    const m = months % 12
    if (y === 0) return `${m}m`
    if (m === 0) return `${y}y`
    return `${y}y ${m}m`
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t.resumesTitle}</h3>
          <span style={{ fontSize: 14, color: '#6B7280' }}>
            {t.resumesTotal}: <strong style={{ color: '#14B8A6' }}>{resumes.length}</strong>{t.resumesUnit}
            <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
            {t.resumesPublic}: <strong style={{ color: '#10B981' }}>{publicCount}</strong>{t.resumesUnit}
          </span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{t.resumesNote}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.resumesSearch}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 200 }}
          />
          <div style={{ display: 'flex', gap: 0, background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
            {[
              { key: 'all', label: t.resumesFilterAll },
              { key: 'public', label: t.resumesFilterPublic },
              { key: 'private', label: t.resumesFilterPrivate },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: filter === f.key ? '#fff' : 'transparent',
                  color: filter === f.key ? '#111' : '#999',
                  boxShadow: filter === f.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={downloadCsv}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13,
              background: '#10B981', color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}>
            {t.resumesDownloadCsv}
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesName}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesEmail}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesPosition}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesYoe}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesLocation}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesUniversity}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{t.resumesPublicLabel}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{t.resumesFile}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesUpdated}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '8px 12px', color: '#999' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.photo_url ? (
                        <img src={r.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>
                          {(r.full_name || '?')[0]}
                        </div>
                      )}
                      <div>
                        <div>{r.full_name || '-'}</div>
                        {r.headline && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{r.headline}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{r.email || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {r.position ? (
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#4F46E5' }}>
                        {r.position}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{formatYoe(r.yoe_months)}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{r.location || '-'}</td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {r.university || '-'}
                    {r.major && <span style={{ color: '#999' }}> / {r.major}</span>}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: r.is_resume_public ? '#D1FAE5' : '#F3F4F6',
                      color: r.is_resume_public ? '#065F46' : '#999',
                    }}>
                      {r.is_resume_public ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <a href={r.resume_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#14B8A6', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
                      PDF
                    </a>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {r.updated_at ? new Date(r.updated_at).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.resumesNoMatch}</div>
        )}
      </div>
    </>
  )
}
