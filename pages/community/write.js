import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useLoginGuard } from '../../lib/useLoginGuard'
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
  const [pollEnabled, setPollEnabled] = useState(false)
  const [pollA, setPollA] = useState('')
  const [pollB, setPollB] = useState('')
  const [pollDuration, setPollDuration] = useState(72) // 시간 단위, 기본 3일

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

  const pollValid = pollEnabled && pollA.trim() && pollB.trim()

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !session || submitting) return
    if (pollEnabled && !pollValid) { alert(t('comm.pollIncomplete')); return }
    setSubmitting(true)
    try {
      const body = { category, title: title.trim(), content: content.trim(), is_anonymous: anonymous, image_urls: images }
      if (pollValid) body.poll = { option_a: pollA.trim(), option_b: pollB.trim(), duration_hours: pollDuration }
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body)
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
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>Loading...</div>
      </>
    )
  }

  return (
    <>
      <Head><title>{t('comm.writePost')}</title></Head>

      <style>{`
        .cw-page { background: #fff; min-height: 100vh; }
        .cw-container { max-width: 640px; margin: 0 auto; padding: 64px 24px 60px; }
        .cw-back { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #888; background: none; border: none; cursor: pointer; font-family:inherit; padding: 0; margin-bottom: 16px; }
        .cw-back:hover { color: #555; }
        .cw-title { font-size: 22px; font-weight: 800; color: #111; margin: 0 0 24px; font-family:inherit; }
        .cw-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
        .cw-cat { padding: 8px 18px; border-radius: 20px; border: 1px solid #ddd; background: transparent; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; font-family:inherit; transition: all 0.15s; }
        .cw-cat.active { background: var(--sm-accent); border-color: var(--sm-accent); color: #fff; }
        .cw-input { width: 100%; padding: 14px 16px; border-radius: 10px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 15px; font-family:inherit; margin-bottom: 12px; outline: none; box-sizing: border-box; transition: border-color 0.15s; }
        .cw-input:focus { border-color: var(--sm-accent); }
        .cw-textarea { min-height: 200px; resize: vertical; line-height: 1.6; }
        .cw-imgs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
        .cw-thumb { position: relative; width: 88px; height: 88px; border-radius: 10px; overflow: hidden; border: 1px solid #eee; }
        .cw-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cw-thumb-x { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; border: none; background: rgba(0,0,0,0.6); color: #fff; font-size: 14px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
        .cw-add-img { width: 88px; height: 88px; border-radius: 10px; border: 1px dashed #ccc; background: #fafafa; color: #999; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; font-family:inherit; }
        .cw-add-img:hover { border-color: var(--sm-accent); color: var(--sm-accent); }
        .cw-add-img:disabled { opacity: 0.5; cursor: default; }
        .cw-poll-toggle { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border: 1px solid #e6e6e6; border-radius: 12px; background: #fff; cursor: pointer; margin: 4px 0 12px; font-family:inherit; transition: all 0.15s; }
        .cw-poll-toggle:hover { border-color: #ffcdb0; }
        .cw-poll-toggle.on { border-color: var(--sm-accent); background: #fff8f3; }
        .cw-poll-toggle-ico { color: var(--sm-accent); display: flex; align-items: center; flex-shrink: 0; }
        .cw-poll-toggle-text { flex: 1; text-align: left; }
        .cw-poll-toggle-title { display: block; font-size: 14px; font-weight: 700; color: #222; }
        .cw-poll-toggle-desc { display: block; font-size: 12px; color: #999; margin-top: 2px; }
        .cw-switch { width: 42px; height: 24px; border-radius: 12px; background: #dcdcdc; position: relative; transition: background 0.15s; flex-shrink: 0; }
        .cw-poll-toggle.on .cw-switch { background: var(--sm-accent); }
        .cw-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .cw-poll-toggle.on .cw-switch::after { transform: translateX(18px); }
        .cw-poll-box { border: 1px solid #ececec; background: #fafafa; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
        .cw-poll-opt-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .cw-poll-chip { width: 28px; height: 28px; border-radius: 8px; background: var(--sm-accent); color: #fff; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cw-poll-chip.b { background: #2b2b2b; }
        .cw-poll-opt { flex: 1; padding: 11px 14px; border-radius: 9px; border: 1px solid #ddd; background: #fff; color: #111; font-size: 14px; font-family:inherit; outline: none; box-sizing: border-box; transition: border-color 0.15s; }
        .cw-poll-opt:focus { border-color: var(--sm-accent); }
        .cw-poll-dur { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #ececec; }
        .cw-poll-dur-label { font-size: 13px; color: #777; font-weight: 600; }
        .cw-poll-dur-btns { display: inline-flex; border: 1px solid #ddd; border-radius: 9px; overflow: hidden; }
        .cw-poll-dur-btn { padding: 7px 16px; border: none; border-right: 1px solid #ddd; background: #fff; color: #666; font-size: 13px; font-weight: 600; cursor: pointer; font-family:inherit; transition: all 0.12s; }
        .cw-poll-dur-btn:last-child { border-right: none; }
        .cw-poll-dur-btn.active { background: var(--sm-accent); color: #fff; }
        .cw-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
        .cw-anon { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; cursor: pointer; }
        .cw-anon input { width: 18px; height: 18px; accent-color: var(--sm-accent); }
        .cw-submit { padding: 12px 32px; border-radius: 10px; border: none; background: var(--sm-accent); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family:inherit; transition: all 0.15s; }
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

          <button type="button" className={`cw-poll-toggle${pollEnabled ? ' on' : ''}`} onClick={() => setPollEnabled(v => !v)}>
            <span className="cw-poll-toggle-ico">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 20V10M12 20V4M20 20v-6"/></svg>
            </span>
            <span className="cw-poll-toggle-text">
              <span className="cw-poll-toggle-title">{t('comm.pollAdd')}</span>
              <span className="cw-poll-toggle-desc">{t('comm.pollAddDesc')}</span>
            </span>
            <span className="cw-switch" />
          </button>

          {pollEnabled && (
            <div className="cw-poll-box">
              <div className="cw-poll-opt-row">
                <span className="cw-poll-chip">A</span>
                <input className="cw-poll-opt" placeholder={t('comm.pollOptionA')} value={pollA} onChange={e => setPollA(e.target.value)} maxLength={80} />
              </div>
              <div className="cw-poll-opt-row">
                <span className="cw-poll-chip b">B</span>
                <input className="cw-poll-opt" placeholder={t('comm.pollOptionB')} value={pollB} onChange={e => setPollB(e.target.value)} maxLength={80} />
              </div>
              <div className="cw-poll-dur">
                <span className="cw-poll-dur-label">{t('comm.pollDuration')}</span>
                <div className="cw-poll-dur-btns">
                  {[{ h: 24, k: 'comm.pollDur1d' }, { h: 72, k: 'comm.pollDur3d' }, { h: 168, k: 'comm.pollDur7d' }].map(d => (
                    <button key={d.h} type="button" className={`cw-poll-dur-btn${pollDuration === d.h ? ' active' : ''}`} onClick={() => setPollDuration(d.h)}>
                      {t(d.k)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
