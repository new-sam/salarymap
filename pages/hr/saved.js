import { useState, useEffect } from 'react'
import Link from 'next/link'
import HRLayout from '../../components/HRLayout'
import { supabase } from '../../lib/supabaseClient'
import Icon from '../../components/Icon'

const STATUS_MAP = {
  all: { label: '전체', color: '#555' },
  pending: { label: '대기중', color: '#f59e0b', bg: '#fff7ed' },
  contacted: { label: '연락완료', color: '#2563eb', bg: '#eff6ff' },
  matched: { label: '매칭', color: '#16a34a', bg: '#f0fdf4' },
  rejected: { label: '미진행', color: '#ef4444', bg: '#fef2f2' },
}

function getStatColor(val) {
  if (val >= 80) return '#22c55e'
  if (val >= 60) return '#f59e0b'
  return '#ef4444'
}

export default function HRSaved() {
  const [saved, setSaved] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const fetchSaved = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      const r = await fetch(`/api/hr/saved-candidates?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (r.ok) {
        const data = await r.json()
        setSaved(data.saved || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchSaved() }, [filter])

  const updateStatus = async (interestId, status) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch('/api/hr/saved-candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ interestId, status }),
    })
    fetchSaved()
  }

  const removeSaved = async (interestId) => {
    if (!confirm('스크랩을 삭제하시겠습니까?')) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch('/api/hr/saved-candidates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ interestId }),
    })
    fetchSaved()
  }

  // Count by status
  const counts = { all: saved.length, pending: 0, contacted: 0, matched: 0, rejected: 0 }
  saved.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1 })
  // When filtering, show total for 'all' but actual for others
  if (filter !== 'all') counts.all = saved.length

  return (
    <HRLayout title="스크랩한 인재">
      <style>{`
        .hrsv-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .hrsv-tab { font-size: 12px; font-weight: 500; color: #888; background: #fff; border: 1px solid #eee; padding: 7px 16px; border-radius: 100px; cursor: pointer; font-family: inherit; transition: all .15s; display: flex; align-items: center; gap: 6px; }
        .hrsv-tab:hover { border-color: #ddd; color: #555; }
        .hrsv-tab.on { background: #111; color: #fff; border-color: #111; font-weight: 600; }
        .hrsv-count { font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 100px; }
        .hrsv-tab:not(.on) .hrsv-count { background: #f0f0f0; color: #999; }
        .hrsv-list { display: flex; flex-direction: column; gap: 10px; }
        .hrsv-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; transition: all .2s; }
        .hrsv-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.05); border-color: #ddd; }
        .hrsv-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .hrsv-status-btn { font-size: 10px; font-weight: 600; padding: 5px 10px; border-radius: 6px; border: 1px solid #eee; background: #fff; cursor: pointer; font-family: inherit; transition: all .15s; }
        .hrsv-status-btn:hover { border-color: #ddd; }
        .hrsv-status-btn.active { border-width: 2px; }
        .hrsv-remove { font-size: 10px; color: #ccc; background: none; border: 1px solid #f0f0f0; border-radius: 6px; padding: 5px 8px; cursor: pointer; font-family: inherit; }
        .hrsv-remove:hover { color: #ef4444; border-color: #fecaca; }
        .hrsv-empty { text-align: center; padding: 60px 20px; }
        .hrsv-empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.3; }
        .hrsv-empty-text { font-size: 14px; color: #999; margin-bottom: 20px; }
      `}</style>

      {/* Filter tabs */}
      <div className="hrsv-tabs">
        {Object.entries(STATUS_MAP).map(([key, s]) => (
          <button key={key} className={`hrsv-tab${filter === key ? ' on' : ''}`}
            onClick={() => setFilter(key)}>
            {s.label}
            <span className="hrsv-count">{filter === 'all' ? (key === 'all' ? saved.length : counts[key]) : (key === filter ? saved.length : '')}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div>
          <style>{`@keyframes hrsvShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } } .hrsv-sk { background: linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%); background-size: 200% 100%; animation: hrsvShimmer 1.5s ease infinite; border-radius: 12px; }`}</style>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, padding: '16px 18px' }}>
                <div className="hrsv-sk" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, animationDelay: `${i*0.1}s` }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="hrsv-sk" style={{ height: 14, width: '50%', animationDelay: `${i*0.1}s` }} />
                  <div className="hrsv-sk" style={{ height: 10, width: '35%', animationDelay: `${i*0.1+0.05}s` }} />
                </div>
                <div className="hrsv-sk" style={{ width: 60, height: 24, borderRadius: 6, animationDelay: `${i*0.1+0.1}s` }} />
              </div>
            ))}
          </div>
        </div>
      ) : saved.length > 0 ? (
        <div className="hrsv-list">
          {saved.map(item => {
            const c = item.candidate
            const st = STATUS_MAP[item.status] || STATUS_MAP.pending
            return (
              <div key={item.interestId} className="hrsv-card">
                {/* Score */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: c.stat_overall ? getStatColor(c.stat_overall) : '#ddd',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{c.stat_overall || '-'}</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <Link href={`/hr/talent/${c.id}`} style={{ fontSize: 14, fontWeight: 700, color: '#111', textDecoration: 'none' }}>
                      {c.name_vi || c.name_en}
                    </Link>
                    <span style={{ fontSize: 10, fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 4 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#999', display: 'flex', gap: 6 }}>
                    <span style={{ background: '#f5f5f5', padding: '1px 6px', borderRadius: 3, fontWeight: 600, color: '#666' }}>{c.position || '-'}</span>
                    {c.location && <span>{c.location}</span>}
                    {c.yoe_months && <span>{c.yoe_months >= 12 ? `${Math.floor(c.yoe_months / 12)}년` : `${c.yoe_months}개월`}</span>}
                  </div>
                  {c.tech_stack && c.tech_stack.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
                      {c.tech_stack.slice(0, 4).map((s, i) => (
                        <span key={i} style={{ fontSize: 10, color: '#888', background: '#f5f5f5', padding: '1px 6px', borderRadius: 3 }}>{s}</span>
                      ))}
                    </div>
                  )}
                  {item.message && (
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 6, fontStyle: 'italic' }}>"{item.message}"</div>
                  )}
                </div>

                {/* Status actions */}
                <div className="hrsv-actions">
                  {['pending', 'contacted', 'matched', 'rejected'].map(st => {
                    const s = STATUS_MAP[st]
                    const isActive = item.status === st
                    return (
                      <button key={st}
                        className={`hrsv-status-btn${isActive ? ' active' : ''}`}
                        style={isActive ? { borderColor: s.color, color: s.color, background: s.bg } : { color: '#bbb' }}
                        onClick={() => !isActive && updateStatus(item.interestId, st)}
                        title={s.label}>
                        {s.label}
                      </button>
                    )
                  })}
                  <button className="hrsv-remove" onClick={() => removeSaved(item.interestId)} title="삭제"><Icon name="close" size={14} color="currentColor" /></button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="hrsv-empty">
          <svg width="180" height="120" viewBox="0 0 180 120" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
            <style>{`
              @keyframes hrsv-bk { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
              @keyframes hrsv-fl { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
              @keyframes hrsv-pg { 0%,100% { r:3; opacity:0.3; } 50% { r:6; opacity:0; } }
              .hrsv-bk { animation: hrsv-bk 0.6s ease both; }
              .hrsv-fl { animation: hrsv-fl 3s ease-in-out infinite; }
              .hrsv-pg { animation: hrsv-pg 2.5s ease-in-out infinite; }
            `}</style>
            <g className="hrsv-fl">
              <path d="M75 25 L90 15 L105 25 L105 55 L90 48 L75 55 Z" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5"/>
              <rect x="82" y="30" width="16" height="2" rx="1" fill="#fdba74" opacity="0.5"/>
              <rect x="84" y="36" width="12" height="2" rx="1" fill="#fdba74" opacity="0.3"/>
            </g>
            <g className="hrsv-bk" style={{animationDelay:'0.3s'}}>
              <rect x="45" y="65" width="90" height="36" rx="8" fill="#fff" stroke="#f0f0f0" strokeWidth="1"/>
              <circle cx="65" cy="83" r="8" fill="#f5f5f5"/><rect x="78" y="78" width="40" height="4" rx="2" fill="#e5e5e5"/><rect x="78" y="86" width="28" height="3" rx="1.5" fill="#f0f0f0"/>
            </g>
            <circle className="hrsv-pg" cx="40" cy="35" r="3" fill="#f59e0b"/>
            <circle className="hrsv-pg" cx="145" cy="55" r="3" fill="#2563eb" style={{animationDelay:'0.7s'}}/>
          </svg>
          <div className="hrsv-empty-text">
            {filter === 'all' ? '아직 스크랩한 인재가 없습니다' : `'${STATUS_MAP[filter].label}' 상태의 인재가 없습니다`}
          </div>
          <Link href="/hr/search" style={{ fontSize: 13, fontWeight: 600, color: '#ff6000', textDecoration: 'none' }}>인재 검색하러 가기 →</Link>
        </div>
      )}
    </HRLayout>
  )
}
