import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'
import { AmpChart } from './BehaviorFunnel'

// 이력서 작성 이탈 — "등록하다 어디서 나가는가".
// 계산은 전부 /api/admin/funnel-explore (Postgres funnel RPC) 에 맡기고 여기선 그리기만 한다.
//
// 순서 주의: 아래 퍼널은 모두 order='this'(직전 단계 이후 발생해야 인정)라 UI 상 순서가
// 보장되는 단계만 넣었다. /cv 직무 선택(cv_select_role)은 파일 첨부 없이도 만질 수 있어
// 순차 퍼널에 넣으면 먼저 고른 사람이 가짜 이탈로 잡힌다 → 제외(행동 퍼널에서 order='any' 로 조회).

const WINDOW_SEC = 86400 // 이력서 등록은 한자리에서 끝나는 흐름 — 1일이면 넉넉하다

/* cv_scroll_depth 가 배포된 날. 이 이전 기간을 섞으면 깊이를 모르는 사람이 전부
   "25% 미만"으로 떨어져 이탈이 크게 부풀려진다(실제로 30일 기본 범위에서 73.7% 로
   보였다). 주의 문구로는 오독을 못 막으니 카드 질의 자체를 이 날짜로 가둔다. */
const SCROLL_SINCE = '2026-08-25'

const FUNNELS = [
  {
    key: 'cv',
    title: ['/cv 광고 랜딩 등록', '/cv ad-landing registration'],
    // 2026-08-18 에 cv_form_view 누락 수정 + cv_open_picker 계측이 붙었다. 그 전 기간을
    // 조회하면 두 단계가 0 에 가깝게 나오는 게 정상이다(아래 주의 문구 참조).
    steps: [
      { event: 'cv_view', label: ['CV 페이지 뷰', 'CV view', 'Xem trang CV'] },
      { event: 'cv_form_view', label: ['등록 폼 도달', 'Form reached', 'Tới form'] },
      { event: 'cv_open_picker', label: ['파일 피커 열기', 'Picker opened', 'Mở chọn file'] },
      { event: 'cv_attach_file', label: ['파일 첨부', 'File attached', 'Đính kèm'] },
      { event: 'cv_oauth_start', label: ['로그인 시작', 'Login start', 'Bắt đầu login'] },
      { event: 'cv_register_success', label: ['등록 완료', 'Registered', 'Hoàn tất'] },
    ],
  },
  {
    key: 'resume',
    title: ['이력서 업로드 → AI 인식', 'Resume upload → AI parse'],
    // AI 인식이 끝나는 시점에 서버 저장까지 끝난다(별도 '저장' 불필요) → 인식 완료 = 등록 완료.
    note: ['AI 인식이 끝나면 서버 저장까지 끝나므로 "인식 완료"가 곧 등록 완료다.',
           'AI parse also persists to the server, so "parse done" is registration complete.',
           'AI nhận dạng xong là đã lưu server, nên "nhận dạng xong" là hoàn tất đăng ký.'],
    steps: [
      { event: 'profile_view', label: ['프로필 진입', 'Profile view', 'Vào hồ sơ'] },
      { event: 'resume_upload', label: ['이력서 업로드', 'Resume upload', 'Tải CV'] },
      { event: 'profile_ai_parse_start', label: ['AI 인식 시작', 'AI parse start', 'Bắt đầu AI'] },
      { event: 'profile_ai_parse_done', label: ['AI 인식 완료', 'AI parse done', 'AI xong'] },
    ],
  },
  {
    key: 'edit',
    title: ['직접 작성 → 저장', 'Manual edit → save'],
    // 저장 버튼은 dirty 일 때만 뜨므로 '작성 시작' 없이 '저장'이 발생할 수 없다(순서 안전).
    note: ['저장 버튼은 수정이 있을 때만 노출된다 — 즉 마지막 구간이 "쓰다 만 사람"이다.',
           'The save button only appears once the form is dirty — the last gap is unsaved work.',
           'Nút lưu chỉ hiện khi có chỉnh sửa — khoảng cuối là phần viết dở.'],
    steps: [
      { event: 'profile_view', label: ['프로필 진입', 'Profile view', 'Vào hồ sơ'] },
      { event: 'profile_edit_start', label: ['작성 시작', 'Edit start', 'Bắt đầu viết'] },
      { event: 'profile_save_success', label: ['저장 완료', 'Saved', 'Đã lưu'] },
    ],
  },
]

// 이탈·실패는 성공 경로가 아니라서 순차 퍼널에 넣을 수 없다 — 건수로 따로 본다.
const SIGNALS = [
  { event: 'profile_abandon_discard', tone: 'bad',
    label: ['저장 안 하고 나감', 'Left without saving', 'Rời không lưu'],
    desc: ['이탈 확인 모달에서 "저장 안 함" 선택 — 작성분이 실제로 버려진 건',
           'Chose "discard" in the leave modal — work actually lost',
           'Chọn "không lưu" — nội dung bị mất'] },
  { event: 'profile_abandon_dirty', tone: 'warn',
    label: ['저장 전 이탈 시도', 'Left while unsaved', 'Rời khi chưa lưu'],
    desc: ['탭 전환 · 페이지 이동 · 탭 닫기 모두 포함(모달 노출 시점)',
           'Tab switch, route change and tab close (when the guard fires)',
           'Chuyển tab, đổi trang, đóng tab'] },
  { event: 'profile_ai_parse_error', tone: 'bad',
    label: ['AI 인식 실패', 'AI parse failed', 'AI thất bại'],
    desc: ['업로드는 됐는데 파싱에서 깨진 건 — 등록 직전 이탈의 주범',
           'Uploaded but parsing broke — a prime cause of last-step drop',
           'Đã tải lên nhưng phân tích lỗi'] },
  { event: 'profile_save_error', tone: 'bad',
    label: ['저장 실패', 'Save failed', 'Lưu thất bại'],
    desc: ['저장 버튼을 눌렀는데 서버가 거절한 건',
           'User pressed save but the server rejected it',
           'Nhấn lưu nhưng server từ chối'] },
  { event: 'cv_attach_rejected', tone: 'warn',
    label: ['파일 거절 (/cv)', 'File rejected (/cv)', 'File bị từ chối'],
    desc: ['10MB 초과로 첨부가 막힌 건',
           'Blocked for exceeding the 10MB limit',
           'Vượt quá 10MB'] },
  { event: 'cv_register_error', tone: 'bad',
    label: ['등록 실패 (/cv)', 'Register failed (/cv)', 'Đăng ký lỗi'],
    desc: ['업로드/프로필 갱신 단계에서 터진 건',
           'Failed during upload or profile update',
           'Lỗi khi tải lên hoặc cập nhật hồ sơ'] },
]

const fmt = (n) => (n === null || n === undefined ? '—' : n.toLocaleString())
const pct = (a, b, digits = 1) => (b > 0 ? ((a / b) * 100).toFixed(digits) : null)

const TONE = { bad: '#C2452B', warn: '#B45309' }

// 퍼널 카드 한 장 — 이탈률(큰 숫자) + 최대 이탈 구간 + 단계 차트.
function FunnelCard({ f, res, L }) {
  const { data, error, isLoading } = res
  const vals = f.steps.map(s => data?.steps?.find(r => r.event === s.event)?.users ?? 0)
  const entered = vals[0]
  const done = vals[vals.length - 1]
  // 이 탭의 주인공 = 이탈률과 "어디서" 빠지는가. 가장 많이 잃은 구간을 헤더에 박아둔다.
  const dropRate = entered > 0 ? pct(entered - done, entered) : null
  const worst = vals.slice(0, -1)
    .map((v, k) => ({ k, loss: v - vals[k + 1], from: v }))
    .sort((a, b) => b.loss - a.loss)[0]

  return (
    <div style={{ ...sectionStyle, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#333' }}>{L(...f.title)}</div>
          {data && (
            <div style={{ fontSize: 11.5, color: '#8B95A1', marginTop: 3 }}>
              {L('진입', 'Entered', 'Vào')} <b style={{ color: '#191F28' }}>{fmt(entered)}</b>
              {' → '}{L('완주', 'completed', 'hoàn tất')} <b style={{ color: '#191F28' }}>{fmt(done)}</b>
              {worst && worst.loss > 0 && (
                <> · {L('최대 이탈', 'Biggest drop', 'Rơi nhiều nhất')}{' '}
                  <b style={{ color: TONE.bad }}>
                    {L(...f.steps[worst.k].label)} → {L(...f.steps[worst.k + 1].label)} −{fmt(worst.loss)}
                    {worst.from > 0 && ` (${pct(worst.loss, worst.from)}%)`}
                  </b>
                </>
              )}
            </div>
          )}
        </div>
        {data && dropRate !== null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: TONE.bad, lineHeight: 1 }}>{dropRate}%</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B95A1', marginTop: 3 }}>{L('이탈률', 'Drop-off', 'Tỷ lệ rời')}</div>
          </div>
        )}
      </div>
      {error ? (
        <div style={{ padding: '18px 0', color: '#c00', fontSize: 12.5 }}>{error.message}</div>
      ) : isLoading && !data ? (
        <div style={{ padding: '18px 0', color: '#999', fontSize: 12.5 }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
      ) : (
        <AmpChart vals={vals} steps={f.steps.map(s => L(...s.label))} />
      )}
      {f.note && <div style={{ fontSize: 11, color: '#8B95A1', lineHeight: 1.7 }}>{L(...f.note)}</div>}
    </div>
  )
}

/* 배포 전후를 같은 길이의 창으로 나란히 놓는다. 날짜 피커를 안 쓰는 이유는
   API 쪽 주석에 적었다 — 이 표는 배포 시점에 고정돼야 뜻이 있다. */
/* 진입 → 폼 도달 → 등록 완료가 주 3단이고 나머지는 그 사이를 설명하는 보조 지표다.
   한 표에 두되 주 3단만 굵게 둔다. */
const CMP_ROWS = [
  { key: 'cv_view', ko: '진입', en: 'Views', vi: 'Lượt xem', base: true, strong: true },
  { key: 'cv_form_view', ko: '폼 도달', en: 'Form reached', vi: 'Tới form', strong: true },
  { key: 'cv_open_picker', ko: '피커 열기', en: 'Picker opened', vi: 'Mở chọn file' },
  { key: 'cv_attach_file', ko: '첨부', en: 'Attached', vi: 'Đính kèm' },
  { key: 'cv_register_success', ko: '등록 완료', en: 'Registered', vi: 'Hoàn tất', strong: true },
  { key: 'cv_click_hero_cta', ko: '히어로 CTA 클릭', en: 'Hero CTA click', vi: 'Bấm CTA đầu' },
  { key: 'cv_scrolldown_click', ko: '하단 CTA 바 클릭', en: 'Bottom CTA click', vi: 'Bấm CTA dưới' },
]

function DeployCompareCard({ res, L }) {
  const { data, error, isLoading } = res
  /* 하루가 안 찼으면 원값 그대로 — 22시간치를 24시간으로 부풀리면 안 본 2시간을
     예측으로 채우는 셈이다. 하루를 넘긴 뒤에는 완료된 날수로만 나눈다. */
  const days = data?.days || 0
  const asAvg = days >= 1
  const show = (v) => (asAvg ? (v / days).toFixed(1) : fmt(v))
  const cell = (side, r) => {
    const v = data?.[side]?.[r.key] ?? 0
    const base = data?.[side]?.cv_view ?? 0
    return { v, rate: r.base || base === 0 ? null : (v / base) * 100 }
  }
  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#8B95A1', textAlign: 'right', whiteSpace: 'nowrap' }
  const td = { padding: '8px 10px', fontSize: 12.5, color: '#191F28', textAlign: 'right', whiteSpace: 'nowrap' }
  return (
    <div style={{ ...sectionStyle, marginBottom: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#333', marginBottom: 2 }}>
        {L('2026-08-25 배포 전후 비교', 'Before vs after the 2026-08-25 deploy', 'So sánh trước/sau triển khai 2026-08-25')}
      </div>
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12, lineHeight: 1.7 }}>
        {L('배포 시각을 기준으로 같은 길이의 창을 나란히 둔다 — 위 날짜 피커와 무관하다. "전" 창은 계측이 바뀐 8/18 을 넘지 않게 최대 7일로 막아둔다(넘으면 배포 효과가 아니라 계측 차이를 보게 된다).',
           'Two equal windows anchored on the deploy time — independent of the date picker above. The "before" window is capped at 7 days so it never crosses the 8/18 instrumentation change.',
           'Hai cửa sổ bằng nhau quanh thời điểm triển khai — không phụ thuộc bộ chọn ngày ở trên.')}
      </div>
      {error ? <div style={{ color: '#c00', fontSize: 12.5 }}>{error.message}</div>
        : isLoading && !data ? <div style={{ color: '#999', fontSize: 12.5 }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
        : (
        <>
          <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 8 }}>
            {L('배포', 'Deployed', 'Triển khai')}{' '}
            <b style={{ color: '#191F28' }}>
              {new Date(data.deployAt).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 16)} VN
            </b>
            {' · '}
            {asAvg
              ? <>
                  <b style={{ color: '#191F28' }}>{L('일 평균', 'Per day', 'Mỗi ngày')}</b>
                  <span style={{ color: '#8B95A1' }}>
                    {' '}({L(`완료된 ${days}일치를 나눈 값`, `averaged over ${days} whole day${days > 1 ? 's' : ''}`, `chia cho ${days} ngày trọn`)})
                  </span>
                </>
              : <><b style={{ color: '#191F28' }}>{data.hours}h</b>
                <span style={{ color: TONE.warn }}>
                  {' '}({L(`아직 24시간이 안 지나 ${data.hours}h 기준입니다`,
                          `less than 24h since deploy — ${data.hours}h window`,
                          `chưa đủ 24h — cửa sổ ${data.hours}h`)})
                </span></>}
            {data.capped && <span style={{ color: TONE.warn }}>{' '}({L('7일 상한 도달 — 더 늘지 않음', 'capped at 7 days', 'giới hạn 7 ngày')})</span>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 470 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ ...th, textAlign: 'left' }} />
                  <th style={th}>{asAvg
                    ? L(`배포 전 (일 평균)`, `Before (per day)`, `Trước (mỗi ngày)`)
                    : L(`배포 전 ${data.hours}h`, `Before ${data.hours}h`, `Trước ${data.hours}h`)}</th>
                  <th style={th}>{asAvg
                    ? L(`배포 후 (일 평균)`, `After (per day)`, `Sau (mỗi ngày)`)
                    : L(`배포 후 ${data.hours}h`, `After ${data.hours}h`, `Sau ${data.hours}h`)}</th>
                  <th style={th}>{L('변화', 'Change', 'Thay đổi')}</th>
                </tr>
              </thead>
              <tbody>
                {CMP_ROWS.map(r => {
                  const b = cell('before', r), a = cell('after', r)
                  const dp = b.rate !== null && a.rate !== null ? a.rate - b.rate : null
                  // 진입(분모)은 비율이 없으니 물량 증감률로 본다.
                  const dv = b.v > 0 ? ((a.v - b.v) / b.v) * 100 : null
                  const good = dp !== null ? dp > 0 : dv !== null && dv > 0
                  const bad = dp !== null ? dp < 0 : dv !== null && dv < 0
                  return (
                    <tr key={r.key} style={{ borderBottom: '1px solid #f4f5f6', background: r.strong ? '#FAFBFC' : undefined }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: r.strong ? 700 : 500, color: '#475569' }}>{L(r.ko, r.en, r.vi)}</td>
                      <td style={td}>
                        <b>{show(b.v)}</b>
                        {b.rate !== null && <span style={{ color: '#8B95A1' }}> ({b.rate.toFixed(1)}%)</span>}
                      </td>
                      <td style={td}>
                        <b>{show(a.v)}</b>
                        {a.rate !== null && <span style={{ color: '#8B95A1' }}> ({a.rate.toFixed(1)}%)</span>}
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: good ? '#0F7B6C' : bad ? TONE.bad : '#8B95A1' }}>
                        {dp !== null
                          ? `${dp > 0 ? '+' : ''}${dp.toFixed(1)}%p`
                          : dv !== null ? `${dv > 0 ? '+' : ''}${dv.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 10, lineHeight: 1.6 }}>
            {data.before.signup_from_cv !== undefined && (
              <div style={{ marginBottom: 6 }}>
                <b style={{ color: '#475569' }}>{L('비고 · 가입', 'Note · signups', 'Ghi chú · đăng ký')}</b>
                {' — '}
                {L('/cv 진입자 중 회원가입', 'signed up among /cv visitors', 'đăng ký trong số khách /cv')}{' '}
                <b style={{ color: '#191F28' }}>{show(data.before.signup_from_cv)}</b>
                {' → '}
                <b style={{ color: '#191F28' }}>{show(data.after.signup_from_cv)}</b>
                {(() => {
                  const bp = data.before.cv_view ? (data.before.signup_from_cv / data.before.cv_view) * 100 : null
                  const ap = data.after.cv_view ? (data.after.signup_from_cv / data.after.cv_view) * 100 : null
                  if (bp === null || ap === null) return null
                  return <span style={{ color: '#8B95A1' }}>
                    {' '}({bp.toFixed(1)}% → {ap.toFixed(1)}%,{' '}
                    <b style={{ color: ap - bp > 0 ? '#0F7B6C' : ap - bp < 0 ? TONE.bad : '#8B95A1' }}>
                      {ap - bp > 0 ? '+' : ''}{(ap - bp).toFixed(1)}%p
                    </b>)
                  </span>
                })()}
              </div>
            )}
            {L('사람(client_id) 단위 · 비율은 진입 대비 · 하루가 차기 전에는 창 길이만큼의 실제 건수, 하루를 넘기면 완료된 날수로 나눈 일 평균이다(부분 일수는 버린다). 표본이 수백 명 아래면 방향만 읽고 유의성은 말하지 말 것 — 하루 진입이 100 안팎이라 며칠은 모아야 한다.',
               'Per client_id · rates are share of views. Below a few hundred users read direction only, not significance.',
               'Theo client_id · tỷ lệ so với lượt xem. Dưới vài trăm người chỉ đọc xu hướng.')}
          </div>
        </>
      )}
    </div>
  )
}

/* 폼에 닿지 못한 사람이 "아예 안 내려간 건지 내려가다 만 건지" — 순차 퍼널은
   도달한 사람만 세므로 이 질문에 답할 수 없다. cv_scroll_depth 로 사람 단위 최대
   깊이를 접어서 본다. 둘은 처방이 반대다: 안 내려갔으면 거리·신호 문제이고,
   내려가다 말았으면 중간 콘텐츠가 이탈시킨 것이다. */
const DEPTH_ROWS = [
  { key: 'lt25', ko: '25% 미만 (사실상 안 내려감)', en: 'Under 25% (barely scrolled)', vi: 'Dưới 25%', tone: TONE.bad },
  { key: 'p25', ko: '25~50%', en: '25–50%', vi: '25–50%', tone: TONE.warn },
  { key: 'p50', ko: '50~75%', en: '50–75%', vi: '50–75%', tone: TONE.warn },
  { key: 'p75', ko: '75~100%', en: '75–100%', vi: '75–100%', tone: TONE.warn },
  { key: 'p100', ko: '끝까지 갔는데 폼 미도달', en: 'Hit bottom, form not reached', vi: 'Tới đáy nhưng chưa tới form', tone: TONE.warn },
  { key: 'form', ko: '등록 폼 도달', en: 'Reached the form', vi: 'Đã tới form', tone: '#0F7B6C' },
]

const VIA_ROWS = [
  { key: 'hero', ko: '히어로 CTA', en: 'Hero CTA', vi: 'CTA đầu trang' },
  { key: 'scrolldown', ko: '하단 CTA 바', en: 'Bottom CTA bar', vi: 'Thanh CTA dưới' },
  { key: 'scroll', ko: '맨손 스크롤', en: 'Plain scroll', vi: 'Tự cuộn' },
]

function ScrollDepthCard({ res, L, from, to, clamped, pickedFrom }) {
  const { data, error, isLoading } = res
  const n = data?.viewers || 0
  return (
    <div style={{ ...sectionStyle, marginBottom: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#333', marginBottom: 2 }}>
        {L('폼에 닿기 전 어디까지 내려갔나', 'How far they scrolled before the form', 'Cuộn tới đâu trước khi tới form')}
      </div>
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12, lineHeight: 1.7 }}>
        {L('순차 퍼널은 도달한 사람만 센다 — 못 온 사람이 아예 안 내려간 건지 내려가다 만 건지는 여기서만 보인다. 처방이 반대다(거리·신호 vs 중간 콘텐츠).',
           'Sequential funnels only count arrivals — this is the only place that separates "never scrolled" from "gave up midway". The fixes are opposite.',
           'Phễu tuần tự chỉ đếm người tới nơi — chỉ ở đây mới tách được "không cuộn" và "bỏ giữa chừng".')}
      </div>
      {/* 이 카드의 숫자는 8/25 배포 이후에만 존재한다 — 무엇이 바뀐 뒤의 값인지
          한 줄로 박아둬야 나중에 이 표를 배포 전 수치와 섞어 읽지 않는다. */}
      <div style={{
        border: '1px solid #e5e7eb', borderLeft: `3px solid ${TONE.warn}`, borderRadius: 8,
        background: '#FCFCFD', padding: '9px 12px', marginBottom: 14,
        fontSize: 11.5, fontWeight: 700, color: '#475569',
      }}>
        {L('2026-08-25 배포 내역', 'Shipped 2026-08-25', 'Triển khai 2026-08-25')}
      </div>
      {error ? <div style={{ color: '#c00', fontSize: 12.5 }}>{error.message}</div>
        : isLoading && !data ? <div style={{ color: '#999', fontSize: 12.5 }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
        : (
        <>
          <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 10 }}>
            <b style={{ color: '#191F28' }}>{from} ~ {to}</b>
            {clamped && (
              <span style={{ color: TONE.warn }}>
                {' '}({L(`피커는 ${pickedFrom} 부터지만 계측 배포일로 맞춤`,
                        `picker starts ${pickedFrom}; clamped to the instrumentation date`,
                        `bộ chọn từ ${pickedFrom}; đã kẹp về ngày triển khai`)})
              </span>
            )}
            {' · '}{L('CV 페이지 뷰', 'CV views', 'Lượt xem CV')} <b style={{ color: '#191F28' }}>{fmt(n)}</b>
            {' · '}{L('등록 완료', 'registered', 'hoàn tất')} <b style={{ color: '#191F28' }}>{fmt(data.done)}</b>
            {n > 0 && ` (${pct(data.done, n)}%)`}
          </div>
          {DEPTH_ROWS.map(r => {
            const v = data.depth?.[r.key] ?? 0
            const w = n > 0 ? (v / n) * 100 : 0
            return (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 190, flexShrink: 0, fontSize: 12, color: '#475569' }}>{L(r.ko, r.en, r.vi)}</div>
                <div style={{ flex: 1, height: 18, background: '#F2F4F6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: r.tone, borderRadius: 4 }} />
                </div>
                <div style={{ width: 96, flexShrink: 0, textAlign: 'right', fontSize: 12, color: '#191F28' }}>
                  <b>{fmt(v)}</b> <span style={{ color: '#8B95A1' }}>{n > 0 ? `${pct(v, n)}%` : ''}</span>
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #eef0f2' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
              {L('폼까지 무엇을 밟고 왔나 · 그중 등록 완료', 'What got them to the form · and who finished',
                 'Nhờ đâu tới form · và ai hoàn tất')}
            </div>
            <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {VIA_ROWS.map(r => {
                const reached = data.viaDone?.[r.key]?.[0] ?? 0
                const fin = data.viaDone?.[r.key]?.[1] ?? 0
                return (
                  <div key={r.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{L(r.ko, r.en, r.vi)}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#191F28', marginTop: 6, lineHeight: 1.1 }}>{fmt(reached)}</div>
                    <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 6 }}>
                      {L('등록 완료', 'registered', 'hoàn tất')} <b style={{ color: '#0F7B6C' }}>{fmt(fin)}</b>
                      {reached > 0 && ` (${pct(fin, reached)}%)`}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 8, lineHeight: 1.6 }}>
              {L('CTA 를 눌렀다는 것 자체가 등록 의사가 있다는 신호다 — 세 값의 차이를 버튼의 효과로 읽지 말 것.',
                 'Clicking a CTA already signals intent — do not read the gap as the button causing registration.',
                 'Việc bấm CTA đã là tín hiệu ý định — đừng coi chênh lệch là hiệu quả của nút.')}
            </div>
          </div>
          {data.truncated && (
            <div style={{ fontSize: 11, color: TONE.warn, marginTop: 10 }}>
              {L('행 상한에 걸려 일부만 집계했다 — 기간을 좁혀서 볼 것.',
                 'Row cap hit — narrow the date range.', 'Đã chạm giới hạn dòng — thu hẹp khoảng ngày.')}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// 접이식 퍼널 헤더 — 닫혀 있으면 해당 퍼널은 요청조차 보내지 않는다.
function ToggleBar({ open, onClick, title, L }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginBottom: 12,
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 20px',
        fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer', textAlign: 'left',
      }}>
      <span style={{ fontSize: 10, color: '#8B95A1' }}>{open ? '▼' : '▶'}</span>
      {title}
      <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1' }}>
        {open ? L('접기', 'hide', 'ẩn') : L('펼치기', 'show', 'hiện')}
      </span>
    </button>
  )
}

export default function ResumeDropoffSection({ token, lang, dateRange }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  const range = `from=${dateRange.from}&to=${dateRange.to}`
  // /profile 쪽 퍼널 2종은 하단 토글 — 열기 전엔 요청도 보내지 않는다.
  const [showParse, setShowParse] = useState(false)
  const [showSave, setShowSave] = useState(false)
  // 스크롤 깊이는 지금 판단에 쓰는 값이 아니라 나중을 위해 남겨둔 계측 — 접어 둔다.
  const [showDepth, setShowDepth] = useState(false)

  const funnelUrl = (f) => `/api/admin/funnel-explore?steps=${f.steps.map(s => s.event).join(',')}&${range}&window=${WINDOW_SEC}&order=this`
  // 퍼널 3종 + 이탈/실패 건수 1종. 훅은 조건 없이 항상 같은 개수로 호출한다.
  const f0 = useAdmin(funnelUrl(FUNNELS[0]), token)
  const f1 = useAdmin(showParse ? funnelUrl(FUNNELS[1]) : null, token)
  const f2 = useAdmin(showSave ? funnelUrl(FUNNELS[2]) : null, token)
  const sig = useAdmin(`/api/admin/funnel-explore?steps=${SIGNALS.map(s => s.event).join(',')}&${range}&mode=count`, token)
  // 카드 질의는 계측 배포일 이전으로 내려가지 않는다 — 피커가 더 과거를 가리켜도 클램프한다.
  const depthFrom = dateRange.from < SCROLL_SINCE ? SCROLL_SINCE : dateRange.from
  const depthClamped = depthFrom !== dateRange.from
  const depth = useAdmin(showDepth ? `/api/admin/cv-dropoff?from=${depthFrom}&to=${dateRange.to}` : null, token)
  // 배포 전후 비교는 피커와 무관하게 배포 시각에 고정 — 키에 날짜를 넣지 않는다.
  const cmp = useAdmin('/api/admin/cv-deploy-compare', token)

  const sigCount = Object.fromEntries((sig.data?.steps || []).map(s => [s.event, s.count]))

  return (
    <>
      {/* 제목은 탭 라벨이 대신한다 — 여기선 집계 기준만 밝힌다 */}
      <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 12 }}>
        {dateRange.from} ~ {dateRange.to} · {L('유저 단위 순차 퍼널 · 전환 윈도우 1일', 'Per-user sequential funnel · 1-day window', 'Phễu tuần tự theo người dùng · cửa sổ 1 ngày')}
      </div>

      <FunnelCard f={FUNNELS[0]} res={f0} L={L} />

      {/* 이번 배포가 실제로 무엇을 바꿨나 — 같은 길이의 창 두 개 */}
      <DeployCompareCard res={cmp} L={L} />


      {/* 이탈·실패 신호 — 퍼널 단계가 아니라 건수 */}
      <div style={{ ...sectionStyle, marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#333', marginBottom: 2 }}>
          {L('이탈 · 실패 신호 (건수)', 'Drop-off & failure signals (events)', 'Tín hiệu rời bỏ · lỗi (sự kiện)')}
        </div>
        <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12 }}>
          {L('성공 경로가 아니라 순차 퍼널에 넣을 수 없는 값들 — 위 차트의 빈 구간을 설명한다.',
             'Negative outcomes that cannot sit in a sequential funnel — they explain the gaps above.',
             'Kết quả tiêu cực không thể đưa vào phễu tuần tự — giải thích các khoảng trống ở trên.')}
        </div>
        {sig.error ? (
          <div style={{ color: '#c00', fontSize: 12.5 }}>{sig.error.message}</div>
        ) : (
          <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {SIGNALS.map(s => (
              <div key={s.event} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{L(...s.label)}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: TONE[s.tone], marginTop: 6, lineHeight: 1.1 }}>
                  {sig.data ? fmt(sigCount[s.event] ?? 0) : '…'}
                </div>
                <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 6, lineHeight: 1.5 }}>{L(...s.desc)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 스크롤 깊이 — 나중을 위해 남긴 계측이라 접어둔다 */}
      <ToggleBar open={showDepth} onClick={() => setShowDepth(v => !v)}
        title={L('폼에 닿기 전 어디까지 내려갔나', 'How far they scrolled before the form', 'Cuộn tới đâu trước khi tới form')} L={L} />
      {showDepth && <ScrollDepthCard res={depth} L={L} from={depthFrom} to={dateRange.to} clamped={depthClamped} pickedFrom={dateRange.from} />}

      {/* /profile 퍼널 2종 — 자주 보는 값이 아니라 토글로 접어둔다 */}
      <ToggleBar open={showParse} onClick={() => setShowParse(v => !v)} title={L(...FUNNELS[1].title)} L={L} />
      {showParse && <FunnelCard f={FUNNELS[1]} res={f1} L={L} />}

      <ToggleBar open={showSave} onClick={() => setShowSave(v => !v)} title={L(...FUNNELS[2].title)} L={L} />
      {showSave && <FunnelCard f={FUNNELS[2]} res={f2} L={L} />}

      <div style={{ fontSize: 11, color: '#8B95A1', lineHeight: 1.8, marginBottom: 24 }}>
        <b style={{ color: '#C2452B' }}>{L('계측 시작일 주의', 'New instrumentation', 'Lưu ý ngày bắt đầu')}</b>
        {L(' — /cv 계측은 두 번 늘었다: cv_form_view · cv_open_picker 는 2026-08-18 부터, cv_scroll_depth 와 하단 CTA 바(cv_scrolldown_click, meta.style="bar")는 2026-08-25 부터다. 그 이전 기간을 조회하면 해당 단계가 0 에 가깝게 나오는 게 정상이고, 스크롤 깊이 카드의 "25% 미만"이 부풀려진다(계측이 없어 깊이를 모르는 사람이 그 칸에 들어간다). /profile 이벤트(profile_*)는 이번 배포부터 쌓인다. 배포 이전 기간을 조회하면 0으로 보이는 게 정상이니 날짜를 배포일 이후로 맞출 것. resume_upload 는 이전에도 있었지만 client_id 가 없어 순차 퍼널에 붙지 않는다(이번 배포부터 붙음). 직무 선택(cv_select_role)은 파일 첨부 전에도 가능해 순차 퍼널에서 뺐다 — 메인 퍼널 탭의 행동 퍼널에서 순서 "any" 로 보면 된다.',
           ' — /profile events start with this deploy; earlier ranges legitimately read 0. resume_upload existed before but had no client_id, so it only stitches from this deploy. cv_select_role is excluded from sequential funnels (it can precede file attach) — use order "any" in the behavior funnel.',
           ' — Sự kiện /profile bắt đầu từ lần triển khai này; khoảng thời gian trước đó hiển thị 0 là đúng. cv_select_role bị loại khỏi phễu tuần tự — dùng thứ tự "any" ở phễu hành vi.')}
      </div>
    </>
  )
}
