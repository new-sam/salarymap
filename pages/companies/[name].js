import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { useT } from '../../lib/i18n'
import { domainFor, logoUrlFor } from '../../lib/companyDomains'
import { isSalaryNegotiable } from '../../utils/salary'
import { track } from '../../lib/track'

export async function getServerSideProps({ params }) {
  const name = decodeURIComponent(params.name || '')
  if (!name.trim()) return { notFound: true }

  const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  // 페이지 대상: 연봉 데이터가 있는 회사 전부. 단, 커뮤니티 칩이 넘기는
  // 인증 회사명(company_domains 큐레이션)은 submissions의 자유 입력 회사명과
  // 정확히 일치하지 않을 수 있어, 칩 플로우가 끊기지 않도록 폴백으로
  // company_domains/companies에 존재하면 (연봉 데이터가 없어도) 페이지를 연다.
  const { data: subs } = await supabaseServer
    .from('submissions')
    .select('company')
    .ilike('company', name)
    .limit(500)

  let companyName = null

  if (subs && subs.length > 0) {
    // 표기용 정식 명칭: 가장 흔한 원본 대소문자 변형을 고른다.
    const freq = {}
    subs.forEach(s => { if (s.company) freq[s.company] = (freq[s.company] || 0) + 1 })
    companyName = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || name
  }

  if (!companyName) {
    const { data: dom } = await supabaseServer
      .from('company_domains')
      .select('company_name')
      .ilike('company_name', name)
      .limit(1)
    if (dom && dom.length) companyName = dom[0].company_name
  }

  if (!companyName) {
    const { data: co } = await supabaseServer
      .from('companies')
      .select('name')
      .ilike('name', name)
      .limit(1)
    if (co && co.length) companyName = co[0].name
  }

  if (!companyName) {
    // 커뮤니티 글이 해당 회사를 author_company로 달고 있으면(시드/더미 포함) 페이지를 연다.
    const { data: cp } = await supabaseServer
      .from('community_posts')
      .select('author_company')
      .ilike('author_company', name)
      .limit(1)
    if (cp && cp.length) companyName = cp[0].author_company
  }

  if (!companyName) {
    // 채용 공고만 있는 회사(연봉/커뮤니티 데이터 없음)도 jobs 카드에서 넘어오면 페이지를 연다.
    const { data: jb } = await supabaseServer
      .from('jobs')
      .select('company')
      .ilike('company', name)
      .limit(1)
    if (jb && jb.length) companyName = jb[0].company
  }

  if (!companyName) return { notFound: true }

  // 로고용 도메인: 큐레이션 맵 우선, 없으면 인증 테이블(company_domains)에서 조회.
  let domain = domainFor(companyName)
  if (!domain) {
    const { data: d2 } = await supabaseServer
      .from('company_domains')
      .select('domain')
      .ilike('company_name', companyName)
      .limit(1)
    if (d2 && d2.length && d2[0].domain) domain = d2[0].domain
  }

  // 한국 법인 공공데이터 캐시 (scripts/kr-company-stats.mjs 적재분).
  // 테이블 미생성/미적재 상태여도 페이지는 떠야 하므로 에러는 무시하고 null.
  let krStats = null
  const { data: kr, error: krErr } = await supabaseServer
    .from('company_kr_stats')
    .select('kr_name, headcount, monthly, financials, registered_at, established_at, industry')
    .ilike('company', companyName)
    .limit(1)
  if (!krErr && kr && kr.length) krStats = kr[0]

  // AI 생성 회사 소개 (jobs 상세와 같은 소스) — 원티드식 인트로 문단으로 사용
  let overview = null
  const { data: ov, error: ovErr } = await supabaseServer
    .from('company_overviews')
    .select('overview')
    .eq('company', companyName)
    .maybeSingle()
  if (!ovErr && ov?.overview) overview = ov.overview

  return { props: { companyName, domain: domain || null, krStats, overview } }
}

function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'now'
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

// 원 단위 금액 → 로케일별 축약 표기 (ko: 억/조원, 그 외: ₩M/B)
function fmtKrw(v, lang) {
  if (v == null) return null
  if (lang === 'ko') {
    if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(1)}조원`
    return `${Math.round(v / 1e8).toLocaleString()}억원`
  }
  if (Math.abs(v) >= 1e9) return `₩${(v / 1e9).toFixed(1)}B`
  return `₩${Math.round(v / 1e6).toLocaleString()}M`
}

export default function CompanyPage({ companyName, domain, krStats, overview }) {
  const { t, lang } = useT()
  const router = useRouter()
  const [roleFilter, setRoleFilter] = useState('all')
  const [introOpen, setIntroOpen] = useState(false)

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [salary, setSalary] = useState(null)
  const [salaryLoading, setSalaryLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)

  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followBusy, setFollowBusy] = useState(false)

  // 히어로 메타: 업종 · 도시 · 설립연도 (한국 공공데이터가 있을 때만)
  const foundedYear = String(krStats?.established_at || krStats?.registered_at || '').slice(0, 4)
  const heroCity = (() => {
    const p = String(krStats?.address || '').split(' ')
    if (!p[0]) return null
    return [p[0].replace(/(특별자치도|특별자치시|특별시|광역시)$/, ''), p[1]].filter(Boolean).join(' ')
  })()

  const initial = (companyName || '?').trim().charAt(0).toUpperCase()
  const [logoError, setLogoError] = useState(false)
  const logoUrl = logoUrlFor(domain)
  const enc = encodeURIComponent(companyName)

  const loadFollow = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {}
    try {
      const r = await fetch(`/api/companies/follow?company=${enc}`, { headers })
      const d = await r.json()
      setFollowerCount(d.followerCount || 0)
      setFollowing(!!d.following)
    } catch {}
  }, [enc])

  useEffect(() => {
    setPostsLoading(true)
    fetch(`/api/community/posts?company=${enc}&limit=30`)
      .then(r => r.json())
      .then(d => setPosts(d.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false))

    setSalaryLoading(true)
    fetch(`/api/company/${enc}`)
      .then(r => r.json())
      .then(d => setSalary(d))
      .catch(() => setSalary(null))
      .finally(() => setSalaryLoading(false))

    setJobsLoading(true)
    fetch(`/api/jobs?company=${enc}`)
      .then(r => r.json())
      .then(d => setJobs(Array.isArray(d) ? d : []))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false))

    loadFollow()
  }, [enc, loadFollow])

  const toggleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      window.dispatchEvent(new CustomEvent('fyi-show-login'))
      return
    }
    if (followBusy) return
    setFollowBusy(true)
    const next = !following
    // 낙관적 업데이트
    setFollowing(next)
    setFollowerCount(c => Math.max(0, c + (next ? 1 : -1)))
    try {
      await fetch(`/api/companies/follow?company=${enc}`, {
        method: next ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      track(next ? 'follow_company' : 'unfollow_company', { meta: { company: companyName }, page: 'company' })
    } catch {
      // 실패 시 롤백
      setFollowing(!next)
      setFollowerCount(c => Math.max(0, c + (next ? -1 : 1)))
    } finally {
      setFollowBusy(false)
    }
  }

  return (
    <>
      <Head><title>{companyName} · Salary FYI</title></Head>
      <style>{`
        .cpg-page { background: #fff; min-height: 100vh; }
        .cpg { max-width: 760px; margin: 0 auto; padding: 0 16px 80px; color: #111; font-family: 'Barlow', sans-serif; }
        .cpg-hero { display: flex; align-items: center; gap: 16px; padding: 28px 0 20px; }
        .cpg-logo { width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg,#ff6000,#ff8a3d); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #fff; flex-shrink: 0; overflow: hidden; }
        .cpg-logo.has-img { background: #fff; border: 1px solid #ececec; }
        .cpg-logo.has-img img { width: 100%; height: 100%; object-fit: contain; padding: 10px; box-sizing: border-box; }
        .cpg-hmeta { flex: 1; min-width: 0; }
        .cpg-name { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #111; }
        .cpg-followers { font-size: 13px; color: #888; }
        .cpg-follow-btn { padding: 9px 20px; border-radius: 999px; font-size: 14px; font-weight: 700; cursor: pointer; border: 1px solid #ff6000; background: #ff6000; color: #fff; transition: all .15s; white-space: nowrap; }
        .cpg-follow-btn.on { background: #fff; color: #666; border-color: #ddd; }
        .cpg-follow-btn:disabled { opacity: .6; cursor: default; }
        .cpg-meta { font-size: 13px; color: var(--sm-gray-600); margin: 2px 0 4px; }
        .cpg-sec { font-size: 17px; font-weight: 800; color: #111; margin: 30px 0 12px; }
        .cpg-sec .n { color: var(--sm-primary-500); }
        .cpg-panel { border: 1px solid #ececec; border-radius: 14px; padding: 16px 18px; background: #fff; }
        .cpg-stat-n { font-size: 26px; font-weight: 800; color: #111; }
        .cpg-jobs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cpg-jobs .cpg-card { margin-bottom: 0; }
        @media (max-width: 640px) { .cpg-jobs { grid-template-columns: 1fr; } }
        .cpg-intro { font-size: 14px; color: var(--sm-gray-800); line-height: 1.7; white-space: pre-line; }
        .cpg-intro.clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .cpg-more { margin-top: 8px; background: none; border: none; padding: 0; color: var(--sm-gray-500); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .cpg-empty { text-align: center; color: #999; padding: 48px 0; font-size: 14px; }
        .cpg-card { display: block; padding: 16px 18px; border: 1px solid #ececec; border-radius: 14px; margin-bottom: 10px; background: #fff; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s; }
        .cpg-card:hover { border-color: #ddd; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
        .cpg-card-meta { font-size: 12px; color: #999; margin-bottom: 6px; }
        .cpg-card-title { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 5px; line-height: 1.4; }
        .cpg-card-preview { font-size: 13px; color: #888; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .cpg-job-sal { font-size: 14px; font-weight: 800; color: #ff6000; margin-top: 4px; }
        .cpg-headline { text-align: center; padding: 24px 0; border: 1px solid #ececec; border-radius: 14px; margin-bottom: 16px; background: #fafafa; }
        .cpg-headline-n { font-size: 40px; font-weight: 800; color: #ff6000; line-height: 1; }
        .cpg-headline-l { font-size: 13px; color: #888; margin-top: 8px; }
        .cpg-back { display: inline-flex; align-items: center; gap: 5px; margin: 16px 0 0; padding: 6px 12px 6px 8px; border: 1px solid #ececec; border-radius: 999px; background: #fff; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .cpg-back:hover { border-color: #ddd; color: #111; }
        .cpg-chart-cap { font-size: 13px; font-weight: 700; color: #444; margin: 4px 0 14px; }
        .cpg-rolefilter { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 18px; -webkit-overflow-scrolling: touch; }
        .cpg-rolefilter::-webkit-scrollbar { display: none; }
        .cpg-chip { flex-shrink: 0; padding: 6px 14px; border-radius: 999px; border: 1px solid #ddd; background: #fff; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: 'Barlow', sans-serif; }
        .cpg-chip.on { background: #ff6000; border-color: #ff6000; color: #fff; }
        .cpg-chart { display: flex; align-items: flex-end; gap: 12px; padding: 8px 0 4px; }
        .cpg-col { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
        .cpg-col-val { font-size: 13px; font-weight: 800; color: #ff6000; margin-bottom: 6px; }
        .cpg-col-barwrap { width: 100%; max-width: 56px; height: 150px; display: flex; align-items: flex-end; }
        .cpg-col-bar { width: 100%; background: linear-gradient(180deg,#ff8a3d,#ff6000); border-radius: 8px 8px 0 0; min-height: 4px; transition: height .4s ease; }
        .cpg-col-x { font-size: 12px; font-weight: 700; color: #444; margin-top: 8px; }
        .cpg-col-n { font-size: 11px; color: #aaa; margin-top: 2px; }
        .cpg-info-row { display: flex; justify-content: space-between; padding: 14px 4px; border-bottom: 1px solid #f2f2f2; font-size: 14px; }
        .cpg-info-row span:first-child { color: #888; }
        .cpg-info-row span:last-child { font-weight: 700; color: #111; }
        .cpg-kr-cap { font-size: 13px; font-weight: 700; color: var(--sm-gray-700); margin: 20px 0 2px; padding: 0 4px; }
        .cpg-kr-src { font-size: 11px; color: var(--sm-gray-500); margin: 12px 0 4px; padding: 0 4px; }
        .cpg-mini-v { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: var(--sm-gray-700); padding: 0 4px; margin-top: 10px; }
        .cpg-mini { display: flex; align-items: flex-end; gap: 3px; height: 72px; margin: 6px 4px 0; }
        .cpg-mini-col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
        .cpg-mini-bar { width: 100%; max-width: 22px; margin: 0 auto; background: var(--sm-primary-500); border-radius: 4px 4px 0 0; min-height: 3px; }
        .cpg-mini-x { display: flex; justify-content: space-between; font-size: 11px; color: var(--sm-gray-500); padding: 0 4px; margin-top: 4px; }
      `}</style>

      <div className="cpg-page">
      <div className="cpg">
        <button
          className="cpg-back"
          onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/community') }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
          {t('cpage.back')}
        </button>
        <div className="cpg-hero">
          <div className={`cpg-logo${logoUrl && !logoError ? ' has-img' : ''}`}>
            {logoUrl && !logoError
              ? <img src={logoUrl} alt={companyName} onError={() => setLogoError(true)} />
              : initial}
          </div>
          <div className="cpg-hmeta">
            <h1 className="cpg-name">{companyName}</h1>
            {(krStats?.industry || heroCity || foundedYear) && (
              <div className="cpg-meta">{[krStats?.industry, heroCity, foundedYear && t('cpage.foundedIn', { year: foundedYear })].filter(Boolean).join(' · ')}</div>
            )}
            <div className="cpg-followers">{followerCount.toLocaleString()} {t('cpage.followers')}</div>
          </div>
          <button
            className={`cpg-follow-btn${following ? ' on' : ''}`}
            onClick={toggleFollow}
            disabled={followBusy}
          >
            {following ? t('cpage.following') : t('cpage.follow')}
          </button>
        </div>

        {/* 원티드식 단일 스크롤 구성 — 데이터가 있는 섹션만 렌더 */}
        {overview && (
          <section>
            <div className="cpg-sec">{t('cpage.secIntro')}</div>
            <div className="cpg-panel">
              <div className={`cpg-intro${introOpen ? '' : ' clamp'}`}>{overview}</div>
              <button className="cpg-more" onClick={() => setIntroOpen(o => !o)}>{introOpen ? t('cpage.introLess') : t('cpage.introMore')}</button>
            </div>
          </section>
        )}

        {jobs.length > 0 && (
          <section>
            <div className="cpg-sec">{t('cpage.secJobs')} <span className="n">{jobs.length}</span></div>
            <div className="cpg-jobs">
              {jobs.map(j => (
                <Link key={j.id} href={`/jobs?jobId=${j.id}`} className="cpg-card">
                  <div className="cpg-card-meta">{[j.location, j.type].filter(Boolean).join(' · ')}</div>
                  <div className="cpg-card-title">{j.title}</div>
                  {j.salary_min > 0 ? (
                    <div className="cpg-job-sal">{Math.round(j.salary_min / 1e6)}M – {Math.round(j.salary_max / 1e6)}M VND</div>
                  ) : isSalaryNegotiable(j) ? (
                    <div className="cpg-job-sal">{t('jobs.salaryNegotiable')}</div>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 연봉: 우리 실측(submissions)이 있을 때만 노출 */}
        {salary?.roles?.length > 0 && (
          <section>
            <div className="cpg-sec">{t('cpage.tabSalary')}</div>
            {salary.overall != null && (
              <div className="cpg-headline">
                <div className="cpg-headline-n">{salary.overall}M</div>
                <div className="cpg-headline-l">{t('cpage.overallMedian')} · {salary.sampleCount} {t('cpage.samples')}</div>
              </div>
            )}

            <div className="cpg-rolefilter">
              <button className={`cpg-chip${roleFilter === 'all' ? ' on' : ''}`} onClick={() => setRoleFilter('all')}>{t('cpage.allRoles')}</button>
              {salary.roles.map(r => (
                <button key={r.role} className={`cpg-chip${roleFilter === r.role ? ' on' : ''}`} onClick={() => setRoleFilter(r.role)}>{r.role}</button>
              ))}
            </div>

            <div className="cpg-chart-cap">{t('cpage.byExperience')} · {t('cpage.yrs')}</div>
            {(() => {
              const ser = (salary.series && salary.series[roleFilter]) || []
              if (!ser.length) return <div className="cpg-empty">{t('cpage.salaryEmpty')}</div>
              const maxMedian = Math.max(...ser.map(p => p.median), 1)
              return (
                <div className="cpg-chart">
                  {ser.map(p => (
                    <div className="cpg-col" key={p.bucket}>
                      <div className="cpg-col-val">{p.median}M</div>
                      <div className="cpg-col-barwrap">
                        <div className="cpg-col-bar" style={{ height: `${Math.round((p.median / maxMedian) * 100)}%` }} />
                      </div>
                      <div className="cpg-col-x">{p.bucket}</div>
                      <div className="cpg-col-n">n={p.count}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>
        )}

        {/* 인원·매출·위치: 한국 공공데이터 (있을 때만) */}
        {krStats && (() => {
          const months = krStats.monthly || []
          const trend = months.filter(m => m.headcount != null)
          const hasFlow = months.some(m => m.joined != null || m.left != null)
          const joined = months.reduce((a, m) => a + (m.joined || 0), 0)
          const left = months.reduce((a, m) => a + (m.left || 0), 0)
          const fins = (krStats.financials || []).filter(f => f.revenue != null)
          const maxH = Math.max(...trend.map(m => m.headcount), 1)
          const ymLabel = ym => `${ym.slice(2, 4)}.${ym.slice(4, 6)}`
          return (
            <>
              {krStats.headcount != null && (
                <section>
                  <div className="cpg-sec">{t('cpage.krHeadcount')}</div>
                  <div className="cpg-panel">
                    <div className="cpg-stat-n">{krStats.headcount.toLocaleString()}{t('cpage.krPeople')}</div>
                    {trend.length >= 2 && (
                      <>
                        <div className="cpg-kr-cap">{t('cpage.krTrend')}</div>
                        <div className="cpg-mini-v"><span>{trend[0].headcount.toLocaleString()}</span><span>{trend[trend.length - 1].headcount.toLocaleString()}</span></div>
                        <div className="cpg-mini">
                          {trend.map(m => (
                            <div className="cpg-mini-col" key={m.ym} title={`${ymLabel(m.ym)} · ${m.headcount.toLocaleString()}`}>
                              <div className="cpg-mini-bar" style={{ height: `${Math.round((m.headcount / maxH) * 100)}%` }} />
                            </div>
                          ))}
                        </div>
                        <div className="cpg-mini-x"><span>{ymLabel(trend[0].ym)}</span><span>{ymLabel(trend[trend.length - 1].ym)}</span></div>
                      </>
                    )}
                    {hasFlow && (
                      <div className="cpg-info-row"><span>{t('cpage.krJoined12m')}</span><span>{joined.toLocaleString()}{t('cpage.krPeople')}</span></div>
                    )}
                    {hasFlow && (
                      <div className="cpg-info-row"><span>{t('cpage.krLeft12m')}</span><span>{left.toLocaleString()}{t('cpage.krPeople')}</span></div>
                    )}
                    {krStats.industry && (
                      <div className="cpg-info-row"><span>{t('cpage.krIndustry')}</span><span>{krStats.industry}</span></div>
                    )}
                    <div className="cpg-kr-src">{t('cpage.krSource')}</div>
                  </div>
                </section>
              )}

              {fins.length > 0 && (
                <section>
                  <div className="cpg-sec">{t('cpage.krRevenue')}</div>
                  <div className="cpg-panel">
                    {fins.map(f => (
                      <div className="cpg-info-row" key={f.year}><span>{f.year}</span><span>{fmtKrw(f.revenue, lang)}{f.operating_income != null ? ` · ${t('cpage.krOpIncome')} ${fmtKrw(f.operating_income, lang)}` : ''}</span></div>
                    ))}
                    <div className="cpg-kr-src">{t('cpage.krSourceDart')}</div>
                  </div>
                </section>
              )}

              {krStats.address && (
                <section>
                  <div className="cpg-sec">{t('cpage.secLocation')}</div>
                  <div className="cpg-panel"><div className="cpg-intro">{krStats.address}</div></div>
                </section>
              )}
            </>
          )
        })()}

        {posts.length > 0 && (
          <section>
            <div className="cpg-sec">{t('cpage.tabNews')}</div>
            {posts.slice(0, 8).map(p => (
              <Link key={p.id} href={`/community/${p.id}`} className="cpg-card">
                <div className="cpg-card-meta">{p.author_name} · {timeAgo(p.created_at)}</div>
                <div className="cpg-card-title">{p.title}</div>
                {p.content && <div className="cpg-card-preview">{p.content}</div>}
              </Link>
            ))}
          </section>
        )}
      </div>
      </div>
    </>
  )
}
