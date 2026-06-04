// Read the attribution captured when the visitor first landed, so it survives the
// client-side navigation between landing → /jobs → opening a job → applying.
//
// jobs.js persists UTM params + the original referrer to sessionStorage and a 30-day
// cookie on landing. By apply time the live URL (router.query) is usually empty, so
// reading only the query loses the source on almost every application. We resolve in
// priority order: live query → sessionStorage → cookie.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']

function readCookie(key) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + key + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

// Returns { utmSource, utmMedium, utmCampaign, utmContent, referrer } — camelCase to
// match the /api/job-applications payload. Missing values are null.
export function getStoredUtm() {
  if (typeof window === 'undefined') {
    return { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, referrer: null }
  }
  const params = new URLSearchParams(window.location.search)
  const read = (key) => {
    const fromQuery = params.get(key)
    if (fromQuery) return fromQuery
    try {
      const fromSession = sessionStorage.getItem(key)
      if (fromSession) return fromSession
    } catch {}
    return readCookie(key)
  }
  const [utmSource, utmMedium, utmCampaign, utmContent] = UTM_KEYS.map(read)
  // Prefer the landing referrer persisted on first visit; fall back to live referrer.
  let referrer = null
  try { referrer = sessionStorage.getItem('fyi_referrer') } catch {}
  if (!referrer) referrer = readCookie('fyi_referrer') || document.referrer || null
  return { utmSource, utmMedium, utmCampaign, utmContent, referrer }
}
