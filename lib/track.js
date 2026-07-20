import { supabase } from './supabaseClient'

// Persistent anonymous id (survives logout/login) → lets us measure return
// visits for logged-out traffic and assign a stable experiment bucket.
export function getClientId() {
  if (typeof window === 'undefined') return null
  try {
    let cid = localStorage.getItem('sm_cid')
    if (!cid) {
      cid = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      localStorage.setItem('sm_cid', cid)
    }
    // 서버(OAuth 콜백)에서도 읽을 수 있게 쿠키로 미러 → sign_up 이벤트에 client_id 를 실어,
    // 로그아웃 상태 퍼널 단계(client_id 키)와 가입을 같은 유저로 잇는다.
    try { document.cookie = `sm_cid=${cid}; path=/; max-age=31536000; SameSite=Lax` } catch {}
    return cid
  } catch {
    return null
  }
}

// Clarity 미러 — 같은 이벤트명을 Clarity 커스텀 이벤트로도 쏴서, Clarity 대시보드에서
// "게이트 노출 + 가입 없음" 같은 필터로 이탈 세션 리코딩만 골라볼 수 있게 한다.
export function mirrorClarity(event) {
  try { if (typeof window !== 'undefined' && typeof window.clarity === 'function') window.clarity('event', event) } catch {}
}

// Fire-and-forget event tracking → POST /api/track → `events` table.
// Reads the current session so the API can exclude internal/HR users by email.
export async function track(event, { meta = null, page = null } = {}) {
  mirrorClarity(event)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        page,
        meta,
        email: session?.user?.email || null,
        userId: session?.user?.id || null,
        clientId: getClientId(),
      }),
    })
  } catch {}
}
