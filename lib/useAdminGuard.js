import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabaseClient'

// Community is gated to admins while the dummy/seed content is under review.
// Redirects non-admins (and logged-out users) to `redirectTo`.
// Returns { checking, isAdmin } — render a loader while `checking` to avoid
// flashing gated content before the redirect lands.
export function useAdminGuard(redirectTo = '/') {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      if (!session) { router.replace(redirectTo); return }

      const cached = sessionStorage.getItem('fyi_is_admin')
      let admin
      if (cached !== null) {
        admin = cached === 'true'
      } else {
        try {
          const r = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
          const d = await r.json()
          admin = !!d.isAdmin
          sessionStorage.setItem('fyi_is_admin', String(admin))
        } catch { admin = false }
      }
      if (!active) return
      if (!admin) { router.replace(redirectTo); return }
      setIsAdmin(true)
      setChecking(false)
    })
    return () => { active = false }
  }, [])

  return { checking, isAdmin }
}
