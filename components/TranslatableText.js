import { useState } from 'react'
import { useT } from '../lib/i18n'

// Renders post/comment text with a toggle to translate it into the viewer's
// selected language (useT().lang) and back to the original. The translation is
// fetched once on first request and cached in component state for toggling.
export default function TranslatableText({ text, className }) {
  const { lang, t } = useT()
  const [translated, setTranslated] = useState(null)
  const [showTranslated, setShowTranslated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  if (!text) return null

  async function toggle() {
    if (showTranslated) { setShowTranslated(false); return }
    if (translated != null) { setShowTranslated(true); return }
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/community/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [text], targetLang: lang }),
      })
      const data = await res.json()
      if (res.ok && data.translated?.length === 1) {
        setTranslated(data.translated[0])
        setShowTranslated(true)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className={className}>{showTranslated ? translated : text}</div>
      <button className="cp-translate-btn" onClick={toggle} disabled={loading}>
        {loading ? t('comm.translating')
          : error ? t('comm.translateError')
          : showTranslated ? t('comm.viewOriginal')
          : t('comm.viewTranslation')}
      </button>
    </>
  )
}
