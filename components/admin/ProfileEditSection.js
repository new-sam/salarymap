import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'

// "마이페이지 수정" — 진입 → 수정 시작 → 저장 완료를 고유 사람 수로 센다.
// 이력서 이탈 탭은 이벤트 건수 기준이라 "몇 명"을 못 본다. 여기는 사람 기준 + 교집합.
// 데이터: /api/admin/profile-edit-funnel
//
// 같이 보는 이유:
//  · AI 파싱이 죽으면 유저가 빈 프로필을 직접 채워야 해서 수정 퍼널이 같이 망가진다.
//    실패 사유를 분류해 우리 쪽 문제(크레딧)인지 파일 쪽(스캔 PDF)인지 바로 갈라 보여준다.
//  · 언어 기재 비율은 "이력서에서 긁는 방식으로 충분한가"의 답 — 낮으면 직접 물어야 한다.

const fmt = (n) => (n === null || n === undefined ? '—' : n.toLocaleString())
const pct = (a, b, digits = 1) => (b > 0 ? ((a / b) * 100).toFixed(digits) : null)

const thStyle = { padding: '7px 10px', textAlign: 'right', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }
const thLeft = { ...thStyle, textAlign: 'left' }
const tdStyle = { padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }
const tdLeft = { ...tdStyle, textAlign: 'left' }

// 실패 사유 — key 는 API 의 classify() 와 1:1. 우리가 고칠 수 있는 것(crit)은 붉게 띄운다.
const REASON_LABEL = {
  credit: { ko: 'OpenAI 크레딧 소진', en: 'OpenAI credits exhausted', vi: 'Hết credit OpenAI', crit: true },
  image_pdf: { ko: '스캔·이미지 PDF (텍스트 없음)', en: 'Scanned / image PDF', vi: 'PDF scan / ảnh' },
  download: { ko: '파일 다운로드 실패', en: 'File download failed', vi: 'Tải file thất bại', crit: true },
  other: { ko: '기타', en: 'Other', vi: 'Khác' },
}

export default function ProfileEditSection({ token, lang, dateRange }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  // 공인점수 카드를 펼친 그룹 키('parsed' | 'all'). 어떤 자격증이 실제로 들어와 있는지 확인용.
  const [openCerts, setOpenCerts] = useState(null)
  // 두 번째 분모('이력서 등록자 전체')는 접어둔다 — 평소엔 '적는 문화'만 보면 되고,
  // 승주 작업실과 숫자를 대조할 때만 펴서 본다.
  const [showAllBase, setShowAllBase] = useState(false)
  const { data, error, isLoading } = useAdmin(
    `/api/admin/profile-edit-funnel?from=${dateRange.from}&to=${dateRange.to}`, token)

  if (isLoading && !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{L('불러오기 실패 ', 'Load failed ', 'Tải thất bại ')}{error.message}</div>
  if (!data) return null

  const { funnel, parse, parseErrors, abandon, language, measuredFrom } = data
  const days = [...data.days].reverse() // 최신순
  const beforeMeasured = dateRange.from < measuredFrom

  const STAGES = [
    { key: 'view', val: funnel.view, ko: '마이페이지 진입', en: 'Profile view', vi: 'Vào hồ sơ',
      sub: { ko: '/profile 를 연 사람', en: 'opened /profile', vi: 'mở /profile' } },
    { key: 'edit', val: funnel.editStart, prev: funnel.view, ko: '수정 시작', en: 'Edit started', vi: 'Bắt đầu sửa',
      sub: { ko: '폼에 실제로 손을 댄 사람', en: 'actually touched the form', vi: 'thực sự sửa form' }, highlight: true },
    { key: 'save', val: funnel.save, prev: funnel.editStart, ko: '저장 완료', en: 'Saved', vi: 'Đã lưu',
      sub: { ko: '저장 버튼까지 누른 사람', en: 'pressed save', vi: 'đã bấm lưu' } },
  ]

  return (
    <>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
        {dateRange.from} ~ {dateRange.to} · {L('고유 사람 수 기준 · VN(UTC+7) 일별', 'Unique people · VN (UTC+7) days', 'Số người · ngày VN (UTC+7)')}
      </div>

      {/* 계측 시작 이전 구간을 조회하면 0이 나온다 — "데이터 없음"으로 오해하지 않게 명시 */}
      {beforeMeasured && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#92400E' }}>
          {L(`profile_* 계측은 ${measuredFrom} 부터입니다. 그 이전 구간은 데이터가 없어서가 아니라 안 찍혀서 0입니다.`,
             `profile_* tracking starts ${measuredFrom}. Earlier dates are 0 because nothing was logged, not because nothing happened.`,
             `Đo lường profile_* bắt đầu từ ${measuredFrom}. Trước đó là 0 vì chưa ghi log.`)}
        </div>
      )}

      {/* ── 3단 카드 ── */}
      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        {STAGES.map((s, i) => {
          const conv = i > 0 ? pct(s.val, s.prev) : null
          return (
            <div key={s.key} style={{
              background: s.highlight ? '#FFF6F2' : '#fff',
              border: `1px solid ${s.highlight ? '#FFD9CC' : '#e5e7eb'}`,
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
              <div style={{ fontSize: 28, fontWeight: 700, color: '#191F28', marginTop: 8, lineHeight: 1.1 }}>{fmt(s.val)}</div>
              <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 4 }}>{L(s.sub.ko, s.sub.en, s.sub.vi)}</div>
            </div>
          )
        })}
      </div>

      {/* ── 쓰다 만 사람 — 이 탭의 주인공 ── */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', marginBottom: 20,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
          {L('수정 시작했지만 저장 안 함', 'Started editing but never saved', 'Sửa nhưng chưa lưu')}
        </span>
        <span style={{ fontSize: 22, fontWeight: 700, color: funnel.unsaved > 0 ? '#DC2626' : '#191F28' }}>{fmt(funnel.unsaved)}</span>
        <span style={{ fontSize: 11.5, color: '#8B95A1' }}>
          {L(`수정 시작 ${fmt(funnel.editStart)}명 중`, `of ${fmt(funnel.editStart)} who started`, `trong ${fmt(funnel.editStart)} người đã sửa`)}
          {abandon.total > 0 && ` · ${L('이탈 감지', 'abandon events', 'sự kiện rời')} ${fmt(abandon.total)}`}
        </span>
      </div>

      {/* ── AI 파싱 + 실패 사유 ── */}
      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'start', marginBottom: 20 }}>
        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 4 }}>
            {L('AI 파싱', 'AI parsing', 'Phân tích AI')}
          </div>
          <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12 }}>
            {L('파싱이 죽으면 유저가 빈 프로필을 직접 채워야 한다', 'When parsing fails the user must fill everything by hand', 'Khi phân tích lỗi, người dùng phải tự nhập')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { ko: '시도', en: 'Attempts', vi: 'Lượt thử', v: parse.start, c: '#191F28' },
              { ko: '성공', en: 'Success', vi: 'Thành công', v: parse.done, c: '#15803D' },
              { ko: '실패', en: 'Failed', vi: 'Thất bại', v: parse.error, c: parse.error > 0 ? '#DC2626' : '#191F28' },
            ].map((m) => (
              <div key={m.en}>
                <div style={{ fontSize: 11.5, color: '#8B95A1' }}>{L(m.ko, m.en, m.vi)}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.c, lineHeight: 1.2 }}>{fmt(m.v)}</div>
              </div>
            ))}
          </div>
          {parse.start > 0 && (
            <div style={{ fontSize: 11.5, color: '#8B95A1', marginTop: 10 }}>
              {L('실패율', 'Failure rate', 'Tỷ lệ lỗi')} <b style={{ color: parse.error > 0 ? '#DC2626' : '#475569' }}>{pct(parse.error, parse.start, 0)}%</b>
            </div>
          )}
        </div>

        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 4 }}>
            {L('파싱 실패 사유', 'Parse failure reasons', 'Lý do lỗi')}
          </div>
          <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 10 }}>
            {L('붉은 항목은 우리가 고칠 수 있는 것', 'Red items are ours to fix', 'Mục đỏ là do phía mình')}
          </div>
          <div className="adm-m-scroll">
            <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={thLeft}>{L('사유', 'Reason', 'Lý do')}</th>
                  <th style={thStyle}>{L('건수', 'Count', 'Số')}</th>
                  <th style={thStyle}>{L('최근', 'Last', 'Gần nhất')}</th>
                </tr>
              </thead>
              <tbody>
                {parseErrors.length === 0 && (
                  <tr><td colSpan={3} style={{ ...tdLeft, color: '#999', padding: 16 }}>{L('실패 없음', 'No failures', 'Không lỗi')}</td></tr>
                )}
                {parseErrors.map((r) => {
                  const meta = REASON_LABEL[r.reason] || REASON_LABEL.other
                  return (
                    <tr key={r.reason} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...tdLeft, color: meta.crit ? '#DC2626' : '#333', fontWeight: meta.crit ? 700 : 400 }}>
                        {L(meta.ko, meta.en, meta.vi)}
                      </td>
                      <td style={tdStyle}>{fmt(r.count)}</td>
                      <td style={{ ...tdStyle, color: '#8B95A1' }}>
                        {r.lastAt ? new Date(new Date(r.lastAt).getTime() + 7 * 36e5).toISOString().slice(5, 16).replace('T', ' ') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 이력서 언어 기재 비율 (기간 무관 스냅샷) ──
          분모 두 개를 나란히 둔다. 승주 작업실은 '이력서 등록자 전체' 기준이라 숫자가 낮게 나오는데,
          그건 우리가 못 읽은 것까지 분모에 있기 때문이다. '적는 문화'의 답은 파싱 성공분 쪽. */}
      <div style={{ ...sectionStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 4 }}>
          {L('이력서에 언어를 적는 비율', 'Resumes that state language ability', 'Tỷ lệ CV ghi ngoại ngữ')}
        </div>
        <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 14 }}>
          {L('기간 무관 현재 스냅샷. 한국 이력서와 달리 언어 기재가 관행인지 보는 지표 — 낮으면 이력서에서 긁는 방식으로는 못 채우고 직접 물어야 한다.',
             'Snapshot, not date-filtered. Tells whether stating languages is the norm here — if low, parsing can never fill this and we must ask.',
             'Ảnh chụp hiện tại. Cho biết ghi ngoại ngữ có phải thông lệ không.')}
        </div>

        {[
          { key: 'parsed', base: language.parsedOnly, main: true,
            ko: '파싱 성공한 이력서만', en: 'Successfully parsed resumes only', vi: 'Chỉ CV phân tích thành công',
            why: { ko: '적는 문화가 있는지의 답 — 못 읽은 이력서를 빼야 "안 적음"만 남는다',
                   en: 'the culture question — excludes resumes we simply could not read',
                   vi: 'câu trả lời về thông lệ' } },
          { key: 'all', base: language.allResumes,
            ko: '이력서 등록자 전체', en: 'All registered resumes', vi: 'Toàn bộ CV đã đăng ký',
            why: { ko: '승주 작업실 어학 현황과 같은 모수 — 우리가 어학을 아는 비율',
                   en: 'same base as Seungju\'s Lab — how much we actually know',
                   vi: 'cùng mẫu với Lab của Seungju' } },
        ].filter((grp) => grp.main || showAllBase).map((grp) => (
          <div key={grp.en} style={{ marginBottom: grp.main && showAllBase ? 18 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: grp.main ? '#191F28' : '#8B95A1' }}>
                {L(grp.ko, grp.en, grp.vi)}
              </span>
              <span style={{ fontSize: 11.5, color: '#8B95A1' }}>n = {fmt(grp.base.total)}</span>
              <span style={{ fontSize: 11, color: '#A8A29E' }}>· {L(grp.why.ko, grp.why.en, grp.why.vi)}</span>
            </div>
            <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { ko: '영어 기재', en: 'States English', vi: 'Ghi tiếng Anh', v: grp.base.en },
                { ko: '한국어 기재', en: 'States Korean', vi: 'Ghi tiếng Hàn', v: grp.base.ko },
                { ko: '영어 중 공인점수', en: 'Of those, scored', vi: 'Có chứng chỉ', v: grp.base.enScored, denom: grp.base.en, expand: true,
                  note: { ko: '나머지는 "Fluent" 등 자기서술 — 기업이 필터 불가',
                          en: 'rest are self-described — companies cannot filter',
                          vi: 'còn lại tự mô tả — không lọc được' } },
                { ko: '언어 미기재', en: 'No language at all', vi: 'Không ghi gì', v: grp.base.neither, warn: true },
              ].map((m) => {
                const denom = m.denom ?? grp.base.total
                // 공인점수 카드만 눌러서 펼친다 — "어떤 자격증이 실제로 들어와 있나"를 보려고.
                const expandable = m.expand && grp.base.scoredBreakdown?.length > 0
                const open = expandable && openCerts === grp.key
                return (
                  <div key={m.en}
                    onClick={expandable ? () => setOpenCerts(open ? null : grp.key) : undefined}
                    role={expandable ? 'button' : undefined}
                    tabIndex={expandable ? 0 : undefined}
                    onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCerts(open ? null : grp.key) } } : undefined}
                    style={{
                      background: m.warn && grp.main ? '#FFF6F2' : '#fff',
                      border: `1px solid ${open ? '#ff6000' : (m.warn && grp.main ? '#FFD9CC' : '#e5e7eb')}`,
                      borderRadius: 12, padding: '12px 14px', opacity: grp.main ? 1 : 0.75,
                      cursor: expandable ? 'pointer' : undefined,
                      transition: 'border-color .15s',
                    }}>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {L(m.ko, m.en, m.vi)}
                      {expandable && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={open ? '#ff6000' : '#B0B8C1'}
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </div>
                    <div style={{ fontSize: grp.main ? 24 : 19, fontWeight: 700, color: '#191F28', marginTop: 6, lineHeight: 1.1 }}>
                      {pct(m.v, denom, 1) ?? '—'}<span style={{ fontSize: 13, color: '#8B95A1' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 3 }}>{fmt(m.v)} / {fmt(denom)}</div>
                    {m.note && grp.main && <div style={{ fontSize: 10.5, color: '#A8A29E', marginTop: 5, lineHeight: 1.35 }}>{L(m.note.ko, m.note.en, m.note.vi)}</div>}
                    {expandable && !open && (
                      <div style={{ fontSize: 10.5, color: '#ff6000', marginTop: 5, fontWeight: 600 }}>
                        {L('눌러서 자격증 보기', 'Tap to see certificates', 'Xem chứng chỉ')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 펼침 — 시험 종류별로 묶고, 안에 실제 입력값을 그대로 보여준다.
                원본 값을 숨기지 않는 이유: 드롭다운 항목을 정하려면 사람들이 실제로 뭐라고
                쓰는지를 봐야 한다(오타·베트남어 표기 포함). */}
            {openCerts === grp.key && grp.base.scoredBreakdown?.length > 0 && (
              <div style={{ marginTop: 10, border: '1px solid #FFD9CC', borderRadius: 12, padding: '12px 14px', background: '#FFFBF9' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#333', marginBottom: 10 }}>
                  {L('공인점수 내역', 'Certificates on file', 'Chứng chỉ đã ghi')}
                  <span style={{ fontWeight: 400, color: '#8B95A1', marginLeft: 6 }}>
                    {L(`${grp.base.scoredBreakdown.length}종 · ${fmt(grp.base.enScored)}건`,
                       `${grp.base.scoredBreakdown.length} types · ${fmt(grp.base.enScored)}`,
                       `${grp.base.scoredBreakdown.length} loại · ${fmt(grp.base.enScored)}`)}
                  </span>
                </div>
                <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {grp.base.scoredBreakdown.map((g) => (
                    <div key={g.type} style={{ background: '#fff', border: '1px solid #f0e4de', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#191F28' }}>{g.type}</span>
                        <span style={{ fontSize: 11.5, color: '#8B95A1' }}>
                          {fmt(g.count)}{L('건', '', '')} · {pct(g.count, grp.base.enScored, 0)}%
                        </span>
                      </div>
                      {g.values.map((v) => (
                        <div key={v.value} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: '#4E5968', padding: '2px 0' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.value}</span>
                          <span style={{ color: '#8B95A1', flexShrink: 0 }}>{v.n}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 두 번째 분모 토글 — 접힌 상태에서도 승주 작업실과 대조할 값이 있다는 건 알 수 있게
            버튼 라벨에 n 을 같이 적는다. */}
        <button type="button" onClick={() => setShowAllBase(!showAllBase)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: showAllBase ? 4 : 12,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600, color: '#8B95A1', fontFamily: 'inherit',
          }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showAllBase ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {showAllBase
            ? L('이력서 등록자 전체 기준 접기', 'Hide all-resumes base', 'Ẩn mẫu toàn bộ CV')
            : L(`이력서 등록자 전체 기준도 보기 (n = ${fmt(language.allResumes.total)}, 승주 작업실과 같은 모수)`,
                `Show all-resumes base (n = ${fmt(language.allResumes.total)})`,
                `Xem mẫu toàn bộ CV (n = ${fmt(language.allResumes.total)})`)}
        </button>
      </div>

      {/* ── 일별 표 ── */}
      <div style={{ ...sectionStyle, marginBottom: 24, paddingBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 10 }}>
          {L('일별 (최신순)', 'Daily (latest first)', 'Theo ngày (mới nhất)')}
        </div>
        <div className="adm-m-scroll" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff' }}>
                <th style={thLeft}>{L('날짜', 'Date', 'Ngày')}</th>
                <th style={thStyle}>{L('진입', 'Views', 'Lượt vào')}</th>
                <th style={thStyle}>{L('수정 시작', 'Edit start', 'Bắt đầu sửa')}</th>
                <th style={thStyle}>{L('저장', 'Saved', 'Đã lưu')}</th>
                <th style={thStyle}>{L('파싱 시도', 'Parse', 'Thử AI')}</th>
                <th style={thStyle}>{L('파싱 실패', 'Parse fail', 'AI lỗi')}</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdLeft, color: '#999', padding: 16 }}>—</td></tr>
              )}
              {days.map((d) => (
                <tr key={d.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...tdLeft, fontWeight: 600 }}>{d.date}</td>
                  <td style={tdStyle}>{d.view || '·'}</td>
                  <td style={tdStyle}>{d.editStart || '·'}</td>
                  <td style={tdStyle}>{d.save || '·'}</td>
                  <td style={tdStyle}>{d.parseStart || '·'}</td>
                  <td style={{ ...tdStyle, color: d.parseError > 0 ? '#DC2626' : undefined, fontWeight: d.parseError > 0 ? 700 : 400 }}>
                    {d.parseError || '·'}
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