import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin } from '../../lib/adminSwr'
import AdminLayout from '../../components/admin/AdminLayout'
import { sectionStyle } from '../../constants/dashboard'

/* /admin/showcasing-inquiries — 전시장(/private/showcasing)에서 들어온 상담 문의.
   (내부 작업용이라 한국어만 — /admin/lang-scores 와 같다)

   전시장에서 우리가 보는 건 여기 하나다 — "누가 우리에게 연락했나". 이 화면에
   한 줄이 생기는 것이 전시장을 만든 이유이므로, 열었을 때 제일 먼저 보여야 하는 건
   건수가 아니라 아직 연락 안 한 문의다.

   후보의 실명·이력서 링크가 보이는 유일한 화면이다 — 고객사 화면에는 카드 번호와
   직무만 있고, 이름은 미팅에서 사람이 건넨다.

   데이터: /api/admin/showcase-inquiries */

const STATUS = {
  new: { label: '신규', color: '#ff6000', bg: '#FFF7F2' },
  contacted: { label: '연락함', color: '#1A73E8', bg: '#F1F6FE' },
  met: { label: '미팅함', color: '#0D9488', bg: '#F0FAF8' },
  closed: { label: '종료', color: '#8B95A1', bg: '#F7F8FA' },
}
const ORDER = ['new', 'contacted', 'met', 'closed']

// 2026-08-05T04:03:11Z → 08-05 11:03 (베트남 시각, UTC+7)
function vnTime(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

export default function AdminShowcasingInquiries() {
  const [token, setToken] = useState(null)
  const [pick, setPick] = useState(null) // 상태 필터. null = 전체

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setToken(session?.access_token || null))
  }, [])

  const { data, error, isLoading, mutate } = useAdmin('/api/admin/showcase-inquiries', token)
  const rows = data?.rows || []
  const shown = pick ? rows.filter((r) => r.status === pick) : rows
  const counts = rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {})

  const setStatus = async (id, status) => {
    // 낙관적 갱신 — 상태 바꾸는 건 목록을 훑으며 연달아 하는 일이라, 한 번에 한 번씩
    // 서버를 기다리면 표가 계속 멈춘다.
    mutate({ rows: rows.map((r) => (r.id === id ? { ...r, status } : r)) }, false)
    try {
      await fetch('/api/admin/showcase-inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status }),
      })
    } finally {
      mutate()
    }
  }

  return (
    <AdminLayout>
      <Head><title>상담 문의 · FYI Admin</title></Head>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 60px' }}>
        <div style={{ fontSize: 12, color: '#8B95A1', lineHeight: 1.7, margin: '2px 0 16px' }}>
          고객사가 전시장에서 인재를 고르고 남긴 상담 요청입니다. 후보 실명과 이력서는 이 화면에만 보입니다.
        </div>

        {error && <div style={{ ...sectionStyle, color: '#DC2626' }}>불러오지 못했습니다 — {error.message}</div>}
        {isLoading && !data && <div style={{ ...sectionStyle, color: '#8B95A1' }}>불러오는 중…</div>}

        {data && (
          <div style={sectionStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#191F28' }}>
              상담 문의
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8B95A1', marginLeft: 7 }}>
                {rows.length}건 · 베트남 시각
              </span>
            </div>

            {!rows.length ? (
              <div style={{ fontSize: 12.5, color: '#8B95A1', lineHeight: 1.7 }}>
                아직 들어온 문의가 없습니다.<br />
                전시장 결과 화면에서 인재 카드를 누르면 여기 쌓입니다.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Chip on={!pick} onClick={() => setPick(null)} label="전체" n={rows.length} />
                  {ORDER.filter((s) => counts[s]).map((s) => (
                    <Chip key={s} on={pick === s} onClick={() => setPick(pick === s ? null : s)}
                      label={STATUS[s].label} n={counts[s]} />
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {shown.map((r) => <InquiryCard key={r.id} r={r} onStatus={setStatus} />)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

/* 문의 한 건 — 표가 아니라 카드인 이유는 한 건에 담긴 것이 서로 다른 종류라서다.
   연락처는 눈으로 읽고 복사하는 값이고, 후보 목록은 링크로 눌러 들어가는 값이고,
   상태는 손으로 바꾸는 값이다. 한 줄에 밀어 넣으면 셋 다 불편해진다. */
function InquiryCard({ r, onStatus }) {
  const s = STATUS[r.status] || STATUS.new
  return (
    <div style={{ border: '1px solid #E5E8EB', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: s.color, background: s.bg,
          borderRadius: 5, padding: '2px 7px',
        }}>{s.label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>{r.company}</span>
        <span style={{ fontSize: 13, color: '#4E5968' }}>{r.contact_name}</span>
        {/* 어느 발송으로 들어온 문의인지. 회사명은 이 사람이 폼에 적은 값이고, 링크가
            아는 건 발송(캠페인)까지다 — 그 둘이 만나는 자리가 여기다.
            기업명이 적힌 옛 링크는 폼의 회사명과 다를 때만 짚어 준다: 다르다는 건 링크가
            사내에서 옮겨 다녔다는 뜻이고, 그건 다음에 누구에게 보낼지의 단서다. */}
        {!!r.linkCampaign && (
          <span title="이 문의가 들어온 발송" style={{ fontSize: 11, color: '#B0B8C1' }}>
            {r.linkCampaign}
          </span>
        )}
        {!!r.linkCompany && r.linkCompany !== r.company && (
          <span title="이 링크는 이 기업에 보냈습니다" style={{ fontSize: 11, color: '#B0B8C1' }}>
            링크: {r.linkCompany}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#B0B8C1' }}>{vnTime(r.created_at)}</span>
      </div>

      <div style={{ fontSize: 12.5, color: '#4E5968', marginTop: 7, lineHeight: 1.7 }}>
        {[r.title, [r.email, r.phone].filter(Boolean).join(' · '), r.when_pref && `희망 ${r.when_pref}`]
          .filter(Boolean).join('  |  ')}
      </div>
      {!!r.memo && (
        <div style={{
          fontSize: 12.5, color: '#191F28', background: '#FAFBFC', border: '1px solid #F2F4F6',
          borderRadius: 8, padding: '8px 10px', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap',
        }}>{r.memo}</div>
      )}

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {r.candidates.map((c) => (
          <div key={c.no} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#B0B8C1', width: 22, flexShrink: 0 }}>#{c.no}</span>
            <span style={{ fontWeight: 700, color: '#191F28' }}>{c.name}</span>
            <span style={{ color: '#8B95A1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[c.role, c.yoe == null ? null : `${c.yoe}년`, c.email].filter(Boolean).join(' · ')}
            </span>
            {c.resume
              ? <a href={c.resume} target="_blank" rel="noopener noreferrer"
                  style={{ marginLeft: 'auto', flexShrink: 0, color: '#1A73E8', fontWeight: 600, textDecoration: 'none' }}>
                  이력서 ↗
                </a>
              : <span style={{ marginLeft: 'auto', flexShrink: 0, color: '#D1D6DB', fontSize: 11.5 }}>링크 없음</span>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 11, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {ORDER.map((k) => (
          <button key={k} type="button" onClick={() => onStatus(r.id, k)}
            style={{
              fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '3px 10px',
              borderRadius: 100, cursor: 'pointer',
              border: `1px solid ${r.status === k ? STATUS[k].color : '#E5E8EB'}`,
              background: r.status === k ? STATUS[k].color : '#fff',
              color: r.status === k ? '#fff' : '#8B95A1',
            }}>{STATUS[k].label}</button>
        ))}
      </div>
    </div>
  )
}

function Chip({ on, onClick, label, n }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, lineHeight: 1.6,
        padding: '4px 11px', borderRadius: 100, cursor: 'pointer',
        border: `1px solid ${on ? '#191F28' : '#E5E8EB'}`,
        background: on ? '#191F28' : '#fff',
        color: on ? '#fff' : '#4E5968',
      }}>
      {label} <span style={{ opacity: 0.65 }}>{n}</span>
    </button>
  )
}
