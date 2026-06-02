import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabaseClient'

// Requires a logged-in user. Redirects logged-out users to `redirectTo`.
// Used by community write/edit pages — viewing pages are public.
// Returns { checking } — render a loader while `checking` to avoid flashing
// gated content before the redirect lands.
export function useLoginGuard(redirectTo = '/community') {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (!session) { router.replace(redirectTo); return }
      setChecking(false)
    })
    return () => { active = false }
  }, [])

  return { checking }
}
