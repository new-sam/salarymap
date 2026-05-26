import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import GlobalNav from '../../components/GlobalNav'
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

  // Write modal
  const [showWrite, setShowWrite] = useState(false)
  const [writeCategory, setWriteCategory] = useState('ask_company')
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const [writeAnonymous, setWriteAnonymous] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Trending (sidebar)
  const [trending, setTrending] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
  }, [])

  useEffect(() => { fetchPosts() }, [category, sort, page, session, search])

  useEffect(() => {
    fetch('/api/community/posts?sort=popular&limit=5')
      .then(r => r.json())
      .then(d => setTrending(d.posts || []))
      .catch(() => {})
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const headers = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const res = await fetch(`/api/community/posts?category=${category}&sort=${sort}&page=${page}${search ? '&search=' + encodeURIComponent(search) : ''}`, { headers })
      const data = await res.json()
      setPosts(data.posts || [])
      setTotalPages(data.totalPages || 1)
      setTotalCount(data.total || 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleWrite = async () => {
    if (!session) {
      localStorage.setItem('fyi_login_return', '/community')
      if (window.location.hostname === 'localhost') {
        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
      } else {
        window.location.href = '/api/auth/google?return=' + encodeURIComponent('/community')
      }
      return
    }
    setShowWrite(true)
  }

  const submitPost = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ category: writeCategory, title: writeTitle.trim(), content: writeContent.trim(), is_anonymous: writeAnonymous })
      })
      if (res.ok) {
        setShowWrite(false)
        setWriteTitle('')
        setWriteContent('')
        setPage(1)
        fetchPosts()
      }
    } catch (e) { console.error(e) }
    setSubmitting(false)
  }

  const toggleLike = async (postId) => {
    if (!session) return handleWrite()
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
      <Head><title>{t('comm.title')}</title></Head>
      <GlobalNav activePage="community" />

      <style>{`
        .comm-page { background: #fff; min-height: 100vh; }
        .comm-container { max-width: 1080px; margin: 0 auto; padding: 80px 40px 60px; display: grid; grid-template-columns: 1fr 300px; gap: 32px; }
        .comm-header { grid-column: 1 / -1; margin-bottom: 8px; }
        .comm-title { font-size: 32px; font-weight: 800; color: #111; margin: 0 0 6px; font-family: 'Barlow', sans-serif; }
        .comm-subtitle { font-size: 14px; color: #888; margin: 0; }
        .comm-main { display: flex; flex-direction: column; gap: 16px; }
        .comm-cats { display: flex; gap: 8px; flex-wrap: wrap; }
        .comm-cat-btn { padding: 8px 18px; border-radius: 20px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Barlow', sans-serif; }
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
        .comm-sort-btn { padding: 6px 14px; border-radius: 6px; border: none; background: transparent; color: #999; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-sort-btn.active { background: #f0f0f0; color: #111; }
        .comm-write-btn { padding: 9px 24px; border-radius: 8px; border: none; background: #ff6000; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .comm-write-btn:hover { background: #ff7a1a; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,96,0,0.3); }
        .comm-list { display: flex; flex-direction: column; gap: 0; border-top: 1px solid #eee; }
        .comm-row { display: flex; align-items: center; gap: 12px; padding: 14px 4px; border-bottom: 1px solid #eee; text-decoration: none; transition: background 0.1s; cursor: pointer; }
        .comm-row:hover { background: #fafafa; }
        .comm-row-cat { font-size: 13px; font-weight: 600; color: #888; flex-shrink: 0; min-width: 80px; }
        .comm-row-title { flex: 1; font-size: 14px; font-weight: 600; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .comm-row-stats { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
        .comm-row-stat { display: flex; align-items: center; gap: 3px; font-size: 13px; color: #bbb; white-space: nowrap; }
        .comm-row-stat svg { width: 14px; height: 14px; }
        .comm-row-stat.liked { color: #ff6000; }
        .comm-empty { text-align: center; padding: 80px 20px; color: #bbb; font-size: 14px; }
        .comm-pager { display: flex; justify-content: center; gap: 8px; }
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
        .comm-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .comm-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; padding: 28px; margin: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        .comm-modal h2 { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 20px; font-family: 'Barlow', sans-serif; }
        .comm-modal-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .comm-modal-cat { padding: 7px 16px; border-radius: 16px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .comm-modal-cat.active { background: #ff6000; border-color: #ff6000; color: #fff; }
        .comm-input { width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 14px; font-family: 'Barlow', sans-serif; margin-bottom: 12px; outline: none; box-sizing: border-box; transition: border-color 0.15s; }
        .comm-input:focus { border-color: #ff6000; }
        .comm-textarea { min-height: 140px; resize: vertical; }
        .comm-modal-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .comm-anon-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; cursor: pointer; }
        .comm-anon-check { width: 18px; height: 18px; accent-color: #ff6000; }
        .comm-submit-btn { padding: 10px 28px; border-radius: 8px; border: none; background: #ff6000; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .comm-submit-btn:disabled { opacity: 0.4; cursor: default; }
        .comm-cancel-btn { padding: 10px 20px; border-radius: 8px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 14px; cursor: pointer; margin-right: 8px; font-family: 'Barlow', sans-serif; }
        @media (max-width: 768px) {
          .comm-container { grid-template-columns: 1fr; padding: 68px 14px 90px; gap: 20px; }
          .comm-sidebar { position: static; }
          .comm-title { font-size: 24px; }
          .comm-cats { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
          .comm-cats::-webkit-scrollbar { display: none; }
          .comm-cat-btn { flex-shrink: 0; }
          .comm-card { padding: 16px; }
          .comm-modal { margin: 0; border-radius: 16px 16px 0 0; max-width: 100%; position: fixed; bottom: 0; }
          .comm-modal-overlay { align-items: flex-end; }
        }
      `}</style>

      <div className="comm-page">
        <div className="comm-container">
          <div className="comm-header">
            <h1 className="comm-title">{t('comm.title')}</h1>
            <p className="comm-subtitle">{t('comm.subtitle')}</p>
          </div>

          <div className="comm-main">
            <div className="comm-search">
              <svg className="comm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                className="comm-search-input"
                placeholder={t('comm.searchPlaceholder')}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              />
              {searchInput && (
                <button className="comm-search-clear" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>×</button>
              )}
            </div>

            <div className="comm-cats">
              {CATEGORIES.map(cat => (
                <button key={cat.key} className={`comm-cat-btn${category === cat.key ? ' active' : ''}`} onClick={() => { setCategory(cat.key); setPage(1) }}>
                  {t(cat.tKey)}
                </button>
              ))}
            </div>

            {search && !loading && (
              <div className="comm-search-result">
                &lsquo;<strong>{search}</strong>&rsquo; {t('comm.searchResult', { count: totalCount })}
              </div>
            )}

            <div className="comm-toolbar">
              <div className="comm-sort">
                <button className={`comm-sort-btn${sort === 'recent' ? ' active' : ''}`} onClick={() => setSort('recent')}>{t('comm.latest')}</button>
                <button className={`comm-sort-btn${sort === 'popular' ? ' active' : ''}`} onClick={() => setSort('popular')}>{t('comm.popular')}</button>
              </div>
              <button className="comm-write-btn" onClick={handleWrite}>{t('comm.write')}</button>
            </div>

            {loading ? (
              <div className="comm-empty">{t('comm.loading')}</div>
            ) : posts.length === 0 ? (
              <div className="comm-empty">{t('comm.empty')}</div>
            ) : (
              <div className="comm-list">
                {posts.map(post => (
                    <Link key={post.id} href={`/community/${post.id}`} className="comm-row">
                      <span className="comm-row-cat">{getCatLabel(post.category)}</span>
                      <span className="comm-row-title">{post.title}</span>
                      <div className="comm-row-stats">
                        <span
                          className={`comm-row-stat${post.is_liked ? ' liked' : ''}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLike(post.id) }}
                        >
                          <svg viewBox="0 0 24 24" fill={post.is_liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                          {post.like_count || 0}
                        </span>
                        <span className="comm-row-stat">
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
            <div className="comm-sb-card">
              <h3 className="comm-sb-title">{t('comm.aboutTitle')}</h3>
              <p className="comm-sb-about">{t('comm.aboutDesc')}</p>
              <div className="comm-sb-guide">
                <div className="comm-sb-guide-item"><span className="comm-sb-guide-dot" />{t('comm.guideAnon')}</div>
                <div className="comm-sb-guide-item"><span className="comm-sb-guide-dot" />{t('comm.guideVerify')}</div>
                <div className="comm-sb-guide-item"><span className="comm-sb-guide-dot" />{t('comm.guideRespect')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showWrite && (
        <div className="comm-modal-overlay" onClick={() => setShowWrite(false)}>
          <div className="comm-modal" onClick={e => e.stopPropagation()}>
            <h2>{t('comm.writePost')}</h2>
            <div className="comm-modal-cats">
              {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                <button key={cat.key} className={`comm-modal-cat${writeCategory === cat.key ? ' active' : ''}`} onClick={() => setWriteCategory(cat.key)}>
                  {t(cat.tKey)}
                </button>
              ))}
            </div>
            <input className="comm-input" placeholder={t('comm.titlePlaceholder')} value={writeTitle} onChange={e => setWriteTitle(e.target.value)} maxLength={200} />
            <textarea className="comm-input comm-textarea" placeholder={t('comm.contentPlaceholder')} value={writeContent} onChange={e => setWriteContent(e.target.value)} />
            <div className="comm-modal-footer">
              <label className="comm-anon-toggle">
                <input type="checkbox" className="comm-anon-check" checked={writeAnonymous} onChange={e => setWriteAnonymous(e.target.checked)} />
                {t('comm.anonymous')}
              </label>
              <div>
                <button className="comm-cancel-btn" onClick={() => setShowWrite(false)}>{t('comm.cancel')}</button>
                <button className="comm-submit-btn" disabled={submitting || !writeTitle.trim() || !writeContent.trim()} onClick={submitPost}>
                  {submitting ? t('comm.posting') : t('comm.post')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
