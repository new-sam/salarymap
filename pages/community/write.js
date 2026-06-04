import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useLoginGuard } from '../../lib/useLoginGuard'
import GlobalNav from '../../components/GlobalNav'
import { useT } from '../../lib/i18n'
import { uploadCommunityImage, MAX_POST_IMAGES } from '../../lib/communityImages'

const CATEGORIES = [
  { key: 'ask_company', tKey: 'comm.askCompany' },
  { key: 'daily', tKey: 'comm.daily' },
  { key: 'job_change', tKey: 'comm.jobChange' },
]

export default function CommunityWritePage() {
  const router = useRouter()
  const { t } = useT()
  const { checking } = useLoginGuard()
  const [session, setSession] = useState(null)
  const [category, setCategory] = useState('ask_company')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      // Logged-out redirect is handled by useLoginGuard.
      if (s) setSession(s)
    })
  }, [])

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length || !session) return
    const slots = MAX_POST_IMAGES - images.length
    if (slots <= 0) { alert(t('comm.imageLimit', { n: MAX_POST_IMAGES })); return }
    setUploading(true)
    try {
      for (const file of files.slice(0, slots)) {
        const url = await uploadCommunityImage(file, session.user.id)
        setImages(prev => [...prev, url])
      }
      if (files.length > slots) alert(t('comm.imageLimit', { n: MAX_POST_IMAGES }))
    } catch (err) {
      console.error(err)
      alert(t('comm.imageError'))
    }
    setUploading(false)
  }

  const removeImage = (url) => setImages(prev => prev.filter(u => u !== url))

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !session || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ category, title: title.trim(), content: content.trim(), is_anonymous: anonymous, image_urls: images })
      })
      if (res.ok) {
        router.push('/community')
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
      <Head><title>{t('comm.writePost')}</title></Head>
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
        .cw-imgs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
        .cw-thumb { position: relative; width: 88px; height: 88px; border-radius: 10px; overflow: hidden; border: 1px solid #eee; }
        .cw-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cw-thumb-x { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; border: none; background: rgba(0,0,0,0.6); color: #fff; font-size: 14px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
        .cw-add-img { width: 88px; height: 88px; border-radius: 10px; border: 1px dashed #ccc; background: #fafafa; color: #999; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; font-family: 'Barlow', sans-serif; }
        .cw-add-img:hover { border-color: #ff6000; color: #ff6000; }
        .cw-add-img:disabled { opacity: 0.5; cursor: default; }
        .cw-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
        .cw-anon { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; cursor: pointer; }
        .cw-anon input { width: 18px; height: 18px; accent-color: #ff6000; }
        .cw-submit { padding: 12px 32px; border-radius: 10px; border: none; background: #ff6000; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; transition: all 0.15s; }
        .cw-submit:hover { background: #ff7a1a; }
        .cw-submit:disabled { opacity: 0.4; cursor: default; }
        @media (max-width: 768px) {
          .cw-container { padding: 56px 16px 90px; }
        }
      `}</style>

      <div className="cw-page">
        <div className="cw-container">
          <button className="cw-back" onClick={() => router.back()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            {t('comm.back') || '뒤로'}
          </button>
          <h1 className="cw-title">{t('comm.writePost')}</h1>

          <div className="cw-cats">
            {CATEGORIES.map(cat => (
              <button key={cat.key} className={`cw-cat${category === cat.key ? ' active' : ''}`} onClick={() => setCategory(cat.key)}>
                {t(cat.tKey)}
              </button>
            ))}
          </div>

          <input className="cw-input" placeholder={t('comm.titlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
          <textarea className="cw-input cw-textarea" placeholder={t('comm.contentPlaceholder')} value={content} onChange={e => setContent(e.target.value)} />

          <div className="cw-imgs">
            {images.map(url => (
              <div key={url} className="cw-thumb">
                <img src={url} alt="" />
                <button className="cw-thumb-x" onClick={() => removeImage(url)}>×</button>
              </div>
            ))}
            {images.length < MAX_POST_IMAGES && (
              <button className="cw-add-img" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  t('comm.uploading')
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    {t('comm.addImage')}
                  </>
                )}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />

          <div className="cw-footer">
            <label className="cw-anon">
              <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
              {t('comm.anonymous')}
            </label>
            <button className="cw-submit" disabled={submitting || uploading || !title.trim() || !content.trim()} onClick={handleSubmit}>
              {submitting ? t('comm.posting') : t('comm.post')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
