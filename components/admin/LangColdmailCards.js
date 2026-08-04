import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'

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
}

const pct = (v) => `${(v * 100).toFixed(1)}%`

export default function LangColdmailCards({ token, lang }) {
  const L = (ko, en, vi) => (lang === 'vi' ? (vi ?? en) : lang === 'ko' ? ko : en)
  // dateRange 를 안 붙인다 — A/B 는 캠페인 전 기간을 한 번에 봐야 하고, 날짜로 자르면
  // arm 별 발송일이 하루라도 어긋났을 때 분모가 달라져 비교가 깨진다.
  const { data, error, isLoading } = useAdmin('/api/admin/lang-coldmail', token)
  // 값 종류 필터. null = 전체. 아래 early return 들보다 먼저 선언해야 훅 순서가 안 깨진다.
  const [kindFilter, setKindFilter] = useState(null)

  if (isLoading && !data) return null
  if (error) return null

  const rows = (data?.rows || []).filter((r) => ARM_META[r.campaign])
  if (!rows.length) {
    return (
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          {L('어학 콜드메일 (제목 A/B)', 'Language cold-email (subject A/B)', 'Cold-email ngoại ngữ (A/B tiêu đề)')}
        </div>
        <div style={{ fontSize: 12, color: '#8B95A1' }}>
          {L('아직 발송 이벤트가 없습니다 — coldmail_lang_sent 가 쌓이면 여기에 뜹니다.',
             'No send events yet — appears once coldmail_lang_sent lands.',
             'Chưa có sự kiện gửi.')}
        </div>
      </div>
    )
  }

  const ab = data?.ab
  const verdict = (t, label) => {
    if (!t) return L(`${label}: 표본이 작아 판정 불가`, `${label}: sample too small`, `${label}: mẫu quá nhỏ`)
    return t.p < 0.05
      ? L(`${label}: 차이 있음 (p=${t.p.toFixed(3)})`, `${label}: significant (p=${t.p.toFixed(3)})`, `${label}: có khác biệt (p=${t.p.toFixed(3)})`)
      : L(`${label}: 차이 없음이 아니라 '모름' (p=${t.p.toFixed(3)})`, `${label}: inconclusive (p=${t.p.toFixed(3)})`, `${label}: chưa kết luận (p=${t.p.toFixed(3)})`)
  }

  return (
    <div style={{ ...sectionStyle, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
        {L('어학 콜드메일 (제목 A/B)', 'Language cold-email (subject A/B)', 'Cold-email ngoại ngữ (A/B tiêu đề)')}
      </div>
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12 }}>
        {L('제목만 다르고 본문·버튼은 동일 · 전환 = 어학 입력 완료',
           'Subject differs only; body and buttons identical · convert = language filled',
           'Chỉ khác tiêu đề · chuyển đổi = đã điền ngoại ngữ')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {rows.map((r) => {
          const m = ARM_META[r.campaign]
          return (
            <div key={r.campaign} style={{ border: '1px solid #E5E8EB', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#fff', background: m.color,
                  borderRadius: 5, padding: '2px 7px',
                }}>{m.tag}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{L(m.ko, m.en, m.vi)}</span>
              </div>

              <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                <Stat label={L('발송', 'Sent', 'Đã gửi')} value={r.sent} />
                <Stat label={L('클릭', 'Click', 'Click')} value={r.clicked} sub={r.sent ? pct(r.clickRate) : null} />
                <Stat label={L('어학 입력', 'Filled', 'Đã điền')} value={r.filled} sub={r.sent ? pct(r.fillRate) : null} accent={m.color} />
              </div>

              {/* 어느 버튼이 눌렸는지 — 제목만큼이나 이 캠페인의 두 번째 질문이다.
                  '둘 다 못함'은 카드 밖 회색 링크라 나머지 셋과 성격이 달라 줄을 나눈다.
                  이 수가 셋의 합에 근접하면 링크가 버튼을 잠식한 것이다. */}
              <div style={{ fontSize: 11, color: '#8B95A1', borderTop: '1px solid #F2F4F6', paddingTop: 8 }}>
                {L('점수 있음', 'Has score', 'Có điểm')} {r.cta.score} ·{' '}
                {L('일상 회화', 'Daily', 'Hằng ngày')} {r.cta.daily} ·{' '}
                {L('인사말', 'Basic', 'Cơ bản')} {r.cta.basic}
                <div style={{ marginTop: 3 }}>
                  {L('둘 다 못함', 'Neither', 'Không biết cả hai')} {r.cta.none || 0}
                </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, marginRight: 2 }}>
              {L('들어온 값', 'What came in', 'Dữ liệu đã nhận')}
            </span>
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
                  <th style={fillTh}>{L('이름', 'Name', 'Tên')}</th>
                  <th style={fillTh}>{L('영어', 'English', 'Tiếng Anh')}</th>
                  <th style={fillTh}>{L('한국어', 'Korean', 'Tiếng Hàn')}</th>
                  <th style={{ ...fillTh, width: 34 }}>arm</th>
                </tr>
              </thead>
              <tbody>
                {data.fills.filter((f) => !kindFilter || f.kind === kindFilter).map((f, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F2F4F6' }}>
                    <td style={{ ...fillTd, fontWeight: 600 }}>{f.name}</td>
                    <td style={fillTd}><CertCell value={f.english_cert} kind={f.englishKind} L={L} /></td>
                    <td style={fillTd}><CertCell value={f.korean_cert} kind={f.koreanKind} L={L} /></td>
                    <td style={{ ...fillTd, color: '#8B95A1' }}>{ARM_META[f.campaign]?.tag || '?'}</td>
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
        </div>
      )}

      {ab && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#4E5968', lineHeight: 1.7 }}>
          {verdict(ab.click, L('클릭률', 'Click rate', 'Tỷ lệ click'))}
          <br />
          {verdict(ab.fill, L('어학 입력률', 'Fill rate', 'Tỷ lệ điền'))}
          <div style={{ color: '#8B95A1', marginTop: 4 }}>
            {L("p ≥ 0.05 는 '차이가 없다'가 아니라 '이 표본으로는 모른다'는 뜻이다. 100명/arm 기준 오픈은 40%→60%, 전환은 10%→25% 라야 잡힌다.",
               "p ≥ 0.05 means 'unknown at this sample', not 'no difference'. At 100/arm this detects 40%→60% on opens, 10%→25% on conversion.",
               "p ≥ 0.05 nghĩa là 'chưa biết', không phải 'không khác biệt'.")}
          </div>
        </div>
      )}
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

function Stat({ label, value, sub, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: '#8B95A1', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent || '#191F28', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: '#8B95A1' }}>{sub}</div>}
    </div>
  )
}