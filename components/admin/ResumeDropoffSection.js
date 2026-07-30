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

const FUNNELS = [
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
  {
    key: 'cv',
    title: ['/cv 광고 랜딩 등록', '/cv ad-landing registration'],
    note: ['로그인 시작 → 복귀 구간이 OAuth 로 이탈한 사람이다.',
           'The start → return gap is people lost inside the OAuth redirect.',
           'Khoảng bắt đầu → quay lại là người rời bỏ trong OAuth.'],
    steps: [
      { event: 'cv_view', label: ['CV 페이지 뷰', 'CV view', 'Xem trang CV'] },
      { event: 'cv_attach_file', label: ['파일 첨부', 'File attached', 'Đính kèm'] },
      { event: 'cv_oauth_start', label: ['로그인 시작', 'Login start', 'Bắt đầu login'] },
      { event: 'cv_oauth_return', label: ['로그인 복귀', 'Login return', 'Quay lại'] },
      { event: 'cv_register_success', label: ['이력서 등록', 'Registered', 'Đã đăng ký'] },
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

export default function ResumeDropoffSection({ token, lang, dateRange }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  const range = `from=${dateRange.from}&to=${dateRange.to}`

  // 퍼널 3종 + 이탈/실패 건수 1종. 훅은 조건 없이 항상 같은 개수로 호출한다.
  const f0 = useAdmin(`/api/admin/funnel-explore?steps=${FUNNELS[0].steps.map(s => s.event).join(',')}&${range}&window=${WINDOW_SEC}&order=this`, token)
  const f1 = useAdmin(`/api/admin/funnel-explore?steps=${FUNNELS[1].steps.map(s => s.event).join(',')}&${range}&window=${WINDOW_SEC}&order=this`, token)
  const f2 = useAdmin(`/api/admin/funnel-explore?steps=${FUNNELS[2].steps.map(s => s.event).join(',')}&${range}&window=${WINDOW_SEC}&order=this`, token)
  const sig = useAdmin(`/api/admin/funnel-explore?steps=${SIGNALS.map(s => s.event).join(',')}&${range}&mode=count`, token)
  const results = [f0, f1, f2]

  const sigCount = Object.fromEntries((sig.data?.steps || []).map(s => [s.event, s.count]))

  return (
    <>
      {/* 제목은 탭 라벨이 대신한다 — 여기선 집계 기준만 밝힌다 */}
      <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 12 }}>
        {dateRange.from} ~ {dateRange.to} · {L('유저 단위 순차 퍼널 · 전환 윈도우 1일', 'Per-user sequential funnel · 1-day window', 'Phễu tuần tự theo người dùng · cửa sổ 1 ngày')}
      </div>

      {FUNNELS.map((f, i) => {
        const { data, error, isLoading } = results[i]
        const vals = f.steps.map(s => data?.steps?.find(r => r.event === s.event)?.users ?? 0)
        const done = vals[vals.length - 1]
        return (
          <div key={f.key} style={{ ...sectionStyle, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#333' }}>{L(...f.title)}</span>
              {data && (
                <span style={{ fontSize: 11.5, color: '#8B95A1' }}>
                  {L('완주', 'Completed', 'Hoàn tất')} <b style={{ color: '#191F28' }}>{fmt(done)}</b>
                  {vals[0] > 0 && <> · {pct(done, vals[0])}%</>}
                </span>
              )}
            </div>
            {error ? (
              <div style={{ padding: '18px 0', color: '#c00', fontSize: 12.5 }}>{error.message}</div>
            ) : isLoading && !data ? (
              <div style={{ padding: '18px 0', color: '#999', fontSize: 12.5 }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
            ) : (
              <AmpChart vals={vals} steps={f.steps.map(s => L(...s.label))} />
            )}
            <div style={{ fontSize: 11, color: '#8B95A1', lineHeight: 1.7 }}>{L(...f.note)}</div>
          </div>
        )
      })}

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

      <div style={{ fontSize: 11, color: '#8B95A1', lineHeight: 1.8, marginBottom: 24 }}>
        <b style={{ color: '#C2452B' }}>{L('계측 시작일 주의', 'New instrumentation', 'Lưu ý ngày bắt đầu')}</b>
        {L(' — /profile 이벤트(profile_*)는 이번 배포부터 쌓인다. 배포 이전 기간을 조회하면 0으로 보이는 게 정상이니 날짜를 배포일 이후로 맞출 것. resume_upload 는 이전에도 있었지만 client_id 가 없어 순차 퍼널에 붙지 않는다(이번 배포부터 붙음). /cv 이벤트 중 cv_oauth_return 도 이번 배포부터다. 직무 선택(cv_select_role)은 파일 첨부 전에도 가능해 순차 퍼널에서 뺐다 — 메인 퍼널 탭의 행동 퍼널에서 순서 "any" 로 보면 된다.',
           ' — /profile events start with this deploy; earlier ranges legitimately read 0. resume_upload existed before but had no client_id, so it only stitches from this deploy. cv_oauth_return is also new. cv_select_role is excluded from sequential funnels (it can precede file attach) — use order "any" in the behavior funnel.',
           ' — Sự kiện /profile bắt đầu từ lần triển khai này; khoảng thời gian trước đó hiển thị 0 là đúng. cv_select_role bị loại khỏi phễu tuần tự — dùng thứ tự "any" ở phễu hành vi.')}
      </div>
    </>
  )
}
