import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'
import DateRangePicker from './DateRangePicker'
import ResumeDropoffSection from './ResumeDropoffSection'

// "유진 작업실" — 작업 중인 분석을 탭으로 나눠 붙인다. 분석마다 컴포넌트를 분리해
// 로딩/에러를 각자 처리하므로, 한쪽 API 가 실패해도 다른 탭은 그대로 동작한다.
// 탭 전환 시 언마운트되지만 SWR 이 [url, token] 으로 캐싱해 되돌아오면 즉시 그려진다.
const LAB_TABS = [
  { key: 'inflow', ko: 'KTC 유입 비중', en: 'KTC share of traffic', vi: 'Tỷ trọng truy cập KTC' },
  { key: 'resume', ko: '이력서 이탈', en: 'Resume drop-off', vi: 'Rời bỏ CV' },
]

// 페이지 전환 알약 — AdminLayout 의 titleRight 슬롯("유진 작업실" 타이틀 우측)에 꽂아 쓴다.
// 그래서 상태(labTab)는 dashboard.js 가 들고, 알약과 본문이 같은 값을 공유한다.
export function YujinLabTabs({ value, onChange, lang }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  return (
    <div style={{ display: 'inline-flex', gap: 0, background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
      {LAB_TABS.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            background: value === t.key ? '#fff' : 'transparent',
            color: value === t.key ? '#111' : '#999',
            boxShadow: value === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
          {L(t.ko, t.en, t.vi)}
        </button>
      ))}
    </div>
  )
}

export default function YujinLabView({ token, lang, dateRange, onDateChange, labTab }) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <DateRangePicker value={dateRange} onChange={onDateChange} />
      </div>

      {labTab === 'inflow' && <KtcInflowSection token={token} lang={lang} dateRange={dateRange} />}
      {labTab === 'resume' && <ResumeDropoffSection token={token} lang={lang} dateRange={dateRange} />}
    </>
  )
}

// 유입 3단 (자체 이벤트 로그 session_start, VN 일별):
//   전체 유입 → 그중 /ktc* 로 진입한 세션 → 그중 구 랜딩(ktc.likelion.edu.vn) 경유 세션.
// 데이터: /api/admin/ktc-inflow

const STAGES = [
  { key: 'total', ko: '전체 유입', en: 'All traffic', vi: 'Tổng truy cập', sub: { ko: '세션 진입 (session_start)', en: 'sessions (session_start)', vi: 'phiên (session_start)' } },
  { key: 'ktc', ko: 'KTC 페이지 유입', en: 'KTC page', vi: 'Trang KTC', sub: { ko: '/ktc* 로 진입한 세션', en: 'sessions entering /ktc*', vi: 'phiên vào /ktc*' } },
  { key: 'oldLanding', ko: '구 랜딩 경유', en: 'From old landing', vi: 'Từ landing cũ', sub: { ko: 'ktc.likelion.edu.vn 리퍼러', en: 'ktc.likelion.edu.vn referrer', vi: 'Referrer ktc.likelion.edu.vn' } },
]

const fmt = (n) => (n === null || n === undefined ? '—' : n.toLocaleString())
const pct = (a, b, digits = 1) => (b > 0 ? ((a / b) * 100).toFixed(digits) : null)

const thStyle = { padding: '7px 10px', textAlign: 'right', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }
const thLeft = { ...thStyle, textAlign: 'left' }
const tdStyle = { padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }
const tdLeft = { ...tdStyle, textAlign: 'left' }

function KtcInflowSection({ token, lang, dateRange }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  const { data, error, isLoading } = useAdmin(`/api/admin/ktc-inflow?from=${dateRange.from}&to=${dateRange.to}`, token)

  if (isLoading && !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{L('불러오기 실패 ', 'Load failed ', 'Tải thất bại ')}{error.message}</div>
  if (!data) return null

  const days = [...data.days].reverse() // 최신순
  const { totals } = data

  return (
    <>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
        {dateRange.from} ~ {dateRange.to} · {L('자체 이벤트 로그 session_start · VN(UTC+7) 일별', 'Own event log · session_start · VN (UTC+7) days', 'Log sự kiện nội bộ · session_start · ngày VN (UTC+7)')}
      </div>

      {/* ── 유입 3단 카드 ── */}
      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {STAGES.map((s, i) => {
          const val = totals[s.key]
          const conv = i > 0 ? pct(val, totals[STAGES[i - 1].key]) : null
          const highlight = s.key === 'ktc' // KTC 유입이 이 섹션의 주인공 — 옅은 주황 배경
          return (
            <div key={s.key} style={{
              background: highlight ? '#FFF6F2' : '#fff',
              border: `1px solid ${highlight ? '#FFD9CC' : '#e5e7eb'}`,
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>{i + 1}. {L(s.ko, s.en, s.vi)}</span>
                {i > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#F6F8FA', color: conv === null ? '#999' : '#444' }}>
                    ← {conv === null ? '—' : `${conv}%`}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#191F28', marginTop: 8, lineHeight: 1.1 }}>{fmt(val)}</div>
              <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 4 }}>{L(s.sub.ko, s.sub.en, s.sub.vi)}</div>
            </div>
          )
        })}
      </div>

      {/* ── 일별 표 + 리퍼러 (둘 다 좁아서 한 줄에, 모바일은 1열) ── */}
      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'start', marginBottom: 24 }}>
      <div style={{ ...sectionStyle, marginBottom: 0, paddingBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 10 }}>
          {L('일별 유입 (최신순)', 'Daily traffic (latest first)', 'Truy cập theo ngày (mới nhất trước)')}
        </div>
        {/* 6행 + 헤더까지만 보이고 나머지는 내부 스크롤 — 표가 길어져도 아래 섹션이 밀리지 않게 */}
        <div className="adm-m-scroll" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff' }}>
                <th style={thLeft}>{L('날짜', 'Date', 'Ngày')}</th>
                <th style={thStyle}>{L('전체 유입', 'All', 'Tổng')}</th>
                <th style={thStyle}>{L('KTC 페이지', 'KTC page', 'Trang KTC')}</th>
                <th style={thStyle}>{L('구 랜딩 경유', 'Old landing', 'Landing cũ')}</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 && (
                <tr><td colSpan={4} style={{ ...tdLeft, color: '#999', padding: 16 }}>—</td></tr>
              )}
              {days.map(d => {
                const ktcRate = pct(d.ktc, d.total)
                const oldRate = pct(d.oldLanding, d.ktc)
                return (
                  <tr key={d.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ ...tdLeft, fontWeight: 600 }}>{d.date}</td>
                    <td style={tdStyle}>{fmt(d.total)}</td>
                    {/* 괄호 안은 각각의 분모 대비 비중 — KTC 페이지는 그날 전체 유입 중, */}
                    <td style={tdStyle}>
                      {d.ktc || '·'}
                      {d.ktc > 0 && ktcRate !== null && (
                        <span style={{ color: '#8B95A1', marginLeft: 5 }}>({ktcRate}%)</span>
                      )}
                    </td>
                    {/* 구 랜딩 경유는 그날 KTC 페이지 유입 중 비중 */}
                    <td style={tdStyle}>
                      {d.oldLanding || '·'}
                      {d.oldLanding > 0 && oldRate !== null && (
                        <span style={{ color: '#8B95A1', marginLeft: 5 }}>({oldRate}%)</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── KTC 진입 리퍼러 (구 랜딩으로 세는 항목에 표시) ── */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 4 }}>
          {L('KTC 진입 리퍼러', 'KTC entry referrers', 'Referrer vào KTC')}
        </div>
        <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 10 }}>
          {L('3번(구 랜딩 경유)으로 세는 리퍼러에 배지 표시', 'Referrers counted as #3 (old landing) are badged', 'Referrer được tính vào #3 có nhãn')}
        </div>
        <div className="adm-m-scroll">
          <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thLeft}>{L('리퍼러', 'Referrer', 'Referrer')}</th>
                <th style={thStyle}>{L('진입 세션', 'Sessions', 'Phiên')}</th>
              </tr>
            </thead>
            <tbody>
              {(data.ktcReferrers || []).length === 0 && (
                <tr><td colSpan={2} style={{ ...tdLeft, color: '#999', padding: 16 }}>—</td></tr>
              )}
              {(data.ktcReferrers || []).map((r) => (
                <tr key={r.host} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdLeft}>
                    {r.host}
                    {r.oldLanding && (
                      <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#FFF1EC', color: '#ff4400' }}>
                        {L('구 랜딩', 'old landing', 'landing cũ')}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{fmt(r.sessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  )
}