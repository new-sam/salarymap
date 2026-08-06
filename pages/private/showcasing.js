import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { track } from '../../lib/track'
import { verifyToken } from '../../lib/showcaseToken'
import supabaseAdmin from '../../lib/supabaseAdmin'

/* /private/showcasing — 고객사에 보여줄 인재 전시장(비공개).

   "비공개"의 뜻은 인증이 아니라 '안 알려진 주소'다 — 링크를 아는 사람은 그냥 열린다.
   그래서 두 가지가 이 페이지의 전제다.

   1) 검색엔진에 절대 안 잡혀야 한다. robots.txt 는 Allow: / 이므로 여기서 noindex 를
      직접 건다(robots.txt 에 Disallow 를 적으면 오히려 주소를 광고하는 꼴이다).
   2) 링크가 한 번 새면 회수가 안 된다. 그래서 후보의 실명·이메일·이력서 원본 링크는
      이 화면에 올리지 않는다 — 어드민(/admin/lang-scores)의 전시장과 다른 점이 그거다.
      API 가 그 칼럼을 아예 SELECT 하지 않으므로 화면 코드가 실수해도 샐 것이 없다.

   화면은 셋이다. JD 를 받고(입력) → 조건을 뽑아 이력서를 훑고(로딩) → 5명을 보여준다(결과).
   로딩이 따로 있는 건 시간이 걸려서만은 아니다. 조건을 먼저 띄워 주면 후보를 다 보기 전에
   "이렇게 이해한 게 맞나"를 확인할 수 있다. */

const ACCEPT = '.pdf,.docx,.txt,.md'

/* 세 화면이 같은 언어를 쓰게 하는 최소한의 토큰.

   고른 기준은 하나다 — 이 화면은 서비스 소개가 아니라 우리가 사람을 골라 보내 드리는
   '보고서'다. 그래서 색을 늘리는 대신 층을 만든다: 반 톤 낮춘 종이(paper) 위에 흰
   카드가 얹히고, 카드는 선이 아니라 옅은 그림자로 떠 있고, 위계는 굵기와 회색조로만
   만든다. 브랜드 오렌지는 결정적인 곳(순위·점수·보내기)에만 쓴다 — 여기저기 칠하면
   보고서가 아니라 광고가 된다. */
const T = {
  ink: '#12161C',      // 제목
  body: '#42505F',     // 본문
  mute: '#7C8894',     // 보조 설명
  faint: '#A9B2BD',    // 라벨·비활성
  line: '#E7EAEE',     // 테두리
  hair: '#F0F2F5',     // 행 구분선(더 옅게)
  paper: '#FAFAF9',    // 바탕 — 순백이면 흰 카드가 선 하나로만 존재한다
  brand: '#ff6000',
  brandInk: '#D94E00',
  brandSoft: '#FFF6F0',
  brandLine: '#FFDFCB',
  // 그림자는 두 겹이다. 넓고 옅은 것으로 띄우고, 좁고 진한 것으로 가장자리를 세운다.
  sm: '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.03)',
  md: '0 8px 24px rgba(16,24,40,.07), 0 2px 6px rgba(16,24,40,.04)',
  lg: '0 24px 60px rgba(16,24,40,.16), 0 4px 12px rgba(16,24,40,.06)',
}

// 보고서의 작은 머리글 — 자간을 벌린 라벨 하나로 '문서'의 인상이 생긴다.
const eyebrow = {
  fontSize: 10.5, fontWeight: 800, color: T.faint,
  letterSpacing: '0.13em', textTransform: 'uppercase',
}

export default function PrivateShowcasing({ co, campaign, off, c }) {
  const [step, setStep] = useState('input') // input | criteria | match | done
  const [jd, setJd] = useState('')
  const [file, setFile] = useState('')     // 첨부해서 채운 경우 파일명 — 출처를 밝혀 둔다
  const [reading, setReading] = useState(false)
  const [focus, setFocus] = useState(false) // 입력칸 포커스 — 링을 씌우는 용도
  const [wide, setWide] = useState(false)   // 넓게 보기 — 긴 JD 를 확인할 때 칸을 키운다
  const [long, setLong] = useState(false)   // 내용이 기본 높이를 넘겼는지 — 확대 버튼을 이때만 보인다
  const [criteria, setCriteria] = useState(null)
  // 훑을 이력서 건수 — 조건 단계가 같이 세어 온다. 로딩 화면이 그 숫자를 말한다.
  const [pool, setPool] = useState(null)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const boxRef = useRef(null)

  /* 이벤트에는 기업 이름만 싣는다 — JD 원문은 남기지 않는다. 고객사가 아직 안 낸 자리를
     통째로 저장하는 셈이라, 로그를 보려고 남의 채용 계획을 우리 DB 에 쌓게 된다.
     길이만 남겨도 "빈 칸으로 눌렀나 / 진짜 JD 를 넣었나"는 구분된다.
     로그: /admin/showcasing-events */
  const ev = (name, meta) => {
    if (off) return // 어드민에서 추적을 끊은 링크 — 이 방문은 없던 것처럼 둔다
    track(name, { page: '/private/showcasing', meta: { co: co || null, campaign: campaign || null, ...meta } })
  }

  useEffect(() => { ev('psc_open') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const grow = (el) => {
    if (!el) return
    el.style.height = 'auto'
    // 넓게 보기에서는 화면 높이만큼 열어 준다 — 로고·제목을 치운 자리까지 위아래로 쓴다.
    // 200 은 입력칸 테두리·버튼 줄·안내 줄·상하 여백의 몫 — 다 합쳐 한 화면에 들어와야
    // 확장했는데 페이지가 스크롤되는 일이 없다.
    const cap = wide ? window.innerHeight - 200 : 340
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`
    setLong(el.scrollHeight > 340)
  }

  // 토글 직후 새 높이로 다시 잰다 — grow 는 이벤트에서만 불려서 상태 변화를 스스로 못 본다
  useEffect(() => { grow(boxRef.current) }, [wide]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = async (f) => {
    if (!f) return
    setErr(''); setReading(true)
    try {
      const body = new FormData()
      body.append('file', f)
      const r = await fetch('/api/private/jd-extract', { method: 'POST', body })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '파일을 읽지 못했습니다')
      // 읽은 글로 입력칸을 덮지 않고 이어 붙인다 — 먼저 적어 둔 조건이 사라지면
      // 파일을 붙였다는 이유로 사람이 쓴 문장을 날리는 셈이다.
      // 첨부는 이 화면의 유일한 갈림길이다 — 붙여넣기로 끝내는 사람과 파일을 여는 사람은
      // 다음에 우리가 뭘 준비해야 하는지가 다르다(파서를 더 볼 건지, 입력칸을 더 볼 건지).
      ev('psc_file', { chars: String(j.text || '').length })
      setJd((prev) => (prev.trim() ? `${prev.trim()}\n\n${j.text}` : j.text))
      setFile(j.name)
      requestAnimationFrame(() => grow(boxRef.current))
    } catch (e) {
      setErr(e.message)
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = '' // 같은 파일을 다시 고를 수 있게
    }
  }

  const submit = async () => {
    if (!jd.trim() || reading) return
    ev('psc_submit', { chars: jd.trim().length, file: !!file })
    setErr(''); setCriteria(null); setResult(null); setStep('criteria')
    // 실패했을 때 어디서 멈췄는지. 로딩 화면은 두 번의 대기(조건 뽑기 → 이력서 훑기)를
    // 한 화면에서 보여줘서, 단계를 안 남기면 둘 중 어느 쪽이 문제인지 영영 모른다.
    let stage = 'criteria'
    try {
      const r1 = await fetch('/api/private/jd-criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd }),
      })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.error || 'JD를 읽지 못했습니다')
      setCriteria(j1.criteria)
      setPool(j1.pool ?? null)
      setStep('match')
      stage = 'match'
      /* 조건이 나온 시점. JD 를 넣은 사람(psc_submit)과 결과를 본 사람(psc_result) 사이가
         비어 있으면, 중간에 사라진 사람이 기다리다 나간 건지 매칭이 죽은 건지 안 갈린다.
         inferred 는 JD 에 안 적혀 있어서 우리가 추측한 조건이 있다는 뜻 — 결과가 엉뚱할 때
         제일 먼저 의심할 값이라 건수를 세어 둔다. */
      ev('psc_criteria', {
        inferred: !!j1.criteria?.inferred,
        yoe_min: j1.criteria?.yoe_min ?? null,
        positions: j1.criteria?.positions?.length || 0,
      })

      // 토큰을 같이 보낸다 — 서버가 서명을 다시 확인해서 이 검색에 기업 이름을 붙인다.
      // 기업명을 문자열로 보내지 않는 이유: 로그인이 없는 경로라 그대로 믿을 수가 없다.
      const r2 = await fetch('/api/private/jd-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: j1.criteria, c: c || null }),
      })
      const j2 = await r2.json()
      if (!r2.ok) throw new Error(j2.error || '후보를 찾지 못했습니다')
      setResult(j2)
      setStep('done')
      ev('psc_result', { picks: j2.picks?.length || 0, screened: j2.screened ?? null })
    } catch (e) {
      setErr(e.message)
      setStep('input')
      // 실패도 남긴다 — 결과가 안 나온 게 우리 잘못인지 조건이 빡센 건지는
      // 실패 건수를 봐야 갈린다. 메시지는 우리가 띄운 문구라 PII 가 아니다.
      ev('psc_fail', { stage, message: String(e.message || '').slice(0, 120) })
    }
  }

  // 다시 하기도 남긴다 — 결과를 보고 되돌아간 건 "이 조건이 아닌데요"라는 뜻이라,
  // 문의로 안 간 사람 중에 조용히 나간 사람과 구분된다.
  const restart = () => {
    ev('psc_restart', { picks: result?.picks?.length || 0 })
    setStep('input'); setResult(null); setCriteria(null)
  }

  return (
    <>
      <Head>
        <title>Showcasing · FYI</title>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow" />
      </Head>

      {step === 'done' ? (
        <Result data={result} criteria={criteria} co={co} onBack={restart} ev={ev} />
      ) : (
        /* 첫 화면은 세로 가운데. 로딩은 위에 고정한다 — 여기는 기다리는 동안 조건 상자가
           뒤늦게 붙어서 내용이 자라는데, 가운데 정렬이면 그때마다 제목과 로고가 위로
           밀려 올라간다. 읽고 있는 글이 움직이면 그것부터 눈에 밟힌다.
           위를 붙박아 두면 자라는 건 아래쪽뿐이다. */
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', overflow: 'hidden',
          // 위쪽에 복숭아빛 온기를 깔고, 입력 화면은 오른쪽 아래 브랜드 글로우와
          // 왼쪽 아래 옅은 메아리로 대각 구도를 만든다 — 이 화면은 로고와 입력칸뿐이라
          // 배경이 받쳐 주지 않으면 통째로 빈 종이로 보인다. 색은 브랜드 오렌지 한 계열만.
          background: [
            'radial-gradient(1200px 620px at 50% -12%, #FFE9DB 0%, rgba(255,233,219,0) 64%)',
            ...(step === 'input'
              ? [
                  'radial-gradient(1400px 980px at 102% 104%, rgba(255,96,0,.16) 0%, rgba(255,96,0,.06) 42%, rgba(255,96,0,0) 74%)',
                  'radial-gradient(820px 640px at -8% 78%, rgba(255,96,0,.09) 0%, rgba(255,96,0,0) 62%)',
                ]
              : []),
            `linear-gradient(180deg, #FFF7F1 0%, ${T.paper} 46%)`,
          ].join(', '),
          ...(step === 'input'
            ? { padding: '48px 20px 0' }
            : { padding: '116px 20px 0' }),
        }}>
          {/* 도트는 오른쪽 아래 모서리에서만 보이고 안쪽으로 오면서 사라진다.
              마스크가 없으면 화면 전체가 격자가 되어 종이가 아니라 방안지가 된다.
              로딩·결과 화면에는 안 깐다 — 거기는 이 자리에 단계 목록과 카드가 자라 들어온다. */}
          {step === 'input' && (
            <div aria-hidden style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'radial-gradient(rgba(18,22,28,.14) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              WebkitMaskImage: 'linear-gradient(to top left, #000 0%, rgba(0,0,0,.55) 24%, transparent 56%)',
              maskImage: 'linear-gradient(to top left, #000 0%, rgba(0,0,0,.55) 24%, transparent 56%)',
            }} />
          )}

          {/* 배치된 도트 층 위로 올라와야 한다 — 흐름 안의 요소는 절대 배치된 형제보다 아래에 깔린다.
              입력 화면의 세로 가운데는 wrapper 의 justify-content 가 아니라 여기 auto 마진으로
              잡는다 — justify-content 로 가운데를 잡으면 아래 푸터까지 같이 가운데로 끌려온다. */}
          <div style={{
            width: '100%', maxWidth: 640, position: 'relative',
            ...(step === 'input' ? { margin: 'auto 0' } : {}),
          }}>
            {/* 첫 화면만 가운데에 크게. 여기는 화면에 이것과 입력칸뿐이라 로고가
                작으면 빈 화면처럼 보인다. 로딩은 단계 목록이 왼쪽으로 흐르는 화면이라 왼쪽에 작게.
                넓게 보기에서는 로고·제목을 치운다 — 입력칸이 위아래로 자라 그 자리까지 쓴다. */}
            {!(step === 'input' && wide) && (
              <Mark center={step === 'input'} size={step === 'input' ? 88 : 24} />
            )}

            {step === 'input' ? (
              <>
                {/* 첫 화면은 한 줄과 입력칸뿐이다. 인사말·예시·안내를 얹으면 읽을 것이
                    늘어나는데, 여기서 할 일은 하나(JD 를 넣는다)라 읽을 게 없어야 빠르다. */}
                {!wide && (
                  <div style={{ textAlign: 'center' }}>
                    <H>채용하고자 하는 포지션의 JD를 올려주세요</H>
                  </div>
                )}

                {/* 입력칸 — 글이든 파일이든 여기 한 곳으로 모인다.
                    처음엔 한 줄이고 쓰는 만큼만 자란다(grow). 빈 화면에 큰 상자를 띄우면
                    "이만큼 써야 하나" 싶어지는데, 실제로 붙여넣는 JD 는 길다.
                    포커스에서 테두리 두께를 바꾸는 대신 링을 덧씌운다 — 두께가 변하면
                    상자가 1px 움찔하고, 그 떨림이 타이핑 내내 보인다. */}
                <div style={{
                  marginTop: 26, background: '#fff', borderRadius: 18, padding: '16px 16px 12px',
                  border: `1px solid ${focus ? T.brandLine : T.line}`,
                  boxShadow: focus ? `${T.md}, 0 0 0 4px rgba(255,96,0,.08)` : T.sm,
                  transition: 'box-shadow .16s ease, border-color .16s ease',
                  position: 'relative',
                }}>
                  {/* 넓게 보기 — 내용이 기본 높이를 넘겼을 때만 나타난다(제미나이 방식).
                      짧은 JD 에는 키울 이유가 없어서 버튼부터가 소음이다. */}
                  {(long || wide) && (
                    <button type="button" className="psc-zoom" onClick={() => setWide((w) => !w)}
                      title={wide ? '좁게 보기' : '넓게 보기'}>
                      {wide ? <Shrink /> : <Grow />}
                    </button>
                  )}
                  <textarea
                    ref={boxRef}
                    className="psc-jd"
                    value={jd}
                    onChange={(e) => { setJd(e.target.value); grow(e.target) }}
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
                    }}
                    placeholder="JD를 붙여넣거나 파일로 올려주세요"
                    rows={1}
                    style={{
                      width: '100%', border: 0, outline: 'none', resize: 'none', padding: 0,
                      fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.7, color: T.ink,
                      background: 'transparent', minHeight: 25,
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
                      onChange={(e) => onPick(e.target.files?.[0])} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: T.body,
                        background: '#fff', border: `1px solid ${T.line}`, borderRadius: 100,
                        padding: '6px 13px', cursor: reading ? 'default' : 'pointer', boxShadow: T.sm,
                      }}>
                      <Clip />{reading ? '읽는 중…' : '파일 첨부'}
                    </button>

                    {/* 입력칸의 글이 사람이 쓴 건지 파서가 뽑은 건지 */}
                    {!!file && !reading && (
                      <span style={{
                        fontSize: 11.5, color: T.mute, minWidth: 0, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{file} 읽음</span>
                    )}

                    <button type="button" onClick={submit} disabled={!jd.trim() || reading}
                      style={{
                        marginLeft: 'auto', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                        color: '#fff', border: 0, borderRadius: 100, padding: '8px 18px',
                        background: jd.trim() && !reading ? T.brand : '#D6DBE1',
                        boxShadow: jd.trim() && !reading ? '0 2px 6px rgba(255,96,0,.18)' : 'none',
                        cursor: jd.trim() && !reading ? 'pointer' : 'default',
                        transition: 'box-shadow .16s ease, background .16s ease',
                      }}>
                      보내기
                    </button>
                  </div>
                </div>

                {!!err && <div style={{ fontSize: 12.5, color: '#DC2626', marginTop: 10 }}>{err}</div>}

                <div style={{ fontSize: 11.5, color: T.faint, marginTop: 12, textAlign: 'center' }}>
                  PDF · DOCX · TXT · 5MB까지
                </div>
              </>
            ) : (
              <Loading step={step} criteria={criteria} pool={pool} />
            )}
          </div>

          {/* 넓게 보기에서는 푸터도 치운다 — 확장의 약속은 '한 화면'인데 푸터 높이만큼
              페이지가 스크롤되면 그 약속이 깨진다 */}
          {!(step === 'input' && wide) && (
            <CorpFooter style={step === 'input' ? null : { marginTop: 'auto' }} />
          )}

          {/* 긴 JD 를 붙여넣으면 높이 상한에서 스크롤이 생긴다. 막대를 아예 감추면
              더 있다는 표시가 없어서, 트랙 없이 얇은 썸만 남긴다(제미나이 방식). */}
          <style jsx>{`
            .psc-jd { scrollbar-width: thin; scrollbar-color: #D9DEE4 transparent; }
            .psc-jd::-webkit-scrollbar { width: 5px; }
            .psc-jd::-webkit-scrollbar-track { background: transparent; }
            .psc-jd::-webkit-scrollbar-thumb { background: #D9DEE4; border-radius: 100px; }
            .psc-jd::-webkit-scrollbar-thumb:hover { background: #C3CAD2; }

            /* 확대 토글 — 평소엔 아이콘만, 호버에서 원형 테두리가 떠서 누를 수 있는 것임을
               알린다. 테두리는 투명으로 늘 깔려 있어 나타날 때 1px 도 안 밀린다. */
            .psc-zoom {
              position: absolute; top: 10px; right: 10px; width: 28px; height: 28px;
              display: flex; align-items: center; justify-content: center;
              background: rgba(255,255,255,.88); border: 1px solid transparent; border-radius: 50%;
              padding: 0; color: ${T.mute}; cursor: pointer;
              transition: color .15s ease, border-color .15s ease;
            }
            .psc-zoom:hover { color: ${T.ink}; border-color: ${T.line}; }
          `}</style>
        </div>
      )}
    </>
  )
}

/* 사이트에서 쓰는 워드마크 그대로(/fyi-logo.png — GlobalNav·기업 화면과 같은 파일).
   여기서만 다른 마크를 그리면 고객사에겐 다른 회사로 보인다.
   링크는 안 건다 — 비공개 화면이라 눌러서 본 사이트로 나가면 안 된다. */
const Mark = ({ center, size = 24 }) => (
  <img src="/fyi-logo.png" alt="FYI" style={{
    height: size, width: 'auto', objectFit: 'contain', display: 'block', marginBottom: center ? 26 : 20,
    ...(center ? { marginLeft: 'auto', marginRight: 'auto' } : null),
  }} />
)

const H = ({ children }) => (
  <div style={{
    fontSize: 25, fontWeight: 700, color: T.ink, letterSpacing: '-0.035em',
    lineHeight: 1.35, marginTop: 2,
  }}>{children}</div>
)

const Clip = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .5 }}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
)

// 넓게/좁게 보기 — 대각 화살표 한 쌍(피처 maximize-2/minimize-2 형)
const Grow = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)
const Shrink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)

/* 회사 정보 푸터 — 이 링크는 한국 기업에게 나가는 것이라 본 사이트(베트남 대상)가 아니라
   한국 법인(멋쟁이사자처럼) 표기를 단다. 값은 공식 표기 그대로. */
const CorpFooter = ({ style }) => (
  <footer style={{
    width: '100%', textAlign: 'center', padding: '30px 0 32px',
    fontSize: 11, lineHeight: 1.9, color: T.faint, ...style,
  }}>
    <div style={{ height: 1, background: T.line, maxWidth: 640, margin: '0 auto 18px' }} />
    <div>상호명: 멋쟁이사자처럼 · 대표: 나성영 · 사업자 번호: 264-88-01106</div>
    <div>통신판매업 신고번호: 2022-서울종로-1534 · 전화번호: 02-6203-3222 · contact@likelion.net</div>
    <div>주소: 서울 종로구 종로3길17, 광화문D타워 D1동 16층, 17층</div>
    <div style={{ marginTop: 6 }}>Copyright © 2022 멋쟁이사자처럼 All rights reserved.</div>
  </footer>
)

/* 로딩 — 기다리는 20초 동안 우리가 뭘 하고 있는지 보여준다.

   네 단계로 쪼갠 이유: "찾는 중"만 돌면 기다리는 사람 입장에서는 우리가 뭘 하는지도,
   얼마나 하는지도 모른다. 그런데 이 화면이 파는 건 결국 '꼼꼼히 봤다'는 것이다 —
   이력서 1,497건을 한 장씩 요건에 대본다는 사실이 결과보다 먼저 설득한다.

   서버 호출은 둘인데 단계는 넷이다. 앞의 둘은 조건 뽑기 안에서, 뒤의 둘은 이력서
   훑기 안에서 실제로 순서대로 일어나는 일이라(요건 읽기 → 빠진 조건 추론 /
   전건 대조 → 다섯으로 좁히기), 그 안에서 시간으로 넘긴다. 없는 일을 지어내지는 않는다.

   붙는 숫자는 전부 진짜다. 요건 개수는 조건이 오면 알고, 모수는 조건 단계가 같이 세어
   온다(jd-criteria.poolCount) — 그래야 훑는 20초 동안 "1,497건"을 말할 수 있다. */
// 제목 옆에 붙는 스피너. 제목이 두 줄로 접혀도 첫 줄 옆에 남게 위쪽 정렬한다.
const stepSpin = {
  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 7,
  border: `2px solid ${T.line}`, borderTopColor: T.brand,
}

function Loading({ step, criteria, pool }) {
  const [sub, setSub] = useState(0)
  useEffect(() => {
    setSub(0)
    // 조건 뽑기는 5초 안팎, 이력서 훑기는 15초 안팎이다. 그 안에서 한 번씩 넘긴다.
    const t = setTimeout(() => setSub(1), step === 'criteria' ? 2200 : 7000)
    return () => clearTimeout(t)
  }, [step])

  /* 제목도 단계마다 바뀐다. 아래 줄만 넘어가고 제목이 20초 내내 그대로면 화면이
     한 곳에 멈춰 있는 것처럼 보인다 — 진행 중이라는 걸 실제로 말하는 건 큰 글씨 쪽이다.
     제목은 짧게 '무엇을', 아래 줄은 길게 '어떻게'. 둘이 같은 말을 하면 한 줄은 없는 셈이다. */
  const heads = [
    'JD를 읽고 있어요',
    '빠진 조건을 채우고 있어요',
    '이력서를 한 장씩 보고 있어요',
    '가장 잘 맞는 분들을 고르고 있어요',
  ]

  const at = (step === 'criteria' ? 0 : 2) + sub

  return (
    <>
      <div style={eyebrow}>인재 추천</div>
      {/* 스피너를 제목 옆에 붙인다. 아래에 따로 돌던 과정 줄은 지웠다 — 제목이 이미
          네 번 바뀌면서 진행을 말하고 있어서, 같은 말을 하는 줄이 하나 더 있었다. */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <H>{heads[at]}</H>
        <span className="spin" style={stepSpin} />
      </div>
      {/* 조건이 나오면 바로 띄운다 — 틀렸으면 결과를 기다릴 필요가 없다 */}
      {criteria && <CriteriaBox c={criteria} />}

      <style jsx>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}

// 뽑아낸 조건 — 로딩 화면과 결과 화면이 같은 걸 쓴다
function CriteriaBox({ c }) {
  const shown = (c.requirements || []).filter((r) => !r.includes('추정'))
  const yoe = c.yoe_min == null && c.yoe_max == null ? null
    : `${c.yoe_min ?? 0}${c.yoe_max != null ? `~${c.yoe_max}` : '+'}년`
  const lang = [
    c.korean !== 'none' && `한국어 ${c.korean === 'required' ? '필수' : '우대'}`,
    c.english !== 'none' && `영어 ${c.english === 'required' ? '필수' : '우대'}`,
  ].filter(Boolean).join(' · ')

  const meta = [c.positions.join(' · '), yoe, lang, c.note].filter(Boolean).join(' · ')

  /* 카드가 아니라 '표지가 붙은 문서'로 보이게 머리글 줄을 따로 뒀다. 조건이 뒤늦게
     뜨는 화면이라, 상자가 그냥 나타나면 어디서 온 건지 모른다. */
  return (
    <div style={{
      marginTop: 24, background: '#fff', border: `1px solid ${T.line}`,
      borderRadius: 16, boxShadow: T.sm, overflow: 'hidden',
    }}>
      <div style={{
        padding: '11px 16px', borderBottom: `1px solid ${T.hair}`,
        background: 'linear-gradient(180deg,#FFFFFF 0%,#FCFCFB 100%)',
      }}>
        <div style={eyebrow}>읽어낸 조건</div>
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>
          {c.title || '요청하신 자리'}
        </div>
        {!!meta && <div style={{ fontSize: 12, color: T.mute, marginTop: 4 }}>{meta}</div>}

        {/* 화면에는 JD 에 적힌 조건만 올린다. 업무 설명에서 유추한 (추정) 요건은 매칭에는
            쓰되 보여주지 않는다 — 고객사 입장에서는 자기가 쓰지도 않은 조건이 자기 조건인 양
            걸려 있는 것이고, "웹 서비스 개발 경험이 있어야 합니다 (추정)" 같은 문장은
            우리가 뭘 넣었는지 설명하느라 화면만 잡아먹는다. */}
        {!!shown.length && <Bullets items={shown} color={T.body} />}

        {!!c.preferred?.length && (
          // 우대사항은 순위를 가르는 칸이라(자격요건은 통과선이라 통과자끼리는 다 같다) 같이 보인다
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
            <div style={{ ...eyebrow, fontSize: 10 }}>우대</div>
            <Bullets items={c.preferred} color={T.mute} />
          </div>
        )}
      </div>
    </div>
  )
}

/* 조건 배지 — 결과 화면 제목 아래 한 줄.

   올리는 건 매칭에 실제로 쓴 값뿐이다: 연차 · 필수 기술 · 어학. 요건 문장을 그대로
   배지로 만들면 "코드 구조, 리팩토링, 애플리케이션 성능 최적화에 대한 지식" 같은 한
   문장이 배지 하나를 통째로 먹어서 줄이 무너진다. 문장은 로딩 화면에서 이미 보여줬다.

   필수 기술을 앞에 두는 이유: 고객사가 이 화면에서 제일 먼저 확인하는 게 "내가 적은
   스택으로 찾았나"다. 연차·어학은 그다음이다. */
function Keywords({ c }) {
  if (!c) return null
  const yoe = c.yoe_min == null && c.yoe_max == null ? null
    : `${c.yoe_min ?? 0}${c.yoe_max != null ? `~${c.yoe_max}` : '+'}년`
  const items = [
    ...(c.must_skills || []).slice(0, 6),
    yoe,
    c.korean !== 'none' && `한국어 ${c.korean === 'required' ? '필수' : '우대'}`,
    c.english !== 'none' && `영어 ${c.english === 'required' ? '필수' : '우대'}`,
  ].filter(Boolean)
  if (!items.length) return null

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
      {/* '기준' 만 두면 무엇의 기준인지가 안 붙는다 — 아래 카드가 이 값으로 골라졌다는
          말이라 '선택 기준' 이 맞다. */}
      <span style={{ ...eyebrow, fontSize: 9.5, marginRight: 2 }}>선택 기준</span>
      {items.map((k, i) => (
        <span key={i} style={{
          fontSize: 11.5, fontWeight: 600, color: T.body, background: '#fff',
          border: `1px solid ${T.line}`, borderRadius: 100, padding: '4px 11px',
          boxShadow: T.sm, whiteSpace: 'nowrap',
        }}>{k}</span>
      ))}
    </div>
  )
}

// 점 대신 작은 원. 가운뎃점(·)은 글자라 줄마다 높이가 흔들리는데, 원은 자리에 고정된다.
const Bullets = ({ items, color }) => (
  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
    {items.map((r, i) => (
      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.6, color }}>
        <span style={{
          flexShrink: 0, width: 4, height: 4, borderRadius: '50%',
          background: T.brandLine, marginTop: 7,
        }} />
        <span style={{ minWidth: 0 }}>{r}</span>
      </div>
    ))}
  </div>
)

/* 결과 — 5명. 못 채우면 못 채운 채로 보여준다. 숫자를 맞추려고 기준 미달을 끼워 넣으면
   이 화면의 '5명'이 무슨 뜻인지 사라진다. */
function Result({ data, criteria, co, onBack, ev }) {
  const picks = data?.picks || []
  // 위계 세 단 — 1·2등 / 3~6등 / 7~10등(2·4·4). 순위가 카드 크기로도 읽히게 나눈다.
  const tier1 = picks.slice(0, 2)
  const tier2 = picks.slice(2, 6)
  const tier3 = picks.slice(6)
  // 문의 모달을 연 카드 번호(0-base). null 이면 닫힌 상태.
  const [asking, setAsking] = useState(null)

  // 하단 고정 CTA — 문의 입구는 이거 하나다. 카드는 읽는 물건이고, 들어오는 문은 아래에 있다.
  const openAll = () => {
    setAsking('all')
    ev?.('psc_inquiry_open', { all: true })
  }

  return (
    <div style={{
      // 양쪽 여백을 줄여 카드에 넘긴다. 아래는 고정 CTA 바가 깔리는 만큼 비워 둔다 —
      // 안 그러면 바가 푸터(회사 정보)를 영영 가린다.
      minHeight: '100vh', padding: picks.length ? '40px 12px 96px' : '40px 12px 28px',
      background: `radial-gradient(900px 420px at 50% -60px, #FFF8F3 0%, rgba(255,248,243,0) 60%), ${T.paper}`,
    }}>
      {/* 2·4·4 배치의 폭. 가운데·아래 단이 네 칸이라 폭이 곧 카드 폭이다 —
          1320 이면 한 칸이 318px 였고, 1560 이면 378px 로 올라간다. 추천 이유와
          관련 경험이 들어가면서 318px 로는 줄마다 말줄임이 생겼다.
          화면이 더 좁으면 컨테이너가 알아서 줄어든다(maxWidth 라서). */}
      <div style={{ maxWidth: 1560, margin: '0 auto' }}>
        <Mark />

        {/* 머리 — 보고서의 표지에 해당한다. 눈썹 라벨 · 제목 · 한 줄 요약 · 가로선.
            선 하나가 '여기까지가 표지, 아래가 본문'을 말해서 카드가 갑자기 시작되지 않는다. */}
        <div style={eyebrow}>{co ? `${co} 인재 추천 결과` : '인재 추천 결과'}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {/* 제목은 우리가 한 일이 아니라 상대가 얻는 것으로 쓴다. "10분을 골랐습니다"는
              우리 작업 보고이고, "찾으시는 웹앱 개발자, 이 10명 안에 있습니다"는 고객사가
              이 화면을 열면서 머릿속에 들고 있던 물음에 대한 답이다.
              단정해서 말한다 — "있을 겁니다"로 흐리면 우리가 고른 열 명을 우리가 못 믿는
              것으로 읽힌다. */}
          <H>
            {picks.length
              ? (<>
                찾으시는 {criteria?.title || '인재'},{' '}
                <span style={{ color: T.brand }}>이 {picks.length}명 안에 있습니다</span>
              </>)
              : '조건에 맞는 분을 찾지 못했습니다'}
          </H>
          <button type="button" onClick={onBack} style={{
            marginLeft: 'auto', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            color: T.body, background: '#fff', border: `1px solid ${T.line}`,
            borderRadius: 100, padding: '7px 14px', cursor: 'pointer', boxShadow: T.sm,
          }}>다른 JD로 다시</button>
        </div>
        {/* 무엇을 보고 골랐는지 — 조건 상자를 결과 화면에서 뺀 자리를 이 한 줄이 메운다.
            문장이 아니라 배지인 이유는, 여기서 필요한 건 다시 읽는 게 아니라 "아 그 조건"
            하고 알아보는 것뿐이라서다. 매칭에 실제로 쓴 값만 올린다(추정 요건은 안 올린다). */}
        {!!picks.length && <Keywords c={criteria} />}

        {/* 조건 상자는 로딩 화면에만 둔다. 여기서는 다섯 장이 주인공인데, 조건이 위에
            자리를 잡으면 첫 화면에 카드 세 장만 걸리고 나머지 둘이 접힌 아래로 밀린다 —
            "5명을 골랐습니다"라고 해 놓고 다섯을 못 보게 하는 셈이다.
            조건은 이미 기다리는 동안 읽었다. */}

        {/* 기준을 넘은 사람이 5명이 안 되면 아래에서 채웠다는 걸 밝힌다 — 안 밝히면
            다섯 장이 다 같은 무게로 읽힌다. */}
        {picks.length > data.passed && (
          <div style={{
            fontSize: 12.5, color: T.body, marginTop: 16, lineHeight: 1.7,
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12,
            padding: '10px 14px', boxShadow: T.sm,
          }}>
            조건을 다 만족하는 분은 {data.passed}명이라, 나머지는 가장 가까운 순으로 채웠습니다
            {' — 카드에 '}<span style={{ color: '#B42318', fontWeight: 700 }}>일부 미달</span>{'로 표시했습니다.'}
          </div>
        )}

        <div style={{ height: 1, background: T.line, marginTop: 22 }} />

        {/* 세 단 — 1·2등 / 3~6등 / 7~10등. 열 수가 커질수록 칸이 좁아지므로 카드도 같이
            줄인다(size). 열 개를 같은 크기로 두 줄에 깔면 순위가 아무 말도 안 하고,
            반대로 열 개를 다 크게 그리면 한 화면에 안 들어와서 비교가 안 된다.

            6등부터가 작아지는 건 자리가 없어서만은 아니다. 다섯 칸이면 한 칸이 227px 라
            지금 카드를 그대로 넣으면 주요이력·기술이 죄다 잘리는데, 잘린 카드는 보여 준
            게 아니다. 그래서 그 단은 내용부터 줄인다 — 사진·직무·경력·어학·기술 한 줄.
            더 볼 것은 눌러서 본다. */}
        {!!tier1.length && (
          <div className="psc-g psc-g1">
            {tier1.map((p, i) => (
              /* 카드를 여는 것과 문의를 접수하는 것은 다른 일이다. 모달은 언제나 열린다 —
                 저장소가 준비됐는지로 화면을 잠그면, 화면을 만드는 동안 화면을 볼 수가 없다.
                 접수가 되느냐는 보낼 때 판가름난다(InquiryModal.send). */
              <Card key={i} p={p} no={i + 1} />
            ))}
          </div>
        )}
        {!!tier2.length && (
          <div className="psc-g psc-g2">
            {tier2.map((p, i) => (
              <Card key={i} p={p} no={i + 3} />
            ))}
          </div>
        )}
        {!!tier3.length && (
          <div className="psc-g psc-g3">
            {tier3.map((p, i) => (
              <Card key={i} p={p} no={i + 7} />
            ))}
          </div>
        )}

        <style jsx>{`
          .psc-g { display: grid; gap: 16px; margin-top: 18px; }
          /* 1·2등은 가운데로 몰아 조금 좁힌다. 1200 을 둘로 나누면 한 칸이 592px 라
             카드 안이 휑해진다. */
          .psc-g1 { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 1060px; margin-left: auto; margin-right: auto; }
          .psc-g2 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .psc-g3 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

          /* 좁아지면 단을 푼다. 5열을 붙들고 있으면 한 칸이 150px 밑으로 내려간다. */
          @media (max-width: 1180px) {
            .psc-g1 { max-width: none; }
            .psc-g2, .psc-g3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          }
          @media (max-width: 860px) {
            .psc-g2, .psc-g3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 580px) {
            .psc-g1, .psc-g2, .psc-g3 { grid-template-columns: 1fr; }
          }

          /* 하단 고정 CTA — 스타일이 여기 있는 건 styled-jsx 가 한 컴포넌트에 블록 두 개를
             중첩으로 보고 거부해서다. 클래스 스코프는 컴포넌트 단위라 위치는 상관없다. */
          .psc-bar {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
            background: rgba(255,255,255,.92); backdrop-filter: blur(8px);
            border-top: 1px solid ${T.line};
          }
          .psc-bar-in {
            max-width: 1560px; margin: 0 auto; padding: 11px 16px;
            display: flex; align-items: center; justify-content: center; gap: 18px;
          }
          .psc-bar-msg { font-size: 13.5px; color: ${T.body}; letter-spacing: -0.01em; }
          .psc-bar-btn {
            font-family: inherit; font-size: 14px; font-weight: 700; color: #fff;
            background: ${T.brand}; border: 0; border-radius: 100px; padding: 11px 22px;
            cursor: pointer; box-shadow: 0 2px 8px rgba(255,96,0,.18);
          }
          @media (max-width: 640px) {
            .psc-bar-msg { display: none; }
            .psc-bar-btn { width: 100%; }
          }
        `}</style>
      </div>

      {asking != null && (
        <InquiryModal
          sid={data.sid}
          picks={picks}
          first={asking === 'all' ? null : asking}
          co={co}
          ev={ev}
          onClose={() => setAsking(null)}
        />
      )}

      <CorpFooter style={{ marginTop: 56 }} />

      {/* 하단 고정 CTA — 카드는 요약이라, 잘 읽힐수록 다음 욕구는 '원문'이 된다.
          그 순간에 "누구로 문의할지"부터 고르게 하지 않으려고 페이지 전체에 하나를 둔다.
          카드별 버튼은 보조 경로로 남긴다 — '이 사람'이 꽂힌 쪽에는 그게 최단이다. */}
      {!!picks.length && (
        <div className="psc-bar">
          <div className="psc-bar-in">
            <span className="psc-bar-msg">카드는 요약입니다 — 이력서 원문까지 확인해 보세요</span>
            <button type="button" className="psc-bar-btn" onClick={openAll}>
              {picks.length}분의 이력서 받아보기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* 상담 문의 — 이 화면이 존재하는 이유. 여기까지 와서 할 수 있는 게 "다른 JD로 다시"뿐이면
   다섯 장을 아무리 잘 골라도 대화가 시작되지 않는다.

   누른 한 명으로 열리되 나머지 넷을 체크로 같이 담을 수 있게 둔 건, 셋이 마음에 들었을 때
   폼을 세 번 채우게 하면 두 번째부터는 안 하기 때문이다.

   칸은 다섯 개뿐이다. 여기서 받을 것은 채용의뢰서가 아니라 '연락할 방법'이고, 나머지는
   미팅에서 물으면 된다 — 칸이 하나 늘 때마다 여기서 사람이 빠져나간다. */
/* 상담 시간대 — 30분 단위로 근무시간만. 새벽 두 시를 고를 수 있게 두면 고르는 사람도
   받는 사람도 곤란해진다. */
const TIMES = ['10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']
// 오늘 이전은 못 고르게. 모달은 눌러야 뜨므로 서버에서 그릴 일이 없어 여기서 바로 만든다.
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function InquiryModal({ sid, picks, first, co, ev, onClose }) {
  /* first 가 없으면(하단 고정 CTA) '이력서 원문' 문의다 — 특정 후보를 고르게 하지 않고,
     안 고르면 전원으로 접수한다. 원문은 개인정보라 미팅에서 보여준다는 것이 이 흐름의 약속. */
  const all = first == null
  const [picked, setPicked] = useState(all ? [] : [first])
  const [name, setName] = useState('')
  const [company, setCompany] = useState(co || '')
  /* 이메일과 전화번호를 한 칸으로 합쳤다. 칸이 하나 늘 때마다 여기서 사람이 빠져나가는데,
     정작 우리가 필요한 건 '연락할 방법 하나'다. 둘 다 받아 봐야 한쪽만 쓴다.
     보낼 때 @ 가 있으면 이메일, 아니면 연락처로 갈라 준다 — 서버는 그대로 두고. */
  const [contact, setContact] = useState('')
  /* 시간대를 여러 개 받는다. 하나만 받으면 그 시간이 우리 쪽에서 안 될 때 다시 메일을
     주고받아야 하는데, 두세 개를 미리 받아 두면 그 왕복이 통째로 없어진다.
     셋에서 막는다 — 더 받아 봐야 우리가 다 확인하지 않는다. */
  const [slots, setSlots] = useState([{ date: '', time: '' }])
  const [today] = useState(todayStr)
  const setSlot = (i, patch) => setSlots((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const [memo, setMemo] = useState('')
  const [hp, setHp] = useState('') // 함정칸 — 사람 눈에는 안 보인다
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [more, setMore] = useState(false)       // '함께 문의할 인재 추가하기' 목록을 펴 뒀나
  const [preview, setPreview] = useState('') // 접수 실패 사유(개발 중에만). 빈 문자열이면 정상 접수
  const [err, setErr] = useState('')
  const openedAt = useRef(Date.now())

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /* 담고 빼는 것 자체는 안 남긴다 — 마음을 바꾼 횟수는 로그를 채우기만 하고, 정작
     알고 싶은 '결국 누구를 골랐나'는 보낼 때(psc_meeting.picks) 한 번에 남는다.
     열어만 보고 안 보낸 사람도 psc_inquiry_open 과의 차이로 그대로 세어진다. */
  const toggle = (i) => setPicked((prev) => (
    prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)
  ))

  const ok = name.trim() && company.trim() && contact.trim() && (all || picked.length)

  const send = async () => {
    if (!ok || busy) return
    setBusy(true); setErr('')
    // '이력서 원문' 문의에서 아무도 안 골랐으면 전원이다 — 서버는 빈 목록을 안 받고,
    // 안 골랐다는 건 "이 10명"이라는 뜻이지 "아무도"가 아니다.
    const chosen = all && !picked.length ? picks.map((_, i) => i) : picked
    // 채운 줄만 보낸다. "2026-08-07 14:00, 2026-08-08 10:30" 꼴이다.
    const when = slots.map((x) => [x.date, x.time].filter(Boolean).join(' ')).filter(Boolean).join(', ')
    try {
      if (!sid) throw new Error('검색 정보가 없습니다')
      const r = await fetch('/api/private/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sid, picked: chosen, name, company, memo, hp, t: openedAt.current,
          when,
          email: contact.includes('@') ? contact.trim() : '',
          phone: contact.includes('@') ? '' : contact.trim(),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '문의를 접수하지 못했습니다')
      setDone(true)
      /* 이 화면 전체의 결론. 연락처·이름·회사·남긴 말은 절대 안 싣는다 — 그건 문의
         자체에 이미 담겨 우리에게 오고, events 는 클라이언트도 쓰는 테이블이다.
         카드 번호는 남긴다. 몇 명이 아니라 '몇 번 카드가 골라지나'가 다음 화면을
         고칠 근거다(1·2번만 골린다면 아래 세 장은 안 읽히고 있는 것이다).
         all 은 하단 CTA 로 들어온 문의인지 — 두 흐름이 같은 이벤트를 쓰게 됐다. */
      ev?.('psc_meeting', { n: chosen.length, picks: chosen, when: when || null, memo: !!memo.trim(), all })
    } catch (e) {
      /* 화면을 먼저 만들고 접수를 나중에 붙이는 중이라, 개발 중에는 실패해도 완료 화면까지
         넘어간다 — 그러지 않으면 마지막 화면을 만드는 동안 마지막 화면을 볼 수가 없다.
         프로덕션에서는 절대 안 넘긴다. 접수가 안 됐는데 "접수되었습니다"를 보여주면
         고객사는 연락을 기다리고 우리는 문의가 온 줄도 모른다 — 링크를 보낸 의미가 사라진다. */
      if (process.env.NODE_ENV === 'development') { setPreview(e.message); setDone(true) }
      else {
        setErr(e.message)
        // 여기서 죽으면 고객사는 미팅을 신청했다고 믿는데 우리에게는 아무것도 안 온다.
        // 그 상태를 우리가 모르는 게 최악이라, 실패만큼은 반드시 남긴다.
        ev?.('psc_meeting_fail', { n: chosen.length, message: String(e.message || '').slice(0, 120) })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(12,16,22,0.5)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 470, maxHeight: '90vh', overflowY: 'auto',
          background: '#fff', borderRadius: 20, padding: '28px 26px 24px', boxShadow: T.lg,
        }}
      >
        {done ? (
          /* 접수 후 — 다음에 무슨 일이 일어나는지만 말한다. 여기서 또 뭔가를 시키면
             방금 연락처를 준 사람에게 숙제를 하나 더 주는 셈이다. */
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: T.ink, letterSpacing: -0.4 }}>
              문의가 접수되었습니다
            </div>
            {/* 개발 중에만 뜬다 — 이 화면이 진짜인지 미리보기인지 헷갈리면 안 된다 */}
            {preview && (
              <div style={{
                fontSize: 11.5, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 8, padding: '7px 10px', marginTop: 10, lineHeight: 1.6,
              }}>
                {/* 원인을 단정하지 않는다. 표가 없어서일 수도, 검색 기록이 없어서일 수도,
                    그냥 네트워크일 수도 있는데 하나를 박아 두면 엉뚱한 데를 보게 된다. */}
                미리보기 — 실제로 접수되지 않았습니다: {preview}
              </div>
            )}
            {/* 원문은 미팅에서 — 접수 화면이 "이력서를 보내드립니다"라고 하면
                방금 모달이 한 약속(개인정보라 미팅에서만)을 스스로 뒤집는다. */}
            <div style={{ fontSize: 13.5, color: T.mute, marginTop: 10, lineHeight: 1.7 }}>
              영업일 기준 1일 안에 {contact.includes('@') ? '메일로 ' : ''}연락드려 미팅 일정을 잡아드리겠습니다.<br />
              이력서 원문은 미팅에서 직접 보여드립니다.
            </div>
            <button type="button" onClick={onClose} style={{ ...primaryBtn, marginTop: 24, background: T.ink }}>
              닫기
            </button>
          </>
        ) : (
          <>
            <div style={eyebrow}>상담 문의</div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: T.ink, letterSpacing: '-0.03em',
              lineHeight: 1.45, marginTop: 8,
            }}>
              {all
                ? (<>이력서 원문은 미팅에서<br />직접 보여드립니다</>)
                : (<>이 인재로 채용 상담을<br />문의하시겠습니까?</>)}
            </div>

            {/* 원문을 메일로 안 보내는 이유를 먼저 말한다 — 안 밝히면 '받아보기'를 눌렀는데
                미팅을 잡자고 하는 셈이라, 낚인 기분이 든다. */}
            {all && (
              <div style={{ fontSize: 13, color: T.body, marginTop: 10, lineHeight: 1.7 }}>
                이력서 원문은 개인정보 보호를 위해 대면 미팅으로만 공유하고 있습니다.
                연락처를 남겨주시면 영업일 1일 안에 일정을 잡아드립니다.
              </div>
            )}

            {/* 누른 한 명 */}
            {!all && (
              <div style={{
                marginTop: 18, border: `1px solid ${T.brandLine}`, background: T.brandSoft,
                borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9,
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: T.brand }}>#{first + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, ...oneLine }}>
                  {picks[first]?.title || '직무 미상'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.faint, flexShrink: 0 }}>
                  적합 {picks[first]?.fit}
                </span>
              </div>
            )}

            {/* 나머지 — 한 번에 담을 수 있게. 다만 접어 둔다: 후보가 10명이면 이 목록이
                아홉 줄이라, 펴 두면 정작 채워야 할 연락처 칸이 화면 밖으로 밀린다.
                고른 수는 접힌 채로도 보여야 한다 — 접힌 곳에 든 것을 모르면 접은 게 아니라
                숨긴 것이 된다.
                원문 문의에서는 고르는 것 자체가 선택이다 — 문턱은 낮추되, 골랐다면 그게
                "어느 카드가 팔리나"의 신호라 그대로 접수에 싣는다. */}
            {picks.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => setMore((v) => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'inherit', fontSize: 11.5, color: T.mute, background: 'none',
                    border: 0, padding: '2px 0 7px', cursor: 'pointer', textAlign: 'left',
                  }}>
                  {/* 화살표가 앞이다. 뒤에 있으면 줄 끝까지 눈이 갔다 와야 접힌 줄인 줄
                      아는데, 앞에 있으면 읽기 전에 안다. */}
                  <span style={{ color: T.faint, fontSize: 9 }}>{more ? '▲' : '▼'}</span>
                  <span>{all ? '특히 관심 있는 인재 고르기 (선택)' : '함께 문의할 인재 추가하기'}</span>
                  <span style={{ color: T.faint }}>{all ? picks.length : picks.length - 1}</span>
                  {picked.length > (all ? 0 : 1) && (
                    <span style={{ color: '#ff6000', fontWeight: 700 }}>
                      {all ? `${picked.length} 선택` : `+${picked.length - 1} 선택`}
                    </span>
                  )}
                </button>
                <div style={{ display: more ? 'flex' : 'none', flexDirection: 'column', gap: 5 }}>
                  {picks.map((p, i) => (!all && i === first) ? null : (
                    <label key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      border: `1px solid ${picked.includes(i) ? T.ink : T.line}`,
                      borderRadius: 9, padding: '7px 10px',
                    }}>
                      <input type="checkbox" checked={picked.includes(i)} onChange={() => toggle(i)}
                        style={{ accentColor: '#ff6000', width: 14, height: 14, flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: T.faint, flexShrink: 0 }}>#{i + 1}</span>
                      <span style={{ fontSize: 12.5, color: T.body, minWidth: 0, ...oneLine }}>
                        {p.title || '직무 미상'}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#C6CCD3', flexShrink: 0 }}>{p.fit}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="담당자 성함" style={inputStyle} />
              <input value={company} onChange={(e) => setCompany(e.target.value)}
                placeholder="회사명" style={inputStyle} />
              <input value={contact} onChange={(e) => setContact(e.target.value)}
                placeholder="이메일 또는 전화번호" style={inputStyle} />
            </div>

            {/* 날짜는 달력에서, 시간은 목록에서 고른다. "이번 주 / 오후" 같은 칩으로 받으면
                결국 우리가 다시 전화해서 날을 잡아야 한다 — 여기서 하루라도 좁혀 두면
                첫 연락이 "언제 괜찮으세요"가 아니라 "그때로 잡았습니다"가 된다.
                브라우저 기본 달력을 쓴다. 직접 그리면 이 화면 하나 때문에 달력 부품을
                들이게 되는데, 여기서 필요한 건 날짜 한 개뿐이다. */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, color: T.mute, marginBottom: 7 }}>편하신 상담 일시 (선택)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {slots.map((sl, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" value={sl.date} min={today}
                      onChange={(e) => setSlot(i, { date: e.target.value })}
                      style={{ ...inputStyle, flex: 1, minWidth: 0, colorScheme: 'light' }} />
                    <select value={sl.time} onChange={(e) => setSlot(i, { time: e.target.value })}
                      style={{ ...inputStyle, width: 108, flexShrink: 0, cursor: 'pointer' }}>
                      <option value="">시간</option>
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {/* 첫 줄에는 지우기를 안 단다 — 다 지우면 칸이 사라져서 다시 못 연다 */}
                    {slots.length > 1 && (
                      <button type="button" onClick={() => setSlots((a) => a.filter((_, j) => j !== i))}
                        aria-label="이 시간 지우기"
                        style={{
                          fontFamily: 'inherit', fontSize: 15, lineHeight: 1, color: T.faint,
                          background: 'none', border: 0, padding: '0 2px', cursor: 'pointer', flexShrink: 0,
                        }}>×</button>
                    )}
                  </div>
                ))}
                {slots.length < 3 && (
                  <button type="button" onClick={() => setSlots((a) => [...a, { date: '', time: '' }])}
                    style={{
                      alignSelf: 'flex-start', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                      color: T.body, background: 'none', border: 0, padding: '2px 0', cursor: 'pointer',
                    }}>+ 다른 시간도 추가</button>
                )}
              </div>
            </div>

            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2}
              placeholder="남기실 말씀 (선택)"
              style={{ ...inputStyle, marginTop: 12, resize: 'none', lineHeight: 1.6 }} />

            {/* 함정칸 — 봇만 채운다. 사람에게는 안 보이고 탭으로도 안 걸린다. */}
            <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off"
              aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />

            {!!err && <div style={{ fontSize: 12.5, color: '#DC2626', marginTop: 10 }}>{err}</div>}

            <button type="button" onClick={send} disabled={!ok || busy}
              style={{
                ...primaryBtn, marginTop: 18,
                background: ok && !busy ? T.brand : '#D6DBE1',
                boxShadow: ok && !busy ? '0 2px 8px rgba(255,96,0,.18)' : 'none',
              }}>
              {busy ? '보내는 중…'
                : all && !picked.length ? '미팅 요청하기'
                : `${picked.length}분으로 상담 요청하기`}
            </button>
            <button type="button" onClick={onClose}
              style={{
                width: '100%', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: T.mute,
                background: 'none', border: 0, padding: '10px 0 0', cursor: 'pointer',
              }}>
              다시 보기
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', fontFamily: 'inherit', fontSize: 13.5, color: T.ink,
  padding: '11px 13px', borderRadius: 10, border: `1px solid ${T.line}`,
  outline: 'none', background: '#fff',
}

const primaryBtn = {
  width: '100%', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff',
  border: 0, borderRadius: 12, padding: '13px 0', cursor: 'pointer',
}

/* 인재 카드 — 어드민 인재풀 카드와 같은 행 구성(경력·학력·주요이력·외국어·포폴·기술)이되
   이름 자리에 직무가 온다. 행을 항상 렌더하고 높이를 고정하는 것도 같은 이유다:
   카드마다 행이 들쭉날쭉하면 다섯 명을 나란히 비교할 수가 없다. */
const oneLine = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
/* 칩은 두 줄까지 흐른다. 한 줄로 자르면 "+31" 이 붙는데, 그 31 개 중에 고객사가 찾던
   기술이 들어 있어도 알 길이 없다 — 세로를 줄여 번 자리를 여기에도 쓴다.
   두 줄에서 멈추는 건 카드마다 기술 개수가 달라서다. 안 막으면 스킬을 40개 적은 사람의
   카드만 혼자 길어진다. */
const chipRow = {
  display: 'flex', gap: 6, flexWrap: 'wrap', alignContent: 'flex-start',
  maxHeight: 61, overflow: 'hidden', // 28px 두 줄 + 간격 5px
}



/* 금액은 하단 버튼에 붙는다.

   사진 오른쪽에 세로로 세웠더니 이름 폭을 먹었다 — 카드가 318px 까지 좁아지는데
   사진(64) + 금액(92) 을 빼면 이름에 남는 자리가 90px 도 안 돼서 직무명이 통째로
   잘렸다. 제 줄을 주면 안 잘리지만 카드가 열 장이라 세로가 40px × 10 만큼 늘어난다.

   버튼 안이면 자리를 하나도 안 먹으면서, 상담으로 넘어가기 직전에 보이는 자리다 —
   비용을 확인하고 누르는 것과 누른 뒤에 아는 것은 다른 일이다. */
/* 예상 단가 — 카드 오른쪽에 붙은 포스트잇.

   띠로 깔거나 버튼에 넣어 봤는데 둘 다 '카드의 한 줄'이 되어서, 읽히기는 해도 눈에
   먼저 들어오지는 않았다. 종이 한 장을 덧붙인 모양이면 카드 위에 얹힌 것으로 보여서
   먼저 읽힌다 — 고객사가 카드에서 두 번째로 묻는 것이 이 값이다.

   위치는 이름 오른쪽. 그래서 경력·어학은 아래 한 줄로 내렸다(Card 참고) — 그 자리에
   두면 스티커와 부딪힌다. */

/* 예상 월 비용 — 연차 구간으로 정해진 표다. 사람마다 다른 값이 아니라 구간 값이라
   카드에 바로 띄울 수 있다.

   5년차 이상을 숫자로 안 적는 이유: 그 위로는 사람마다 폭이 커서 하나로 못 묶는다.
   억지로 한 숫자를 적으면 실제 협의에서 그 숫자가 먼저 기준이 되어 버린다.
   연차 미상도 같은 칸으로 보낸다 — 모르는 것을 '신입 99만원'으로 내려 잡으면
   싸 보이게 만들어 놓고 나중에 말을 바꾸는 셈이다. */
const COST = [
  { under: 1, label: '신입', won: 99 },
  { under: 3, label: '1~3년차', won: 149 },
  { under: 5, label: '3~5년차', won: 199 },
]
const costOf = (yoe) => (yoe == null ? null : COST.find((x) => yoe < x.under) || null)
const priceText = (yoe) => {
  const c = costOf(yoe)
  return c ? `예상 단가 ${c.won}만원/월` : '예상 단가 별도 협의'
}

function Card({ p, no }) {
  /* 1·2등은 왼쪽에 시상대를 붙인다. 열 장이 똑같이 서 있으면 순서가 안 읽히고, 그러면
     우리가 매긴 순위가 아무 말도 못 한다. 카드 안쪽 구성은 나머지 여덟 장과 똑같이
     둔다 — 앞의 둘만 다른 걸 보여주면 비교가 안 된다. */
  /* 직무명이 두 줄로 접힐 만큼 길면 경력·어학을 한 줄에 붙인다. 그래야 카드 높이가
     제목 길이를 따라 들쭉날쭉해지지 않는다 — 열 장을 나란히 비교하는 화면이라 높이가
     맞아야 한다.
     너비를 재지 않고 글자 수로 어림하는 건, 재려면 ref 와 관찰자가 필요한데 그 값이
     카드 폭마다(378/452px) 다시 달라져서다. 한글은 라틴 글자의 두 배 폭으로 세고,
     30 은 378px 카드의 한 줄에 들어가는 양이다. */
  const titleW = [...(p.title || '')].reduce((n, ch) => n + (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(ch) ? 2 : 1), 0)
  const tightMeta = titleW > 30

  const top = no <= 2
  const medal = no === 1
    ? { line: '#FFD9A8', from: '#FFF6E8', to: '#FFE9C9' }
    : { line: '#DFE3E8', from: '#F7F8FA', to: '#EBEEF2' }
  return (
    <div
      style={{
        position: 'relative', display: 'flex', flexDirection: 'row',
        background: '#fff', borderRadius: 18,
        border: `1px solid ${top ? medal.line : T.line}`,
        boxShadow: top ? T.md : T.sm,
      }}
    >
      {/* 시상대 — 폭을 비율로 잡는다. 카드가 452px 일 때도 318px 일 때도 같은 인상이어야
          하는데, 고정폭으로 두면 좁은 칸에서 트로피가 카드를 반쯤 먹는다. */}
      {top && (
        <div style={{
          width: '19%', minWidth: 70, maxWidth: 104, flexShrink: 0,
          background: `linear-gradient(160deg, ${medal.from} 0%, ${medal.to} 100%)`,
          borderRight: `1px solid ${medal.line}`,
          borderRadius: '17px 0 0 17px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* trophy.png 는 금·은이 한 장에 나란히 들어 있는 1536×1024 이다. 두 장으로
              나누지 않고 배경으로 깔아 반쪽씩 쓴다 — 파일이 하나면 요청도 하나다.
              배경 크기를 200%×100% 로 두면 칸 너비의 두 배가 깔리므로 왼쪽 절반이 금,
              오른쪽 절반이 은이 된다. 칸의 가로세로비를 반쪽 비율(0.742)에 맞춰 놨으니
              늘어나지 않는다.
              multiply: 원본 배경이 흰색이라 그대로 얹으면 패널 위에 흰 사각형이 뜬다.
              곱하기로 깔면 흰색이 아래 색을 그대로 통과시켜 오려낸 것처럼 보인다. */}
          <div aria-hidden="true" style={{
            width: '86%', aspectRatio: '0.742',
            backgroundImage: 'url(/trophy.png)',
            backgroundSize: '200% 100%',
            backgroundPosition: no === 1 ? '0% 50%' : '100% 50%',
            backgroundRepeat: 'no-repeat',
            mixBlendMode: 'multiply',
          }} />
        </div>
      )}

      <div style={{ padding: '22px 22px 18px', minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 머리줄 — 왼쪽 순위, 오른쪽 우대·적합점수. 카드에서 숫자만 있는 유일한 줄이다. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {/* 순위 — 이 화면에서 이 사람을 부를 수 있는 유일한 이름이다. 문의·메일·미팅이
              전부 이 번호를 쓴다(이름은 미팅에서야 건넨다). */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: '50%',
            fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em',
            ...(top
              ? { background: T.brand, color: '#fff', boxShadow: '0 1px 4px rgba(255,96,0,.22)' }
              : { background: '#F1F5F9', color: '#64748B' }),
          }}>{no}</span>

          {/* 우대 충족 — 카드 순서를 정하는 값이라 점수와 나란히 세운다. 점수에 섞지 않은
              이유는 lib/jdMatch 에 있다(섞으면 낮은 점수가 위에 서는 일이 생긴다).
              하나도 못 채웠으면 아예 안 단다 — "우대 0/2" 는 우리가 골라 보내 드린 사람
              위에 0 을 붙여 놓는 꼴이다. */}
          {!!p.pref && (
            <span title="기업이 적은 우대사항 중 충족한 개수 — 이 순서를 정하는 값입니다" style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              color: '#0B7A6E', background: '#EEFAF7', border: '1px solid #CDEDE6',
            }}>우대 {p.pref}/{p.prefTotal}</span>
          )}

          {/* 적합점수 — 요건 충족률과 이력서 자체를 합쳐 코드가 낸 값(0~100) */}
          <span title={`자격요건 ${p.met}/${p.total} 충족 · ${p.rank}급`}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.brand }}>적합</span>
            <span style={{
              fontSize: 24, fontWeight: 800, color: T.brand, letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>{p.fit}</span>
          </span>
        </div>

        {/* 사진 왼쪽 · 오른쪽에 직무·경력·어학 세 줄. 직무를 사진 위 한 줄로 빼 봤는데,
            사진 오른쪽이 통째로 비어서 카드가 그만큼 길어졌다. 세 줄을 옆에 세우면
            같은 정보에 세로가 60px 넘게 덜 든다 — 열 장이라 그 차이가 크다. */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          {p.photo
            ? <img src={p.photo} alt="" referrerPolicy="no-referrer" style={{
                width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                boxShadow: `0 0 0 3px #fff, 0 0 0 4px ${top ? medal.line : T.line}, 0 6px 16px rgba(16,24,40,.12)`,
              }} />
            : <div style={{
                width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(180deg,#F7F8FA 0%,#EFF2F5 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#C6CCD3',
                boxShadow: `0 0 0 3px #fff, 0 0 0 4px ${top ? medal.line : T.line}`,
              }}>👤</div>}

          <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
            {/* 이름을 감춘 화면이라 이 줄이 사실상 이 사람의 이름이다. 두 줄까지 접는다 —
                한 줄로 자르면 "Senior Frontend Engineer" 가 통째로 말줄임이 된다. */}
            <div title={p.title} style={{
              fontSize: 15.5, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em',
              lineHeight: 1.35,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{p.title || '직무 미상'}</div>

            <div style={{
              display: 'flex', marginTop: 6, minWidth: 0,
              ...(tightMeta
                ? { flexDirection: 'row', alignItems: 'baseline', gap: 10 }
                : { flexDirection: 'column', gap: 3 }),
            }}>
              <span style={{ fontSize: 13, color: '#64748B', flexShrink: 0 }}>
                경력 <span style={{ fontWeight: 700, color: '#334155' }}>
                  {p.yoe == null ? '미상' : p.yoe === 0 ? '신입' : `${p.yoe}년`}
                </span>
              </span>
              <span style={{ fontSize: 12.5, color: '#64748B', minWidth: 0, ...oneLine }}
                title={[p.english, p.korean].filter(Boolean).join(' / ')}>
                {p.english || p.korean ? (<>
                  {p.english && <><span style={{ color: T.brand, fontWeight: 700, marginRight: 5 }}>영어</span>{p.english}</>}
                  {p.english && p.korean && <span style={{ color: '#D6DBE1' }}> · </span>}
                  {p.korean && <><span style={{ color: T.brand, fontWeight: 700, marginRight: 5 }}>한국어</span>{p.korean}</>}
                </>) : <span style={{ color: T.faint }}>어학 기재 없음</span>}
              </span>
            </div>

            {/* 5명을 채우려고 기준 아래에서 데려온 사람만 표시한다 — 같은 무게로 읽히면 안 된다. */}
            {p.rank === '탈락' && (
              <div title={`요건 ${p.met}/${p.total} 충족`} style={{
                display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#B42318',
                background: '#FEF3F2', border: '1px solid #FEE4E2', borderRadius: 6,
                padding: '2px 8px', marginTop: 6,
              }}>조건 일부 미달</div>
            )}
          </div>
        </div>

        {/* 왜 이 사람인지 — 다섯 장을 훑을 때 실제로 읽는 문장이다. 상자에 넣지 않는다:
            카드 안에 카드가 겹치는 모양이 되고, 이 화면에서 유일하게 '읽는' 글이라
            본문처럼 놓이는 게 맞다. */}
        {!!p.why && (
          <div style={{
            fontSize: 13, color: T.body, lineHeight: 1.65, marginBottom: 14,
            background: T.brandSoft, borderLeft: `2px solid ${T.brandLine}`,
            borderRadius: '0 10px 10px 0', padding: '11px 13px',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{p.why}</div>
        )}

        {/* 관련 경험 — 파서가 이력서에서 뽑아 둔 세 줄. 추천 이유가 '이 자리와 어디가
            맞나'라면 이쪽은 '이력서에 실제로 뭐가 적혀 있나'다. 우리가 쓴 문장 하나만
            두면 결국 우리 말만 믿으라는 화면이 된다. */}
        {!!p.bullets?.length && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...eyebrow, fontSize: 9.5, marginBottom: 6 }}>관련 경험</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p.bullets.map((b, i) => (
                <div key={i} title={b} style={{ display: 'flex', gap: 7, fontSize: 12.5, lineHeight: 1.5, color: '#475569' }}>
                  <span style={{
                    flexShrink: 0, width: 3, height: 3, borderRadius: '50%',
                    background: T.brandLine, marginTop: 8,
                  }} />
                  <span style={{ minWidth: 0, ...oneLine }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 기술 — 라벨을 뗐다. 칩 모양 자체가 기술이라고 말한다.
            기준(화면 위 배지)에 걸린 것만 표시를 다르게 한다. 걸린 것들은 서버에서
            앞으로 당겨 보내므로 잘려서 안 보이는 일은 없다. */}
        {!!p.skills.length && (
          <div style={{ ...chipRow, marginTop: 'auto', marginBottom: 14 }}>
            {p.skills.map((s) => {
              const hit = (p.hits || []).includes(s)
              return (
                <span key={s} title={hit ? '요청하신 조건에 있는 기술입니다' : undefined} style={{
                  fontSize: 12.5, lineHeight: '18px', padding: '5px 12px', borderRadius: 8,
                  whiteSpace: 'nowrap', flexShrink: 0,
                  ...(hit
                    ? { background: '#FFF3EC', color: T.brandInk, fontWeight: 700 }
                    : { background: '#F1F5F9', color: '#475569', fontWeight: 500 }),
                }}>{s}</span>
              )
            })}
            {!!p.skillsMore && (
              <span style={{ fontSize: 12, color: T.faint, flexShrink: 0, alignSelf: 'center' }}>+{p.skillsMore}</span>
            )}
          </div>
        )}

        {/* 예상 단가 — 문의 입구는 하단 고정 CTA 하나로 모았지만, 값은 여기서 확인하고
            내려가는 것이라 자리는 그대로 둔다.

            단가를 어디에 둘지 네 번 옮겼는데(사진 옆·제 줄·스티커) 카드 폭이
            378~452px 로 변해서 어느 자리에 둬도 이름이나 어학과 부딪혔다.
            여기는 폭과 무관하게 늘 한 줄이 비어 있는 자리다. */}
        <div style={{
          marginTop: 'auto', textAlign: 'center',
          fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.02em',
          padding: '11px 0', borderRadius: 10,
          color: T.body, background: '#F7F8FA', border: `1px solid ${T.line}`,
        }}>
          {priceText(p.yoe)}
        </div>
      </div>
    </div>
  )
}

/* ?c= 토큰 → 기업 이름. 서명 확인이 서버에서만 되므로(시크릿) 여기서 푼다.

   토큰이 없거나 가짜여도 페이지는 그냥 연다 — 지금 이 주소의 '비공개'는 인증이 아니라
   안 알려진 주소이고, 여기서 막으면 우리가 직접 붙여넣어 여는 링크까지 막힌다.
   토큰이 하는 일은 '누구에게 보낸 링크로 들어왔나'를 로그에 남기는 것뿐이다.
   나중에 기업마다 다른 후보를 보여주게 되면, 그때 이 자리에서 막으면 된다.

   서명이 맞아도 showcase_links 에 없으면(= 어드민에서 추적을 끊은 링크) 아무것도 안 남긴다.
   서명만으로는 회수가 안 되니, 표에 있느냐가 곧 '아직 세는 링크냐'다. 조회를 한 번 더
   하는 값으로 추적을 끝낼 수단을 얻는 셈이다. */
export async function getServerSideProps({ query }) {
  const v = query.c ? verifyToken(String(query.c)) : null
  if (!v) return { props: { co: null, campaign: null, off: false, c: null } }

  const { data } = await supabaseAdmin
    .from('showcase_links').select('token').eq('token', String(query.c)).maybeSingle()
  // 추적을 끊은 링크: 기업도 안 붙이고 이벤트도 안 보낸다. '직접'으로 세면 우리가 연 것과
  // 섞여서, 그만 보기로 한 링크가 익명 방문으로 되살아난다.
  // 토큰(c)도 안 넘긴다 — 검색 기록에도 기업이 안 붙는다. 다만 상담 문의는 그대로 받는다:
  // 추적을 끊은 것과 사람이 실제로 연락해 온 것은 다른 일이고, 기업명은 그 사람이 폼에 적는다.
  if (!data) return { props: { co: null, campaign: null, off: true, c: null } }

  return { props: { co: v.company, campaign: v.campaign, off: false, c: String(query.c) } }
}
