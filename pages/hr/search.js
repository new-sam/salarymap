import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import HRLayout from '../../components/HRLayout'

// Demo-001 dummy (always shown)
const DEMO = {
  id: 'demo-001',
  name: '위승주', photo: 'https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/profiles/demo-001.jpg',
  headline: 'AI 솔루션 도입으로 결제 전환율 +75% 달성, 플랜핏 PO 인턴',
  position: 'PM', yoe_months: 7,
  signal: 'active',
  location: '서울',
  skills: ['서비스기획', '데이터분석', 'Figma'],
  company: '(주)플랜핏 Planfit',
  updated_at: new Date().toISOString(),
}

const SIGNAL_MAP = {
  active: { label: '적극 구직중', color: '#22c55e' },
  open: { label: '좋은 기회 환영', color: '#f59e0b' },
  passive: { label: '비공개', color: '#ccc' },
}

const POSITIONS = ['전체', 'Backend', 'Frontend', 'Fullstack', 'Mobile', 'AI/Data', 'DevOps', 'PM']

function getInitials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').slice(-2).toUpperCase()
}

function getColor(id) {
  const colors = ['#ff6000','#2563eb','#7c3aed','#16a34a','#db2777','#0891b2','#ca8a04','#64748b']
  return colors[(id || '').charCodeAt(((id || '').length || 1) - 1) % colors.length]
}

function getCompany(c) {
  if (c.company) return c.company
  if (c.experiences && c.experiences.length > 0) return c.experiences[0].company || ''
  return ''
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return '방금 전'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  const weeks = Math.floor(days / 7)
  return `${weeks}주 전`
}

function CandidateCard({ c, isSaved, onToggleSave }) {
  const sig = SIGNAL_MAP[c.signal] || SIGNAL_MAP.passive
  const yoe = c.yoe_months ? (c.yoe_months >= 12 ? `${Math.floor(c.yoe_months / 12)}년` : `${c.yoe_months}개월`) : ''
  const company = getCompany(c)
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 20px 16px', transition: 'all .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = '#ddd' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#eee' }}>
      <Link href={`/hr/talent/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14 }}>
        {c.photo ? (
          <img src={c.photo} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: getColor(c.id), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{getInitials(c.name)}</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{c.name}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: sig.color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sig.color, display: 'inline-block' }} />
              {sig.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 3, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.headline}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#bbb' }}>
            {company && <><span>{company}</span><span>·</span></>}
            {c.location && <><span>{c.location}</span><span>·</span></>}
            {yoe && <span>{yoe}</span>}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc' }}>{timeAgo(c.updated_at)}</span>
          </div>
        </div>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f5f5f5' }}>
        <div style={{ display: 'flex', gap: 5, overflow: 'hidden' }}>
          {(c.skills || []).slice(0, 3).map((s, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#666', background: '#f5f5f5', padding: '3px 10px', borderRadius: 4, whiteSpace: 'nowrap' }}>{s}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
          <button onClick={e => { e.preventDefault(); onToggleSave(c.id) }}
            style={{ background: 'none', border: '1px solid #eee', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="저장">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? '#f59e0b' : 'none'} stroke={isSaved ? '#f59e0b' : '#ccc'} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HRSearch() {
  const [position, setPosition] = useState('전체')
  const [searchText, setSearchText] = useState('')
  const [savedIds, setSavedIds] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
  }, [position, searchText])

  async function fetchProfiles() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const params = new URLSearchParams()
      if (position !== '전체') params.set('position', position)
      if (searchText) params.set('search', searchText)

      const resp = await fetch(`/api/hr/talent-search?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (resp.ok) {
        const { profiles: data } = await resp.json()
        setProfiles(data || [])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // Merge demo + real profiles (demo always first, skip if real profile has same id)
  const realIds = new Set(profiles.map(p => p.id))
  const demoMatch = position === '전체' || DEMO.position === position
  const all = [
    ...(demoMatch && !realIds.has(DEMO.id) ? [DEMO] : []),
    ...profiles,
  ]

  const toggleSave = (id) => {
    setSavedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <HRLayout title="인재 검색">
      <style>{`
        .hrs-filters { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .hrs-pos-btn { font-size: 12px; font-weight: 500; color: #888; background: #fff; border: 1px solid #eee; padding: 6px 14px; border-radius: 100px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .hrs-pos-btn:hover { border-color: #ddd; color: #555; }
        .hrs-pos-btn.on { background: #ff6000; color: #fff; border-color: #ff6000; font-weight: 600; }
        .hrs-search-wrap { margin-bottom: 16px; }
        .hrs-search-input { width: 100%; background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #111; outline: none; font-family: inherit; box-sizing: border-box; }
        .hrs-search-input::placeholder { color: #ccc; }
        .hrs-search-input:focus { border-color: #ddd; }
        .hrs-list { display: flex; flex-direction: column; gap: 10px; }
      `}</style>

      <div className="hrs-search-wrap">
        <input className="hrs-search-input" placeholder="이름, 기술 검색..."
          value={searchText} onChange={e => setSearchText(e.target.value)} />
      </div>

      <div className="hrs-filters">
        {POSITIONS.map(p => (
          <button key={p} className={`hrs-pos-btn${position === p ? ' on' : ''}`}
            onClick={() => setPosition(p)}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#bbb' }}>
          {loading ? '검색 중...' : `${all.length}명의 인재`}
        </span>
      </div>

      <div className="hrs-list">
        {all.map(c => (
          <CandidateCard key={c.id} c={c} isSaved={savedIds.includes(c.id)} onToggleSave={toggleSave} />
        ))}
        {!loading && all.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#ccc', fontSize: 14 }}>
            조건에 맞는 인재가 없습니다
          </div>
        )}
      </div>
    </HRLayout>
  )
}
