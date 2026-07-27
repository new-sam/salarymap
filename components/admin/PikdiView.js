import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 픽디 크롤링 — 경쟁사 픽디(나인하이어 ATS)가 현재 대행 중인 공고 벤치마킹 열람 전용.
// 데이터: /api/admin/pikdi (나인하이어 API 라이브 + 주간 크론이 쌓은 브랜드 최초 발견일).
// 브랜드별 담당자 이름·이메일은 OpenAI 웹서치(POST /api/admin/pikdi)로 확보 — 결과는 미검증 취급.
// 콜드메일 발송/추적 기능 없음 — 예전 OutreachView(영업 관리)를 대체(2026-07-27 결정).

// 브랜드명 조인용 정규화 — DB(수기 적재)와 라이브 API의 대소문자/아포스트로피 차이 흡수
const norm = (s) => (s || '').toLowerCase().replace(/[’']/g, "'").trim()

export default function PikdiView({ token, lang }) {
  const ko = lang === 'ko'
  const L = (k, e, v) => (lang === 'vi' ? (v ?? e) : ko ? k : e)
  const { data, error, isLoading, mutate } = useAdmin('/api/admin/pikdi', token)
  const [busy, setBusy] = useState(() => new Set()) // 컨택 검색 진행 중인 브랜드
  const [batchRunning, setBatchRunning] = useState(false)

  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{L('불러오기 실패', 'Failed to load', 'Tải thất bại')} — {error.message}</div>
  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('픽디 라이브 크롤 중…', 'Crawling Pikdi live…', 'Đang crawl Pikdi…')}</div>

  const { jobs = [], seenBrands = [], fetchedAt } = data
  const now = fetchedAt ? new Date(fetchedAt) : new Date()
  const isNew = (d) => d && (now - new Date(d)) < 7 * 864e5 // 최근 7일 게재 = NEW

  const contact = new Map(seenBrands.map(b => [norm(b.name), b]))

  // 브랜드별 요약 (라이브 기준) + DB에만 있고 현재 공고 없는 브랜드 = 내려간 고객사
  const byBrand = new Map()
  for (const j of jobs) {
    if (!byBrand.has(j.brand)) byBrand.set(j.brand, { brand: j.brand, count: 0, roles: new Set() })
    const b = byBrand.get(j.brand)
    b.count++
    if (j.role) b.roles.add(j.role)
  }
  const liveKeys = new Set([...byBrand.keys()].map(norm))
  const goneBrands = seenBrands.filter(b => !liveKeys.has(norm(b.name)))
    .sort((a, b) => (b.first_seen || '').localeCompare(a.first_seen || ''))
  const brandRows = [...byBrand.values()].sort((a, b) => b.count - a.count)
  const newThisWeek = jobs.filter(j => isNew(j.createdAt)).length
  const withEmail = seenBrands.filter(b => b.email).length

  // 담당자 컨택 웹서치 (브랜드당 수초~수십초·미검증) — 완료 후 목록 갱신
  const searchContact = async (brand, role) => {
    setBusy(prev => new Set(prev).add(norm(brand)))
    try {
      await fetch('/api/admin/pikdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brand, role: role || '' }),
      })
    } catch { /* 실패해도 다음 갱신에서 상태 확인 */ }
    setBusy(prev => { const n = new Set(prev); n.delete(norm(brand)); return n })
    mutate()
  }

  // 이메일 미확보 브랜드 일괄 검색 — 동시 3개씩
  const batchSearch = async () => {
    const targets = [
      ...brandRows.filter(b => !contact.get(norm(b.brand))?.email).map(b => ({ brand: b.brand, role: [...b.roles][0] })),
      ...goneBrands.filter(b => !b.email).map(b => ({ brand: b.name, role: null })),
    ]
    if (!targets.length || batchRunning) return
    setBatchRunning(true)
    const queue = [...targets]
    const worker = async () => { let t; while ((t = queue.shift())) await searchContact(t.brand, t.role) }
    await Promise.all([worker(), worker(), worker()])
    setBatchRunning(false)
  }

  const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')
  const careerTxt = (c) => {
    if (!c || !c.type) return '—'
    if (c.type === 'newcomer') return L('신입', 'Entry', 'Mới ra trường')
    if (c.type === 'irrelevant') return L('무관', 'Any', 'Không yêu cầu')
    if (c.type === 'experienced') {
      const over = c.range?.over
      return over ? L(`경력 ${over}년+`, `${over}+ yrs`, `${over}+ năm`) : L('경력', 'Experienced', 'Có kinh nghiệm')
    }
    return c.type
  }
  const EMPLOY = {
    contractor: { ko: '계약직', en: 'Contract', vi: 'Hợp đồng' },
    full_time: { ko: '정규직', en: 'Full-time', vi: 'Toàn thời gian' },
    fullTime: { ko: '정규직', en: 'Full-time', vi: 'Toàn thời gian' },
    intern: { ko: '인턴', en: 'Intern', vi: 'Thực tập' },
    part_time: { ko: '파트타임', en: 'Part-time', vi: 'Bán thời gian' },
  }
  const employTxt = (arr) => (arr || []).map(t => { const m = EMPLOY[t]; return m ? (m[lang] || m.en) : t }).join(' · ') || '—'

  const stat = (labelTxt, value, sub) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{labelTxt}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )
  const th = (txt, align = 'left', extra = {}) => (
    <th style={{ textAlign: align, padding: '10px 10px', fontWeight: 600, whiteSpace: 'nowrap', ...extra }}>{txt}</th>
  )
  const newBadge = (
    <span style={{ display: 'inline-block', marginRight: 6, padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700, background: '#FFF1EC', color: '#ff4400', verticalAlign: 'middle' }}>NEW</span>
  )
  // 컨택 검색 버튼 — 미확보=주황 '찾기', 확보=회색 '재검색'
  const findBtn = (brand, role, hasEmail) => {
    const running = busy.has(norm(brand))
    return (
      <button onClick={() => searchContact(brand, role)} disabled={running} style={{
        padding: '3px 10px', border: 'none', borderRadius: 6, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
        cursor: running ? 'default' : 'pointer',
        background: running ? '#E5E8EB' : hasEmail ? '#F1F5F9' : '#FFF1EC',
        color: running ? '#9CA3AF' : hasEmail ? '#64748B' : '#ff4400',
      }}>
        {running ? L('검색중…', 'Searching…', 'Đang tìm…') : hasEmail ? L('재검색', 'Retry', 'Tìm lại') : L('컨택 찾기', 'Find contact', 'Tìm liên hệ')}
      </button>
    )
  }
  const contactCells = (key) => {
    const c = contact.get(key)
    return (
      <>
        <td style={{ padding: '9px 10px', color: c?.contact_name ? '#0F172A' : '#CBD5E1' }}>{c?.contact_name || '—'}</td>
        <td style={{ padding: '9px 10px', fontVariantNumeric: 'tabular-nums' }}>
          {c?.email
            ? <span title={L('웹서치 자동 확보 — 미검증', 'Auto web-search — unverified', 'Tự động tìm — chưa xác minh')} style={{ color: '#374151' }}>{c.email}</span>
            : <span style={{ color: '#CBD5E1' }}>—</span>}
        </td>
      </>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{L('픽디 크롤링', 'Pikdi crawl', 'Crawl Pikdi')}</h3>
          <p style={{ fontSize: 12.5, color: '#6B7280', margin: 0 }}>
            {L(
              '경쟁사 픽디(나인하이어)가 현재 대행 중인 고객사 공고 라이브 + 브랜드별 담당자 컨택(웹서치 자동·미검증). 첫 발견일은 매주 수요일 크론 적재 기준.',
              'Live view of competitor Pikdi\'s active client postings + auto web-searched contacts (unverified). First-seen dates from the weekly cron.',
              'Xem trực tiếp tin đăng khách hàng Pikdi + liên hệ tự động tìm (chưa xác minh). Ngày phát hiện theo cron hằng tuần.'
            )}
          </p>
        </div>
        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{L('기준', 'As of', 'Tính đến')} {fetchedAt ? new Date(fetchedAt).toLocaleString(ko ? 'ko-KR' : lang === 'vi' ? 'vi-VN' : 'en-US') : '—'}</span>
      </div>

      {/* 요약 카드 */}
      <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, margin: '14px 0 18px' }}>
        {stat(L('진행중 공고', 'Active jobs', 'Tin đang tuyển'), jobs.length)}
        {stat(L('고객사 브랜드', 'Client brands', 'Thương hiệu khách'), byBrand.size)}
        {stat(L('최근 7일 신규', 'New (7d)', 'Mới (7 ngày)'), newThisWeek)}
        {stat(L('이메일 확보', 'Emails found', 'Đã có email'), `${withEmail} / ${seenBrands.length}`, L('누적 발견 브랜드 대비 · 미검증 포함', 'of brands seen · incl. unverified', 'trên thương hiệu đã thấy'))}
      </div>

      {/* 현재 공고 — 게재일 최신순 */}
      <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              {th(L('브랜드', 'Brand', 'Thương hiệu'), 'left', { paddingLeft: 14 })}
              {th(L('공고', 'Posting', 'Tin đăng'))}
              {th(L('직무', 'Role', 'Vị trí'))}
              {th(L('형태', 'Type', 'Loại'))}
              {th(L('경력', 'Career', 'Kinh nghiệm'))}
              {th(L('게재일', 'Posted', 'Đăng'), 'right')}
              {th(L('마감일', 'Deadline', 'Hạn'), 'right', { paddingRight: 14 })}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j, i) => (
              <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '9px 10px 9px 14px', fontWeight: 600, color: '#0F172A' }}>{j.brand}</td>
                <td style={{ padding: '9px 10px', maxWidth: 420 }}>
                  {isNew(j.createdAt) && newBadge}
                  {j.url
                    ? <a href={j.url} target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'none' }}>{j.title}</a>
                    : j.title}
                </td>
                <td style={{ padding: '9px 10px', color: '#374151' }}>{j.role || '—'}</td>
                <td style={{ padding: '9px 10px', color: '#374151' }}>{employTxt(j.employment)}</td>
                <td style={{ padding: '9px 10px', color: '#374151' }}>{careerTxt(j.career)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(j.createdAt)}</td>
                <td style={{ padding: '9px 10px 9px 10px', paddingRight: 14, textAlign: 'right', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(j.deadline)}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>{L('현재 게시 중인 고객사 공고가 없습니다', 'No active client postings', 'Không có tin đang tuyển')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 브랜드별 컨택 — 현재 진행중 + 내려간 브랜드(회색) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 8px' }}>
        <h4 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{L('브랜드별 담당자 컨택', 'Contacts by brand', 'Liên hệ theo thương hiệu')}</h4>
        <button onClick={batchSearch} disabled={batchRunning} style={{
          padding: '6px 14px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
          background: batchRunning ? '#E5E8EB' : '#ff6000', color: batchRunning ? '#9CA3AF' : '#fff', cursor: batchRunning ? 'default' : 'pointer',
        }}>
          {batchRunning ? L('일괄 검색 중…', 'Searching all…', 'Đang tìm tất cả…') : L('미확보 일괄 검색', 'Find all missing', 'Tìm tất cả còn thiếu')}
        </button>
      </div>
      <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              {th(L('브랜드', 'Brand', 'Thương hiệu'), 'left', { paddingLeft: 14 })}
              {th(L('진행중 공고', 'Active', 'Đang tuyển'), 'right')}
              {th(L('직무', 'Roles', 'Vị trí'))}
              {th(L('담당자', 'Contact', 'Người phụ trách'))}
              {th(L('이메일', 'Email', 'Email'))}
              {th(L('첫 발견일', 'First seen', 'Phát hiện lần đầu'), 'right')}
              {th('', 'right', { paddingRight: 14 })}
            </tr>
          </thead>
          <tbody>
            {brandRows.map(b => {
              const key = norm(b.brand)
              return (
                <tr key={b.brand} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '9px 10px 9px 14px', fontWeight: 600, color: '#0F172A' }}>{b.brand}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{b.count}</td>
                  <td style={{ padding: '9px 10px', color: '#374151' }}>{[...b.roles].join(' / ') || '—'}</td>
                  {contactCells(key)}
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(contact.get(key)?.first_seen)}</td>
                  <td style={{ padding: '9px 10px', paddingRight: 14, textAlign: 'right' }}>{findBtn(b.brand, [...b.roles][0], !!contact.get(key)?.email)}</td>
                </tr>
              )
            })}
            {goneBrands.map(b => (
              <tr key={b.name} style={{ borderTop: '1px solid #F1F5F9', color: '#9CA3AF' }}>
                <td style={{ padding: '9px 10px 9px 14px', fontWeight: 600 }}>{b.name}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{L('내려감', 'Gone', 'Đã gỡ')}</td>
                <td style={{ padding: '9px 10px' }}>—</td>
                {contactCells(norm(b.name))}
                <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(b.first_seen)}</td>
                <td style={{ padding: '9px 10px', paddingRight: 14, textAlign: 'right' }}>{findBtn(b.name, null, !!b.email)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
