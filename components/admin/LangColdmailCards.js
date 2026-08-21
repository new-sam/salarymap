import { useState } from 'react'
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

/* 4차 세 갈래. 발송 전에는 대상 수를, 발송 뒤에는 그 arm 의 실적을 같은 자리에 그린다 —
   보낼 때 보던 숫자와 결과를 보는 숫자가 같은 줄에 있어야 회차가 이어져 읽힌다.
   pool 키는 API 의 pool 과 같은 이름이어야 한다. */
const TODAY_ARMS = [
  { pool: 'applied', campaign: 'coldmail-lang-nocert-applied-1', ko: '지원 경험 O', en: 'Has applied', vi: 'Đã ứng tuyển' },
  { pool: 'fresh', campaign: 'coldmail-lang-nocert-fresh-1', ko: '지원 0', en: 'Never applied', vi: 'Chưa ứng tuyển' },
  { pool: 'again', campaign: 'coldmail-lang-nocert-again-1', ko: '재발송 · 기수신', en: 'Re-send', vi: 'Gửi lại' },
]

const pct = (v) => `${(v * 100).toFixed(1)}%`

/* 재확인 회차 — 카드 안에 바로 편다. '자세히 보기'를 눌러야 보이면 회차 비교가
   한 화면에서 안 된다. 이 카드의 질문이 "카피를 바꿔서 나아졌나"라 R5·R6 를 세로로
   붙여 두는 것 자체가 답이다. */
const RECHECK_ARMS = [
  { campaign: 'coldmail-lang-recheck-1', ko: '5차 · 부탁 프레임', en: '5th · request framing', vi: 'Đợt 5' },
  { campaign: 'coldmail-lang-recheck-2', ko: '6차 · 손실 프레임', en: '6th · loss framing', vi: 'Đợt 6' },
  /* 7차는 앞 둘과 묻는 것이 다르다 — R5·R6 는 "그 뒤로 점수가 생겼나"였고 R7 은
     "그 등급이 어느 시험 것인가"다. 모집단도 자기서술 전체가 아니라 맨 등급값 112명뿐이라,
     같은 칸에 세워 두되 카피 효과로 세로 비교하면 안 된다. */
  { campaign: 'coldmail-lang-exam-1', ko: '7차 · 시험명 확인', en: '7th · which test', vi: 'Đợt 7' },
]

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
  // 캠페인 카드는 접어 둔다 — 계열(A/B·KTC·이력서·유령)마다 모집단이 달라 카드를
  // 넷으로 갈라 놨는데, 평소 묻는 건 "그래서 다 합쳐 몇 명이 썼나" 하나뿐이다.
  // 지난 회차와 4차를 따로 여는 이유: 두 카드가 나란히 서 있는데 토글이 하나면
  // 오른쪽을 펼치려다 왼쪽 네 장이 같이 쏟아진다.
  const [detail, setDetail] = useState(false)
  const [detailToday, setDetailToday] = useState(false)
  const [detailRecheck, setDetailRecheck] = useState(false)
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

  // 4차(오늘 나가는 회차)는 왼쪽 합계에서 뺀다 — 지난 회차의 결론과 진행 중인 회차를
  // 한 숫자로 뭉치면 둘 다 못 읽는다. 카드를 나란히 두 장 세우는 것도 같은 이유다.
  // 7차(R7)는 API 의 familyOf 가 recheck 으로 보내므로 재확인 카드에 같이 잡힌다.
  const past = groups.filter((g) => g.family !== 'nocert' && g.family !== 'recheck')
  const today = groups.find((g) => g.family === 'nocert') || null
  const recheck = groups.find((g) => g.family === 'recheck') || null

  // 계열을 가로질러 더한다. 카드 안에서는 절대 합치면 안 되는 숫자지만(모집단이 다르다),
  // 여기 질문은 전환율이 아니라 "이 캠페인으로 어학을 몇 명한테서 받아냈나"라 합이 답이다.
  const sum = (gs) => gs.reduce((s, g) => ({
    sent: s.sent + (g.totals?.sent || 0),
    clicked: s.clicked + (g.totals?.clicked || 0),
    filled: s.filled + (g.totals?.filled || 0),
  }), { sent: 0, clicked: 0, filled: 0 })
  const totals = sum(past)
  const todayTotals = sum(today ? [today] : [])

  // 발송이 걸쳐 있는 날짜. 하루에 다 나갔으면 한 날짜만 뜬다.
  const dateOf = (gs) => {
    const ats = gs.flatMap((g) => g.rows.flatMap((r) => [r.firstSentAt, r.lastSentAt])).filter(Boolean).sort()
    if (!ats.length) return ''
    const a = mmdd(ats[0]), b = mmdd(ats[ats.length - 1])
    return a === b ? a : `${a}–${b}`
  }
  const pool = data?.pool

  return (
    <>
      {/* 지난 회차 결과 | 진행 중인 4차 — 같은 생김새의 카드 두 장. 폭이 좁아지면
          (사이드바를 편 노트북) 한 줄로 접힌다. */}
      <div className="adm-m-1col" style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16,
        alignItems: 'start',
      }}>
        <SummaryCard
          L={L}
          date={dateOf(past)}
          title={L('어학 콜드메일 결과', 'Language cold-email results', 'Kết quả cold-email ngoại ngữ')}
          note={L(`${past.length}개 계열 합계 · 발송분 전체`,
                  `${past.length} campaign families · all sends`,
                  `${past.length} nhóm chiến dịch`)}
          stats={[
            { label: L('총 발송', 'Sent', 'Đã gửi'), value: totals.sent },
            { label: L('클릭', 'Click', 'Click'), value: totals.clicked, sub: totals.sent ? pct(totals.clicked / totals.sent) : null },
            { label: L('어학 입력', 'Filled', 'Đã điền'), value: totals.filled, sub: totals.sent ? pct(totals.filled / totals.sent) : null, accent: '#16a34a' },
          ]}
          /* 합계만 두면 656건짜리 유령 계열이 섞인 게 안 보여 입력률 13.0% 를 캠페인
             성능으로 읽게 된다. 계열별로 펼쳐 두면 그 줄이 스스로 설명한다. */
          body={<PastArms groups={past} L={L} />}
          open={detail}
          onToggle={() => setDetail((v) => !v)}
          toggleNote={L('계열별 제목 A/B · 들어온 값', 'Per-family subject A/B · what came in', 'A/B tiêu đề · dữ liệu đã nhận')}
        />

        <SummaryCard
          L={L}
          /* 아직 안 나갔으면 오늘 날짜를 쓴다 — 이 카드는 '지금 나가는 회차'라서
             날짜 자리가 비면 왼쪽 카드와 제목이 똑같아진다. 발송이 시작되면 실제
             발송일로 바뀐다. */
          date={dateOf(today ? [today] : []) || mmdd(new Date().toISOString())}
          title={L('어학 콜드메일 결과', 'Language cold-email results', 'Kết quả cold-email ngoại ngữ')}
          note={L(`이력서 O · 어학만 빔 · 근거별 3종 · 모수 ${pool?.total ?? 0}명`,
                  `Resume, language blank · 3 angles · pool ${pool?.total ?? 0}`,
                  `Có CV, thiếu ngoại ngữ · 3 phiên bản · ${pool?.total ?? 0}`)}
          stats={[
            { label: L('발송', 'Sent', 'Đã gửi'), value: todayTotals.sent },
            { label: L('클릭', 'Click', 'Click'), value: todayTotals.clicked, sub: todayTotals.sent ? pct(todayTotals.clicked / todayTotals.sent) : null },
            { label: L('어학 입력', 'Filled', 'Đã điền'), value: todayTotals.filled, sub: todayTotals.sent ? pct(todayTotals.filled / todayTotals.sent) : null, accent: '#16a34a' },
          ]}
          body={<TodayArms pool={pool} group={today} L={L} />}
          open={detailToday}
          onToggle={today ? () => setDetailToday((v) => !v) : null}
          toggleNote={L('갈래별 들어온 값', 'What came in per angle', 'Dữ liệu theo phiên bản')}
        />

        {/* 5차 — 세는 것이 다르다. '입력'은 점수를 새로 받아낸 것이고 '그대로 확인'은
            값은 그대로인 채 "아직 자격증은 없다"가 확정된 것이다. 둘을 한 칸에 합치면
            무엇이 늘었는지 알 수 없어진다. */}
        <SummaryCard
          L={L}
          date={dateOf(recheck ? [recheck] : []) || mmdd(new Date().toISOString())}
          title={L('어학 재확인', 'Language recheck', 'Xác nhận lại ngoại ngữ')}
          note={L(`자기서술로 남아 있는 회원 ${data?.selfDesc ?? 0}명 중`,
                  `of ${data?.selfDesc ?? 0} still self-described`,
                  `trong ${data?.selfDesc ?? 0} người`)}
          stats={[
            { label: L('발송', 'Sent', 'Đã gửi'), value: recheck?.totals?.sent ?? 0 },
            /* 저장(filled)이 아니라 자격증 형태로 들어온 것만 센다 — cta=score 를 눌러놓고
               "Basic" 을 저장한 사람이 1 차에 실제로 있었다. 그 사람까지 점수 갱신으로
               세면 이 캠페인이 성공했는지를 스스로 속이게 된다.
               meta.saved 는 2026-08-21 부터 실려서 그 이전 회차는 0 으로 보인다. */
            { label: L('점수 갱신', 'Scored', 'Có điểm'), value: recheck?.totals?.scored ?? 0,
              sub: recheck?.totals?.sent ? pct((recheck.totals.scored || 0) / recheck.totals.sent) : null, accent: '#16a34a' },
            { label: L('그대로 확인', 'Confirmed', 'Xác nhận'), value: recheck?.totals?.same ?? 0,
              sub: recheck?.totals?.sent ? pct(recheck.totals.same / recheck.totals.sent) : null, accent: '#7C3AED' },
          ]}
          body={<RecheckArms group={recheck} L={L} />}
          footer={recheck ? null : L('아직 발송 전 — coldmail-lang-recheck-* 가 나가면 채워집니다',
                                     'Not sent yet', 'Chưa gửi')}
          open={detailRecheck}
          onToggle={recheck ? () => setDetailRecheck((v) => !v) : null}
          toggleNote={L('들어온 값', 'What came in', 'Dữ liệu đã nhận')}
        />
      </div>

      {detailRecheck && recheck && <GroupCard data={recheck} L={L} />}
      {detail && past.map((g) => <GroupCard key={g.key} data={g} L={L} />)}
      {detailToday && today && <GroupCard data={today} L={L} />}
    </>
  )
}

/* 두 카드를 같은 함수로 찍는다 — 나란히 놓인 카드의 제목 크기·숫자 크기·토글 자리가
   조금이라도 어긋나면 두 회차를 비교해 읽을 수 없다. 다른 건 내용뿐이어야 한다. */
function SummaryCard({ L, date, title, note, stats, footer, body, open, onToggle, toggleNote }) {
  return (
    <div style={{ ...sectionStyle, marginBottom: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {date && `${date} `}
        {title}
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>{note}</span>
      </div>

      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginTop: 10 }}>
        {stats.map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 10.5, color: '#8B95A1', fontWeight: 600 }}>{s.label}</div>
            <div style={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.accent || '#191F28' }}>{s.value}</span>
              {s.sub && <span style={{ fontSize: 11, color: '#8B95A1', marginLeft: 4 }}>{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {body}

      {footer && (
        <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 10, lineHeight: 1.5 }}>{footer}</div>
      )}

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          style={{
            fontSize: 11.5, fontWeight: 600, color: '#4E5968', background: 'none', border: 0, padding: 0,
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 12,
          }}
        >
          <span style={{ color: '#8B95A1', marginRight: 4, fontSize: 10 }}>{open ? '▾' : '▸'}</span>
          {L('자세히 보기', 'Details', 'Xem chi tiết')}
          <span style={{ fontWeight: 500, color: '#8B95A1', marginLeft: 5 }}>{toggleNote}</span>
        </button>
      )}
    </div>
  )
}

/* 지난 회차 계열별 한 줄 — 오른쪽 4차 카드와 같은 모양이라 두 회차를 같은 눈으로 읽는다.
   합계 한 줄만 두면 656건짜리 유령 계열이 나머지를 다 끌어내린다는 게 안 보인다. */
function PastArms({ groups, L }) {
  if (!groups.length) return null
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 10 }}>
      <tbody>
        {groups.map((g) => (
          <tr key={g.key} style={{ borderTop: '1px solid #F2F4F6' }}>
            <td style={{ padding: '5px 0', color: '#4E5968' }}>{FAMILY_LABEL(g.family, L)}</td>
            <td style={{ padding: '5px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#8B95A1' }}>{g.totals.sent}</span>
              <span style={{ color: '#D1D6DB', margin: '0 4px' }}>→</span>
              <span style={{ fontWeight: 700, color: '#16a34a' }}>{g.totals.filled}</span>
              {!!g.totals.sent && (
                <span style={{ color: '#8B95A1', marginLeft: 4 }}>{pct(g.totals.filled / g.totals.sent)}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// 계열 한 줄 이름 — 카드 제목의 긴 설명 말고, 표에서 세로로 훑을 수 있는 짧은 이름.
const FAMILY_LABEL = (f, L) => (
  f === 'language' ? L('제목 A/B · 지원 경험 O', 'Subject A/B', 'A/B tiêu đề')
    : f === 'ktc' ? L('KTC 유입', 'From KTC', 'Từ KTC')
      : f === 'resume' ? L('이력서 O · 지원 0', 'Resume, never applied', 'Có CV, chưa ứng tuyển')
        : f === 'ghost' ? L('죽은 회원 · 이력서도 지원도 0', 'Dormant — no resume, no application', 'Chỉ đăng ký')
          : f === 'recheck' ? L('자기서술 재확인', 'Recheck', 'Xác nhận lại')
            : f
)

/* 4차 갈래별 줄 — 발송 전에는 각 갈래의 대상 수를, 발송 뒤에는 같은 자리에 발송·입력을
   그린다. 대상 수는 어학이 채워지는 만큼 줄어들므로(=우리가 받아낸 만큼) 보내고 난
   뒤에도 남은 모수로 계속 읽힌다. */
function RecheckArms({ group, L }) {
  const rowOf = (campaign) => group?.rows?.find((r) => r.campaign === campaign)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 10 }}>
      <tbody>
        {RECHECK_ARMS.map((a) => {
          const r = rowOf(a.campaign)
          const m = ARM_META[a.campaign]
          return (
            <tr key={a.campaign} style={{ borderTop: '1px solid #F2F4F6' }}>
              <td style={{ padding: '5px 0', color: '#4E5968' }}>
                <span style={{ color: m.color, fontWeight: 700, marginRight: 5 }}>{m.tag}</span>
                {L(a.ko, a.en, a.vi)}
              </td>
              {/* 발송 → 점수 갱신 · 그대로. 두 결과를 한 줄에 둬야 "무엇이 늘었나"가 읽힌다. */}
              <td style={{ padding: '5px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {r ? (
                  <>
                    <span style={{ color: '#8B95A1' }}>{r.sent}</span>
                    <span style={{ color: '#D1D6DB', margin: '0 4px' }}>→</span>
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>{r.scored}</span>
                    {!!r.sent && <span style={{ color: '#8B95A1', marginLeft: 4 }}>{pct(r.scoredRate || 0)}</span>}
                    <span style={{ color: '#D1D6DB', margin: '0 6px' }}>|</span>
                    <span style={{ fontWeight: 700, color: '#7C3AED' }}>{r.same}</span>
                    <span style={{ color: '#B0B8C1', marginLeft: 3 }}>{L('그대로', 'same', 'giữ')}</span>
                  </>
                ) : (
                  <span style={{ color: '#B0B8C1' }}>{L('발송 전', 'not sent', 'chưa gửi')}</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function TodayArms({ pool, group, L }) {
  if (!pool) return null
  const rowOf = (campaign) => group?.rows?.find((r) => r.campaign === campaign)

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 10 }}>
        <tbody>
          {TODAY_ARMS.map((a) => {
            const r = rowOf(a.campaign)
            const m = ARM_META[a.campaign]
            return (
              <tr key={a.pool} style={{ borderTop: '1px solid #F2F4F6' }}>
                <td style={{ padding: '5px 0', color: '#4E5968' }}>
                  <span style={{ color: m.color, fontWeight: 700, marginRight: 5 }}>{m.tag}</span>
                  {L(a.ko, a.en, a.vi)}
                </td>
                {/* 발송 전에는 대상 수, 발송 뒤에는 발송 → 입력. 두 상태가 같은 칸을 쓴다. */}
                <td style={{ padding: '5px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {r ? (
                    <>
                      <span style={{ color: '#8B95A1' }}>{r.sent}</span>
                      <span style={{ color: '#D1D6DB', margin: '0 4px' }}>→</span>
                      <span style={{ fontWeight: 700, color: '#16a34a' }}>{r.filled}</span>
                      {!!r.sent && <span style={{ color: '#8B95A1', marginLeft: 4 }}>{pct(r.fillRate)}</span>}
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700 }}>{pool[a.pool] ?? 0}</span>
                      <span style={{ color: '#B0B8C1', marginLeft: 4 }}>{L('대상', 'to send', 'mục tiêu')}</span>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!group && (
        <div style={{ fontSize: 10.5, color: '#B0B8C1', marginTop: 7, lineHeight: 1.45 }}>
          {L('아직 발송 전 — coldmail-lang-nocert-* 가 나가면 이 자리에 발송 → 입력으로 바뀝니다',
             'Not sent yet — turns into sent → filled once coldmail-lang-nocert-* goes out',
             'Chưa gửi — sẽ hiện kết quả sau khi gửi')}
        </div>
      )}
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
          return (
            <div key={r.campaign} style={{ border: '1px solid #E5E8EB', borderRadius: 10, padding: 14 }}>
              {/* 제목 줄 오른쪽이 비어 있어서 수치를 그리로 올렸다 — 아래로 한 줄 더
                  쌓으면 카드가 그만큼 길어지는데, 그 줄에 넣을 자리가 이미 있다. */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, flexWrap: 'wrap', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: '#fff', background: m.color,
                    borderRadius: 5, padding: '2px 7px',
                  }}>{m.tag}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{L(m.ko, m.en, m.vi)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
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
              <div style={{ fontSize: 11, color: '#8B95A1', borderTop: '1px solid #F2F4F6', paddingTop: 8 }}>
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