import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { sectionStyle } from '../../constants/dashboard'
import { ROLE_GROUPS } from '../../constants/jobs'
import { ELITE_CATS } from '../../lib/talentCategory'

/* 어학 점수 패널 — 유진 작업실 > 어학 정보 수집 안과 /admin/lang-scores 양쪽에서 쓴다.
   원래 페이지였던 것을 컴포넌트로 뺐다: 같은 화면을 두 벌 만들면 칩 기준·등급 판정이
   갈라진다.

   /admin/lang-scores — 어학 콜드메일로 실제로 받아낸 자격증·점수만 모은 목록.
   (내부 작업용이라 한국어만 — /admin/korean-cv 와 같다)

   유진 작업실의 '어학 정보 수집' 카드와 다른 화면인 이유: 그 카드는 '제목 A/B 가
   먹혔나'를 묻느라 모집단(wave·계열)별로 갈라야 하는데, 여기 질문은 '무슨 점수를
   받아냈나' 하나뿐이다. 전환율이 없으니 캠페인을 가로질러 한 목록으로 봐야
   시험별 분포가 보인다.

   한 사람이 영어·한국어를 둘 다 넣으면 두 줄이다 — 칩 숫자는 '값의 수'이고 사람 수는
   따로 센다. 데이터: /api/admin/lang-scores */

const CHIPS = [
  { key: 'TOEIC', label: 'TOEIC', color: '#2563EB' },
  { key: 'IELTS', label: 'IELTS', color: '#7C3AED' },
  { key: 'VSTEP', label: 'VSTEP', color: '#0D9488' },
  { key: 'TOPIK', label: 'TOPIK', color: '#DC2626' },
  { key: 'ETC', label: '기타 점수', color: '#8B95A1' },
]

// 어느 메일에서 온 사람인지. 유진 작업실 카드의 배지와 같은 글자를 쓴다.
const ARM = {
  'coldmail-language-1': { tag: 'A', color: '#ff6000', name: '제목 A · 주제 감춤' },
  'coldmail-language-2': { tag: 'B', color: '#4F46E5', name: '제목 B · 그대로 물음' },
  'coldmail-ktc-lang-1': { tag: 'K', color: '#0F766E', name: 'KTC 유입' },
}
export default function LangScoresSection({ token }) {
  const [chip, setChip] = useState(null) // null = 전체
  const [open, setOpen] = useState(false) // 명단은 접어 둔다 — 평소 보는 건 위의 분포다
  const [tier, setTier] = useState(null) // 'A' | 'B' — 전시장. null 이면 안 부른다

  const { data, error, isLoading } = useAdmin('/api/admin/lang-scores', token)
  // 사진·이력서까지 딸린 무거운 응답이라 버튼을 누른 뒤에야 부른다.
  const show = useAdmin(tier ? `/api/admin/lang-tier?tier=${tier}` : null, token)

  const rows = data?.rows || []
  const shown = chip ? rows.filter((r) => r.chip === chip) : rows
  // 필터를 걸면 사람 수도 그 안에서 다시 센다 — 칩을 누른 채 '47명'이 남아 있으면
  // 지금 보고 있는 목록이 몇 명인지 알 수 없다.
  const people = new Set(shown.map((r) => r.email || r.name)).size

  // 바깥 여백은 쓰는 쪽이 정한다 — /admin/lang-scores 는 전체 화면 폭, 유진 작업실은
  // 탭 안이라 자기 레이아웃을 이미 갖고 있다.
  return (
    <>
      <div>
        {/* 제목 옆 A급·B급 버튼 — 이 화면의 결론(누굴 볼 거냐)이라 맨 위에 둔다. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#191F28' }}>어학 점수</h1>
          {['A', 'B'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTier(tier === k ? null : k)}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 100, cursor: 'pointer',
                fontFamily: 'inherit', lineHeight: 1.6,
                border: `1px solid ${tier === k ? TIER[k].color : TIER[k].color + '55'}`,
                background: tier === k ? TIER[k].color : '#fff',
                color: tier === k ? '#fff' : TIER[k].color,
              }}
            >
              {TIER[k].label} {data?.tiers?.[k] ?? ''} 바로보기
            </button>
          ))}
        </div>

        {error && <div style={{ ...sectionStyle, color: '#DC2626' }}>불러오지 못했습니다 — {error.message}</div>}
        {isLoading && !data && <div style={{ ...sectionStyle, color: '#8B95A1' }}>불러오는 중…</div>}

        {tier && (
          <TierShowcase
            tier={tier}
            data={show.data}
            error={show.error}
            loading={show.isLoading}
            onClose={() => setTier(null)}
          />
        )}

        {data?.base && <BaseMatrix base={data.base} scorePeople={data.people} />}

        {data?.certGrades && <CertGrades certs={data.certGrades} members={data.base.members} tiers={data.tiers} />}

        {data && (
          <div style={sectionStyle}>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: 0, border: 0,
                background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, color: '#191F28' }}>
                <span style={{ color: '#8B95A1', marginRight: 5, fontSize: 10 }}>{open ? '▾' : '▸'}</span>
                어학 콜드메일로 받아낸 점수
                <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
                  자기서술·수준 답변은 빼고, 자격증명으로 시작하는 값만
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: open ? 12 : 0, textAlign: 'left' }}>
                <span style={{ color: '#4E5968', fontWeight: 600 }}>{data.people}명 · {rows.length}건</span>
                {' · 어학 칸을 저장한 사람 '}{data.filled}명 중
                {data.filled ? ` (${((data.people / data.filled) * 100).toFixed(1)}%)` : ''}
                {!open && <span style={{ color: '#B0B8C1' }}> · 눌러서 명단 보기</span>}
              </div>
            </button>

            {open && <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <Chip on={!chip} onClick={() => setChip(null)} label="전체" n={rows.length} />
              {CHIPS.map((c) => (
                <Chip
                  key={c.key}
                  on={chip === c.key}
                  onClick={() => setChip(chip === c.key ? null : c.key)}
                  label={c.label}
                  n={data.counts?.[c.key] ?? 0}
                  color={c.color}
                />
              ))}
            </div>

            {!!chip && (
              <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 8 }}>
                {shown.length}건 · {people}명
              </div>
            )}

            <div className="adm-m-scroll" style={{ border: '1px solid #F2F4F6', borderRadius: 8 }}>
              <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: '#FAFBFC' }}>
                    <th style={{ ...th, width: 26 }}>arm</th>
                    <th style={{ ...th, width: 34 }}>wave</th>
                    <th style={th}>시험</th>
                    <th style={th}>값</th>
                    <th style={th}>이름</th>
                    <th style={th}>이메일</th>
                    <th style={th}>저장</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={`${r.email}-${r.field}-${i}`} style={{ borderTop: '1px solid #F2F4F6' }}>
                      <td style={td}><ArmTag campaign={r.campaign} /></td>
                      <td style={{ ...td, color: '#8B95A1' }}>{r.wave}</td>
                      <td style={{ ...td, fontWeight: 600, color: CHIPS.find((c) => c.key === r.chip)?.color }}>
                        {r.cert}
                        {r.field === 'korean' && <span style={{ color: '#B0B8C1', fontWeight: 400 }}> · 한국어</span>}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.value}</td>
                      <td style={td}>{r.name}</td>
                      <td style={{ ...td, color: '#8B95A1' }}>{r.email}</td>
                      <td style={{ ...td, color: '#8B95A1' }}>{(r.at || '').slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  ))}
                  {!shown.length && (
                    <tr><td colSpan={7} style={{ ...td, color: '#B0B8C1', textAlign: 'center', padding: '14px 8px' }}>
                      해당하는 값이 없습니다
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            </>}
          </div>
        )}
      </div>
    </>
  )
}

/* 이력서 × 어학 2×2 — 위 목록(점수 47명)이 전체의 어디쯤인지 보려면 모수가 있어야 한다.
   두 축을 교차시키는 이유: '어학 입력'은 이력서를 이미 낸 사람에게만 사실상 열려 있는
   칸이라(어학은 프로필 화면 안에 있다), 한 줄로 세우면 '어학 없음'이 거절인지 미도달인지
   구분되지 않는다. 실제로 이력서 미등록 쪽은 거의 전부 어학이 비어 있다 — 그 칸은
   설득 대상이 아니라 애초에 도달한 적 없는 사람이다.
   기업(hr) 계정은 뺐다. */
function BaseMatrix({ base, scorePeople }) {
  const n = (v) => v.toLocaleString()
  const rows = [
    { label: '이력서 등록', b: base.resume, accent: '#191F28' },
    { label: '이력서 미등록', b: base.noResume, accent: '#8B95A1' },
  ]
  const langTotal = base.resume.lang + base.noResume.lang
  const scoreTotal = base.resume.score + base.noResume.score

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
        전체 회원 {n(base.members)}명
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
          이력서 × 어학 · 기업 계정 제외
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 12 }}>
        어학이 채워진 회원 {n(langTotal)}명 ({((langTotal / base.members) * 100).toFixed(1)}%)
        {' · 그중 자격증·점수 '}
        <span style={{ color: '#16a34a', fontWeight: 700 }}>{n(scoreTotal)}명</span>
        {' · 어제 콜드메일로 받은 '}{n(scorePeople)}명 포함
      </div>

      <div className="adm-m-scroll">
        <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '34%' }} />
              <th style={{ ...th, textAlign: 'right' }}>어학 O</th>
              <th style={{ ...th, textAlign: 'right' }}>어학 X</th>
              <th style={{ ...th, textAlign: 'right' }}>계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: '1px solid #F2F4F6' }}>
                <td style={{ ...td, fontWeight: 600, color: r.accent }}>{r.label}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <span style={{ fontWeight: 700 }}>{n(r.b.lang)}</span>
                  {/* 점수는 어학 O 의 부분집합이다 — 이 페이지가 세는 건 결국 이 숫자다. */}
                  <span style={{ color: '#16a34a', fontSize: 11, marginLeft: 5 }}>점수 {n(r.b.score)}</span>
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#8B95A1' }}>{n(r.b.noLang)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{n(r.b.total)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid #E5E8EB', background: '#FAFBFC' }}>
              <td style={{ ...td, fontWeight: 700 }}>계</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{n(langTotal)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#8B95A1' }}>
                {n(base.members - langTotal)}
              </td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{n(base.members)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* 자격증별 등급 — 위 2×2의 '점수' 칸을 시험·등급으로 쪼갠 것. 총 회원 기준이라
   콜드메일로 받은 사람도, 원래 이력서에 적혀 있던 사람도 다 들어 있다.

   구간(900+·7.0+·6급)은 시험 안에서만 뜻이 있지만 색은 급(A/B/C)이라 시험을
   가로질러 같은 뜻이다 — TOEIC 900+ 와 IELTS 7.0+ 가 같은 빨강인 건 둘 다 A급이라서다.
   같은 색이 붙어 있으면(TOEIC 의 C급 세 칸) 막대에 흰 선으로 칸을 가른다. */
// position 값 → 공고에서 쓰는 한글 라벨 (constants/jobs.js 가 원본)
const POS_KO = Object.fromEntries(
  ROLE_GROUPS.flatMap((g) => g.roles.map((r) => [r.value, r.label.ko])),
)

const TIER = {
  A: { color: '#DC2626', label: 'A급', desc: 'TOEIC 900+ · IELTS 7.0+ · TOPIK 5급+ · CEFR C1' },
  B: { color: '#7C3AED', label: 'B급', desc: 'TOEIC 800대 · IELTS 6.0–6.5 · TOPIK 4급 · B2' },
  C: { color: '#16A34A', label: '그 외', desc: 'B2 미만' },
  미상: { color: '#B0B8C1', label: '미상', desc: '자격증명만 있고 점수가 없는 값' },
}

/* A급·B급 전시장 — 어학으로 1차로 거른 사람들을 직무로 다시 보는 화면.
   여기서 하는 판단은 '어학은 됐고, 이 사람 일이 좋아 보이나' 하나라서 카드에
   직무·연차·학교·이력서만 남기고 연봉·지역 같은 건 뺐다.
   이력서 없는 사람은 뒤로 밀되 지우지는 않는다 — 어학은 A급인데 이력서가 없는 건
   그 자체로 "이력서 받아내야 할 사람" 목록이다. */
// 년차 구간. 신입·주니어를 한 칸에 묶지 않는 이유는 이 화면의 질문이 "지금 데려와서
// 바로 쓸 사람"이라 3년이 경계이기 때문이다.
// 연차 미상(null)은 어느 칸에도 안 넣는다 — '3년 미만'에 섞으면 주니어 수가 부풀고,
// 실제로는 이력서가 아직 안 읽힌 사람이다.
const YOE_BANDS = [
  { key: 'junior', label: '3년 미만', in: (m) => m != null && m < 36 },
  { key: 'mid', label: '3–5년', in: (m) => m != null && m >= 36 && m < 60 },
  { key: 'senior', label: '5–10년', in: (m) => m != null && m >= 60 && m < 120 },
  { key: 'lead', label: '10년+', in: (m) => m != null && m >= 120 },
]

function TierShowcase({ tier, data, error, loading, onClose }) {
  const [cat, setCat] = useState(null)   // 직군 — null = 전체
  const [band, setBand] = useState(null) // 년차 — null = 전체
  const [q, setQ] = useState('')
  const t = TIER[tier]
  const all = data?.people || []

  /* 검색은 카드에 보이는 것 + 이력서에서 뽑아둔 것을 한 덩어리로 훑는다. 스킬만,
     이름만 찾게 하면 "Figma 쓰는 사람" 같은 실제 질문에 답이 안 나온다. */
  const hay = (p) => [
    p.name, p.nameKo, p.email, p.headline, p.position, p.university, p.major, p.eduKo,
    ...p.bullets, ...p.skills, ...p.certs.map((c) => c.value),
  ].filter(Boolean).join(' ').toLowerCase()

  const kw = q.trim().toLowerCase()
  const people = all.filter((p) =>
    (!cat || p.cat === cat) &&
    (!band || YOE_BANDS.find((b) => b.key === band).in(p.yoeMonths)) &&
    (!kw || hay(p).includes(kw)))

  // 칩 숫자는 다른 필터를 반영한다 — '백엔드 22'를 눌렀는데 3명만 나오면 왜인지 모른다.
  const countCat = (k) => all.filter((p) => p.cat === k &&
    (!band || YOE_BANDS.find((b) => b.key === band).in(p.yoeMonths)) && (!kw || hay(p).includes(kw))).length
  const countBand = (b) => all.filter((p) => b.in(p.yoeMonths) &&
    (!cat || p.cat === cat) && (!kw || hay(p).includes(kw))).length
  const yoe = (m) => (m == null ? '연차 미상' : m >= 12 ? `${Math.floor(m / 12)}년차` : m > 0 ? '1년 미만' : '신입')
  // 직무는 공고와 같은 키를 쓰므로 공고 라벨을 그대로 빌려온다 — 없는 값(AI/Data 처럼
  // 파서가 만든 임의 직무)은 원문 그대로. 여기서 새 번역표를 만들면 공고와 갈라진다.
  const posKo = (v) => (v ? POS_KO[v] || v : '')

  return (
    <div style={{ ...sectionStyle, borderTop: `2px solid ${t.color}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.label} 전시장</div>
        <div style={{ fontSize: 11.5, color: '#8B95A1', flex: 1 }}>
          {t.desc}
          {data && ` · 전체 ${all.length}명 중 이력서 ${data.withResume}명`}
        </div>
        <button type="button" onClick={onClose} style={{
          fontSize: 11, color: '#8B95A1', background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit',
        }}>닫기</button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#DC2626' }}>불러오지 못했습니다 — {error.message}</div>}
      {loading && !data && <div style={{ fontSize: 12, color: '#8B95A1', padding: '20px 0' }}>불러오는 중…</div>}

      {!!all.length && (
        <div style={{ marginTop: 10, padding: '9px 11px', background: '#FAFBFC', border: '1px solid #F2F4F6', borderRadius: 9 }}>
          {/* 직군 — 인재풀 엘리트와 같은 여섯 갈래 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Chip on={!cat} onClick={() => setCat(null)} label="전체 직군" n={all.length} />
            {ELITE_CATS.map((g, gi) => (
              <span key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {gi > 0 && <span style={{ width: 1, height: 15, background: '#E5E8EB' }} />}
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B8C1' }}>{g.label.ko}</span>
                {g.cats.map((c) => (
                  <Chip key={c.key} on={cat === c.key} onClick={() => setCat(cat === c.key ? null : c.key)}
                    label={c.label.ko} n={countCat(c.key)} color={t.color} />
                ))}
              </span>
            ))}
          </div>

          {/* 년차 + 키워드 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B8C1' }}>년차</span>
            {YOE_BANDS.map((b) => (
              <Chip key={b.key} on={band === b.key} onClick={() => setBand(band === b.key ? null : b.key)}
                label={b.label} n={countBand(b)} color={t.color} />
            ))}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="키워드 — 이름 · 스킬 · 이력 · 학교 · 점수"
              style={{
                marginLeft: 'auto', minWidth: 210, flex: '0 1 260px', fontFamily: 'inherit',
                fontSize: 11.5, padding: '4px 9px', borderRadius: 100, border: '1px solid #E5E8EB', outline: 'none',
              }}
            />
            {(cat || band || kw) && (
              <button type="button" onClick={() => { setCat(null); setBand(null); setQ('') }}
                style={{ fontSize: 11, color: '#8B95A1', background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                초기화
              </button>
            )}
          </div>

          {(cat || band || kw) && (
            <div style={{ fontSize: 11, color: '#4E5968', fontWeight: 600, marginTop: 7 }}>
              {people.length}명
              <span style={{ fontWeight: 400, color: '#8B95A1' }}> / {all.length}명</span>
            </div>
          )}
        </div>
      )}

      {data && !people.length && (
        <div style={{ fontSize: 12, color: '#B0B8C1', textAlign: 'center', padding: '26px 0' }}>
          조건에 맞는 사람이 없습니다
        </div>
      )}

      <div className="adm-m-1col" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 12,
      }}>
        {people.map((p) => (
          <div key={p.id} style={{
            border: '1px solid #F2F4F6', borderRadius: 10, padding: 11,
            opacity: p.resume ? 1 : 0.65, // 이력서 없는 카드는 볼 게 없다는 걸 밝기로 알린다
          }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              {p.photo
                ? <img src={p.photo} alt="" referrerPolicy="no-referrer"
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#F2F4F6', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#B0B8C1',
                  }}>{p.name.trim()[0] || '?'}</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* 한글 호칭이 있으면 그걸 앞에 — 원문 이름은 이력서와 대조해야 하니 남긴다 */}
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#191F28', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={p.name}>
                  {p.nameKo && <span>{p.nameKo} </span>}
                  <span style={{ fontWeight: p.nameKo ? 400 : 700, fontSize: p.nameKo ? 11 : 12.5, color: p.nameKo ? '#8B95A1' : '#191F28' }}>
                    {p.name}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 1 }}>
                  {[posKo(p.position), yoe(p.yoeMonths)].filter(Boolean).join(' · ') || '직무 미상'}
                </div>
              </div>
            </div>

            {/* 어학 원문값 — 급만 보면 900 인지 990 인지 모른다 */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {p.certs.map((c, i) => (
                <span key={i} style={{
                  fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                  color: TIER[c.tier].color, border: `1px solid ${TIER[c.tier].color}40`,
                }}>{c.value}</span>
              ))}
            </div>

            {/* 주요이력 — 파서가 만든 한글 3줄이 있으면 그것, 없으면 이력서 원문(영문) */}
            {p.bullets.length ? (
              <ul style={{ margin: '7px 0 0', padding: 0, listStyle: 'none' }}>
                {p.bullets.slice(0, 3).map((b, i) => (
                  <li key={i} style={{ fontSize: 11, color: '#4E5968', lineHeight: 1.5, paddingLeft: 8, position: 'relative',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b}>
                    <span style={{ position: 'absolute', left: 0, color: '#D1D6DB' }}>·</span>{b}
                  </li>
                ))}
              </ul>
            ) : p.headline ? (
              <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 7, lineHeight: 1.45,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {p.headline}
              </div>
            ) : null}

            {/* 학력 — 파서의 한글 학력(학사 · 호치민대, 한국어 전공)이 있으면 그것 */}
            {(p.eduKo || p.university || p.major) && (
              <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={[p.university, p.major].filter(Boolean).join(' · ')}>
                {p.eduKo || [p.university, p.major].filter(Boolean).join(' · ')}
              </div>
            )}
            {!!p.skills.length && (
              <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.skills.join(' · ')}
              </div>
            )}

            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.resume
                ? <a href={p.resume} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, fontWeight: 600, color: '#ff6000', textDecoration: 'none' }}>이력서 보기 ↗</a>
                : <span style={{ fontSize: 11, color: '#B0B8C1' }}>이력서 없음</span>}
              <span style={{ fontSize: 10.5, color: '#B0B8C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.email}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CertGrades({ certs, members, tiers }) {
  const [detail, setDetail] = useState(false) // 후보를 추릴 땐 급 인원만 보면 된다
  const n = (v) => v.toLocaleString()
  const colorOf = (chip) => CHIPS.find((c) => c.key === chip)?.color || '#8B95A1'

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
        자격증별 등급
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
          총 회원 {n(members)}명 기준 · 기업 계정 제외
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 10 }}>
        색은 급이라 시험이 달라도 같은 뜻입니다 · 구간은 시험 안에서만 비교됩니다 ·
        두 시험을 가진 사람은 아래 줄에서 양쪽에 세지만, 급 인원은 높은 쪽으로 한 번만 셉니다
      </div>

      {/* 급 정의 + 사람 수. 후보를 추릴 때 실제로 쓰는 숫자라 맨 위에 둔다. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['A', 'B', 'C', '미상'].map((k) => (
          <div key={k} title={TIER[k].desc} style={{
            flex: '1 1 150px', border: `1px solid ${k === 'A' || k === 'B' ? TIER[k].color + '40' : '#F2F4F6'}`,
            borderRadius: 8, padding: '7px 9px',
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: TIER[k].color }}>
              {TIER[k].label} <span style={{ color: '#191F28' }}>{n(tiers?.[k] ?? 0)}명</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#8B95A1', marginTop: 2, lineHeight: 1.4 }}>{TIER[k].desc}</div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDetail(!detail)}
        style={{
          fontSize: 11.5, fontWeight: 600, color: '#4E5968', background: 'none', border: 0, padding: 0,
          cursor: 'pointer', fontFamily: 'inherit', marginBottom: detail ? 12 : 0,
        }}
      >
        <span style={{ color: '#8B95A1', marginRight: 4, fontSize: 10 }}>{detail ? '▾' : '▸'}</span>
        자세히 보기
        <span style={{ fontWeight: 500, color: '#8B95A1', marginLeft: 5 }}>시험별 구간 {certs.length}개</span>
      </button>

      {detail && certs.map((c) => {
        const color = colorOf(c.chip)
        return (
          <div key={c.cert} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 5 }}>
              <span style={{ fontWeight: 700, color }}>{c.cert}</span>
              <span style={{ color: '#8B95A1', marginLeft: 6 }}>{n(c.total)}명</span>
              <span style={{ color: '#B0B8C1', marginLeft: 4 }}>
                ({((c.total / members) * 100).toFixed(1)}%)
              </span>
            </div>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#F2F4F6' }}>
              {c.bands.map((b, i) => (
                <div key={b.label} title={`${b.label} · ${TIER[b.tier].label} ${b.n}명`}
                  style={{
                    width: `${(b.n / c.total) * 100}%`, background: TIER[b.tier].color,
                    borderLeft: i ? '1px solid #fff' : 0,
                  }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, fontSize: 11 }}>
              {c.bands.map((b) => (
                <span key={b.label} style={{ color: '#4E5968' }}>
                  <span style={{
                    display: 'inline-block', width: 7, height: 7, borderRadius: 2, marginRight: 4,
                    background: TIER[b.tier].color,
                  }} />
                  {b.label} <span style={{ fontWeight: 700 }}>{n(b.n)}</span>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const th = { padding: '7px 8px', textAlign: 'left', fontWeight: 600, color: '#8B95A1', whiteSpace: 'nowrap' }
const td = { padding: '7px 8px', textAlign: 'left', verticalAlign: 'top' }

function ArmTag({ campaign }) {
  const m = ARM[campaign]
  if (!m) return <span style={{ color: '#D1D6DB' }}>?</span>
  return (
    <span title={m.name} style={{
      display: 'inline-block', minWidth: 14, textAlign: 'center',
      fontSize: 10, fontWeight: 700, color: m.color,
      border: `1px solid ${m.color}55`, borderRadius: 4, padding: '0 4px', lineHeight: 1.6,
    }}>{m.tag}</span>
  )
}

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