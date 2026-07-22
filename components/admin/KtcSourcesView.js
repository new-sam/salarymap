import { Fragment, useState, useEffect } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { AmpChart } from './BehaviorFunnel'

// KTC 소싱 채널 비교 — KTC 공고에 지원자를 모아준 채널별 볼륨/추이/질.
// FYI가 채용 플랫폼으로서 유료 채널(ITviec/TopDev/…) 대비 얼마나 모으는지 판단하는 탭.
// 데이터: /api/admin/ktc-sources (타 플랫폼 = ktc_candidates 동기화본, FYI = salarymap 라이브)

// 채널명 — 브랜드는 문자열, 설명형 라벨은 {ko,en,vi} (en/vi 모드에서 한국어 노출 방지)
const PLATFORM_LABEL = {
  'landing-page': { ko: 'KTC 랜딩', en: 'KTC landing', vi: 'Landing KTC' },
  'ITviec-api': 'ITviec',
  'top-dev': 'TopDev',
  'jobs-go': 'JobsGO',
  'top-cv': 'TopCV',
  LinkedIn: 'LinkedIn',
  glint: 'Glint',
  YBOX: 'YBOX',
  'legacy-sheet': { ko: '레거시 시트', en: 'Legacy sheet', vi: 'Sheet cũ' },
  'Form Responses 1': { ko: '구글폼', en: 'Google Form', vi: 'Google Form' },
  'external-shu1102': { ko: '외부 스크리닝', en: 'Ext. screening', vi: 'Sàng lọc ngoài' },
}
// 크로스탭에 개별 열로 보여줄 주요 채널 (나머지는 '기타'로 합산)
const MAIN_PLATFORMS = ['landing-page', 'ITviec-api', 'jobs-go', 'top-dev', 'LinkedIn', 'top-cv']
const FYI_COLOR = '#ff4400'
// 도넛 세그먼트 — 보기 편한 파스텔톤 (채널 정체성에 고정), FYI만 브랜드 주황. 소수 채널은 기타 회색.
const CHANNEL_SOFT_COLORS = {
  'landing-page': '#5B9BF8',
  'ITviec-api': '#3EC1A8',
  'jobs-go': '#9A8CF8',
  'top-dev': '#F6B73C',
  LinkedIn: '#F290A9',
}
const OTHER_GRAY = '#D9DEE4'

// 채널 비중 도넛 (SVG). segs: [{key, n, color, label}], 12시 방향 시작 시계방향, 2px 갭.
function Donut({ segs, total, centerTop, centerSub, reveal }) {
  const R = 70, SW = 26, C = 2 * Math.PI * R
  const SWEEP = 1.0 // 한 바퀴 도는 총 시간(초)
  let acc = 0
  return (
    <svg viewBox="0 0 200 200" width={188} height={188} role="img" style={{ flexShrink: 0 }}>
      {segs.map(s => {
        const frac = total > 0 ? s.n / total : 0
        const start = acc // 이 세그먼트가 시작하는 각도 비율(12시=0)
        const realLen = Math.max(0, frac * C - 2)
        const offset = -acc * C
        acc += frac
        if (realLen <= 0) return null
        const len = reveal ? realLen : 0 // reveal=false면 즉시 0(비움), true면 시계바늘이 지날 때 채워짐
        // 시작 위치만큼 딜레이 + 자기 비중만큼 지속 → 세그먼트들이 이어져 한 바퀴 스윕.
        // reveal=false(비우는 프레임)엔 트랜지션 없이 즉시 0으로 → 매 토글마다 0에서 새로 스윕.
        const transition = reveal
          ? `stroke-dasharray ${(Math.max(frac, 0.001) * SWEEP).toFixed(3)}s linear ${(start * SWEEP).toFixed(3)}s`
          : 'none'
        return (
          <circle
            key={s.key} cx="100" cy="100" r={R} fill="none"
            stroke={s.color} strokeWidth={SW}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
            style={{ transition }}
          >
            <title>{`${s.label}: ${s.n.toLocaleString()} (${total > 0 ? Math.round((s.n / total) * 100) : 0}%)`}</title>
          </circle>
        )
      })}
      <text x="100" y="96" textAnchor="middle" fontSize="26" fontWeight="800" fill="#191F28" style={{ fontVariantNumeric: 'tabular-nums' }}>{centerTop}</text>
      <text x="100" y="116" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={FYI_COLOR}>{centerSub}</text>
    </svg>
  )
}

export default function KtcSourcesView({ token, lang, dateRange }) {
  const ko = lang === 'ko'
  const L = (k, e, v) => (lang === 'vi' ? (v ?? e) : ko ? k : e)
  const label = (key) => {
    const v = PLATFORM_LABEL[key]
    return typeof v === 'object' ? (v[lang] || v.en) : (v || key)
  }
  const qs = dateRange?.from && dateRange?.to ? `?from=${dateRange.from}&to=${dateRange.to}` : ''
  const { data, error, isLoading, mutate } = useAdmin(`/api/admin/ktc-sources${qs}`, token)
  const [showAllJobs, setShowAllJobs] = useState(false)
  const [showHireList, setShowHireList] = useState(false) // 입사자 명단 접기
  const [section, setSection] = useState('funnel') // 섹션 전환 (기본 = 채널 퍼널이 판단의 메인)
  const [selChan, setSelChan] = useState('FYI') // 퍼널 그래프·월별 코호트의 채널 선택
  // 공고 퍼널은 시트 라이브 조합이라 섹션 진입 시에만 로드
  const { data: funnelData, isLoading: funnelLoading } = useAdmin(section === 'funnel' ? '/api/admin/ktc-jd-funnel' : null, token)
  const [jdStatusFilter, setJdStatusFilter] = useState('all') // 공고 퍼널 상태 필터
  const [funnelMode, setFunnelMode] = useState('channel') // 퍼널 관점: channel(채널별) | jd(공고별)
  const [openJobs, setOpenJobs] = useState({}) // 공고 행 펼침 (채널×월 상세)
  const [basis, setBasis] = useState('people') // 'people' 유니크 지원자 | 'apps' 지원 건(중복 포함)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [reveal, setReveal] = useState(false) // 도넛 시계방향 스윕(0→값)

  // 최초 로드 + 기준 토글마다: 0으로 비우고 다시 시계방향 스윕.
  // 더블 rAF — 리셋(len 0, transition:none) 프레임을 브라우저가 확실히 반영한 뒤 스윕 시작
  // (단일 rAF면 0 상태가 flush 안 돼 이전 값에서 스윕이 시작돼 "남아있는" 것처럼 보임)
  useEffect(() => {
    if (!data || data.error) return
    setReveal(false)
    let raf2
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReveal(true))
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [data, basis])

  async function runSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/ktc-sources-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`)
      setSyncMsg(ko ? `동기화 완료 — ${r.upserted}건 반영` : `${L('', 'Synced', 'Đã đồng bộ')} — ${r.upserted} ${L('', 'rows', 'dòng')}`)
      mutate()
    } catch (e) {
      setSyncMsg(L('동기화 실패: ', 'Sync failed: ', 'Đồng bộ thất bại: ') + e.message)
    } finally {
      setSyncing(false)
    }
  }

  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{L('불러오기 실패', 'Failed to load', 'Tải thất bại')} — {error.message}</div>
  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
  if (data.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{data.error}</div>

  const { platforms, fyi, jobs, months, totals, syncedAt, hasApplications } = data
  const nowMonth = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
  const shownMonths = months.filter(m => m >= '2026-03' && m <= nowMonth)
  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

  // 기준: people = 유니크 지원자(최초 채널 귀속) / apps = 지원 건(중복 포함, 시트 원본)
  const useApps = basis === 'apps' && hasApplications
  // FYI를 플랫폼 목록에 합류 — 두 기준 값을 모두 들고 현재 기준(n/nMonths)으로 정렬
  const allRows = [
    ...platforms.map(p => ({ ...p, isFyi: false, n: useApps ? p.appsTotal : p.total, nMonths: useApps ? p.appsMonths : p.months })),
    {
      key: 'FYI', isFyi: true, docPass: null, finalPassed: null,
      total: fyi.total, months: fyi.months,
      n: useApps ? fyi.applications : fyi.total, nMonths: useApps ? fyi.appsMonths : fyi.months,
    },
  ].sort((a, b) => b.n - a.n)
  const grandTotal = allRows.reduce((s, r) => s + r.n, 0)
  const maxTotal = Math.max(1, ...allRows.map(r => r.n))
  const totalFinal = platforms.reduce((s, p) => s + p.finalPassed, 0)

  const stat = (labelTxt, value, sub) => (
    <div style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{labelTxt}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const th = (txt, align = 'right', extra = {}) => (
    <th style={{ textAlign: align, padding: '10px 10px', fontWeight: 600, whiteSpace: 'nowrap', ...extra }}>{txt}</th>
  )

  const jobRows = showAllJobs ? jobs : jobs.slice(0, 25)
  const monthLabel = (m) => (ko ? `${+m.slice(5)}월` : lang === 'vi' ? `T${+m.slice(5)}` : `${+m.slice(5)}/${m.slice(2, 4)}`)

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{L('KTC 소싱 채널 비교', 'KTC sourcing channels', 'So sánh kênh nguồn KTC')}</h3>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>
            {L(
              'KTC 공고에 지원자를 모아준 채널별 볼륨·추이·질. FYI는 salarymap DB 라이브, 나머지는 동기화 버튼으로 갱신(시트→ktc-support→FYI).',
              'Volume, trend and quality per sourcing channel for KTC jobs. FYI is live; refresh others with the sync button.',
              'Khối lượng, xu hướng và chất lượng ứng viên theo kênh cho tin KTC. FYI là dữ liệu trực tiếp; các kênh khác cập nhật bằng nút đồng bộ.'
            )}
            {syncedAt && <span style={{ color: '#9CA3AF' }}> · {L('마지막 동기화', 'Last sync', 'Đồng bộ lần cuối')} {new Date(syncedAt).toLocaleString('sv-SE').slice(0, 16)}</span>}
          </div>
          {syncMsg && <div style={{ fontSize: 12, color: syncMsg.includes('실패') || syncMsg.includes('failed') || syncMsg.includes('thất bại') ? '#c00' : '#0D9488', marginTop: 4, fontWeight: 600 }}>{syncMsg}</div>}
        </div>
        <button onClick={runSync} disabled={syncing} style={{
          padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          background: syncing ? '#E5E8EB' : '#ff6000', color: syncing ? '#9CA3AF' : '#fff', cursor: syncing ? 'default' : 'pointer',
        }}>
          {syncing ? L('동기화 중… (1~2분)', 'Syncing… (1–2 min)', 'Đang đồng bộ… (1–2 phút)') : L('시트 동기화', 'Sync sheets', 'Đồng bộ sheet')}
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, margin: '14px 0 18px' }}>
        {stat(L('총 지원자 (전 채널)', 'Applicants (all)', 'Tổng ứng viên'), grandTotal.toLocaleString(), L('채널 내 유니크 기준', 'unique per channel', 'unique theo kênh · mọi kênh'))}
        {stat('FYI', fyi.total.toLocaleString(), ko ? `지원 건수 ${fyi.applications} · 전체의 ${pct(fyi.total, grandTotal)}%` : `${fyi.applications} ${L('', 'applications', 'lượt nộp')} · ${pct(fyi.total, grandTotal)}%`)}
        {stat(L('최종합격 (타 채널)', 'Final passed', 'Trúng tuyển'), totalFinal, L('FYI 지원자는 상태 추적 없음', 'FYI applicants not tracked', 'Kênh khác — FYI chưa theo dõi trạng thái'))}
        {stat(L('KTC 공고', 'KTC jobs', 'Tin KTC'), `${totals.activeKtcJobs} / ${totals.ktcJobs}`, L('활성 / 전체', 'active / all', 'đang hoạt động / tổng'))}
        {data.hires && stat(L('입사', 'Hires', 'Trúng tuyển'), data.hires.total, L(`FYI 경유 ${data.hires.viaFyi}명`, `${data.hires.viaFyi} via FYI`, `${data.hires.viaFyi} qua FYI`))}
      </div>

      {/* 섹션 네비 — 긴 세로 스크롤 대신 주제별 화면 전환 */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #E5E8EB', marginBottom: 18 }}>
        {[
          // 순서 = FYI 가치 판단 경로: 퍼널(메인) → 개요(볼륨 상세) → 입사·매출 → 운영용
          ['funnel', L('퍼널', 'Funnel', 'Phễu')],
          ['overview', L('개요', 'Overview', 'Tổng quan')],
          ['hires', L('입사 · 매출', 'Hires · Revenue', 'Trúng tuyển · Doanh thu')],
          ['jobs', L('공고별', 'By job', 'Theo tin')],
          ['landing', L('랜딩 유입', 'Landing traffic', 'Nguồn landing')],
        ].map(([key, labelTxt]) => {
          const on = section === key
          return (
            <button key={key} onClick={() => setSection(key)} style={{
              padding: '9px 14px', fontSize: 13.5, fontWeight: on ? 700 : 500,
              color: on ? '#191F28' : '#8B95A1', background: 'none', border: 'none',
              borderBottom: on ? '2px solid #ff4400' : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {labelTxt}
            </button>
          )
        })}
      </div>

      {section === 'overview' && (<>
      {/* 기준 토글 — 도넛·채널 표에 공통 적용 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          ['people', L('지원자 수 (유니크)', 'Applicants (unique)', 'Ứng viên (unique)')],
          ['apps', L('지원 건수 (중복 포함)', 'Applications (raw)', 'Lượt nộp (gồm trùng)')],
        ].map(([key, labelTxt]) => {
          const on = basis === key
          const disabled = key === 'apps' && !hasApplications
          return (
            <button key={key} onClick={() => !disabled && setBasis(key)} disabled={disabled} style={{
              fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', borderRadius: 999, padding: '7px 14px',
              border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
              background: on ? '#FFF1EC' : '#fff', color: disabled ? '#C4CAD2' : on ? '#ff4400' : '#4E5968',
            }}>
              {labelTxt}
            </button>
          )
        })}
        {!hasApplications && (
          <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>
            {L('지원 건 데이터 없음 — ktc_applications 마이그레이션 적용 후 동기화 필요', 'No applications data — apply the migration, then sync', 'Chưa có dữ liệu lượt nộp — chạy migration rồi đồng bộ')}
          </span>
        )}
      </div>

      {/* 채널 비중 도넛 — 선택 기간·기준의 채널 구성 */}
      {(() => {
        // 고정 색이 있는 채널은 개별 세그먼트, 나머지는 기타로 합산 (색은 채널 정체성에 고정)
        const fyiRow = allRows.find(r => r.isFyi)
        const nonFyi = allRows.filter(r => !r.isFyi)
        const named = nonFyi.filter(r => CHANNEL_SOFT_COLORS[r.key])
        const donutSegs = [
          { key: 'FYI', n: fyiRow.n, color: FYI_COLOR, label: 'FYI' },
          ...named.map(r => ({ key: r.key, n: r.n, color: CHANNEL_SOFT_COLORS[r.key], label: label(r.key) })),
        ]
        const restN = nonFyi.filter(r => !CHANNEL_SOFT_COLORS[r.key]).reduce((s, r) => s + r.n, 0)
        if (restN > 0) donutSegs.push({ key: '_rest', n: restN, color: OTHER_GRAY, label: L('기타', 'Other', 'Khác') })
        return (
          <div className="adm-m-wrap" style={{ display: 'flex', alignItems: 'center', gap: 28, border: '1px solid #E5E8EB', borderRadius: 12, padding: '18px 22px', marginBottom: 22 }}>
            <Donut
              segs={donutSegs}
              total={grandTotal}
              centerTop={grandTotal.toLocaleString()}
              centerSub={`FYI ${pct(fyiRow.n, grandTotal)}%`}
              reveal={reveal}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
                {L('채널 비중', 'Channel share', 'Tỷ trọng kênh')}
                <span style={{ fontSize: 11.5, fontWeight: 500, color: '#9CA3AF', marginLeft: 8 }}>
                  {dateRange?.from && dateRange?.to ? `${dateRange.from} ~ ${dateRange.to}` : L('전체 기간', 'All time', 'Toàn thời gian')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {donutSegs.map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: s.key === 'FYI' ? 700 : 500, color: s.key === 'FYI' ? FYI_COLOR : '#4E5968', minWidth: 96 }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: '#191F28', fontVariantNumeric: 'tabular-nums' }}>{s.n.toLocaleString()}</span>
                    <span style={{ color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{pct(s.n, grandTotal)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 채널별 표 */}
      <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              {th(L('채널', 'Channel', 'Kênh'), 'left', { paddingLeft: 14 })}
              {shownMonths.map(m => th(ko ? `${+m.slice(5)}월` : lang === 'vi' ? `T${+m.slice(5)}` : `${+m.slice(5)}/${m.slice(2, 4)}`))}
              {th(L('합계', 'Total', 'Tổng'))}
              {th(L('비중', 'Share', 'Tỷ trọng'), 'left', { width: '18%' })}
              {!useApps && th(L('서류통과', 'CV screened', 'Đạt sàng lọc CV'))}
              {!useApps && th(L('최종합격', 'Final passed', 'Trúng tuyển'))}
              {!useApps && th(L('서류통과율', 'Screen %', 'Tỷ lệ sàng lọc'), 'right', { paddingRight: 14 })}
            </tr>
          </thead>
          <tbody>
            {allRows.map(r => (
              <tr key={r.key} style={{ borderTop: '1px solid #F1F5F9', background: r.isFyi ? '#FFF8F5' : undefined }}>
                <td style={{ padding: '9px 10px 9px 14px', fontWeight: r.isFyi ? 700 : 600, color: r.isFyi ? FYI_COLOR : '#0F172A' }}>{label(r.key)}</td>
                {shownMonths.map(m => (
                  <td key={m} style={{ padding: '9px 10px', textAlign: 'right', color: (r.nMonths?.[m] || 0) > 0 ? '#374151' : '#CBD5E1' }}>{r.nMonths?.[m] || 0}</td>
                ))}
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{r.n.toLocaleString()}</td>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                      <div style={{ width: reveal ? `${(r.n / maxTotal) * 100}%` : '0%', height: '100%', background: r.isFyi ? FYI_COLOR : '#2563EB', borderRadius: 4, transition: reveal ? 'width 0.7s cubic-bezier(0.22, 1, 0.36, 1)' : 'none' }} />
                    </div>
                    <span style={{ fontSize: 11.5, color: '#6B7280', width: 34, textAlign: 'right' }}>{pct(r.n, grandTotal)}%</span>
                  </div>
                </td>
                {!useApps && <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151' }}>{r.docPass ?? '—'}</td>}
                {!useApps && <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: r.finalPassed > 0 ? '#0D9488' : '#CBD5E1' }}>{r.finalPassed ?? '—'}</td>}
                {!useApps && <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', color: '#374151' }}>{r.docPass === null ? '—' : `${pct(r.docPass, r.total)}%`}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 질 지표 정의 — 항상 노출 (호버 툴팁은 표 컨테이너 overflow에 잘려서 미사용) */}
      <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.7, margin: '-14px 2px 22px' }}>
        {useApps && <>{L(
          <><b>지원 건수</b> = 시트 원본 행 그대로(한 사람이 여러 공고 지원 시 각각 카운트). FYI는 salarymap DB의 지원 건. </>,
          <><b>Applications</b> = raw sheet rows (one person × several jobs counts each). FYI = raw applications from salarymap DB. </>,
          <><b>Lượt nộp</b> = số dòng thô trên sheet (một người nộp nhiều tin tính từng lượt). FYI = lượt nộp thô từ DB salarymap. </>
        )}</>}
        {!useApps && L(
          <><b>서류통과</b> = KTC 팀의 CV 스크리닝 합격 이상 전부(AI 인터뷰 발송·완료·합격, 최종 합격 포함) · <b>최종합격</b> = KTC 파이프라인 최종 합격(final_passed) · <b>서류통과율</b> = 서류통과 ÷ 전체 지원자(스크리닝 대기자도 분모 포함)</>,
          <><b>CV screened</b> = at or past the KTC team&apos;s CV screening (incl. AI-interview stages and final passed) · <b>Final passed</b> = last stage of the KTC pipeline · <b>Screen %</b> = screened ÷ all applicants (pending included in denominator)</>,
          <><b>Đạt sàng lọc CV</b> = từ mức đạt sàng lọc CV của team KTC trở lên (gồm các giai đoạn PV AI và trúng tuyển) · <b>Trúng tuyển</b> = giai đoạn cuối pipeline KTC · <b>Tỷ lệ sàng lọc</b> = đạt sàng lọc ÷ tổng ứng viên (gồm cả người chưa được sàng lọc)</>
        )}
      </div>
      </>)}

      {/* 채널별 입사 귀속 — ktc_hires × 이메일 조인 (기간 필터 무관 누적) */}
      {section === 'hires' && data.hires && (() => {
        const h = data.hires
        const fmtUsd = (n) => (n > 0 ? `$${Math.round(n).toLocaleString()}` : '—')
        const chanLabel = (k) => (k === '_unattributed' ? L('(미귀속)', '(unattributed)', '(chưa quy nguồn)') : label(k))
        return (
          <div style={{ margin: '26px 0 22px' }}>
            <h4 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 4px' }}>
              {L('채널별 입사 귀속', 'Hires by channel', 'Trúng tuyển theo kênh')}
              <span style={{ fontSize: 11.5, fontWeight: 500, color: '#9CA3AF', marginLeft: 8 }}>
                {L(`KTC Ops Employee ${h.total}명 · 이메일 매칭 · 누적(기간 무관)`, `${h.total} hires from KTC Ops · matched by email · cumulative`, `${h.total} người từ KTC Ops · khớp email · lũy kế`)}
              </span>
            </h4>
            <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, margin: '10px 0 12px' }}>
              {stat(L('총 입사', 'Total hires', 'Tổng trúng tuyển'), h.total, L('KTC 프로젝트 온보딩 기준', 'onboarded to KTC projects', 'đã onboarding dự án KTC'))}
              {stat(L('FYI 경유', 'Via FYI', 'Qua FYI'), h.viaFyi, L('FYI 지원 이력이 있는 입사자', 'hires who also applied via FYI', 'từng ứng tuyển qua FYI'))}
              {stat(L('채널 귀속', 'Attributed', 'Đã quy nguồn'), `${h.attributed} / ${h.total}`, L('이메일이 지원 데이터와 매칭된 비율', 'matched to application data by email', 'khớp với dữ liệu ứng tuyển'))}
            </div>
            <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                    {th(L('채널', 'Channel', 'Kênh'), 'left', { paddingLeft: 14 })}
                    {th(L('입사자', 'Hires', 'Trúng tuyển'))}
                    {th(L('월 매출 (USD)', 'Monthly revenue (USD)', 'Doanh thu tháng (USD)'))}
                    {th(L('이익 (USD)', 'Profit (USD)', 'Lợi nhuận (USD)'), 'right', { paddingRight: 14 })}
                  </tr>
                </thead>
                <tbody>
                  {h.byChannel.map(c => {
                    const isFyi = c.key === 'FYI'
                    return (
                      <tr key={c.key} style={{ borderTop: '1px solid #F1F5F9', background: isFyi ? '#FFF8F5' : undefined }}>
                        <td style={{ padding: '9px 10px 9px 14px', fontWeight: isFyi ? 700 : 600, color: isFyi ? FYI_COLOR : c.key === '_unattributed' ? '#9CA3AF' : '#0F172A' }}>{chanLabel(c.key)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{c.hires}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(c.revenue)}</td>
                        <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', color: c.profit > 0 ? '#0D9488' : '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(c.profit)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={() => setShowHireList(v => !v)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              {showHireList ? '▾' : '▸'} {L('입사자 명단', 'Hire list', 'Danh sách trúng tuyển')} ({h.total})
            </button>
            {showHireList && (
              <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                      {th(L('이름', 'Name', 'Tên'), 'left', { paddingLeft: 14 })}
                      {th(L('회사', 'Company', 'Công ty'), 'left')}
                      {th(L('포지션', 'Position', 'Vị trí'), 'left')}
                      {th(L('채널', 'Channel', 'Kênh'), 'left')}
                      {th(L('온보딩', 'Onboarding', 'Onboarding'), 'left')}
                      {th(L('월 매출', 'Revenue', 'Doanh thu'), 'right', { paddingRight: 14 })}
                    </tr>
                  </thead>
                  <tbody>
                    {h.rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '7px 10px 7px 14px', fontWeight: 600, color: '#191F28' }}>{r.name}</td>
                        <td style={{ padding: '7px 10px', color: '#4E5968' }}>{r.company}</td>
                        <td style={{ padding: '7px 10px', color: '#4E5968' }}>{r.position}</td>
                        <td style={{ padding: '7px 10px', fontWeight: r.channel === 'FYI' || r.viaFyi ? 700 : 500, color: r.channel === 'FYI' || r.viaFyi ? FYI_COLOR : r.channel ? '#4E5968' : '#C4CAD2' }}>
                          {r.channel ? chanLabel(r.channel) : '—'}{r.viaFyi && r.channel !== 'FYI' ? ' +FYI' : ''}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#4E5968', fontVariantNumeric: 'tabular-nums' }}>{r.onboarding || '—'}{r.leftAt ? ` (${L('이탈', 'left', 'nghỉ')} ${r.leftAt})` : ''}</td>
                        <td style={{ padding: '7px 14px 7px 10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* 공고 × 채널 크로스탭 */}
      {section === 'jobs' && (<>
      <h4 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px' }}>{L('공고 × 채널', 'Job × channel', 'Tin × kênh')}</h4>
      <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              {th(L('공고', 'Job', 'Tin đăng'), 'left', { paddingLeft: 14 })}
              {th('FYI', 'right', { color: FYI_COLOR })}
              {MAIN_PLATFORMS.map(p => th(label(p)))}
              {th(L('기타', 'Other', 'Khác'))}
              {th(L('합계', 'Total', 'Tổng'), 'right', { paddingRight: 14 })}
            </tr>
          </thead>
          <tbody>
            {jobRows.map((j, i) => {
              const mainSum = MAIN_PLATFORMS.reduce((s, p) => s + (j.byPlatform[p] || 0), 0)
              const other = j.total - j.fyi - mainSum
              const rowKey = j.code || `${j.company}-${j.label}`
              const open = !!openJobs[rowKey]
              // 펼침 상세: FYI 먼저, 나머지 채널은 볼륨순
              const detailChans = [
                ...(j.fyi > 0 ? [{ key: 'FYI', total: j.fyi }] : []),
                ...Object.entries(j.byPlatform).sort((a, b) => b[1] - a[1]).map(([key, total]) => ({ key, total })),
              ]
              const colSpan = MAIN_PLATFORMS.length + 4
              return (
                <Fragment key={rowKey}>
                  <tr
                    onClick={() => setOpenJobs(o => ({ ...o, [rowKey]: !o[rowKey] }))}
                    style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: open ? '#FAFBFC' : undefined }}
                  >
                    <td style={{ padding: '9px 10px 9px 14px', maxWidth: 340 }}>
                      <div style={{ fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.label}>
                        <span style={{ color: '#9CA3AF', fontSize: 10, marginRight: 6 }}>{open ? '▾' : '▸'}</span>
                        {j.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', paddingLeft: 16 }}>
                        {[j.company, j.code].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: j.fyi > 0 ? FYI_COLOR : '#E5E8EB' }}>{j.fyi || 0}</td>
                    {MAIN_PLATFORMS.map(p => (
                      <td key={p} style={{ padding: '9px 10px', textAlign: 'right', color: (j.byPlatform[p] || 0) > 0 ? '#374151' : '#E5E8EB' }}>{j.byPlatform[p] || 0}</td>
                    ))}
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: other > 0 ? '#374151' : '#E5E8EB' }}>{other}</td>
                    <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{j.total}</td>
                  </tr>
                  {open && (
                    <tr style={{ background: '#FAFBFC' }}>
                      <td colSpan={colSpan} style={{ padding: '0 14px 12px' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 12.5, marginLeft: 16 }}>
                          <thead>
                            <tr style={{ color: '#9CA3AF' }}>
                              <th style={{ textAlign: 'left', padding: '6px 18px 4px 0', fontWeight: 600 }}>{L('채널', 'Channel', 'Kênh')}</th>
                              {shownMonths.map(m => (
                                <th key={m} style={{ textAlign: 'right', padding: '6px 0 4px 18px', fontWeight: 600 }}>{monthLabel(m)}</th>
                              ))}
                              <th style={{ textAlign: 'right', padding: '6px 0 4px 18px', fontWeight: 600 }}>{L('합계', 'Total', 'Tổng')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailChans.map(c => {
                              const pm = j.platformMonths?.[c.key] || {}
                              const isFyi = c.key === 'FYI'
                              return (
                                <tr key={c.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '5px 18px 5px 0', fontWeight: isFyi ? 700 : 500, color: isFyi ? FYI_COLOR : '#4E5968', whiteSpace: 'nowrap' }}>{label(c.key)}</td>
                                  {shownMonths.map(m => (
                                    <td key={m} style={{ padding: '5px 0 5px 18px', textAlign: 'right', color: (pm[m] || 0) > 0 ? (isFyi ? FYI_COLOR : '#374151') : '#D8DDE3', fontWeight: isFyi && pm[m] > 0 ? 600 : 400 }}>
                                      {pm[m] || 0}
                                    </td>
                                  ))}
                                  <td style={{ padding: '5px 0 5px 18px', textAlign: 'right', fontWeight: 700, color: isFyi ? FYI_COLOR : '#191F28' }}>{c.total}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {jobs.length > 25 && (
        <button onClick={() => setShowAllJobs(v => !v)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          {showAllJobs ? L('▾ 접기', '▾ Collapse', '▾ Thu gọn') : ko ? `▸ 전체 ${jobs.length}개 공고 보기` : `▸ ${L('', 'Show all', 'Xem tất cả')} ${jobs.length} ${L('', 'jobs', 'tin')}`}
        </button>
      )}
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12, lineHeight: 1.6 }}>
        {L(
          '행 클릭 시 그 공고의 채널×월 상세. FYI 열은 회사·제목 매칭이라 일부 공고는 별도 행으로 나올 수 있음.',
          'Click a row for its channel × month detail. FYI column matches by company+title; unmatched jobs appear as separate rows.',
          'Bấm vào dòng để xem chi tiết kênh × tháng. Cột FYI khớp theo công ty+chức danh; tin không khớp hiển thị thành dòng riêng.'
        )}
      </div>
      </>)}

      {/* 공고 퍼널 — JD EXECUTION(상태) × 지원 × 파이프라인 × 인터뷰 × 입사 */}
      {section === 'funnel' && (() => {
        if (funnelLoading || !funnelData) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중… (시트 라이브 조회)', 'Loading… (live sheet read)', 'Đang tải…')}</div>
        if (funnelData.error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{funnelData.error}</div>
        const STATUS_BADGE = {
          'In Progress': { bg: '#E7F6EC', color: '#1B7A43', ko: '진행중', vi: 'Đang tuyển' },
          'Closed - Filled': { bg: '#E0EAFF', color: '#1D4ED8', ko: '충원 마감', vi: 'Đã tuyển đủ' },
          'Closed - Cancelled': { bg: '#F1F3F5', color: '#868E96', ko: '취소', vi: 'Đã hủy' },
          'On Hold': { bg: '#FFF4E5', color: '#C2410C', ko: '보류', vi: 'Tạm dừng' },
        }
        const stLabel = (s) => {
          const b = STATUS_BADGE[s]
          return b ? (ko ? b.ko : lang === 'vi' ? b.vi : s) : (s || '—')
        }
        const filtered = funnelData.jds.filter(j => jdStatusFilter === 'all' || j.status === jdStatusFilter)
        const ORDER = { 'In Progress': 0, 'On Hold': 1, 'Closed - Filled': 2, 'Closed - Cancelled': 3 }
        const sorted = [...filtered].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || b.apps - a.apps)
        const FILTERS = [
          ['all', L('전체', 'All', 'Tất cả'), funnelData.jds.length],
          ...Object.entries(funnelData.statusCounts).sort((a, b) => (ORDER[a[0]] ?? 9) - (ORDER[b[0]] ?? 9)).map(([s, n]) => [s, stLabel(s), n]),
        ]
        const num = { fontVariantNumeric: 'tabular-nums' }
        const cell = (n, hot) => (
          <td style={{ padding: '9px 10px', textAlign: 'right', color: n > 0 ? (hot ? '#0D9488' : '#374151') : '#DDE1E6', fontWeight: n > 0 && hot ? 700 : 400, ...num }}>{n}</td>
        )
        // 채널 퍼널: 단계 도달 수 + 지원자 대비 %
        const chanRows = funnelData.channels || []
        const hasCost = chanRows.some(c => c.spendKrw != null)
        const fmtKrw = (n) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${Math.round(n).toLocaleString()}원`)
        const stageCell = (n, d, isFyi) => (
          <td style={{ padding: '9px 10px', textAlign: 'right', ...num }}>
            <span style={{ fontWeight: n > 0 ? 700 : 400, color: n > 0 ? (isFyi ? FYI_COLOR : '#191F28') : '#DDE1E6' }}>{n}</span>
            {d > 0 && <span style={{ color: '#9CA3AF', marginLeft: 5, fontSize: 11.5 }}>{(n / d * 100).toFixed(1)}%</span>}
          </td>
        )
        return (
          <div>
            {/* 퍼널 관점 토글: 채널별(플랫폼 비교) / 공고별 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                ['channel', L('채널별 퍼널', 'By channel', 'Theo kênh')],
                ['jd', L('공고별 퍼널', 'By job', 'Theo tin')],
              ].map(([key, labelTxt]) => {
                const on = funnelMode === key
                return (
                  <button key={key} onClick={() => setFunnelMode(key)} style={{
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '7px 14px',
                    border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
                    background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968',
                  }}>
                    {labelTxt}
                  </button>
                )
              })}
            </div>

            {funnelMode === 'channel' && (
              <>
                <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflowX: 'auto', marginBottom: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                        {th(L('채널', 'Channel', 'Kênh'), 'left', { paddingLeft: 14 })}
                        {th(L('지원자', 'Applicants', 'Ứng viên'))}
                        {th(L('서류통과', 'Screened', 'Đạt sàng lọc'))}
                        {th(L('AI합격', 'AI passed', 'Đạt PV AI'))}
                        {th(L('인터뷰', 'Interviews', 'Phỏng vấn'))}
                        {th(L('최종합격', 'Final', 'Đạt cuối'))}
                        {th(L('입사', 'Hired', 'Trúng tuyển'))}
                        {hasCost && th(L('지출', 'Spend', 'Chi phí'))}
                        {hasCost && th('CPA', 'right', { paddingRight: 14 })}
                      </tr>
                    </thead>
                    <tbody>
                      {chanRows.map(c => {
                        const isFyi = c.key === 'FYI'
                        const isUn = c.key === '_unattributed'
                        const denom = c.peopleLive || c.people
                        return (
                          <tr key={c.key} style={{ borderTop: '1px solid #F1F5F9', background: isFyi ? '#FFF8F5' : undefined }}>
                            <td style={{ padding: '9px 10px 9px 14px', fontWeight: isFyi ? 700 : 600, color: isFyi ? FYI_COLOR : isUn ? '#9CA3AF' : '#0F172A' }}>
                              {isUn ? L('(채널 외 / 미귀속)', '(off-channel)', '(ngoài kênh)') : label(c.key)}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A', ...num }}>
                              {isUn ? '—' : denom.toLocaleString()}
                              {isFyi && c.peopleLive > c.people && <span style={{ color: '#9CA3AF', marginLeft: 5, fontSize: 11, fontWeight: 500 }}>{L(`파이프라인 ${c.people}`, `${c.people} in pipeline`, `${c.people} trong pipeline`)}</span>}
                            </td>
                            {stageCell(c.docPass, isUn ? 0 : denom, isFyi)}
                            {stageCell(c.aiPass, isUn ? 0 : denom, isFyi)}
                            {stageCell(c.interviews, isUn ? 0 : denom, isFyi)}
                            {stageCell(c.finalPass, isUn ? 0 : denom, isFyi)}
                            <td style={{ padding: '9px 10px', textAlign: 'right', ...num }}>
                              <span style={{ fontWeight: c.hires > 0 ? 800 : 400, color: c.hires > 0 ? (isFyi ? FYI_COLOR : '#0D9488') : '#DDE1E6' }}>{c.hires}</span>
                              {!isUn && denom > 0 && c.hires > 0 && <span style={{ color: '#9CA3AF', marginLeft: 5, fontSize: 11.5 }}>{(c.hires / denom * 100).toFixed(1)}%</span>}
                            </td>
                            {hasCost && (
                              <td style={{ padding: '9px 10px', textAlign: 'right', color: c.spendKrw != null ? '#374151' : '#DDE1E6', ...num }}>
                                {c.spendKrw == null ? '—' : c.spendKrw === 0 ? (isFyi ? L('자체 채널', 'own channel', 'kênh riêng') : L('무료', 'free', 'miễn phí')) : fmtKrw(c.spendKrw)}
                              </td>
                            )}
                            {hasCost && (
                              <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', ...num }}>
                                {c.spendKrw == null || isUn ? <span style={{ color: '#DDE1E6' }}>—</span>
                                  : c.spendKrw === 0 ? <span style={{ fontWeight: 700, color: isFyi ? FYI_COLOR : '#0D9488' }}>₩0</span>
                                  : denom > 0 ? <span style={{ fontWeight: 600, color: '#191F28' }}>{Math.round(c.spendKrw / denom).toLocaleString()}{L('원', ' KRW', ' KRW')}</span>
                                  : '—'}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 20 }}>
                  {L(
                    '% = 그 채널 지원자 대비 단계 도달률. 서류통과·AI합격·최종합격은 KTC 스크리닝 파이프라인 상태, 인터뷰는 Master INTERVIEW 탭(인당 1회), 입사는 KTC Ops Employee — 모두 이메일로 채널 귀속. FYI 지원자는 전체 수(라이브) 기준이고 그중 일부만 파이프라인에 유입돼 서류/AI 단계 수치는 하한값. (채널 외)는 지원 기록이 없는 인터뷰·입사(오프라인 행사·직접 소개 등). 지출은 비용 시트(Alice) 라이브·KRW — KTC 랜딩 지출은 Meta 캠페인 중 KTC* 접두어 캠페인 합계, CPA = 지출 ÷ 지원자.',
                    '% = stage reached / channel applicants. Screened·AI·Final from the KTC pipeline; interviews from the INTERVIEW tab (once per person); hires from KTC Ops — all attributed by email. FYI applicant count is live; only some entered the pipeline, so screened/AI figures are lower bounds. (off-channel) = interviews/hires with no application record. Spend is live from the cost sheet (KRW); landing spend = KTC* Meta campaigns; CPA = spend ÷ applicants.',
                    '% = đạt giai đoạn / ứng viên kênh. Sàng lọc·AI·Cuối từ pipeline KTC; phỏng vấn từ tab INTERVIEW; trúng tuyển từ KTC Ops — quy nguồn theo email. Số ứng viên FYI là số trực tiếp; chỉ một phần vào pipeline nên các cột sàng lọc/AI là giá trị tối thiểu. Chi phí lấy trực tiếp từ sheet chi phí (KRW); CPA = chi phí ÷ ứng viên.'
                  )}
                </div>

                {/* 채널 드릴다운: 퍼널 그래프 + 지원월 코호트 표 */}
                {(() => {
                  const sel = chanRows.find(c => c.key === selChan) || chanRows.find(c => c.key !== '_unattributed')
                  if (!sel) return null
                  const denom = sel.peopleLive || sel.people
                  const STEPS = [
                    [L('지원자', 'Applicants', 'Ứng viên'), denom],
                    [L('서류통과', 'Screened', 'Đạt sàng lọc'), sel.docPass],
                    [L('AI합격', 'AI passed', 'Đạt PV AI'), sel.aiPass],
                    [L('인터뷰', 'Interview', 'Phỏng vấn'), sel.interviews],
                    [L('최종합격', 'Final', 'Đạt cuối'), sel.finalPass],
                    [L('입사', 'Hired', 'Trúng tuyển'), sel.hires],
                  ]
                  const cohortMonths = Object.keys(sel.months || {}).filter(m => m >= '2026-03' && m <= nowMonth).sort()
                  return (
                    <div style={{ border: '1px solid #E5E8EB', borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginRight: 4 }}>{L('채널 상세', 'Channel detail', 'Chi tiết kênh')}</span>
                        {chanRows.filter(c => c.key !== '_unattributed').map(c => {
                          const on = c.key === sel.key
                          return (
                            <button key={c.key} onClick={() => setSelChan(c.key)} style={{
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '5px 12px',
                              border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
                              background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968',
                            }}>
                              {label(c.key)}
                            </button>
                          )
                        })}
                      </div>
                      <AmpChart vals={STEPS.map(s => s[1])} steps={STEPS.map(s => s[0])} />
                      {cohortMonths.length > 0 && (
                        <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflowX: 'auto', marginTop: 14 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                            <thead>
                              <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                                {th(L('지원월 코호트', 'Cohort (month applied)', 'Cohort theo tháng nộp'), 'left', { paddingLeft: 12 })}
                                {th(L('지원자', 'Applicants', 'Ứng viên'))}
                                {th(L('서류통과', 'Screened', 'Đạt sàng lọc'))}
                                {th(L('AI합격', 'AI passed', 'Đạt PV AI'))}
                                {th(L('인터뷰', 'Interview', 'Phỏng vấn'))}
                                {th(L('최종합격', 'Final', 'Đạt cuối'))}
                                {th(L('입사', 'Hired', 'Trúng tuyển'), 'right', { paddingRight: 12 })}
                              </tr>
                            </thead>
                            <tbody>
                              {cohortMonths.map(m => {
                                const v = sel.months[m]
                                const c2 = (n) => <td style={{ padding: '7px 10px', textAlign: 'right', color: n > 0 ? '#374151' : '#DDE1E6', fontWeight: n > 0 ? 600 : 400, ...num }}>{n}</td>
                                return (
                                  <tr key={m} style={{ borderTop: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '7px 10px 7px 12px', fontWeight: 600, color: '#191F28' }}>{monthLabel(m)}</td>
                                    {c2(v.people)}
                                    {c2(v.docPass)}
                                    {c2(v.aiPass)}
                                    {c2(v.interviews)}
                                    {c2(v.finalPass)}
                                    <td style={{ padding: '7px 12px 7px 10px', textAlign: 'right', fontWeight: v.hires > 0 ? 800 : 400, color: v.hires > 0 ? FYI_COLOR : '#DDE1E6', ...num }}>{v.hires}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
                        {L('코호트 = 그 달에 지원한 사람들이 지금까지 도달한 단계 (단계 발생 시점이 아니라 지원월 기준). FYI는 파이프라인 유입분만 월 배정됨.', 'Cohort = people who applied that month, by the stage they have reached so far. FYI months cover pipeline-synced applicants only.', 'Cohort = người nộp trong tháng đó, theo giai đoạn đã đạt đến nay.')}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {funnelMode === 'jd' && (<>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {FILTERS.map(([key, labelTxt, n]) => {
                const on = jdStatusFilter === key
                return (
                  <button key={key} onClick={() => setJdStatusFilter(key)} style={{
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '7px 14px',
                    border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
                    background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968',
                  }}>
                    {labelTxt} <span style={{ opacity: on ? 0.7 : 0.5 }}>{n}</span>
                  </button>
                )
              })}
            </div>
            <div className="adm-m-scroll adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                    {th(L('공고', 'Job', 'Tin đăng'), 'left', { paddingLeft: 14 })}
                    {th(L('상태', 'Status', 'Trạng thái'), 'left')}
                    {th('TO')}
                    {th(L('지원 건', 'Apps', 'Lượt nộp'))}
                    {th(L('지원자', 'People', 'Ứng viên'))}
                    {th(L('서류통과', 'Screened', 'Đạt sàng lọc'))}
                    {th(L('AI합격', 'AI passed', 'Đạt PV AI'))}
                    {th(L('인터뷰', 'Interviews', 'Phỏng vấn'))}
                    {th(L('최종합격', 'Final', 'Đạt cuối'))}
                    {th(L('입사', 'Hired', 'Trúng tuyển'), 'right', { paddingRight: 14 })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(j => {
                    const b = STATUS_BADGE[j.status] || { bg: '#F1F3F5', color: '#868E96' }
                    return (
                      <tr key={j.code} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '9px 10px 9px 14px', maxWidth: 300 }}>
                          <div style={{ fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis' }} title={j.title}>{j.title}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{[j.company, j.code, j.yoe && `${j.yoe}`].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: b.bg, color: b.color }}>{stLabel(j.status)}</span>
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: '#374151', ...num }}>{j.headcount ?? '—'}</td>
                        {cell(j.apps)}
                        {cell(j.people)}
                        {cell(j.docPass)}
                        {cell(j.aiPass)}
                        {cell(j.interviews)}
                        {cell(j.finalPass, true)}
                        <td style={{ padding: '9px 14px 9px 10px', textAlign: 'right', fontWeight: j.hires > 0 ? 800 : 400, color: j.hires > 0 ? FYI_COLOR : '#DDE1E6', ...num }}>{j.hires}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12, lineHeight: 1.6 }}>
              {L(
                '공고 원장·상태는 Master 시트 JD EXECUTION 라이브. 지원 건/지원자/서류통과/AI합격/최종합격은 동기화된 지원 데이터, 인터뷰는 Master INTERVIEW 탭(공고코드 추출·인당 1회), 입사는 KTC Ops Employee를 이메일→공고코드로 귀속(채널 외 채용은 미포함). 시트에 코드가 없는 지원은 집계에서 빠질 수 있음.',
                'JD ledger/status live from the Master sheet. Apps/people/screened/AI/final from synced data; interviews from the INTERVIEW tab (code extracted, once per person); hires attributed via email→job code (off-channel hires excluded). Applications without a job code may be missing.',
                'Danh sách tin/trạng thái lấy trực tiếp từ Master sheet. Lượt nộp/ứng viên/sàng lọc/AI/cuối từ dữ liệu đã đồng bộ; phỏng vấn từ tab INTERVIEW; trúng tuyển quy nguồn qua email→mã tin.'
              )}
            </div>
            </>)}
          </div>
        )
      })()}

      {/* 랜딩 유입 상세 — ktc-landing DB 라이브 (UTM 소스/캠페인/랜딩 내 위치 × 월) */}
      {section === 'landing' && data.landing && (() => {
        const breakdownTable = (title, rows) => {
          const TOP = 8
          const top = rows.slice(0, TOP)
          const rest = rows.slice(TOP)
          const restRow = rest.length > 0 && {
            key: `(${L('기타', 'other', 'khác')} ${rest.length})`,
            total: rest.reduce((s, r) => s + r.total, 0),
            months: rest.reduce((acc, r) => { for (const [m, n] of Object.entries(r.months)) acc[m] = (acc[m] || 0) + n; return acc }, {}),
          }
          const shown = restRow ? [...top, restRow] : top
          return (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 8 }}>{title}</div>
              <div className="adm-m-nowrap" style={{ border: '1px solid #E5E8EB', borderRadius: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                      {th('', 'left', { paddingLeft: 12 })}
                      {shownMonths.map(m => th(monthLabel(m)))}
                      {th(L('합계', 'Total', 'Tổng'), 'right', { paddingRight: 12 })}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(r => (
                      <tr key={r.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td title={r.key} style={{ padding: '7px 10px 7px 12px', fontWeight: 600, color: r.key === '(direct)' ? '#9CA3AF' : '#191F28', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.key}</td>
                        {shownMonths.map(m => (
                          <td key={m} style={{ padding: '7px 10px', textAlign: 'right', color: (r.months[m] || 0) > 0 ? '#374151' : '#DDE1E6', fontVariantNumeric: 'tabular-nums' }}>{r.months[m] || 0}</td>
                        ))}
                        <td style={{ padding: '7px 12px 7px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{r.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
        return (
          <div style={{ marginTop: 26 }}>
            <h4 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 4px' }}>
              {L('랜딩 유입 상세', 'Landing traffic detail', 'Chi tiết nguồn landing')}
              <span style={{ fontSize: 11.5, fontWeight: 500, color: '#9CA3AF', marginLeft: 8 }}>
                {L(`지원 ${data.landing.total.toLocaleString()}건 · ktc-landing DB 라이브`, `${data.landing.total.toLocaleString()} applications · live from ktc-landing DB`, `${data.landing.total.toLocaleString()} lượt nộp · trực tiếp từ DB`)}
              </span>
            </h4>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 12 }}>
              {L('(direct) = UTM 없이 들어온 지원. 마케팅 캠페인별 지원 귀속 — 광고비 붙이면 CPA 산출 가능.', '(direct) = no UTM. Marketing attribution per campaign — add spend to get CPA.', '(direct) = không có UTM. Quy nguồn theo chiến dịch marketing.')}
            </div>
            <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 16, alignItems: 'start' }}>
              {breakdownTable(L('UTM 소스', 'UTM source', 'Nguồn UTM'), data.landing.utmSources)}
              {breakdownTable(L('캠페인', 'Campaign', 'Chiến dịch'), data.landing.campaigns)}
              {breakdownTable(L('랜딩 내 위치', 'Page source', 'Vị trí trên landing'), data.landing.pageSources)}
            </div>
          </div>
        )
      })()}

      {section === 'overview' && (
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.6 }}>
          {L(
            '지원자 수는 유니크 "사람" 기준 — 여러 공고 지원 시 1명, 여러 채널로 온 사람은 최초 유입 채널에만 귀속(ktc-support 동기화가 이메일 기준 전역 중복 제거). 그래서 시트 탭의 행 수(지원 건)보다 작음. FYI 지원자는 KTC 스크리닝 파이프라인에 안 태워져서 질 지표 없음. 시트의 FYI 탭은 갱신이 뒤처져 있어 사용하지 않고 salarymap DB에서 직접 집계.',
            'Counts are unique people — multiple applications = 1, and a person arriving via multiple channels is attributed to their first channel only (ktc-support dedups globally by email). Hence smaller than raw sheet row counts. FYI applicants are not run through the KTC screening pipeline, so no quality metrics. FYI numbers come live from salarymap DB (the sheet FYI tab is stale).',
            'Số ứng viên tính theo "người" unique — nhiều lượt nộp = 1, người đến từ nhiều kênh chỉ tính cho kênh đầu tiên (ktc-support khử trùng lặp toàn cục theo email). Vì vậy nhỏ hơn số dòng thô trên sheet. Ứng viên FYI không qua pipeline sàng lọc KTC nên không có chỉ số chất lượng. Số FYI lấy trực tiếp từ DB salarymap (tab FYI trên sheet đã lỗi thời).'
          )}
        </div>
      )}
    </div>
  )
}
