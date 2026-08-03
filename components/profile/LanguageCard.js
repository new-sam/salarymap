import CustomSelect from './CustomSelect'

// 프로필 > 어학 — 영어 / 한국어 / 기타 언어를 나눠 저장한다.
//   영어   → user_profiles.english_cert (text)
//   한국어 → user_profiles.korean_cert  (text)
//   기타   → user_profiles.languages    (jsonb [{name, level}])
//
// 자격증 토글 목록은 DB 실측(2026-08, 1,993 프로필)에서 뽑았다:
//   TOEIC 90 · IELTS 67 · VSTEP 13 · TOPIK 11 · APTIS 5 · TOEFL 1
// VSTEP/APTIS 는 베트남에서 흔한 영어 시험이라 빼면 18명이 바로 기타로 떨어진다.
//
// '자격증 없음'이 필요한 이유: english_cert 390명 중 52%가 자격증이 아니라 자기서술
// 수준("Fluent", "Intermediate", "B1"…)이다. 이 옵션이 없으면 절반이 기타에 쌓여
// 지금과 똑같아진다.
//
// 저장 포맷은 "TOEIC 900" 한 줄 텍스트로 정규화한다. 컬럼 타입을 안 바꿔서 390행
// 마이그레이션도, 파서(parseResume.js)·어드민 인재풀 표시도 건드리지 않는다.
// 점수로 필터·정렬해야 할 때가 오면 그때 jsonb 로 쪼개는 게 맞다.

const CERT_NONE = '__none__'
const CERT_ETC = '__etc__'

const CERTS = {
  english_cert: ['TOEIC', 'IELTS', 'TOEFL', 'VSTEP', 'APTIS'],
  korean_cert: ['TOPIK'],
}

// 자기서술 수준 — DB 상위 표현을 그대로 채택(Intermediate 40 · Fluent 22 · Basic 12 …).
// CEFR(B1 17 · B2 12)도 31명이 쓰고 있어 같이 넣는다.
const LEVELS = ['Native', 'Fluent', 'Business', 'Intermediate', 'Basic', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']

const SCORE_PH = {
  TOEIC: '900', IELTS: '6.5', TOEFL: '100', VSTEP: 'B2', APTIS: 'B2', TOPIK: '5',
}

// "TOEIC 900" → { cert:'TOEIC', score:'900' }.  기존 데이터가 지저분해서
// ("Toeic - 2025", "TOEIC Listening & Reading: 920/990") 자격증 토큰만 떼고 나머지를
// 점수로 넘긴다 — 원문을 잃지 않는 게 우선.
function splitCert(raw, known) {
  const s = String(raw || '').trim()
  if (!s) return { cert: '', etc: '', score: '' }
  // 자격증명이 맨 앞에 있을 때만 칩으로 분해한다. 문장 중간에 있는 값
  // ("Intermediate (TOEIC 540/990)")까지 떼어내면 저장 시 앞뒤가 뒤집혀
  // "TOEIC Intermediate ( 540/990)" 이 된다 — 그런 값은 원문 그대로 둔다.
  const hit = known.find((c) => new RegExp(`^${c}\\b`, 'i').test(s))
  if (hit) {
    const score = s.slice(hit.length).replace(/^[\s:\-–—]+/, '').trim()
    return { cert: hit, etc: '', score }
  }
  // CEFR(B1·B2 등)과 자기서술 수준은 자격증이 아니다
  if (/^[A-C][12]$/i.test(s) || LEVELS.some((l) => l.toLowerCase() === s.toLowerCase())) {
    return { cert: CERT_NONE, etc: '', score: s }
  }
  // "<이름> <점수>" 꼴이면 미지의 자격증으로 본다
  const m = s.match(/^([A-Za-z][A-Za-z.\-]{1,14})\s+(.+)$/)
  if (m) return { cert: CERT_ETC, etc: m[1], score: m[2] }
  return { cert: CERT_NONE, etc: '', score: s }
}

function joinCert({ cert, etc, score }) {
  const v = String(score || '').trim()
  if (!cert) return ''
  if (cert === CERT_NONE) return v
  if (cert === CERT_ETC) return [String(etc || '').trim(), v].filter(Boolean).join(' ')
  return [cert, v].filter(Boolean).join(' ')
}

// 앱(resume_platform='app')은 languages 에 영어·베트남어까지 넣는다. 웹은 기타 언어만
// 다루므로 영어/한국어 항목은 화면에서 빼되, 저장 시 그대로 되돌려 앱 입력분을 지우지 않는다.
const isEnKo = (n) => /(anh|english|영어|korean|한국|hàn|hàn quốc)/i.test(String(n || ''))

// 자격증 드롭다운 + 점수 한 줄. 영어·한국어가 같은 모양을 쓴다.
function CertRow({ label, value, known, onChange, L }) {
  const cur = splitCert(value, known)
  const emit = (next) => onChange(joinCert({ ...cur, ...next }))

  const certItems = [
    ...known.map((c) => ({ value: c, label: c })),
    { value: CERT_NONE, label: L('자격증 없음 (수준만)', 'No test (level only)', 'Không có chứng chỉ') },
    { value: CERT_ETC, label: L('기타', 'Other', 'Khác') },
  ]
  const certLabel = certItems.find((i) => i.value === cur.cert)?.label || ''

  return (
    <div className="pfield">
      <div className="pfield-label">{label}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 42%', minWidth: 0 }}>
          <CustomSelect
            value={cur.cert}
            items={certItems}
            displayValue={certLabel}
            placeholder={L('자격증 선택', 'Select test', 'Chọn chứng chỉ')}
            onChange={(v) => emit({ cert: v, etc: v === CERT_ETC ? cur.etc : '' })}
          />
        </div>
        <div style={{ flex: '1 1 58%', minWidth: 0 }}>
          {cur.cert === CERT_NONE ? (
            <CustomSelect
              value={LEVELS.find((l) => l.toLowerCase() === cur.score.toLowerCase()) || ''}
              options={LEVELS}
              displayValue={cur.score}
              placeholder={L('수준 선택', 'Select level', 'Chọn cấp độ')}
              onChange={(v) => emit({ score: v })}
            />
          ) : cur.cert ? (
            <input
              className="pinput"
              value={cur.score}
              onChange={(e) => emit({ score: e.target.value })}
              placeholder={L(
                `점수 / 등급${SCORE_PH[cur.cert] ? ` (예: ${SCORE_PH[cur.cert]})` : ''}`,
                `Score / level${SCORE_PH[cur.cert] ? ` (e.g. ${SCORE_PH[cur.cert]})` : ''}`,
                `Điểm / cấp độ${SCORE_PH[cur.cert] ? ` (vd: ${SCORE_PH[cur.cert]})` : ''}`,
              )}
            />
          ) : null}
        </div>
      </div>

      {cur.cert === CERT_ETC && (
        <input
          className="pinput"
          style={{ marginTop: 6 }}
          value={cur.etc}
          onChange={(e) => emit({ etc: e.target.value })}
          placeholder={L('자격증명 (예: HSK)', 'Test name (e.g. HSK)', 'Tên chứng chỉ (vd: HSK)')}
        />
      )}
    </div>
  )
}

export default function LanguageCard({ form, set, lang }) {
  const L = (ko, en, vi) => (lang === 'ko' ? ko : lang === 'vi' ? vi : en)

  const allLangs = Array.isArray(form.languages) ? form.languages : []
  const others = allLangs.filter((l) => !isEnKo(l?.name))
  // 앱이 넣은 영어/한국어 항목은 건드리지 않고 그대로 앞에 붙여 되돌린다
  const commit = (rows) => set('languages', [...allLangs.filter((l) => isEnKo(l?.name)), ...rows])

  return (
    <>
      <CertRow
        label={L('영어', 'English', 'Tiếng Anh')}
        value={form.english_cert}
        known={CERTS.english_cert}
        onChange={(v) => set('english_cert', v)}
        L={L}
      />

      <CertRow
        label={L('한국어', 'Korean', 'Tiếng Hàn')}
        value={form.korean_cert}
        known={CERTS.korean_cert}
        onChange={(v) => set('korean_cert', v)}
        L={L}
      />

      <div className="pfield">
        <div className="pfield-label">{L('기타 언어', 'Other languages', 'Ngôn ngữ khác')}</div>
        {others.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              className="pinput"
              style={{ flex: '1 1 40%' }}
              value={row?.name || ''}
              onChange={(e) => commit(others.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
              placeholder={L('언어 (예: 중국어)', 'Language (e.g. Chinese)', 'Ngôn ngữ (vd: Tiếng Trung)')}
            />
            <input
              className="pinput"
              style={{ flex: '1 1 60%' }}
              value={row?.level || ''}
              onChange={(e) => commit(others.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))}
              placeholder={L('자격증 · 점수 / 수준', 'Test · score / level', 'Chứng chỉ · điểm / cấp độ')}
            />
            <button
              type="button"
              onClick={() => commit(others.filter((_, j) => j !== i))}
              style={{ width: 34, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: 'none', cursor: 'pointer', flexShrink: 0, color: 'rgba(0,0,0,0.3)' }}
              aria-label={L('삭제', 'Remove', 'Xoá')}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => commit([...others, { name: '', level: '' }])}
          style={{
            fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 8,
            border: '1px dashed rgba(0,0,0,0.16)', background: 'none', color: 'rgba(0,0,0,0.5)',
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 2,
          }}
        >
          + {L('언어 추가', 'Add language', 'Thêm ngôn ngữ')}
        </button>
      </div>
    </>
  )
}