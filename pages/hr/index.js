import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useT } from '../../lib/i18n'
import GlobalNav from '../../components/GlobalNav'

const POSITIONS = ['all', 'Backend', 'Frontend', 'Fullstack', 'Mobile', 'AI/Data', 'DevOps', 'QA', 'Design', 'PM', 'Other']
const SORT_KEYS = ['stat_overall', 'stat_experience', 'stat_tech', 'stat_english', 'yoe_months']

// Vietnamese location → Korean friendly name
const LOCATION_KO_RULES = [
  // HCM and districts
  [/h[oồ]\s*ch[ií]\s*minh/i, '호치민'],
  [/tp\.?\s*h[cC][mM]/i, '호치민'],
  [/hcm/i, '호치민'],
  [/saigon/i, '호치민'],
  [/quận|th[uủ]\s*đ[uứ]c|bình thạnh|gò vấp|tân bình|phú nhuận|bình tân|tân phú|quận \d/i, '호치민'],
  [/district\s*\d/i, '호치민'],
  // Hanoi
  [/h[aà]\s*n[oộ]i/i, '하노이'],
  // Da Nang
  [/đ[aà]\s*n[aẵ]ng|da\s*nang/i, '다낭'],
  // Can Tho
  [/c[aầ]n\s*th[oơ]/i, '껀터'],
  // Hai Phong
  [/h[aả]i\s*ph[oò]ng/i, '하이퐁'],
  // Bien Hoa / Dong Nai
  [/bi[eê]n\s*h[oò]a|đ[oồ]ng\s*nai|dong\s*nai/i, '동나이'],
  // Binh Duong
  [/b[iì]nh\s*d[uư][oơ]ng/i, '빈증'],
  // Nha Trang / Khanh Hoa
  [/nha\s*trang|kh[aá]nh\s*h[oò]a/i, '나트랑'],
  // Hue
  [/hu[eế]/i, '후에'],
  // Vung Tau
  [/v[uũ]ng\s*t[aà]u/i, '붕따우'],
  // Da Lat / Lam Dong
  [/đ[aà]\s*l[aạ]t|dalat|lâm đồng/i, '달랏'],
  // Long An, Tay Ninh, etc
  [/long\s*an/i, '롱안'],
  [/t[aâ]y\s*ninh/i, '떠이닌'],
  // Nghe An / Vinh
  [/ngh[eệ]\s*an|vinh/i, '응에안'],
  // Thanh Hoa
  [/thanh\s*h[oó]a/i, '타인호아'],
  // Quang Ninh / Ha Long
  [/qu[aả]ng\s*ninh|h[aạ]\s*long/i, '꽝닌'],
  // Dak Lak
  [/đ[aắ][kc]\s*l[aắ][kc]/i, '닥락'],
  // Bac Ninh
  [/b[aắ]c\s*ninh/i, '박닌'],
  // Thai Nguyen
  [/th[aá]i\s*nguy[eê]n/i, '타이응우옌'],
]

function localizeLocation(raw, lang) {
  if (!raw || lang !== 'ko') return raw || ''
  for (const [regex, ko] of LOCATION_KO_RULES) {
    if (regex.test(raw)) return ko
  }
  return raw
}

function formatAge(age, lang) {
  if (!age) return ''
  if (lang === 'ko') return `만 ${age}세`
  if (lang === 'vi') return `${age} tuổi`
  return `${age}y`
}

function formatYOE(months, lang) {
  if (!months && months !== 0) return ''
  if (lang === 'ko') {
    if (months >= 12) {
      const y = Math.floor(months / 12)
      const m = months % 12
      return m > 0 ? `${y}년 ${m}개월` : `${y}년`
    }
    return `${months}개월`
  }
  if (lang === 'vi') {
    if (months >= 12) {
      const y = Math.floor(months / 12)
      const m = months % 12
      return m > 0 ? `${y} năm ${m} tháng` : `${y} năm`
    }
    return `${months} tháng`
  }
  // en
  if (months >= 12) return `${Math.round(months / 12)}y`
  return `${months}m`
}

// Parse project text into structured blocks
function formatProjects(raw) {
  if (!raw || raw.trim().toLowerCase() === 'không có.' || raw.trim().toLowerCase() === 'không có') return null
  let text = raw.trim()

  // Pre-process: inject line breaks before common project/company name patterns
  // Date ranges like "Company 06/2024 - 05/2025" or "Company (05/2024 – nay)"
  text = text.replace(/\.\s+(?=[A-ZĐÀÁẢÃẠ][a-zA-ZÀ-ỹ\s&.]*(?:\d{2}\/\d{4}|\(\d{2}))/g, '.\n')
  // "- " bullet points mid-sentence
  text = text.replace(/\.\s+- /g, '.\n- ')
  text = text.replace(/(?<=[a-zà-ỹ.])\s+- (?=[A-ZĐÀÁẢÃẠ])/g, '\n- ')
  // Numbered items "1. " "2. "
  text = text.replace(/\s+(\d+\s*[.)]\s)/g, '\n$1')
  // "Role:" or "Key achievements:" or "Responsibilities:" patterns
  text = text.replace(/\s+(Role|Key achievements|Responsibilities|Position|Mô tả|Công nghệ)[:\s]/gi, '\n$1: ')
  // Project/Dự án prefix
  text = text.replace(/\s+(Dự án|Project|Capstone)[:\s]/gi, '\n$1: ')
  // Company names followed by date: "CompanyName 06/2024"
  text = text.replace(/\s+(?=(?:[A-Z][a-zA-Z]+\s*){1,4}\d{2}\/\d{4})/g, '\n')

  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)

  const blocks = []
  let current = null

  for (const line of lines) {
    // Detect a "title" line
    const isTitleLine = (
      /^(Dự án|Project|Capstone)[:\s]/i.test(line) ||
      /\d{2}\/\d{4}\s*[–\-]\s*(\d{2}\/\d{4}|nay|now|present)/i.test(line) || // has date range
      /\(\d{2}\/\d{4}\s*[–-]/.test(line) ||
      /^\d+\s*[.)]\s/.test(line)
    )

    if (isTitleLine) {
      current = { title: line, details: [] }
      blocks.push(current)
    } else if (/^[-●•–]\s/.test(line)) {
      // Bullet point — attach to current block or create new
      if (!current) { current = { title: null, details: [] }; blocks.push(current) }
      current.details.push(line)
    } else if (/^(Role|Key achievements|Responsibilities|Position|Mô tả|Công nghệ)[:\s]/i.test(line)) {
      // Sub-header — attach to current
      if (!current) { current = { title: null, details: [] }; blocks.push(current) }
      current.details.push(line)
    } else if (current) {
      current.details.push(line)
    } else {
      current = { title: null, details: [line] }
      blocks.push(current)
    }
  }

  if (blocks.length === 0) {
    return [{ title: null, details: [text] }]
  }
  return blocks
}

function ProjectSection({ projects }) {
  const blocks = formatProjects(projects)
  if (!blocks) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((block, i) => (
        <div key={i} style={{ background: '#f9f9f9', borderRadius: 8, padding: '10px 14px' }}>
          {block.title && (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#222', marginBottom: block.details.length > 0 ? 6 : 0 }}>
              {block.title}
            </div>
          )}
          {block.details.map((d, j) => {
            // Detect URLs and make them clickable
            const urlMatch = d.match(/(https?:\/\/[^\s]+)/g)
            if (urlMatch && d.trim() === urlMatch[0]) {
              return <a key={j} href={d.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#ff6000', wordBreak: 'break-all', display: 'block', marginTop: 2 }}>{d.trim()}</a>
            }
            // Sub-header lines (Role:, Key achievements:, etc)
            const isSubHeader = /^(Role|Key achievements|Responsibilities|Position|Mô tả|Công nghệ)[:\s]/i.test(d)
            // Bullet point lines
            const isBullet = /^[-●•–]\s/.test(d)
            return (
              <div key={j} style={{
                fontSize: 12,
                color: isSubHeader ? '#333' : '#555',
                fontWeight: isSubHeader ? 600 : 400,
                lineHeight: 1.6,
                paddingLeft: isBullet ? 12 : 0,
                marginTop: isSubHeader ? 4 : 0,
              }}>
                {isBullet ? <><span style={{ color: '#ccc', marginRight: 4 }}>·</span>{d.replace(/^[-●•–]\s*/, '')}</> : d}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Translate Vietnamese university names to Korean
function localizeUniversity(raw, lang) {
  if (!raw || lang !== 'ko') return raw || ''
  let s = raw
  // Remove graduation info appended to university name
  s = s.replace(/\s*[-–,]\s*(Tốt nghiệp|tốt nghiệp|đã tốt nghiệp|Dự kiến|đợt tốt nghiệp|thời gian tốt nghiệp)[^)]*$/i, '')
  s = s.replace(/\s*\(?(Tốt nghiệp|tốt nghiệp|đã tốt nghiệp|Dự kiến|đợt tốt nghiệp)[^)]*\)?$/i, '')
  s = s.replace(/\s*[-–,]\s*\d{1,2}\/\d{4}\s*$/, '')
  s = s.replace(/\s*[-–]\s*\d{4}\s*$/, '')
  s = s.trim()

  // Known university mappings
  const map = [
    [/Bách Khoa/i, '백과대학교 (호치민 국립공대)'],
    [/Khoa [Hh]ọc [Tt]ự [Nn]hiên/i, '자연과학대학교 (호치민 국립대)'],
    [/FPT/i, 'FPT 대학교'],
    [/Hutech/i, 'HUTECH 대학교'],
    [/RMIT/i, 'RMIT 베트남'],
    [/Tôn Đức Thắng/i, '톤득탕 대학교'],
    [/Sư [Pp]hạm [Kk]ỹ [Tt]huật/i, '호치민 기술사범대학교'],
    [/Sư [Pp]hạm\b(?!\s*[Kk]ỹ)/i, '호치민 사범대학교'],
    [/Công [Nn]ghiệp/i, '호치민 공업대학교'],
    [/Công [Tt]hương|HUIT/i, '호치민 공상대학교'],
    [/Mở/i, '호치민 개방대학교'],
    [/Cần Thơ/i, '껀터 대학교'],
    [/Bưu [Cc]hính [Vv]iễn [Tt]hông/i, '정보통신기술대학교'],
    [/Tài [Nn]guyên/i, '호치민 자원환경대학교'],
    [/GTVT|Giao [Tt]hông/i, '교통대학교'],
    [/Kiên Giang/i, '끼엔장 대학교'],
    [/Industrial University/i, '호치민 공업대학교'],
    [/UTH/i, '호치민 교통대학교'],
  ]
  for (const [regex, ko] of map) {
    if (regex.test(s)) return ko
  }
  // Fallback: clean up "Trường Đại học" / "Đại học" prefix
  s = s.replace(/^(Trường\s+)?Đại\s+[Hh]ọc\s*/i, '')
  s = s.replace(/^(Học viện)\s*/i, '')
  return s ? `${s} 대학교` : raw
}

// Translate Vietnamese English level descriptions to Korean
function localizeEnglish(level, cert, lang) {
  if (lang !== 'ko') return [level, cert].filter(Boolean).join(' · ') || null

  let combined = [level, cert].filter(Boolean).join(' ')
  if (!combined) return null

  // Extract score/cert info
  const toeicMatch = combined.match(/TOEI?C[:\s]*(\d{3,4})/i)
  const ieltsMatch = combined.match(/IELTS[:\s]*([\d.]+)/i)

  let result = ''
  if (ieltsMatch) {
    result = `IELTS ${ieltsMatch[1]}`
  } else if (toeicMatch) {
    result = `TOEIC ${toeicMatch[1]}`
  }

  // Map proficiency level
  const lower = combined.toLowerCase()
  let proficiency = ''
  if (/c2|native|원어민/i.test(lower)) proficiency = '최상급'
  else if (/c1|advanced|business|tốt\b/i.test(lower)) proficiency = '상급'
  else if (/b2|upper|intermediate.*b2/i.test(lower)) proficiency = '중상급'
  else if (/b1|intermediate|khá/i.test(lower)) proficiency = '중급'
  else if (/a2|elementary|cơ bản|basic/i.test(lower)) proficiency = '초급'
  else if (/a1|beginner/i.test(lower)) proficiency = '입문'
  else if (/đọc.*tài liệu|đọc hiểu/i.test(lower)) proficiency = '문서 독해 가능'
  else if (/nghe.*đọc/i.test(lower)) proficiency = '듣기·읽기 가능'

  if (result && proficiency) return `${result} (${proficiency})`
  if (result) return result
  if (proficiency) return proficiency
  return '기본'
}

// Translate Vietnamese major to Korean
function localizeMajor(raw, lang) {
  if (!raw || lang !== 'ko') return raw || null
  const s = raw.trim()
  if (s === '.' || s.length < 2) return null

  // Order matters — more specific patterns first
  const map = [
    // Software Engineering (many typos: Phầm, Phần Mền, phần memef, etc)
    [/ph[aầ][nm]\s*m[eềể][mnm]/i, '소프트웨어공학'],
    [/software\s*(engineer|develop|tech|application)/i, '소프트웨어공학'],
    [/k[yỹỷ]\s*(thu[aậ][ntl]|ngh[eệ])\s*ph/i, '소프트웨어공학'],
    [/HDSE|Higher Diploma.*Software/i, '소프트웨어공학'],
    // AI
    [/tr[ií]\s*tu[eệ]\s*nh[aâ]n\s*t[aạ]o|artificial\s*intel|applied\s*ai|\bAI\b/i, '인공지능'],
    // Data Science / Data Engineering
    [/d[uữ]\s*li[eệ]u|data\s*(science|engineer)/i, '데이터공학'],
    // Computer Science
    [/khoa\s*h[oọ]c\s*m[aá]y\s*t[ií]nh|computer\s*sci|science\s*comput/i, '컴퓨터과학'],
    // Information Security
    [/an\s*to[aà]n\s*th[oô]ng\s*tin|information\s*security/i, '정보보안'],
    // Information Systems
    [/h[eệ]\s*th[oố]ng\s*th[oô]ng\s*tin|information\s*system/i, '정보시스템'],
    // Network / Telecom
    [/m[aạ]ng|network|truy[eề]n\s*th[oô]ng|telecommun|computer\s*network/i, '네트워크공학'],
    // Electronics
    [/[đd]i[eệ][nê]n?\s*t[uử]|electronic/i, '전자공학'],
    // Computer Engineering
    [/k[yỹ]\s*thu[aậ]t\s*m[aá]y\s*t[ií]nh|computer\s*engineer|nh[uú]ng|embedded|IoT/i, '컴퓨터공학'],
    // IT / CNTT (broad — catch-all for Công nghệ thông tin variants)
    [/c[oô]ng\s*ngh[eệ]\s*th[oô][nng]*\s*tin|information\s*tech|\bCNTT\b|\bIT\b|tin\s*h[oọ]c/i, 'IT (정보기술)'],
    // Web development
    [/l[aậ]p\s*tr[iì]nh\s*(web|website|vi[eê]n)|web\s*develop|fullstack\s*develop/i, '웹 개발'],
    // Programming general
    [/l[aậ]p\s*tr[iì]nh/i, '프로그래밍'],
    // Multimedia / Design
    [/[đd]a\s*ph[uư][oơ]ng\s*ti[eệ]n|graphic\s*design|thi[eế]t\s*k[eế]|design/i, '디자인'],
    // Business
    [/qu[aả]n\s*tr[iị]|kinh\s*doanh|marketing|th[uư][oơ]ng\s*m[aạ]i|MBA|finance|banking|t[aà]i\s*ch[ií]nh|k[eế]\s*to[aá]n/i, '경영학'],
    // Math
    [/to[aá]n/i, '수학'],
    // Korean language
    [/ng[oô]n\s*ng[uữ]\s*h[aà]n|한국어/i, '한국어학'],
    // English language
    [/ng[oô]n\s*ng[uữ]\s*anh/i, '영어학'],
    // Other engineering
    [/c[oơ]\s*[đd]i[eệ]n|mechanical|x[aâ]y\s*d[uự]ng/i, '공학'],
    // Pharmacy / Chemistry / Biology
    [/d[uư][oợ]c|h[oó]a|sinh\s*h[oọ]c/i, '자연과학'],
  ]
  for (const [regex, ko] of map) {
    if (regex.test(s)) return ko
  }
  // If it's already English, return as-is
  if (/^[a-zA-Z\s\-&()/]+$/.test(s)) return s
  return raw
}

function StatBar({ label, value, color }) {
  if (value == null) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#999', width: 28, textAlign: 'right', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color || statColor(value), borderRadius: 2, transition: 'width .5s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: statColor(value), width: 22, textAlign: 'right', flexShrink: 0 }}>{value}</span>
    </div>
  )
}

function statColor(v) {
  if (v >= 80) return '#22c55e'
  if (v >= 60) return '#eab308'
  if (v >= 40) return '#f97316'
  return '#ef4444'
}

function ovrColor(v) {
  if (v >= 80) return { bg: 'linear-gradient(135deg, #16a34a, #22c55e)', text: '#fff' }
  if (v >= 65) return { bg: 'linear-gradient(135deg, #ca8a04, #eab308)', text: '#000' }
  if (v >= 50) return { bg: 'linear-gradient(135deg, #c2410c, #f97316)', text: '#fff' }
  return { bg: 'linear-gradient(135deg, #991b1b, #ef4444)', text: '#fff' }
}

function CandidateCard({ c, onRequestIntro, onDetail, onToggleSave, isSaved, t, lang }) {
  const ovr = ovrColor(c.stat_overall || 0)
  const yoeLabel = formatYOE(c.yoe_months, lang)
  const loc = localizeLocation(c.location, lang)
  const ageLabel = formatAge(c.age, lang)
  return (
    <div onClick={() => onDetail(c)} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14, padding: 0, cursor: 'pointer', transition: 'all .2s', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      onMouseEnter={e => { e.currentTarget.style.border = '1px solid #ccc'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.border = '1px solid #e5e5e5'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Header with OVR + save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: ovr.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: ovr.text }}>{c.stat_overall || '?'}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.name_vi || c.name_en || 'Unknown'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ff6000', background: 'rgba(255,96,0,0.08)', padding: '1px 8px', borderRadius: 100 }}>{c.position}</span>
            <span style={{ fontSize: 11, color: '#999' }}>{yoeLabel}</span>
          </div>
        </div>
      </div>

      {/* Stats — always 4 rows, no conditional soft */}
      <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <StatBar label={t('hr.card.exp')} value={c.stat_experience} />
        <StatBar label={t('hr.card.tech')} value={c.stat_tech} />
        <StatBar label={t('hr.card.eng')} value={c.stat_english} />
        <StatBar label={t('hr.card.edu')} value={c.stat_education} />
      </div>

      {/* Tech stack tags — fixed height row */}
      <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 24 }}>
        {c.tech_stack && c.tech_stack.length > 0 ? (<>
          {c.tech_stack.slice(0, 4).map((tk, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 600, color: '#555', background: '#f3f3f3', padding: '2px 7px', borderRadius: 4 }}>{tk}</span>
          ))}
          {c.tech_stack.length > 4 && <span style={{ fontSize: 10, color: '#aaa' }}>+{c.tech_stack.length - 4}</span>}
        </>) : (
          <span style={{ fontSize: 10, color: '#ccc' }}>-</span>
        )}
      </div>

      {/* Location / Age */}
      <div style={{ padding: '0 16px 10px' }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>
          {loc}{ageLabel ? ` · ${ageLabel}` : ''}
        </span>
      </div>

      {/* Footer — action buttons */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
        <button onClick={e => { e.stopPropagation(); onToggleSave(c.id) }}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', borderRadius: 8, border: '1px solid #e5e5e5', background: '#fff', color: isSaved ? '#eab308' : '#999', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> {isSaved ? t('hr.card.saved') : t('hr.card.save')}
        </button>
        {c.interest ? (
          <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 12, fontWeight: 700 }}>
            {t('hr.card.requested')}
          </div>
        ) : (
          <button onClick={e => { e.stopPropagation(); onRequestIntro(c) }}
            style={{ flex: 2, padding: '8px 0', borderRadius: 8, border: 'none', background: '#ff6000', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
            {t('hr.card.contact')}
          </button>
        )}
      </div>
    </div>
  )
}

function DetailModal({ candidate: c, onClose, onRequestIntro, onToggleSave, isSaved, t, lang }) {
  if (!c) return null
  const ovr = ovrColor(c.stat_overall || 0)
  const yoeLabel = formatYOE(c.yoe_months, lang)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="hr-detail-modal" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto', border: '1px solid #e5e5e5', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <style>{`.hr-detail-modal::-webkit-scrollbar { display: none; } .hr-detail-modal { scrollbar-width: none; }`}</style>
        {/* Close bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#bbb', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
        </div>

        {/* Header */}
        <div style={{ padding: '12px 24px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: ovr.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: ovr.text }}>{c.stat_overall || '?'}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{c.name_vi}</div>
              {c.name_en && <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>{c.name_en}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ff6000', background: '#fff7ed', padding: '2px 10px', borderRadius: 100 }}>{c.position}</span>
                <span style={{ fontSize: 12, color: '#999' }}>{yoeLabel}</span>
              </div>
            </div>
            <button onClick={() => onToggleSave(c.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: isSaved ? '#eab308' : '#ccc' }}
              title={isSaved ? t('hr.card.unsave') : t('hr.card.save')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatBar label={t('hr.card.exp')} value={c.stat_experience} />
          <StatBar label={t('hr.card.tech')} value={c.stat_tech} />
          <StatBar label={t('hr.card.eng')} value={c.stat_english} />
          <StatBar label={t('hr.card.edu')} value={c.stat_education} />
          {c.stat_soft && <StatBar label={t('hr.card.soft')} value={c.stat_soft} />}
        </div>

        {/* Info sections */}
        <div style={{ padding: '0 24px 24px' }}>
          {[
            { label: t('hr.detail.location'), value: localizeLocation(c.location, lang) || null },
            { label: t('hr.detail.age'), value: c.age ? formatAge(c.age, lang) : null },
            { label: t('hr.detail.university'), value: localizeUniversity(c.university, lang) || null },
            { label: t('hr.detail.major'), value: localizeMajor(c.major, lang) },
            { label: t('hr.detail.graduation'), value: c.graduation_status === 'graduated' ? t('hr.detail.graduated') : c.graduation_status === 'upcoming' ? t('hr.detail.upcoming') : null },
            { label: t('hr.detail.english'), value: localizeEnglish(c.english_level, c.english_cert, lang) },
            { label: t('hr.detail.korean'), value: c.korean_level || null },
            { label: t('hr.detail.techStack'), value: c.tech_stack?.join(', ') || null },
          ].filter(s => s.value).map((s, i) => (
            <div key={i} style={{ display: 'flex', borderBottom: '1px solid #f5f5f5', padding: '10px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#999', width: 100, flexShrink: 0 }}>{s.label}</span>
              <span style={{ fontSize: 13, color: '#333' }}>{s.value}</span>
            </div>
          ))}

          {c.cv_url && (
            <a href={c.cv_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: '12px 0', borderRadius: 10, border: '1px solid #e5e5e5', background: '#fafafa', color: '#333', fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'background .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fafafa' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              {t('hr.detail.viewCV')}
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
          <button onClick={() => onToggleSave(c.id)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 10, border: '1px solid #e5e5e5', background: '#fff', color: isSaved ? '#eab308' : '#999', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> {isSaved ? t('hr.card.saved') : t('hr.card.save')}
          </button>
          {c.interest ? (
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', borderRadius: 10 }}>{t('hr.detail.alreadyRequested')}</div>
          ) : (
            <button onClick={() => onRequestIntro(c)}
              style={{ flex: 2, padding: 14, borderRadius: 10, border: 'none', background: '#ff6000', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
              {t('hr.detail.requestIntro')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Confirmation popup for introduction request
function ConfirmModal({ candidate, onConfirm, onCancel, t }) {
  if (!candidate) return null
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px 28px', maxWidth: 400, width: '100%', border: '1px solid #e5e5e5', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 8 }}>
          {t('hr.confirm.title')}
        </div>
        <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 24 }}>
          {t('hr.confirm.desc', { name: candidate.name_vi || candidate.name_en || '' })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e5e5', background: '#fff', color: '#888', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('hr.confirm.cancel')}
          </button>
          <button onClick={onConfirm}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#ff6000', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('hr.confirm.yes')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HRDashboard() {
  const router = useRouter()
  const { t, lang } = useT()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [hrStatus, setHrStatus] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [position, setPosition] = useState('all')
  const [sort, setSort] = useState('stat_overall')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [detail, setDetail] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null) // candidate to confirm intro
  const [savedIds, setSavedIds] = useState([]) // scrap/bookmark
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/hr/login'); return }
      setUser(session.user)
      setToken(session.access_token)

      const res = await fetch(`/api/hr/status?userId=${session.user.id}`)
      const data = await res.json()

      if (!data.isHR) { router.replace('/'); return }
      setHrStatus(data.status)
      setLoading(false)
      // Restore saved candidates from localStorage
      try { const s = localStorage.getItem('fyi_hr_saved'); if (s) setSavedIds(JSON.parse(s)) } catch {}
    })
  }, [])

  const fetchCandidates = useCallback(async () => {
    if (!token) return
    setFetching(true)
    const params = new URLSearchParams({ position, sort, order: 'desc', page: String(page), limit: '21' })
    if (search) params.set('search', search)
    const res = await fetch(`/api/hr/candidates?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setCandidates(data.candidates)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    }
    setFetching(false)
  }, [token, position, sort, page, search])

  useEffect(() => { if (!loading && hrStatus === 'approved') fetchCandidates() }, [fetchCandidates, loading, hrStatus])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [position, sort, search])

  // Show confirmation popup
  const handleRequestIntro = (c) => setConfirmTarget(c)

  // Actually send the request after confirmation
  const handleConfirmIntro = async () => {
    if (!token || !confirmTarget) return
    const res = await fetch('/api/hr/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ candidateId: confirmTarget.id }),
    })
    if (res.ok) {
      setCandidates(prev => prev.map(x => x.id === confirmTarget.id ? { ...x, interest: 'pending' } : x))
      if (detail?.id === confirmTarget.id) setDetail(prev => ({ ...prev, interest: 'pending' }))
    }
    setConfirmTarget(null)
  }

  // Scrap toggle
  const handleToggleSave = (candidateId) => {
    setSavedIds(prev => {
      const next = prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]
      localStorage.setItem('fyi_hr_saved', JSON.stringify(next))
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #ff6000', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (hrStatus === 'pending') {
    return (<>
      <Head><title>{t('hr.pending.title')}</title></Head>
      <GlobalNav activePage="hr" />
      <div style={{ minHeight: 'calc(100vh - 56px)', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow', system-ui" }}>
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 16, padding: '48px 40px', maxWidth: 480, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9203;</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 12px' }}>{t('hr.pending.title')}</h1>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>{t('hr.pending.desc')}</p>
        </div>
      </div>
    </>)
  }

  if (hrStatus === 'rejected') {
    return (<>
      <Head><title>{t('hr.rejected.title')}</title></Head>
      <GlobalNav activePage="hr" />
      <div style={{ minHeight: 'calc(100vh - 56px)', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow', system-ui", color: '#111', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22 }}>{t('hr.rejected.title')}</h1>
          <p style={{ color: '#888', fontSize: 14 }}>{t('hr.rejected.desc')}</p>
        </div>
      </div>
    </>)
  }

  return (
    <>
      <Head><title>{t('hr.dash.title')} - FYI Salary</title></Head>
      <GlobalNav activePage="hr" />
      <style>{`
        .hr-page { min-height: calc(100vh - 56px); background: #f8f8f8; font-family: 'Barlow', system-ui, sans-serif; color: #111; }
        .hr-body { max-width: 1100px; margin: 0 auto; padding: 32px 24px 60px; }
        .hr-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 24px; }
        .hr-pos-btn { font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 100px; border: 1px solid #ddd; background: #fff; color: #888; cursor: pointer; font-family: inherit; transition: all .15s; }
        .hr-pos-btn:hover { border-color: #bbb; color: #555; }
        .hr-pos-btn.on { background: #fff7ed; color: #ff6000; border-color: #fed7aa; }
        .hr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .hr-search { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px; color: #111; font-size: 13px; font-family: inherit; outline: none; width: 200px; }
        .hr-search::placeholder { color: #bbb; }
        .hr-search:focus { border-color: #ff6000; }
        .hr-sort { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 6px 10px; color: #555; font-size: 12px; font-family: inherit; outline: none; cursor: pointer; }
        .hr-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 32px; }
        .hr-pager button { background: #fff; border: 1px solid #ddd; color: #555; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: inherit; }
        .hr-pager button:disabled { opacity: 0.3; cursor: default; }
        @media (max-width: 900px) { .hr-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .hr-grid { grid-template-columns: 1fr; } .hr-search { width: 100%; } }
      `}</style>

      <div className="hr-page">
        <div className="hr-body">
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{t('hr.dash.title')}</h1>
            <p style={{ fontSize: 14, color: '#999', margin: '4px 0 0' }}>
              {total > 0 ? t('hr.dash.count', { count: total }) : t('hr.dash.sub')}
            </p>
          </div>

          {/* Filters */}
          <div className="hr-filters">
            {POSITIONS.map(p => (
              <button key={p} className={`hr-pos-btn${position === p ? ' on' : ''}`}
                onClick={() => setPosition(p)}>
                {p === 'all' ? t('hr.filter.all') : p}
              </button>
            ))}
          </div>

          {/* Saved filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className={`hr-pos-btn${!showSaved ? ' on' : ''}`} onClick={() => setShowSaved(false)}>
              {t('hr.filter.all')} ({total})
            </button>
            <button className={`hr-pos-btn${showSaved ? ' on' : ''}`} onClick={() => setShowSaved(true)}
              style={showSaved ? { background: 'rgba(234,179,8,0.15)', color: '#eab308', borderColor: 'rgba(234,179,8,0.3)' } : {}}>
              {t('hr.filter.saved')} ({savedIds.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input className="hr-search" placeholder={t('hr.filter.search')}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }} />
            <select className="hr-sort" value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_KEYS.map(k => (
                <option key={k} value={k}>{t('hr.filter.sortBy')} {t(`hr.sort.${k === 'stat_overall' ? 'overall' : k === 'stat_experience' ? 'experience' : k === 'stat_tech' ? 'tech' : k === 'stat_english' ? 'english' : 'yoe'}`)}</option>
              ))}
            </select>
          </div>

          {/* Cards grid */}
          {fetching ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Loading...</div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#bbb', fontSize: 15 }}>{t('hr.dash.empty')}</div>
          ) : (
            <div className="hr-grid">
              {(showSaved ? candidates.filter(c => savedIds.includes(c.id)) : candidates).map(c => (
                <CandidateCard key={c.id} c={c} onRequestIntro={handleRequestIntro} onDetail={setDetail} onToggleSave={handleToggleSave} isSaved={savedIds.includes(c.id)} t={t} lang={lang} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="hr-pager">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span style={{ fontSize: 13, color: '#999' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {detail && <DetailModal candidate={detail} onClose={() => setDetail(null)} onRequestIntro={handleRequestIntro} onToggleSave={handleToggleSave} isSaved={savedIds.includes(detail.id)} t={t} lang={lang} />}

      {/* Confirmation popup */}
      {confirmTarget && <ConfirmModal candidate={confirmTarget} onConfirm={handleConfirmIntro} onCancel={() => setConfirmTarget(null)} t={t} />}
    </>
  )
}
