import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useKo } from '../../lib/i18n'

// ── Dummy Data ──
const CANDIDATES = [
  {
    id: 'demo-001',
    name: '위승주', nameEn: 'Seungju Wi', photo: 'https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/profiles/demo-001.jpg',
    headline: 'AI 솔루션 도입으로 결제 전환율 +75% 달성, 플랜핏 PO 인턴',
    position: 'PM', yoe: 1,
    signal: 'active',
    lastActive: '오늘',
    company: '(주)플랜핏 Planfit',
    location: '서울',
    skills: ['서비스기획', '데이터분석', 'Figma'],
  },
  {
    id: 'demo-002',
    name: 'Trần Minh Tú', nameEn: 'Tú Tran', photo: null,
    headline: 'React/Next.js 프론트엔드 4년, FPT Software 재직중',
    position: 'Frontend', yoe: 4,
    signal: 'open',
    lastActive: '3일 전',
    company: 'FPT Software',
    location: '하노이',
    skills: ['React', 'Next.js', 'TypeScript'],
  },
  {
    id: 'demo-003',
    name: 'Lê Nguyên Khôi', nameEn: 'Khoi Le', photo: null,
    headline: 'Flutter 모바일 개발 4년, 핀테크 도메인',
    position: 'Mobile', yoe: 4,
    signal: 'active',
    lastActive: '오늘',
    company: 'MoMo',
    location: '호치민',
    skills: ['Flutter', 'Dart', 'Firebase'],
  },
  {
    id: 'demo-004',
    name: 'Nguyễn Thế Dũng', nameEn: 'Dung Nguyen', photo: null,
    headline: 'Vue.js/React 풀스택 8년, 이커머스 전문',
    position: 'Fullstack', yoe: 8,
    signal: 'passive',
    lastActive: '2주 전',
    company: 'Tiki',
    location: '호치민',
    skills: ['Vue.js', 'Node.js', 'AWS'],
  },
  {
    id: 'demo-005',
    name: 'Phạm Thanh Hằng', nameEn: 'Hang Pham', photo: null,
    headline: 'RAG/LLM 기반 AI 엔지니어 2년, 스타트업 경험',
    position: 'AI/Data', yoe: 2,
    signal: 'active',
    lastActive: '어제',
    company: 'AI Startup',
    location: '다낭',
    skills: ['Python', 'PyTorch', 'LangChain'],
  },
  {
    id: 'demo-006',
    name: 'Võ Anh Quân', nameEn: 'Quan Vo', photo: null,
    headline: 'AWS/K8s DevOps 5년, 대규모 인프라 운영',
    position: 'DevOps', yoe: 5,
    signal: 'open',
    lastActive: '1주 전',
    company: 'VNPay',
    location: '하노이',
    skills: ['AWS', 'Kubernetes', 'Terraform'],
  },
]

const SIGNAL_MAP = {
  active: { label: '적극 구직중', color: '#22c55e' },
  open: { label: '좋은 기회 환영', color: '#f59e0b' },
  passive: { label: '비공개', color: '#ccc' },
}

const POSITIONS = ['전체', 'Backend', 'Frontend', 'Fullstack', 'Mobile', 'AI/Data', 'DevOps']

function getInitials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').slice(-2).toUpperCase()
}

function getColor(id) {
  const colors = ['#ff6000','#2563eb','#7c3aed','#16a34a','#db2777','#0891b2','#ca8a04','#64748b']
  return colors[(id || '').charCodeAt(((id || '').length || 1) - 1) % colors.length]
}

// ── Card ──
function CandidateCard({ c, isSaved, onToggleSave }) {
  const sig = SIGNAL_MAP[c.signal]
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 20px 16px', transition: 'all .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = '#ddd' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#eee' }}>
      {/* Top row: photo + info */}
      <Link href={`/hr/talent/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14 }}>
        {/* Photo */}
        {c.photo ? (
          <img src={c.photo} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: getColor(c.id), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{getInitials(c.name)}</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + signal */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{c.name}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: sig.color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sig.color, display: 'inline-block' }} />
              {sig.label}
            </span>
          </div>
          {/* Headline */}
          <div style={{ fontSize: 13, color: '#555', marginTop: 3, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.headline}
          </div>
          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#bbb' }}>
            <span>{c.company}</span>
            <span>·</span>
            <span>{c.location}</span>
            <span>·</span>
            <span>{c.yoe}년</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc' }}>{c.lastActive}</span>
          </div>
        </div>
      </Link>

      {/* Bottom row: skills + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f5f5f5' }}>
        <div style={{ display: 'flex', gap: 5, overflow: 'hidden' }}>
          {c.skills.slice(0, 3).map((s, i) => (
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

// ── Main ──
export default function HRDashboard() {
  const { t } = useKo()
  const [position, setPosition] = useState('전체')
  const [savedIds, setSavedIds] = useState([])

  const filtered = position === '전체' ? CANDIDATES : CANDIDATES.filter(c => c.position === position)

  const toggleSave = (id) => {
    setSavedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <>
      <Head><title>인재 검색 - FYI for HR</title></Head>
      <style>{`
        .hrd { min-height: 100vh; background: #FAFAF8; font-family: 'Barlow', system-ui, sans-serif; }
        .hrd-nav { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 32px; background: #FAFAF8; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 200; }
        .hrd-logo { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #111; text-decoration: none; }
        .hrd-logo img { width: 24px; height: 24px; }
        .hrd-logo span { color: #ff6000; }
        .hrd-layout { display: flex; max-width: 1200px; margin: 0 auto; padding: 0; }

        /* Sidebar */
        .hrd-sidebar { width: 220px; padding: 24px 20px; border-right: 1px solid #f0f0f0; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; flex-shrink: 0; }
        .hrd-sb-title { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
        .hrd-sb-group { margin-bottom: 24px; }
        .hrd-sb-btn { display: block; width: 100%; text-align: left; font-size: 13px; font-weight: 500; color: #888; background: none; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-family: inherit; transition: all .1s; }
        .hrd-sb-btn:hover { background: #f0f0f0; color: #555; }
        .hrd-sb-btn.on { background: #ff6000; color: #fff; font-weight: 600; }
        .hrd-sb-search { width: 100%; background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #111; outline: none; font-family: inherit; margin-bottom: 16px; }
        .hrd-sb-search::placeholder { color: #ccc; }
        .hrd-sb-search:focus { border-color: #ddd; }

        /* Main content */
        .hrd-main { flex: 1; padding: 24px 28px; min-width: 0; }
        .hrd-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
        .hrd-sort { background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 6px 10px; font-size: 12px; color: #555; outline: none; font-family: inherit; cursor: pointer; }
        .hrd-list { display: flex; flex-direction: column; gap: 10px; }

        @media (max-width: 768px) {
          .hrd-sidebar { display: none; }
          .hrd-nav { padding: 0 16px; }
          .hrd-main { padding: 20px 16px; }
        }
      `}</style>

      <div className="hrd">
        <nav className="hrd-nav">
          <Link href="/hr/home" className="hrd-logo"><img src="/logo.png" alt="" /> FYI <span>for HR</span></Link>
        </nav>

        <div className="hrd-layout">
          {/* Sidebar filters */}
          <aside className="hrd-sidebar">
            <input className="hrd-sb-search" placeholder="이름, 기술 검색..." />

            <div className="hrd-sb-group">
              <div className="hrd-sb-title">직군</div>
              {POSITIONS.map(p => (
                <button key={p} className={`hrd-sb-btn${position === p ? ' on' : ''}`} onClick={() => setPosition(p)}>{p}</button>
              ))}
            </div>

            <div className="hrd-sb-group">
              <div className="hrd-sb-title">이직 의향</div>
              <button className="hrd-sb-btn on">전체</button>
              <button className="hrd-sb-btn">적극 구직중</button>
              <button className="hrd-sb-btn">좋은 기회 환영</button>
            </div>

            <div className="hrd-sb-group">
              <div className="hrd-sb-title">경력</div>
              <button className="hrd-sb-btn on">전체</button>
              <button className="hrd-sb-btn">1~3년</button>
              <button className="hrd-sb-btn">3~5년</button>
              <button className="hrd-sb-btn">5년 이상</button>
            </div>

            <div className="hrd-sb-group">
              <div className="hrd-sb-title">지역</div>
              <button className="hrd-sb-btn on">전체</button>
              <button className="hrd-sb-btn">호치민</button>
              <button className="hrd-sb-btn">하노이</button>
              <button className="hrd-sb-btn">다낭</button>
            </div>
          </aside>

          {/* Main */}
          <main className="hrd-main">
            <div className="hrd-header">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0 }}>인재 검색</h1>
                <p style={{ fontSize: 12, color: '#bbb', margin: '4px 0 0' }}>{filtered.length}명의 인재</p>
              </div>
              <select className="hrd-sort">
                <option>최근 활동순</option>
                <option>경력순</option>
                <option>등록일순</option>
              </select>
            </div>

            <div className="hrd-list">
              {filtered.map(c => (
                <CandidateCard key={c.id} c={c} isSaved={savedIds.includes(c.id)} onToggleSave={toggleSave} />
              ))}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
