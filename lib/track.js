import { supabase } from './supabaseClient'

// Fire-and-forget event tracking → POST /api/track → `events` table.
// Reads the current session so the API can exclude internal/HR users by email.
export async function track(event, { meta = null, page = null } = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, page, meta, email: session?.user?.email || null }),
    })
  } catch {}
}
