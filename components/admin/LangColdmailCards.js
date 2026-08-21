import { Fragment, useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'
import { ICT_TZ } from '../../lib/timezone'

// "마이페이지 수정" 탭 맨 위 — 어학 정보 수집 콜드메일의 제목 A/B 성과.
// 이 탭의 퍼널(진입→수정→저장)을 만드는 유입이라 같은 화면 위쪽에 둔다.
//
// arm 은 캠페인명 자체다.
//   coldmail-language-1 = A · 주제(어학)를 감춘 제목 "하나만 더 채우면 … 26개"
//   coldmail-language-2 = B · 그대로 묻는 제목 "영어 또는 한국어 가능하신가요?"
// 본문·버튼은 두 arm 이 동일하다 — 제목 외에 뭘 같이 바꾸면 원인을 못 가른다.
//
// 데이터: /api/admin/lang-coldmail

const ARM_META = {
  'coldmail-language-1': { tag: 'A', ko: '주제 감춤', en: 'Topic hidden', vi: 'Ẩn chủ đề', color: '#ff6000' },
  'coldmail-language-2': { tag: 'B', ko: '그대로 물음', en: 'Asks directly', vi: 'Hỏi trực tiếp', color: '#4F46E5' },
  // KTC 유입자 캠페인은 제목 A/B 가 없다 — 123명으로는 61명/arm 이라 어떤 차이도
  // 판정되지 않는다. 그래서 arm 이 아니라 캠페인 자체를 한 칸으로 그린다.
  'coldmail-ktc-lang-1': { tag: 'K', ko: 'KTC 유입', en: 'From KTC', vi: 'Từ KTC', color: '#0F766E' },
  // 3차 — 지원 경험이 없는 층. 이력서 유무로 갈랐고 둘 다 제목 A/B 가 없다.
  'coldmail-lang-resume-1': { tag: 'R', ko: '이력서 있음', en: 'Has resume', vi: 'Có CV', color: '#B45309' },
  'coldmail-lang-ghost-1': { tag: 'G', ko: '이력서 없음', en: 'No resume', vi: 'Chưa có CV', color: '#7C3AED' },
  /* 4차 — 이력서는 있는데 어학만 빈 층. 지원 조건을 풀었더니 847명이 되는데, 그 안에서
     메일이 댈 수 있는 근거가 셋으로 갈려 arm 을 셋으로 나눴다. 제목 A/B 와 달리 이건
     모집단이 다른 arm 이라 서로의 전환율을 직접 비교하면 안 된다 — 각 칸을 따로 읽는다. */
  'coldmail-lang-nocert-applied-1': { tag: 'N1', ko: '지원 경험 O', en: 'Has applied', vi: 'Đã ứng tuyển', color: '#0284C7' },
  'coldmail-lang-nocert-fresh-1': { tag: 'N2', ko: '지원 0', en: 'Never applied', vi: 'Chưa ứng tuyển', color: '#0891B2' },
  'coldmail-lang-nocert-again-1': { tag: 'N3', ko: '재발송 · 기수신', en: 'Re-send', vi: 'Gửi lại', color: '#64748B' },
  /* 5차 — 어학은 적었지만 점수가 아닌 층의 재확인. 앞 회차와 세는 것이 다르다:
     '입력'이 아니라 '확인'이라, 답이 들어와도 값은 그대로일 수 있다. */
  'coldmail-lang-recheck-1': { tag: 'R5', ko: '자기서술 재확인', en: 'Recheck', vi: 'Xác nhận lại', color: '#7C3AED' },
  // 6차 — 같은 모집단에 본문을 바꿔 다시 보낸다(제목도 이전 캠페인 것으로 회귀).
  // R5 와 나란히 두면 카피 변경의 효과가 그대로 세로로 읽힌다.
  'coldmail-lang-recheck-2': { tag: 'R6', ko: '자기서술 재확인 · 개정', en: 'Recheck v2', vi: 'Xác nhận lại v2', color: '#6D28D9' },
  /* 7차 — 앞 회차와 묻는 것이 다르다. R5·R6 는 "그 뒤로 점수가 생겼나"였고, 여기는
     "그 등급이 어느 시험 것인가"다. 모집단도 자기서술 전체가 아니라 맨 등급값("B2") 112명만
     골랐다. 그래서 R5·R6 와 세로로 세워 카피 효과로 비교하면 안 된다 — 전환의 정의가 다르다.
     tag 는 발송 이벤트 meta.round 와 같은 R7 이다. */
  'coldmail-lang-exam-1': { tag: 'R7', ko: '시험명 확인', en: 'Which test?', vi: 'Kỳ thi nào?', color: '#C2410C' },
}


const pct = (v) => `${(v * 100).toFixed(1)}%`


/* 발송일 — 회차를 며칠에 걸쳐 나눠 보내므로, 제목에 날짜가 없으면 지금 보고 있는 숫자가
   어느 회차 것인지 알 수 없다. 발송 스크립트가 베트남 시간으로 도니 표시도 ICT 기준.
   조각을 직접 꺼내 붙인다 — 연도를 뺀 포맷은 로케일마다 자리 순서가 달라(sv-SE 는 일-월)
   문자열을 그대로 쓰면 04/08 처럼 뒤집힌다. */
const MMDD = new Intl.DateTimeFormat('en-US', { timeZone: ICT_TZ, month: '2-digit', day: '2-digit' })
const mmdd = (iso) => {
  const parts = MMDD.formatToParts(new Date(iso))
  const get = (t) => parts.find((p) => p.type === t)?.value || ''
  return `${get('month')}/${get('day')}`
}

// 메일 버튼 문구. cta 코드만 띄우면 어느 버튼인지 매번 템플릿을 열어봐야 한다.
const CTA_LABEL = (L) => ({
  score: L('어학 점수가 있어요', 'Has a score', 'Có điểm'),
  daily: L('일상 회화는 됩니다', 'Daily conversation', 'Giao tiếp hằng ngày'),
  basic: L('인사말 정도만 압니다', 'Basic greetings', 'Chào hỏi cơ bản'),
  none: L('둘 다 못합니다', 'Neither', 'Không biết cả hai'),
  // 7차 버튼. vstep·aptis 는 누르는 즉시 등급 앞에 시험명이 붙는다(원탭 확정).
  vstep: L('VSTEP', 'VSTEP', 'VSTEP'),
  aptis: L('APTIS', 'APTIS', 'APTIS'),
  exam: L('다른 시험 점수가 있어요', 'Another test', 'Kỳ thi khác'),
  self: L('시험 아님 · 자기 평가', 'Self-assessed, no test', 'Tự đánh giá'),
})

/* 표 스타일 — 승주 작업실의 지표 표(GoalMetricsView)와 같은 규격을 쓴다.
   두 작업실의 표가 다르게 생기면 같은 화면을 오가며 읽을 때 매번 눈이 다시 적응해야 한다. */
const TH = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '6px 10px', borderBottom: '1px solid #EEF0F2', textTransform: 'uppercase', letterSpacing: '.04em' }
const TD = { fontSize: 13, color: '#1F2937', padding: '7px 10px', borderBottom: '1px solid #F5F6F7' }
const NUM = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

/* 캠페인 한 줄 = 표 한 행. 카드로 나눠 두던 것을 표로 편다 — 회차가 10개를 넘어가면서
   카드가 화면을 가로질러 흩어져, "몇 번째 회차가 제일 잘 됐나"를 한눈에 못 보게 됐다.

   계열은 카드 대신 구분 행으로 남긴다. 모집단이 달라 세로로 전환율을 비교하면 안 되는
   건 표가 돼도 그대로라, 계열 경계가 보이지 않으면 그 함정이 더 커진다. */
function CampaignTable({ groups, L }) {
  const rows = groups.flatMap((g) => g.rows
    .filter((r) => ARM_META[r.campaign])
    .map((r) => ({ ...r, family: g.family })))
  if (!rows.length) return null

  const pctOr = (v, n) => (n ? pct(v) : '—')
  let lastFamily = null

  return (
    <div className="adm-m-scroll" style={{ overflowX: 'auto', border: '1px solid #EEF0F2', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead><tr>
          <th style={{ ...TH, width: 44 }}>{L('회차', 'Round', 'Đợt')}</th>
          <th style={TH}>{L('캠페인', 'Campaign', 'Chiến dịch')}</th>
          <th style={TH}>{L('발송일', 'Sent on', 'Ngày gửi')}</th>
          <th style={{ ...TH, textAlign: 'right' }}>{L('발송', 'Sent', 'Gửi')}</th>
          <th style={{ ...TH, textAlign: 'right' }}>{L('도달', 'Reached', 'Mở')}</th>
          <th style={{ ...TH, textAlign: 'right' }}>{L('저장', 'Saved', 'Đã lưu')}</th>
          <th style={{ ...TH, textAlign: 'right' }}>{L('저장률', 'Rate', 'Tỷ lệ')}</th>
          {/* 저장된 값의 생김새. 전환율이 높아도 전부 자기서술이면 이 캠페인은 실패다. */}
          <th style={{ ...TH, textAlign: 'right' }}>{L('점수', 'Score', 'Điểm')}</th>
          <th style={{ ...TH, textAlign: 'right' }}>{L('자기서술', 'Self-desc', 'Tự mô tả')}</th>
          <th style={{ ...TH, textAlign: 'right' }}>{L('못함', 'Neither', 'Không')}</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => {
            const m = ARM_META[r.campaign]
            const head = r.family !== lastFamily ? (lastFamily = r.family, true) : false
            const d0 = r.firstSentAt ? mmdd(r.firstSentAt) : ''
            const d1 = r.lastSentAt ? mmdd(r.lastSentAt) : ''
            return (
              <Fragment key={r.campaign}>
                {head && (
                  <tr>
                    <td colSpan={10} style={{
                      fontSize: 11, fontWeight: 700, color: '#6B7280', background: '#FAFBFC',
                      padding: '5px 10px', borderBottom: '1px solid #EEF0F2',
                    }}>{FAMILY_LABEL(r.family, L)}</td>
                  </tr>
                )}
                <tr>
                  <td style={TD}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, color: '#fff', background: m.color,
                      borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap',
                    }}>{m.tag}</span>
                  </td>
                  <td style={{ ...TD, fontWeight: 600 }}>{L(m.ko, m.en, m.vi)}</td>
                  <td style={{ ...TD, color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {d0 && d1 && d0 !== d1 ? `${d0}–${d1}` : d0 || '—'}
                  </td>
                  <td style={NUM}>{r.sent.toLocaleString()}</td>
                  <td style={NUM}>
                    {r.clicked || '—'}
                    {!!r.sent && !!r.clicked && <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: 4 }}>{pct(r.clickRate)}</span>}
                  </td>
                  <td style={{ ...NUM, color: r.filled ? '#0D9488' : '#C0C4CC' }}>{r.filled || '—'}</td>
                  <td style={{ ...NUM, fontWeight: 800 }}>{pctOr(r.fillRate, r.sent)}</td>
                  <td style={{ ...NUM, color: r.kinds?.score ? KIND_COLOR.score : '#C0C4CC' }}>{r.kinds?.score || '—'}</td>
                  <td style={{ ...NUM, color: r.kinds?.level ? KIND_COLOR.level : '#C0C4CC' }}>{r.kinds?.level || '—'}</td>
                  <td style={{ ...NUM, color: '#9CA3AF' }}>{r.kinds?.none || '—'}</td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* 묶음마다 카드를 하나씩 그린다. 합치지 않는 이유 — 모집단이 다르다:
     language wave 1 = 콜드메일을 한 번도 안 받은 회원 200명
     language wave 2 = 이미 다른 콜드메일을 받은 적 있는 회원 260명
     ktc             = K-Tech College 로 들어온 회원 123명 (제목 A/B 없음)
   한 카드에 합치면 전환율이 무엇의 전환율인지 알 수 없게 된다. 합칠 땐 API 의
   keyOf 에서 wave 만 빼면 화면은 그대로 하나로 돌아온다. */
const GROUP_TITLE = (g, L) => {
  if (g.family === 'ktc') return L('어학 콜드메일 · KTC 유입', 'Language cold-email · from KTC', 'Cold-email ngoại ngữ · từ KTC')
  if (g.family === 'resume') return L('어학 콜드메일 · 이력서 O / 지원 0', 'Language cold-email · resume, never applied', 'Cold-email ngoại ngữ · có CV')
  if (g.family === 'ghost') return L('어학 콜드메일 · 이력서 X / 지원 0', 'Language cold-email · no resume', 'Cold-email ngoại ngữ · chưa có CV')
  if (g.family === 'nocert') return L('어학 콜드메일 · 이력서 O / 어학만 빔', 'Language cold-email · resume, language blank', 'Cold-email ngoại ngữ · có CV, thiếu ngoại ngữ')
  if (g.family === 'recheck') return L('어학 콜드메일 · 자기서술 재확인', 'Language cold-email · recheck', 'Cold-email ngoại ngữ · xác nhận lại')
  return L('어학 콜드메일 (제목 A/B)', 'Language cold-email (subject A/B)', 'Cold-email ngoại ngữ (A/B tiêu đề)')
}

const GROUP_NOTE = (g, L) => {
  if (g.family === 'ktc') return L('K-Tech College 로 들어와 계정을 만든 회원 · 단일 버전', 'Signed up via K-Tech College · single version', 'Đăng ký qua K-Tech College')
  // 3차 두 계열의 질문: 이력서가 없어도 어학만으로 추천 대상이 되는가.
  if (g.family === 'resume') return L('이력서는 있으나 FYI 에서 지원한 적 없는 회원', 'Has a resume but never applied on FYI', 'Có CV nhưng chưa ứng tuyển')
  if (g.family === 'ghost') return L('가입만 하고 이력서도 지원도 없는 회원 · 이력서 등록 버튼 포함', 'Signed up only — no resume, no application', 'Chỉ đăng ký, chưa có CV')
  // 5차. 세는 것이 '입력'이 아니라 '확인'이라 아래 카드의 숫자도 다르게 읽어야 한다.
  if (g.family === 'recheck') return L('어학은 적었지만 자격증·점수가 아닌 층 · 값이 아직 유효한지 확인', 'Wrote a level but no certificate — is it still true?', 'Đã ghi trình độ nhưng chưa có chứng chỉ')
  // 4차. 앞 회차들과 달리 arm 끼리 모집단이 다르다 — 칸을 가로질러 전환율을 비교하지 말 것.
  if (g.family === 'nocert') return L('이력서 O · 어학 3칸 모두 빔 · 지원 여부 무관 · 근거별 3종', 'Has resume, all language fields blank · 3 angles', 'Có CV, bỏ trống ngoại ngữ · 3 phiên bản')
  // wave 1(콜드메일 미수신 200) + wave 2(기수신 260)를 합쳐 230/230 으로 본다.
  // 두 코호트의 입력률이 21.0% vs 24.6% 로 크게 벌어지지 않아, 제목 A/B 판정에는
  // 한 덩어리로 보는 편이 검정력이 높다.
  return L('이력서 O · FYI 지원 1회 이상 · 230/230', 'Has resume, applied before · 230/230', 'Có CV, đã ứng tuyển · 230/230')
}

export default function LangColdmailCards({ token, lang }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  // 값 상세('버튼 → 저장된 값')는 접어 둔다 — 평소 묻는 건 회차별 성과 한 줄이고,
  // 저장된 값 원본까지 늘 펴 두면 표가 화면 밖으로 밀린다.
  const [detail, setDetail] = useState(false)
  // dateRange 를 안 붙인다 — A/B 는 캠페인 전 기간을 한 번에 봐야 하고, 날짜로 자르면
  // arm 별 발송일이 하루라도 어긋났을 때 분모가 달라져 비교가 깨진다.
  const { data, error, isLoading } = useAdmin('/api/admin/lang-coldmail', token)

  if (isLoading && !data) return null
  if (error) return null

  const groups = (data?.groups || []).filter((g) => g.rows.some((r) => ARM_META[r.campaign]))
  if (!groups.length) {
    return (
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          {GROUP_TITLE({ family: 'language', wave: 1 }, L)}
        </div>
        <div style={{ fontSize: 12, color: '#8B95A1' }}>
          {L('아직 발송 이벤트가 없습니다 — coldmail_lang_sent 가 쌓이면 여기에 뜹니다.',
             'No send events yet — appears once coldmail_lang_sent lands.',
             'Chưa có sự kiện gửi.')}
        </div>
      </div>
    )
  }

  // 발송이 걸쳐 있는 날짜. 하루에 다 나갔으면 한 날짜만 뜬다.
  const dateOf = (gs) => {
    const ats = gs.flatMap((g) => g.rows.flatMap((r) => [r.firstSentAt, r.lastSentAt])).filter(Boolean).sort()
    if (!ats.length) return ''
    const a = mmdd(ats[0]), b = mmdd(ats[ats.length - 1])
    return a === b ? a : `${a}–${b}`
  }

  /* 회차가 10개를 넘어가면서 카드로는 안 읽힌다 — 화면을 가로질러 흩어져 "몇 번째가
     제일 잘 됐나"를 한눈에 못 본다. 승주 작업실 지표 표와 같은 규격의 표 하나로 편다.
     계열별 합계 카드는 표의 계열 구분 행이 대신하고, 총계만 머리에 한 줄로 남긴다. */
  const grand = groups.reduce((s, g) => ({
    sent: s.sent + (g.totals?.sent || 0),
    clicked: s.clicked + (g.totals?.clicked || 0),
    filled: s.filled + (g.totals?.filled || 0),
  }), { sent: 0, clicked: 0, filled: 0 })
  const campaignCount = groups.reduce((n, g) => n + g.rows.filter((r) => ARM_META[r.campaign]).length, 0)

  return (
    <div style={{ ...sectionStyle, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
          {L('어학 콜드메일 회차별 성과', 'Language cold-email by round', 'Cold-email ngoại ngữ theo đợt')}
        </span>
        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{dateOf(groups)}</span>
      </div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 8 }}>
        {L(`캠페인 ${campaignCount}개 · 총 발송 ${grand.sent.toLocaleString()}건 · 도달 ${grand.clicked} · 저장 ${grand.filled}`,
           `${campaignCount} campaigns · ${grand.sent.toLocaleString()} sent · ${grand.clicked} reached · ${grand.filled} saved`,
           `${campaignCount} chiến dịch · ${grand.sent.toLocaleString()} gửi`)}
        {' — '}
        {/* 계열마다 모집단이 달라 세로로 전환율을 비교하면 안 된다. 표가 되면서 줄이
            한 화면에 서니 이 경고가 카드일 때보다 더 필요해졌다. */}
        {L('계열이 다르면 모수가 달라 저장률을 세로로 비교하면 안 된다',
           'Different families have different pools — do not compare rates across them',
           'Khác nhóm thì khác mẫu — đừng so sánh tỷ lệ')}
      </div>

      <CampaignTable groups={groups} L={L} />

      <button
        onClick={() => setDetail((v) => !v)}
        style={{
          marginTop: 10, padding: '5px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          color: '#4E5968', background: '#fff', border: '1px solid #E5E8EB', borderRadius: 7,
        }}
      >
        {detail
          ? L('자세히 닫기', 'Hide detail', 'Ẩn chi tiết')
          : L('버튼 → 저장된 값 자세히 보기', 'Button → saved value detail', 'Chi tiết')}
      </button>

      {detail && groups.map((g) => <GroupCard key={g.key} data={g} L={L} />)}
    </div>
  )
}
function GroupCard({ data, L }) {
  // 값 종류 필터. null = 전체. 아래 early return 들보다 먼저 선언해야 훅 순서가 안 깨진다.
  const [kindFilter, setKindFilter] = useState(null)
  // 목록은 기본으로 접어둔다 — 이름·값이 한 줄씩 쌓여 카드보다 커지고, arm/종류 요약은
  // 위 카드에 이미 있어 접혀 있어도 읽을 게 없어지지 않는다.
  const [showFills, setShowFills] = useState(false)

  const rows = data.rows.filter((r) => ARM_META[r.campaign])

  return (
    <div style={{ ...sectionStyle, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
        {GROUP_TITLE(data, L)}
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
          {GROUP_NOTE(data, L)}
        </span>
      </div>
      {/* 부제는 A/B 합계 실적. 제목 옆에서 "그래서 이 캠페인이 얼마나 먹혔나"가 한 줄로
          읽혀야 한다 — 두 arm 을 각각 보기 전에 알아야 할 수가 그것이다. */}
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12 }}>
        {L('발송', 'Sent', 'Đã gửi')} {data?.totals?.sent ?? 0}
        {' · '}
        {L('클릭', 'Click', 'Click')} {data?.totals?.clicked ?? 0}
        {data?.totals?.sent ? ` (${pct(data.totals.clicked / data.totals.sent)})` : ''}
        {' · '}
        <span style={{ color: '#4E5968', fontWeight: 600 }}>
          {L('어학 입력', 'Filled', 'Đã điền')} {data?.totals?.filled ?? 0}
          {data?.totals?.sent ? ` (${pct(data.totals.filled / data.totals.sent)})` : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {rows.map((r) => {
          const m = ARM_META[r.campaign]
          /* 세로 flex — 아래 '점수·자기서술·못함' 줄을 marginTop:auto 로 바닥에 붙인다.
             제목이 한 줄인 카드와 두 줄인 카드가 나란히 서면 그 줄의 높이가 어긋나는데,
             그리드가 카드 높이를 이미 맞춰 주므로 바닥 기준으로 맞추면 가지런해진다. */
          return (
            <div key={r.campaign} style={{
              border: '1px solid #E5E8EB', borderRadius: 10, padding: 14,
              display: 'flex', flexDirection: 'column',
            }}>
              {/* 제목 줄 오른쪽이 비어 있어서 수치를 그리로 올렸다 — 아래로 한 줄 더
                  쌓으면 카드가 그만큼 길어지는데, 그 줄에 넣을 자리가 이미 있다.

                  wrap 을 쓰면 안 된다: 제목 길이에 따라 수치 블록이 다음 줄로 밀려서
                  카드마다 수치의 세로 위치가 달라진다(R6 '자기서술 재확인 · 개정'은 밀리고
                  R7 '시험명 확인'은 같은 줄에 남았다). nowrap 으로 고정하고 제목 쪽을
                  줄여, 어느 카드든 수치가 오른쪽 위 같은 자리에 오게 한다.
                  제목이 길면 잘리지 않고 두 줄로 접힌다 — minWidth:0 이 있어야 접힌다. */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 10, flexWrap: 'nowrap', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 auto', minWidth: 0 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: '#fff', background: m.color,
                    borderRadius: 5, padding: '2px 7px', flex: 'none',
                  }}>{m.tag}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0 }}>{L(m.ko, m.en, m.vi)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flex: 'none' }}>
                  <Stat label={L('발송', 'Sent', 'Đã gửi')} value={r.sent} />
                  <Stat label={L('클릭', 'Click', 'Click')} value={r.clicked} sub={r.sent ? pct(r.clickRate) : null} />
                  <Stat label={L('입력', 'Filled', 'Đã điền')} value={r.filled} sub={r.sent ? pct(r.fillRate) : null} accent={m.color} />
                </div>
              </div>

              {/* 들어온 값의 종류 — "주제를 밝힌 제목(B)이 실제로 어학 되는 사람만
                  데려온다"는 가설은 전환 수가 아니라 이 줄로만 확인된다. B 는 입력이
                  적어도 점수 비율이 높아야 가설이 맞는다.
                  어느 버튼을 눌렀는지(cta 분포)는 여기서 뺐다 — 아래 '버튼 → 저장된 값'
                  표가 같은 걸 저장 결과까지 붙여서 보여주므로 두 번 읽을 이유가 없다. */}
              <div style={{ fontSize: 11, color: '#8B95A1', borderTop: '1px solid #F2F4F6', paddingTop: 8, marginTop: 'auto' }}>
                <span style={{ color: KIND_COLOR.score, fontWeight: 700 }}>
                  {L('점수', 'Score', 'Điểm')} {r.kinds?.score ?? 0}
                </span>
                {' · '}
                <span style={{ color: KIND_COLOR.level }}>
                  {L('자기서술', 'Self-desc', 'Tự mô tả')} {r.kinds?.level ?? 0}
                </span>
                {' · '}
                {L('못함', 'Neither', 'Không biết')} {r.kinds?.none ?? 0}
              </div>
            </div>
          )
        })}
      </div>

      {/* 실제로 들어온 값 — 비율만 보면 "무엇이 들어왔는지"를 못 본다. 이 캠페인의 목적이
          자기서술 52% 를 자격증·점수로 바꾸는 거라, 전환 10% 를 넘겨도 전부 자기서술이면
          지금과 같은 데이터가 늘어난 것뿐이다. 그래서 종류를 같이 센다. */}
      {!!data?.fills?.length && (
        <div style={{ marginTop: 14, borderTop: '1px solid #F2F4F6', paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setShowFills((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: 0, border: 'none',
              background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700, color: '#191F28',
            }}
          >
            <span style={{ color: '#8B95A1', fontSize: 10 }}>{showFills ? '▾' : '▸'}</span>
            {L('들어온 값', 'What came in', 'Dữ liệu đã nhận')} {data.fills.length}
          </button>

          {showFills && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            <Chip on={!kindFilter} onClick={() => setKindFilter(null)}
              label={L('전체', 'All', 'Tất cả')} n={data.fills.length} />
            <Chip on={kindFilter === 'score'} onClick={() => setKindFilter(kindFilter === 'score' ? null : 'score')}
              label={L('점수', 'Score', 'Điểm')} n={data.kinds?.score ?? 0} color={KIND_COLOR.score} />
            <Chip on={kindFilter === 'level'} onClick={() => setKindFilter(kindFilter === 'level' ? null : 'level')}
              label={L('수준(자기서술)', 'Self-described', 'Tự mô tả')} n={data.kinds?.level ?? 0} color={KIND_COLOR.level} />
            <Chip on={kindFilter === 'other'} onClick={() => setKindFilter(kindFilter === 'other' ? null : 'other')}
              label={L('기타', 'Other', 'Khác')} n={data.kinds?.other ?? 0} color={KIND_COLOR.other} />
            <Chip on={kindFilter === 'none'} onClick={() => setKindFilter(kindFilter === 'none' ? null : 'none')}
              label={L('못함', 'Neither', 'Không biết')} n={data.kinds?.none ?? 0} color={KIND_COLOR.none} />
          </div>

          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #F2F4F6', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#FAFBFC' }}>
                  <th style={{ ...fillTh, width: 26 }}>arm</th>
                  <th style={fillTh}>{L('이름', 'Name', 'Tên')}</th>
                  <th style={fillTh}>{L('영어', 'English', 'Tiếng Anh')}</th>
                  <th style={fillTh}>{L('한국어', 'Korean', 'Tiếng Hàn')}</th>
                </tr>
              </thead>
              <tbody>
                {data.fills.filter((f) => !kindFilter || f.kind === kindFilter).map((f, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F2F4F6' }}>
                    <td style={fillTd}><ArmTag campaign={f.campaign} /></td>
                    <td style={{ ...fillTd, fontWeight: 600 }}>{f.name}</td>
                    <td style={fillTd}><CertCell value={f.english_cert} kind={f.englishKind} L={L} /></td>
                    <td style={fillTd}><CertCell value={f.korean_cert} kind={f.koreanKind} L={L} /></td>
                  </tr>
                ))}
                {kindFilter && !data.fills.some((f) => f.kind === kindFilter) && (
                  <tr><td colSpan={4} style={{ ...fillTd, color: '#B0B8C1', textAlign: 'center', padding: '14px 8px' }}>
                    {L('해당하는 값이 없습니다', 'Nothing in this bucket', 'Không có dữ liệu')}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 버튼 → 저장값 매핑. 같은 토글 안, 목록 바로 아래에 둔다 — 위 목록의 값이 왜
              그렇게 생겼는지를 설명하는 표라 떨어뜨려 놓으면 따로 읽히고 오해가 남는다.
              'Intermediate 7건'은 7명이 자기 수준을 서술한 게 아니라 랜딩이 미리 채워준
              값을 그대로 저장한 것이다 — 정보량이 "그 버튼을 눌렀다"와 정확히 같다.
              '그대로'가 크면 그 버튼은 수준을 측정하지 못하고 있다는 뜻이다. */}
          {!!data?.mapping?.length && (<>
          <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 0' }}>
            {L('버튼 → 저장된 값', 'Button → stored value', 'Nút → giá trị đã lưu')}
          </div>
          <div style={{ fontSize: 11, color: '#8B95A1', margin: '4px 0 8px' }}>
            {L("‘그대로’는 우리가 미리 채운 값을 손대지 않고 저장한 사람이다. 그 값은 자기서술이 아니라 '그 버튼을 눌렀다'와 같은 뜻이다.",
               "‘Kept’ = saved our pre-filled value untouched. That is not self-description — it carries no more than the click itself.",
               "‘Giữ nguyên’ = lưu giá trị điền sẵn của chúng tôi.")}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr>
                <th style={fillTh}>{L('버튼', 'Button', 'Nút')}</th>
                <th style={fillTh}>{L('미리 채운 값', 'Pre-filled', 'Điền sẵn')}</th>
                <th style={{ ...fillTh, textAlign: 'right' }}>{L('저장', 'Saved', 'Đã lưu')}</th>
                <th style={{ ...fillTh, textAlign: 'right' }}>{L('그대로', 'Kept', 'Giữ')}</th>
                <th style={{ ...fillTh, textAlign: 'right' }}>{L('고침', 'Changed', 'Sửa')}</th>
              </tr>
            </thead>
            <tbody>
              {data.mapping.map((m) => (
                <tr key={m.cta} style={{ borderTop: '1px solid #F2F4F6' }}>
                  <td style={fillTd}>{CTA_LABEL(L)[m.cta] || m.cta}</td>
                  <td style={{ ...fillTd, color: m.preset ? KIND_COLOR.level : '#B0B8C1' }}>
                    {m.preset || L('없음 (직접 입력)', 'none (typed)', 'không có')}
                  </td>
                  <td style={{ ...fillTd, textAlign: 'right', fontWeight: 600 }}>{m.n}</td>
                  <td style={{ ...fillTd, textAlign: 'right', color: m.kept ? KIND_COLOR.level : '#B0B8C1', fontWeight: m.kept ? 700 : 400 }}>{m.kept}</td>
                  <td style={{ ...fillTd, textAlign: 'right', color: m.changed ? KIND_COLOR.score : '#B0B8C1' }}>{m.changed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>)}
          </>)}
        </div>
      )}
    </div>
  )
}

const fillTh = { padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#8B95A1', whiteSpace: 'nowrap' }
const fillTd = { padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' }

// 값 자체를 그대로 보여주되 종류를 색으로 구분한다. '점수'만 이 캠페인이 원한 결과다.
const KIND_COLOR = { score: '#16a34a', other: '#4E5968', level: '#B45309', none: '#B0B8C1' }

// 어느 arm 에서 온 사람인지 — 목록의 첫 칸. 위 카드의 배지와 달리 채우지 않고 외곽선만
// 쓴다. 스무 줄이 넘는 목록에서 solid 배지가 줄마다 들어가면 정작 읽어야 할 값(점수·수준)
// 보다 arm 이 먼저 눈에 들어온다.
function ArmTag({ campaign }) {
  const m = ARM_META[campaign]
  if (!m) return <span style={{ color: '#D1D6DB' }}>?</span>
  return (
    <span style={{
      display: 'inline-block', minWidth: 14, textAlign: 'center',
      fontSize: 10, fontWeight: 700, color: m.color, background: 'none',
      border: `1px solid ${m.color}55`, borderRadius: 4, padding: '0 4px', lineHeight: 1.6,
    }}>{m.tag}</span>
  )
}

// 값 종류 필터 칩. 숫자는 API 가 준 kinds 를 그대로 쓴다 — 화면에서 다시 세면
// 칩의 숫자와 필터 결과가 어긋날 수 있다.
function Chip({ label, n, on, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 100, cursor: 'pointer',
        fontFamily: 'inherit', lineHeight: 1.6,
        border: `1px solid ${on ? (color || '#191F28') : '#E5E8EB'}`,
        background: on ? (color || '#191F28') : '#fff',
        color: on ? '#fff' : (color || '#4E5968'),
      }}
    >
      {label} {n}
    </button>
  )
}

function CertCell({ value, kind, L }) {
  if (!value) return <span style={{ color: '#D1D6DB' }}>—</span>
  return (
    <span style={{ color: KIND_COLOR[kind] || '#4E5968' }}>
      {kind === 'none' ? L('못함', 'Neither', 'Không biết') : value}
    </span>
  )
}

// 제목 줄 오른쪽에 들어가므로 두 줄을 넘기지 않는다 — 값과 비율을 한 줄에 붙여
// 라벨/값 2단으로만 쌓는다. 예전처럼 3단으로 쌓으면 제목 줄이 그만큼 두꺼워진다.
function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 42 }}>
      <div style={{ fontSize: 10, color: '#8B95A1', fontWeight: 600, lineHeight: 1.4 }}>{label}</div>
      <div style={{ lineHeight: 1.25, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: accent || '#191F28' }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: '#8B95A1', marginLeft: 3 }}>{sub}</span>}
      </div>
    </div>
  )
}