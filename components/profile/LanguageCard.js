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
// 수준("Fluent", "Intermediate", "B1"…)이다. 이 옵션이 없으면 그 절반이 갈 곳을 잃는다.
// 그래서 영어의 프로필 경로에만 남긴다 — 한국어와 /lang?cta=score 에는 없다.
//
// '기타'(자유 입력 자격증명)는 2026-08-21 에 전부 뺐다. 자유 입력은 certOf(langTier.js)가
// 못 읽는 값을 만들고, 그건 결국 자기서술로 집계된다 — '자격증 없음'을 없앤 이유와 같다.
// splitCert 는 기존 저장값을 읽기 위해 CERT_ETC 를 계속 내보내지만, 그 값이 걸리면
// 화면은 빈칸 + 안내문으로 보여준다(값 자체는 안 지운다).
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
// 'None' 은 '못한다'를 명시적으로 남기는 값이다. 빈칸과 뜻이 다르다 — 빈칸은
// "아직 안 물어봤다", None 은 "물어봤고 못한다"라서 다시 묻지 않아도 된다.
// 어학 콜드메일의 '둘 다 못합니다'(/lang?cta=none)가 이 값을 채운다.
const LEVELS = ['Native', 'Fluent', 'Business', 'Intermediate', 'Basic', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1', 'None']

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
function CertRow({ label, value, known, onChange, L, allowLevelOnly = true }) {
  const raw = splitCert(value, known)
  // "점수가 있다"고 답하고 들어온 경로(/lang?cta=score)에선 자기서술을 넣을 방법이 아예
  // 없어야 한다. 기존 값이 자기서술("Intermediate")이거나 기타면 선택 안 된 상태로 비우고
  // 시작한다 — 그대로 두면 목록에 없는 항목이 골라진 것처럼 보이고, 점수 칸에 남은
  // "Intermediate"가 시험명과 붙어 "TOEIC Intermediate"로 저장된다.
  // 기존 값을 화면에 되비추지는 않는다. 값은 지우지 않고 남지만(무엇을 고르지 않으면
  // 그대로다), 자격증만 받는 칸에 자기서술을 다시 보여주면 그걸 고쳐 쓰려 든다.
  const blanked = raw.cert === CERT_ETC || (raw.cert === CERT_NONE && !allowLevelOnly)
  const cur = blanked ? { cert: '', etc: '', score: '' } : raw
  const emit = (next) => onChange(joinCert({ ...cur, ...next }))

  const certItems = [
    ...known.map((c) => ({ value: c, label: c })),
    // '기타'는 어디서도 받지 않는다 — 자유 입력이라 certOf(langTier.js)가 못 읽는 값이
    // 들어오고, 그건 결국 자기서술로 집계된다. 목록에 없는 시험을 가진 사람은 드물고,
    // 그 한 명을 받자고 자기서술 유입구를 열어두는 쪽이 손해다.
    // '자격증 없음'은 영어의 프로필 경로에만 남긴다 — 거기선 자기서술이 유일한 답인
    // 사람이 절반이라 빼면 그 절반이 갈 곳이 없다. score 경로와 한국어는 뺀다.
    ...(allowLevelOnly
      ? [{ value: CERT_NONE, label: L('자격증 없음 (수준만)', 'No test (level only)', 'Không có chứng chỉ') }]
      : []),
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
            // 자격증 ↔ 수준을 오갈 때는 점수 칸을 비운다. 안 비우면 수준 텍스트가 그대로
            // 남아 "TOEIC Basic" 같은 값이 저장된다(실제로 콜드메일 유입에서 나왔다).
            // '인사말 정도만 압니다'로 들어와 Basic 이 채워진 상태에서 TOEIC 을 고르는 경로다.
            // 자격증끼리 바꾸는 건 시험명 정정이므로 점수를 남긴다.
            onChange={(v) => emit({
              cert: v,
              etc: '',
              score: (cur.cert === CERT_NONE) === (v === CERT_NONE) ? cur.score : '',
            })}
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

    </div>
  )
}

// allowLevelOnly=false 는 어학 콜드메일의 '점수 있어요' 경로 전용이다. 프로필은 기본값
// (true)을 그대로 쓴다 — 거기선 자기서술이 유일한 답인 사람이 절반이라 빼면 안 된다.
export default function LanguageCard({ form, set, lang, allowLevelOnly = true }) {
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
        allowLevelOnly={allowLevelOnly}
      />

      {/* 한국어는 어디서나 TOPIK 만 받는다 — '자격증 없음'·'기타'가 없다.
          영어와 달리 한국어는 자기서술이 쓸모가 거의 없다: 값이 115건뿐이라 지금 막으면
          늘어나기 전에 끊을 수 있고, 한국어 가능자를 찾는 공고는 급수를 요구한다.
          기존 자기서술 값은 지우지 않고 CertRow 가 안내문으로 보여준다. */}
      <CertRow
        label={L('한국어', 'Korean', 'Tiếng Hàn')}
        value={form.korean_cert}
        known={CERTS.korean_cert}
        onChange={(v) => set('korean_cert', v)}
        L={L}
        allowLevelOnly={false}
      />

      {/* 기타 언어는 score 경로에서 렌더하지 않는다 — 수준을 자유 텍스트로 받는 칸이라
          '자격증만 받는다'는 이 경로의 규칙과 어긋난다.
          ※ /lang 은 api/lang/save.js 가 english_cert·korean_cert 두 칼럼만 쓰기 때문에
            애초에 여기 입력이 저장되지 않는다(프로필에서만 유효하다). */}
      {allowLevelOnly && (
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
      )}
    </>
  )
}