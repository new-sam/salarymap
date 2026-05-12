import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import HRLayout from '../../components/HRLayout'
import { supabase } from '../../lib/supabaseClient'

const STATUS_MAP = {
  applied: { label: '신규 지원', color: '#2563eb', bg: '#eff6ff' },
  viewed: { label: '검토중', color: '#f59e0b', bg: '#fff7ed' },
  reviewing: { label: '면접 진행', color: '#7c3aed', bg: '#faf5ff' },
  decided: { label: '결정 완료', color: '#16a34a', bg: '#f0fdf4' },
}

export default function HRApplicants() {
  const router = useRouter()
  const { jobId } = router.query
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list') // list or kanban

  const fetchApplicants = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setLoading(true)
    const params = new URLSearchParams()
    if (jobId) params.set('jobId', jobId)
    if (filter !== 'all') params.set('status', filter)

    try {
      const r = await fetch(`/api/hr/my-applicants?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (r.ok) {
        const data = await r.json()
        setApplicants(data.applicants || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (router.isReady) fetchApplicants() }, [filter, jobId, router.isReady])

  const updateStatus = async (applicationId, status) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch('/api/hr/my-applicants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ applicationId, status }),
    })
    fetchApplicants()
  }

  // Count by status
  const counts = { all: applicants.length }
  applicants.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })

  // Group for kanban
  const grouped = { applied: [], viewed: [], reviewing: [], decided: [] }
  applicants.forEach(a => { if (grouped[a.status]) grouped[a.status].push(a) })

  const ApplicantCard = ({ app, compact }) => (
    <div style={{
      background: '#fff', border: '1px solid #eee', borderRadius: compact ? 10 : 12,
      padding: compact ? '12px 14px' : '16px 20px', transition: 'all .2s',
      marginBottom: compact ? 8 : 0,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = '#ddd' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#eee' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 14, marginBottom: compact ? 8 : 12 }}>
        <div style={{
          width: compact ? 32 : 40, height: compact ? 32 : 40, borderRadius: '50%',
          background: '#ff6000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: compact ? 11 : 14, fontWeight: 800, color: '#fff' }}>
            {(app.applicant_name || app.applicant_email || 'U')[0].toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: '#111' }}>{app.applicant_name || '이름 없음'}</div>
          <div style={{ fontSize: compact ? 10 : 11, color: '#999' }}>{app.applicant_email || '-'}</div>
        </div>
        {!compact && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: STATUS_MAP[app.status]?.color || '#999',
            background: STATUS_MAP[app.status]?.bg || '#f5f5f5',
            padding: '3px 10px', borderRadius: 4,
          }}>
            {STATUS_MAP[app.status]?.label || app.status}
          </span>
        )}
      </div>

      {/* Job info */}
      <div style={{ fontSize: compact ? 11 : 12, color: '#888', marginBottom: compact ? 6 : 10 }}>
        <span style={{ fontWeight: 600, color: '#666' }}>{app.job_title || '-'}</span>
        <span style={{ margin: '0 4px' }}>·</span>
        <span>{app.job_company || '-'}</span>
      </div>

      {/* Details */}
      {!compact && (
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#bbb', marginBottom: 10 }}>
          {app.applicant_role && <span>직군: {app.applicant_role}</span>}
          {app.applicant_experience && <span>경력: {app.applicant_experience}</span>}
          {app.applicant_salary && <span>희망연봉: {app.applicant_salary}</span>}
        </div>
      )}

      {/* Resume */}
      {app.resume_url && !compact && (
        <a href={app.resume_url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
          📎 이력서 보기
        </a>
      )}

      {/* Date + Status change */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: compact ? 6 : 10, borderTop: '1px solid #f5f5f5',
      }}>
        <span style={{ fontSize: 10, color: '#ccc' }}>
          {new Date(app.created_at).toLocaleDateString('ko-KR')}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.entries(STATUS_MAP).map(([key, s]) => (
            <button key={key}
              onClick={() => app.status !== key && updateStatus(app.id, key)}
              style={{
                fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                border: `1px solid ${app.status === key ? s.color : '#eee'}`,
                background: app.status === key ? s.bg : '#fff',
                color: app.status === key ? s.color : '#ccc',
                cursor: app.status === key ? 'default' : 'pointer',
                fontFamily: 'inherit', transition: 'all .15s',
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin note */}
      {app.admin_note && (
        <div style={{ fontSize: 11, color: '#999', marginTop: 8, padding: '6px 10px', background: '#fafafa', borderRadius: 6, fontStyle: 'italic' }}>
          메모: {app.admin_note}
        </div>
      )}
    </div>
  )

  return (
    <HRLayout title="지원자 관리">
      <style>{`
        .hra-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .hra-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .hra-tab { font-size: 12px; font-weight: 500; color: #888; background: #fff; border: 1px solid #eee; padding: 6px 14px; border-radius: 100px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .hra-tab:hover { border-color: #ddd; color: #555; }
        .hra-tab.on { background: #111; color: #fff; border-color: #111; font-weight: 600; }
        .hra-view-toggle { display: flex; background: #f3f3f3; border-radius: 6px; padding: 2px; }
        .hra-view-btn { font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 4px; border: none; cursor: pointer; font-family: inherit; background: none; color: #999; }
        .hra-view-btn.on { background: #fff; color: #111; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .hra-list { display: flex; flex-direction: column; gap: 10px; }
        .hra-kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: start; }
        .hra-kanban-col { background: #f8f8f8; border-radius: 12px; padding: 12px; min-height: 200px; }
        .hra-kanban-header { font-size: 12px; font-weight: 700; padding: 8px 4px 12px; display: flex; align-items: center; gap: 8px; }
        .hra-kanban-count { font-size: 10px; font-weight: 700; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 100px; }
        @media (max-width: 900px) { .hra-kanban { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .hra-kanban { grid-template-columns: 1fr; } }
      `}</style>

      <div className="hra-top">
        <div className="hra-tabs">
          <button className={`hra-tab${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>
            전체 ({applicants.length})
          </button>
          {Object.entries(STATUS_MAP).map(([key, s]) => (
            <button key={key} className={`hra-tab${filter === key ? ' on' : ''}`} onClick={() => setFilter(key)}>
              {s.label} ({counts[key] || 0})
            </button>
          ))}
        </div>
        <div className="hra-view-toggle">
          <button className={`hra-view-btn${viewMode === 'list' ? ' on' : ''}`} onClick={() => setViewMode('list')}>리스트</button>
          <button className={`hra-view-btn${viewMode === 'kanban' ? ' on' : ''}`} onClick={() => setViewMode('kanban')}>칸반</button>
        </div>
      </div>

      {jobId && (
        <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
          <button onClick={() => router.push('/hr/applicants')} style={{ background: 'none', border: 'none', color: '#ff6000', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
            ← 전체 지원자 보기
          </button>
        </div>
      )}

      {loading ? (
        <div>
          <style>{`@keyframes hraShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } } .hra-sk { background: linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%); background-size: 200% 100%; animation: hraShimmer 1.5s ease infinite; border-radius: 12px; }`}</style>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="hra-sk" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, animationDelay: `${i*0.08}s` }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="hra-sk" style={{ height: 14, width: '60%', animationDelay: `${i*0.08}s` }} />
                  <div className="hra-sk" style={{ height: 10, width: '40%', animationDelay: `${i*0.08+0.05}s` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : applicants.length > 0 ? (
        viewMode === 'list' ? (
          <div className="hra-list">
            {applicants.map(app => <ApplicantCard key={app.id} app={app} />)}
          </div>
        ) : (
          <div className="hra-kanban">
            {Object.entries(STATUS_MAP).map(([key, s]) => (
              <div key={key} className="hra-kanban-col">
                <div className="hra-kanban-header" style={{ color: s.color }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  {s.label}
                  <span className="hra-kanban-count">{grouped[key].length}</span>
                </div>
                {grouped[key].map(app => <ApplicantCard key={app.id} app={app} compact />)}
                {grouped[key].length === 0 && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#ddd', fontSize: 12 }}>없음</div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <svg width="180" height="120" viewBox="0 0 180 120" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
            <style>{`
              @keyframes hra-tray { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
              @keyframes hra-bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(6px); } }
              @keyframes hra-fc { 0%,100% { transform:translateY(0); opacity:0.3; } 50% { transform:translateY(-4px); opacity:0.5; } }
              .hra-tray { animation: hra-tray 0.7s ease both; }
              .hra-arrow { animation: hra-bounce 2s ease-in-out infinite; }
              .hra-fc { animation: hra-fc 4s ease-in-out infinite; }
            `}</style>
            <path className="hra-tray" d="M40 50 L40 90 Q40 100 50 100 L130 100 Q140 100 140 90 L140 50" stroke="#e0e0e0" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <line className="hra-tray" x1="30" y1="50" x2="150" y2="50" stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round"/>
            <g className="hra-arrow">
              <line x1="90" y1="15" x2="90" y2="40" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"/>
              <path d="M82 33 L90 42 L98 33" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <g className="hra-fc" style={{animationDelay:'0.2s'}}>
              <rect x="55" y="60" width="30" height="20" rx="4" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="0.5"/>
              <circle cx="65" cy="67" r="3" fill="#93c5fd"/><rect x="71" y="65" width="10" height="2" rx="1" fill="#bfdbfe"/>
            </g>
            <g className="hra-fc" style={{animationDelay:'0.6s'}}>
              <rect x="95" y="65" width="30" height="20" rx="4" fill="#fff7ed" stroke="#fed7aa" strokeWidth="0.5"/>
              <circle cx="105" cy="72" r="3" fill="#fdba74"/><rect x="111" y="70" width="10" height="2" rx="1" fill="#fed7aa"/>
            </g>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 8 }}>아직 지원자가 없습니다</div>
          <div style={{ fontSize: 12, color: '#ccc', marginBottom: 16 }}>공고가 노출되면 지원자가 이곳에 표시됩니다</div>
          <Link href="/hr/hiring" style={{ fontSize: 12, color: '#ff6000', textDecoration: 'none', fontWeight: 600 }}>채용 공고 확인하기 →</Link>
        </div>
      )}
    </HRLayout>
  )
}
