import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
])

// Save profile using the regular client (anon key is fine for own user via RLS)
async function saveProfile(user) {
  if (process.env.NODE_ENV === 'development') return;
  try {
    const utm_source = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('utm_source') : null;
    const utm_medium = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('utm_medium') : null;
    const utm_campaign = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null;
    // Don't clobber a name the user edited (web or app). Seed full_name from the
    // Google identity only when the profile doesn't have one yet.
    const { data: existing } = await supabase
      .from('user_profiles').select('full_name').eq('id', user.id).maybeSingle();
    const payload = {
      id: user.id,
      email: user.email,
      provider: user.app_metadata?.provider || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      updated_at: new Date().toISOString(),
    };
    if (!existing?.full_name) {
      payload.full_name = user.user_metadata?.full_name || user.user_metadata?.name || null;
    }
    const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' })
  } catch(e) {
    // silent fail
  }
}

// Company signup: find-or-create recruiter_companies + insert recruiter_users
async function saveCompanyRecruiter(user) {
  try {
    const companyName = typeof localStorage !== 'undefined' ? localStorage.getItem('fyi_company_name') : null;
    const email = user.email || '';
    const emailDomain = email.includes('@') ? email.split('@')[1].toLowerCase() : null;
    if (!emailDomain) return;
    if (FREE_MAIL_DOMAINS.has(emailDomain)) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyi_company_needs_setup', '1');
      }
      return;
    }

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
      if (created?.id) {
        companyId = created.id;
        // 새 기업 계정 가입 → Slack 알림 (베스트에포트)
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch('/api/company/notify-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ companyId: created.id }),
          });
        } catch (_) {}
      }
    }

    if (!companyId) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fyi_company_needs_setup', '1');
      }
      return;
    }

    // 3) Upsert recruiter_users row (one per user)
    // full_name은 회사 설정 단계(completeCompanySetup)가 소유 — 여기서 덮어쓰지 않음
    await supabase.from('recruiter_users').upsert({
      user_id: user.id,
      company_id: companyId,
      email: user.email,
      role: 'admin',
    }, { onConflict: 'user_id' });

    // Cleanup localStorage keys
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('fyi_company_name');
      localStorage.removeItem('fyi_company_full_name');
      localStorage.removeItem('fyi_company_needs_setup');
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
        // dev-login (and implicit flow) returns tokens in the URL hash — consume them
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          const hp = new URLSearchParams(window.location.hash.slice(1))
          const access_token = hp.get('access_token')
          const refresh_token = hp.get('refresh_token')
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
            // 해시(토큰)만 제거하고 ?return= 쿼리는 보존한다. pathname만 남기면
            // 아래에서 window.location.search로 읽는 returnTo가 사라져 홈으로 튕긴다.
            history.replaceState(null, '', window.location.pathname + window.location.search)
          }
        }

        // Check for existing session first
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          router.replace('/')
          return
        }

        if (data.session) {
          // Pull intent/return from the callback URL first; localStorage is
          // a fallback for older flows. URL-driven values survive existing-
          // member fast paths where the callback may fire twice and the
          // first call already consumed the localStorage keys.
          const urlParams = new URLSearchParams(window.location.search)
          const urlIntent = urlParams.get('intent')
          const urlReturn = urlParams.get('return')
          const intentEarly = urlIntent || (typeof window !== 'undefined' && localStorage.getItem('fyi_intent'))
          if (intentEarly === 'company') {
            await saveCompanyRecruiter(data.session.user)
          } else {
            await saveProfile(data.session.user)
          }
          const returnTo = urlReturn || (typeof window !== 'undefined' && localStorage.getItem('fyi_login_return'))
          const intent = intentEarly
          localStorage.removeItem('fyi_login_return')
          localStorage.removeItem('fyi_intent')
          if (intent === 'company') {
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
          } else if (intent === 'cv_signup') {
            // Existing LinkedIn members can hit this path on the fast
            // /cv flow when fyi_login_return is already consumed — keep
            // them on the /cv resume-upload track.
            destination = '/cv?continue=1';
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
            const urlParams2 = new URLSearchParams(window.location.search)
            const urlIntent2 = urlParams2.get('intent')
            const urlReturn2 = urlParams2.get('return')
            const intent2Early = urlIntent2 || (typeof window !== 'undefined' && localStorage.getItem('fyi_intent'))
            if (intent2Early === 'company') {
              await saveCompanyRecruiter(exchangeData.session.user)
            } else {
              await saveProfile(exchangeData.session.user)
            }
            const returnTo = urlReturn2 || (typeof window !== 'undefined' && localStorage.getItem('fyi_login_return'))
            const intent2 = intent2Early
            localStorage.removeItem('fyi_login_return')
            localStorage.removeItem('fyi_intent')
            if (intent2 === 'company') {
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
            } else if (intent2 === 'cv_signup') {
              dest2 = '/cv?continue=1';
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
      height:'100vh', background:'var(--sm-bg)', color:'var(--sm-text)',
      gap:'16px', fontFamily:'system-ui'
    }}>
      <div style={{
        width:'40px', height:'40px', borderRadius:'50%',
        border:'3px solid var(--sm-accent)', borderTopColor:'transparent',
        animation:'spin 0.8s linear infinite'
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:'15px', color:'rgba(255,255,255,0.6)'}}>
        Signing you in...
      </div>
    </div>
  )
}
