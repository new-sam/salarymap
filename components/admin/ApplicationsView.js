import { useState, useEffect } from 'react'
import { STATUS_OPTIONS, STATUS_COLORS } from '../../constants/dashboard'

export default function ApplicationsView({ token, t }) {
  const [apps, setApps] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingNote, setEditingNote] = useState({})

  useEffect(() => {
    fetchApps()
  }, [token])

  async function fetchApps() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/applications', {
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

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.appsLoading}</div>
  if (!apps || apps.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.appsEmpty}</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t.appsTitle}</h3>
          <span style={{ fontSize: 14, color: '#6B7280' }}>{t.appsTotal}: <strong style={{ color: '#4F46E5' }}>{apps.length}</strong></span>
        </div>
      </div>

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
