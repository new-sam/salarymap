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

// Company signup: find-or-create recruiter_companies + insert recruiter_users
async function saveCompanyRecruiter(user) {
  try {
    const companyName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('fyi_company_name') : null;
    const fullName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('fyi_company_full_name') : null;
    const email = user.email || '';
    const emailDomain = email.includes('@') ? email.split('@')[1].toLowerCase() : null;
    if (!emailDomain) return;

    // 1) Find existing recruiter_company by domain
    let companyId = null;
    const { data: existing } = await supabase
      .from('recruiter_companies')
      .select('id')
      .eq('email_domain', emailDomain)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      companyId = existing.id;
    } else if (companyName) {
      // 2) Create new recruiter_company
      const { data: created } = await supabase
        .from('recruiter_companies')
        .insert({
          name: companyName,
          email_domain: emailDomain,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (created?.id) companyId = created.id;
    }

    // 3) Upsert recruiter_users row (one per user)
    await supabase.from('recruiter_users').upsert({
      user_id: user.id,
      company_id: companyId,
      email: user.email,
      full_name: fullName,
      role: 'admin',
    }, { onConflict: 'user_id' });

    // Cleanup sessionStorage keys
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('fyi_company_name');
      sessionStorage.removeItem('fyi_company_full_name');
    }
  } catch (e) {
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
          const intentEarly = typeof window !== 'undefined' && localStorage.getItem('fyi_intent')
          if (intentEarly === 'company') {
            await saveCompanyRecruiter(data.session.user)
          } else {
            await saveProfile(data.session.user)
          }
          const returnTo = typeof window !== 'undefined' && localStorage.getItem('fyi_login_return')
          const intent = intentEarly
          localStorage.removeItem('fyi_login_return')
          // Track signup — skip for HR/company logins
          if (intent === 'hr') {
            if (typeof gtag === 'function') gtag('event', 'hr_signup', {})
            if (typeof fbq === 'function') fbq('trackCustom', 'HRSignup', {})
          } else if (intent === 'company') {
            if (typeof gtag === 'function') gtag('event', 'company_signup', {})
            if (typeof fbq === 'function') fbq('trackCustom', 'CompanySignup', {})
          } else {
            if (typeof gtag === 'function') gtag('event', 'signup_complete', { intent: intent || 'none', return_to: returnTo || 'default' })
            if (typeof fbq === 'function') fbq('trackCustom', 'SignupComplete', { intent: intent || 'none', return_to: returnTo || 'default' })
          }
          // If user expressed job interest, go to jobs page
          const jobIntents = ['open', 'selective']
          let destination;
          if (returnTo) {
            destination = returnTo;
          } else if (intent === 'company') {
            destination = '/company';
          } else if (intent && jobIntents.includes(intent)) {
            destination = '/jobs';
          } else {
            destination = '/?login=success';
          }
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
            const intent2Early = typeof window !== 'undefined' && localStorage.getItem('fyi_intent')
            if (intent2Early === 'company') {
              await saveCompanyRecruiter(exchangeData.session.user)
            } else {
              await saveProfile(exchangeData.session.user)
            }
            const returnTo = typeof window !== 'undefined' && localStorage.getItem('fyi_login_return')
            const intent2 = intent2Early
            localStorage.removeItem('fyi_login_return')
            if (intent2 === 'hr') {
              if (typeof gtag === 'function') gtag('event', 'hr_signup', {})
              if (typeof fbq === 'function') fbq('trackCustom', 'HRSignup', {})
            } else if (intent2 === 'company') {
              if (typeof gtag === 'function') gtag('event', 'company_signup', {})
              if (typeof fbq === 'function') fbq('trackCustom', 'CompanySignup', {})
            } else {
              if (typeof gtag === 'function') gtag('event', 'signup_complete', { intent: intent2 || 'none', return_to: returnTo || 'default' })
              if (typeof fbq === 'function') fbq('trackCustom', 'SignupComplete', { intent: intent2 || 'none', return_to: returnTo || 'default' })
            }
            const jobIntents2 = ['open', 'selective']
            let dest2;
            if (returnTo) {
              dest2 = returnTo;
            } else if (intent2 === 'company') {
              dest2 = '/company';
            } else if (intent2 && jobIntents2.includes(intent2)) {
              dest2 = '/jobs';
            } else {
              dest2 = '/?login=success';
            }
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
