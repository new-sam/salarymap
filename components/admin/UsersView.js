import { useState, useEffect } from 'react'

export default function UsersView({ token, t }) {
  const [users, setUsers] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/signup-users', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setUsers(await res.json())
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    fetchUsers()
  }, [token])

  function downloadCsv() {
    if (!users || users.length === 0) return
    const headers = ['Email', 'Name', 'Provider', 'Signed Up', 'Last Sign In']
    const rows = users.map(u => [
      u.email,
      u.full_name,
      u.provider,
      u.created_at ? new Date(u.created_at).toLocaleString('ko-KR') : '',
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ko-KR') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `signup-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.usersLoading}</div>
  if (!users || users.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.usersEmpty}</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t.usersTitle}</h3>
          <span style={{ fontSize: 14, color: '#6B7280' }}>{t.usersTotal}: <strong style={{ color: '#4F46E5' }}>{users.length}</strong></span>
        </div>
        <button onClick={downloadCsv}
          style={{
            padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13,
            background: '#10B981', color: '#fff', cursor: 'pointer', fontWeight: 600,
          }}>
          {t.usersDownloadCsv}
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersEmail}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersName}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersProvider}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersCreatedAt}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.usersLastSignIn}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '8px 12px', color: '#999' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{u.email}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{u.full_name || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: u.provider === 'google' ? '#E8F5E9' : '#E3F2FD',
                      color: u.provider === 'google' ? '#2E7D32' : '#1565C0',
                    }}>
                      {u.provider || 'email'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
