import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { track } from '../../lib/track'
import GlobalNav from '../../components/GlobalNav'
import SalaryBadge from '../../components/SalaryBadge'
import { useT } from '../../lib/i18n'

const CATEGORIES = [
  { key: 'all', tKey: 'comm.all' },
  { key: 'ask_company', tKey: 'comm.askCompany' },
  { key: 'daily', tKey: 'comm.daily' },
  { key: 'job_change', tKey: 'comm.jobChange' },
]

const CATEGORY_COLORS = {
  ask_company: '#3b82f6',
  daily: '#10b981',
  job_change: '#8b5cf6',
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileSearchInput, setMobileSearchInput] = useState('')
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')
  const [mobileSearchResults, setMobileSearchResults] = useState([])
  const [mobileSearchLoading, setMobileSearchLoading] = useState(false)
  const [mobileSearchTotal, setMobileSearchTotal] = useState(0)
  const mobileSearchRef = useRef(null)
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

  // Trending (sidebar)
  const [trending, setTrending] = useState([])

  // Read posts (dim already-viewed posts)
  const [readPosts, setReadPosts] = useState(() => new Set())

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    track('view_community', { page: '/community' })
    try {
      setReadPosts(new Set(JSON.parse(localStorage.getItem('comm_read_posts') || '[]')))
    } catch {}
  }, [])

  const markRead = (postId) => {
    setReadPosts(prev => {
      if (prev.has(postId)) return prev
      const next = new Set(prev)
      next.add(postId)
      try { localStorage.setItem('comm_read_posts', JSON.stringify([...next])) } catch {}
      return next
    })
  }


  useEffect(() => { fetchPosts() }, [category, sort, page, session, search])

  useEffect(() => {
    const t0 = setTimeout(() => setShowFabTip(true), 1000)
    const t1 = setTimeout(() => setFabTipHiding(true), 3700)
    const t2 = setTimeout(() => setShowFabTip(false), 4000)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    fetch('/api/community/posts?sort=popular&limit=5')
      .then(r => r.json())
      .then(d => setTrending(d.posts || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (mobileSearchOpen && mobileSearchRef.current) {
      mobileSearchRef.current.focus()
    }
  }, [mobileSearchOpen])

  useEffect(() => {
    if (!mobileSearchQuery) { setMobileSearchResults([]); setMobileSearchTotal(0); return }
    let cancelled = false
    const doSearch = async () => {
      setMobileSearchLoading(true)
      try {
        const headers = {}
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
        const res = await fetch(`/api/community/posts?search=${encodeURIComponent(mobileSearchQuery)}&limit=20`, { headers })
        const data = await res.json()
        if (!cancelled) {
          setMobileSearchResults(data.posts || [])
          setMobileSearchTotal(data.total || 0)
        }
      } catch (e) { console.error(e) }
      if (!cancelled) setMobileSearchLoading(false)
    }
    doSearch()
    return () => { cancelled = true }
  }, [mobileSearchQuery, session])

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
    markRead(postId)
  }

  const handleWrite = () => {
    if (!session) { window.dispatchEvent(new CustomEvent('fyi-show-login')); return }
    track('click_community_write', { page: '/community' })
    router.push('/community/write')
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

  return (
    <>
      <Head><title>{t('comm.title')}</title><meta name="robots" content="noindex" /></Head>
      <GlobalNav activePage="community" mobileSearch={{
        onToggle: () => setMobileSearchOpen(true),
      }} />

      <style>{`
        .comm-page { background: #fff; min-height: 100vh; }
        .comm-container { max-width: 1080px; margin: 0 auto; padding: 60px 40px 60px; display: grid; grid-template-columns: 1fr 300px; gap: 32px; }
        .comm-header { grid-column: 1 / -1; margin-bottom: 0; }
        .comm-title { font-size: 32px; font-weight: 800; color: #111; margin: 0 0 6px; font-family: 'Barlow', sans-serif; }
        .comm-subtitle { font-size: 14px; color: #888; margin: 0; }
        .comm-main { display: flex; flex-direction: column; gap: 16px; }
        .comm-cats { display: flex; gap: 8px; flex-wrap: wrap; }
        .comm-cat-btn { padding: 5px 14px; border-radius: 14px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Barlow', sans-serif; }
        .comm-cat-btn:hover { border-color: #999; color: #111; }
        .comm-cat-btn.active { background: #ff6000; border-color: #ff6000; color: #fff; }
        .comm-search { position: relative; }
        .comm-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: #bbb; pointer-events: none; }
        .comm-search-input { width: 100%; padding: 10px 36px 10px 38px; border-radius: 8px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 13px; font-family: 'Barlow', sans-serif; outline: none; box-sizing: border-box; transition: border-color 0.15s; }
        .comm-search-input:focus { border-color: #ff6000; }
        .comm-search-input::placeholder { color: #bbb; }
        .comm-search-result { font-size: 13px; color: #666; }
        .comm-search-result strong { color: #ff6000; }
        .comm-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; border: none; background: #eee; color: #888; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; }
        .comm-toolbar { display: flex; justify-content: space-between; align-items: center; }
        .comm-sort { display: flex; gap: 4px; }
        .comm-sort-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; border: none; background: transparent; color: #999; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-sort-btn.active { background: #f0f0f0; color: #111; }
        .comm-write-btn { padding: 9px 24px; border-radius: 8px; border: none; background: #ff6000; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .comm-write-btn:hover { background: #ff7a1a; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,96,0,0.3); }
        .comm-new-badge { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; height: 15px; padding: 0 5px; border-radius: 4px; background: #ff6000; color: #fff; font-size: 9px; font-weight: 800; letter-spacing: 0.3px; line-height: 1; font-family: 'Barlow', sans-serif; flex-shrink: 0; }
        /* Read (already-viewed) posts: dim & desaturate */
        .comm-card.is-read, .comm-ms-item.is-read { opacity: 0.5; filter: saturate(0.7); }
        .comm-card.is-read:hover, .comm-ms-item.is-read:hover { opacity: 0.72; }
        .comm-card.is-read .comm-card-title, .comm-ms-item.is-read .comm-ms-item-title { color: #999; font-weight: 500; }
        .comm-empty { text-align: center; padding: 80px 20px; color: #bbb; font-size: 14px; }
        .comm-pager { display: flex; justify-content: center; gap: 8px; margin-top: 28px; padding-top: 4px; }
        .comm-pager-btn { padding: 8px 18px; border-radius: 8px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 13px; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-pager-btn:disabled { opacity: 0.25; cursor: default; }
        .comm-sidebar { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 80px; align-self: start; }
        .comm-sb-card { background: #fafafa; border: 1px solid #eee; border-radius: 12px; padding: 20px; }
        .comm-sb-title { font-size: 14px; font-weight: 700; color: #333; margin: 0 0 14px; font-family: 'Barlow', sans-serif; }
        .comm-sb-trending { display: flex; flex-direction: column; gap: 12px; }
        .comm-sb-item { cursor: pointer; text-decoration: none; display: block; }
        .comm-sb-item:hover .comm-sb-item-title { color: #ff6000; }
        .comm-sb-item-title { font-size: 13px; font-weight: 600; color: #555; line-height: 1.4; transition: color 0.15s; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .comm-sb-item-meta { font-size: 11px; color: #bbb; margin-top: 3px; display: flex; gap: 10px; }
        .comm-sb-about { font-size: 13px; color: #777; line-height: 1.6; margin-bottom: 14px; }
        .comm-sb-guide { display: flex; flex-direction: column; gap: 8px; }
        .comm-sb-guide-item { font-size: 12px; color: #666; display: flex; align-items: flex-start; gap: 6px; line-height: 1.4; }
        .comm-sb-guide-dot { width: 4px; height: 4px; border-radius: 50%; background: #ff6000; margin-top: 5px; flex-shrink: 0; }
        .comm-delete-btn { margin-left: auto; font-size: 12px; color: #bbb; background: none; border: none; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-delete-btn:hover { color: #ef4444; }
        .comm-fab { display: none; position: fixed; bottom: 80px; right: 20px; width: 52px; height: 52px; border-radius: 50%; border: none; background: #ff6000; color: #fff; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 16px rgba(255,96,0,0.4); z-index: 100; }
        .comm-fab svg { width: 24px; height: 24px; }
        .comm-fab-tip { position: fixed; bottom: 144px; right: 20px; background: #333; color: #fff; font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 10px; white-space: nowrap; font-family: 'Barlow', sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 100; animation: comm-fab-tip-in 0.3s ease-out; }
        .comm-fab-tip::after { content: ''; position: absolute; bottom: -6px; right: 20px; width: 12px; height: 12px; background: #333; transform: rotate(45deg); border-radius: 2px; }
        .comm-fab-tip.hide { animation: comm-fab-tip-out 0.3s ease-in forwards; }
        @keyframes comm-fab-tip-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes comm-fab-tip-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(6px); } }
        .comm-mobile-search-page { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #fff; z-index: 200; flex-direction: column; }
        .comm-mobile-search-page.open { display: flex; }
        .comm-ms-header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #eee; }
        .comm-ms-back { width: 36px; height: 36px; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #333; }
        .comm-ms-input-wrap { flex: 1; position: relative; }
        .comm-ms-input { width: 100%; padding: 10px 36px 10px 14px; border-radius: 8px; border: 1px solid #ddd; background: #f5f5f5; color: #111; font-size: 14px; font-family: 'Barlow', sans-serif; outline: none; box-sizing: border-box; }
        .comm-ms-input:focus { border-color: #ff6000; background: #fff; }
        .comm-ms-input::placeholder { color: #bbb; }
        .comm-ms-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; border: none; background: #ddd; color: #888; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .comm-ms-body { flex: 1; overflow-y: auto; padding: 0; }
        .comm-ms-result-info { padding: 12px 16px; font-size: 13px; color: #666; border-bottom: 1px solid #f0f0f0; }
        .comm-ms-result-info strong { color: #ff6000; }
        .comm-ms-item { display: block; padding: 14px 16px; border-bottom: 1px solid #f0f0f0; text-decoration: none; }
        .comm-ms-item-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
        .comm-ms-item-cat { font-size: 12px; font-weight: 600; color: #ff6000; }
        .comm-ms-item-time { font-size: 11px; color: #bbb; }
        .comm-ms-item-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .comm-ms-item-preview { font-size: 13px; color: #888; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .comm-ms-empty { text-align: center; padding: 60px 20px; color: #bbb; font-size: 14px; }
        .comm-ms-loading { text-align: center; padding: 60px 20px; color: #bbb; font-size: 14px; }
        .comm-feed { display: flex; flex-direction: column; gap: 12px; }
        .comm-card { display: block; padding: 18px 20px; border: 1px solid #ececec; border-radius: 14px; background: #fff; text-decoration: none; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
        .comm-card:hover { border-color: #e0e0e0; box-shadow: 0 6px 22px rgba(0,0,0,0.06); transform: translateY(-1px); }
        .comm-card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .comm-card-cat { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 6px; font-size: 12px; font-weight: 700; line-height: 1.4; }
        .comm-card-time { font-size: 11px; color: #bbb; }
        .comm-card-author { font-size: 12px; color: #999; margin-bottom: 11px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .comm-card-company { color: #ff6000; cursor: pointer; }
        .comm-card-company:hover { text-decoration: underline; }
        .comm-card-dot { color: #ddd; }
        .comm-card-title { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 7px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .comm-card-preview { font-size: 13px; color: #888; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 12px; }
        .comm-card-footer { display: flex; align-items: center; gap: 16px; }
        .comm-card-stat { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #bbb; }
        .comm-card-stat svg { width: 15px; height: 15px; }
        .comm-card-stat.liked { color: #ff6000; }
        .comm-pull { display: none; justify-content: center; align-items: center; color: #bbb; font-size: 12px; font-family: 'Barlow', sans-serif; overflow: hidden; transition: height 0.2s; }
        .comm-pull-spinner { width: 18px; height: 18px; border: 2px solid #ddd; border-top-color: #ff6000; border-radius: 50%; animation: comm-spin 0.6s linear infinite; }
        @keyframes comm-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .comm-pull { display: flex; } }
        @media (max-width: 768px) {
          .comm-container { grid-template-columns: 1fr; padding: 52px 14px 90px; gap: 12px; }
          .comm-sidebar { position: static; }
          .comm-title { font-size: 24px; }
          .comm-cats { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
          .comm-cats::-webkit-scrollbar { display: none; }
          .comm-cat-btn { flex-shrink: 0; }
          .comm-search { display: none; }
          .comm-card { padding: 16px; }
          .comm-write-btn { display: none; }
          .comm-fab { display: flex; }
          .comm-sidebar { display: none; }
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
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { setSearch(searchInput); setPage(1) } }}
              />
              {searchInput && (
                <button className="comm-search-clear" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>×</button>
              )}
            </div>

            {search && !loading && (
              <div className="comm-search-result">
                &lsquo;<strong>{search}</strong>&rsquo; {t('comm.searchResult', { count: totalCount })}
              </div>
            )}

            <div className="comm-swipe" style={{ transform: swipeX ? `translateX(${swipeX}px)` : undefined, transition: swipeAnim ? 'transform 0.2s ease-out' : 'none', overflow: 'hidden' }}>
            {loading ? (
              <div className="comm-empty">{t('comm.loading')}</div>
            ) : posts.length === 0 ? (
              <div className="comm-empty">{sort === 'mine' ? t('comm.emptyMine') : t('comm.empty')}</div>
            ) : (
              <div className="comm-feed">
                {posts.map(post => (
                  <Link key={post.id} href={`/community/${post.id}`} className={`comm-card${readPosts.has(post.id) ? ' is-read' : ''}`} onClick={e => handlePostClick(e, post.id)}>
                    <div className="comm-card-meta">
                      <span className="comm-card-cat" style={{ color: CATEGORY_COLORS[post.category] || '#777', background: (CATEGORY_COLORS[post.category] || '#777') + '18' }}>
                        {getCatLabel(post.category)}
                      </span>
                      <span className="comm-card-time">{timeAgo(post.created_at)}</span>
                      {isNew(post.created_at) && <span className="comm-new-badge">NEW</span>}
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
                    <div className="comm-card-title">{post.title}</div>
                    {post.content && <div className="comm-card-preview">{post.content}</div>}
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
                    </div>
                  </Link>
                ))}
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

          <div className="comm-sidebar">
            {trending.length > 0 && (
              <div className="comm-sb-card">
                <h3 className="comm-sb-title">{t('comm.trendingTitle')}</h3>
                <div className="comm-sb-trending">
                  {trending.map(p => (
                    <Link key={p.id} href={`/community/${p.id}`} className="comm-sb-item">
                      <div className="comm-sb-item-title">{p.title}</div>
                      <div className="comm-sb-item-meta">
                        <span>{getCatLabel(p.category)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> {p.like_count || 0}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> {p.comment_count || 0}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showFabTip && <div className={`comm-fab-tip${fabTipHiding ? ' hide' : ''}`}>{t('comm.fabTip')}</div>}
      <button className="comm-fab" onClick={handleWrite}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      <div className={`comm-mobile-search-page${mobileSearchOpen ? ' open' : ''}`}>
        <div className="comm-ms-header">
          <button className="comm-ms-back" onClick={() => { setMobileSearchOpen(false); setMobileSearchInput(''); setMobileSearchQuery(''); setMobileSearchResults([]) }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="comm-ms-input-wrap">
            <input
              ref={mobileSearchRef}
              className="comm-ms-input"
              placeholder={t('comm.searchPlaceholder')}
              value={mobileSearchInput}
              onChange={e => setMobileSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && mobileSearchInput.trim()) setMobileSearchQuery(mobileSearchInput.trim()) }}
            />
            {mobileSearchInput && (
              <button className="comm-ms-clear" onClick={() => { setMobileSearchInput(''); setMobileSearchQuery(''); setMobileSearchResults([]); mobileSearchRef.current?.focus() }}>×</button>
            )}
          </div>
        </div>
        <div className="comm-ms-body">
          {mobileSearchQuery && !mobileSearchLoading && (
            <div className="comm-ms-result-info">
              &lsquo;<strong>{mobileSearchQuery}</strong>&rsquo; {t('comm.searchResult', { count: mobileSearchTotal })}
            </div>
          )}
          {mobileSearchLoading ? (
            <div className="comm-ms-loading">{t('comm.loading')}</div>
          ) : mobileSearchQuery && mobileSearchResults.length === 0 ? (
            <div className="comm-ms-empty">{t('comm.empty')}</div>
          ) : (
            mobileSearchResults.map(post => (
              <Link key={post.id} href={`/community/${post.id}`} className={`comm-ms-item${readPosts.has(post.id) ? ' is-read' : ''}`} onClick={e => handlePostClick(e, post.id)}>
                <div className="comm-ms-item-meta">
                  <span className="comm-ms-item-cat">{getCatLabel(post.category)}</span>
                  <span className="comm-ms-item-time">{timeAgo(post.created_at)}</span>
                </div>
                <div className="comm-ms-item-title">{post.title}</div>
                {post.content && <div className="comm-ms-item-preview">{post.content}</div>}
              </Link>
            ))
          )}
        </div>
      </div>

    </>
  )
}
