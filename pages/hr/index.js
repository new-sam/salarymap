import Head from 'next/head'
import Link from 'next/link'
import { useKo } from '../../lib/i18n'

const DUMMY = {
  id: 'demo-001',
  name: '위승주',
  nameEn: 'Seungju WI',
  position: 'Backend',
  yoe: '3년',
  photo: '/demo-profile.jpg',
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(-2).toUpperCase()
}

export default function HRDashboard() {
  const { t } = useKo()
  const c = DUMMY

  return (
    <>
      <Head><title>인재 검색 - FYI for HR</title></Head>
      <style>{`
        .hr-page { min-height: 100vh; background: #FAFAF8; font-family: 'Barlow', system-ui, sans-serif; }
        .hr-nav { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 32px; background: #FAFAF8; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 200; }
        .hr-nav-logo { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #111; text-decoration: none; }
        .hr-nav-logo img { width: 24px; height: 24px; }
        .hr-nav-logo span { color: #ff6000; }
        .hr-body { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
        .hr-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 24px; width: 220px; cursor: pointer; transition: all .2s; text-align: center; text-decoration: none; color: inherit; display: block; }
        .hr-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #ddd; }
      `}</style>

      <div className="hr-page">
        <nav className="hr-nav">
          <Link href="/hr/home" className="hr-nav-logo"><img src="/logo.png" alt="" /> FYI <span>for HR</span></Link>
        </nav>

        <div className="hr-body">
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: '0 0 8px' }}>인재 검색</h1>
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 32px' }}>더미 데이터 1건</p>

          <Link href="/hr/talent/demo-001" className="hr-card">
            {c.photo ? (
              <img src={c.photo} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 12px' }} />
            ) : (
              <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#ff6000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{getInitials(c.name)}</span>
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{c.name}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{c.position} · {c.yoe}</div>
          </Link>
        </div>
      </div>
    </>
  )
}
