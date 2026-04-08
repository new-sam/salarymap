import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

// Save profile using the regular client (anon key is fine for own user via RLS)
async function saveProfile(user) {
  try {
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || null,
      provider: user.app_metadata?.provider || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) console.error('Profile upsert error:', error)
    else console.log('✅ Profile saved for', user.email)
  } catch(e) {
    console.error('saveProfile error:', e)
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
          console.error('Auth callback error:', error)
          router.replace('/')
          return
        }

        if (data.session) {
          console.log('Session found:', data.session.user.email)
          await saveProfile(data.session.user)
          router.replace('/?login=success')
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
            router.replace('/?login=success')
          } else {
            console.error('Exchange error:', exchangeError)
            router.replace('/')
          }
        } else {
          router.replace('/')
        }
      } catch (err) {
        console.error('Callback error:', err)
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
        border:'3px solid #FF6200', borderTopColor:'transparent',
        animation:'spin 0.8s linear infinite'
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:'15px', color:'rgba(255,255,255,0.6)'}}>
        Signing you in...
      </div>
    </div>
  )
}
