import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { isTopTier, isOverseas, overseasOf } from '../../lib/topUniversities'

// 공개 이력서(is_resume_public)만 모아 스태핑(인재 배치) 관점으로 보는 화면.
// 한국 기업이 지원자의 "급"을 판단할 때 보는 신호 — 학벌 / 전 회사 네임밸류 /
// 경력 연차·직급 / 어학(특히 한국어) / 핵심 스킬 — 을 한 카드에 모아 보여준다.
// 데이터는 운영용 이력서 탭과 동일한 /api/admin/resumes 를 재사용한다.

// 경력 레벨 분류 (yoe_months 기준)
const LEVELS = [
  { key: 'newgrad', label: '신입',   en: 'New grad', test: m => m === 0 },
  { key: 'junior',  label: '주니어', en: 'Junior',   test: m => m > 0 && m < 24 },
  { key: 'mid',     label: '미들',   en: 'Mid',      test: m => m >= 24 && m < 60 },
  { key: 'senior',  label: '시니어', en: 'Senior',   test: m => m >= 60 },
]

function levelOf(months) {
  if (months === null || months === undefined) return null
  return LEVELS.find(l => l.test(months))?.key || null
}

function formatYoe(months, ko = true) {
  if (months === null || months === undefined) return ko ? '경력 미상' : 'Unknown'
  if (months === 0) return ko ? '신입' : 'New grad'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return ko ? `${m}개월` : `${m}m`
  if (m === 0) return ko ? `${y}년` : `${y}y`
  return ko ? `${y}년 ${m}개월` : `${y}y ${m}m`
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

export default function TalentPoolView({ token, lang }) {
  const ko = lang !== 'en' // admin은 ko/en (vi는 en으로 폴백). undefined면 ko.
  const L = ko ? {
    loadingPool: '인재풀 불러오는 중...', emptyPool: '공개 이력서로 설정한 인재가 아직 없습니다.',
    noMatch: '조건에 맞는 인재가 없습니다.',
    statPublic: '공개', people: '명', statTop: '명문대', statOverseas: '해외', statKorean: '한국어', filtered: '필터',
    searchPh: '이름, 직무, 회사, 학교, 스킬...', csv: 'CSV 다운로드',
    all: '전체', fTop: '🎓 명문대', fOverseas: '🌏 해외대', fKorean: '🇰🇷 한국어', allRoles: '직무 전체', allWork: '근무형태 전체',
    topBadge: '명문대', rowSchool: '학교', rowCareer: '경력', rowLang: '어학', rowSkills: '스킬', rowLocation: '지역', rowSalary: '연봉',
    unknown: '미상', noRole: '직무 미상', levelUnknown: '경력?', aiFill: 'AI 채우기', aiFilling: '분석 중…',
    aiTitle: '경력/어학이 비어 있어요 — 눌러서 AI로 채웁니다', resume: '이력서 →',
    unclassified: '미분류', parseFail: '분석 실패',
  } : {
    loadingPool: 'Loading talent pool…', emptyPool: 'No public resumes yet.',
    noMatch: 'No matching talent.',
    statPublic: 'Public', people: '', statTop: 'Top-tier', statOverseas: 'Overseas', statKorean: 'Korean', filtered: 'Filtered',
    searchPh: 'Name, role, company, school, skills...', csv: 'Download CSV',
    all: 'All', fTop: '🎓 Top-tier', fOverseas: '🌏 Overseas', fKorean: '🇰🇷 Korean', allRoles: 'All roles', allWork: 'All work types',
    topBadge: 'Top-tier', rowSchool: 'School', rowCareer: 'Career', rowLang: 'Lang', rowSkills: 'Skills', rowLocation: 'Location', rowSalary: 'Salary',
    unknown: 'Unknown', noRole: 'No role', levelUnknown: 'Level?', aiFill: 'AI fill', aiFilling: 'Filling…',
    aiTitle: 'Career/language empty — click to fill with AI', resume: 'Resume →',
    unclassified: 'Unclassified', parseFail: 'Parse failed',
  }
  const levelLabel = (l) => (l ? (ko ? l.label : l.en) : L.levelUnknown)
  const { data: all, isLoading: loading, mutate } = useAdmin('/api/admin/resumes', token)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [workFilter, setWorkFilter] = useState('all')
  const [koreanOnly, setKoreanOnly] = useState(false)
  const [topOnly, setTopOnly] = useState(false)
  const [overseasOnly, setOverseasOnly] = useState(false)
  const [parsingId, setParsingId] = useState(null)

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L.loadingPool}</div>

  const pool = (all || []).filter(r => r.is_resume_public)
  if (pool.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{L.emptyPool}</div>

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
        alert(`${L.parseFail}: ${err.error || res.status}`)
      }
    } catch (e) {
      alert(`${L.parseFail}: ${e.message}`)
    } finally {
      setParsingId(null)
    }
  }

  // 직무별 카운트 (필터 칩용)
  const posCounts = {}
  for (const r of pool) {
    const p = r.position || L.unclassified
    posCounts[p] = (posCounts[p] || 0) + 1
  }
  const positions = Object.entries(posCounts).sort((a, b) => b[1] - a[1])

  const filtered = pool.filter(r => {
    if (posFilter !== 'all' && (r.position || L.unclassified) !== posFilter) return false
    if (levelFilter !== 'all' && levelOf(r.yoe_months) !== levelFilter) return false
    if (workFilter !== 'all' && (r.work_type || '') !== workFilter) return false
    if (koreanOnly && !(r.korean_cert || '').trim()) return false
    if (topOnly && !isTopTier(r.university)) return false
    if (overseasOnly && !isOverseas(r.university)) return false
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
  const topTierCount = pool.filter(r => isTopTier(r.university)).length
  const topTierPct = pool.length ? Math.round((topTierCount / pool.length) * 100) : 0
  const overseasCount = pool.filter(r => isOverseas(r.university)).length
  const overseasPct = pool.length ? Math.round((overseasCount / pool.length) * 100) : 0

  function downloadCsv() {
    const headers = ['Name', 'Email', 'Position', 'Level', 'YoE (months)', 'University', 'Top-tier', 'Overseas', 'Major', 'Grad Year', 'Companies', 'Korean', 'English', 'Skills', 'Location', 'Work Type', 'Salary Min', 'Salary Max', 'Currency', 'Resume URL', 'Updated']
    const rows = filtered.map(r => {
      const exps = asExperiences(r.experiences)
      return [
        r.full_name, r.email, r.position || '', (LEVELS.find(l => l.key === levelOf(r.yoe_months)) || {})[ko ? 'label' : 'en'] || '',
        r.yoe_months ?? '', r.university || '', isTopTier(r.university) ? 'Y' : '', overseasOf(r.university)?.country || '', r.major || '', r.graduation_year || '',
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
    border: `1px solid ${active ? '#ff6000' : '#E5E8EB'}`, cursor: 'pointer',
    background: active ? '#ff600014' : '#fff', color: active ? '#ff6000' : '#6B7280',
    transition: 'all 0.15s',
  })

  const selectStyle = { padding: '6px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 12.5, color: '#374151', background: '#fff', cursor: 'pointer', fontWeight: 600 }
  const divider = <span style={{ width: 1, height: 18, background: '#E5E8EB', margin: '0 2px' }} />
  // strong=명문대(먹색으로 살짝 강조), 그 외=연회색. 색 대신 라벨/국기로 구분.
  const tierBadge = (text, strong) => <span style={{ flexShrink: 0, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: strong ? '#1F2937' : '#EEF1F4', color: strong ? '#fff' : '#475569' }}>{text}</span>
  // 급(레벨) 칩 — 한눈에 구분되게. 브랜드 오렌지 농도 단계(신입=회색 → 시니어=진한 오렌지).
  const LEVEL_CHIP = {
    newgrad: { bg: '#F1F5F9', color: '#64748B' },
    junior: { bg: '#FFEEDF', color: '#C2410C' },
    mid: { bg: '#FFD9BF', color: '#9A3412' },
    senior: { bg: '#ff6000', color: '#fff' },
  }
  const levelChip = (lvl, months) => {
    const s = (lvl && LEVEL_CHIP[lvl.key]) || { bg: '#F1F5F9', color: '#94A3B8' }
    const label = levelLabel(lvl)
    const yoe = formatYoe(months, ko)
    // 신입은 라벨=연차라 중복 생략, 연차 미상이면 라벨만.
    const text = (lvl && lvl.key === 'newgrad') || months == null ? label : `${label} · ${yoe}`
    return <span style={{ flexShrink: 0, padding: '1px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{text}</span>
  }
  // 라벨:값 한 줄 — 카드 본문을 스펙시트처럼 정렬해 깔끔하게.
  const specRow = (label, value, muted) => (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5, lineHeight: 1.45 }}>
      <span style={{ flexShrink: 0, width: ko ? 30 : 54, color: '#9CA3AF', fontSize: 11, fontWeight: 600, paddingTop: 1 }}>{label}</span>
      <span style={{ minWidth: 0, color: muted ? '#CBD5E1' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  )

  return (
    <>
      <style>{`
        .tp-card { transition: box-shadow 0.15s, border-color 0.15s; }
        .tp-card:hover { border-color: #ff6000; box-shadow: 0 2px 10px rgba(15,23,42,0.06); }
      `}</style>

      {/* 헤더: 제목 + 통계 스트립 + 검색/CSV */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{ko ? '공개 인재풀' : 'Talent Pool'}</h3>
          <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', fontSize: 13, color: '#6B7280', flexWrap: 'wrap' }}>
            <span>{L.statPublic} <strong style={{ color: '#0F172A' }}>{pool.length}</strong>{L.people}</span>
            <span>{L.statTop} <strong style={{ color: '#0F172A' }}>{topTierCount}</strong> ({topTierPct}%)</span>
            {overseasCount > 0 && <span>{L.statOverseas} <strong style={{ color: '#0F172A' }}>{overseasCount}</strong> ({overseasPct}%)</span>}
            {koreanCount > 0 && <span>{L.statKorean} <strong style={{ color: '#0F172A' }}>{koreanCount}</strong></span>}
            {filtered.length !== pool.length && <span style={{ color: '#ff6000', fontWeight: 600 }}>· {L.filtered} {filtered.length}{L.people}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={L.searchPh}
            style={{ padding: '7px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 240 }}
          />
          <button onClick={downloadCsv}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, background: '#ff6000', color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {L.csv}
          </button>
        </div>
      </div>

      {/* 필터 바: 급(칩) · 학교/어학(토글) · 직무/근무형태(드롭다운) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, padding: '10px 12px', background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 10 }}>
        <button onClick={() => setLevelFilter('all')} style={chip(levelFilter === 'all')}>{L.all}</button>
        {LEVELS.map(l => {
          const count = pool.filter(r => levelOf(r.yoe_months) === l.key).length
          if (count === 0) return null
          return <button key={l.key} onClick={() => setLevelFilter(l.key)} style={chip(levelFilter === l.key)}>{levelLabel(l)} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{count}</span></button>
        })}
        {(topTierCount > 0 || overseasCount > 0 || koreanCount > 0) && divider}
        {topTierCount > 0 && <button onClick={() => setTopOnly(v => !v)} style={chip(topOnly)}>{L.fTop} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{topTierCount}</span></button>}
        {overseasCount > 0 && <button onClick={() => setOverseasOnly(v => !v)} style={chip(overseasOnly)}>{L.fOverseas} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{overseasCount}</span></button>}
        {koreanCount > 0 && <button onClick={() => setKoreanOnly(v => !v)} style={chip(koreanOnly)}>{L.fKorean} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{koreanCount}</span></button>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <select value={posFilter} onChange={e => setPosFilter(e.target.value)} style={selectStyle}>
            <option value="all">{L.allRoles} ({pool.length})</option>
            {positions.map(([p, count]) => <option key={p} value={p}>{p} ({count})</option>)}
          </select>
          {workTypes.length > 0 && (
            <select value={workFilter} onChange={e => setWorkFilter(e.target.value)} style={selectStyle}>
              <option value="all">{L.allWork}</option>
              {workTypes.map(w => <option key={w} value={w}>{w} ({pool.filter(r => r.work_type === w).length})</option>)}
            </select>
          )}
        </div>
      </div>

      {/* 인재 카드 그리드 (3열 고정) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {filtered.map(r => {
          const skills = asSkills(r.skills)
          const exps = asExperiences(r.experiences)
          const companies = exps.map(e => e.company).filter(Boolean)
          const salary = formatSalary(r)
          const title = topTitle(r, exps) || r.headline || r.position || ''
          const level = LEVELS.find(l => l.key === levelOf(r.yoe_months))
          const os = overseasOf(r.university)
          const isParsing = parsingId === r.id
          const langText = [r.korean_cert && `KOR ${r.korean_cert}`, r.english_cert && `ENG ${r.english_cert}`].filter(Boolean).join(' · ')
          const eduText = r.university
            ? [r.university, r.major, r.graduation_year].filter(Boolean).join(' · ')
            : null
          return (
            <div key={r.id} className="tp-card" style={{ background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '15px 16px', display: 'flex', flexDirection: 'column' }}>
              {/* 헤더: 사진 · 이름 · 뱃지 / 직무·급 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                {r.photo_url ? (
                  <img src={r.photo_url} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#999', flexShrink: 0 }}>
                    {(r.full_name || '?')[0]}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.full_name || (ko ? '이름 없음' : 'No name')}</span>
                    {levelChip(level, r.yoe_months)}
                    {isTopTier(r.university) && tierBadge(L.topBadge, true)}
                    {os && tierBadge(ko ? os.label : os.country)}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || L.noRole}
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: '#F1F5F9', margin: '13px 0' }} />

              {/* 스펙: 학교 · 경력 · 어학 · 스킬 · 희망 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {specRow(L.rowSchool, eduText || L.unknown, !eduText)}
                {specRow(L.rowCareer, companies.length > 0
                  ? companies.slice(0, 3).join(' · ') + (companies.length > 3 ? ` +${companies.length - 3}` : '')
                  : L.unknown, companies.length === 0)}
                {langText && specRow(L.rowLang, langText)}
                {skills.length > 0 && specRow(L.rowSkills, skills.slice(0, 6).join(' · ') + (skills.length > 6 ? ` +${skills.length - 6}` : ''))}
                {r.location && specRow(L.rowLocation, r.location)}
                {salary && specRow(L.rowSalary, salary)}
              </div>

              {/* 푸터: 이메일 · AI 분석 · PDF — marginTop auto로 카드 바닥에 고정(행 내 정렬) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 11, marginTop: 'auto' }}>
                <a href={r.email ? `mailto:${r.email}` : undefined} title={r.email}
                  style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{r.email || '-'}</a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {companies.length === 0 && (
                    <button onClick={() => reparse(r.id)} disabled={isParsing}
                      title={L.aiTitle}
                      style={{ border: 'none', background: 'none', cursor: isParsing ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 600, color: isParsing ? '#9CA3AF' : '#6B7280', padding: 0 }}>
                      {isParsing ? L.aiFilling : L.aiFill}
                    </button>
                  )}
                  {r.resume_url && (
                    <a href={r.resume_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#ff6000', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>
                      {L.resume}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{L.noMatch}</div>
      )}
    </>
  )
}
