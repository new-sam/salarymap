import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

// Save profile using the regular client (anon key is fine for own user via RLS)
async function saveProfile(user) {
  if (process.env.NODE_ENV === 'development') return;
  try {
    const utm_source = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('utm_source') : null;
    const utm_medium = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('utm_medium') : null;
    const utm_campaign = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null;
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      provider: user.app_metadata?.provider || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  } catch(e) {
    // silent fail
  }
}

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Check for existing session first
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          router.replace('/')
          return
        }

        if (data.session) {
          await saveProfile(data.session.user)
          const returnTo = typeof window !== 'undefined' && localStorage.getItem('fyi_login_return')
          const intent = typeof window !== 'undefined' && localStorage.getItem('fyi_intent')
          localStorage.removeItem('fyi_login_return')
          // Track signup — skip for HR logins
          if (intent === 'hr') {
            if (typeof gtag === 'function') gtag('event', 'hr_signup', {})
            if (typeof fbq === 'function') fbq('trackCustom', 'HRSignup', {})
          } else {
            if (typeof gtag === 'function') gtag('event', 'signup_complete', { intent: intent || 'none', return_to: returnTo || 'default' })
            if (typeof fbq === 'function') fbq('trackCustom', 'SignupComplete', { intent: intent || 'none', return_to: returnTo || 'default' })
          }
          // If user expressed job interest, go to jobs page
          const jobIntents = ['open', 'selective']
          const destination = returnTo || (intent && jobIntents.includes(intent) ? '/jobs' : '/?login=success')
          router.replace(destination)
          return
        }

        // Try exchanging PKCE code from URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)

          if (exchangeData?.session) {
            await saveProfile(exchangeData.session.user)
            const returnTo = typeof window !== 'undefined' && localStorage.getItem('fyi_login_return')
            const intent2 = typeof window !== 'undefined' && localStorage.getItem('fyi_intent')
            localStorage.removeItem('fyi_login_return')
            // Track signup — skip for HR logins
            if (intent2 === 'hr') {
              if (typeof gtag === 'function') gtag('event', 'hr_signup', {})
              if (typeof fbq === 'function') fbq('trackCustom', 'HRSignup', {})
            } else {
              if (typeof gtag === 'function') gtag('event', 'signup_complete', { intent: intent2 || 'none', return_to: returnTo || 'default' })
              if (typeof fbq === 'function') fbq('trackCustom', 'SignupComplete', { intent: intent2 || 'none', return_to: returnTo || 'default' })
            }
            const jobIntents2 = ['open', 'selective']
            const dest2 = returnTo || (intent2 && jobIntents2.includes(intent2) ? '/jobs' : '/?login=success')
            router.replace(dest2)
          } else {
            // exchange failed
            router.replace('/')
          }
        } else {
          router.replace('/')
        }
      } catch (err) {
        // callback failed
        router.replace('/')
      }
    }

    handleAuth()
  }, [])

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      height:'100vh', background:'#0a0a0a', color:'white',
      gap:'16px', fontFamily:'system-ui'
    }}>
      <div style={{
        width:'40px', height:'40px', borderRadius:'50%',
        border:'3px solid #ff6000', borderTopColor:'transparent',
        animation:'spin 0.8s linear infinite'
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:'15px', color:'rgba(255,255,255,0.6)'}}>
        Signing you in...
      </div>
    </div>
  )
}
