import { useMemo } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 광고메일(공고 추천) — 인재풀에서 발송한 추천 메일의 발송 내역 + 지원 전환 현황.
// 데이터: /api/admin/talent-recommend (GET) — 발송 로그 + job_applications 조인한 applied_at.

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function RecommendView({ token, lang }) {
  const ko = lang !== 'en'
  const { data, isLoading } = useAdmin('/api/admin/talent-recommend', token)

  const rows = Array.isArray(data) ? data : []
  const { sent, applied, rate } = useMemo(() => {
    const s = rows.length
    const a = rows.filter(r => r.applied_at).length
    return { sent: s, applied: a, rate: s > 0 ? Math.round((a / s) * 100) : 0 }
  }, [rows])

  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{ko ? '불러오는 중…' : 'Loading…'}</div>
  if (data && data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const stat = (label, value, sub, accent) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent || '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const th = { textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 12px 8px', whiteSpace: 'nowrap' }
  const td = { fontSize: 13, color: '#1d1d1f', padding: '11px 12px', borderTop: '1px solid #F0F1F3', verticalAlign: 'middle' }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{ko ? '공고 추천 메일' : 'Job recommendation emails'}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {ko
            ? '인재풀에서 발송한 공고 추천 메일과 실제 지원 전환 현황.'
            : 'Recommendation emails sent from the talent pool and their application conversion.'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {stat(ko ? '총 발송' : 'Sent', sent)}
        {stat(ko ? '지원 전환' : 'Applied', applied, null, '#0D9488')}
        {stat(ko ? '전환율' : 'Conversion', `${rate}%`, ko ? '지원 / 발송' : 'applied / sent', '#EA580C')}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9AA0A6', fontSize: 13.5, background: '#FAFAFB', border: '1px solid #EEE', borderRadius: 12 }}>
          {ko ? '아직 발송된 추천 메일이 없습니다.' : 'No recommendation emails sent yet.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #E8E8EA', borderRadius: 12, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={th}>{ko ? '수신자' : 'Recipient'}</th>
                <th style={th}>{ko ? '공고' : 'Job'}</th>
                <th style={th}>{ko ? '발송자' : 'Sent by'}</th>
                <th style={th}>{ko ? '발송일' : 'Sent'}</th>
                <th style={{ ...th, textAlign: 'center' }}>{ko ? '지원 여부' : 'Applied'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.to_email}</td>
                  <td style={td}>
                    <a href={`/jobs/${r.job_id}`} target="_blank" rel="noreferrer" style={{ color: '#1d1d1f', textDecoration: 'none', fontWeight: 600 }}>
                      {r.job_title}
                    </a>
                    <div style={{ fontSize: 11.5, color: '#9AA0A6', marginTop: 2 }}>{r.job_company}</div>
                  </td>
                  <td style={{ ...td, color: '#6B7280', fontSize: 12.5 }}>{r.sent_by || '—'}</td>
                  <td style={{ ...td, color: '#6B7280', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {r.applied_at ? (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: '#E7F6F2', color: '#0D9488', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {ko ? `지원함 · ${fmtDate(r.applied_at)}` : `Applied · ${fmtDate(r.applied_at)}`}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: '#F2F3F5', color: '#9AA0A6', fontSize: 12, fontWeight: 600 }}>
                        {ko ? '미지원' : 'Not yet'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
