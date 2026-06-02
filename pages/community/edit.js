import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useAdminGuard } from '../../lib/useAdminGuard'
import GlobalNav from '../../components/GlobalNav'
import { useT } from '../../lib/i18n'

const CATEGORIES = [
  { key: 'ask_company', tKey: 'comm.askCompany' },
  { key: 'daily', tKey: 'comm.daily' },
  { key: 'job_change', tKey: 'comm.jobChange' },
]

export default function CommunityEditPage() {
  const router = useRouter()
  const { id } = router.query
  const { t } = useT()
  const { checking } = useAdminGuard()
  const [session, setSession] = useState(null)
  const [category, setCategory] = useState('ask_company')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orig, setOrig] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      // Logged-out / non-admin redirect is handled by useAdminGuard.
      if (s) setSession(s)
    })
  }, [])

  useEffect(() => {
    if (!id || !session) return
    fetch(`/api/community/posts?id=${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.post) {
          if (d.post.user_id !== session.user.id) {
            router.replace(`/community/${id}`)
            return
          }
          setCategory(d.post.category)
          setTitle(d.post.title)
          setContent(d.post.content)
          setOrig({ category: d.post.category, title: d.post.title, content: d.post.content })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, session])

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !session || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/community/posts?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ category, title: title.trim(), content: content.trim() })
      })
      if (res.ok) {
        router.push(`/community/${id}`)
      }
    } catch (e) { console.error(e) }
    setSubmitting(false)
  }

  if (checking) {
    return (
      <>
        <GlobalNav activePage="community" />
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>Loading...</div>
      </>
    )
  }

  return (
    <>
      <Head><title>{t('comm.edit')}</title></Head>
      <GlobalNav activePage="community" />

      <style>{`
        .cw-page { background: #fff; min-height: 100vh; }
        .cw-container { max-width: 640px; margin: 0 auto; padding: 64px 24px 60px; }
        .cw-back { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #888; background: none; border: none; cursor: pointer; font-family: 'Barlow', sans-serif; padding: 0; margin-bottom: 16px; }
        .cw-back:hover { color: #555; }
        .cw-title { font-size: 22px; font-weight: 800; color: #111; margin: 0 0 24px; font-family: 'Barlow', sans-serif; }
        .cw-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
        .cw-cat { padding: 8px 18px; border-radius: 20px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .cw-cat.active { background: #ff6000; border-color: #ff6000; color: #fff; }
        .cw-input { width: 100%; padding: 14px 16px; border-radius: 10px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 15px; font-family: 'Barlow', sans-serif; margin-bottom: 12px; outline: none; box-sizing: border-box; transition: border-color 0.15s; }
        .cw-input:focus { border-color: #ff6000; }
        .cw-textarea { min-height: 200px; resize: vertical; line-height: 1.6; }
        .cw-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
        .cw-submit { padding: 12px 32px; border-radius: 10px; border: none; background: #ff6000; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .cw-submit:hover { background: #ff7a1a; }
        .cw-submit:disabled { opacity: 0.4; cursor: default; }
        .cw-loading { text-align: center; padding: 80px 20px; color: #bbb; font-size: 14px; }
        @media (max-width: 768px) {
          .cw-container { padding: 56px 16px 90px; }
        }
      `}</style>

      <div className="cw-page">
        <div className="cw-container">
          <button className="cw-back" onClick={() => router.back()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            {t('comm.back')}
          </button>
          <h1 className="cw-title">{t('comm.edit')}</h1>

          {loading ? (
            <div className="cw-loading">{t('comm.loading')}</div>
          ) : (
            <>
              <div className="cw-cats">
                {CATEGORIES.map(cat => (
                  <button key={cat.key} className={`cw-cat${category === cat.key ? ' active' : ''}`} onClick={() => setCategory(cat.key)}>
                    {t(cat.tKey)}
                  </button>
                ))}
              </div>

              <input className="cw-input" placeholder={t('comm.titlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
              <textarea className="cw-input cw-textarea" placeholder={t('comm.contentPlaceholder')} value={content} onChange={e => setContent(e.target.value)} />

              <div className="cw-footer">
                <button className="cw-submit" disabled={submitting || !title.trim() || !content.trim() || (orig && category === orig.category && title === orig.title && content === orig.content)} onClick={handleSubmit}>
                  {submitting ? t('comm.posting') : t('comm.edit')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
