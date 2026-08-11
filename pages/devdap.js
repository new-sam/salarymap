import { useEffect, useState } from 'react'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

/* /devdap — 데드댑(DevDap) 전달용 요금제별 추천 인재 프로필 (2026-08-11).
   요금제(99/149/199만원·별도협의) × 포지션(풀스택/AI) 별 5명씩, 어드민 TalentCard 양식.
   ⚠️ 후보 연락처 보호: 이메일·전화·원본 이력서(PDF)·개인 링크는 서버에서부터 내려보내지
   않는다 — 채용 논의가 FYI 를 우회해 직접 컨택으로 새는 걸 막는 게 수익모델상 핵심.
   "이력서 보기"는 파싱된 구조화 프로필(한국어)만 모달로 보여준다. */

// 선정 명단(2026-08-11 확정, 8/11 오후 사진 보유자 우선으로 개편) — 인재풀 2,064명 중
// 수기 검토로 뽑은 요금제별 상위 5명. CV 증명사진 보유자만 선정하되, AI 3~5년차는 사진
// 보유 실후보가 2명뿐이라 사진 없는 최상위 3명을 유지한다(오탐급으로 채우면 명단 신뢰 하락).
const TIERS = [
  { key: 't99', price: '99만원', yoe: '0~1년차' },
  { key: 't149', price: '149만원', yoe: '1~3년차' },
  { key: 't199', price: '199만원', yoe: '3~5년차' },
  { key: 'nego', price: '별도 협의', yoe: '5년차 이상' },
]
const PICKS = {
  fullstack: {
    t99: ['2d06a91c-3aaf-4fcc-aa9b-fecce6ea6516', '5f161d4f-5b02-4327-a7cf-f838404a212f', '4f3b7d35-7e09-41bc-bf8f-0a32beab04af', '7250b188-09b8-4470-9aaa-dbab4933ccb3', '39c71243-8e98-496c-8b21-268c8e6d448f'],
    t149: ['1b677f59-7153-4cb3-9068-52ef79bf6376', 'c2ffa0d2-8dbf-41b9-a131-8538ac5986d3', '57deeaeb-2016-480c-b15a-4fa98e1097d4', '6fcb12aa-823b-413a-aeb6-9f6d20768a3c', '451389c9-d887-4de4-95d3-4a40ab84d3fa'],
    t199: ['e11f38b8-674c-47b1-83ba-58fe03b6586b', '86823618-51a6-4f99-9f30-5def05078dd3', 'd7e4f9aa-26d6-402d-b848-778fe2a31c14', 'd27dc8a4-b1a5-43d0-9fd6-0ba3bae2d968', '9dbe2e3a-93be-4da6-8fdf-81edc0545a61'],
    nego: ['1057b3a8-d33d-4fc4-a309-7327cc964e2d', 'c978a9d4-f2db-4778-8cbd-de990cdecd19', '2ad3c460-a884-47f2-963b-09aa2778111a', '88c26f4d-2c64-4249-bd56-6ffb467e70e2', '646bf4a8-4649-4b02-a0fb-5aa51a6a882f'],
  },
  ai: {
    t99: ['0ac46e0f-7d33-40b8-858b-7081f351fc7d', 'e062a0f6-f1eb-4794-a512-b1a3d6701b4a', '4b9951f7-9267-481d-ba3d-f2c8701c6bff', '32a122fb-aa98-458d-be1b-68bd20007904', '12718344-ecea-47a2-a18a-e17bac58d092'],
    t149: ['21440378-4cb6-4a15-a104-29fc231faadb', '8906659e-9fd6-4615-a21d-a1d32e4201c5', '4ec25b7d-ea08-4363-9533-719e740de5a2', '65fb4c3e-7456-48e5-ba7f-b09a4f18ada5', 'ac1397a4-991b-42fb-b857-630e4d88f946'],
    t199: ['1bd11821-7f21-4e28-995d-1871ccf89738', 'dc0317af-649e-49ad-ac9e-77531ae55952', 'cea3c37f-d116-4bbe-adde-897f9d010d1f', '48158953-8db7-4f41-ab7e-29baccf6ccf8', '0e39549d-83e3-4288-9285-8e76747a5166'],
    nego: ['4e7fd081-7094-48f5-9eb3-c4e4623fb643', '3fa4e66f-ec07-449b-b447-54fce200d9c1', 'b399aaae-11b1-4b02-badc-66a1fc2b1754', 'b3710143-f92f-49f1-908f-381fc03966d9', '3c462517-d45e-40be-810c-74e48061fb71'],
  },
}

// 스펙 점수 — 선정 때 쓴 것과 같은 프로필 신호 가중치(명문대·경력사·학위·어학·포폴·스킬 폭).
// 화면에는 노출하지 않고 그룹 내 순위 정렬(사진 보유 우선 → 점수순)에만 쓴다.
const TOP_UNI = /bách khoa|bach khoa|hust|hcmut|polytechnic|university of science|hcmus|khoa học tự nhiên|uet|university of engineering|vnu|national university|ptit|posts and telecom|ton duc thang|tôn đức thắng|university of information technology|uit|công nghệ thông tin|fpt university|usth|vgu|rmit|carnegie|mellon|hongik|soongsil|홍익|숭실/i
const GOOD_CO = /fpt|viettel|vng|vnpt|momo|nashtech|kms|tma|samsung|lg electronics|bosch|axon|zalo|shopee|lazada|tiki|grab|naver|hyundai|cmc|rikkei|sun\*|gameloft|panasonic|ntt data|zalopay|vpbank|tpbank|prudential|hitachi|ibm|amazon|google|microsoft|intel|nvidia/i
function matchScore(p) {
  let s = 0
  const sum = p.resume_summary || {}
  if (sum.degree === 'Master') s += 2
  if (sum.degree === 'PhD') s += 3
  if (TOP_UNI.test(p.university || '')) s += 3
  if ((p.experiences || []).some(e => GOOD_CO.test(e?.company || ''))) s += 3
  if (p.korean_cert) s += 2
  if (p.english_cert) s += 1
  if ((sum.links || []).length > 0) s += 1
  s += Math.min((p.skills || []).length, 10) / 10
  s += Math.min((p.yoe_months || 0) / 12, 8) * 0.5 // 시니어 경력 가중 — 파싱 필드 부재 페널티 완충
  return Math.min(98, 60 + Math.round(s * 3))
}

export async function getServerSideProps({ res }) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const allIds = Object.values(PICKS).flatMap(g => Object.values(g).flat())
  const { data, error } = await sb.from('user_profiles')
    .select('id,full_name,headline,position,yoe_months,skills,university,major,graduation_year,experiences,english_cert,korean_cert,resume_summary,photo_url,location')
    .in('id', allIds)
  if (error) return { props: { groups: null } }

  const byId = {}
  for (const p of data || []) {
    const sum = p.resume_summary || {}
    byId[p.id] = {
      id: p.id,
      name: p.full_name || '',
      nick: sum.name_ko || '',
      headline: p.headline || p.position || '',
      yoe: p.yoe_months ?? null,
      uni: p.university || '',
      degree: sum.degree || '',
      eduKo: sum.edu_ko || p.major || '',
      gradYear: p.graduation_year || '',
      bullets: Array.isArray(sum.bullets) ? sum.bullets : [],
      en: p.english_cert || '',
      ko: p.korean_cert || '',
      skills: Array.isArray(p.skills) ? p.skills : [],
      // 경력 이력 — 회사·직함·기간만(연락처 아님). 모달 상세용
      exps: (Array.isArray(p.experiences) ? p.experiences : []).map(e => ({
        company: e?.company || '', title: e?.title || '', start: e?.start || '', end: e?.end || '', months: e?.months || null,
      })),
      photo: p.photo_url || '',
      loc: p.location || '',
      score: matchScore(p),
    }
  }
  // 그룹별 순위: 사진 보유 우선 → 스펙 점수순. 점수는 정렬에만 쓰고 내려보내지 않는다
  const groups = {}
  for (const [pos, tiers] of Object.entries(PICKS)) {
    groups[pos] = {}
    for (const [tier, ids] of Object.entries(tiers)) {
      groups[pos][tier] = ids.map(id => byId[id]).filter(Boolean)
        .sort((a, b) => ((b.photo ? 1 : 0) - (a.photo ? 1 : 0)) || (b.score - a.score))
        .map(({ score, ...p }) => p)
    }
  }
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
  return { props: { groups } }
}

const NONE = <span style={{ color: '#B6BDC6' }}>정보 없음</span>
const yoeLabel = (m) => m == null ? null : m === 0 ? '신입' : `${Math.round((m / 12) * 10) / 10}년`
// 카드 높이 통일용 1줄 말줄임 — 넘치는 내용은 모달에서 전부 보인다
const oneLine = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function PanelRow({ label, children, first }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: first ? 'none' : '1px solid #ECEEF1', fontSize: 12.5, lineHeight: 1.55 }}>
      <span style={{ flexShrink: 0, width: 56, fontWeight: 700, color: '#111', paddingTop: 1 }}>{label}</span>
      <span style={{ minWidth: 0, flex: 1, color: '#374151' }}>{children}</span>
    </div>
  )
}

function ProfileCard({ p, rank, onDetail }) {
  return (
    <div className="dd-card" onClick={onDetail} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onDetail() }}
      style={{ position: 'relative', background: '#fff', border: '1px solid #E5E8EB', borderRadius: 14, padding: '18px 14px 14px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
      {/* 좌상단: 순위 뱃지 */}
      <div style={{ position: 'absolute', top: 16, left: 16, width: 30, height: 30, borderRadius: 8, background: '#12B76A', color: '#fff', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rank}</div>

      {/* 헤더: 사진 · 이름(호칭) · 직무 — 각 1줄 고정 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 14 }}>
        {p.photo ? (
          <img src={p.photo} alt="" referrerPolicy="no-referrer" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#9CA3AF' }}>
            {(p.name || '?')[0]}
          </div>
        )}
        <div title={p.name} style={{ ...oneLine, marginTop: 12, fontWeight: 700, fontSize: 16, lineHeight: 1.3, maxWidth: '100%' }}>
          {p.name}{p.nick && <span style={{ color: '#9CA3AF', fontWeight: 600 }}> ({p.nick})</span>}
        </div>
        <div title={p.headline} style={{ ...oneLine, fontSize: 12.5, color: '#6B7280', marginTop: 4, maxWidth: '100%' }}>{p.headline}</div>
      </div>

      {/* 스펙 패널 — 행 구성·줄 수 고정으로 카드끼리 같은 위치에 같은 정보 */}
      <div style={{ background: '#F8F9FA', borderRadius: 10, flex: 1 }}>
        <PanelRow label="경력" first>{yoeLabel(p.yoe) ? <b>{yoeLabel(p.yoe)}</b> : NONE}</PanelRow>
        <PanelRow label="학력">
          {p.uni ? (
            <span style={{ display: 'block' }}>
              <span title={p.uni} style={{ ...oneLine, fontWeight: 700, color: '#111' }}>{p.uni}</span>
              <span style={{ ...oneLine, color: '#9CA3AF' }}>{[p.degree, p.eduKo].filter(Boolean).join(' · ') || '-'}</span>
            </span>
          ) : NONE}
        </PanelRow>
        <PanelRow label="주요이력">
          <span title={p.bullets.join('\n')} style={{ display: 'block', height: 'calc(1.55em * 3)', overflow: 'hidden' }}>
            {p.bullets.length > 0 ? p.bullets.slice(0, 3).map((b, i) => <span key={i} style={oneLine}>· {b}</span>) : NONE}
          </span>
        </PanelRow>
        <PanelRow label="외국어">
          <span title={[p.en && `EN ${p.en}`, p.ko && `KO ${p.ko}`].filter(Boolean).join(' / ')} style={oneLine}>
            {(p.en || p.ko) ? (<>
              {p.en && <><span style={{ color: '#ff6000', fontWeight: 600 }}>EN</span> {p.en}</>}
              {p.en && p.ko && <span style={{ color: '#CBD5E1' }}> · </span>}
              {p.ko && <><span style={{ color: '#ff6000', fontWeight: 600 }}>KO</span> {p.ko}</>}
            </>) : NONE}
          </span>
        </PanelRow>
        <PanelRow label="기술">
          {p.skills.length > 0 ? (
            <span title={p.skills.join(', ')} style={{ display: 'flex', gap: 5, height: 24, alignItems: 'center', overflow: 'hidden', flexWrap: 'nowrap' }}>
              {p.skills.slice(0, 3).map(s => (
                <span key={s} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11.5, background: '#fff', border: '1px solid #E5E8EB', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>{s}</span>
              ))}
              {p.skills.length > 3 && <span style={{ fontSize: 11.5, color: '#9CA3AF', flexShrink: 0 }}>+{p.skills.length - 3}</span>}
            </span>
          ) : NONE}
        </PanelRow>
      </div>

      <div style={{ display: 'block', textAlign: 'center', marginTop: 12, padding: '10px 0', border: '1px solid #E5E8EB', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#111', background: '#fff' }}>
        이력서 보기 (한국어)
      </div>
    </div>
  )
}

// 상세 모달 — 파싱된 구조화 이력서(한국어). 연락처·원본 파일은 정책상 제공하지 않는다.
function DetailModal({ p, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden' // 모달 뒤 배경 스크롤 잠금
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  const period = (e) => {
    const range = [e.start, e.end].filter(Boolean).join(' – ')
    const dur = e.months ? `${e.months}개월` : ''
    return [range, dur].filter(Boolean).join(' · ')
  }
  return (
    <div onClick={onClose} className="dd-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="dd-modal"
        style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 모달 헤더 고정 — 긴 경력을 스크롤해도 이름·닫기가 남아 있게 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', borderBottom: '1px solid #F0F1F3', flexShrink: 0 }}>
          {p.photo ? (
            <img src={p.photo} alt="" referrerPolicy="no-referrer" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#9CA3AF', flexShrink: 0 }}>{(p.name || '?')[0]}</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16.5 }}>{p.name}{p.nick && <span style={{ color: '#9CA3AF', fontWeight: 600 }}> ({p.nick})</span>}</div>
            <div style={{ ...oneLine, fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>{p.headline}{p.loc ? ` · ${p.loc}` : ''}</div>
          </div>
          <button onClick={onClose} aria-label="닫기"
            style={{ border: 'none', background: '#F3F4F6', borderRadius: '50%', width: 32, height: 32, fontSize: 17, color: '#6B7280', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 22px 22px' }}>
          {[
            ['경력 이력', p.exps.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.exps.map((e, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: '#F8F9FA', borderRadius: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{e.company || '-'}</div>
                    <div style={{ fontSize: 12.5, color: '#374151', marginTop: 2 }}>{e.title}</div>
                    {period(e) && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>{period(e)}</div>}
                  </div>
                ))}
              </div>
            ) : NONE],
            ['학력', p.uni ? (
              <div style={{ fontSize: 13 }}>
                <b>{p.uni}</b>
                <div style={{ color: '#6B7280', marginTop: 2 }}>{[p.degree, p.eduKo, p.gradYear && `${p.gradYear}년 졸업`].filter(Boolean).join(' · ')}</div>
              </div>
            ) : NONE],
            ['주요이력', p.bullets.length > 0 ? p.bullets.map((b, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>· {b}</div>) : NONE],
            ['외국어', (p.en || p.ko) ? (
              <div style={{ fontSize: 13 }}>
                {p.en && <div><span style={{ color: '#ff6000', fontWeight: 700 }}>영어</span> {p.en}</div>}
                {p.ko && <div><span style={{ color: '#ff6000', fontWeight: 700 }}>한국어</span> {p.ko}</div>}
              </div>
            ) : NONE],
            ['기술', p.skills.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.skills.map(s => <span key={s} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: '#F8F9FA', border: '1px solid #E5E8EB', color: '#374151' }}>{s}</span>)}
              </div>
            ) : NONE],
          ].map(([label, node]) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', marginBottom: 7 }}>{label}</div>
              {node}
            </div>
          ))}

          <div style={{ marginTop: 4, padding: '10px 12px', background: '#FFF7ED', borderRadius: 10, fontSize: 12, color: '#B0691A', lineHeight: 1.5 }}>
            후보자 보호를 위해 연락처와 원본 이력서는 공개하지 않습니다. 인터뷰를 원하시면 FYI 담당자에게 순위 번호로 요청해 주세요.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DevdapPage({ groups }) {
  const [pos, setPos] = useState('fullstack')
  const [detail, setDetail] = useState(null)
  const posLabel = { fullstack: '풀스택 개발자', ai: 'AI 개발자' }

  const jumpTo = (key) => {
    document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', -apple-system, sans-serif", color: '#111' }}>
      <Head>
        <title>FYI 추천 인재 — 요금제별 프로필</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* 상단 고정 내비 — 포지션 토글 + 요금제 바로가기. 40장을 스크롤하는 동안 항상 손에 닿게 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E9EBEE' }}>
        <div className="dd-nav" style={{ maxWidth: 1080, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#ff6000', marginRight: 2 }}>FYI</span>
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 999, padding: 3 }}>
            {['fullstack', 'ai'].map(k => (
              <button key={k} onClick={() => setPos(k)}
                style={{
                  padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: pos === k ? '#ff6000' : 'transparent', color: pos === k ? '#fff' : '#6B7280',
                }}>
                {posLabel[k]}
              </button>
            ))}
          </div>
          <div className="dd-anchors" style={{ display: 'flex', gap: 6, marginLeft: 'auto', overflowX: 'auto' }}>
            {TIERS.map(t => (
              <button key={t.key} onClick={() => jumpTo(t.key)}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #E5E8EB', background: '#fff', color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {t.price}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 16px 60px' }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: '0 0 6px' }}>{posLabel[pos]} 추천 인재</h1>
        <p style={{ fontSize: 13.5, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          FYI 인재풀에서 요금제 구간별로 선별한 상위 5명입니다. 카드를 누르면 한국어 이력서 요약을
          볼 수 있습니다. 후보자 보호를 위해 연락처와 원본 이력서는 비공개이며, 인터뷰 요청은 FYI
          담당자를 통해 진행됩니다.
        </p>

        {!groups ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
        ) : TIERS.map(({ key, price, yoe }) => (
          <section key={key} id={`sec-${key}`} className="dd-sec" style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{price}</h2>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#FFF0E6', color: '#ff6000' }}>{yoe}</span>
              <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>{(groups[pos][key] || []).length}명</span>
            </div>
            <div className="dd-grid">
              {(groups[pos][key] || []).map((p, i) => (
                <ProfileCard key={p.id} p={p} rank={i + 1} onDetail={() => setDetail(p)} />
              ))}
            </div>
          </section>
        ))}

        <div style={{ fontSize: 11.5, color: '#B6BDC6', textAlign: 'center', marginTop: 36 }}>
          © FYI (salary-fyi.com) · 본 페이지는 채용 검토 목적으로만 사용해 주세요.
        </div>
      </div>

      {detail && <DetailModal p={detail} onClose={() => setDetail(null)} />}

      <style>{`
        html { scroll-behavior: smooth; }
        .dd-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .dd-card { transition: box-shadow 0.15s, transform 0.15s; }
        .dd-card:hover { box-shadow: 0 6px 18px rgba(17, 17, 17, 0.08); transform: translateY(-2px); }
        .dd-overlay { padding: 16px; }
        .dd-sec { scroll-margin-top: 70px; }
        @media (max-width: 900px) { .dd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 620px) {
          .dd-grid { grid-template-columns: 1fr; }
          .dd-anchors { margin-left: 0; width: 100%; }
          .dd-overlay { padding: 0; align-items: flex-end; }
          .dd-modal { max-height: 92vh; border-radius: 16px 16px 0 0; }
          .dd-sec { scroll-margin-top: 112px; }
        }
      `}</style>
    </div>
  )
}
