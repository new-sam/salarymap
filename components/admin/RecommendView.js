import { useState, useEffect, useMemo } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 광고메일 — 공고 추천 메일.
// [발송] 유사공고 자동추천: 최근 지원자마다 지원 직군과 같은 기업등록 공고를 모아 일괄 발송.
// [내역] 발송 로그 + 지원 전환(applied_at). 데이터: /api/admin/talent-recommend, /api/admin/similar-recommend

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
const keyOf = (a) => a.user_id || a.email

const KIND_BADGE = {
  recruiter: { ko: '담당자 추천', en: 'Recruiter', vi: 'Nhà tuyển dụng gợi ý', bg: '#EAF2FE', color: '#1D4ED8' },
  similar:   { ko: '유사공고', en: 'Similar', vi: 'Tin tương tự', bg: '#FFF1EC', color: '#EA580C' },
}

export default function RecommendView({ token, lang }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)

  // ── 발송 내역 ──
  const { data: history, mutate: mutateHistory } = useAdmin('/api/admin/talent-recommend', token)
  const rows = Array.isArray(history) ? history : []
  const { sent, applied, rate } = useMemo(() => {
    const s = rows.length
    const a = rows.filter(r => r.applied_at).length
    return { sent: s, applied: a, rate: s > 0 ? Math.round((a / s) * 100) : 0 }
  }, [rows])

  // 지원 여부 필터 (all=전체 / applied=지원함 / not=미지원)
  const [appliedFilter, setAppliedFilter] = useState('all')
  const viewRows = useMemo(
    () => appliedFilter === 'all' ? rows : rows.filter(r => appliedFilter === 'applied' ? r.applied_at : !r.applied_at),
    [rows, appliedFilter]
  )

  // ── 유사공고 발송 캠페인 ──
  const [days, setDays] = useState(90)
  const [loadMatches, setLoadMatches] = useState(false)
  const [mailLang, setMailLang] = useState('vi')
  const [sel, setSel] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [previewMail, setPreviewMail] = useState(null)
  const { data: match, isLoading: matchLoading, mutate: mutateMatches } =
    useAdmin(loadMatches ? `/api/admin/similar-recommend?days=${days}` : null, token)
  const applicants = match?.applicants || []

  // 매칭 결과 로드되면 전체 선택
  useEffect(() => { setSel(new Set(applicants.map(keyOf))) }, [match])

  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  async function preview(a) {
    setPreviewMail({ loading: true })
    const res = await fetch('/api/admin/similar-recommend', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ preview: true, lang: mailLang, applicants: [{ email: a.email, name: a.name, appliedTitle: a.applied.title, appliedCompany: a.applied.company, jobIds: a.jobs.map(j => j.id) }] }),
    })
    const out = await res.json()
    setPreviewMail(out.html ? out : { error: out.error || 'preview failed' })
  }

  async function send() {
    const chosen = applicants.filter(a => sel.has(keyOf(a)))
    if (!chosen.length) return
    if (!window.confirm(L(`${chosen.length}명에게 유사공고 추천 메일을 발송할까요?`, `Send to ${chosen.length} applicants?`, `Gửi email gợi ý tin tương tự cho ${chosen.length} ứng viên?`))) return
    setSending(true); setResult(null)
    const res = await fetch('/api/admin/similar-recommend', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ lang: mailLang, applicants: chosen.map(a => ({ user_id: a.user_id, email: a.email, name: a.name, appliedTitle: a.applied.title, appliedCompany: a.applied.company, jobIds: a.jobs.map(j => j.id) })) }),
    })
    const out = await res.json()
    setSending(false); setResult(out)
    mutateHistory(); mutateMatches()
  }

  const stat = (label, value, sub, accent) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent || '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )
  const th = { textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 12px', whiteSpace: 'nowrap', background: '#FAFAFB', borderBottom: '1px solid #F0F1F3' }
  const td = { fontSize: 13, color: '#1d1d1f', padding: '13px 12px', borderTop: '1px solid #F0F1F3', verticalAlign: 'middle' }
  const totalJobs = applicants.reduce((n, a) => n + a.jobs.length, 0)

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ───────── 유사공고 발송 ───────── */}
      <div style={{ border: '1px solid #E8E8EA', borderRadius: 14, padding: 18, marginBottom: 28, background: '#FCFCFD' }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{L('유사공고 추천 발송', 'Send similar-job recommendations', 'Gửi gợi ý tin tương tự')}</h3>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>
            {L(
              '최근 지원자마다 지원한 직군과 같은 기업등록 공고를 모아 "최근 지원과 비슷한 공고" 메일 1통으로 발송. 이미 지원/발송한 공고는 제외.',
              'For each recent applicant, gathers company-registered jobs in the same role and sends one "similar to your recent application" email. Already-applied/sent jobs excluded.',
              'Với mỗi ứng viên gần đây, gom các tin tuyển dụng doanh nghiệp đăng cùng nhóm ngành và gửi 1 email "tin tương tự lần ứng tuyển gần đây". Loại trừ tin đã ứng tuyển/đã gửi.'
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, color: '#6B7280', fontWeight: 600 }}>{L('최근', 'Last', 'Trong')}</span>
          {[30, 60, 90, 180].map(d => (
            <button key={d} onClick={() => { setDays(d); setResult(null) }} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (days === d ? '#ff6000' : '#D9DCE1'),
              background: days === d ? '#FFF1EC' : '#fff', color: days === d ? '#ff6000' : '#4E5968',
            }}>{d}{L('일', 'd', ' ngày')}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 2, background: '#EFEFF2', borderRadius: 8, padding: 3 }}>
            {['vi', 'ko', 'en'].map(l => (
              <button key={l} onClick={() => setMailLang(l)} style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: mailLang === l ? '#fff' : 'transparent', color: mailLang === l ? '#1d1d1f' : '#86868b',
                boxShadow: mailLang === l ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => { setLoadMatches(true); mutateMatches() }} style={{
            padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: '#17181c', color: '#fff', cursor: 'pointer',
          }}>{L('매칭 불러오기', 'Load matches', 'Tải kết quả ghép')}</button>
        </div>

        {loadMatches && matchLoading && <div style={{ padding: 24, textAlign: 'center', color: '#9AA0A6', fontSize: 13 }}>{L('매칭 계산 중…', 'Matching…', 'Đang ghép…')}</div>}
        {match?.error && <div style={{ padding: 16, color: '#c00', fontSize: 13 }}>{match.error}</div>}

        {loadMatches && !matchLoading && match && !match.error && (
          applicants.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9AA0A6', fontSize: 13 }}>
              {L('매칭되는 지원자가 없습니다. (모두 발송했거나 최근 지원자가 없음)', 'No matching applicants.', 'Không có ứng viên phù hợp. (Đã gửi hết hoặc không có ứng viên gần đây)')}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                  {L(`대상 ${applicants.length}명 · 추천 공고 ${totalJobs}건`, `${applicants.length} applicants · ${totalJobs} jobs`, `${applicants.length} ứng viên · ${totalJobs} tin tuyển dụng`)}
                </div>
                <button onClick={() => setSel(sel.size === applicants.length ? new Set() : new Set(applicants.map(keyOf)))}
                  style={{ padding: '4px 10px', border: '1px solid #D9DCE1', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#fff', color: '#4E5968', cursor: 'pointer' }}>
                  {sel.size === applicants.length ? L('전체 해제', 'Deselect all', 'Bỏ chọn tất cả') : L('전체 선택', 'Select all', 'Chọn tất cả')}
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={send} disabled={sending || sel.size === 0} style={{
                  padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: sending || sel.size === 0 ? '#F0A98A' : '#ff6000', color: '#fff',
                  cursor: sending || sel.size === 0 ? 'default' : 'pointer',
                }}>{sending ? L('발송 중…', 'Sending…', 'Đang gửi…') : L(`선택 ${sel.size}명 발송`, `Send to ${sel.size}`, `Gửi cho ${sel.size} người`)}</button>
              </div>

              {result && (
                <div style={{ background: '#EFFdF4', border: '1px solid #BBF0D0', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#166534', marginBottom: 12 }}>
                  {L(`발송 완료: ${result.sent}명 · 공고 ${result.jobs}건`, `Sent: ${result.sent} · ${result.jobs} jobs`, `Đã gửi: ${result.sent} · ${result.jobs} tin`)}
                  {result.skipped?.length ? L(` · 스킵 ${result.skipped.length}건`, ` · skipped ${result.skipped.length}`, ` · bỏ qua ${result.skipped.length}`) : ''}
                  {result.error ? ` · ${result.error}` : ''}
                </div>
              )}

              <div style={{ border: '1px solid #E8E8EA', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                {applicants.map(a => {
                  const on = sel.has(keyOf(a))
                  return (
                    <div key={keyOf(a)} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderTop: '1px solid #F2F3F5', alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={on} onChange={() => {
                        const n = new Set(sel); on ? n.delete(keyOf(a)) : n.add(keyOf(a)); setSel(n)
                      }} style={{ marginTop: 3, cursor: 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f' }}>
                          {a.name || a.email} <span style={{ color: '#9AA0A6', fontWeight: 400 }}>· {a.email}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#9AA0A6', margin: '2px 0 6px' }}>
                          {L('지원', 'Applied', 'Đã ứng tuyển')}: {a.applied.title}{a.applied.company ? ` · ${a.applied.company}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {a.jobs.map(j => (
                            <span key={j.id} style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: '#F2F3F5', color: '#4E5968', fontSize: 11.5, fontWeight: 600 }}>
                              {j.title}{j.company ? ` · ${j.company}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => preview(a)} style={{ padding: '4px 10px', border: '1px solid #D9DCE1', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: '#fff', color: '#4E5968', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {L('미리보기', 'Preview', 'Xem trước')}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>

      {/* ───────── 발송 내역 ───────── */}
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{L('발송 내역', 'Sent history', 'Lịch sử gửi')}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>{L('발송한 추천 메일과 실제 지원 전환 현황.', 'Sent recommendation emails and their application conversion.', 'Email gợi ý đã gửi và tình hình chuyển đổi sang lượt ứng tuyển.')}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {stat(L('총 발송', 'Sent', 'Tổng đã gửi'), sent)}
        {stat(L('지원 전환', 'Applied', 'Đã ứng tuyển'), applied, null, '#0D9488')}
        {stat(L('전환율', 'Conversion', 'Tỷ lệ chuyển đổi'), `${rate}%`, L('지원 / 발송', 'applied / sent', 'ứng tuyển / đã gửi'), '#EA580C')}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9AA0A6', fontSize: 13.5, background: '#FAFAFB', border: '1px solid #EEE', borderRadius: 12 }}>
          {L('아직 발송된 추천 메일이 없습니다.', 'No recommendation emails sent yet.', 'Chưa có email gợi ý nào được gửi.')}
        </div>
      ) : (
        <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['all', L('전체', 'All', 'Tất cả'), sent], ['applied', L('지원함', 'Applied', 'Đã ứng tuyển'), applied], ['not', L('미지원', 'Not yet', 'Chưa ứng tuyển'), sent - applied]].map(([v, label, n]) => (
            <button key={v} onClick={() => setAppliedFilter(v)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (appliedFilter === v ? '#ff6000' : '#D9DCE1'),
              background: appliedFilter === v ? '#FFF1EC' : '#fff', color: appliedFilter === v ? '#ff6000' : '#4E5968',
            }}>{label} {n}</button>
          ))}
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid #E8E8EA', borderRadius: 12, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '30%' }}>{L('수신자', 'Recipient', 'Người nhận')}</th>
                <th style={th}>{L('공고', 'Job', 'Tin tuyển dụng')}</th>
                <th style={{ ...th, width: 110 }}>{L('종류', 'Type', 'Loại')}</th>
                <th style={{ ...th, width: 92 }}>{L('발송일', 'Sent', 'Ngày gửi')}</th>
                <th style={{ ...th, width: 170, textAlign: 'center' }}>{L('지원 여부', 'Applied', 'Ứng tuyển')}</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.map(r => {
                const kb = KIND_BADGE[r.kind] || KIND_BADGE.recruiter
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, wordBreak: 'break-all' }}>{r.to_email}</td>
                    <td style={td}>
                      <a href={`/jobs/${r.job_id}`} target="_blank" rel="noreferrer" style={{ color: '#1d1d1f', textDecoration: 'none', fontWeight: 600 }}>{r.job_title}</a>
                      <div style={{ fontSize: 11.5, color: '#9AA0A6', marginTop: 2 }}>{r.job_company}</div>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: kb.bg, color: kb.color, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{kb[lang]}</span>
                    </td>
                    <td style={{ ...td, color: '#6B7280', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {r.applied_at ? (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: '#E7F6F2', color: '#0D9488', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {L(`지원함 · ${fmtDate(r.applied_at)}`, `Applied · ${fmtDate(r.applied_at)}`, `Đã ứng tuyển · ${fmtDate(r.applied_at)}`)}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: '#F2F3F5', color: '#9AA0A6', fontSize: 12, fontWeight: 600 }}>
                          {L('미지원', 'Not yet', 'Chưa ứng tuyển')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* 미리보기 모달 */}
      {previewMail && (
        <div onClick={() => setPreviewMail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #EEE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{previewMail.subject || L('미리보기', 'Preview', 'Xem trước')}</div>
              <button onClick={() => setPreviewMail(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9AA0A6', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {previewMail.loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9AA0A6' }}>…</div>
                : previewMail.error ? <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>{previewMail.error}</div>
                : <iframe title="preview" srcDoc={previewMail.html} style={{ width: '100%', height: 640, border: 'none' }} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
