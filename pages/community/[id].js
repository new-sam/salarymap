import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { EXCLUDED_EMAIL_DOMAINS } from '../../lib/admin-metrics'
import { track } from '../../lib/track'
import Badge from '../../components/Badge'
import TranslatableText from '../../components/TranslatableText'
import { useT } from '../../lib/i18n'
import { uploadCommunityImage } from '../../lib/communityImages'

function metaDescription(content) {
  return (content || '').replace(/\s+/g, ' ').trim().slice(0, 155)
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

export async function getServerSideProps({ params }) {
  const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: post } = await supabaseServer
    .from('community_posts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!post) return { notFound: true }

  // Index only real-user posts. Seed/team/banned authors stay noindex so Google
  // isn't fed thin/fake content. Resolving the author email needs the service role;
  // without it we default to noindex rather than risk indexing seed content.
  let indexable = false
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: u } = await supabaseServer.auth.admin.getUserById(post.user_id)
      const user = u?.user
      const banned = user?.banned_until && new Date(user.banned_until) > new Date()
      const internal = user?.email && EXCLUDED_EMAIL_DOMAINS.some((d) => user.email.endsWith('@' + d))
      indexable = !!user && !banned && !internal
    } catch { indexable = false }
  }

  return { props: { initialPost: post, indexable } }
}

export default function CommunityPostPage({ initialPost = null, indexable = false }) {
  const router = useRouter()
  const { id } = router.query
  const { t, lang } = useT()
  const [session, setSession] = useState(null)
  // 세션 확인 완료 여부. 확인 전엔 fetch를 미뤄 비로그인→로그인 이중 로드를 막는다.
  const [authReady, setAuthReady] = useState(false)
  const [post, setPost] = useState(initialPost)
  const [loading, setLoading] = useState(!initialPost)
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [commentAnonymous, setCommentAnonymous] = useState(true)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentImage, setCommentImage] = useState(null)
  const [commentUploading, setCommentUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [showPostMenu, setShowPostMenu] = useState(false)
  // Post title + body translate together under one toggle (see togglePostTranslate)
  const [postTrans, setPostTrans] = useState(null) // { title, content }
  const [showPostTrans, setShowPostTrans] = useState(false)
  const [postTransLoading, setPostTransLoading] = useState(false)
  const [postTransError, setPostTransError] = useState(false)
  const postMenuRef = React.useRef(null)
  const commentFileRef = React.useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    const handle = (e) => { if (postMenuRef.current && !postMenuRef.current.contains(e.target)) setShowPostMenu(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const viewCounted = React.useRef(false)

  useEffect(() => {
    if (!id || !authReady) return
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
  }, [id, session, authReady])

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

  const handleCommentFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !session) return
    setCommentUploading(true)
    try {
      const url = await uploadCommunityImage(file, session.user.id)
      setCommentImage(url)
    } catch (err) {
      console.error(err)
      alert(t('comm.imageError'))
    }
    setCommentUploading(false)
  }

  const submitComment = async () => {
    if ((!commentText.trim() && !commentImage) || !session || commentSubmitting) return
    setCommentSubmitting(true)
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ post_id: id, content: commentText.trim(), is_anonymous: commentAnonymous, image_url: commentImage })
      })
      if (res.ok) {
        const newComment = await res.json()
        setComments(prev => [...prev, newComment])
        setCommentText('')
        setCommentImage(null)
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

  const togglePostTranslate = async () => {
    if (showPostTrans) { setShowPostTrans(false); return }
    if (postTrans) { setShowPostTrans(true); return }
    if (!post) return
    setPostTransLoading(true)
    setPostTransError(false)
    try {
      const res = await fetch('/api/community/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [post.title, post.content], targetLang: lang })
      })
      const data = await res.json()
      if (res.ok && data.translated?.length === 2) {
        setPostTrans({ title: data.translated[0], content: data.translated[1] })
        setShowPostTrans(true)
      } else {
        setPostTransError(true)
      }
    } catch {
      setPostTransError(true)
    } finally {
      setPostTransLoading(false)
    }
  }

  const toggleCommentLike = async (commentId) => {
    if (!session) return
    try {
      const res = await fetch('/api/community/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ comment_id: commentId })
      })
      const { liked } = await res.json()
      setComments(prev => prev.map(c => c.id === commentId ? {
        ...c,
        is_liked: liked,
        like_count: liked ? (c.like_count || 0) + 1 : Math.max(0, (c.like_count || 0) - 1)
      } : c))
    } catch (e) { console.error(e) }
  }

  const [pollVoting, setPollVoting] = useState(false)
  const votePoll = async (choice) => {
    if (!post?.poll || pollVoting) return
    if (!session) { window.dispatchEvent(new CustomEvent('fyi-show-login')); return }
    if (post.poll.my_vote || new Date(post.poll.ends_at).getTime() <= Date.now()) return
    setPollVoting(true)
    try {
      const res = await fetch('/api/community/poll-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ poll_id: post.poll.id, choice })
      })
      const d = await res.json()
      if (res.ok || d.error === 'already_voted') {
        setPost(prev => ({ ...prev, poll: { ...prev.poll, my_vote: choice, votes_a: d.votes_a ?? prev.poll.votes_a, votes_b: d.votes_b ?? prev.poll.votes_b } }))
      }
    } catch (e) { console.error(e) }
    setPollVoting(false)
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

  // Pull the single most-liked comment to the top as the "Best" comment, like
  // 에브리타임 — but only once it has at least 5 likes. The rest stay chronological.
  const BEST_MIN_LIKES = 5
  const bestComment = comments.reduce(
    (best, c) => ((c.like_count || 0) > (best?.like_count || 0) ? c : best),
    null
  )
  const bestId = bestComment && (bestComment.like_count || 0) >= BEST_MIN_LIKES ? bestComment.id : null
  const orderedComments = bestId
    ? [comments.find(c => c.id === bestId), ...comments.filter(c => c.id !== bestId)]
    : comments

  return (
    <>
      <Head>
        <title>{post ? `${post.title} | FYI Community` : t('comm.title')}</title>
        {indexable && post ? (
          <>
            <meta name="description" content={metaDescription(post.content)} />
            <link rel="canonical" href={`https://salary-fyi.com/community/${post.id}`} />
            <meta property="og:type" content="article" />
            <meta property="og:title" content={post.title} />
            <meta property="og:description" content={metaDescription(post.content)} />
            <meta property="og:url" content={`https://salary-fyi.com/community/${post.id}`} />
          </>
        ) : (
          <meta name="robots" content="noindex" />
        )}
      </Head>

      <style>{`
        .cp-page { background: #fff; min-height: 100vh; }
        .cp-outer { max-width: 1080px; margin: 0 auto; padding: 64px 40px 60px; display: grid; grid-template-columns: 1fr 300px; gap: 32px; font-family:inherit; }
        .cp-container { min-width: 0; }
        .cp-loading { text-align: center; padding: 80px 0; color: #999; font-size: 14px; }

        .cp-breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #888; margin-bottom: 24px; }
        .cp-breadcrumb a { color: #888; text-decoration: none; transition: color 0.15s; }
        .cp-breadcrumb a:hover { color: #111; }
        .cp-breadcrumb-sep { color: #ccc; font-size: 11px; }

        .cp-title { font-size: 26px; font-weight: 800; color: #111; margin: 0 0 12px; line-height: 1.35; }
        .cp-author-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .cp-company { font-size: 14px; color: var(--sm-accent); font-weight: 700; }
        .cp-company-link { cursor: pointer; }
        .cp-company-link:hover { text-decoration: underline; }
        .cp-dot { color: #ccc; font-size: 12px; }
        .cp-nickname { font-size: 13px; color: #888; font-weight: 400; }
        .cp-info-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #999; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .cp-content { font-size: 15px; color: #333; line-height: 1.85; white-space: pre-wrap; word-break: break-word; margin-bottom: 28px; }
        .cp-images { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 28px; }
        .cp-images.single { grid-template-columns: 1fr; }
        .cp-images img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid #eee; cursor: zoom-in; }
        .cp-images.single img { width: auto; max-width: 100%; max-height: 600px; }
        .cp-comment-image { margin-top: 8px; }
        .cp-comment-image img { max-width: 220px; max-height: 220px; border-radius: 8px; border: 1px solid #eee; cursor: zoom-in; display: block; }
        .cp-cimg-preview { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; border: 1px solid #eee; flex-shrink: 0; }
        .cp-cimg-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cp-cimg-x { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,0.6); color: #fff; font-size: 12px; line-height: 1; cursor: pointer; padding: 0; }
        .cp-attach { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #ddd; background: #fff; color: #888; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cp-attach:hover { border-color: var(--sm-accent); color: var(--sm-accent); }
        .cp-attach:disabled { opacity: 0.4; cursor: default; }
        .cp-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; cursor: zoom-out; }
        .cp-lightbox img { max-width: 95vw; max-height: 92vh; object-fit: contain; border-radius: 6px; }
        .cp-spin { animation: cp-spin 0.8s linear infinite; }
        @keyframes cp-spin { to { transform: rotate(360deg); } }

        .cp-poll { border: 1px solid #ffd9c2; background: #fff8f3; border-radius: 14px; padding: 18px; margin-bottom: 28px; }
        .cp-poll-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .cp-poll-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; color: var(--sm-accent); }
        .cp-poll-time { font-size: 12px; font-weight: 600; color: #999; }
        .cp-poll-vote { display: flex; align-items: stretch; gap: 10px; }
        .cp-poll-btn { flex: 1; padding: 18px 14px; border-radius: 12px; border: 2px solid #ffcdb0; background: #fff; color: #333; font-size: 15px; font-weight: 700; cursor: pointer; font-family:inherit; transition: all 0.15s; word-break: break-word; }
        .cp-poll-btn:hover:not(:disabled) { border-color: var(--sm-accent); background: #fff1e8; color: var(--sm-accent); }
        .cp-poll-btn:disabled { opacity: 0.6; cursor: default; }
        .cp-poll-vs { display: flex; align-items: center; font-size: 13px; font-weight: 800; color: var(--sm-accent); flex-shrink: 0; }
        .cp-poll-results { display: flex; flex-direction: column; gap: 10px; }
        .cp-poll-res { position: relative; border-radius: 10px; border: 1px solid #eee; background: #fff; overflow: hidden; }
        .cp-poll-res.lead { border-color: var(--sm-accent); }
        .cp-poll-res.mine { box-shadow: 0 0 0 2px var(--sm-accent) inset; }
        .cp-poll-res-fill { position: absolute; inset: 0 auto 0 0; background: #ffe2d1; transition: width 0.5s ease; }
        .cp-poll-res.lead .cp-poll-res-fill { background: #ffd0b3; }
        .cp-poll-res-row { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; }
        .cp-poll-res-label { font-size: 14px; font-weight: 700; color: #333; word-break: break-word; }
        .cp-poll-res-pct { font-size: 15px; font-weight: 800; color: var(--sm-accent); flex-shrink: 0; margin-left: 10px; }
        .cp-poll-total { font-size: 12px; color: #999; margin-top: 12px; text-align: right; }
        .cp-actions { display: flex; gap: 12px; padding: 14px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; margin-bottom: 32px; }
        .cp-action { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: none; background: transparent; color: #888; font-size: 13px; font-weight: 600; cursor: pointer; font-family:inherit; transition: all 0.15s; }
        .cp-action:hover { background: #f5f5f5; color: #111; }
        .cp-action.liked { color: var(--sm-accent); }
        .cp-action svg { width: 18px; height: 18px; }
        .cp-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .cp-more-wrap { position: relative; flex-shrink: 0; }
        .cp-more-btn { background: none; border: none; cursor: pointer; padding: 4px; color: #999; display: flex; align-items: center; }
        .cp-more-btn:hover { color: #555; }
        .cp-more-menu { position: absolute; top: 100%; right: 0; background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 4px; min-width: 120px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); z-index: 10; }
        .cp-more-item { display: block; width: 100%; padding: 10px 14px; border: none; background: none; color: #333; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; border-radius: 6px; font-family:inherit; }
        .cp-more-item:hover { background: #f5f5f5; }
        .cp-more-item.danger { color: #ef4444; }
        .cp-more-item.danger:hover { background: #fef2f2; }

        .cp-comments-title { font-size: 15px; font-weight: 700; color: #555; margin-bottom: 16px; }
        .cp-comment { padding: 14px 0; border-bottom: 1px solid #f0f0f0; }
        .cp-comment-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .cp-comment-author { font-size: 13px; font-weight: 400; color: #888; display: flex; align-items: center; gap: 5px; }
        .cp-comment-author .cp-company { font-size: 13px; color: var(--sm-accent); font-weight: 700; }
        .cp-op-badge { font-size: 10px; font-weight: 700; color: var(--sm-accent); background: #fff1e8; border: 1px solid #ffd4b8; border-radius: 4px; padding: 1px 5px; margin-left: 2px; line-height: 1.4; }
        .cp-comment-time { font-size: 11px; color: #bbb; }
        .cp-comment-body { font-size: 14px; color: #444; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
        .cp-translate-btn { background: none; border: none; padding: 0; margin-top: 6px; font-size: 12px; color: #888; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        .cp-translate-btn:hover:not(:disabled) { color: #555; }
        .cp-translate-btn:disabled { cursor: default; opacity: 0.7; }
        .cp-content:has(+ .cp-translate-post) { margin-bottom: 6px; }
        .cp-translate-post { margin-bottom: 28px; }
        .cp-comment.best { background: #fff8f3; border: 1px solid #ffe0cc; border-radius: 10px; padding: 14px; }
        .cp-best-badge { font-size: 10px; font-weight: 800; color: #fff; background: var(--sm-accent); border-radius: 4px; padding: 2px 6px; letter-spacing: 0.5px; line-height: 1.4; flex-shrink: 0; }
        .cp-comment-actions { margin-top: 8px; }
        .cp-clike { display: inline-flex; align-items: center; gap: 4px; padding: 4px 0; background: none; border: none; color: #aaa; font-size: 12px; font-weight: 600; cursor: pointer; font-family:inherit; transition: color 0.15s; }
        .cp-clike:hover { color: var(--sm-accent); }
        .cp-clike.liked { color: var(--sm-accent); }
        .cp-clike:disabled { cursor: default; }
        .cp-clike svg { width: 14px; height: 14px; }
        .cp-comment-delete { margin-left: auto; font-size: 11px; color: #bbb; background: none; border: none; cursor: pointer; font-family:inherit; }
        .cp-comment-delete:hover { color: #ef4444; }
        .cp-no-comments { color: #bbb; font-size: 13px; padding: 24px 0; text-align: center; }

        .cp-input-box { background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 14px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }
        .cp-input-row { display: flex; gap: 10px; align-items: center; }
        .cp-anon { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #888; white-space: nowrap; cursor: pointer; }
        .cp-anon input { width: 14px; height: 14px; accent-color: var(--sm-accent); }
        .cp-comment-input { flex: 1; padding: 10px 16px; border-radius: 8px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 14px; font-family:inherit; outline: none; }
        .cp-comment-input:focus { border-color: var(--sm-accent); }
        .cp-send { width: 36px; height: 36px; border-radius: 50%; border: none; background: var(--sm-accent); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cp-send:disabled { opacity: 0.3; }

        .cp-sidebar { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 80px; align-self: start; }
        .cp-sb-card { background: #fafafa; border: 1px solid #eee; border-radius: 12px; padding: 20px; }
        .cp-sb-title { font-size: 14px; font-weight: 700; color: #333; margin: 0 0 14px; }
        .cp-sb-about { font-size: 13px; color: #777; line-height: 1.6; margin-bottom: 14px; }
        .cp-sb-guide { display: flex; flex-direction: column; gap: 8px; }
        .cp-sb-guide-item { font-size: 12px; color: #666; display: flex; align-items: flex-start; gap: 6px; line-height: 1.4; }
        .cp-sb-guide-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--sm-accent); margin-top: 5px; flex-shrink: 0; }
        @media (max-width: 768px) {
          .cp-outer { grid-template-columns: 1fr; padding: 56px 14px 90px; gap: 16px; }
          .cp-sidebar { position: static; }
          .cp-title { font-size: 22px; }
        }
      `}</style>

      <div className="cp-page">
        <div className="cp-outer">
          <div className="cp-container">
            {!post && loading ? (
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
                  <h1 className="cp-title" style={{ margin: 0 }}>{showPostTrans && postTrans ? postTrans.title : post.title}</h1>
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
                  {(post.author_verified_company || post.author_company) ? (
                    <span
                      className="cp-company cp-company-link"
                      onClick={() => router.push(`/companies/${encodeURIComponent(post.author_verified_company || post.author_company)}`)}
                    >{post.author_verified_company || post.author_company}</span>
                  ) : (
                    <span className="cp-company">{t('comm.unemployed')}</span>
                  )}
                  <span className="cp-dot">·</span>
                  <span className="cp-nickname">{post.author_name}</span>
                  {post.author_badge && <Badge keyName={post.author_badge} t={t} variant="pill" />}
                </div>
                <div className="cp-info-row">
                  <span>{timeAgo(post.created_at)}</span>
                  <span className="cp-dot">·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> {post.view_count || 0}</span>
                  <span className="cp-dot">·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> {post.comment_count || 0}</span>
                </div>
                <div className="cp-content">{showPostTrans && postTrans ? postTrans.content : post.content}</div>
                <button className="cp-translate-btn cp-translate-post" onClick={togglePostTranslate} disabled={postTransLoading}>
                  {postTransLoading ? t('comm.translating')
                    : postTransError ? t('comm.translateError')
                    : showPostTrans ? t('comm.viewOriginal')
                    : t('comm.viewTranslation')}
                </button>

                {post.poll && (() => {
                  const { option_a, option_b, votes_a, votes_b, my_vote, ends_at } = post.poll
                  const timeLeft = pollTimeLeft(ends_at)
                  const ended = !timeLeft
                  const showResults = ended || !!my_vote
                  const total = votes_a + votes_b
                  const pctA = total ? Math.round((votes_a / total) * 100) : 0
                  const pctB = total ? 100 - pctA : 0
                  const leadA = votes_a >= votes_b
                  return (
                    <div className="cp-poll">
                      <div className="cp-poll-head">
                        <span className="cp-poll-tag">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 20V10M12 20V4M20 20v-6"/></svg>
                          {t('comm.pollBattle')}
                        </span>
                        <span className="cp-poll-time">{ended ? t('comm.pollEnded') : t('comm.pollEndsIn', { time: timeLeft })}</span>
                      </div>
                      {showResults ? (
                        <div className="cp-poll-results">
                          {[{ k: 'a', label: option_a, pct: pctA, votes: votes_a, lead: leadA }, { k: 'b', label: option_b, pct: pctB, votes: votes_b, lead: !leadA }].map(o => (
                            <div key={o.k} className={`cp-poll-res${my_vote === o.k ? ' mine' : ''}${total && o.lead ? ' lead' : ''}`}>
                              <div className="cp-poll-res-fill" style={{ width: `${o.pct}%` }} />
                              <div className="cp-poll-res-row">
                                <span className="cp-poll-res-label">{o.label}{my_vote === o.k && ' ✓'}</span>
                                <span className="cp-poll-res-pct">{o.pct}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="cp-poll-vote">
                          <button className="cp-poll-btn a" disabled={pollVoting} onClick={() => votePoll('a')}>{option_a}</button>
                          <span className="cp-poll-vs">VS</span>
                          <button className="cp-poll-btn b" disabled={pollVoting} onClick={() => votePoll('b')}>{option_b}</button>
                        </div>
                      )}
                      <div className="cp-poll-total">{t('comm.pollTotal', { n: total })}</div>
                    </div>
                  )
                })()}

                {post.image_urls?.length > 0 && (
                  <div className={`cp-images${post.image_urls.length === 1 ? ' single' : ''}`}>
                    {post.image_urls.map(url => (
                      <img key={url} src={url} alt="" onClick={() => setLightbox(url)} />
                    ))}
                  </div>
                )}

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
                      {commentImage && (
                        <div className="cp-cimg-preview">
                          <img src={commentImage} alt="" />
                          <button className="cp-cimg-x" onClick={() => setCommentImage(null)}>×</button>
                        </div>
                      )}
                      <input
                        className="cp-comment-input"
                        placeholder={t('comm.commentPlaceholder')}
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitComment() }}
                      />
                      <input ref={commentFileRef} type="file" accept="image/*" hidden onChange={handleCommentFile} />
                      <button className="cp-attach" disabled={commentUploading || !!commentImage} onClick={() => commentFileRef.current?.click()} title={t('comm.addImage')}>
                        {commentUploading ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cp-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        )}
                      </button>
                      <button className="cp-send" disabled={(!commentText.trim() && !commentImage) || commentSubmitting || commentUploading} onClick={submitComment}>
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
                  orderedComments.map(comment => (
                    <div key={comment.id} className={`cp-comment${comment.id === bestId ? ' best' : ''}`}>
                      <div className="cp-comment-top">
                        {comment.id === bestId && <span className="cp-best-badge">{t('comm.bestBadge')}</span>}
                        <span className="cp-comment-author">
                          <span className="cp-company">{comment.author_verified_company || comment.author_company || t('comm.unemployed')}</span>
                          <span className="cp-dot">·</span>
                          {comment.author_name}
                          {comment.author_badge && <Badge keyName={comment.author_badge} t={t} variant="pill" />}
                          {comment.is_op && <span className="cp-op-badge">{t('comm.opBadge')}</span>}
                        </span>
                        <span className="cp-comment-time">{timeAgo(comment.created_at)}</span>
                        {session?.user?.id === comment.user_id && (
                          <button className="cp-comment-delete" onClick={() => deleteComment(comment.id)}>{t('comm.delete')}</button>
                        )}
                      </div>
                      {comment.content && <TranslatableText text={comment.content} className="cp-comment-body" />}
                      {comment.image_url && (
                        <div className="cp-comment-image">
                          <img src={comment.image_url} alt="" onClick={() => setLightbox(comment.image_url)} />
                        </div>
                      )}
                      <div className="cp-comment-actions">
                        <button
                          className={`cp-clike${comment.is_liked ? ' liked' : ''}`}
                          onClick={() => toggleCommentLike(comment.id)}
                          disabled={!session}
                        >
                          <svg viewBox="0 0 24 24" fill={comment.is_liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                          {comment.like_count || 0}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {lightbox && (
        <div className="cp-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
