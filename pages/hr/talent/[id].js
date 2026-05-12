import Head from 'next/head'
import Link from 'next/link'

const DUMMY = {
  id: 'demo-001',
  name: '위승주',
  nameEn: 'Seungju WI',
  photo: '/demo-profile.jpg',
  position: 'Backend Developer',
  yoe: '3년',
  location: '호치민',
  age: 26,
  university: 'FPT 대학교',
  major: '소프트웨어공학',
  graduation: '졸업',
  english: 'TOEIC 850',
  korean: '초급 (TOPIK 2급)',
  techStack: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'AWS', 'Git'],
  summary: '3년차 백엔드 개발자로 Java/Spring Boot 기반 서비스 개발 경험이 있습니다. RESTful API 설계, 데이터베이스 최적화, CI/CD 파이프라인 구축에 강점이 있으며 한국 기업과의 원격 근무를 희망합니다.',
  experiences: [
    {
      company: 'VNG Corporation',
      role: 'Backend Developer',
      period: '2023.03 - 현재',
      details: [
        'Spring Boot 기반 결제 시스템 API 개발 및 운영',
        '일 평균 50만 트랜잭션 처리하는 서비스 안정화',
        'PostgreSQL 쿼리 최적화로 응답 속도 40% 개선',
        'Docker + GitHub Actions 기반 CI/CD 파이프라인 구축',
      ],
    },
    {
      company: 'FPT Software',
      role: 'Junior Developer (인턴)',
      period: '2022.06 - 2023.02',
      details: [
        '일본 고객사 ERP 시스템 백엔드 모듈 개발',
        'JUnit 기반 단위 테스트 작성 및 코드 커버리지 85% 달성',
        'Agile/Scrum 환경에서 2주 단위 스프린트 경험',
      ],
    },
  ],
  cvUrl: '#',
}

export default function TalentDetail() {
  const c = DUMMY

  return (
    <>
      <Head><title>{c.name} - FYI for HR</title></Head>
      <style>{`
        .td { min-height: 100vh; background: #FAFAF8; font-family: 'Barlow', system-ui, sans-serif; }
        .td-nav { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 32px; background: #FAFAF8; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 200; }
        .td-nav-logo { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #111; text-decoration: none; }
        .td-nav-logo img { width: 24px; height: 24px; }
        .td-nav-logo span { color: #ff6000; }
        .td-back { font-size: 13px; font-weight: 600; color: #999; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 20px; }
        .td-back:hover { color: #555; }
        .td-body { max-width: 960px; margin: 0 auto; padding: 40px 24px 24px; }
        .td-card { background: #fff; border: 1px solid #eee; border-radius: 16px; overflow: hidden; }

        .td-profile { display: flex; align-items: center; gap: 24px; padding: 36px 40px; border-bottom: 1px solid #f0f0f0; }
        .td-profile-actions { display: flex; gap: 8px; margin-left: auto; flex-shrink: 0; }
        .td-avatar { width: 200px; height: 200px; border-radius: 50%; background: #ff6000; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .td-name { font-size: 28px; font-weight: 800; color: #111; }
        .td-sub { font-size: 14px; color: #999; margin-top: 2px; }
        .td-role { font-size: 15px; color: #555; margin-top: 8px; }

        .td-summary { padding: 24px 40px 28px; font-size: 14px; color: #666; line-height: 1.8; border-bottom: 1px solid #f0f0f0; }

        .td-tags { display: flex; flex-wrap: wrap; gap: 8px; padding: 24px 40px; border-bottom: 1px solid #f0f0f0; }
        .td-tag { font-size: 12px; font-weight: 600; color: #555; background: #f5f5f5; padding: 5px 14px; border-radius: 6px; }

        .td-section { padding: 28px 40px; border-bottom: 1px solid #f0f0f0; }
        .td-section:last-of-type { border-bottom: none; }
        .td-stitle { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 20px; }

        .td-info { display: flex; padding: 10px 0; font-size: 14px; }
        .td-info-l { color: #999; width: 90px; flex-shrink: 0; }
        .td-info-r { color: #333; }

        .td-exp { margin-bottom: 24px; }
        .td-exp:last-child { margin-bottom: 0; }
        .td-exp-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
        .td-exp-company { font-size: 15px; font-weight: 700; color: #111; }
        .td-exp-period { font-size: 12px; color: #bbb; }
        .td-exp-role { font-size: 13px; color: #888; margin-bottom: 10px; }
        .td-exp-list { list-style: none; padding: 0; margin: 0; }
        .td-exp-list li { font-size: 13px; color: #666; line-height: 1.8; padding-left: 14px; position: relative; }
        .td-exp-list li::before { content: '·'; position: absolute; left: 0; color: #ccc; }

        .td-actions { display: flex; gap: 10px; padding: 28px 40px; border-top: 1px solid #f0f0f0; }
        .td-btn1 { flex: 2; padding: 14px; border-radius: 10px; border: none; background: #ff6000; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .td-btn1:hover { opacity: 0.85; }
        .td-btn2 { flex: 1; padding: 14px; border-radius: 10px; border: 1px solid #eee; background: #fff; color: #333; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .td-btn2:hover { border-color: #ddd; }
        .td-btn3 { padding: 14px 16px; border-radius: 10px; border: 1px solid #eee; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .td-btn3:hover { border-color: #ddd; }

        @media (max-width: 600px) {
          .td-profile { flex-direction: column; text-align: center; }
          .td-actions { flex-direction: column; }
          .td-body { padding: 24px 16px 60px; }
        }
      `}</style>

      <div className="td">
        <nav className="td-nav">
          <Link href="/hr/home" className="td-nav-logo"><img src="/logo.png" alt="" /> FYI <span>for HR</span></Link>
        </nav>

        <div className="td-body">
          <Link href="/hr" className="td-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            목록으로
          </Link>
          <div className="td-card">
            {/* Profile */}
            <div className="td-profile">
              {c.photo ? (
                <img src={c.photo} className="td-avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="td-avatar">
                  <span style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{c.name.split(' ').map(w=>w[0]).join('').slice(-2).toUpperCase()}</span>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="td-name">{c.name}</div>
                <div className="td-sub">{c.nameEn}</div>
                <div className="td-role">{c.position} · {c.yoe}</div>
              </div>
              <div className="td-profile-actions">
                <button className="td-btn3" title="스크랩">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                </button>
                <a href={c.cvUrl} target="_blank" rel="noopener noreferrer" className="td-btn2" style={{ flex: 'none', padding: '10px 20px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  이력서
                </a>
                <button className="td-btn1" style={{ flex: 'none', padding: '10px 24px', fontSize: 13 }}>채용 문의</button>
              </div>
            </div>

            {/* Summary */}
            <div className="td-summary">{c.summary}</div>

            {/* Tech */}
            <div className="td-tags">
              {c.techStack.map((tk, i) => <span key={i} className="td-tag">{tk}</span>)}
            </div>

            {/* Info */}
            <div className="td-section">
              <div className="td-stitle">기본 정보</div>
              {[
                { l: '지역', r: c.location },
                { l: '나이', r: `만 ${c.age}세` },
                { l: '대학교', r: c.university },
                { l: '전공', r: c.major },
                { l: '졸업', r: c.graduation },
                { l: '영어', r: c.english },
                { l: '한국어', r: c.korean },
              ].map((row, i) => (
                <div key={i} className="td-info">
                  <span className="td-info-l">{row.l}</span>
                  <span className="td-info-r">{row.r}</span>
                </div>
              ))}
            </div>

            {/* Experience */}
            <div className="td-section">
              <div className="td-stitle">직무 경험</div>
              {c.experiences.map((exp, i) => (
                <div key={i} className="td-exp">
                  <div className="td-exp-head">
                    <span className="td-exp-company">{exp.company}</span>
                    <span className="td-exp-period">{exp.period}</span>
                  </div>
                  <div className="td-exp-role">{exp.role}</div>
                  <ul className="td-exp-list">
                    {exp.details.map((d, j) => <li key={j}>{d}</li>)}
                  </ul>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
