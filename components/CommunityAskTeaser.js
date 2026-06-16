import { useEffect, useState } from 'react'
import { track } from '../lib/track'

// Small community entry-point shown at the bottom of the salary result page.
// Provocative "you deserve more → ask how" hook + one real hot post as social
// proof. Login-free: a tap just navigates to the community (we measure CTR).
export default function CommunityAskTeaser({ t }) {
  const [post, setPost] = useState(null)

  useEffect(() => {
    track('view_community_teaser', { meta: { context: 'salary_result' } })
    fetch('/api/community/posts?sort=popular&window=7&limit=1')
      .then(r => r.json())
      .then(d => { if (d.posts?.length) setPost(d.posts[0]) })
      .catch(() => {})
  }, [])

  const go = () => {
    track('click_community_teaser', { meta: { context: 'salary_result' } })
    window.location.href = '/community?from=salary_result'
  }

  return (
    <div className="cat" onClick={go} role="button" tabIndex={0}>
      <div className="cat-title">{t('result.askTitle')}</div>
      <div className="cat-sub">{t('result.askSub')}</div>
      {post && (
        <div className="cat-proof">
          <span className="cat-proof-q">“{post.title}”</span>
          <span className="cat-proof-c">· {t('result.askComments', { n: post.comment_count || 0 })}</span>
        </div>
      )}
      <div className="cat-cta">{t('result.askCta')}</div>

      <style>{`
        .cat{margin:28px 0 8px;padding:18px;border-radius:14px;cursor:pointer;
          background:linear-gradient(135deg,rgba(255,68,0,0.12),rgba(255,68,0,0.04));
          border:1px solid rgba(255,68,0,0.25);transition:.15s}
        .cat:hover{border-color:rgba(255,68,0,0.5);background:linear-gradient(135deg,rgba(255,68,0,0.18),rgba(255,68,0,0.06))}
        .cat-title{font-size:16px;font-weight:800;color:#fff;line-height:1.35;letter-spacing:-0.2px}
        .cat-sub{font-size:13px;color:rgba(255,255,255,0.6);margin-top:6px;line-height:1.4}
        .cat-proof{display:flex;align-items:baseline;gap:6px;margin-top:12px;padding:9px 11px;
          border-radius:9px;background:rgba(255,255,255,0.05)}
        .cat-proof-q{flex:1;min-width:0;font-size:12px;color:rgba(255,255,255,0.75);font-weight:600;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cat-proof-c{flex-shrink:0;font-size:11px;color:rgba(255,255,255,0.4)}
        .cat-cta{margin-top:14px;font-size:13px;font-weight:700;color:#ff7a40}
      `}</style>
    </div>
  )
}
