import { useRef, useState } from 'react'
import Head from 'next/head'

/* /private/showcasing — 고객사에 보여줄 인재 전시장(비공개).

   "비공개"의 뜻은 인증이 아니라 '안 알려진 주소'다 — 링크를 아는 사람은 그냥 열린다.
   그래서 두 가지가 이 페이지의 전제다.

   1) 검색엔진에 절대 안 잡혀야 한다. robots.txt 는 Allow: / 이므로 여기서 noindex 를
      직접 건다(robots.txt 에 Disallow 를 적으면 오히려 주소를 광고하는 꼴이다).
   2) 링크가 한 번 새면 회수가 안 된다. 그래서 후보의 실명·이메일·이력서 원본 링크는
      이 화면에 올리지 않는다 — 어드민(/admin/lang-scores)의 전시장과 다른 점이 그거다.
      이력서 파일 URL 은 Storage 직링이라 한 번 새면 계속 열린다.

   첫 화면은 목록이 아니라 질문이다. 조건을 칩으로 고르게 하면 우리가 미리 정해 둔
   축(직군·년차·어학)으로만 말할 수 있는데, 뽑는 쪽의 진짜 조건은 JD 안에 문장으로
   들어 있다. 그래서 JD 를 통째로 받는다.

   글과 파일 두 입구가 결국 같은 입력칸 하나로 모인다 — 파일은 입력 수단일 뿐이고,
   화면에 보이는 글이 우리가 읽은 전부다. 무엇을 읽었는지 눈으로 보고 고칠 수 있어야
   "이 조건이 아닌데요" 가 나중이 아니라 여기서 나온다. 파일은 저장하지 않는다
   (/api/private/jd-extract). */

const ACCEPT = '.pdf,.docx,.txt,.md'

export default function PrivateShowcasing() {
  const [jd, setJd] = useState('')
  const [file, setFile] = useState('')     // 첨부해서 채운 경우 파일명 — 출처를 밝혀 둔다
  const [reading, setReading] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const fileRef = useRef(null)
  const boxRef = useRef(null)

  const grow = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 340)}px`
  }

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

  const submit = () => {
    if (!jd.trim() || reading) return
    setSent(true)
  }

  return (
    <>
      <Head>
        <title>Showcasing · FYI</title>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow" />
      </Head>

      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px 20px', background: '#fff',
      }}>
        <div style={{ width: '100%', maxWidth: 620 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: '#ff6000', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: -0.3,
          }}>FYI</div>

          <div style={{ fontSize: 24, fontWeight: 700, color: '#191F28', letterSpacing: -0.6 }}>
            안녕하세요
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#191F28', letterSpacing: -0.6, marginTop: 2 }}>
            구하시는 자리의 JD를 입력해주세요
          </div>
          <div style={{ fontSize: 13.5, color: '#8B95A1', marginTop: 10, lineHeight: 1.6 }}>
            공고 문구를 그대로 붙여넣으셔도 되고, 파일로 올리셔도 됩니다.
          </div>

          {sent ? (
            <Received jd={jd} file={file} onBack={() => setSent(false)} />
          ) : (
            <>
              {/* 입력칸 — 글이든 파일이든 여기 한 곳으로 모인다 */}
              <div style={{
                marginTop: 22, border: '1px solid #E5E8EB', borderRadius: 14, padding: '14px 14px 10px',
                background: '#fff',
              }}>
                <textarea
                  ref={boxRef}
                  value={jd}
                  onChange={(e) => { setJd(e.target.value); grow(e.target) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
                  }}
                  placeholder={'예) 하노이 오피스에서 일할 백엔드 개발자를 찾습니다.\nNode.js·PostgreSQL 3년 이상, 한국어 의사소통 가능하신 분…'}
                  rows={5}
                  style={{
                    width: '100%', border: 0, outline: 'none', resize: 'none', padding: 0,
                    fontFamily: 'inherit', fontSize: 14, lineHeight: 1.65, color: '#191F28',
                    background: 'transparent', minHeight: 118,
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    onChange={(e) => onPick(e.target.files?.[0])}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={reading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
                      fontSize: 12.5, fontWeight: 600, color: '#4E5968', background: '#F7F8FA',
                      border: '1px solid #F2F4F6', borderRadius: 100, padding: '5px 11px',
                      cursor: reading ? 'default' : 'pointer',
                    }}
                  >
                    {reading ? '읽는 중…' : '파일 첨부'}
                  </button>

                  {/* 파일에서 왔다는 표시 — 입력칸의 글이 사람이 쓴 건지 파서가 뽑은 건지 */}
                  {!!file && !reading && (
                    <span style={{
                      fontSize: 11.5, color: '#8B95A1', minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{file} 읽음</span>
                  )}

                  <button
                    type="button"
                    onClick={submit}
                    disabled={!jd.trim() || reading}
                    style={{
                      marginLeft: 'auto', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      color: '#fff', background: jd.trim() && !reading ? '#191F28' : '#D1D6DB',
                      border: 0, borderRadius: 100, padding: '7px 17px',
                      cursor: jd.trim() && !reading ? 'pointer' : 'default',
                    }}
                  >
                    보내기
                  </button>
                </div>
              </div>

              {!!err && (
                <div style={{ fontSize: 12.5, color: '#DC2626', marginTop: 9 }}>{err}</div>
              )}

              <div style={{ fontSize: 11.5, color: '#B0B8C1', marginTop: 10, lineHeight: 1.6 }}>
                PDF · DOCX · TXT · 5MB까지 · 올리신 파일은 저장하지 않습니다
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* 보낸 뒤 — 받은 JD 를 그대로 되비춰 준다. 무엇이 넘어갔는지 안 보이면
   결과가 이상할 때 조건이 잘못 읽힌 건지 후보가 없는 건지 구분이 안 된다.
   후보를 고르는 다음 화면은 아직 안 만들었다. */
function Received({ jd, file, onBack }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{
        border: '1px solid #F2F4F6', background: '#FAFBFC', borderRadius: 14, padding: '13px 15px',
        maxHeight: 260, overflow: 'auto',
      }}>
        <div style={{ fontSize: 11.5, color: '#B0B8C1', marginBottom: 6 }}>
          받은 JD{file ? ` · ${file}` : ''} · {jd.trim().length.toLocaleString()}자
        </div>
        <div style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {jd.trim()}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <div style={{ fontSize: 13, color: '#8B95A1' }}>
          잘 받았습니다. 후보를 추리는 다음 단계는 준비 중입니다.
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            marginLeft: 'auto', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            color: '#4E5968', background: 'none', border: '1px solid #E5E8EB',
            borderRadius: 100, padding: '6px 13px', cursor: 'pointer',
          }}
        >
          다시 입력
        </button>
      </div>
    </div>
  )
}
