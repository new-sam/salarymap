import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 유저 서베이 결과 — 콜드메일 개인 토큰 링크(/survey?t=)로 받은 응답 열람.
// 캠페인별 퍼널(발송→열람→제출) + 객관식 분포 + 응답 전문 테이블.
// 데이터: /api/admin/survey-results (events survey_* 집계).
const STATUS_LABELS = {
  seeking: { ko: '구직 중', en: 'Job seeking', vi: 'Đang tìm việc', color: '#EA580C' },
  employed_open: { ko: '재직·이직 관심', en: 'Employed, open', vi: 'Đi làm, quan tâm', color: '#0D9488' },
  employed_stay: { ko: '재직·이직 생각 없음', en: 'Employed, staying', vi: 'Đi làm, không đổi', color: '#6B7280' },
  student: { ko: '학생', en: 'Student', vi: 'Sinh viên', color: '#2563EB' },
}
const KR_LABELS = {
  high: { ko: '매우 관심', en: 'Very interested', vi: 'Rất quan tâm', color: '#EA580C' },
  some: { ko: '관심 있음', en: 'Interested', vi: 'Có quan tâm', color: '#0D9488' },
  no: { ko: '관심 없음', en: 'Not interested', vi: 'Không', color: '#9CA3AF' },
}

export default function SurveyView({ token, lang }) {
  const ko = lang === 'ko'
  const L = (k, e, v) => (lang === 'vi' ? (v ?? e) : ko ? k : e)
  const { data, error, isLoading } = useAdmin('/api/admin/survey-results', token)
  const [campaign, setCampaign] = useState('all')

  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{L('불러오기 실패', 'Failed to load', 'Tải thất bại')} — {error.message}</div>
  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>

  const { campaigns = [], responses = [] } = data
  const rows = campaign === 'all' ? responses : responses.filter((r) => r.campaign === campaign)

  // 객관식 분포 (현재 필터 기준)
  const dist = (key) => {
    const m = {}
    for (const r of rows) { const v = r.answers?.[key]; if (v) m[v] = (m[v] || 0) + 1 }
    return m
  }
  const statusDist = dist('status')
  const krDist = dist('kr_interest')
  const callOk = rows.filter((r) => r.answers?.call_ok).length

  const label = (map, v) => map[v] ? L(map[v].ko, map[v].en, map[v].vi) : (v || '—')
  const pct = (n, d) => d ? `${Math.round((n / d) * 100)}%` : '—'

  const card = { background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px' }
  const th = (txt, extra) => <th style={{ textAlign: 'left', padding: '10px 10px', fontWeight: 600, whiteSpace: 'nowrap', ...extra }}>{txt}</th>

  const DistBars = ({ title, map, d }) => (
    <div style={card}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {Object.keys(map).map((k) => {
        const n = d[k] || 0
        const max = Math.max(1, ...Object.values(d))
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, width: 130, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(map, k)}</div>
            <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4 }}>
              <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: map[k].color, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
          </div>
        )
      })}
      {!Object.values(d).some(Boolean) && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{L('응답 없음', 'No responses', 'Chưa có')}</div>}
    </div>
  )

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 6 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{L('유저 서베이', 'User survey', 'Khảo sát người dùng')}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {L('콜드메일 개인 링크(/survey?t=) 응답 — 수익화·기능 탐색용 페인포인트 조사', 'Cold-mail personal-link responses — pain-point research', 'Phản hồi qua link cá nhân')}
        </div>
      </div>

      {/* 캠페인별 퍼널 */}
      <div className="adm-m-scroll" style={{ margin: '14px 0 18px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, minWidth: 560, width: '100%' }}>
          <thead style={{ background: '#F9FAFB', color: '#6B7280', fontSize: 12 }}>
            <tr>
              {th(L('캠페인', 'Campaign', 'Chiến dịch'))}
              {th(L('발송', 'Sent', 'Đã gửi'), { textAlign: 'right' })}
              {th(L('열람', 'Viewed', 'Đã mở'), { textAlign: 'right' })}
              {th(L('제출', 'Submitted', 'Đã gửi trả lời'), { textAlign: 'right' })}
              {th(L('열람률', 'View rate', 'Tỷ lệ mở'), { textAlign: 'right' })}
              {th(L('제출률', 'Submit rate', 'Tỷ lệ trả lời'), { textAlign: 'right' })}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.campaign} style={{ borderTop: '1px solid #F3F4F6' }}>
                <td style={{ padding: '10px 10px', fontWeight: 600 }}>{c.campaign}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.sent.toLocaleString()}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.viewed.toLocaleString()}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{c.submitted.toLocaleString()}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', color: '#6B7280' }}>{pct(c.viewed, c.sent)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', color: '#6B7280' }}>{pct(c.submitted, c.sent)}</td>
              </tr>
            ))}
            {!campaigns.length && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>{L('아직 발송된 캠페인이 없습니다', 'No campaigns yet', 'Chưa có chiến dịch')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 필터 + 분포 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {['all', ...campaigns.map((c) => c.campaign)].map((c) => (
          <button key={c} onClick={() => setCampaign(c)} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: campaign === c ? '1px solid #0F172A' : '1px solid #E5E8EB',
            background: campaign === c ? '#0F172A' : '#fff', color: campaign === c ? '#fff' : '#374151',
          }}>{c === 'all' ? L('전체', 'All', 'Tất cả') : c}</button>
        ))}
      </div>
      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginBottom: 18 }}>
        <DistBars title={L('Q1. 현재 상태', 'Q1. Status', 'Q1. Tình trạng')} map={STATUS_LABELS} d={statusDist} />
        <DistBars title={L('Q4. 한국 기업 관심', 'Q4. Korean company interest', 'Q4. Quan tâm công ty Hàn')} map={KR_LABELS} d={krDist} />
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{L('인터뷰 승낙', 'Call opt-in', 'Đồng ý phỏng vấn')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>{callOk}</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{L('응답', 'of', '/')} {rows.length} · {pct(callOk, rows.length)}</div>
        </div>
      </div>

      {/* 응답 전문 */}
      <div className="adm-m-scroll">
        <table style={{ borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, minWidth: 900, width: '100%' }}>
          <thead style={{ background: '#F9FAFB', color: '#6B7280', fontSize: 12 }}>
            <tr>
              {th(L('일시', 'Date', 'Ngày'))}
              {th(L('응답자', 'User', 'Người dùng'))}
              {th(L('상태', 'Status', 'Tình trạng'))}
              {th(L('Q2. 가장 힘든 점', 'Q2. Biggest pain', 'Q2. Khó khăn'), { minWidth: 220 })}
              {th(L('Q3. 지출 경험', 'Q3. Money spent', 'Q3. Đã chi tiền'), { minWidth: 180 })}
              {th(L('한국 기업', 'KR interest', 'Cty Hàn'))}
              {th(L('인터뷰', 'Call', 'Phỏng vấn'))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = r.answers || {}
              const st = STATUS_LABELS[a.status]
              const kr = KR_LABELS[a.kr_interest]
              return (
                <tr key={`${r.campaign}:${r.user_id}`} style={{ borderTop: '1px solid #F3F4F6', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', color: '#6B7280', fontSize: 12 }}>{(r.created_at || '').slice(0, 10)}</td>
                  <td style={{ padding: '10px 10px', minWidth: 150 }}>
                    <div style={{ fontWeight: 600 }}>{r.name || '—'}</div>
                    <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{r.email}{r.position ? ` · ${r.position}` : ''}</div>
                  </td>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    {st ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${st.color}18`, color: st.color }}>{label(STATUS_LABELS, a.status)}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', lineHeight: 1.5, maxWidth: 340 }}>{a.pain || '—'}</td>
                  <td style={{ padding: '10px 10px', lineHeight: 1.5, maxWidth: 260 }}>{a.spent || '—'}</td>
                  <td style={{ padding: '10px 10px', minWidth: 110 }}>
                    {kr ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${kr.color}18`, color: kr.color }}>{label(KR_LABELS, a.kr_interest)}</span> : '—'}
                    {a.kr_obstacle && <div style={{ fontSize: 12, color: '#374151', marginTop: 4, lineHeight: 1.45 }}>{a.kr_obstacle}</div>}
                  </td>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    {a.call_ok ? <span style={{ color: '#0D9488', fontWeight: 700 }}>✓ {a.contact || ''}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>{L('아직 응답이 없습니다', 'No responses yet', 'Chưa có phản hồi')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
