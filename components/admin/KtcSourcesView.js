import { Fragment, useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

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
function Donut({ segs, total, centerTop, centerSub }) {
  const R = 70, SW = 26, C = 2 * Math.PI * R
  let acc = 0
  return (
    <svg viewBox="0 0 200 200" width={188} height={188} role="img" style={{ flexShrink: 0 }}>
      {segs.map(s => {
        const frac = total > 0 ? s.n / total : 0
        const len = Math.max(0, frac * C - 2)
        const offset = -acc * C
        acc += frac
        if (len <= 0) return null
        return (
          <circle
            key={s.key} cx="100" cy="100" r={R} fill="none"
            stroke={s.color} strokeWidth={SW}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
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
  const { data, isLoading, mutate } = useAdmin(`/api/admin/ktc-sources${qs}`, token)
  const [showAllJobs, setShowAllJobs] = useState(false)
  const [openJobs, setOpenJobs] = useState({}) // 공고 행 펼침 (채널×월 상세)
  const [basis, setBasis] = useState('people') // 'people' 유니크 지원자 | 'apps' 지원 건(중복 포함)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

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
      </div>

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
                      <div style={{ width: `${(r.n / maxTotal) * 100}%`, height: '100%', background: r.isFyi ? FYI_COLOR : '#2563EB', borderRadius: 4 }} />
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

      {/* 공고 × 채널 크로스탭 */}
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

      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, lineHeight: 1.6 }}>
        {L(
          '지원자 수는 유니크 "사람" 기준 — 여러 공고 지원 시 1명, 여러 채널로 온 사람은 최초 유입 채널에만 귀속(ktc-support 동기화가 이메일 기준 전역 중복 제거). 그래서 시트 탭의 행 수(지원 건)보다 작음. FYI 지원자는 KTC 스크리닝 파이프라인에 안 태워져서 질 지표 없음. 시트의 FYI 탭은 갱신이 뒤처져 있어 사용하지 않고 salarymap DB에서 직접 집계. 크로스탭의 FYI는 회사·제목 매칭이라 일부 공고는 별도 행으로 나올 수 있음.',
          'Counts are unique people — multiple applications = 1, and a person arriving via multiple channels is attributed to their first channel only (ktc-support dedups globally by email). Hence smaller than raw sheet row counts. FYI applicants are not run through the KTC screening pipeline, so no quality metrics. FYI numbers come live from salarymap DB (the sheet FYI tab is stale). Cross-tab FYI matches by company+title; unmatched jobs appear as separate rows.',
          'Số ứng viên tính theo "người" unique — nhiều lượt nộp = 1, người đến từ nhiều kênh chỉ tính cho kênh đầu tiên (ktc-support khử trùng lặp toàn cục theo email). Vì vậy nhỏ hơn số dòng thô trên sheet. Ứng viên FYI không qua pipeline sàng lọc KTC nên không có chỉ số chất lượng. Số FYI lấy trực tiếp từ DB salarymap (tab FYI trên sheet đã lỗi thời). Cột FYI trong bảng chéo khớp theo công ty+chức danh; tin không khớp hiển thị thành dòng riêng.'
        )}
      </div>
    </div>
  )
}
