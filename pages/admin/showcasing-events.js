import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin } from '../../lib/adminSwr'
import AdminLayout from '../../components/admin/AdminLayout'
import { sectionStyle } from '../../constants/dashboard'

/* /admin/showcasing-events — 비공개 인재 전시장(/private/showcasing)의 이벤트 로그.
   (내부 작업용이라 한국어만 — /admin/lang-scores 와 같다)

   전시장은 링크를 아는 사람이면 그냥 열리는 화면이라, 누가 왔는지는 계정으로 못 센다.
   그래서 여기서 보는 건 사람이 아니라 '무슨 일이 일어났나'다 — 열렸나, JD 를 넣었나,
   파일이었나 글이었나. meta 를 접지 않고 그대로 펴 두는 것도 같은 이유다: 정리해서
   보여주려면 무엇을 볼지 미리 정해야 하는데, 아직 무엇이 궁금해질지 모른다.

   데이터: /api/admin/showcasing-events (최근 300건) */

const th = { textAlign: 'left', padding: '7px 8px', fontSize: 11, fontWeight: 700, color: '#8B95A1' }
const td = { padding: '8px', fontSize: 12, color: '#4E5968', verticalAlign: 'top' }

// meta 에서 기업 칸으로 이미 뽑아 쓴 것만 빼고 나머지를 그대로 — 같은 값이 한 줄에
// 두 번 보이면 새로 들어온 키를 눈이 못 잡는다.
function restMeta(meta) {
  if (!meta) return ''
  const { co, campaign, ...rest } = meta
  return Object.keys(rest).length ? JSON.stringify(rest) : ''
}

// 2026-08-05T04:03:11Z → 08-05 11:03 (베트남 시각, UTC+7)
function vnTime(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

export default function AdminShowcasingEvents() {
  const [token, setToken] = useState(null)
  const [pick, setPick] = useState(null) // 이벤트 이름 필터. null = 전체

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setToken(session?.access_token || null))
  }, [])

  const { data, error, isLoading } = useAdmin('/api/admin/showcasing-events', token)

  const rows = data?.rows || []
  const shown = pick ? rows.filter((r) => r.event === pick) : rows
  const names = Object.keys(data?.counts || {}).sort((a, b) => data.counts[b] - data.counts[a])

  return (
    <AdminLayout>
      <Head><title>이벤트 로그 보기 · FYI Admin</title></Head>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 60px' }}>
        {/* 제목 바로 아래 — 링크를 만들기 전에 읽어야 하는 주의사항이라 맨 위에 둔다.
            우리가 확인하려고 연 것이 그 기업이 연 것으로 남으면, 로그를 다시 못 믿는다. */}
        <div style={{ fontSize: 12, color: '#8B95A1', lineHeight: 1.7, margin: '2px 0 16px' }}>
          회사 계정으로 로그인된 상태로 링크에 들어가면 이벤트 집계는 안 됩니다.<br />
          다만 로그아웃 또는 다른 계정으로 링크 접속 시엔 주소 뒤에{' '}
          <code style={{ fontSize: 11.5, background: '#F7F8FA', border: '1px solid #F2F4F6', borderRadius: 5, padding: '1px 5px' }}>&amp;qa=1</code>
          {' '}붙여주세요.
        </div>

        <LinkMaker token={token} />

        {error && <div style={{ ...sectionStyle, color: '#DC2626' }}>불러오지 못했습니다 — {error.message}</div>}
        {isLoading && !data && <div style={{ ...sectionStyle, color: '#8B95A1' }}>불러오는 중…</div>}

        {data && (
          <div style={sectionStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, color: '#191F28' }}>
              /private/showcasing
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
                최근 {data.limit}건까지 · 베트남 시각
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: rows.length ? 12 : 0 }}>
              <span style={{ color: '#4E5968', fontWeight: 600 }}>{rows.length}건</span>
              {' · 기업 '}{data.companies}{' · 브라우저 '}{data.visitors}
            </div>

            {!rows.length ? (
              <div style={{ fontSize: 12.5, color: '#8B95A1', lineHeight: 1.7, marginTop: 10 }}>
                아직 찍힌 이벤트가 없습니다.<br />
                전시장 화면에서 <code style={{ fontSize: 11.5 }}>track(이름, {'{'} page: '/private/showcasing' {'}'})</code>
                {' '}로 보내면 여기 쌓입니다.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Chip on={!pick} onClick={() => setPick(null)} label="전체" n={rows.length} />
                  {names.map((name) => (
                    <Chip
                      key={name}
                      on={pick === name}
                      onClick={() => setPick(pick === name ? null : name)}
                      label={name}
                      n={data.counts[name]}
                    />
                  ))}
                </div>

                <div className="adm-m-scroll">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 92 }}>시각</th>
                        <th style={{ ...th, width: 150 }}>이벤트</th>
                        <th style={{ ...th, width: 140 }}>기업</th>
                        <th style={{ ...th, width: 92 }}>브라우저</th>
                        <th style={th}>meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.id} style={{ borderTop: '1px solid #F2F4F6' }}>
                          <td style={{ ...td, whiteSpace: 'nowrap', color: '#8B95A1' }}>{vnTime(r.created_at)}</td>
                          <td style={{ ...td, fontWeight: 600, color: '#191F28' }}>{r.event}</td>
                          {/* 기업이 비어 있으면 토큰 없는 맨 주소로 들어온 것 — 우리가 직접 열었거나 링크가 옮겨 다녔거나. */}
                          <td style={{ ...td, fontWeight: r.meta?.co ? 600 : 400, color: r.meta?.co ? '#191F28' : '#D1D6DB' }}>
                            {r.meta?.co || '직접'}
                          </td>
                          {/* 같은 사람인지만 알면 되니 앞 6자리. 전부 보여줘도 읽히지 않는다. */}
                          <td style={{ ...td, color: '#B0B8C1', fontFamily: 'ui-monospace, monospace' }}>
                            {r.client_id ? r.client_id.slice(0, 6) : '—'}
                          </td>
                          <td style={{ ...td, wordBreak: 'break-all' }}>{restMeta(r.meta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

/* 링크 생성하기 — 콜드메일 한 통에 붙일 주소를 기업별로 하나씩 뽑는다.

   서명은 서버에서 한다(시크릿이 서버에만 있다 — lib/showcaseToken.js). 그래서 버튼이
   API 를 부른다. 만들어 둔 링크를 어디에 저장하지는 않는다: 무상태 토큰이라 같은
   기업명을 넣으면 언제나 같은 주소가 나오고, 그러면 '발급 목록'이라는 관리할 거리가
   하나 안 생긴다. 대신 실제로 열린 링크는 아래 로그에 기업 이름으로 남는다. */
function LinkMaker({ token }) {
  const [company, setCompany] = useState('')
  const [made, setMade] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  // 만들어 둔 링크 목록. 아직 아무도 안 연 링크는 events 에 흔적이 없어서
  // 여기서만 보인다 — 그게 사실 제일 봐야 할 줄이다(보냈는데 반응이 없는 기업).
  const { data, mutate } = useAdmin('/api/admin/showcase-link', token)
  const links = data?.rows || []

  const drop = async (l) => {
    if (!window.confirm(`${l.company} 링크의 추적을 끊습니다.\n\n이미 보낸 메일의 주소는 계속 열리지만, 이제부터 이벤트가 기록되지 않습니다.\n(지금까지 쌓인 기록은 아래 로그에 그대로 남습니다)`)) return
    setErr('')
    try {
      const r = await fetch(`/api/admin/showcase-link?token=${encodeURIComponent(l.token)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '추적을 끊지 못했습니다')
      if (made?.token === l.token) setMade(null)
      mutate()
    } catch (e) {
      setErr(e.message)
    }
  }

  const make = async () => {
    if (!company.trim() || busy) return
    setBusy(true); setErr(''); setCopied(false)
    try {
      const r = await fetch('/api/admin/showcase-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ company }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '만들지 못했습니다')
      setMade(j)
      mutate()
    } catch (e) {
      setErr(e.message)
      setMade(null)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(made.url); setCopied(true) } catch { setErr('복사에 실패했습니다 — 주소를 직접 선택해 복사해주세요') }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, color: '#191F28' }}>
        링크 생성하기
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
          기업마다 다른 주소를 주면, 아래 로그에 어느 기업이 열었는지가 남는다
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }} className="adm-m-wrap">
        <input
          value={company}
          onChange={(e) => { setCompany(e.target.value); setMade(null); setCopied(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') make() }}
          placeholder="기업명 (예: MPNX)"
          style={{
            flex: '1 1 220px', minWidth: 0, fontFamily: 'inherit', fontSize: 13,
            padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E8EB',
            outline: 'none', color: '#191F28',
          }}
        />
        <button
          type="button"
          onClick={make}
          disabled={!company.trim() || busy}
          style={{
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff',
            background: company.trim() && !busy ? '#191F28' : '#D1D6DB',
            border: 0, borderRadius: 8, padding: '8px 16px',
            cursor: company.trim() && !busy ? 'pointer' : 'default',
          }}
        >
          {busy ? '만드는 중…' : 'URL 생성'}
        </button>
      </div>

      {!!err && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{err}</div>}

      {made && (
        <div style={{
          marginTop: 10, border: '1px solid #F2F4F6', background: '#FAFBFC',
          borderRadius: 10, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 5 }}>{made.company} · {made.campaign}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 12, color: '#191F28', wordBreak: 'break-all',
              fontFamily: 'ui-monospace, monospace',
            }}>{made.url}</span>
            <button
              type="button"
              onClick={copy}
              style={{
                flexShrink: 0, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                color: copied ? '#16A34A' : '#4E5968', background: '#fff',
                border: `1px solid ${copied ? '#16A34A' : '#E5E8EB'}`,
                borderRadius: 100, padding: '5px 12px', cursor: 'pointer',
              }}
            >
              {copied ? '복사됨' : 'URL 복사'}
            </button>
          </div>
        </div>
      )}

      {/* 추적 중인 링크 — 만든 것 전부. 열린 적 없는 줄이 여기서만 보인다. */}
      {!!links.length && (
        <div style={{ marginTop: 18, borderTop: '1px solid #F2F4F6', paddingTop: 14 }}>
          <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 8 }}>
            추적 중인 링크 <span style={{ color: '#4E5968', fontWeight: 600 }}>{links.length}</span>
            {' · 추적을 끊어도 주소는 계속 열린다 — 이벤트만 안 쌓인다'}
          </div>
          <div className="adm-m-scroll">
            {/* 기업 열을 고정폭으로 묶고 남는 폭은 버튼 칸이 먹는다 — 이름 길이에 따라
                버튼 위치가 줄마다 달라지면 누르려고 매번 눈으로 찾아야 한다. */}
            <table className="adm-m-nowrap" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 190 }}>기업</th>
                  <th style={{ ...th, textAlign: 'right', width: 52 }}>열림</th>
                  <th style={{ ...th, textAlign: 'right', width: 52 }}>제출</th>
                  <th style={{ ...th, textAlign: 'right', width: 52 }}>미팅</th>
                  <th style={{ ...th, width: 88 }}>마지막</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.token} style={{ borderTop: '1px solid #F2F4F6' }}>
                    {/* 긴 기업명은 잘라서 표시하고 전체는 title 로 — 한 줄을 지키는 게
                        이름 끝까지 보이는 것보다 낫다. */}
                    <td style={{ ...td, fontWeight: 600, color: '#191F28', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.company}>
                      {l.company}
                      {l.campaign !== 'showcase1' && (
                        <span style={{ fontWeight: 500, color: '#B0B8C1', marginLeft: 6 }}>{l.campaign}</span>
                      )}
                    </td>
                    {/* 열림은 혼자서는 신호가 못 된다 — 메일 스캐너가 대신 눌러줄 수 있다. */}
                    <td style={{ ...td, textAlign: 'right', color: l.opens ? '#191F28' : '#D1D6DB' }}>{l.opens}</td>
                    <td style={{ ...td, textAlign: 'right', color: l.submits ? '#191F28' : '#D1D6DB' }}>{l.submits}</td>
                    {/* 미팅 신청이 이 표의 결론이다 — 링크를 보낸 이유가 이 숫자다. */}
                    <td style={{ ...td, textAlign: 'right', fontWeight: l.meetings ? 700 : 400, color: l.meetings ? '#16A34A' : '#D1D6DB' }}>{l.meetings}</td>
                    <td style={{ ...td, color: '#8B95A1' }}>{l.lastAt ? vnTime(l.lastAt) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(l.url)} style={miniBtn}>URL 복사</button>
                      <button type="button" onClick={() => drop(l)} style={{ ...miniBtn, marginLeft: 5, color: '#DC2626', borderColor: '#F5C6C6' }}>추적 끊기</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const miniBtn = {
  fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: '#4E5968',
  background: '#fff', border: '1px solid #E5E8EB', borderRadius: 100,
  padding: '3px 9px', cursor: 'pointer',
}

function Chip({ on, onClick, label, n }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, lineHeight: 1.6,
        padding: '4px 11px', borderRadius: 100, cursor: 'pointer',
        border: `1px solid ${on ? '#191F28' : '#E5E8EB'}`,
        background: on ? '#191F28' : '#fff',
        color: on ? '#fff' : '#4E5968',
      }}
    >
      {label} <span style={{ opacity: 0.65 }}>{n}</span>
    </button>
  )
}
