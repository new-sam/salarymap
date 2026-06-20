import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { track } from '../../lib/track'
import SalaryBadge from '../../components/SalaryBadge'
import { useT } from '../../lib/i18n'
import { domainFor, logoUrlFor } from '../../lib/companyDomains'

const CATEGORIES = [
  { key: 'all', tKey: 'comm.all' },
  { key: 'ask_company', tKey: 'comm.askCompany' },
  { key: 'daily', tKey: 'comm.daily' },
  { key: 'job_change', tKey: 'comm.jobChange' },
]

// 게시판 구분용 아이콘. 블라인드식으로 상단 필터 칩에 노출한다.
const CATEGORY_ICONS = {
  ask_company: '🏢',
  daily: '☕',
  job_change: '🚀',
}

function isNew(dateStr) {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

// 투표 마감까지 남은 시간(대략). 마감됐으면 null.
function pollTimeLeft(endsAt) {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return null
  const hrs = Math.floor(diff / 3600000)
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d`
  if (hrs >= 1) return `${hrs}h`
  return `${Math.max(1, Math.floor(diff / 60000))}m`
}

export default function CommunityPage() {
  const router = useRouter()
  const { t } = useT()
  const [session, setSession] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [companyMatches, setCompanyMatches] = useState([])
  const [showFabTip, setShowFabTip] = useState(false)
  const [fabTipHiding, setFabTipHiding] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [swipeAnim, setSwipeAnim] = useState(false)
  const touchStartY = useRef(0)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipeLocked = useRef(null)

  // 최상단 고정 HOT 글 — 현재 카테고리 기준 인기글 1개(정렬과 무관)
  const [hotPost, setHotPost] = useState(null)

  // 실시간 인기 회사(FYI에서 많이 검색된 회사 TOP 10 + 순위 변동)
  const [hotCompanies, setHotCompanies] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const from = new URLSearchParams(window.location.search).get('from')
    track('view_community', { page: '/community', meta: { from } })
    // 데이터 초기라 30일(720h) 창으로 집계
    fetch('/api/trending-companies?hours=720')
      .then(r => r.json())
      .then(d => setHotCompanies(d.companies || []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchPosts() }, [category, sort, page, session, search])

  // 검색어를 URL(?q=)과 동기화 → 회사/글 상세 갔다가 뒤로 와도 검색결과가 복원됨
  useEffect(() => {
    if (!router.isReady) return
    const q = typeof router.query.q === 'string' ? router.query.q : ''
    setSearch(q)
    setSearchInput(q)
  }, [router.isReady, router.query.q])

  // HOT 글은 현재 카테고리 안에서 가장 인기 있는 글 1개. 검색/내 글/2페이지+ 에선 숨김.
  // 인증 포함으로 좋아요/투표 상태까지 정확히 반영한다.
  useEffect(() => {
    if (search || sort === 'mine' || page !== 1) { setHotPost(null); return }
    let cancelled = false
    const headers = {}
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    const catParam = category && category !== 'all' ? `&category=${category}` : ''
    fetch(`/api/community/posts?sort=popular&window=7&limit=1${catParam}`, { headers })
      .then(r => r.json())
      .then(d => { if (!cancelled) setHotPost(d.posts?.[0] || null) })
      .catch(() => { if (!cancelled) setHotPost(null) })
    return () => { cancelled = true }
  }, [category, sort, page, search, session])

  useEffect(() => {
    const t0 = setTimeout(() => setShowFabTip(true), 1000)
    const t1 = setTimeout(() => setFabTipHiding(true), 3700)
    const t2 = setTimeout(() => setShowFabTip(false), 4000)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // 검색 시 매칭되는 회사를 결과 상단에 노출. 실제 연봉 제출 건수 기준 상위 회사만
  // (오타/대소문자 변형은 건수가 적어 자동으로 밀려남) → /api/community/company-search
  useEffect(() => {
    const q = search.trim()
    if (!q) { setCompanyMatches([]); return }
    let cancelled = false
    fetch(`/api/community/company-search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setCompanyMatches(d.companies || []) })
      .catch(() => { if (!cancelled) setCompanyMatches([]) })
    return () => { cancelled = true }
  }, [search])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const headers = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const mine = sort === 'mine'
      const sortParam = mine ? 'recent' : sort
      const res = await fetch(`/api/community/posts?category=${category}&sort=${sortParam}&page=${page}${mine ? '&mine=1' : ''}${search ? '&search=' + encodeURIComponent(search) : ''}`, { headers })
      const data = await res.json()
      setPosts(data.posts || [])
      setTotalPages(data.totalPages || 1)
      setTotalCount(data.total || 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [category, sort, page, session, search])

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    swipeStartX.current = t.clientX
    swipeStartY.current = t.clientY
    swipeLocked.current = null
    setSwipeAnim(false)
    if (window.scrollY === 0) touchStartY.current = t.clientY
    else touchStartY.current = 0
  }, [])

  const onTouchMove = useCallback((e) => {
    const t = e.touches[0]
    const dx = t.clientX - swipeStartX.current
    const dy = t.clientY - swipeStartY.current

    if (!swipeLocked.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
    }

    if (swipeLocked.current === 'x') {
      const clamped = (dx < 0 && sort === 'recent') || (dx > 0 && sort === 'popular') ? dx * 0.4 : dx * 0.15
      setSwipeX(clamped)
    }

    if (swipeLocked.current === 'y' && touchStartY.current) {
      if (dy > 0) setPullY(Math.min(dy * 0.4, 60))
    }
  }, [sort])

  const onTouchEnd = useCallback(async (e) => {
    const endX = e.changedTouches[0].clientX
    const dx = endX - swipeStartX.current

    if (swipeLocked.current === 'x' && Math.abs(dx) > 60) {
      const w = window.innerWidth
      if (dx < 0 && sort === 'recent') {
        setSwipeAnim(true)
        setSwipeX(-w)
        setTimeout(() => { setSort('popular'); setPage(1); setSwipeX(0); setSwipeAnim(false) }, 200)
      } else if (dx > 0 && sort === 'popular') {
        setSwipeAnim(true)
        setSwipeX(w)
        setTimeout(() => { setSort('recent'); setPage(1); setSwipeX(0); setSwipeAnim(false) }, 200)
      } else {
        setSwipeAnim(true)
        setSwipeX(0)
        setTimeout(() => setSwipeAnim(false), 200)
      }
    } else {
      setSwipeAnim(true)
      setSwipeX(0)
      setTimeout(() => setSwipeAnim(false), 200)
    }

    if (swipeLocked.current === 'y' && pullY >= 50) {
      setRefreshing(true)
      await fetchPosts()
      setRefreshing(false)
    }
    setPullY(0)
    touchStartY.current = 0
    swipeLocked.current = null
  }, [pullY, fetchPosts, sort])

  const handlePostClick = (e, postId) => {
    if (!session) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('fyi-show-login'))
      return
    }
    track('click_community_post', { meta: { post_id: postId }, page: '/community' })
  }

  const handleWrite = () => {
    if (!session) { window.dispatchEvent(new CustomEvent('fyi-show-login')); return }
    track('click_community_write', { page: '/community' })
    router.push('/community/write')
  }

  // 검색어를 실시간 인기 회사 랭킹 신호로 기록(검색어=회사명 가정). 2글자 미만은 무시.
  const trackCompanySearch = (q) => {
    const term = (q || '').trim()
    if (term.length < 2) return
    track('search_company', { meta: { company: term }, page: '/community' })
  }

  // 검색 실행/해제는 URL을 통해 처리(뒤로가기 복원용). search 상태는 위 effect가 URL에서 채움.
  const submitSearch = (term) => {
    const q = (term || '').trim()
    setPage(1)
    trackCompanySearch(q)
    router.push(q ? `/community?q=${encodeURIComponent(q)}` : '/community', undefined, { shallow: true })
  }

  const toggleLike = async (postId) => {
    if (!session) { window.dispatchEvent(new CustomEvent('fyi-show-login')); return }
    try {
      const res = await fetch('/api/community/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ post_id: postId })
      })
      const { liked } = await res.json()
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, is_liked: liked, like_count: liked ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1) }
        : p
      ))
    } catch (e) { console.error(e) }
  }

  const votePoll = async (post, choice) => {
    if (!session) { window.dispatchEvent(new CustomEvent('fyi-show-login')); return }
    const poll = post.poll
    if (!poll || poll.my_vote || new Date(poll.ends_at).getTime() <= Date.now()) return
    try {
      const res = await fetch('/api/community/poll-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ poll_id: poll.id, choice })
      })
      const d = await res.json()
      if (res.ok || d.error === 'already_voted') {
        setPosts(prev => prev.map(p => p.id === post.id
          ? { ...p, poll: { ...p.poll, my_vote: choice, votes_a: d.votes_a ?? p.poll.votes_a, votes_b: d.votes_b ?? p.poll.votes_b } }
          : p
        ))
      }
    } catch (e) { console.error(e) }
  }

  const deletePost = async (postId) => {
    if (!confirm(t('comm.deleteConfirm'))) return
    try {
      await fetch(`/api/community/posts?id=${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (e) { console.error(e) }
  }

  const getCatLabel = (catKey) => {
    const found = CATEGORIES.find(c => c.key === catKey)
    return found ? t(found.tKey) : catKey
  }

  // 카드 한 장 렌더. hot=true면 최상단 고정 카드로 HOT 뱃지를 단다.
  const renderCard = (post, hot = false) => (
    <Link key={post.id} href={`/community/${post.id}`} className="comm-card" onClick={e => handlePostClick(e, post.id)}>
      <div className="comm-card-meta">
        {hot && <span className="comm-hot-badge">HOT</span>}
        {isNew(post.created_at) && <span className="comm-new-badge">NEW</span>}
        <span className="comm-card-cat">{getCatLabel(post.category)}</span>
      </div>
      <div className="comm-card-author">
        {(post.author_verified_company || post.author_company) ? (
          <span
            className="comm-card-company"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${encodeURIComponent(post.author_verified_company || post.author_company)}`) }}
          >{post.author_verified_company || post.author_company}</span>
        ) : (
          <span>{t('comm.unemployed')}</span>
        )}
        <span className="comm-card-dot">·</span>
        <span>{post.author_name}</span>
        {post.author_salary_tier && <SalaryBadge tierKey={post.author_salary_tier} t={t} />}
      </div>
      <div className="comm-card-main">
        <div className="comm-card-text">
          <div className="comm-card-title">{post.title}</div>
          {post.content && <div className="comm-card-preview">{post.content}</div>}
        </div>
        {post.image_urls?.length > 0 && (
          <div className="comm-card-thumb">
            <img src={post.image_urls[0]} alt="" />
            {post.image_urls.length > 1 && (
              <span className="comm-card-thumb-more">+{post.image_urls.length - 1}</span>
            )}
          </div>
        )}
      </div>

      {post.poll && (() => {
        const { id: pollId, option_a, option_b, votes_a, votes_b, my_vote, ends_at } = post.poll
        const left = pollTimeLeft(ends_at)
        const ended = !left
        const showResults = ended || !!my_vote
        const total = votes_a + votes_b
        const pctA = total ? Math.round((votes_a / total) * 100) : 0
        const pctB = total ? 100 - pctA : 0
        const leadA = votes_a >= votes_b
        return (
          <div className="comm-poll" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
            <div className="comm-poll-head">
              <span className="comm-poll-tag">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 20V10M12 20V4M20 20v-6"/></svg>
                {t('comm.pollBattle')}
              </span>
              <span className="comm-poll-time">{ended ? t('comm.pollEnded') : t('comm.pollEndsIn', { time: left })} · {t('comm.pollTotal', { n: total })}</span>
            </div>
            {showResults ? (
              <div className="comm-poll-results">
                {[{ k: 'a', label: option_a, pct: pctA, lead: leadA }, { k: 'b', label: option_b, pct: pctB, lead: !leadA }].map(o => (
                  <div key={o.k} className={`comm-poll-res${my_vote === o.k ? ' mine' : ''}${total && o.lead ? ' lead' : ''}`}>
                    <div className="comm-poll-res-fill" style={{ width: `${o.pct}%` }} />
                    <div className="comm-poll-res-row">
                      <span className="comm-poll-res-label">{o.label}{my_vote === o.k && ' ✓'}</span>
                      <span className="comm-poll-res-pct">{o.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="comm-poll-vote">
                <button className="comm-poll-btn" onClick={() => votePoll(post, 'a')}>{option_a}</button>
                <span className="comm-poll-vs">VS</span>
                <button className="comm-poll-btn" onClick={() => votePoll(post, 'b')}>{option_b}</button>
              </div>
            )}
          </div>
        )
      })()}

      <div className="comm-card-footer">
        <span
          className={`comm-card-stat${post.is_liked ? ' liked' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLike(post.id) }}
        >
          <svg viewBox="0 0 24 24" fill={post.is_liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          {post.like_count || 0}
        </span>
        <span className="comm-card-stat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          {post.comment_count || 0}
        </span>
        <span className="comm-card-time">{timeAgo(post.created_at)}</span>
      </div>
    </Link>
  )

  return (
    <>
      <Head><title>{t('comm.title')}</title><meta name="robots" content="noindex" /></Head>

      <style>{`
        .comm-page { background: #fff; min-height: 100vh; }
        .comm-container { max-width: 1180px; margin: 0 auto; padding: 60px 40px 60px; display: grid; grid-template-columns: 1fr 280px; gap: 28px; align-items: start; }
        .comm-sidebar { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 80px; align-self: start; }
        .comm-hotco-card { background: #fff; border: 1px solid #eee; border-radius: 14px; padding: 18px 18px 8px; }
        .comm-hotco-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; color: #111; margin: 0 0 4px; font-family: 'Barlow', sans-serif; }
        .comm-hotco-sub { font-size: 11px; color: #aaa; margin: 0 0 12px; }
        .comm-hotco-live { width: 6px; height: 6px; border-radius: 50%; background: #ff3b30; box-shadow: 0 0 0 0 rgba(255,59,48,0.5); animation: comm-live-pulse 1.6s ease-out infinite; }
        @keyframes comm-live-pulse { 0% { box-shadow: 0 0 0 0 rgba(255,59,48,0.5); } 70% { box-shadow: 0 0 0 5px rgba(255,59,48,0); } 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0); } }
        .comm-hotco-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; text-decoration: none; }
        .comm-hotco-row + .comm-hotco-row { border-top: 1px solid #f4f4f4; }
        .comm-hotco-rank { width: 18px; flex-shrink: 0; font-size: 13px; font-weight: 800; color: #bbb; text-align: center; font-family: 'Barlow', sans-serif; }
        .comm-hotco-rank.top { color: #ff6000; }
        .comm-hotco-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: capitalize; transition: color 0.15s; }
        .comm-hotco-row:hover .comm-hotco-name { color: #ff6000; }
        .comm-hotco-move { flex-shrink: 0; width: 30px; text-align: right; font-size: 11px; font-weight: 800; line-height: 1; }
        .comm-hotco-move.up { color: #16a34a; }
        .comm-hotco-move.down { color: #ef4444; }
        .comm-hotco-move.same { color: #ddd; }
        .comm-hotco-move.new { color: #ff6000; }
        .comm-hotco-new { display: inline-block; padding: 1px 4px; border-radius: 3px; background: #ff6000; color: #fff; font-size: 8px; font-weight: 800; letter-spacing: 0.3px; }
        .comm-title { font-size: 32px; font-weight: 800; color: #111; margin: 0 0 6px; font-family: 'Barlow', sans-serif; }
        .comm-subtitle { font-size: 14px; color: #888; margin: 0; }
        .comm-main { display: flex; flex-direction: column; gap: 16px; }
        .comm-cats { display: flex; gap: 8px; flex-wrap: wrap; }
        .comm-cat-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 14px; border-radius: 14px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Barlow', sans-serif; }
        .comm-cat-btn-ico { font-size: 13px; line-height: 1; }
        .comm-cat-btn:hover { border-color: #999; color: #111; }
        .comm-cat-btn.active { background: #ff6000; border-color: #ff6000; color: #fff; }
        .comm-search { position: relative; }
        .comm-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: #bbb; pointer-events: none; }
        .comm-search-input { width: 100%; padding: 10px 36px 10px 38px; border-radius: 8px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 13px; font-family: 'Barlow', sans-serif; outline: none; box-sizing: border-box; transition: border-color 0.15s; }
        .comm-search-input:focus { border-color: #ff6000; }
        .comm-search-input::placeholder { color: #bbb; }
        .comm-search-result { font-size: 13px; color: #666; }
        .comm-search-result strong { color: #ff6000; }
        .comm-sresult-head { display: flex; align-items: center; gap: 8px; margin: 16px 0 10px; }
        .comm-sresult-back { width: 30px; height: 30px; flex-shrink: 0; border: none; background: none; cursor: pointer; color: #333; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
        .comm-sresult-back:hover { background: #f3f3f3; }
        .comm-sresult-back svg { width: 20px; height: 20px; }
        .comm-sresult-title { font-size: 18px; font-weight: 800; color: #111; }
        .comm-sresult-title strong { color: #ff6000; }
        .comm-cmatch { margin: 14px 0 4px; }
        .comm-cmatch-label { font-size: 12px; font-weight: 700; color: #999; margin-bottom: 8px; }
        .comm-cmatch-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: 1px solid #eee; border-radius: 12px; text-decoration: none; margin-bottom: 8px; transition: border-color 0.15s, background 0.15s; }
        .comm-cmatch-row:hover { border-color: #ff6000; background: #fff8f4; }
        .comm-cmatch-logo { width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg,#ff6000,#ff8a3d); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden; }
        .comm-cmatch-logo.has-img { background: #fff; border: 1px solid #ececec; }
        .comm-cmatch-logo.has-img img { width: 100%; height: 100%; object-fit: contain; padding: 5px; box-sizing: border-box; }
        .comm-cmatch-name { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; color: #111; text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .comm-cmatch-go { font-size: 12px; color: #ff6000; font-weight: 700; flex-shrink: 0; }
        .comm-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; border: none; background: #eee; color: #888; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; }
        .comm-toolbar { display: flex; justify-content: space-between; align-items: center; }
        .comm-sort { display: flex; gap: 4px; }
        .comm-sort-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; border: none; background: transparent; color: #999; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-sort-btn.active { background: #f0f0f0; color: #111; }
        .comm-write-btn { padding: 9px 24px; border-radius: 8px; border: none; background: #ff6000; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .comm-write-btn:hover { background: #ff7a1a; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,96,0,0.3); }
        .comm-new-badge { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; height: 15px; padding: 0 5px; border-radius: 4px; background: #ff6000; color: #fff; font-size: 9px; font-weight: 800; letter-spacing: 0.3px; line-height: 1; font-family: 'Barlow', sans-serif; flex-shrink: 0; }
        .comm-hot-badge { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; height: 15px; padding: 0 6px; border-radius: 4px; background: #ef4444; color: #fff; font-size: 9px; font-weight: 800; letter-spacing: 0.5px; line-height: 1; font-family: 'Barlow', sans-serif; flex-shrink: 0; }
        .comm-empty { text-align: center; padding: 80px 20px; color: #bbb; font-size: 14px; }
        .comm-pager { display: flex; justify-content: center; gap: 8px; margin-top: 28px; padding-top: 4px; }
        .comm-pager-btn { padding: 8px 18px; border-radius: 8px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 13px; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-pager-btn:disabled { opacity: 0.25; cursor: default; }
        .comm-delete-btn { margin-left: auto; font-size: 12px; color: #bbb; background: none; border: none; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-delete-btn:hover { color: #ef4444; }
        .comm-fab { display: none; position: fixed; bottom: 80px; right: 20px; width: 52px; height: 52px; border-radius: 50%; border: none; background: #ff6000; color: #fff; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 16px rgba(255,96,0,0.4); z-index: 100; }
        .comm-fab svg { width: 24px; height: 24px; }
        .comm-fab-tip { position: fixed; bottom: 144px; right: 20px; background: #333; color: #fff; font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 10px; white-space: nowrap; font-family: 'Barlow', sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 100; animation: comm-fab-tip-in 0.3s ease-out; }
        .comm-fab-tip::after { content: ''; position: absolute; bottom: -6px; right: 20px; width: 12px; height: 12px; background: #333; transform: rotate(45deg); border-radius: 2px; }
        .comm-fab-tip.hide { animation: comm-fab-tip-out 0.3s ease-in forwards; }
        @keyframes comm-fab-tip-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes comm-fab-tip-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(6px); } }
        /* 데스크탑 2열 그리드(블라인드식). 모바일은 아래 미디어쿼리에서 1열. */
        /* align-items: stretch(기본)로 같은 행 카드 높이를 통일 → 내용이 짧아도 카드 크기 동일. */
        .comm-feed { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .comm-card { display: flex; flex-direction: column; padding: 18px 20px; border: 1px solid #ececec; border-radius: 14px; background: #fff; text-decoration: none; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
        .comm-card:hover { border-color: #e0e0e0; box-shadow: 0 6px 22px rgba(0,0,0,0.06); transform: translateY(-1px); }
        .comm-card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .comm-card-cat { font-size: 12px; font-weight: 700; color: #999; line-height: 1.4; }
        .comm-card-time { font-size: 11px; color: #bbb; }
        .comm-card-author { font-size: 12px; color: #999; margin-bottom: 11px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .comm-card-company { color: #ff6000; cursor: pointer; }
        .comm-card-company:hover { text-decoration: underline; }
        .comm-card-dot { color: #ddd; }
        .comm-card-title { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 7px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .comm-card-preview { font-size: 13px; color: #888; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        /* 미리보기: 텍스트 왼쪽 + 작은 정사각 썸네일 오른쪽. 원본 비율은 상세에서. */
        .comm-card-main { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
        .comm-card-text { flex: 1; min-width: 0; }
        .comm-card-thumb { position: relative; width: 72px; height: 72px; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
        .comm-card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .comm-card-thumb-more { position: absolute; bottom: 3px; right: 3px; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }
        .comm-poll { border: 1px solid #eee; border-radius: 10px; padding: 12px; margin-bottom: 12px; background: #fcfcfc; }
        .comm-poll-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
        .comm-poll-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; color: #ff6000; }
        .comm-poll-time { font-size: 10px; color: #aaa; white-space: nowrap; }
        .comm-poll-vote { display: flex; align-items: stretch; gap: 7px; }
        .comm-poll-btn { flex: 1; padding: 11px 8px; border-radius: 8px; border: 1px solid #ddd; background: #fff; color: #333; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; word-break: break-word; }
        .comm-poll-btn:hover { border-color: #ff6000; background: #fff1e8; color: #ff6000; }
        .comm-poll-vs { display: flex; align-items: center; font-size: 11px; font-weight: 800; color: #ccc; flex-shrink: 0; }
        .comm-poll-results { display: flex; flex-direction: column; gap: 7px; }
        .comm-poll-res { position: relative; border-radius: 7px; border: 1px solid #eee; background: #fff; overflow: hidden; }
        .comm-poll-res.lead { border-color: #ffc9a8; }
        .comm-poll-res.mine { box-shadow: 0 0 0 1.5px #ff6000 inset; }
        .comm-poll-res-fill { position: absolute; inset: 0 auto 0 0; background: #ffeadd; transition: width 0.5s ease; }
        .comm-poll-res-row { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; }
        .comm-poll-res-label { font-size: 12px; font-weight: 700; color: #444; word-break: break-word; }
        .comm-poll-res-pct { font-size: 13px; font-weight: 800; color: #ff6000; flex-shrink: 0; margin-left: 8px; }
        .comm-card-footer { display: flex; align-items: center; gap: 16px; margin-top: auto; }
        .comm-card-footer .comm-card-time { margin-left: auto; }
        .comm-card-stat { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #bbb; }
        .comm-card-stat svg { width: 15px; height: 15px; }
        .comm-card-stat.liked { color: #ff6000; }
        .comm-pull { display: none; justify-content: center; align-items: center; color: #bbb; font-size: 12px; font-family: 'Barlow', sans-serif; overflow: hidden; transition: height 0.2s; }
        .comm-pull-spinner { width: 18px; height: 18px; border: 2px solid #ddd; border-top-color: #ff6000; border-radius: 50%; animation: comm-spin 0.6s linear infinite; }
        @keyframes comm-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .comm-pull { display: flex; } }
        @media (max-width: 768px) {
          .comm-container { grid-template-columns: 1fr; padding: 52px 14px 90px; }
          .comm-sidebar { display: none; }
          .comm-title { font-size: 24px; }
          .comm-cats { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
          .comm-cats::-webkit-scrollbar { display: none; }
          .comm-cat-btn { flex-shrink: 0; }
          .comm-feed { grid-template-columns: 1fr; }
          .comm-card { padding: 16px; }
          .comm-write-btn { display: none; }
          .comm-fab { display: flex; }
        }
      `}</style>

      <div className="comm-page" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="comm-pull" style={{ height: pullY || refreshing ? Math.max(pullY, refreshing ? 40 : 0) : 0 }}>
          {refreshing ? <div className="comm-pull-spinner" /> : pullY >= 50 ? t('comm.pullRefresh') : pullY > 0 ? '↓' : ''}
        </div>
        <div className="comm-container">
          <div className="comm-main">
            <div className="comm-toolbar">
              <div className="comm-sort">
                <button className={`comm-sort-btn${sort === 'recent' ? ' active' : ''}`} onClick={() => setSort('recent')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/></svg>
                  {t('comm.latest')}
                </button>
                <button className={`comm-sort-btn${sort === 'popular' ? ' active' : ''}`} onClick={() => setSort('popular')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2c.5 3.5 4 6 4 10a6 6 0 01-12 0c0-4 3.5-6.5 4-10 .5 2 2 3 4 3s3.5-1 4-3z" fill="#ff6000" stroke="#ff6000" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  {t('comm.popular')}
                </button>
                {session && (
                  <button className={`comm-sort-btn${sort === 'mine' ? ' active' : ''}`} onClick={() => { setSort('mine'); setPage(1) }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {t('comm.mine')}
                  </button>
                )}
              </div>
              <button className="comm-write-btn" onClick={handleWrite}>{t('comm.write')}</button>
            </div>

            <div className="comm-cats">
              {CATEGORIES.map(cat => (
                <button key={cat.key} className={`comm-cat-btn${category === cat.key ? ' active' : ''}`} onClick={() => { setCategory(cat.key); setPage(1) }}>
                  {CATEGORY_ICONS[cat.key] && <span className="comm-cat-btn-ico">{CATEGORY_ICONS[cat.key]}</span>}
                  {t(cat.tKey)}
                </button>
              ))}
            </div>

            <div className="comm-search">
              <svg className="comm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                className="comm-search-input"
                placeholder={t('comm.searchPlaceholder')}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitSearch(searchInput) }}
              />
              {searchInput && (
                <button className="comm-search-clear" onClick={() => { setSearchInput(''); submitSearch('') }}>×</button>
              )}
            </div>

            {search && (
              <div className="comm-sresult-head">
                <button className="comm-sresult-back" onClick={() => router.back()} aria-label="back">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <span className="comm-sresult-title">&lsquo;<strong>{search}</strong>&rsquo; {t('comm.searchResultTitle')}</span>
              </div>
            )}

            {search && companyMatches.length > 0 && (
              <div className="comm-cmatch">
                <div className="comm-cmatch-label">{t('comm.searchCompanyLabel')}</div>
                {companyMatches.map(c => {
                  const dom = domainFor(c.name)
                  const logo = dom ? logoUrlFor(dom) : null
                  return (
                    <Link key={c.name} href={`/companies/${encodeURIComponent(c.name)}`} className="comm-cmatch-row">
                      <span className={`comm-cmatch-logo${logo ? ' has-img' : ''}`}>
                        {logo ? <img src={logo} alt="" /> : c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="comm-cmatch-name">{c.name}</span>
                      <span className="comm-cmatch-go">{t('comm.searchCompanyGo')} →</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {search && !loading && (
              <div className="comm-search-result">
                {t('comm.searchResult', { count: totalCount })}
              </div>
            )}

            <div className="comm-swipe" style={{ transform: swipeX ? `translateX(${swipeX}px)` : undefined, transition: swipeAnim ? 'transform 0.2s ease-out' : 'none', overflow: 'hidden' }}>
            {loading ? (
              <div className="comm-empty">{t('comm.loading')}</div>
            ) : posts.length === 0 ? (
              <div className="comm-empty">{sort === 'mine' ? t('comm.emptyMine') : t('comm.empty')}</div>
            ) : (
              <div className="comm-feed">
                {hotPost && renderCard(hotPost, true)}
                {posts.filter(p => !hotPost || p.id !== hotPost.id).map(post => renderCard(post))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="comm-pager">
                <button className="comm-pager-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('comm.prev')}</button>
                <span style={{ color: '#999', fontSize: 13, lineHeight: '36px' }}>{page} / {totalPages}</span>
                <button className="comm-pager-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('comm.next')}</button>
              </div>
            )}
            </div>
          </div>

          <aside className="comm-sidebar">
            {hotCompanies.length > 0 && (
              <div className="comm-hotco-card">
                <h3 className="comm-hotco-title"><span className="comm-hotco-live" />{t('comm.hotCompaniesTitle')}</h3>
                <p className="comm-hotco-sub">{t('comm.hotCompaniesSub')}</p>
                {hotCompanies.map(c => (
                  <Link key={c.company} href={`/companies/${encodeURIComponent(c.company)}`} className="comm-hotco-row">
                    <span className={`comm-hotco-rank${c.rank <= 3 ? ' top' : ''}`}>{c.rank}</span>
                    <span className="comm-hotco-name">{c.company}</span>
                    <span className={`comm-hotco-move ${c.move}`}>
                      {c.move === 'new' ? <span className="comm-hotco-new">NEW</span>
                        : c.move === 'up' ? '▲'
                        : c.move === 'down' ? '▼'
                        : '–'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      {showFabTip && <div className={`comm-fab-tip${fabTipHiding ? ' hide' : ''}`}>{t('comm.fabTip')}</div>}
      <button className="comm-fab" onClick={handleWrite}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>

    </>
  )
}
