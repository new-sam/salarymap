import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { track } from '../../lib/track'
import GlobalNav from '../../components/GlobalNav'
import SalaryBadge from '../../components/SalaryBadge'
import { useT } from '../../lib/i18n'

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

const CATEGORY_LABELS = {
  ask_company: 'comm.askCompany',
  daily: 'comm.daily',
  job_change: 'comm.jobChange',
}

const CATEGORY_COLORS = {
  ask_company: '#3b82f6',
  daily: '#10b981',
  job_change: '#8b5cf6',
}

export default function CommunityPostPage() {
  const router = useRouter()
  const { id } = router.query
  const { t } = useT()
  const [session, setSession] = useState(null)
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [commentAnonymous, setCommentAnonymous] = useState(true)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [showPostMenu, setShowPostMenu] = useState(false)
  const postMenuRef = React.useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
    })
  }, [])

  useEffect(() => {
    const handle = (e) => { if (postMenuRef.current && !postMenuRef.current.contains(e.target)) setShowPostMenu(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const viewCounted = React.useRef(false)

  useEffect(() => {
    if (!id) return
    const firstView = !viewCounted.current
    fetchPost(firstView)
    viewCounted.current = true
    fetchComments()
    if (firstView) track('view_community_post', { meta: { post_id: id }, page: '/community/[id]' })
    // Mark this post as read so the list dims it
    try {
      const read = new Set(JSON.parse(localStorage.getItem('comm_read_posts') || '[]'))
      if (!read.has(id)) {
        read.add(id)
        localStorage.setItem('comm_read_posts', JSON.stringify([...read]))
      }
    } catch {}
  }, [id, session])

  const fetchPost = async (countView = false) => {
    setLoading(true)
    try {
      const headers = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const res = await fetch(`/api/community/posts?id=${id}${countView ? '&view=1' : ''}`, { headers })
      const data = await res.json()
      if (data.post) setPost(data.post)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const fetchComments = async () => {
    setLoadingComments(true)
    try {
      const headers = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const res = await fetch(`/api/community/comments?post_id=${id}`, { headers })
      const data = await res.json()
      setComments(data.comments || [])
    } catch (e) { console.error(e) }
    setLoadingComments(false)
  }

  const submitComment = async () => {
    if (!commentText.trim() || !session || commentSubmitting) return
    setCommentSubmitting(true)
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ post_id: id, content: commentText.trim(), is_anonymous: commentAnonymous })
      })
      if (res.ok) {
        const newComment = await res.json()
        setComments(prev => [...prev, newComment])
        setCommentText('')
        setPost(prev => prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev)
      }
    } catch (e) { console.error(e) }
    setCommentSubmitting(false)
  }

  const deleteComment = async (commentId) => {
    if (!confirm(t('comm.deleteConfirm'))) return
    try {
      const res = await fetch(`/api/community/comments?id=${commentId}&post_id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId))
        setPost(prev => prev ? { ...prev, comment_count: Math.max(0, (prev.comment_count || 0) - 1) } : prev)
      }
    } catch (e) { console.error(e) }
  }

  const toggleLike = async () => {
    if (!session || !post) return
    try {
      const res = await fetch('/api/community/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ post_id: post.id })
      })
      const { liked } = await res.json()
      setPost(prev => ({
        ...prev,
        is_liked: liked,
        like_count: liked ? (prev.like_count || 0) + 1 : Math.max(0, (prev.like_count || 0) - 1)
      }))
    } catch (e) { console.error(e) }
  }

  const deletePost = async () => {
    if (!confirm(t('comm.deleteConfirm'))) return
    try {
      await fetch(`/api/community/posts?id=${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      router.push('/community')
    } catch (e) { console.error(e) }
  }

  const catColor = post ? CATEGORY_COLORS[post.category] : null
  const catLabel = post && CATEGORY_LABELS[post.category] ? t(CATEGORY_LABELS[post.category]) : ''

  return (
    <>
      <Head><title>{post ? post.title : t('comm.title')}</title><meta name="robots" content="noindex" /></Head>
      <GlobalNav activePage="community" />

      <style>{`
        .cp-page { background: #fff; min-height: 100vh; }
        .cp-outer { max-width: 1080px; margin: 0 auto; padding: 64px 40px 60px; display: grid; grid-template-columns: 1fr 300px; gap: 32px; font-family: 'Barlow', sans-serif; }
        .cp-container { min-width: 0; }
        .cp-loading { text-align: center; padding: 80px 0; color: #999; font-size: 14px; }

        .cp-breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #888; margin-bottom: 24px; }
        .cp-breadcrumb a { color: #888; text-decoration: none; transition: color 0.15s; }
        .cp-breadcrumb a:hover { color: #111; }
        .cp-breadcrumb-sep { color: #ccc; font-size: 11px; }

        .cp-title { font-size: 26px; font-weight: 800; color: #111; margin: 0 0 12px; line-height: 1.35; }
        .cp-author-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .cp-company { font-size: 14px; color: #ff6000; font-weight: 700; }
        .cp-dot { color: #ccc; font-size: 12px; }
        .cp-nickname { font-size: 13px; color: #888; font-weight: 400; }
        .cp-info-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #999; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .cp-content { font-size: 15px; color: #333; line-height: 1.85; white-space: pre-wrap; word-break: break-word; margin-bottom: 28px; }

        .cp-actions { display: flex; gap: 12px; padding: 14px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; margin-bottom: 32px; }
        .cp-action { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: none; background: transparent; color: #888; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .cp-action:hover { background: #f5f5f5; color: #111; }
        .cp-action.liked { color: #ff6000; }
        .cp-action svg { width: 18px; height: 18px; }
        .cp-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .cp-more-wrap { position: relative; flex-shrink: 0; }
        .cp-more-btn { background: none; border: none; cursor: pointer; padding: 4px; color: #999; display: flex; align-items: center; }
        .cp-more-btn:hover { color: #555; }
        .cp-more-menu { position: absolute; top: 100%; right: 0; background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 4px; min-width: 120px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); z-index: 10; }
        .cp-more-item { display: block; width: 100%; padding: 10px 14px; border: none; background: none; color: #333; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; border-radius: 6px; font-family: 'Barlow', sans-serif; }
        .cp-more-item:hover { background: #f5f5f5; }
        .cp-more-item.danger { color: #ef4444; }
        .cp-more-item.danger:hover { background: #fef2f2; }

        .cp-comments-title { font-size: 15px; font-weight: 700; color: #555; margin-bottom: 16px; }
        .cp-comment { padding: 14px 0; border-bottom: 1px solid #f0f0f0; }
        .cp-comment-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .cp-comment-author { font-size: 13px; font-weight: 400; color: #888; display: flex; align-items: center; gap: 5px; }
        .cp-comment-author .cp-company { font-size: 13px; color: #ff6000; font-weight: 700; }
        .cp-op-badge { font-size: 10px; font-weight: 700; color: #ff6000; background: #fff1e8; border: 1px solid #ffd4b8; border-radius: 4px; padding: 1px 5px; margin-left: 2px; line-height: 1.4; }
        .cp-comment-time { font-size: 11px; color: #bbb; }
        .cp-comment-body { font-size: 14px; color: #444; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
        .cp-comment-delete { margin-left: auto; font-size: 11px; color: #bbb; background: none; border: none; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .cp-comment-delete:hover { color: #ef4444; }
        .cp-no-comments { color: #bbb; font-size: 13px; padding: 24px 0; text-align: center; }

        .cp-input-box { background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 14px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }
        .cp-input-row { display: flex; gap: 10px; align-items: center; }
        .cp-anon { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #888; white-space: nowrap; cursor: pointer; }
        .cp-anon input { width: 14px; height: 14px; accent-color: #ff6000; }
        .cp-comment-input { flex: 1; padding: 10px 16px; border-radius: 8px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 14px; font-family: 'Barlow', sans-serif; outline: none; }
        .cp-comment-input:focus { border-color: #ff6000; }
        .cp-send { width: 36px; height: 36px; border-radius: 50%; border: none; background: #ff6000; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cp-send:disabled { opacity: 0.3; }

        .cp-sidebar { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 80px; align-self: start; }
        .cp-sb-card { background: #fafafa; border: 1px solid #eee; border-radius: 12px; padding: 20px; }
        .cp-sb-title { font-size: 14px; font-weight: 700; color: #333; margin: 0 0 14px; }
        .cp-sb-about { font-size: 13px; color: #777; line-height: 1.6; margin-bottom: 14px; }
        .cp-sb-guide { display: flex; flex-direction: column; gap: 8px; }
        .cp-sb-guide-item { font-size: 12px; color: #666; display: flex; align-items: flex-start; gap: 6px; line-height: 1.4; }
        .cp-sb-guide-dot { width: 4px; height: 4px; border-radius: 50%; background: #ff6000; margin-top: 5px; flex-shrink: 0; }
        @media (max-width: 768px) {
          .cp-outer { grid-template-columns: 1fr; padding: 56px 14px 90px; gap: 16px; }
          .cp-sidebar { position: static; }
          .cp-title { font-size: 22px; }
        }
      `}</style>

      <div className="cp-page">
        <div className="cp-outer">
          <div className="cp-container">
            {loading ? (
              <div className="cp-loading">{t('comm.loading')}</div>
            ) : !post ? (
              <div className="cp-loading">Post not found</div>
            ) : (
              <>
                <div className="cp-breadcrumb">
                  <Link href="/community">{t('comm.title')}</Link>
                  <span className="cp-breadcrumb-sep">{'>'}</span>
                  <span style={{ color: catColor }}>{catLabel}</span>
                </div>

                <div className="cp-title-row">
                  <h1 className="cp-title" style={{ margin: 0 }}>{post.title}</h1>
                  {session?.user?.id === post.user_id && (
                    <div className="cp-more-wrap" ref={postMenuRef}>
                      <button className="cp-more-btn" onClick={() => setShowPostMenu(v => !v)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </button>
                      {showPostMenu && (
                        <div className="cp-more-menu">
                          <button className="cp-more-item" onClick={() => { setShowPostMenu(false); router.push(`/community/edit?id=${post.id}`) }}>{t('comm.edit')}</button>
                          <button className="cp-more-item danger" onClick={() => { setShowPostMenu(false); deletePost() }}>{t('comm.deletePost')}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="cp-author-row">
                  <span className="cp-company">{post.author_verified_company || t('comm.unemployed')}</span>
                  <span className="cp-dot">·</span>
                  <span className="cp-nickname">{post.author_name}</span>
                  {post.author_salary_tier && <SalaryBadge tierKey={post.author_salary_tier} t={t} />}
                </div>
                <div className="cp-info-row">
                  <span>{timeAgo(post.created_at)}</span>
                  <span className="cp-dot">·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> {post.view_count || 0}</span>
                  <span className="cp-dot">·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> {post.comment_count || 0}</span>
                </div>
                <div className="cp-content">{post.content}</div>

                <div className="cp-actions">
                  <button className={`cp-action${post.is_liked ? ' liked' : ''}`} onClick={toggleLike}>
                    <svg viewBox="0 0 24 24" fill={post.is_liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    {post.like_count || 0} {t('comm.likes')}
                  </button>
                  <span className="cp-action" style={{ cursor: 'default' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    {post.comment_count || 0} {t('comm.comments')}
                  </span>
                </div>

                <div className="cp-comments-title">{t('comm.comments')} ({post.comment_count || 0})</div>

                {session && (
                  <div className="cp-input-box">
                    <label className="cp-anon">
                      <input type="checkbox" checked={commentAnonymous} onChange={e => setCommentAnonymous(e.target.checked)} />
                      {t('comm.anon')}
                    </label>
                    <div className="cp-input-row">
                      <input
                        className="cp-comment-input"
                        placeholder={t('comm.commentPlaceholder')}
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitComment() }}
                      />
                      <button className="cp-send" disabled={!commentText.trim() || commentSubmitting} onClick={submitComment}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                      </button>
                    </div>
                  </div>
                )}

                {loadingComments ? (
                  <div className="cp-no-comments">{t('comm.loadingComments')}</div>
                ) : comments.length === 0 ? (
                  <div className="cp-no-comments">{t('comm.noComments')}</div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="cp-comment">
                      <div className="cp-comment-top">
                        <span className="cp-comment-author">
                          <span className="cp-company">{comment.author_verified_company || t('comm.unemployed')}</span>
                          <span className="cp-dot">·</span>
                          {comment.author_name}
                          {comment.author_salary_tier && <SalaryBadge tierKey={comment.author_salary_tier} t={t} />}
                          {comment.is_op && <span className="cp-op-badge">{t('comm.opBadge')}</span>}
                        </span>
                        <span className="cp-comment-time">{timeAgo(comment.created_at)}</span>
                        {session?.user?.id === comment.user_id && (
                          <button className="cp-comment-delete" onClick={() => deleteComment(comment.id)}>{t('comm.delete')}</button>
                        )}
                      </div>
                      <div className="cp-comment-body">{comment.content}</div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
