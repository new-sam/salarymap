import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

// Save profile using the regular client (anon key is fine for own user via RLS)
async function saveProfile(user) {
  try {
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      provider: user.app_metadata?.provider || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    // silent on success/error
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
          localStorage.removeItem('fyi_login_return')
          router.replace(returnTo || '/?login=success')
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
            localStorage.removeItem('fyi_login_return')
            router.replace(returnTo || '/?login=success')
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
