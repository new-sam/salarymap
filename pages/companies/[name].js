import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import GlobalNav from '../../components/GlobalNav'
import { useT } from '../../lib/i18n'
import { domainFor, logoUrlFor } from '../../lib/companyDomains'
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

  return { props: { companyName, domain: domain || null } }
}

function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'now'
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

export default function CompanyPage({ companyName, domain }) {
  const { t } = useT()
  const router = useRouter()
  const [tab, setTab] = useState('news')
  const [roleFilter, setRoleFilter] = useState('all')

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [salary, setSalary] = useState(null)
  const [salaryLoading, setSalaryLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [tabTouched, setTabTouched] = useState(false)
  const selectTab = (x) => { setTabTouched(true); setTab(x) }

  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followBusy, setFollowBusy] = useState(false)

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

  // 채용 공고만 있고 소식이 없는 회사(예: jobs에서 넘어온 한국 기업)는
  // 사용자가 직접 탭을 바꾸기 전까지 채용중 탭을 기본으로 보여준다.
  useEffect(() => {
    if (tabTouched || postsLoading || jobsLoading) return
    if (posts.length === 0 && jobs.length > 0) setTab('jobs')
  }, [tabTouched, postsLoading, jobsLoading, posts.length, jobs.length])

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
      <GlobalNav activePage="community" />
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
        .cpg-tabs { display: flex; gap: 4px; border-bottom: 1px solid #ececec; margin-bottom: 20px; }
        .cpg-tab { padding: 12px 16px; font-size: 14px; font-weight: 700; color: #999; background: none; border: none; cursor: pointer; position: relative; font-family: 'Barlow', sans-serif; }
        .cpg-tab.on { color: #111; }
        .cpg-tab.on::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: #ff6000; }
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

        <div className="cpg-tabs">
          <button className={`cpg-tab${tab === 'news' ? ' on' : ''}`} onClick={() => selectTab('news')}>{t('cpage.tabNews')}</button>
          <button className={`cpg-tab${tab === 'jobs' ? ' on' : ''}`} onClick={() => selectTab('jobs')}>{t('cpage.tabJobs')}{jobs.length > 0 ? ` ${jobs.length}` : ''}</button>
          <button className={`cpg-tab${tab === 'salary' ? ' on' : ''}`} onClick={() => selectTab('salary')}>{t('cpage.tabSalary')}</button>
          <button className={`cpg-tab${tab === 'info' ? ' on' : ''}`} onClick={() => selectTab('info')}>{t('cpage.tabInfo')}</button>
        </div>

        {tab === 'news' && (
          postsLoading ? (
            <div className="cpg-empty">···</div>
          ) : posts.length === 0 ? (
            <div className="cpg-empty">{t('cpage.newsEmpty')}</div>
          ) : (
            posts.map(p => (
              <Link key={p.id} href={`/community/${p.id}`} className="cpg-card">
                <div className="cpg-card-meta">{p.author_name} · {timeAgo(p.created_at)}</div>
                <div className="cpg-card-title">{p.title}</div>
                {p.content && <div className="cpg-card-preview">{p.content}</div>}
              </Link>
            ))
          )
        )}

        {tab === 'jobs' && (
          jobsLoading ? (
            <div className="cpg-empty">···</div>
          ) : jobs.length === 0 ? (
            <div className="cpg-empty">{t('cpage.jobsEmpty')}</div>
          ) : (
            jobs.map(j => (
              <Link key={j.id} href={`/jobs?jobId=${j.id}`} className="cpg-card">
                <div className="cpg-card-meta">{[j.location, j.type].filter(Boolean).join(' · ')}</div>
                <div className="cpg-card-title">{j.title}</div>
                {j.salary_min > 0 && (
                  <div className="cpg-job-sal">{Math.round(j.salary_min / 1e6)}M – {Math.round(j.salary_max / 1e6)}M VND</div>
                )}
              </Link>
            ))
          )
        )}

        {tab === 'salary' && (
          salaryLoading ? (
            <div className="cpg-empty">···</div>
          ) : !salary || !salary.roles?.length ? (
            <div className="cpg-empty">{t('cpage.salaryEmpty')}</div>
          ) : (
            <>
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
            </>
          )
        )}

        {tab === 'info' && (
          <div>
            <div className="cpg-info-row"><span>{t('cpage.infoSubmissions')}</span><span>{salary?.total ?? '–'}</span></div>
            <div className="cpg-info-row"><span>{t('cpage.followers')}</span><span>{followerCount.toLocaleString()}</span></div>
          </div>
        )}
      </div>
      </div>
    </>
  )
}
