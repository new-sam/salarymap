import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

const DUMMY_MAP = {
  'demo-001': {
    name: '위승주', nameEn: 'Seungju Wi', photo: 'https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/profiles/demo-001.jpg',
    position: 'Product Owner · Service Planner',
    headline: 'AI 솔루션 도입으로 결제 전환율 +75% 달성, 플랜핏 PO 인턴',
    signal: 'active', lastActive: '오늘',
    location: '서울', age: 24,
    university: '홍익대학교', major: '컴퓨터공학', graduation: '2026년 졸업',
    english: 'OPIc IH (Intermediate High)',
    korean: 'TOPIK 4급',
    salaryMin: 25000000, salaryMax: 35000000, salaryCurrency: 'VND',
    workType: '정규직 / 인턴',
    skills: ['서비스기획', '프로덕트관리', '데이터분석', 'UX기획', 'UI/UX', '앱기획', '웹기획', 'IT기획', '기능기획', '서비스운영', 'Agile', '브랜딩', 'SNS마케팅'],
    toolsProduct: 'A/B Testing · 가설 검증 · 퍼널 분석 · PRD 작성',
    toolsAnalytics: 'Amplitude · MySQL',
    toolsDesign: 'Figma · Figma Make · Photoshop',
    toolsDev: 'React Native · Next.js · TypeScript',
    toolsAI: 'Cursor · Claude · Antigravity · Veo · Midjourney · Nano Banana',
    toolsCollab: 'Notion · Slack · Linear',
    intro: '기술적 이해도와 데이터 분석 역량을 바탕으로 비즈니스 목표를 안정적으로 달성하는 서비스 기획자 위승주입니다.\n\n직관보다는 철저한 데이터 분석을 통해 유저의 문제를 정의하고 실질적인 지표 개선으로 연결합니다. 실무에서 외부 솔루션 제휴를 직접 주도하여 주간 결제 전환율(CVR)을 75% 상승시키는 등 명확한 비즈니스 임팩트를 창출한 경험이 있습니다.\n\n컴퓨터공학 전공 지식을 살려 기획·디자인·개발 전 과정을 단독으로 소화하는 1인 메이커 역량을 갖추고 있습니다.',
    experiences: [
      {
        company: '(주)플랜핏 Planfit', role: 'Product Owner Intern / 기획 (Solver)',
        period: '2025.06 - 2025.12', duration: '7개월',
        details: [
          '외부 AI 솔루션(Monetai) 발굴·도입 주도: 유저 구매 확률 예측 솔루션을 직접 리서치·발굴하고 제휴사와 1:3 기술 미팅을 단독으로 리드, 맞춤형 다겟팅 프로모션 런칭으로 주간 결제 전환율(CVR) +75% 상승 달성 후 프로덕션 정착',
          '비디오 생성 AI 활용 결제창 영상 배포: 다 부서 의존 없이 단독으로 시즌 페이월 영상을 제작·배포, 신규 유저 전환율 목표 2배 초과(+20%) 달성',
          'Amplitude 데이터 분석 기반으로 4개월간 30건 이상의 가설 검증실험 주도 및 실험 리드타임 획기적 단축',
          'Stack: Amplitude · Figma · Cursor · Claude · Veo — 데이터 드리븐 의사결정과 AI 풀사이클 실행',
        ],
      },
    ],
    projects: [
      {
        name: 'Drinkig 드링키지', desc: '2030 취향 기반 와인 큐레이션 앱 (1인 풀사이클)',
        period: '2025.12 - 현재',
        details: [
          '기획/디자인/개발/운영 1인 · App Store 운영 중',
          'v1: 10인 팀(개발 6·디자인 3·PM 1) Swift/UIKit 프로젝트에서 PM 리드 / 아이디어 오너로 참여, 2025 홍익대학교 창업 페스티벌 2등 수상',
          'Swift 전량 폐기 후 React Native로 전면 리라이트, 약 2개월 만에 1인 풀사이클로 App Store 재출시 후 직접 운영',
        ],
      },
      {
        name: 'Gourmevel 고메블', desc: 'F&B 미식 숏폼 매거진 (1인 총괄 운영)',
        period: '2022.05 - 현재',
        details: [
          '유료 광고 0원, 오가닉 도달만으로 팔로워 1만+, 숏폼 최고 124만 뷰, 릴스 평균 30만 뷰 달성',
          '초기 팔로워 200명 정체 구간에서 "감성향" 콘텐츠를 "셰프 취재 기반 매거진"으로 리포지셔닝, 2주 만에 +1,000 팔로워 회복',
          '3개월 만에 팔로워 4,000 → 8,000 (2배 성장)',
          '캐치테이블 등 브랜드와 50+ 건 협업 · 제휴',
        ],
      },
    ],
    awards: '2025 홍익대학교 창업 페스티벌 2등 · Drinkig 프로젝트 (시장성·기획력 부문)',
    certs: ['ADsP — Advanced Data Analytics Semi-Professional', 'OPIc — IH (Intermediate High)', '제2종 보통 운전면허'],
    cvUrl: 'https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/resumes/demo-001.pdf',
    contactCount: 5,
    isNew: true,
  },
}

const SIGNAL_MAP = {
  active: { label: '적극 구직중', color: '#22c55e', bg: '#f0fdf4' },
  open: { label: '좋은 기회 환영', color: '#f59e0b', bg: '#fffbeb' },
  passive: { label: '비공개', color: '#999', bg: '#f5f5f5' },
}

export default function TalentDetail() {
  const [saved, setSaved] = useState(false)
  const [showCV, setShowCV] = useState(false)
  const [showKRW, setShowKRW] = useState(false)
  const c = DUMMY_MAP['demo-001']
  if (!c) return null
  const sig = SIGNAL_MAP[c.signal]

  return (
    <>
      <Head><title>{c.name} - FYI for HR</title></Head>
      <style>{`
        html, body { overflow-x: visible !important; }
        .td { min-height: 100vh; background: #FAFAF8; font-family: 'Barlow', system-ui, sans-serif; }
        .td-nav { display: flex; align-items: center; height: 56px; padding: 0 32px; background: #FAFAF8; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 200; }
        .td-nav-logo { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #111; text-decoration: none; }
        .td-nav-logo img { width: 24px; height: 24px; }
        .td-nav-logo span { color: #ff6000; }
        .td-body { max-width: 1060px; margin: 0 auto; padding: 28px 24px 60px; }
        .td-back { font-size: 13px; font-weight: 600; color: #999; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 20px; }
        .td-back:hover { color: #555; }

        .td-grid { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }

        /* Left — follows scroll */
        .td-left { background: #fff; border: 1px solid #eee; border-radius: 16px; position: sticky; top: 72px; align-self: start; }
        .td-photo-wrap { display: flex; justify-content: center; padding: 32px 0 0; }
        .td-photo { width: 140px; height: 140px; border-radius: 50%; object-fit: cover; }
        .td-lbody { padding: 16px 24px 20px; text-align: center; }
        .td-lname { font-size: 20px; font-weight: 800; color: #111; }
        .td-lsub { font-size: 12px; color: #999; margin-top: 2px; }
        .td-lrole { font-size: 13px; color: #555; margin-top: 6px; }
        .td-badges { display: flex; gap: 6px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }
        .td-signal { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 100px; }
        .td-new { font-size: 10px; font-weight: 700; color: #ff6000; background: #fff7ed; padding: 4px 10px; border-radius: 100px; }
        .td-lmeta { padding: 16px 24px; border-top: 1px solid #f0f0f0; }
        .td-lrow { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
        .td-lrow-l { color: #999; }
        .td-lrow-r { color: #333; font-weight: 600; text-align: right; max-width: 170px; }
        .td-lactions { padding: 16px 24px 24px; display: flex; flex-direction: column; gap: 8px; }
        .td-btn1 { padding: 12px; border-radius: 10px; border: none; background: #ff6000; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .td-btn1:hover { opacity: 0.85; }
        .td-btn2 { padding: 12px; border-radius: 10px; border: 1px solid #eee; background: #fff; color: #333; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .td-btn2:hover { border-color: #ddd; }
        .td-btn3 { padding: 12px; border-radius: 10px; border: 1px solid #eee; background: #fff; color: #999; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .td-btn3:hover { border-color: #ddd; }
        .td-demand { font-size: 11px; color: #bbb; text-align: center; margin-top: 4px; }

        /* Right */
        .td-right { display: flex; flex-direction: column; gap: 16px; }
        .td-section { background: #fff; border: 1px solid #eee; border-radius: 16px; padding: 28px; }
        .td-stitle { font-size: 13px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 14px; }
        .td-intro { font-size: 14px; color: #555; line-height: 1.8; white-space: pre-line; }
        .td-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .td-tag { font-size: 11px; font-weight: 600; color: #555; background: #f5f5f5; padding: 4px 12px; border-radius: 6px; }

        .td-tools { margin-top: 16px; }
        .td-tool-row { display: flex; padding: 5px 0; font-size: 12px; }
        .td-tool-l { color: #bbb; width: 80px; flex-shrink: 0; font-weight: 600; text-transform: uppercase; font-size: 10px; padding-top: 2px; }
        .td-tool-r { color: #555; line-height: 1.6; }

        .td-exp { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #f5f5f5; }
        .td-exp:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
        .td-exp-top { display: flex; align-items: start; justify-content: space-between; margin-bottom: 10px; }
        .td-exp-company { font-size: 15px; font-weight: 700; color: #111; }
        .td-exp-role { font-size: 12px; color: #888; margin-top: 2px; }
        .td-exp-right { text-align: right; flex-shrink: 0; }
        .td-exp-period { font-size: 12px; color: #bbb; }
        .td-exp-dur { font-size: 11px; color: #ddd; margin-top: 2px; }
        .td-exp-list { list-style: none; padding: 0; margin: 0; }
        .td-exp-list li { font-size: 13px; color: #666; line-height: 1.8; padding-left: 14px; position: relative; }
        .td-exp-list li::before { content: '·'; position: absolute; left: 0; color: #ddd; font-weight: 700; }

        .td-cert { font-size: 13px; color: #555; line-height: 1.8; }

        @media (max-width: 768px) {
          .td-grid { grid-template-columns: 1fr; }
          .td-left { position: static !important; }
          .td-body { padding: 20px 12px 40px; }
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
          <div className="td-grid">
            {/* Left */}
            <div className="td-left">
              <div className="td-photo-wrap">
                <img src={c.photo} className="td-photo" />
              </div>
              <div className="td-lbody">
                <div className="td-lname">{c.name}</div>
                <div className="td-lsub">{c.nameEn}</div>
                <div className="td-lrole">{c.position}</div>
                <div className="td-badges">
                  <span className="td-signal" style={{ background: sig.bg, color: sig.color }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sig.color }} /> {sig.label}
                  </span>
                  {c.isNew && <span className="td-new">이번 주 신규</span>}
                </div>
              </div>

              <div className="td-lmeta">
                {[
                  { l: '지역', r: c.location },
                  { l: '나이', r: `만 ${c.age}세` },
                  { l: '학력', r: `${c.university} · ${c.major}` },
                  { l: '졸업', r: c.graduation },
                  { l: '영어', r: c.english },
                  { l: '한국어', r: c.korean },
                  { l: '희망 보수', r: '__salary__' },
                  { l: '근무 형태', r: c.workType },
                  { l: '최근 활동', r: c.lastActive },
                ].map((row, i) => (
                  <div key={i} className="td-lrow">
                    <span className="td-lrow-l">{row.l}</span>
                    {row.r === '__salary__' ? (
                      <span className="td-lrow-r" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{showKRW
                          ? `${Math.round(c.salaryMin * 0.058 / 10000)}~${Math.round(c.salaryMax * 0.058 / 10000)}만원`
                          : `${(c.salaryMin / 1000000).toFixed(0)}~${(c.salaryMax / 1000000).toFixed(0)}M VND`
                        }/월</span>
                        <button onClick={() => setShowKRW(v => !v)} style={{
                          fontSize: 10, fontWeight: 600, color: '#ff6000', background: 'none',
                          border: '1px solid #fed7aa', borderRadius: 4, padding: '1px 6px',
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}>{showKRW ? 'VND' : '₩'}</button>
                      </span>
                    ) : (
                      <span className="td-lrow-r">{row.r}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="td-lactions">
                <button className="td-btn1">채용 문의</button>
                <button className="td-btn2" onClick={() => setShowCV(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  이력서 보기
                </button>
                <button className="td-btn3" onClick={() => setSaved(v => !v)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? '#f59e0b' : 'none'} stroke={saved ? '#f59e0b' : 'currentColor'} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                  {saved ? '저장됨' : '저장하기'}
                </button>
                {c.contactCount > 0 && (
                  <div className="td-demand">{c.contactCount}개 기업이 이 인재에 관심을 보였습니다</div>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="td-right">
              {/* Intro */}
              <div className="td-section">
                <div className="td-stitle">소개</div>
                <div className="td-intro">{c.intro}</div>
              </div>

              {/* Skills + Tools */}
              <div className="td-section">
                <div className="td-stitle">전문 분야 & 스킬</div>
                <div className="td-tags">
                  {c.skills.map((s, i) => <span key={i} className="td-tag">{s}</span>)}
                </div>
                <div className="td-tools">
                  {[
                    { l: 'Product', r: c.toolsProduct },
                    { l: 'Analytics', r: c.toolsAnalytics },
                    { l: 'Design', r: c.toolsDesign },
                    { l: 'Dev', r: c.toolsDev },
                    { l: 'AI Tools', r: c.toolsAI },
                    { l: 'Collab', r: c.toolsCollab },
                  ].map((row, i) => (
                    <div key={i} className="td-tool-row">
                      <span className="td-tool-l">{row.l}</span>
                      <span className="td-tool-r">{row.r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div className="td-section">
                <div className="td-stitle">경력</div>
                {c.experiences.map((exp, i) => (
                  <div key={i} className="td-exp">
                    <div className="td-exp-top">
                      <div>
                        <div className="td-exp-company">{exp.company}</div>
                        <div className="td-exp-role">{exp.role}</div>
                      </div>
                      <div className="td-exp-right">
                        <div className="td-exp-period">{exp.period}</div>
                        <div className="td-exp-dur">{exp.duration}</div>
                      </div>
                    </div>
                    <ul className="td-exp-list">
                      {exp.details.map((d, j) => <li key={j}>{d}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Projects */}
              <div className="td-section">
                <div className="td-stitle">프로젝트</div>
                {c.projects.map((pj, i) => (
                  <div key={i} className="td-exp">
                    <div className="td-exp-top">
                      <div>
                        <div className="td-exp-company">{pj.name}</div>
                        <div className="td-exp-role">{pj.desc}</div>
                      </div>
                      <div className="td-exp-right">
                        <div className="td-exp-period">{pj.period}</div>
                      </div>
                    </div>
                    <ul className="td-exp-list">
                      {pj.details.map((d, j) => <li key={j}>{d}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Awards + Certs */}
              <div className="td-section">
                <div className="td-stitle">수상 & 자격증</div>
                <div className="td-cert" style={{ marginBottom: 12 }}>{c.awards}</div>
                {c.certs.map((cert, i) => (
                  <div key={i} className="td-cert">{cert}</div>
                ))}
              </div>

              {/* Education */}
              <div className="td-section">
                <div className="td-stitle">학력</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{c.university}</div>
                <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{c.major} · {c.graduation}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* PDF Viewer */}
      {showCV && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowCV(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #eee' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{c.name} 이력서</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href={c.cvUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#ff6000', textDecoration: 'none' }}>새 탭에서 열기</a>
                <button onClick={() => setShowCV(false)} style={{ background: 'none', border: 'none', color: '#999', fontSize: 18, cursor: 'pointer' }}>x</button>
              </div>
            </div>
            <iframe src={c.cvUrl} style={{ flex: 1, border: 'none', width: '100%' }} />
          </div>
        </div>
      )}
    </>
  )
}
