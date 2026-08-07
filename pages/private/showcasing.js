import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

/* 파일 첨부 — 당분간 감춘다(유저 결정). 첨부 칩과 함께 파일 얘기를 하는 문구도
   같이 내린다: 올릴 곳이 없는데 "PDF·DOCX까지 됩니다"가 남아 있으면 찾게 된다.
   읽는 쪽(onPick·extract)은 그대로 두고 이 한 줄만 true 로 되돌리면 다시 나온다. */
const FILE_UPLOAD = false

/* 경력 칩 — JD 만으로는 연차가 안 잡히는 경우가 많다. 실제 검색 기록을 보면 조건에서
   yoe_min·yoe_max 가 둘 다 null 로 나오는 JD 가 흔한데, 그러면 1차 거름망의 연차 항목이
   통째로 놀고(prefilterScore) 순위 단계도 "이 자리는 연차를 요구하지 않았다"로 돌아간다.
   담당자 머릿속에는 구간이 있는데 글에만 안 적힌 것뿐이라, 여기서 한 번 눌러 받는다.

   고르는 건 선택이다. 안 고르면 지금까지처럼 JD 에서 읽어낸 값을 쓴다 — 필수로 만들면
   "JD 붙여넣고 보내기" 한 동작이 두 동작이 된다.

   숫자는 여기 없다. 키만 서버로 보내고 연차 범위는 jd-criteria 가 정한다 — 로그인이 없는
   경로라 클라이언트가 보낸 숫자를 그대로 믿으면 아무 범위나 밀어 넣을 수 있다.
   라벨은 카드의 예상 단가 표(COST)와 같은 표기를 쓴다. 같은 구간을 두 이름으로 부르면
   고객사가 화면 안에서 그 둘을 잇지 못한다. */
const YOE_CHIPS = [
  { key: 'junior', label: '신입' },
  { key: '1-3', label: '1~3년차' },
  { key: '3-5', label: '3~5년차' },
  { key: '5+', label: '5년차+' },
]

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
  /* 고른 경력 구간(복수). 여러 개를 고르면 서버가 합집합으로 잡는다 — "신입도 좋고
     3~5년차도 좋다"는 실제로 흔한 요구다. 빈 배열이면 JD 에서 읽어낸 값을 쓴다. */
  const [yoe, setYoe] = useState([])
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
    // 고른 경력 구간도 남긴다 — 결과가 엉뚱할 때 JD 탓인지 구간 탓인지 갈린다.
    ev('psc_submit', { chars: jd.trim().length, file: !!file, yoe: yoe.length ? yoe : null })
    setErr(''); setCriteria(null); setResult(null); setStep('criteria')
    // 실패했을 때 어디서 멈췄는지. 로딩 화면은 두 번의 대기(조건 뽑기 → 이력서 훑기)를
    // 한 화면에서 보여줘서, 단계를 안 남기면 둘 중 어느 쪽이 문제인지 영영 모른다.
    let stage = 'criteria'
    try {
      const r1 = await fetch('/api/private/jd-criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, yoe }),
      })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.error || 'JD를 읽지 못했습니다')
      setCriteria(j1.criteria)
      setPool(j1.pool ?? null)
      setStep('match')
      stage = 'match'
      const matchStartedAt = Date.now() // 조건 상자가 뜬 시점 — 최소 체류 계산용
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
      // h 는 JD 원문의 해시 — 같은 JD 를 다시 돌리면 서버가 저장된 같은 결과를 돌려준다.
      const r2 = await fetch('/api/private/jd-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: j1.criteria, c: c || null, h: j1.h || null }),
      })
      const j2 = await r2.json()
      if (!r2.ok) throw new Error(j2.error || '후보를 찾지 못했습니다')
      /* 결과가 너무 빨리 오면(캐시) 조건 상자가 뜨자마자 화면이 바뀐다 — "이렇게
         이해했습니다"를 읽을 시간이 없으면 그 상자는 없는 셈이다. 조건이 뜬 뒤로
         최소 3초는 머문다. 진짜 매칭(15초대)에서는 이 대기가 0이다. */
      const waitMs = Math.max(0, 3000 - (Date.now() - matchStartedAt))
      if (waitMs) await new Promise((r) => setTimeout(r, waitMs))
      setResult(j2)
      // 바로 done 으로 안 간다 — 로딩 퍼센트가 어중간한 숫자에서 화면이 바뀌면
      // 그 숫자가 전부 연출이었다고 실토하는 셈이다. 100을 빠르게 마저 채우고 넘어간다.
      setStep('finish')
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
  // 입력값도 다 비운다 — "다른 JD로 검색"이라 해놓고 이전 JD 가 채워져 있으면
  // 지우는 일부터 시키는 셈이다.
  const restart = () => {
    ev('psc_restart', { picks: result?.picks?.length || 0 })
    setStep('input'); setResult(null); setCriteria(null)
    setJd(''); setFile(''); setErr(''); setPool(null); setYoe([])
    setWide(false); setLong(false)
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
        <div className="psc-screen" style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', overflow: 'hidden',
          // 위쪽에 복숭아빛 온기를 깔고, 입력 화면은 오른쪽 아래 브랜드 글로우와
          // 왼쪽 아래 옅은 메아리로 대각 구도를 만든다 — 이 화면은 로고와 입력칸뿐이라
          // 배경이 받쳐 주지 않으면 통째로 빈 종이로 보인다. 색은 브랜드 오렌지 한 계열만.
          background: [
            'radial-gradient(1200px 620px at 50% -12%, #FFE9DB 0%, rgba(255,233,219,0) 64%)',
            ...(step === 'input'
              ? [
                  // 크기는 CSS 변수로 뺀다 — px 고정이라 좁은 화면에서는 같은 원이
                  // 화면을 통째로 덮어 배경이 아니라 주황 판이 된다(모바일에서 줄인다).
                  'radial-gradient(var(--psc-glow-a) at 102% 104%, rgba(255,96,0,.16) 0%, rgba(255,96,0,.06) 42%, rgba(255,96,0,0) 74%)',
                  'radial-gradient(var(--psc-glow-b) at -8% 78%, rgba(255,96,0,.09) 0%, rgba(255,96,0,0) 62%)',
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

          {/* 로딩 중에만 — 옅은 오렌지 글로우가 아래에서 위로 떠오르며 돈다. 기다리는
              화면이 정지해 보이지 않게 하는 층이고, 음수 delay 로 처음부터 하늘에 떠 있다.
              wrapper 가 overflow hidden 이라 화면 밖으로 나간 것은 알아서 잘린다. */}
          {step !== 'input' && (
            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <span className="psc-blob psc-blob-a" />
              <span className="psc-blob psc-blob-b" />
              <span className="psc-blob psc-blob-c" />
            </div>
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
            {/* 워드마크가 옆으로 긴(4.8:1) 로고라 88px 높이면 화면을 가로로 다 먹는다 — 56이면
                폭 ~270px 로 입력칸(640px) 위에 알맞다. */}
            {!(step === 'input' && wide) && (
              <Mark center={step === 'input'} size={step === 'input' ? 56 : 24} />
            )}

            {step === 'input' ? (
              <>
                {/* 첫 화면은 한 줄과 입력칸뿐이다. 인사말·예시·안내를 얹으면 읽을 것이
                    늘어나는데, 여기서 할 일은 하나(JD 를 넣는다)라 읽을 게 없어야 빠르다. */}
                {!wide && (
                  <div style={{ textAlign: 'center' }}>
                    {/* 데스크톱은 한 줄. 모바일에서만 '붙여넣기' 앞에서 끊는다
                        (psc-hbr, 768px 이하에서만 산다) — 자동 줄바꿈에 맡기면 낱말
                        가운데서 갈라진다. */}
                    <H>채용공고를 복사 <br className="psc-hbr" />붙여넣기 해주세요</H>
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
                  {/* 경력 구간 — 입력칸 맨 위에 둔다. 상자 밖으로 빼면 "JD 를 넣는 곳"과
                      "조건을 고르는 곳"이 둘로 보여서, 한 칸에 붙여넣고 보내면 되는 화면이
                      양식 작성으로 읽힌다. 아래에는 파일 첨부·보내기가 이미 있어서, 거기 한 줄을 더
                      붙이면 손이 가는 것이 전부 바닥에 몰린다.
                      여러 개를 고를 수 있고, 안 골라도 된다. */}
                  <div className="psc-yoe-row" style={{
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    marginBottom: 12, paddingBottom: 12, paddingRight: 30,
                    borderBottom: `1px solid ${T.hair}`,
                  }}>
                    <span style={{ fontSize: 11.5, color: T.faint, marginRight: 2 }}>경력</span>
                    {YOE_CHIPS.map((x) => {
                      const on = yoe.includes(x.key)
                      return (
                        <button key={x.key} type="button" className="psc-yoe"
                          aria-pressed={on}
                          onClick={() => setYoe((a) => (a.includes(x.key)
                            ? a.filter((k) => k !== x.key)
                            : [...a, x.key]))}
                          style={{
                            fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 600,
                            color: on ? '#fff' : T.body,
                            background: on ? T.brand : '#fff',
                            border: `1px solid ${on ? T.brand : T.line}`,
                            borderRadius: 100, padding: '5px 12px', cursor: 'pointer',
                          }}>{x.label}</button>
                      )
                    })}
                    {/* 안 고르면 어떻게 되는지 — 안 적으면 빈 채로 두는 게 잘못인 줄 안다.
                        좁은 화면에서는 감춘다(psc-yoe-hint): 이 한 줄 때문에 칩이 둘째 줄로
                        넘어가는데, 안 고르는 게 기본값이라 안내가 없다고 못 넘어가지 않는다. */}
                    {!yoe.length && (
                      <span className="psc-yoe-hint" style={{ fontSize: 11, color: T.faint }}>선택 안 하면 JD에서 읽어요</span>
                    )}
                  </div>

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
                    placeholder={FILE_UPLOAD ? 'JD를 붙여넣거나 파일로 올려주세요' : '채용공고를 붙여넣어주세요'}
                    rows={1}
                    style={{
                      width: '100%', border: 0, outline: 'none', resize: 'none', padding: 0,
                      fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.7, color: T.ink,
                      background: 'transparent', minHeight: 25,
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    {FILE_UPLOAD && (
                      <>
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
                      </>
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

                {FILE_UPLOAD && (
                  <div style={{ fontSize: 11.5, color: T.faint, marginTop: 12, textAlign: 'center' }}>
                    PDF · DOCX · TXT · 5MB까지
                  </div>
                )}
              </>
            ) : (
              <Loading step={step} criteria={criteria} pool={pool} onFull={() => setStep('done')} />
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

            /* 경력 칩 — 누를 수 있는 것임이 손이 닿기 전에 보이게 */
            .psc-yoe { transition: background .12s ease, border-color .12s ease, color .12s ease; }
            /* 좁은 화면: 안내문을 빼고 칩·간격을 조여 네 개가 한 줄에 들어가게 한다.
               오른쪽 여백 30 은 확대 버튼 자리인데, 그 버튼은 긴 글을 넣었을 때만 나오고
               그때는 칩 줄이 이미 위로 밀려 있어 겹치지 않는다 — 좁은 화면에서는 뺀다. */
            @media (max-width: 480px) {
              .psc-yoe-hint { display: none; }
              .psc-yoe { padding: 4px 8px !important; font-size: 11px !important; }
              .psc-yoe-row { gap: 4px !important; padding-right: 0 !important; }
            }
            .psc-yoe[aria-pressed="false"]:hover { background: #FFF6F0; border-color: ${T.brandLine}; color: ${T.brandInk}; }

            /* 로딩 배경 글로우 — 아래에서 위로 떠올라 화면을 통과하고, 음수 delay 로
               처음부터 곳곳에 떠 있다. 키프레임과 클래스가 같은 블록에 있어야 한다:
               styled-jsx 가 둘의 이름을 같이 바꿔서 만나게 해 준다(인라인 animation 은 못 만난다). */
            .psc-blob { position: absolute; top: 108%; border-radius: 50%; }
            .psc-blob-a {
              left: 4%; width: 540px; height: 540px;
              background: radial-gradient(circle, rgba(255,96,0,.10) 0%, rgba(255,96,0,0) 68%);
              animation: pscRise 12s linear 0s infinite;
            }
            .psc-blob-b {
              left: 42%; width: 430px; height: 430px;
              background: radial-gradient(circle, rgba(255,96,0,.07) 0%, rgba(255,96,0,0) 68%);
              animation: pscRise 15s linear -7s infinite;
            }
            .psc-blob-c {
              left: 72%; width: 580px; height: 580px;
              background: radial-gradient(circle, rgba(255,96,0,.09) 0%, rgba(255,96,0,0) 68%);
              animation: pscRise 13s linear -3.5s infinite;
            }
            @keyframes pscRise {
              from { transform: translateY(0); }
              to { transform: translateY(-260vh); }
            }
          `}</style>

          {/* 모바일 전용 보정. Mark 는 별개 컴포넌트라 위의 scoped 블록이 닿지 않아
              global 로 둔다(psc- 접두사로 이 화면 밖과 겹치지 않는다).
              높이는 인라인 style 로 박혀 있어 !important 로만 덮인다. */}
          <style jsx global>{`
            .psc-hbr { display: none; }
            .psc-screen { --psc-glow-a: 1400px 980px; --psc-glow-b: 820px 640px; }
            @media (max-width: 768px) {
              /* 56px 는 폭 ~270px 라 좁은 화면을 가로로 거의 다 먹는다 */
              .psc-mark-hero { height: 44px !important; }
              .psc-hbr { display: inline; }
              /* 데스크톱 크기 그대로면 390px 화면에서 폭의 3.6배짜리 원이라 배경 전체가 주황이 된다 */
              .psc-screen { --psc-glow-a: 700px 500px; --psc-glow-b: 420px 340px; }
            }
          `}</style>
        </div>
      )}
    </>
  )
}

/* 이 화면은 FYI 가 아니라 '공고마감' 브랜드로 나간다(별도 서비스로 보이게 — 유저 결정).
   워드마크는 talent-showcasing 프로토타입에서 가져온 것(761×160, 흰 바탕용).
   링크는 안 건다 — 비공개 화면이라 눌러서 본 사이트로 나가면 안 된다. */
const Mark = ({ center, size = 24 }) => (
  <img src="/showcasing-wordmark.png" alt="공고마감" className={center ? 'psc-mark-hero' : undefined} style={{
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

   화면은 셋으로 말한다: 큰 퍼센트(얼마나 왔나) · 그 아래 롤링 문구(지금 뭘 하나) ·
   조건 상자(뭘 읽어냈나 — 빈 칸이 먼저 서고 한 줄씩 채워진다).

   퍼센트는 연출이다 — 서버 호출은 두 방이라 진짜 진행률이 없다. 다만 거짓말은 경계에서
   안 하게 한다: 조건 단계는 32에서, 매칭 단계는 96에서 멈춰 서서 결과를 기다린다.
   1씩 오르는 이유 — 뭉텅뭉텅 뛰면 연출인 게 티가 난다. */
function Loading({ step, criteria, pool, onFull }) {
  const [sub, setSub] = useState(0)
  useEffect(() => {
    if (step === 'finish') return
    setSub(0)
    // 조건 뽑기는 5초 안팎, 이력서 훑기는 15초 안팎이다. 그 안에서 문구를 한 번씩 넘긴다.
    const t = setTimeout(() => setSub(1), step === 'criteria' ? 2200 : 7000)
    return () => clearTimeout(t)
  }, [step])

  const [pct, setPct] = useState(0)
  const pctRef = useRef(0)
  useEffect(() => {
    /* 앞은 빠르게, 끝은 버틴다.

       조건 단계(~5초)에 0→88 까지 올리고, 매칭 단계(~15초)는 88→96 을 느리게 지나
       96 부터 기어간다(1~3초에 한 칸). 기다리는 20초 중 앞 4분의 1에서 숫자의 대부분이
       올라가므로 처음에 일이 빠르게 진행되는 것으로 읽히고, 남은 긴 구간은 '마무리하는
       중'이 된다 — 사람은 느린 시작보다 느린 마무리를 훨씬 잘 참는다.

       95 부터 버티게 하면(원래 제안) 15초를 95~99 에서 보내야 해서, 99 에 닿은 뒤로는
       10초쯤 숫자가 서 있게 된다. 서 있는 진행률은 빠른 게 아니라 죽은 것으로 보인다.
       96 으로 잡고 그 앞에 8칸을 남겨 두면 끝자락에도 움직임이 남는다.

       한 칸의 간격은 고정값이 아니라 '남은 칸 ÷ 이 단계의 실제 소요'로 그때그때 낸다.
       조건 단계가 예상보다 빨리 끝나 낮은 자리에서 넘어와도(예: 35), 매칭 단계가 남은
       61칸을 제 시간 안에 소화한다 — 고정 간격이면 그 경우에 96 근처에 영영 못 간다.

       간격은 ±30% 로 흔든다. 같은 박자로 또박또박 오르면 진행률이 아니라 시계다.
       예전엔 여기에 '가끔 멈칫'을 따로 뒀는데 뺐다 — 한 칸이 51ms 인 앞 구간에서 그
       멈칫의 하한(260ms)이 다섯 배짜리 정지가 되어, 5초에 88%가 아니라 62%까지밖에 못
       올라갔다(실측). 지터만으로 이미 규칙적이지 않다.

       상한(hard)에 닿으면 숫자가 통째로 선다. 조건 단계의 여유가 88→93 다섯 칸뿐이던
       때, 조건 뽑기가 오래 걸린 검색에서 93% 에 10초 가까이 얼어 있었다(실측). 그래서
       두 가지를 같이 고쳤다: 여유를 82→95 로 넓히고, 목표를 넘어선 뒤로는 한 칸마다
       간격이 35% 씩 길어지게 했다. 남은 칸이 천천히 소진되므로 오래 걸리는 검색에서도
       숫자가 아주 느리게나마 계속 움직인다 — 멈춘 진행률은 고장으로 읽힌다.
       finish 만 규칙적으로 최고 속도다(14ms) — 마무리는 멈칫거릴 이유가 없다. */
    const soft = step === 'criteria' ? 82 : step === 'match' ? 95 : 100
    const hard = step === 'criteria' ? 95 : step === 'match' ? 99 : 100
    // 이 단계가 실제로 걸리는 시간(관측값). soft 까지를 이 안에 나눠 쓴다.
    const expected = step === 'criteria' ? 4500 : step === 'match' ? 13000 : 0
    const each = expected / Math.max(1, soft - pctRef.current)
    let alive = true
    let t
    const tick = () => {
      if (!alive) return
      const next = Math.min(pctRef.current + 1, hard)
      pctRef.current = next
      setPct(next)
      const delay = step === 'finish' ? 14
        : next >= soft ? (1200 + Math.random() * 1800) * (1 + (next - soft) * 0.35)
        : Math.max(28, each * (0.7 + Math.random() * 0.6))
      t = setTimeout(tick, delay)
    }
    t = setTimeout(tick, step === 'finish' ? 0 : 250)
    return () => { alive = false; clearTimeout(t) }
  }, [step])

  // 100에 닿으면 살짝 멈췄다가 결과로 — 100을 볼 새도 없이 바뀌면 채운 의미가 없다
  useEffect(() => {
    if (step !== 'finish' || pct < 100) return
    const t = setTimeout(() => onFull?.(), 350)
    return () => clearTimeout(t)
  }, [step, pct]) // eslint-disable-line react-hooks/exhaustive-deps

  const heads = [
    'JD를 읽고 있어요',
    '채용 조건을 정리하고 있어요',
    pool ? `이력서 ${pool.toLocaleString()}장을 대조하고 있어요` : '이력서를 한 장씩 대조하고 있어요',
    '가장 잘 맞는 분들을 고르고 있어요',
  ]
  const at = step === 'criteria' ? sub : step === 'match' ? 2 + sub : 3

  return (
    <>
      <div style={eyebrow}>인재 추천</div>

      {/* 숫자가 주인공 — 한 줄을 통째로 쓴다. 문구와 같은 줄에 두면 서로 기준선을
          다투는데, 줄을 나누면 눈이 숫자→문구 순서로 자연스럽게 내려온다. */}
      <div style={{
        marginTop: 10, fontSize: 46, fontWeight: 800, color: T.ink,
        letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>
        {pct}<span style={{ fontSize: 24, fontWeight: 700, color: T.mute, marginLeft: 2 }}>%</span>
      </div>

      {/* 문구 롤링 — 네 줄을 세로로 쌓고 한 줄 높이의 창만 남긴 채 밀어 올린다.
          뚝 바뀌는 게 아니라 이전 문구가 올라가며 다음 문구가 딸려 온다. */}
      <div style={{ height: 27, overflow: 'hidden', marginTop: 12 }}>
        <div style={{
          transform: `translateY(${-at * 27}px)`,
          transition: 'transform .5s cubic-bezier(.25,.7,.3,1)',
        }}>
          {heads.map((h) => (
            <div key={h} style={{ height: 27, fontSize: 15.5, fontWeight: 600, color: T.body }}>{h}</div>
          ))}
        </div>
      </div>

      {/* 조건이 오기 전에도 상자는 서 있다 — 빈 칸이 먼저 보이고 한 줄씩 채워진다 */}
      <CriteriaBox c={criteria} />
    </>
  )
}

/* 한 줄씩 차오르는 등장 — 키프레임은 global 로 둔다. styled-jsx 스코프 키프레임은
   이름이 해시로 바뀌어서 인라인 style 의 animation 이름과 안 만난다(버튼에서 겪었다). */
const rise = (i) => ({
  opacity: 0,
  animation: 'cbIn .45s ease forwards',
  animationDelay: `${0.1 + i * 0.22}s`,
})

// 뽑아낸 조건 — 로딩 화면에서 쓴다. c 가 없으면 빈 칸(스켈레톤)으로 먼저 선다.
function CriteriaBox({ c }) {
  const shown = c ? (c.requirements || []).filter((r) => !r.includes('추정')) : []
  const yoe = !c || (c.yoe_min == null && c.yoe_max == null) ? null
    : `${c.yoe_min ?? 0}${c.yoe_max != null ? `~${c.yoe_max}` : '+'}년`
  const lang = c ? [
    c.korean !== 'none' && `한국어 ${c.korean === 'required' ? '필수' : '우대'}`,
    c.english !== 'none' && `영어 ${c.english === 'required' ? '필수' : '우대'}`,
  ].filter(Boolean).join(' · ') : ''

  const meta = c ? [c.positions.join(' · '), yoe, lang, c.note].filter(Boolean).join(' · ') : ''

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
        {!c ? (
          /* 조건이 오기 전 — 채워질 자리를 회색 막대로 미리 세워 둔다. 상자가 나중에
             통째로 나타나면 '뚝' 하고 붙는데, 자리가 먼저 서 있으면 채워지는 것으로 보인다. */
          [88, 58, 96, 82, 70].map((w, i) => (
            <div key={i} style={{
              height: 11, width: `${w}%`, borderRadius: 6, background: '#EEF1F4',
              marginTop: i ? 13 : 4,
              animation: 'cbPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.15}s`,
            }} />
          ))
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', ...rise(0) }}>
              {c.title || '요청하신 자리'}
            </div>
            {!!meta && <div style={{ fontSize: 12, color: T.mute, marginTop: 4, ...rise(1) }}>{meta}</div>}

            {/* 화면에는 JD 에 적힌 조건만 올린다. 업무 설명에서 유추한 (추정) 요건은 매칭에는
                쓰되 보여주지 않는다 — 고객사 입장에서는 자기가 쓰지도 않은 조건이 자기 조건인 양
                걸려 있는 것이고, "웹 서비스 개발 경험이 있어야 합니다 (추정)" 같은 문장은
                우리가 뭘 넣었는지 설명하느라 화면만 잡아먹는다. */}
            {!!shown.length && <Bullets items={shown} color={T.body} riseFrom={2} />}

            {!!c.preferred?.length && (
              // 우대사항은 순위를 가르는 칸이라(자격요건은 통과선이라 통과자끼리는 다 같다) 같이 보인다
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.hair}`, ...rise(2 + shown.length) }}>
                <div style={{ ...eyebrow, fontSize: 10 }}>우대</div>
                <Bullets items={c.preferred} color={T.mute} riseFrom={3 + shown.length} />
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes cbIn { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
        @keyframes cbPulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
      `}</style>
    </div>
  )
}

// 점 대신 작은 원. 가운뎃점(·)은 글자라 줄마다 높이가 흔들리는데, 원은 자리에 고정된다.
// riseFrom 이 있으면 그 순번부터 한 줄씩 차오르는 등장(rise)을 탄다 — 로딩 조건 상자용.
const Bullets = ({ items, color, riseFrom }) => (
  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
    {items.map((r, i) => (
      <div key={i} style={{
        display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.6, color,
        ...(riseFrom == null ? {} : rise(riseFrom + i)),
      }}>
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
  // 문의 모달을 연 카드 번호(0-base). null 이면 닫힌 상태.
  const [asking, setAsking] = useState(null)

  // 하단 고정 CTA — 문의 입구는 이거 하나다. 카드는 읽는 물건이고, 들어오는 문은 아래에 있다.
  const openAll = () => {
    setAsking('all')
    ev?.('psc_inquiry_open', { all: true })
  }

  return (
    <div style={{
      /* 양쪽 여백. 화면 끝까지 쓰면 카드가 브라우저 테두리에 붙어 화면이 아니라 앱처럼
         보인다 — 넓은 화면에서 56px 까지 벌리고, 좁은 화면에서는 16px 로 줄어든다(clamp).
         아래는 떠 있는 CTA 버튼이 깔리는 만큼 비워 둔다. */
      minHeight: '100vh',
      padding: picks.length
        ? '40px clamp(16px, 4vw, 56px) 130px'
        : '40px clamp(16px, 4vw, 56px) 28px',
      background: `radial-gradient(900px 420px at 50% -60px, #FFF8F3 0%, rgba(255,248,243,0) 60%), ${T.paper}`,
    }}>
      {/* 본문 폭. 세 단 그리드였을 때는 폭이 곧 카드 폭이라 1560 까지 벌려 뒀는데,
          카로셀로 바뀌면서 카드 폭은 560 으로 고정됐다 — 그때부터 남는 폭은 양옆
          카드가 더 보이는 것뿐이라, 글줄이 화면 가운데로 모이게 1320 으로 좁힌다. */}
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <Mark />

        {/* 머리 — 한 문장과 조건 목록뿐이다. 라벨(인재 추천 결과)도 직무명도 뺐다:
            자기가 올린 공고로 자기가 받은 결과를 보는 화면이라, 그 둘은 이미 아는 말이고
            읽어야 할 조건 앞을 막는다.
            단정해서 말한다 — "있을 겁니다"로 흐리면 우리가 고른 열 명을 우리가 못 믿는
            것으로 읽힌다. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <H>
              {picks.length
                ? (<>
                  아래 조건에 가장 부합하는{' '}
                  <span style={{ color: T.brand }}>{picks.length}명</span>을 보여드립니다
                </>)
                : '조건에 맞는 분을 찾지 못했습니다'}
            </H>

            {/* JD 에 적힌 문장을 그대로 올린다. (추정) 요건은 뺀다 — 고객사가 쓰지도 않은
                조건이 자기 조건인 양 걸려 있는 것이다. */}
            {!!picks.length && (
              <Bullets items={(criteria?.requirements || []).filter((r) => !r.includes('추정'))} color={T.body} />
            )}
          </div>
          <button type="button" onClick={onBack} style={{
            marginLeft: 'auto', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            color: T.body, background: '#fff', border: `1px solid ${T.line}`,
            borderRadius: 100, padding: '7px 14px', cursor: 'pointer', boxShadow: T.sm,
          }}>다른 JD로 검색</button>
        </div>

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
      </div>

      {/* 카로셀 — 세 단 그리드(2·4·4)였다가 바꿨다. 세로로 깔면 7~10등은 스크롤 밑이라
          사실상 안 읽혔다. 1등이 가운데 크게 서고 몇 초마다 다음으로 스스로 넘어간다.
          10등 다음은 1등이다 — 되감아 돌아가게 하면 9장을 거꾸로 지나쳐야 1등이 나온다.

          글줄은 1320 안에 두되 카로셀만 본문 폭과 좌우 패딩을 넘어 화면 끝까지 쓴다 —
          양옆 카드가 화면 가장자리에서 잘려야 '옆에 더 있다'가 보인다. 폭 안에 가두면
          잘린 자리 대신 흰 여백이 서서 열 장이 세 장짜리 묶음처럼 끝나 보였다.
          음수 마진은 바깥 패딩과 같은 값이라 정확히 화면 폭이 된다(100vw 는 스크롤바
          너비만큼 넘쳐서 가로 스크롤이 생긴다). */}
      <div style={{
        marginLeft: 'calc(-1 * clamp(16px, 4vw, 56px))',
        marginRight: 'calc(-1 * clamp(16px, 4vw, 56px))',
      }}>
        <Carousel picks={picks} />
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

      {/* 하단 고정 CTA — 카드는 요약이라, 잘 읽힐수록 다음 욕구는 '원문'이 된다.
          그 순간에 "누구로 문의할지"부터 고르게 하지 않으려고 페이지 전체에 하나를 둔다.
          카드별 버튼은 보조 경로로 남긴다 — '이 사람'이 꽂힌 쪽에는 그게 최단이다. */}
      {/* 얇은 바에 작은 버튼으로 뒀더니 안 보인다는 지적 — 바를 버리고 버튼 하나를
          크게 띄운다. 이 화면에서 가장 큰 주황이 이 버튼이어야 한다. 문의가 이 화면의
          존재 이유라서다. */}
      {!!picks.length && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 26, zIndex: 40,
          display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none',
        }}>
          <button type="button" className="psc-bar-btn" onClick={openAll}
            style={{
              pointerEvents: 'auto', fontFamily: 'inherit', fontSize: 16.5, fontWeight: 800,
              letterSpacing: '-0.02em', color: '#fff',
              background: T.brand, border: 0, borderRadius: 100, padding: '17px 38px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              boxShadow: '0 10px 28px rgba(255,96,0,.38), 0 2px 6px rgba(16,24,40,.12)',
            }}>
            {picks.length}명 이력서 받아보기
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          {/* 이 블록은 반드시 버튼과 같은 서브트리에 있어야 한다 — 다른 형제 밑에 두면
              styled-jsx 가 버튼에 스코프 클래스를 안 붙여서 여기 규칙 전부가 안 먹는다
              (실제로 그랬다). \${} 값 금지도 여전하다(동적 모드가 되면 또 통째로 죽는다). */}
          <style jsx>{`
            .psc-bar-btn {
              transition: transform .15s ease, box-shadow .15s ease;
              animation: psc-nudge 3.6s ease-in-out 2s infinite;
            }
            /* 몇 초에 한 번 두 번 콩콩 — 주기의 대부분(20%~)은 가만히 있는다.
               내내 움직이면 유도가 아니라 소음이다. 올리는 순간 멈춘다(이미 유도됐다). */
            @keyframes psc-nudge {
              0%, 20%, 100% { transform: translateY(0); }
              6% { transform: translateY(-6px); }
              12% { transform: translateY(0); }
              16% { transform: translateY(-3px); }
            }
            .psc-bar-btn:hover {
              animation: none;
              transform: translateY(-2px);
              box-shadow: 0 14px 34px rgba(255,96,0,.46), 0 2px 6px rgba(16,24,40,.12);
            }
            @media (prefers-reduced-motion: reduce) {
              .psc-bar-btn { animation: none; }
            }
            @media (max-width: 640px) {
              .psc-bar-btn { width: 100%; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

/* 상담 문의 — 이 화면이 존재하는 이유. 여기까지 와서 할 수 있는 게 "다른 JD로 검색"뿐이면
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

const DOW = ['일', '월', '화', '수', '목', '금', '토']
// 칩에 적는 꼴 — "8/12(수) 14:00". 연도는 안 적는다: 고를 수 있는 날이 어차피 몇 주 안이다.
const slotLabel = (s) => {
  const [y, m, d] = s.date.split('-').map(Number)
  return `${m}/${d}(${DOW[new Date(y, m - 1, d).getDay()]}) ${s.time}`
}

/* 자체 달력 — 브라우저 기본 달력을 쓰다가 바꿨다. 기본 달력은 OS 마다 생김새가 달라
   이 화면의 톤에서 혼자 튀고, 날짜 따로 시간 따로 고르게 해서 손이 두 배로 갔다.
   여기서는 날짜를 누르면 그 자리가 바로 시간 판으로 바뀐다 — 두 번의 클릭, 화면 하나. */
function SlotPicker({ pick, setPick, today, onDone }) {
  const { y, m, date } = pick
  // 한 날짜에서 시간 여러 개를 고르고 확인으로 한 번에 담는다
  const [times, setTimes] = useState([])
  useEffect(() => { setTimes([]) }, [date])
  const toggle = (t) => setTimes((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))
  const days = new Date(y, m + 1, 0).getDate()
  const startDow = new Date(y, m, 1).getDay()
  const cells = [...Array(startDow).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)]
  const fmt = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const now = new Date()
  const atCur = y === now.getFullYear() && m === now.getMonth() // 지난달로는 못 간다

  const navBtn = (dis) => ({
    width: 26, height: 26, border: 0, background: 'none', borderRadius: 8,
    fontSize: 15, lineHeight: 1, color: dis ? '#D6DBE1' : T.body,
    cursor: dis ? 'default' : 'pointer', padding: 0,
  })

  return (
    <div style={{
      marginTop: 4, border: `1px solid ${T.line}`, borderRadius: 14,
      padding: 12, background: '#fff', boxShadow: T.sm,
      // 고정 높이 — 달력(최대 6주)과 시간 판이 같은 키로 서서, 넘어갈 때 모달이 안 출렁인다
      height: 286, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    }}>
      {!date ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <button type="button" disabled={atCur} onClick={() => setPick({ ...pick, m: m ? m - 1 : 11, y: m ? y : y - 1 })}
              style={navBtn(atCur)} aria-label="이전 달">‹</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: T.ink }}>
              {y}년 {m + 1}월
            </div>
            <button type="button" onClick={() => setPick({ ...pick, m: m === 11 ? 0 : m + 1, y: m === 11 ? y + 1 : y })}
              style={navBtn(false)} aria-label="다음 달">›</button>
            <button type="button" onClick={() => setPick(null)} aria-label="닫기"
              style={{ ...navBtn(false), marginLeft: 2, color: T.faint }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DOW.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: T.faint, padding: '2px 0 6px' }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const past = fmt(d) < today
              return (
                <button key={i} type="button" disabled={past} className="psc-day"
                  onClick={() => setPick({ ...pick, date: fmt(d) })}
                  style={{
                    height: 32, border: 0, borderRadius: 9, padding: 0,
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: fmt(d) === today ? 800 : 500,
                    color: past ? '#D6DBE1' : fmt(d) === today ? T.brand : T.ink,
                    background: 'none', cursor: past ? 'default' : 'pointer',
                  }}>{d}</button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
            <button type="button" onClick={() => setPick({ ...pick, date: null })}
              style={{ ...navBtn(false), width: 'auto', fontSize: 12, fontWeight: 600, color: T.mute }}>‹ 날짜 다시</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: T.ink }}>
              {slotLabel({ date, time: '' }).trim()}
            </div>
            <button type="button" onClick={() => setPick(null)} aria-label="닫기"
              style={{ ...navBtn(false), color: T.faint }}>×</button>
          </div>
          {/* 시간 판은 달력보다 짧다 — 고정 높이 안에서 세로 가운데로 세워 빈 바닥이 안 보이게.
              시간은 여러 개를 켜고 끄는 토글이고, 확인이 한 번에 담는다. */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {TIMES.map((t) => {
                const on = times.includes(t)
                return (
                  <button key={t} type="button" className={on ? '' : 'psc-time'} onClick={() => toggle(t)}
                    style={{
                      fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600,
                      color: on ? '#fff' : T.body,
                      background: on ? T.brand : '#fff',
                      border: `1px solid ${on ? T.brand : T.line}`, borderRadius: 9,
                      padding: '8px 0', cursor: 'pointer',
                      transition: 'background .12s ease, color .12s ease, border-color .12s ease',
                    }}>{t}</button>
                )
              })}
            </div>
            <button type="button" disabled={!times.length}
              onClick={() => onDone(times.map((t) => ({ date, time: t })))}
              style={{
                marginTop: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff',
                background: times.length ? T.brand : '#D6DBE1', border: 0, borderRadius: 10,
                padding: '10px 0', cursor: times.length ? 'pointer' : 'default',
                transition: 'background .12s ease',
              }}>
              {times.length ? `${times.length}개 시간 추가하기` : '시간을 선택해주세요'}
            </button>
          </div>
        </>
      )}
    </div>
  )
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
  const [more, setMore] = useState(false)   // 관심 인재 목록을 펴 뒀나
  /* 시간대를 여러 개 받는다. 하나만 받으면 그 시간이 우리 쪽에서 안 될 때 다시 메일을
     주고받아야 하는데, 몇 개를 미리 받아 두면 그 왕복이 통째로 없어진다. 개수는 안 막는다 —
     많이 줄수록 우리가 고를 폭이 넓어질 뿐이다.
     완성된 (날짜, 시간) 쌍만 담긴다 — 고르다 만 줄이 없으니 보낼 때 거를 것도 없다. */
  const [slots, setSlots] = useState([])
  // 달력 픽커. null 이면 닫힘, { y, m(0-11), date } 로 보는 달과 고른 날짜를 든다.
  const [pick, setPick] = useState(null)
  // 그리기용 거울 — 닫힘 애니메이션(높이 296→0)이 끝날 때까지 판을 들고 있는다
  const [pickShown, setPickShown] = useState(null)
  useEffect(() => {
    if (pick) { setPickShown(pick); return }
    const t = setTimeout(() => setPickShown(null), 300)
    return () => clearTimeout(t)
  }, [pick])
  const [today] = useState(todayStr)
  const [memo, setMemo] = useState('')
  const [hp, setHp] = useState('') // 함정칸 — 사람 눈에는 안 보인다
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
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
      className="psc-ov"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(12,16,22,0.5)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* 등장 모션 — global 인 이유: 이 컴포넌트의 유일한 스타일 블록이라 중첩 걱정이
          없고, global 이면 스코프 클래스가 어디에 붙는지를 따질 필요가 없다(그걸 따지다
          두 번 데였다). 이름만 안 겹치게 psc- 를 단다. */}
      <style jsx global>{`
        .psc-ov { animation: pscOvIn .22s ease both; }
        .psc-mo { animation: pscMoIn .34s cubic-bezier(.2,.9,.3,1) both; }
        @keyframes pscOvIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pscMoIn {
          from { opacity: 0; transform: translateY(18px) scale(.96); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .psc-ov, .psc-mo { animation: none; }
        }

        /* 모달 스크롤 — 막대는 아예 안 보인다. 스크롤 자체는 되고, 보내기 버튼이 바닥에
           붙어 있어서 "더 있다"는 표시가 없어도 길을 잃지 않는다. */
        .psc-mo { scrollbar-width: none; }
        .psc-mo::-webkit-scrollbar { display: none; }

        /* 관심 인재 접이식 — 헤더는 호버에서 옅게, 행은 안 고른 것만 호버 반응 */
        .psc-fold:hover { background: #FAFBFC; }
        .psc-row.off:hover { background: #F7F8FA; }

        /* 달력·시간 버튼 — 눌리는 티. 호버에 옅은 브랜드 바탕, 누르는 순간 살짝 움츠러든다. */
        .psc-day, .psc-time { transition: background .12s ease, border-color .12s ease, color .12s ease, transform .08s ease; }
        .psc-day:not(:disabled):hover { background: #FFF3EC; color: #D94E00; }
        .psc-day:not(:disabled):active { transform: scale(.88); }
        .psc-time:hover { background: #FFF6F0; border-color: #FFDFCB; color: #D94E00; }
        .psc-time:active { transform: scale(.94); }
      `}</style>
      <div
        className="psc-mo"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 470, maxHeight: '90vh', overflowY: 'auto',
          background: '#fff', borderRadius: 20, boxShadow: T.lg,
          // 폼일 때 아래 패딩이 없는 건 sticky 버튼 영역이 제 패딩을 들고 바닥에 붙기 때문
          padding: done ? '28px 26px 24px' : '28px 26px 0',
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
            {/* 접수 후에는 다음에 무슨 일이 일어나는지만 말한다. 원문을 어떻게 보여주는지는
                연락해서 사람이 설명할 일이지, 방금 연락처를 준 사람에게 화면이 못 박을 일이
                아니다 — 여기서 조건을 하나 더 읽히면 접수하고도 찜찜하게 닫는다. */}
            <div style={{ fontSize: 13.5, color: T.mute, marginTop: 10, lineHeight: 1.7 }}>
              영업일 기준 1일 안에 {contact.includes('@') ? '메일로 ' : ''}연락드려 미팅 일정을 잡아드리겠습니다.
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
                ? (<>영업일 1일 안에<br />연락드리겠습니다</>)
                : (<>이 인재로 채용 상담을<br />문의하시겠습니까?</>)}
            </div>

            {/* 여기서 할 말은 "연락처를 남기면 연락이 간다" 하나다. 원문을 왜 메일로
                안 보내는지까지 여기서 설명하면, 폼을 열자마자 안 되는 것부터 읽게 된다. */}
            {all && (
              <div style={{ fontSize: 13, color: T.body, marginTop: 10, lineHeight: 1.7 }}>
                연락처를 남겨주시면 담당자가 미팅 일정을 잡아 연락드립니다.
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

            {/* 관심 인재 고르기 — 접이식 토글. 접혀 있어도 안에 뭐가 있고 몇을 골랐는지는
                헤더가 말한다. 골랐다면 그게 "어느 카드가 팔리나"의 신호다. */}
            {picks.length > 1 && (
              <div style={{
                marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 12,
                background: '#fff', overflow: 'hidden',
              }}>
                <button type="button" onClick={() => setMore((v) => !v)}
                  className="psc-fold"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: T.ink,
                    letterSpacing: '-0.01em', background: 'none', border: 0,
                    padding: '12px 13px', cursor: 'pointer', textAlign: 'left',
                  }}>
                  {all ? '특히 관심 있는 인재 고르기' : '함께 문의할 인재 추가하기'}
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: T.faint }}>선택</span>
                  {picked.length > (all ? 0 : 1) && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.brand }}>
                      {all ? picked.length : picked.length - 1}명
                    </span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                    style={{
                      marginLeft: 'auto', color: T.faint, flexShrink: 0,
                      transform: more ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease',
                    }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* 펼침은 높이 전환 — 뚝 나타나면 모달이 널뛴다(달력 판과 같은 규칙) */}
                <div style={{
                  display: 'grid', gridTemplateRows: more ? '1fr' : '0fr',
                  transition: 'grid-template-rows .25s ease',
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    {picks.map((p, i) => {
                      if (!all && i === first) return null
                      const on = picked.includes(i)
                      return (
                        <button key={i} type="button" onClick={() => toggle(i)}
                          className={`psc-row${on ? '' : ' off'}`}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                            fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                            padding: '9px 13px', border: 0, borderTop: `1px solid ${T.hair}`,
                            background: on ? T.brandSoft : '#fff',
                            transition: 'background .12s ease',
                          }}>
                          <span style={{
                            width: 21, height: 21, borderRadius: '50%', flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                            background: on ? T.brand : '#F1F5F9', color: on ? '#fff' : '#64748B',
                            transition: 'background .12s ease, color .12s ease',
                          }}>{i + 1}</span>
                          <span style={{
                            fontSize: 12.5, fontWeight: on ? 600 : 500, color: T.body,
                            minWidth: 0, flex: 1, ...oneLine,
                          }}>{p.title || '직무 미상'}</span>
                          <span style={{ fontSize: 11.5, color: T.faint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            적합 {p.fit}
                          </span>
                          {/* 체크 — 기본 체크박스 대신 원. 켜지면 주황으로 차고 흰 체크가 선다 */}
                          <span style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: `1.5px solid ${on ? T.brand : '#D6DBE1'}`,
                            background: on ? T.brand : '#fff',
                            transition: 'background .12s ease, border-color .12s ease',
                          }}>
                            {on && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff"
                                strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 필수 세 칸 — 비어 있으면 오른쪽에 빨간 점(채워야 한다는 표시), 채우면
                연두 테두리 + 체크. 제출을 눌러 보기 전에 뭐가 남았는지 칸이 스스로 말한다. */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ReqInput value={name} onChange={(e) => setName(e.target.value)}
                placeholder="담당자 성함" valid={!!name.trim()} />
              <ReqInput value={company} onChange={(e) => setCompany(e.target.value)}
                placeholder="회사명" valid={!!company.trim()} />
              <ReqInput value={contact} onChange={(e) => setContact(e.target.value)}
                placeholder="이메일 또는 전화번호" valid={!!contact.trim()} />
            </div>

            {/* 날짜·시간을 폼 줄로 늘어놓지 않는다 — 연도/월/일/시간 입력이 나란히 서 있으면
                선택 아닌 서류 작성으로 읽힌다. '추가하기' 하나만 두고, 누르면 우리 달력이
                열려 날짜 → 시간 두 번 누르면 칩으로 쌓인다. 고른 결과만 남고 과정은 접힌다. */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, color: T.mute, marginBottom: 7 }}>미팅 가능하신 시간 (선택)</div>

              {!!slots.length && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {slots.map((s, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, color: T.brandInk,
                      background: T.brandSoft, border: `1px solid ${T.brandLine}`,
                      borderRadius: 100, padding: '5px 9px 5px 12px',
                    }}>
                      {slotLabel(s)}
                      <button type="button" aria-label="이 시간 지우기"
                        onClick={() => setSlots((a) => a.filter((_, j) => j !== i))}
                        style={{
                          border: 0, background: 'none', color: T.brandInk, opacity: .55,
                          cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1,
                        }}>×</button>
                    </span>
                  ))}
                </div>
              )}

              {!pick && (
                <button type="button"
                  onClick={() => { const n = new Date(); setPick({ y: n.getFullYear(), m: n.getMonth(), date: null }) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: T.body,
                    background: '#fff', border: `1px dashed #C6CCD3`, borderRadius: 100,
                    padding: '7px 15px', cursor: 'pointer',
                  }}>+ 추가하기</button>
              )}

              {/* 판의 등장·퇴장을 높이 전환으로 — 내용이 불쑥 생기고 사라지면 모달 크기가
                  널뛴다. 닫힐 때는 pickShown 이 300ms 판을 들고 있어서 줄어드는 동안에도
                  내용이 보인다. 판 자체는 고정 높이(SlotPicker)라 날짜↔시간 전환에도 안 흔들린다. */}
              <div style={{ height: pick ? 296 : 0, overflow: 'hidden', transition: 'height .28s ease' }}>
                {pickShown && (
                  <SlotPicker pick={pickShown} setPick={setPick} today={today}
                    onDone={(list) => {
                      setSlots((a) => {
                        const merged = [...a]
                        for (const s of list) {
                          if (!merged.some((x) => x.date === s.date && x.time === s.time)) merged.push(s)
                        }
                        return merged
                      })
                      setPick(null)
                    }} />
                )}
              </div>
            </div>

            {/* 쓰는 만큼 자란다 — 두 줄 고정 칸에서 스크롤로 읽게 하면 자기가 쓴 글을
                구멍으로 들여다보는 셈이다. 260px 에서 멈추는 건 모달을 통째로 먹지 않게. */}
            <textarea value={memo} rows={2}
              onChange={(e) => {
                setMemo(e.target.value)
                const el = e.target
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 260)}px`
              }}
              placeholder="남기실 말씀 (선택)"
              style={{ ...inputStyle, marginTop: 12, resize: 'none', lineHeight: 1.6 }} />

            {/* 함정칸 — 봇만 채운다. 사람에게는 안 보이고 탭으로도 안 걸린다. */}
            <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off"
              aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />

            {!!err && <div style={{ fontSize: 12.5, color: '#DC2626', marginTop: 10 }}>{err}</div>}

            {/* 보내기는 모달 바닥에 붙어 따라온다 — 달력을 펴고 말씀까지 적으면 내용이
                90vh 를 넘는데, 그때 버튼이 접힌 아래로 사라지면 다 채우고도 못 보낸다. */}
            <div style={{
              position: 'sticky', bottom: 0, background: '#fff', marginTop: 18,
              paddingBottom: 18, boxShadow: '0 -12px 14px -12px rgba(16,24,40,.12)',
            }}>
              <button type="button" onClick={send} disabled={!ok || busy}
                style={{
                  ...primaryBtn,
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
            </div>
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

/* 필수 입력칸 — 빈 칸은 오른쪽에 빨간 점, 채우면 연두 테두리와 체크.
   점이 빨간 건 '필수'라는 표시지 에러가 아니다 — 그래서 테두리까지 빨갛게 하지는 않는다. */
const ReqInput = ({ value, onChange, placeholder, valid }) => (
  <div style={{ position: 'relative' }}>
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{
        ...inputStyle, paddingRight: 36,
        border: `1px solid ${valid ? '#8BDCAC' : T.line}`,
        transition: 'border-color .15s ease',
      }} />
    <span style={{
      position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', alignItems: 'center', pointerEvents: 'none',
    }}>
      {valid ? (
        <span style={{
          width: 16, height: 16, borderRadius: '50%', background: '#12B76A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff"
            strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      ) : (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F04438', display: 'block' }} />
      )}
    </span>
  </div>
)

const primaryBtn = {
  width: '100%', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff',
  border: 0, borderRadius: 12, padding: '13px 0', cursor: 'pointer',
}

/* 카로셀 — 열 장을 한 줄에 세우고 옆으로 넘긴다.

   무한 루프다: 마지막 장에서 다음을 누르면 1등으로 이어진다. 구현은 앞쪽 몇 장을 꼬리에
   복제해 두고, 복제 구간으로 미끄러져 들어간 순간 전환 없이 진짜 자리로 순간이동하는
   고전적인 방식이다 — 보는 사람 눈에는 이음매가 없다. 뒤로 넘길 때도 같은 트릭을
   거꾸로 쓴다(0에서 복제 구간으로 순간이동한 뒤 한 칸 애니메이션).

   라이브러리를 안 쓰는 건 이 화면 하나 때문에 부품을 들이지 않기 위해서다. 필요한 건
   transform 하나와 복제 몇 장뿐이다. */
function Carousel({ picks }) {
  const GAP = 20
  const K = 2 // 양쪽 복제 수 — 가운데 카드 양옆으로 보이는 만큼만 있으면 된다
  const n = picks.length
  const vpRef = useRef(null)
  const [vw, setVw] = useState(0)
  const [pos, setPos] = useState(K)   // 트랙 위치. K 가 1등이다
  const [anim, setAnim] = useState(true)
  const [paused, setPaused] = useState(false)

  // 그리기 전에 재야 한다(useLayoutEffect) — 아니면 어긋난 트랙이 한 프레임 보인다
  useLayoutEffect(() => {
    const measure = () => setVw(vpRef.current?.clientWidth || 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const slideW = vw < 640 ? Math.round(vw * 0.84) : vw < 1100 ? 500 : 560

  /* 몇 초에 한 번 스스로 넘어간다. 타이머가 pos 에 걸려 있어 점을 눌러 건너뛰어도
     그 시점부터 다시 센다 — 읽기 시작하자마자 넘어가 버리는 일이 없다.
     탭이 백그라운드였다가 돌아오면 transitionend 를 놓쳐 pos 가 복제 구간에 걸려 있을 수
     있는데, 그때는 소리 없이 진짜 자리로 되돌리고 다음 틱에 다시 간다. */
  useEffect(() => {
    if (paused || n < 2) return
    const t = setTimeout(() => {
      if (pos >= K + n) { setAnim(false); setPos(pos - n) }
      else { setAnim(true); setPos(pos + 1) }
    }, 3500)
    return () => clearTimeout(t)
  }, [paused, pos, n])

  // 복제 구간(같은 그림)에 도착하면 진짜 자리로 되돌린다 — 전환이 꺼져 있어 안 보인다.
  // 카드의 확대/축소 전환도 여기로 버블링되므로 트랙 자신의 것만 받는다.
  const onEnd = (e) => {
    if (e.target !== e.currentTarget) return
    if (pos >= K + n) { setAnim(false); setPos(pos - n) }
    else if (pos < K) { setAnim(false); setPos(pos + n) }
  }

  /* 드래그 — 마우스·터치 공용(pointer 이벤트). 잡는 동안 트랙이 손을 따라오고,
     놓으면 끌린 거리만큼 가까운 카드에 스냅한다. 5px 이상 움직였으면 드래그지
     클릭이 아니다 — 놓는 순간 카드 클릭이 같이 터지는 것을 막는다. */
  const drag = useRef(null)
  const clickBlock = useRef(false)
  const [dragX, setDragX] = useState(0)

  const settle = (target, fromDx) => {
    if (target < K) {
      // 목표가 머리쪽 복제 구간 — 같은 그림인 진짜 자리로 소리 없이 옮긴 뒤 애니메이션.
      // rAF 두 번은 순간이동이 화면에 먼저 칠해지게 하는 최소한의 기다림이다.
      setAnim(false); setPos(pos + n); setDragX(fromDx)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setAnim(true); setPos(target + n); setDragX(0)
      }))
    } else {
      setAnim(true); setPos(Math.min(target, K + n)); setDragX(0)
    }
  }

  /* setPointerCapture 를 안 쓴다 — 캡처하면 그 뒤의 click 이 카드가 아니라 캡처한
     요소(뷰포트)로 가서, 옆 카드를 눌러 가운데로 부르는 동작이 죽는다. 대신 끌기 동안만
     window 에 리스너를 달아서 화면 밖으로 나가도 놓침 없이 따라간다. */
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType === 'mouse') e.preventDefault() // 글자 선택으로 새는 것 방지 — click 은 산다
    drag.current = { x: e.clientX, moved: false }
    setPaused(true); setAnim(false)
    const move = (ev) => {
      if (!drag.current) return
      const dx = ev.clientX - drag.current.x
      if (Math.abs(dx) > 5) drag.current.moved = true
      setDragX(dx)
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!drag.current) return
      const dx = ev.clientX - drag.current.x
      clickBlock.current = drag.current.moved
      drag.current = null
      // 터치는 손을 뗐으니 다시 돈다. 마우스는 아직 카드 위라 hover 규칙에 맡긴다.
      if (ev.pointerType !== 'mouse') setPaused(false)
      const step = Math.max(-2, Math.min(2, Math.round(-dx / ((slideW + GAP) * 0.55))))
      if (!step) { setAnim(true); setDragX(0); return } // 짧게 끌었다 — 제자리로 스냅백
      settle(pos + step, dx)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // 앞뒤 K 장씩 복제 — 1등 왼쪽에 10등이, 10등 오른쪽에 1등이 보여야 고리가 된다
  const items = [...picks.slice(n - K), ...picks, ...picks.slice(0, K)]
  const active = ((pos - K) % n + n) % n

  /* 게이지의 두 기준점 — 1등 점수와 꼴찌 점수. picks 가 점수 내림차순이라 top 은 곧
     최고점이다. 카드마다 다시 세지 않도록 여기서 한 번 낸다. */
  const top = picks[0]?.fit ?? 0
  const lo = Math.min(...picks.map((x) => x.fit))

  return (
    <div style={{ marginTop: 18 }}>
      <div ref={vpRef}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onPointerDown={onPointerDown}
        style={{
          overflow: 'hidden', touchAction: 'pan-y',
          cursor: drag.current ? 'grabbing' : 'grab',
          userSelect: dragX ? 'none' : 'auto',
        }}>
        <div onTransitionEnd={onEnd} style={{
          display: 'flex', gap: GAP,
          transform: `translateX(${(vw - slideW) / 2 - pos * (slideW + GAP) + dragX}px)`,
          transition: anim ? 'transform .55s ease' : 'none',
        }}>
          {items.map((p, i) => (
            /* 가운데만 제 크기, 나머지는 줄이고 흐린다 — 지금 읽을 카드가 어느 것인지를
               크기가 말하게 한다. scale 은 자리를 차지하지 않아서 트랙 계산이 안 흔들린다.
               옆 카드는 눌러서 가운데로 부른다 — 드래그 끝의 클릭은 clickBlock 이 막는다. */
            <div key={i}
              onClick={() => {
                if (clickBlock.current) { clickBlock.current = false; return }
                if (i !== pos) { setAnim(true); setPos(i) }
              }}
              style={{
                width: slideW, flexShrink: 0,
                transform: i === pos ? 'scale(1)' : 'scale(0.88)',
                opacity: i === pos ? 1 : 0.5,
                transition: anim ? 'transform .55s ease, opacity .55s ease' : 'none',
                cursor: i === pos ? 'default' : 'pointer',
              }}>
              <Card p={p} no={((i - K) % n + n) % n + 1} top={top} lo={lo} w={slideW} />
            </div>
          ))}
        </div>
      </div>

      {/* 지금 몇 등을 보고 있나 — 열 개 점. 누르면 그 자리로 간다. */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 16 }}>
        {picks.map((_, i) => (
          <button key={i} type="button" aria-label={`${i + 1}등으로`}
            onClick={() => { setAnim(true); setPos(K + i) }}
            style={{
              width: active === i ? 18 : 7, height: 7, borderRadius: 100, border: 0, padding: 0,
              cursor: 'pointer', transition: 'width .2s ease, background .2s ease',
              background: active === i ? T.brand : '#D9DEE4',
            }} />
        ))}
      </div>
    </div>
  )
}

/* 인재 카드 — 어드민 인재풀 카드와 같은 행 구성(경력·학력·주요이력·외국어·포폴·기술)이되
   이름 자리에 직무가 온다. 행을 항상 렌더하고 높이를 고정하는 것도 같은 이유다:
   카드마다 행이 들쭉날쭉하면 다섯 명을 나란히 비교할 수가 없다. */
const oneLine = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }



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

/* 카드 디자인은 한 벌이다. 열 장이 같은 옷을 입는다.

   전에는 껍데기를 세 단계로 갈랐다(1등 크림 / 2·3등 금색 / 4~10등 흰색). 그런데 등수
   알약을 뺀 뒤로 그 층이 아무 말도 못 하게 됐다 — 알약이 없으니 금색 카드를 봐도 그게
   2등이라는 걸 알 방법이 없고, 흰 카드는 순위가 아니라 덜 공들인 카드로 읽힌다.
   순서는 카로셀의 점과 게이지가 이미 말하고 있으니, 껍데기까지 등수를 나눌 이유가 없다.

   테두리는 안 쓴다. 카드 안에 이미 '추천 이유' 상자가 테두리를 두르고 있어서, 바깥에도
   선을 그으면 상자 안에 상자가 되고 그때부터 두 선이 서로 뭘 묶는지가 안 읽힌다.
   선은 안쪽 하나만 남기고, 바깥은 바탕색과 그림자로만 세운다. */
const CARD_SHELL = {
  background: '#FFF7F1',
  shadow: '0 20px 48px rgba(255,107,0,.18), 0 4px 12px rgba(16,24,40,.08)',
}
// 사진을 두르는 링. 바탕과 같은 계열이되 한참 옅다 — 링이 사진보다 먼저 보이면
// 이 자리의 주인공이 바뀐다.
const CARD_RING = '#FFD9BE'
/* '추천 이유' 칸의 색 — 테두리·제목·키워드 칩. 칩은 '채운 칩'이어야 한다. 이 칩은
   장식이 아니라 "선택 기준에 걸린 스택"이라는 뜻이고, 바로 아래 회색 칩(안 걸린 나머지)과의
   대비가 그 뜻을 만든다. 둘 다 옅게 깔면 무엇이 걸린 건지 알 수 없다. */
const CARD_ACCENT = { line: '#FF6B00', ink: '#FF6B00', chip: '#FF6B00', chipInk: '#FFEFE3' }

/* 경력 — "1.7년"이 아니라 "1년 8개월". 소수점 년수는 계산기 말이지 사람 말이 아니다.
   yoeM(개월)이 정답이고, 캐시된 옛 응답에는 그 필드가 없어서 년수에서 되짚는다. */
const yoeText = (p) => {
  const m = p.yoeM ?? (p.yoe != null ? Math.round(p.yoe * 12) : null)
  if (m == null) return null
  if (m === 0) return '신입'
  const y = Math.floor(m / 12)
  const r = m % 12
  return y === 0 ? `${r}개월` : r === 0 ? `${y}년` : `${y}년 ${r}개월`
}

/* 적합도 게이지 — 점수(0~100)를 그대로 띄우던 자리다.

   숫자를 뺀 이유: fit 은 인재풀 1,600명 전체를 놓고 낸 절대평가라, 이 화면의 열 명끼리
   비교하는 데 쓰면 뜻이 흐려진다. 어떤 검색은 1등이 100이고 어떤 검색은 73인데(실측),
   고객사는 "73점"이 잘한 건지 못한 건지 알 방법이 없다. 여기서 알고 싶은 건 절대 점수가
   아니라 '1등과 얼마나 차이 나나'이고, 그건 숫자보다 칸으로 보는 게 빠르다.

   채우는 법: 여섯 칸짜리다. 1등은 여섯 칸을 다 채우고, 꼴찌도 두 칸에서 멈춘다.
   나머지는 1등과의 격차를 이번 검색의 전체 격차(1등−꼴찌)로 나눠 그 사이에 놓는다.

   바닥을 한 칸이 아니라 두 칸으로 둔 이유: 우리가 골라서 보내는 열 명이다. 그중 하나가
   거의 빈 게이지를 달고 있으면 그건 우리가 우리 추천에 적어 넣는 마이너스다. 꼴찌라는
   사실은 등수가 이미 말하고 있으니, 게이지까지 바닥을 보여줄 이유가 없다.

   1등 대비 단순 비율(fit/top×6)로 하면 안 된다 — 실제 결과를 보면 점수가 좁게 몰려서
   (폭 18~40) 열 장이 전부 5칸 아니면 6칸으로만 나온다.

   카드 순서가 점수 내림차순이라(jd-match 의 byScore) 칸도 등수를 따라 단조롭게 내려간다.
   예전엔 뽑는 순서를 그대로 세워서 4등이 3등보다 높은 칸을 다는 일이 있었다. */
const GAUGE_N = 6
const GAUGE_MIN = 2
const gaugeOf = (fit, top, lo) => {
  if (!(top > lo)) return GAUGE_N // 열 명이 같은 점수 — 가를 것이 없다
  const g = GAUGE_N - Math.round((GAUGE_N - GAUGE_MIN) * ((top - fit) / (top - lo)))
  return Math.max(GAUGE_MIN, Math.min(GAUGE_N, g))
}

/* 추천 이유 앞의 체크. 시안은 ✅ 이모지였는데 그건 OS 가 그리는 그림이라 안드로이드·윈도우
   ·맥에서 모양도 초록도 다 다르다 — 이 화면의 사진 실루엣을 이모지로 안 둔 것과 같은 이유다.
   색은 초록 대신 카드의 브랜드 색을 쓴다. 초록은 이 화면 어디에도 없는 색이라 네 줄이
   통째로 외부에서 붙여온 것처럼 뜬다. 같은 색이면 카드 안에서 같은 편으로 읽힌다. */
const Check = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"
    style={{ display: 'block', flexShrink: 0, marginTop: size * 0.22 }}>
    <circle cx="10" cy="10" r="10" fill={color} />
    <path d="M5.6 10.3l2.9 2.9 5.9-6.4" fill="none" stroke="#fff" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Gauge = ({ n }) => (
  <span aria-label={`적합도 ${n}/${GAUGE_N}`} style={{ display: 'inline-flex', gap: 3 }}>
    {Array.from({ length: GAUGE_N }, (_, i) => (
      <span key={i} style={{
        width: 13, height: 8, borderRadius: 2,
        background: i < n ? T.brand : '#E4E8ED',
      }} />
    ))}
  </span>
)

/* 인재 카드 — 시안(1436×1333 아트보드)을 옮긴 것.

   기하(여백·지름·모서리·간격)는 아트보드 대비 비율 s 로 줄이고, 글자 크기만 하한을 둔다.
   아트보드가 카드 실제 폭(500~560px)의 2.5배라 그대로 줄이면 캡션이 5.9px 가 되어
   읽을 수가 없다 — 비율을 지키는 것보다 읽히는 게 먼저다.

   배치는 절대좌표가 아니라 흐름으로 짰다. 추천 이유 칸의 줄 수가 사람마다 다른데
   아트보드처럼 높이를 박아 두면 긴 사람의 글이 상자 밖으로 샌다. */
const CARD_W = 1436 // 시안 아트보드 폭 — 모든 치수의 기준

function Card({ p, no, top, lo, w = 560 }) {
  const s = w / CARD_W
  const px = (n) => n * s
  const f = (n, min) => Math.max(min, n * s)

  /* 카드 껍데기와 등수 알약만 세 단계로 갈린다(1등 / 2·3등 / 4~10등).
     안쪽 '추천 이유' 칸의 주황은 등수와 무관하게 그대로 둔다 — 그건 등수 표시가 아니라
     이 칸이 무엇인지를 말하는 색이라, 등수를 따라 흐려지면 4등부터는 뭘 읽는 칸인지가
     같이 흐려진다. 위계는 껍데기가 지고, 내용은 열 장이 같은 규칙으로 읽힌다. */
  const shell = CARD_SHELL
  // 사진 링 — 테두리 색을 그대로 쓰면 너무 진해서 사진보다 링이 먼저 보인다. 옅게 깐다.
  const ring = CARD_RING
  const accent = CARD_ACCENT

  const seg = no === 1 ? GAUGE_N : gaugeOf(p.fit, top, lo)
  const cost = costOf(p.yoe)
  const hits = p.hits || []
  const rest = (p.skills || []).filter((x) => !hits.includes(x))
  /* 추천 이유 — 시안의 ✅ 목록 자리. jd-match 가 후보마다 3~4줄로 준다.
     bullets(이력서 파서가 뽑은 관련 경험)는 여기 안 섞는다 — 그건 '무엇을 했나'이지
     '왜 이 사람인가'가 아니라서, 같이 놓으면 추천 이유가 이력서 발췌로 읽힌다.
     캐시(#5)로 저장된 옛 응답에는 reasons 가 없다 — 그때는 한 문장짜리 why 로 떨어진다. */
  const reasons = (p.reasons?.length ? p.reasons : [p.why]).filter(Boolean)
  const meta = [yoeText(p) && `경력 ${yoeText(p)}`, p.english && `영어 ${p.english}`,
    p.korean && `한국어 ${p.korean}`].filter(Boolean)

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: shell.background, boxShadow: shell.shadow,
      borderRadius: px(40), padding: `${px(44)}px ${px(75)}px ${px(60)}px`,
    }}>
      {/* 머리줄 — 적합도 하나만. 등수 알약은 뺐다.

          카드는 카로셀에서 한 장씩 보이고 아래 점이 몇 번째인지를 이미 말한다. 거기에
          "3등"까지 붙이면 이 사람의 첫인상이 순위가 되는데, 고객사가 볼 것은 등수가 아니라
          이 사람이 자리에 맞느냐다. 순위는 카드 껍데기(1등/2·3등/4~10등)와 게이지가
          여전히 말하고 있어서 정보가 사라지지도 않는다. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: px(20) }}>
        <span title={`자격요건 ${p.met}/${p.total} 충족 · ${p.rank}급`}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: px(20) }}>
          {/* 게이지는 이 열 명 사이의 상대 위치, 이 라벨은 인재풀 전체를 놓고 본 절대 평가다 */}
          <span style={{ fontSize: f(24, 10.5), fontWeight: 700, color: T.brand }}>
            {p.fit >= 90 ? '매우 적합' : p.fit >= 80 ? '적합' : '조건 근접'}
          </span>
          <Gauge n={seg} />
        </span>
      </div>

      {/* 사진 + 직무·경력.

          사진은 두꺼운 링 하나를 두른다. 시안의 검은 실선 두 겹은 피그마에서 자리를 잡느라
          그린 선이라 그대로 옮기면 도면처럼 보인다 — 링은 카드 바탕색을 옅게 깐 것이라
          사진이 카드 위에 얹힌 것으로 보인다. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: px(37), marginTop: px(20) }}>
        <div style={{
          width: px(273), height: px(273), borderRadius: '50%', flexShrink: 0,
          border: `${px(8)}px solid ${ring}`, boxSizing: 'border-box',
          background: '#fff', overflow: 'hidden',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff',
          }}>
            {p.photo
              ? <img src={p.photo} alt="" referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : (
                // 사진 없음 — 이모지 대신 실루엣. 이모지는 OS 마다 생김새가 다르다.
                <svg viewBox="0 0 72 72" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
                  <circle cx="36" cy="28" r="13" fill="#D8DEE5" />
                  <path d="M36 44c-16 0-26 10-28 32h56c-2-22-12-32-28-32z" fill="#D8DEE5" />
                </svg>
              )}
          </div>
        </div>

        {/* 글이 도장 밑으로 들어가지 않게 폭을 잘라 둔다. 도장은 카드 오른쪽에 겹쳐 찍히는데
            어학이 길면(예: "영어 Professional Working Proficiency") 그 밑으로 흘러 들어가
            읽을 수 없게 된다. 도장 왼쪽 끝(시안 x=866)에서 글이 멈추게 하고, 넘치는 만큼은
            두 줄로 내려 쓴다 — 잘라서 말줄임을 붙이면 정작 어학 수준이 사라진다. */}
        <div style={{ minWidth: 0, flex: 1, maxWidth: px(481) }}>
          {/* 이름을 감춘 화면이라 이 줄이 사실상 이 사람의 이름이다 */}
          <div title={p.title} style={{
            fontSize: f(30, 13.5), fontWeight: 700, color: '#111', letterSpacing: '-0.02em',
            lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{p.title || '직무 미상'}</div>

          {/* 없는 값은 칸을 통째로 비운다 — '미상'은 우리가 손으로 적는 마이너스다 */}
          {!!meta.length && (
            <div style={{
              marginTop: px(12), fontSize: f(30, 11.5), fontWeight: 500, color: '#111',
              lineHeight: 1.45, minWidth: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }} title={meta.join(' | ')}>
              {meta.map((m, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: '#C9CFD6', margin: `0 ${px(12)}px` }}>|</span>}
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* 열 명을 채우려고 기준 아래에서 데려온 사람만 표시한다 */}
          {p.rank === '탈락' && (
            <div title={`요건 ${p.met}/${p.total} 충족`} style={{
              display: 'inline-block', marginTop: px(14),
              fontSize: f(20, 9.5), fontWeight: 700, color: '#B42318',
              background: '#FEF3F2', border: '1px solid #FEE4E2', borderRadius: px(16),
              padding: `${px(6)}px ${px(20)}px`,
            }}>조건 일부 미달</div>
          )}
        </div>
      </div>

      {/* 추천 이유 — 테두리 안에는 제목과 걸린 키워드까지만 둔다.

          체크 목록을 상자 안에 같이 넣었더니 상자가 카드 절반을 먹었다. 테두리는 무언가를
          묶는 표시인데, 묶인 것이 많아지면 묶은 뜻이 사라진다. 상자는 '이 사람이 가진,
          기준에 걸린 스택' 하나만 묶고, 읽는 문장은 밖에서 본문으로 흐르게 한다. */}
      {/* 위로 올리는 건 relative 로만 — marginTop 을 줄이면 아래 체크 목록·기술 칩이
          통째로 딸려 올라온다. 자리는 흐름에 그대로 두고 그린 것만 살짝 올린다.
          도장은 이보다 더 올라가 있다(상자와 30 을 맞추던 관계는 깼다) — 칩이 늘면
          도장 밑으로 들어가서, 둘을 같은 값으로 묶어 두면 칩을 늘릴 때마다 겹친다. */}
      <div style={{
        position: 'relative', top: px(-30),
        marginTop: px(82), border: `1px solid ${accent.line}`, borderRadius: px(30),
        padding: `${px(36)}px ${px(40)}px ${px(32)}px`,
      }}>
        <div style={{ fontSize: f(30, 12), fontWeight: 700, color: accent.ink }}>추천 이유✨</div>

        {/* 조건에 걸린 기술만 채운 칩. 아래 회색 칩과 색으로 갈려서 라벨이 필요 없다. */}
        {!!hits.length && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${px(12)}px ${px(11.8)}px`, marginTop: px(14) }}>
              {hits.slice(0, 6).map((k) => (
                <span key={k} style={{
                  background: accent.chip, color: accent.chipInk, borderRadius: px(11.8),
                  padding: `${px(8.8)}px ${px(23.6)}px`,
                  fontSize: f(29.4, 11), fontWeight: 600, whiteSpace: 'nowrap',
                }}>{k}</span>
              ))}
            </div>
            <div style={{ marginTop: px(16), fontSize: f(15, 9), fontWeight: 500, color: '#AEAEAE' }}>
              이 핵심 키워드를 모두 보유하고 있어요!
            </div>
          </>
        )}
      </div>

      {/* 체크 목록 — 상자 밖. 카드에서 유일하게 '읽는' 글이라 본문처럼 놓인다. */}
      {!!reasons.length && (
        <div style={{
          marginTop: px(52), fontSize: f(30, 11.5), fontWeight: 500, color: '#111',
          lineHeight: 50 / 30,
          display: 'flex', flexDirection: 'column', gap: px(10),
        }}>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: px(14) }}>
              <Check size={Math.max(13, px(34))} color={accent.chip} />
              <span style={{ minWidth: 0 }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* 나머지 기술 — 조건에 안 걸린 것들. 두 줄에서 자른다(사람마다 개수가 달라서). */}
      {!!rest.length && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start',
          gap: `${px(12)}px ${px(11.8)}px`, marginTop: px(46),
          maxHeight: px(53.7 * 2 + 12), overflow: 'hidden',
        }}>
          {rest.map((k) => (
            <span key={k} style={{
              background: '#F8FAFC', color: '#64748B', borderRadius: px(11.8),
              padding: `${px(8.8)}px ${px(23.6)}px`,
              fontSize: f(29.4, 11), fontWeight: 600, whiteSpace: 'nowrap',
            }}>{k}</span>
          ))}
          {!!p.skillsMore && (
            <span style={{ alignSelf: 'center', fontSize: f(24, 10), color: T.faint }}>+{p.skillsMore}</span>
          )}
        </div>
      )}

      {/* 예상 급여 도장. 고객사가 카드에서 두 번째로 묻는 값이라 먼저 눈에 걸려야 한다.
          글자는 도장의 띠 위에 얹는다. 띠가 18도 기울어 있어 같이 돌린다.

          자리와 크기는 키워드 칩 줄이 정한다. 칩은 사람마다 개수가 달라 여섯 개쯤이면
          카드 폭을 다 쓰는데, 그 줄과 겹치면 정작 '기준에 걸린 스택'이 안 읽힌다.
          칩을 두 줄로 내려 피하는 방법도 있었지만 그건 칩이 많은 사람만 카드가 길어진다 —
          지름과 세로 위치는 한 쌍이다 — 작을수록 아래로 내려도 칩 줄에 안 닿는다.
          시안 크기(487)로는 칩을 피하려면 머리줄까지 올라가야 해서 지름을 380 으로 줄였다.
          도장 아래 끝이 칩 줄 바로 위에서 멈춘다 — 카드 위쪽 여백을 조일 때는 이 값도 같은
          만큼 올려야 한다. 도장만 흐름 밖(absolute)이라 저 혼자 제자리에 남는다. */}
      <div aria-hidden style={{
        position: 'absolute', top: px(148), right: px(130),
        width: px(380), height: px(380), pointerEvents: 'none', zIndex: 2,
        // 도장만 반시계로 4도. 안쪽 띠·글자의 18도는 이 위에 얹히므로 함께 돌아간다.
        transform: 'rotate(-4deg)',
      }}>
        {/* 도장 뒤 배경(원 + 띠). 시안은 이걸 #FFF7F1 로 박아 뒀는데 그건 1등 카드 색이라,
            금색(2·3등)과 흰 카드(4~10등) 위에서는 색이 어긋난 조각으로 보인다. 그래서
            에셋에 굽지 않고 여기서 카드 바탕색으로 깐다 — 도장이 어느 카드에 찍히든
            뒤가 그 카드와 같은 종이가 된다.
            띠 치수는 시안의 회전된 바운딩 박스(469.5×253.5)를 18도로 되풀어 낸 값이다. */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '75.6%', height: '75.6%', borderRadius: '50%', background: shell.background,
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%) rotate(18deg)',
          width: '93.7%', height: '23.4%', background: shell.background,
        }} />

        <img src="/stamp.svg" alt=""
          style={{ position: 'relative', width: '100%', height: '100%', display: 'block' }} />

        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* 글자는 도장 한가운데 — 뒤에 깔아 둔 띠와 같은 중심, 같은 각도다.
              시안 좌표를 그대로 옮겼을 땐 중심보다 17 위에 있었는데, 그건 아트보드에서
              띠를 눈으로 맞춘 값이라 띠를 코드로 그린 지금은 어긋난다. */}
          <div style={{
            transform: 'rotate(18deg)',
            textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.25,
          }}>
            <div style={{ fontSize: f(16, 8.5), fontWeight: 500, color: '#B09E90' }}>
              예상 급여{cost ? ` · ${cost.label}` : ''}
            </div>
            <div style={{ fontSize: f(45, 15), fontWeight: 700, color: '#C90B0A', letterSpacing: '-0.02em' }}>
              {cost ? `${cost.won}만원/월` : '별도 협의'}
            </div>
          </div>
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
