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

/* 표의 구분 행은 계열이 아니라 3분류로 묶는다.

   계열(language·ktc·resume·ghost·nocert·recheck)은 '누구에게 보냈나'를 가르는 축이고
   API 는 그 단위로 내려준다. 그런데 화면에서 계열마다 구분 행을 세웠더니 캠페인 11개에
   구분 행이 6개가 붙어, 표가 절반쯤 머리글이 됐다.

   앞의 넷(A/B·KTC·이력서 O·죽은 회원)은 대상을 고른 근거만 다를 뿐 묻는 말이 같다 —
   "어학을 채워달라". 그래서 한 덩어리로 묶는다. 나머지 둘은 묻는 말 자체가 다르다:
   4차는 어학 칸이 아예 빈 사람에게 처음 묻는 것이고, 5~7차는 이미 적힌 값을 되묻는다.
   전환의 정의가 갈리는 자리가 거기라 그 둘만 따로 세운다. */
const SECTION_OF = (f) => (f === 'nocert' ? 'nocert' : f === 'recheck' ? 'recheck' : 'early')

const SECTION_LABEL = (s, L) => (
  s === 'nocert' ? L('4차 · 이력서 O · 어학 칸이 빈 층', '4th · language field blank', 'Đợt 4 · thiếu ngoại ngữ')
    : s === 'recheck' ? L('5–7차 · 이미 적힌 값 재확인', '5–7th · recheck what was written', 'Đợt 5–7 · xác nhận lại')
      : L('1–3차 · 어학 입력 요청', '1–3rd · asking to fill language', 'Đợt 1–3 · yêu cầu điền')
)

/* 캠페인 한 줄의 상세 — 그 회차에서 실제로 들어온 값과, 어느 버튼이 그 값을 만들었나.

   집계를 여기서 다시 센다: API 의 mapping·fills 는 계열(family) 단위 합이라, 캠페인
   하나만 볼 때 그대로 쓰면 같은 계열의 다른 회차 클릭이 섞인다. R5·R6·R7 이 한 계열에
   묶여 있으므로 이걸 안 하면 R7 상세에 R5 응답이 딸려 들어온다. */
function CampaignDetail({ row, group, L }) {
  const [kindFilter, setKindFilter] = useState(null)

  const fills = (group.fills || []).filter((f) => f.campaign === row.campaign)
  // '미리 채운 값'은 캠페인이 아니라 버튼의 성질이라 계열 응답에서 그대로 빌려 쓴다.
  const presetOf = Object.fromEntries((group.mapping || []).map((mm) => [mm.cta, mm.preset]))
  const mapping = [...new Set(fills.map((f) => f.cta).filter(Boolean))].map((c) => {
    const g = fills.filter((f) => f.cta === c)
    return {
      cta: c,
      preset: presetOf[c] ?? null,
      n: g.length,
      kept: g.filter((f) => f.keptPreset).length,
      changed: g.filter((f) => !f.keptPreset).length,
    }
  })
  const kindCount = (k) => fills.filter((f) => f.kind === k).length
  const shown = fills.filter((f) => !kindFilter || f.kind === kindFilter)
  // 클릭 분포는 캠페인 행에 이미 사람 수로 들어 있다(0 인 버튼은 뺀다).
  const clickedCtas = Object.entries(row.cta || {}).filter(([, n]) => n > 0)

  /* 저장된 값이 없어도 클릭은 보여준다 — 값을 안 바꾸는 버튼만 눌린 회차가 있을 수 있고
     ('시험 아님'), 그때 "아무 일도 없었다"로 읽히면 안 된다. */
  if (!fills.length) {
    return (
      <div style={{ padding: '12px 14px', fontSize: 11.5, color: '#B0B8C1' }}>
        {L('이 회차에서 저장된 값이 아직 없습니다.', 'Nothing saved from this round yet.', 'Chưa có dữ liệu.')}
        {!!clickedCtas.length && (
          <div style={{ marginTop: 6, color: '#8B95A1' }}>
            {L('누른 버튼', 'Buttons clicked', 'Nút đã bấm')}{' '}
            {clickedCtas.map(([c, n], i) => (
              <span key={c}>{i > 0 && ' · '}{CTA_LABEL(L)[c] || c} <b style={{ color: '#4E5968' }}>{n}</b></span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip on={!kindFilter} onClick={() => setKindFilter(null)}
          label={L('전체', 'All', 'Tất cả')} n={fills.length} />
        <Chip on={kindFilter === 'score'} onClick={() => setKindFilter(kindFilter === 'score' ? null : 'score')}
          label={L('점수', 'Score', 'Điểm')} n={kindCount('score')} color={KIND_COLOR.score} />
        <Chip on={kindFilter === 'level'} onClick={() => setKindFilter(kindFilter === 'level' ? null : 'level')}
          label={L('수준(자기서술)', 'Self-described', 'Tự mô tả')} n={kindCount('level')} color={KIND_COLOR.level} />
        <Chip on={kindFilter === 'other'} onClick={() => setKindFilter(kindFilter === 'other' ? null : 'other')}
          label={L('기타', 'Other', 'Khác')} n={kindCount('other')} color={KIND_COLOR.other} />
        <Chip on={kindFilter === 'none'} onClick={() => setKindFilter(kindFilter === 'none' ? null : 'none')}
          label={L('못함', 'Neither', 'Không biết')} n={kindCount('none')} color={KIND_COLOR.none} />
      </div>

      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #F2F4F6', borderRadius: 8, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: '#FAFBFC' }}>
              <th style={fillTh}>{L('이름', 'Name', 'Tên')}</th>
              <th style={fillTh}>{L('영어', 'English', 'Tiếng Anh')}</th>
              <th style={fillTh}>{L('한국어', 'Korean', 'Tiếng Hàn')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f, i) => (
              <tr key={i} style={{ borderTop: '1px solid #F2F4F6' }}>
                <td style={{ ...fillTd, fontWeight: 600 }}>{f.name}</td>
                <td style={fillTd}><CertCell value={f.english_cert} kind={f.englishKind} L={L} /></td>
                <td style={fillTd}><CertCell value={f.korean_cert} kind={f.koreanKind} L={L} /></td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={3} style={{ ...fillTd, color: '#B0B8C1', textAlign: 'center', padding: '14px 8px' }}>
                {L('해당하는 값이 없습니다', 'Nothing in this bucket', 'Không có dữ liệu')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 버튼 → 저장값. 위 목록의 값이 왜 그렇게 생겼는지를 설명하는 표라 붙여 둔다.
          '그대로'가 크면 그 버튼은 수준을 측정하지 못하고 있다는 뜻이다 — 저장된 값의
          정보량이 "그 버튼을 눌렀다"와 정확히 같아진다. */}
      {!!mapping.length && (<>
        <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 4px' }}>
          {L('버튼 → 저장된 값', 'Button → stored value', 'Nút → giá trị đã lưu')}
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
            {mapping.map((mm) => (
              <tr key={mm.cta} style={{ borderTop: '1px solid #F2F4F6' }}>
                <td style={fillTd}>{CTA_LABEL(L)[mm.cta] || mm.cta}</td>
                <td style={{ ...fillTd, color: mm.preset ? KIND_COLOR.level : '#B0B8C1' }}>
                  {mm.preset || L('없음 (직접 입력)', 'none (typed)', 'không có')}
                </td>
                <td style={{ ...fillTd, textAlign: 'right', fontWeight: 600 }}>{mm.n}</td>
                <td style={{ ...fillTd, textAlign: 'right', color: mm.kept ? KIND_COLOR.level : '#B0B8C1', fontWeight: mm.kept ? 700 : 400 }}>{mm.kept}</td>
                <td style={{ ...fillTd, textAlign: 'right', color: mm.changed ? KIND_COLOR.score : '#B0B8C1' }}>{mm.changed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>)}

      {/* 누른 버튼 전체. 위 표는 '저장까지 간' 사람만 세는데, 값을 안 바꾸는 버튼이 있다 —
          7차의 '시험 아님'은 값을 그대로 두고 기록만 남기므로(coldmail_lang_same) fills 에
          안 들어온다. 그 버튼이 이 회차의 정답 중 하나라, 클릭 분포를 같이 보여주지 않으면
          "아무도 안 눌렀다"로 잘못 읽힌다. */}
      {!!clickedCtas.length && (
        <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 10 }}>
          {L('누른 버튼', 'Buttons clicked', 'Nút đã bấm')}{' '}
          {clickedCtas.map(([c, n], i) => (
            <span key={c}>
              {i > 0 && ' · '}
              {CTA_LABEL(L)[c] || c} <b style={{ color: '#4E5968' }}>{n}</b>
            </span>
          ))}
          {!!row.same && (
            <span style={{ color: '#7C3AED' }}>
              {' — '}{L('값 유지 확인', 'kept as-is', 'giữ nguyên')} {row.same}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* 캠페인 한 줄 = 표 한 행. 카드로 나눠 두던 것을 표로 편다 — 회차가 10개를 넘어가면서
   카드가 화면을 가로질러 흩어져, "몇 번째 회차가 제일 잘 됐나"를 한눈에 못 보게 됐다.

   계열은 카드 대신 구분 행으로 남긴다. 모집단이 달라 세로로 전환율을 비교하면 안 되는
   건 표가 돼도 그대로라, 계열 경계가 보이지 않으면 그 함정이 더 커진다. */
function CampaignTable({ groups, L }) {
  /* 자세히 보기는 캠페인 한 줄씩 연다. 계열 단위로 통째로 펴던 때는 한 번 누르면
     카드 넉 장이 쏟아져서, 정작 보려던 회차를 다시 찾아야 했다.
     한 번에 하나만 연다 — 여러 줄을 펴 두면 표가 다시 세로로 길어진다. */
  const [open, setOpen] = useState(null)

  // 상세는 계열 응답(fills·mapping)에서 캠페인 것만 골라 쓰므로 group 을 같이 들고 간다.
  const rows = groups.flatMap((g) => g.rows
    .filter((r) => ARM_META[r.campaign])
    .map((r) => ({ ...r, family: g.family, group: g })))
  if (!rows.length) return null

  const pctOr = (v, n) => (n ? pct(v) : '—')
  let lastSection = null

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
            const section = SECTION_OF(r.family)
            const head = section !== lastSection ? (lastSection = section, true) : false
            const d0 = r.firstSentAt ? mmdd(r.firstSentAt) : ''
            const d1 = r.lastSentAt ? mmdd(r.lastSentAt) : ''
            return (
              <Fragment key={r.campaign}>
                {head && (
                  <tr>
                    <td colSpan={10} style={{
                      fontSize: 11, fontWeight: 700, color: '#6B7280', background: '#FAFBFC',
                      padding: '5px 10px', borderBottom: '1px solid #EEF0F2',
                    }}>{SECTION_LABEL(section, L)}</td>
                  </tr>
                )}
                <tr
                  onClick={() => setOpen(open === r.campaign ? null : r.campaign)}
                  style={{ cursor: 'pointer', background: open === r.campaign ? '#FAFBFC' : undefined }}
                >
                  <td style={TD}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, color: '#fff', background: m.color,
                      borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap',
                    }}>{m.tag}</span>
                  </td>
                  <td style={{ ...TD, fontWeight: 600 }}>
                    <span style={{ color: '#B0B8C1', fontSize: 10, marginRight: 5 }}>
                      {open === r.campaign ? '▾' : '▸'}
                    </span>
                    {L(m.ko, m.en, m.vi)}
                  </td>
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
                {open === r.campaign && (
                  <tr>
                    <td colSpan={10} style={{ padding: 0, background: '#FAFBFC', borderBottom: '1px solid #EEF0F2' }}>
                      <CampaignDetail row={r} group={r.group} L={L} />
                    </td>
                  </tr>
                )}
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

export default function LangColdmailCards({ token, lang }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
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
    </div>
  )
}

const fillTh = { padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#8B95A1', whiteSpace: 'nowrap' }
const fillTd = { padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' }

// 값 자체를 그대로 보여주되 종류를 색으로 구분한다. '점수'만 이 캠페인이 원한 결과다.
const KIND_COLOR = { score: '#16a34a', other: '#4E5968', level: '#B45309', none: '#B0B8C1' }


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

