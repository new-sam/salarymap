import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'
import { cityLabel } from '../../lib/cities'
import UserAssetCards from './UserAssetCards'

// 유입 출처 배지. resume_source(cv/profile/jobs/app)가 있으면 그걸로,
// 없으면 platform 기준으로 추정해서 채운다 — 옛 행도 어디서 등록된 건지
// 추정해서 표시한다 ("웹 (이전)" 처럼 모호한 라벨을 쓰지 않는다).
const SOURCE_MAP = {
  cv:      { label: '축하금 이벤트',  bg: '#FFEDD5', color: '#C2410C' },
  profile: { label: '프로필',     bg: '#DBEAFE', color: '#1D4ED8' },
  jobs:    { label: '채용 지원',  bg: '#FCE7F3', color: '#BE185D' },
  app:     { label: '앱',         bg: '#EEF2FF', color: '#4F46E5' },
}

function SourceBadge({ source, platform }) {
  const key = resolveSource({ resume_source: source, resume_platform: platform })
  const s = SOURCE_MAP[key]
  if (!s) return <span style={{ color: '#ccc', fontSize: 11 }}>미상</span>
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
}

// resume_source 가 명시되어 있으면 그대로, 없으면 platform 으로 추정.
// 옛 행은 app=앱, web/null=profile(가장 흔한 직접 등록 경로) 로 본다.
function resolveSource(r) {
  if (r.resume_source) return r.resume_source
  if (r.resume_platform === 'app') return 'app'
  if (r.resume_url) return 'profile' // legacy fallback: 직접 등록이 기본 경로
  return null
}

export default function ResumesView({ token, t, lang = 'ko' }) {
  const { data: resumes, isLoading: loading, mutate } = useAdmin('/api/admin/resumes', token)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, public, private
  const [sourceFilter, setSourceFilter] = useState('all') // all | cv | profile | jobs | app | web_legacy
  const [parsing, setParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0, name: '' })
  const [parseResults, setParseResults] = useState(null)

  function downloadCsv() {
    if (!resumes || resumes.length === 0) return
    const headers = ['Name', 'Email', 'Source', 'Platform', 'Position', 'YoE (months)', 'Location', 'University', 'Major', 'Work Type', 'Public', 'Resume URL', 'Updated']
    const rows = filtered.map(r => [
      r.full_name,
      r.email,
      r.resume_source || '',
      r.resume_platform || '',
      r.position || '',
      r.yoe_months ?? '',
      r.location || '',
      r.university || '',
      r.major || '',
      r.work_type || '',
      r.is_resume_public ? 'Yes' : 'No',
      r.resume_url,
      r.updated_at ? new Date(r.updated_at).toLocaleString('ko-KR') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resume-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const unfilled = resumes ? resumes.filter(r => !r.position && (!r.skills || (Array.isArray(r.skills) && r.skills.length === 0))) : []

  async function runAiParse() {
    if (parsing || unfilled.length === 0) return
    setParsing(true)
    setParseResults(null)
    const results = { success: 0, fail: 0, errors: [] }

    for (let i = 0; i < unfilled.length; i++) {
      const user = unfilled[i]
      setParseProgress({ current: i + 1, total: unfilled.length, name: user.full_name || user.email || 'Unknown' })
      try {
        const res = await fetch('/api/admin/parse-resumes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id }),
        })
        if (res.ok) {
          const parsed = await res.json()
          // Update local state
          mutate(prev => prev.map(r => r.id === user.id ? { ...r, ...parsed, skills: parsed.skills } : r), false)
          results.success++
        } else {
          const err = await res.json()
          results.fail++
          results.errors.push(`${user.full_name || user.email}: ${err.error}`)
        }
      } catch (e) {
        results.fail++
        results.errors.push(`${user.full_name || user.email}: ${e.message}`)
      }
    }

    setParseResults(results)
    setParsing(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{t.resumesLoading}</div>
  if (!resumes || resumes.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.resumesEmpty}</div>

  const filtered = resumes.filter(r => {
    if (filter === 'public' && !r.is_resume_public) return false
    if (filter === 'private' && r.is_resume_public) return false
    if (sourceFilter !== 'all') {
      const s = resolveSource(r)
      if (sourceFilter === 'unknown' ? s !== null : s !== sourceFilter) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (r.full_name || '').toLowerCase().includes(q)
        || (r.email || '').toLowerCase().includes(q)
        || (r.position || '').toLowerCase().includes(q)
        || (r.university || '').toLowerCase().includes(q)
    }
    return true
  })

  const publicCount = resumes.filter(r => r.is_resume_public).length

  function formatYoe(months) {
    if (months === null || months === undefined) return '-'
    const ko = lang === 'ko'
    if (months === 0) return ko ? '신입' : 'New grad'
    const y = Math.floor(months / 12)
    const m = months % 12
    if (ko) {
      if (y === 0) return `${m}개월`
      if (m === 0) return `${y}년`
      return `${y}년 ${m}개월`
    }
    if (y === 0) return `${m}m`
    if (m === 0) return `${y}y`
    return `${y}y ${m}m`
  }

  const pillStyle = (on) => ({
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', borderRadius: 999, padding: '6px 12px',
    border: '1px solid', borderColor: on ? '#ff4400' : '#E5E8EB',
    background: on ? '#FFF1EC' : '#fff', color: on ? '#ff4400' : '#4E5968',
    whiteSpace: 'nowrap', flexShrink: 0,
  })

  return (
    <>
      <UserAssetCards token={token} keys={['resumeHolders', 'resumePublic']} />

      {/* Row 1: 제목 · 카운트 | 검색 · 액션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#191F28' }}>{t.resumesTitle}</h3>
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            {t.resumesTotal} <strong style={{ color: '#191F28' }}>{resumes.length}</strong>{t.resumesUnit}
            <span style={{ margin: '0 6px', color: '#DDE1E6' }}>·</span>
            {t.resumesPublic} <strong style={{ color: '#191F28' }}>{publicCount}</strong>{t.resumesUnit}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.resumesSearch}
            style={{ padding: '8px 12px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, width: 200, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={runAiParse} disabled={parsing || unfilled.length === 0}
            style={{ padding: '8px 13px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: unfilled.length === 0 ? '#ADB5BD' : '#4E5968', cursor: parsing || unfilled.length === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
            {parsing ? `AI 분석 중 ${parseProgress.current}/${parseProgress.total}` : `AI 분석 ${unfilled.length}`}
          </button>
          <button onClick={downloadCsv}
            style={{ padding: '8px 13px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: '#4E5968', cursor: 'pointer' }}>
            CSV
          </button>
        </div>
      </div>

      {/* Row 2: 필터 (공개여부 · 유입) — 별도 줄로 분리해 줄바꿈 방지 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {[{ key: 'all', label: t.resumesFilterAll }, { key: 'public', label: t.resumesFilterPublic }, { key: 'private', label: t.resumesFilterPrivate }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={pillStyle(filter === f.key)}>{f.label}</button>
          ))}
        </div>
        <span style={{ width: 1, height: 16, background: '#E5E8EB', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {[{ key: 'all', label: '전체' }, { key: 'cv', label: '축하금 이벤트' }, { key: 'profile', label: '프로필' }, { key: 'jobs', label: '채용 지원' }, { key: 'app', label: '앱' }, { key: 'unknown', label: '미상' }].map(f => {
            const count = f.key === 'all' ? resumes.length : f.key === 'unknown' ? resumes.filter(r => resolveSource(r) === null).length : resumes.filter(r => resolveSource(r) === f.key).length
            const on = sourceFilter === f.key
            return <button key={f.key} onClick={() => setSourceFilter(f.key)} style={pillStyle(on)}>{f.label} <span style={{ opacity: on ? 0.7 : 0.5 }}>{count}</span></button>
          })}
        </div>
      </div>

      {/* AI Parse Progress */}
      {parsing && (
        <div style={{ marginBottom: 16, padding: 16, background: '#EEF2FF', borderRadius: 12, border: '1px solid #C7D2FE' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5' }}>
              {parseProgress.name} 분석 중...
            </span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {parseProgress.current} / {parseProgress.total}
            </span>
          </div>
          <div style={{ height: 6, background: '#C7D2FE', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#4F46E5', borderRadius: 3, transition: 'width 0.3s',
              width: `${(parseProgress.current / parseProgress.total) * 100}%`,
            }} />
          </div>
        </div>
      )}

      {/* AI Parse Results */}
      {parseResults && (
        <div style={{
          marginBottom: 16, padding: 16, borderRadius: 12,
          background: parseResults.fail > 0 ? '#FEF3C7' : '#D1FAE5',
          border: `1px solid ${parseResults.fail > 0 ? '#FDE68A' : '#A7F3D0'}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: parseResults.errors.length > 0 ? 8 : 0 }}>
            AI 분석 완료: {parseResults.success}명 성공{parseResults.fail > 0 ? `, ${parseResults.fail}명 실패` : ''}
          </div>
          {parseResults.errors.length > 0 && (
            <div style={{ fontSize: 12, color: '#92400E' }}>
              {parseResults.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#fafafa' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesName}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>유입</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesPosition}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesYoe}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesLocation}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesUniversity}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{t.resumesPublicLabel}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{t.resumesFile}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{t.resumesUpdated}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '8px 12px', color: '#999' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.photo_url ? (
                        <img src={r.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>
                          {(r.full_name || '?')[0]}
                        </div>
                      )}
                      <div>
                        <div>{r.full_name || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}><SourceBadge source={r.resume_source} platform={r.resume_platform} /></td>
                  <td style={{ padding: '8px 12px' }}>
                    {r.position ? (
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#4F46E5' }}>
                        {r.position}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{formatYoe(r.yoe_months)}</td>
                  <td style={{ padding: '8px 12px', color: '#666' }}>{cityLabel(r.location, lang) || '-'}</td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {r.university || '-'}
                    {r.major && <span style={{ color: '#999' }}> / {r.major}</span>}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: r.is_resume_public ? '#D1FAE5' : '#F3F4F6',
                      color: r.is_resume_public ? '#065F46' : '#999',
                    }}>
                      {r.is_resume_public ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <a href={r.resume_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#14B8A6', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
                      PDF
                    </a>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>
                    {r.updated_at ? new Date(r.updated_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t.resumesNoMatch}</div>
        )}
      </div>
    </>
  )
}
