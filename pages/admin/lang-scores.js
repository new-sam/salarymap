import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin } from '../../lib/adminSwr'
import AdminLayout from '../../components/admin/AdminLayout'
import { sectionStyle } from '../../constants/dashboard'

/* /admin/lang-scores — 어학 콜드메일로 실제로 받아낸 자격증·점수만 모은 목록.
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

export default function AdminLangScores() {
  const [token, setToken] = useState(null)
  const [chip, setChip] = useState(null) // null = 전체
  const [open, setOpen] = useState(false) // 명단은 접어 둔다 — 평소 보는 건 위의 분포다

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setToken(session?.access_token || null))
  }, [])

  const { data, error, isLoading } = useAdmin('/api/admin/lang-scores', token)

  const rows = data?.rows || []
  const shown = chip ? rows.filter((r) => r.chip === chip) : rows
  // 필터를 걸면 사람 수도 그 안에서 다시 센다 — 칩을 누른 채 '47명'이 남아 있으면
  // 지금 보고 있는 목록이 몇 명인지 알 수 없다.
  const people = new Set(shown.map((r) => r.email || r.name)).size

  return (
    <AdminLayout>
      <Head><title>어학 점수 · FYI Admin</title></Head>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 60px' }}>
        {error && <div style={{ ...sectionStyle, color: '#DC2626' }}>불러오지 못했습니다 — {error.message}</div>}
        {isLoading && !data && <div style={{ ...sectionStyle, color: '#8B95A1' }}>불러오는 중…</div>}

        {data?.base && <BaseMatrix base={data.base} scorePeople={data.people} />}

        {data?.certGrades && <CertGrades certs={data.certGrades} members={data.base.members} />}

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
    </AdminLayout>
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
   시험을 가로질러 비교하지 못하게 시험마다 줄을 따로 둔다 — TOEIC 700 과 IELTS 7.0 을
   한 줄에 세우면 없는 환산표를 만든 셈이 된다. */
function CertGrades({ certs, members }) {
  const n = (v) => v.toLocaleString()
  const colorOf = (chip) => CHIPS.find((c) => c.key === chip)?.color || '#8B95A1'
  /* 등급 색은 시험 색의 농담이 아니라 색상 자체가 다른 표다 — 한 색을 흐리게만 하면
     900+ 과 800–899 가 붙어 있을 때 어느 쪽이 어느 칸인지 눈으로 안 갈린다.
     시험 색은 왼쪽 시험명에만 남긴다. 높은 등급부터 빨강·보라·노랑·초록·파랑 순으로,
     4등급짜리 시험(IELTS·VSTEP·APTIS·TOEFL)은 위에서부터 넷만 쓴다 — 맨 위 칸이
     시험마다 같은 색이어야 표를 여러 개 훑을 때 눈이 안 흔들린다. */
  const RAMP = ['#DC2626', '#7C3AED', '#EAB308', '#16A34A', '#2563EB']
  const shade = (b, scale) => {
    if (b.label === '미상') return '#B0B8C1' // 등급 축 위에 자리가 없는 값
    return RAMP.slice(0, scale)[b.i]
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
        자격증별 등급
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
          총 회원 {n(members)}명 기준 · 기업 계정 제외
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 14 }}>
        시험마다 척도가 달라 등급은 같은 시험 안에서만 비교됩니다 · 두 시험을 가진 사람은 양쪽에 셉니다
      </div>

      {certs.map((c) => {
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
              {c.bands.map((b) => (
                <div key={b.label} title={`${b.label} ${b.n}명`}
                  style={{ width: `${(b.n / c.total) * 100}%`, background: shade(b, c.scale) }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, fontSize: 11 }}>
              {c.bands.map((b) => (
                <span key={b.label} style={{ color: '#4E5968' }}>
                  <span style={{
                    display: 'inline-block', width: 7, height: 7, borderRadius: 2, marginRight: 4,
                    background: shade(b, c.scale),
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