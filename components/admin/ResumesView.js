import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 유입 출처 배지. resume_source(cv/profile/jobs/app)가 있으면 그걸로, 없으면
// 구버전 데이터의 resume_platform(app/web)로 폴백. NULL은 '미상'.
function SourceBadge({ source, platform }) {
  const sourceMap = {
    cv:      { label: 'CV 광고',   bg: '#FFEDD5', color: '#C2410C' },
    profile: { label: '프로필',    bg: '#DBEAFE', color: '#1D4ED8' },
    jobs:    { label: '채용 지원', bg: '#FCE7F3', color: '#BE185D' },
    app:     { label: '앱',        bg: '#EEF2FF', color: '#4F46E5' },
  }
  if (source && sourceMap[source]) {
    const s = sourceMap[source]
    return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
  }
  // Legacy rows: source 미기록 → platform 기준 거친 분류.
  const platformMap = {
    app: { label: '앱',        bg: '#EEF2FF', color: '#4F46E5' },
    web: { label: '웹 (이전)', bg: '#F0FDF4', color: '#15803D' },
  }
  const p = platformMap[platform]
  if (!p) return <span style={{ color: '#ccc', fontSize: 11 }}>미상</span>
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: p.bg, color: p.color }}>{p.label}</span>
}

function resolveSource(r) {
  if (r.resume_source) return r.resume_source
  if (r.resume_platform === 'app') return 'app'
  if (r.resume_platform === 'web') return 'web_legacy'
  return null
}

export default function ResumesView({ token, t }) {
  const { data: resumes, isLoading: loading, mutate } = useAdmin('/api/admin/resumes', token)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, public, private
  const [sourceFilter, setSourceFilter] = useState('all') // all | cv | profile | jobs | app | web_legacy
  const [parsing, setParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0, name: '' })
  const [parseResults, setParseResults] = useState(null)

  function downloadCsv() {
    if (!resumes || resumes.length === 0) return
    const headers = ['Name', 'Email', 'Source', 'Platform', 'Position', 'YoE (months)', 'Skills', 'Location', 'University', 'Major', 'Work Type', 'Public', 'Resume URL', 'Updated']
    const rows = filtered.map(r => [
      r.full_name,
      r.email,
      r.resume_source || '',
      r.resume_platform || '',
      r.position || '',
      r.yoe_months ?? '',
      Array.isArray(r.skills) ? r.skills.join(', ') : (r.skills || ''),
      r.location || '',
      r.university || '',
      r.major || '',
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

  const unfilled = resumes ? resumes.filter(r => !r.position && (!r.skills || (Array.isArray(r.skills) && r.skills.length === 0))) : []

  async function runAiParse() {
    if (parsing || unfilled.length === 0) return
    setParsing(true)
    setParseResults(null)
    const results = { success: 0, fail: 0, errors: [] }

    for (let i = 0; i < unfilled.length; i++) {
      const user = unfilled[i]
      setParseProgress({ current: i + 1, total: unfilled.length, name: user.full_name || user.email || 'Unknown' })
      try {
        const res = await fetch('/api/admin/parse-resumes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id }),
        })
        if (res.ok) {
          const parsed = await res.json()
          // Update local state
          mutate(prev => prev.map(r => r.id === user.id ? { ...r, ...parsed, skills: parsed.skills } : r), false)
          results.success++
        } else {
          const err = await res.json()
          results.fail++
          results.errors.push(`${user.full_name || user.email}: ${err.error}`)
        }
      } catch (e) {
        results.fail++
        results.errors.push(`${user.full_name || user.email}: ${e.message}`)
      }
    }

    setParseResults(results)
    setParsing(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.resumesLoading}</div>
  if (!resumes || resumes.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.resumesEmpty}</div>

  const filtered = resumes.filter(r => {
    if (filter === 'public' && !r.is_resume_public) return false
    if (filter === 'private' && r.is_resume_public) return false
    if (sourceFilter !== 'all') {
      const s = resolveSource(r)
      if (sourceFilter === 'unknown' ? s !== null : s !== sourceFilter) return false
    }
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
          <div style={{ display: 'flex', gap: 0, background: '#f3f4f6', borderRadius: 8, padding: 2, flexWrap: 'wrap' }}>
            {[
              { key: 'all',        label: '전체' },
              { key: 'cv',         label: 'CV 광고' },
              { key: 'profile',    label: '프로필' },
              { key: 'jobs',       label: '채용 지원' },
              { key: 'app',        label: '앱' },
              { key: 'web_legacy', label: '웹 (이전)' },
              { key: 'unknown',    label: '미상' },
            ].map(f => {
              const count = f.key === 'all' ? resumes.length
                : f.key === 'unknown' ? resumes.filter(r => resolveSource(r) === null).length
                : resumes.filter(r => resolveSource(r) === f.key).length
              return (
                <button key={f.key} onClick={() => setSourceFilter(f.key)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: sourceFilter === f.key ? '#fff' : 'transparent',
                    color: sourceFilter === f.key ? '#111' : '#999',
                    boxShadow: sourceFilter === f.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {f.label} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{count}</span>
                </button>
              )
            })}
          </div>
          <button onClick={runAiParse} disabled={parsing || unfilled.length === 0}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13,
              background: parsing ? '#9CA3AF' : '#4F46E5', color: '#fff', cursor: parsing ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}>
            {parsing ? `AI 분석 중... (${parseProgress.current}/${parseProgress.total})` : `AI 분석 돌리기 (${unfilled.length}명)`}
          </button>
          <button onClick={downloadCsv}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13,
              background: '#10B981', color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}>
            {t.resumesDownloadCsv}
          </button>
        </div>
      </div>

      {/* AI Parse Progress */}
      {parsing && (
        <div style={{ marginBottom: 16, padding: 16, background: '#EEF2FF', borderRadius: 12, border: '1px solid #C7D2FE' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5' }}>
              {parseProgress.name} 분석 중...
            </span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {parseProgress.current} / {parseProgress.total}
            </span>
          </div>
          <div style={{ height: 6, background: '#C7D2FE', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#4F46E5', borderRadius: 3, transition: 'width 0.3s',
              width: `${(parseProgress.current / parseProgress.total) * 100}%`,
            }} />
          </div>
        </div>
      )}

      {/* AI Parse Results */}
      {parseResults && (
        <div style={{
          marginBottom: 16, padding: 16, borderRadius: 12,
          background: parseResults.fail > 0 ? '#FEF3C7' : '#D1FAE5',
          border: `1px solid ${parseResults.fail > 0 ? '#FDE68A' : '#A7F3D0'}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: parseResults.errors.length > 0 ? 8 : 0 }}>
            AI 분석 완료: {parseResults.success}명 성공{parseResults.fail > 0 ? `, ${parseResults.fail}명 실패` : ''}
          </div>
          {parseResults.errors.length > 0 && (
            <div style={{ fontSize: 12, color: '#92400E' }}>
              {parseResults.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesName}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesEmail}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>유입</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesPosition}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesYoe}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Skills</th>
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
                  <td style={{ padding: '8px 12px' }}><SourceBadge source={r.resume_source} platform={r.resume_platform} /></td>
                  <td style={{ padding: '8px 12px' }}>
                    {r.position ? (
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#4F46E5' }}>
                        {r.position}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{formatYoe(r.yoe_months)}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200 }}>
                    {r.skills && (Array.isArray(r.skills) ? r.skills : r.skills.split(', ')).filter(Boolean).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {(Array.isArray(r.skills) ? r.skills : r.skills.split(', ')).filter(Boolean).slice(0, 5).map((s, i) => (
                          <span key={i} style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, background: '#F3F4F6', color: '#374151' }}>{s}</span>
                        ))}
                        {(Array.isArray(r.skills) ? r.skills : r.skills.split(', ')).filter(Boolean).length > 5 && (
                          <span style={{ fontSize: 10, color: '#999' }}>+{(Array.isArray(r.skills) ? r.skills : r.skills.split(', ')).filter(Boolean).length - 5}</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
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
