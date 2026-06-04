import { useState, useEffect } from 'react'
import { STATUS_OPTIONS, STATUS_COLORS } from '../../constants/dashboard'

export default function ApplicationsView({ token, t, dateRange }) {
  const [apps, setApps] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingNote, setEditingNote] = useState({})
  const [parsing, setParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0, name: '' })
  const [parseResults, setParseResults] = useState(null)
  const [parsedData, setParsedData] = useState({}) // { [appId]: { position, skills, yoe, headline } }

  useEffect(() => {
    fetchApps()
  }, [token, dateRange])

  async function fetchApps() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange?.from) params.set('from', dateRange.from)
      if (dateRange?.to) params.set('to', dateRange.to)
      const res = await fetch(`/api/admin/applications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setApps(await res.json())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await fetch('/api/admin/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    })
    fetchApps()
  }

  async function saveNote(id) {
    await fetch('/api/admin/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, admin_note: editingNote[id] || '' }),
    })
    setEditingNote(prev => { const n = { ...prev }; delete n[id]; return n })
    fetchApps()
  }

  // Applicants with resume but no role parsed yet
  const unparsed = apps ? apps.filter(a => a.resume_url && !a.applicant_role && !parsedData[a.id]) : []

  function downloadCsv() {
    if (!apps || apps.length === 0) return
    const headers = ['Name', 'Email', 'Job', 'Company', 'Position', 'YoE', 'Skills', 'Headline', 'Status', 'Resume URL', 'Note', 'Applied']
    const rows = apps.map(a => [
      a.user_name || a.applicant_name || '',
      a.user_email || a.applicant_email || '',
      a.job_title || a.jobs?.title || '',
      a.job_company || a.jobs?.company || '',
      a.applicant_role || parsedData[a.id]?.position || '',
      a.applicant_experience || parsedData[a.id]?.yoe || '',
      a.parsed_skills || parsedData[a.id]?.skills || '',
      a.parsed_headline || parsedData[a.id]?.headline || '',
      a.status || '',
      a.resume_url || '',
      a.admin_note || '',
      a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `applicants-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function runAiParse() {
    if (parsing || unparsed.length === 0) return
    setParsing(true)
    setParseResults(null)
    const results = { success: 0, fail: 0, errors: [] }

    for (let i = 0; i < unparsed.length; i++) {
      const app = unparsed[i]
      setParseProgress({ current: i + 1, total: unparsed.length, name: app.user_name || app.applicant_email || 'Unknown' })
      try {
        const res = await fetch('/api/admin/parse-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ applicationId: app.id }),
        })
        if (res.ok) {
          const data = await res.json()
          setParsedData(prev => ({ ...prev, [app.id]: data }))
          // Update local apps state
          setApps(prev => prev.map(a => a.id === app.id ? { ...a, applicant_role: data.position, applicant_experience: data.yoe } : a))
          results.success++
        } else {
          const err = await res.json()
          results.fail++
          results.errors.push(`${app.user_name || app.applicant_email}: ${err.error}`)
        }
      } catch (e) {
        results.fail++
        results.errors.push(`${app.user_name || app.applicant_email}: ${e.message}`)
      }
    }

    setParseResults(results)
    setParsing(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.appsLoading}</div>
  if (!apps || apps.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.appsEmpty}</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t.appsTitle}</h3>
          <span style={{ fontSize: 14, color: '#6B7280' }}>{t.appsTotal}: <strong style={{ color: '#4F46E5' }}>{apps.length}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={runAiParse} disabled={parsing || unparsed.length === 0}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13,
              background: parsing ? '#9CA3AF' : '#4F46E5', color: '#fff',
              cursor: parsing ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}>
            {parsing ? `AI 분석 중... (${parseProgress.current}/${parseProgress.total})` : `AI 분석 돌리기 (${unparsed.length}명)`}
          </button>
          <button onClick={downloadCsv}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13,
              background: '#10B981', color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}>
            CSV 다운로드
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
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsJob}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsCompany}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsApplicant}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsEmail}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Position</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>YoE</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Skills</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsStatus}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsDate}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsResume}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.appsNote}</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a, i) => {
                const sc = STATUS_COLORS[a.status] || STATUS_COLORS.applied
                const isEditingNote = editingNote.hasOwnProperty(a.id)
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 12px', color: '#999' }}>{i + 1}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{a.job_title || a.jobs?.title || '-'}</td>
                    <td style={{ padding: '8px 12px', color: '#666' }}>{a.job_company || a.jobs?.company || '-'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{a.user_name || '-'}</td>
                    <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>{a.user_email || '-'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {(a.applicant_role || parsedData[a.id]?.position) ? (
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#4F46E5' }}>
                          {a.applicant_role || parsedData[a.id]?.position}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                      {a.applicant_experience || parsedData[a.id]?.yoe || '-'}
                    </td>
                    <td style={{ padding: '8px 12px', maxWidth: 180 }}>
                      {(() => {
                        const skills = (a.parsed_skills || parsedData[a.id]?.skills || '').split(', ').filter(Boolean)
                        return skills.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {skills.slice(0, 4).map((s, j) => (
                              <span key={j} style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, background: '#F3F4F6', color: '#374151' }}>{s}</span>
                            ))}
                            {skills.length > 4 && (
                              <span style={{ fontSize: 10, color: '#999' }}>+{skills.length - 4}</span>
                            )}
                          </div>
                        ) : '-'
                      })()}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        value={a.status || 'pending'}
                        onChange={e => updateStatus(a.id, e.target.value)}
                        style={{
                          padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          border: 'none', cursor: 'pointer',
                          background: sc.bg, color: sc.color,
                        }}>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#666', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {a.resume_url ? (
                        <a href={a.resume_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#4F46E5', fontSize: 12, fontWeight: 600 }}>
                          {t.appsResume}
                        </a>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', minWidth: 160 }}>
                      {isEditingNote ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            value={editingNote[a.id]}
                            onChange={e => setEditingNote(prev => ({ ...prev, [a.id]: e.target.value }))}
                            style={{ flex: 1, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                          />
                          <button onClick={() => saveNote(a.id)}
                            style={{ padding: '3px 8px', border: 'none', borderRadius: 4, fontSize: 11, background: '#111', color: '#fff', cursor: 'pointer' }}>
                            {t.appsSave}
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => setEditingNote(prev => ({ ...prev, [a.id]: a.admin_note || '' }))}
                          style={{ cursor: 'pointer', color: a.admin_note ? '#333' : '#ccc', fontSize: 12 }}>
                          {a.admin_note || '+ memo'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
