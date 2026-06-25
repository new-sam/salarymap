import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 공개 이력서(is_resume_public)만 모아 스태핑(인재 배치) 관점으로 보는 화면.
// 한국 기업이 지원자의 "급"을 판단할 때 보는 신호 — 학벌 / 전 회사 네임밸류 /
// 경력 연차·직급 / 어학(특히 한국어) / 핵심 스킬 — 을 한 카드에 모아 보여준다.
// 데이터는 운영용 이력서 탭과 동일한 /api/admin/resumes 를 재사용한다.

// 경력 레벨 분류 (yoe_months 기준)
const LEVELS = [
  { key: 'newgrad', label: '신입',   test: m => m === 0 },
  { key: 'junior',  label: '주니어', test: m => m > 0 && m < 24 },
  { key: 'mid',     label: '미들',   test: m => m >= 24 && m < 60 },
  { key: 'senior',  label: '시니어', test: m => m >= 60 },
]

function levelOf(months) {
  if (months === null || months === undefined) return null
  return LEVELS.find(l => l.test(months))?.key || null
}

function formatYoe(months) {
  if (months === null || months === undefined) return '경력 미상'
  if (months === 0) return '신입'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}개월`
  if (m === 0) return `${y}년`
  return `${y}년 ${m}개월`
}

function formatSalary(r) {
  const cur = r.salary_currency || ''
  if (r.salary_min && r.salary_max) return `${r.salary_min.toLocaleString()} ~ ${r.salary_max.toLocaleString()} ${cur}`
  if (r.salary_min) return `${r.salary_min.toLocaleString()}+ ${cur}`
  if (r.salary_max) return `~ ${r.salary_max.toLocaleString()} ${cur}`
  return null
}

function asSkills(skills) {
  if (!skills) return []
  return (Array.isArray(skills) ? skills : String(skills).split(',')).map(s => s.trim()).filter(Boolean)
}

function asExperiences(exp) {
  if (!exp) return []
  if (Array.isArray(exp)) return exp
  try { const p = JSON.parse(exp); return Array.isArray(p) ? p : [] } catch { return [] }
}

// 가장 최근(혹은 대표) 직급 텍스트 — 카드 상단 "직급" 표시용
function topTitle(r, exps) {
  return exps[0]?.title || ''
}

export default function TalentPoolView({ token, t }) {
  const { data: all, isLoading: loading, mutate } = useAdmin('/api/admin/resumes', token)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [workFilter, setWorkFilter] = useState('all')
  const [koreanOnly, setKoreanOnly] = useState(false)
  const [parsingId, setParsingId] = useState(null)

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>인재풀 불러오는 중...</div>

  const pool = (all || []).filter(r => r.is_resume_public)
  if (pool.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>공개 이력서로 설정한 인재가 아직 없습니다.</div>

  async function reparse(userId) {
    if (parsingId) return
    setParsingId(userId)
    try {
      const res = await fetch('/api/admin/parse-resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const parsed = await res.json()
        mutate(prev => prev.map(r => r.id === userId ? { ...r, ...parsed, skills: parsed.skills } : r), false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(`분석 실패: ${err.error || res.status}`)
      }
    } catch (e) {
      alert(`분석 실패: ${e.message}`)
    } finally {
      setParsingId(null)
    }
  }

  // 직무별 카운트 (필터 칩용)
  const posCounts = {}
  for (const r of pool) {
    const p = r.position || '미분류'
    posCounts[p] = (posCounts[p] || 0) + 1
  }
  const positions = Object.entries(posCounts).sort((a, b) => b[1] - a[1])

  const filtered = pool.filter(r => {
    if (posFilter !== 'all' && (r.position || '미분류') !== posFilter) return false
    if (levelFilter !== 'all' && levelOf(r.yoe_months) !== levelFilter) return false
    if (workFilter !== 'all' && (r.work_type || '') !== workFilter) return false
    if (koreanOnly && !(r.korean_cert || '').trim()) return false
    if (search) {
      const q = search.toLowerCase()
      const companies = asExperiences(r.experiences).map(e => e.company)
      const hay = [r.full_name, r.email, r.position, r.headline, r.university, r.major, ...companies, ...asSkills(r.skills)]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const workTypes = [...new Set(pool.map(r => r.work_type).filter(Boolean))]
  const koreanCount = pool.filter(r => (r.korean_cert || '').trim()).length

  function downloadCsv() {
    const headers = ['Name', 'Email', 'Position', 'Level', 'YoE (months)', 'University', 'Major', 'Grad Year', 'Companies', 'Korean', 'English', 'Skills', 'Location', 'Work Type', 'Salary Min', 'Salary Max', 'Currency', 'Resume URL', 'Updated']
    const rows = filtered.map(r => {
      const exps = asExperiences(r.experiences)
      return [
        r.full_name, r.email, r.position || '', LEVELS.find(l => l.key === levelOf(r.yoe_months))?.label || '',
        r.yoe_months ?? '', r.university || '', r.major || '', r.graduation_year || '',
        exps.map(e => `${e.company}${e.title ? ` (${e.title})` : ''}`).join(' / '),
        r.korean_cert || '', r.english_cert || '', asSkills(r.skills).join(', '),
        r.location || '', r.work_type || '', r.salary_min ?? '', r.salary_max ?? '', r.salary_currency || '',
        r.resume_url, r.updated_at ? new Date(r.updated_at).toLocaleString('ko-KR') : '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `talent-pool-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const chip = (active) => ({
    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? '#0D9488' : '#E5E8EB'}`, cursor: 'pointer',
    background: active ? '#0D948814' : '#fff', color: active ? '#0D9488' : '#6B7280',
    transition: 'all 0.15s',
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>공개 인재풀</h3>
          <span style={{ fontSize: 14, color: '#6B7280' }}>
            공개 인재 <strong style={{ color: '#0D9488' }}>{pool.length}</strong>명
            {filtered.length !== pool.length && <span style={{ color: '#9CA3AF' }}> · 필터 {filtered.length}명</span>}
          </span>
          <span style={{ fontSize: 11, color: '#aaa' }}>* 학벌·경력·어학으로 급 판단. 경력/어학이 비면 카드의 &lsquo;AI 분석&rsquo;을 눌러 채우세요.</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 직무, 회사, 학교, 스킬..."
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 240 }}
          />
          <button onClick={downloadCsv}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, background: '#0D9488', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            CSV 다운로드
          </button>
        </div>
      </div>

      {/* 경력 레벨 + 근무형태 + 한국어 필터 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <button onClick={() => setLevelFilter('all')} style={chip(levelFilter === 'all')}>경력 전체</button>
        {LEVELS.map(l => {
          const count = pool.filter(r => levelOf(r.yoe_months) === l.key).length
          if (count === 0) return null
          return <button key={l.key} onClick={() => setLevelFilter(l.key)} style={chip(levelFilter === l.key)}>{l.label} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{count}</span></button>
        })}
        {koreanCount > 0 && <>
          <span style={{ width: 1, height: 18, background: '#E5E8EB', margin: '0 4px' }} />
          <button onClick={() => setKoreanOnly(v => !v)} style={chip(koreanOnly)}>🇰🇷 한국어 가능 <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{koreanCount}</span></button>
        </>}
        {workTypes.length > 0 && <span style={{ width: 1, height: 18, background: '#E5E8EB', margin: '0 4px' }} />}
        {workTypes.map(w => {
          const count = pool.filter(r => r.work_type === w).length
          return <button key={w} onClick={() => setWorkFilter(workFilter === w ? 'all' : w)} style={chip(workFilter === w)}>{w} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{count}</span></button>
        })}
      </div>

      {/* 직무 필터 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <button onClick={() => setPosFilter('all')} style={chip(posFilter === 'all')}>직무 전체</button>
        {positions.map(([p, count]) => (
          <button key={p} onClick={() => setPosFilter(p)} style={chip(posFilter === p)}>{p} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{count}</span></button>
        ))}
      </div>

      {/* 인재 카드 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {filtered.map(r => {
          const skills = asSkills(r.skills)
          const exps = asExperiences(r.experiences)
          const salary = formatSalary(r)
          const title = topTitle(r, exps)
          const level = LEVELS.find(l => l.key === levelOf(r.yoe_months))
          const isParsing = parsingId === r.id
          return (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* 헤더: 사진 · 이름 · 급 · 직급 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {r.photo_url ? (
                  <img src={r.photo_url} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#999' }}>
                    {(r.full_name || '?')[0]}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.full_name || '이름 없음'}</span>
                    <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#0F172A', color: '#fff' }}>
                      {level ? level.label : '경력?'} · {formatYoe(r.yoe_months)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || r.headline || r.position || '—'}
                  </div>
                </div>
              </div>

              {/* 학벌 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '7px 10px', background: '#F8FAFC', borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}>🎓</span>
                {r.university ? (
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>
                    {r.university}
                    {r.major && <span style={{ color: '#64748B', fontWeight: 400 }}> · {r.major}</span>}
                    {r.graduation_year && <span style={{ color: '#94A3B8', fontWeight: 400 }}> · {r.graduation_year}</span>}
                  </span>
                ) : <span style={{ color: '#CBD5E1' }}>학력 정보 없음</span>}
              </div>

              {/* 경력 (전 회사) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.03em' }}>경력</div>
                {exps.length > 0 ? exps.slice(0, 3).map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{e.company || '회사명 미상'}</span>
                    {e.title && <span style={{ color: '#64748B' }}>· {e.title}</span>}
                    {(e.start || e.end) && <span style={{ color: '#CBD5E1', fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{e.start || '?'}~{e.end || '?'}</span>}
                  </div>
                )) : <span style={{ fontSize: 12, color: '#CBD5E1' }}>경력 정보 없음 (AI 분석 필요)</span>}
                {exps.length > 3 && <span style={{ fontSize: 11, color: '#94A3B8' }}>외 {exps.length - 3}개</span>}
              </div>

              {/* 어학 */}
              {(r.korean_cert || r.english_cert) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.korean_cert && <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: '#B91C1C' }}>🇰🇷 {r.korean_cert}</span>}
                  {r.english_cert && <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#DBEAFE', color: '#1D4ED8' }}>🇬🇧 {r.english_cert}</span>}
                </div>
              )}

              {/* 스킬 */}
              {skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {skills.slice(0, 8).map((s, i) => (
                    <span key={i} style={{ padding: '1px 7px', borderRadius: 8, fontSize: 10, background: '#F3F4F6', color: '#374151' }}>{s}</span>
                  ))}
                  {skills.length > 8 && <span style={{ fontSize: 10, color: '#999' }}>+{skills.length - 8}</span>}
                </div>
              )}

              {/* 위치 · 희망연봉 */}
              {(r.location || salary) && (
                <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                  {r.location && <span>📍 {r.location}</span>}
                  {salary && <span>💰 {salary}</span>}
                </div>
              )}

              {/* 푸터: 이메일 · 재분석 · PDF */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px solid #f3f4f6', paddingTop: 10, marginTop: 'auto' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.email}>{r.email || '-'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <button onClick={() => reparse(r.id)} disabled={isParsing}
                    style={{ border: 'none', background: 'none', cursor: isParsing ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 600, color: isParsing ? '#9CA3AF' : '#4F46E5', padding: 0 }}>
                    {isParsing ? '분석 중…' : 'AI 분석'}
                  </button>
                  {r.resume_url && (
                    <a href={r.resume_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#0D9488', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>
                      이력서 PDF →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>조건에 맞는 인재가 없습니다.</div>
      )}
    </>
  )
}
