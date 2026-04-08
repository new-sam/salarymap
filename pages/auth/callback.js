import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import supabaseClient from '../../lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | error

  useEffect(() => {
    // Timeout fallback — never spin forever
    const timeout = setTimeout(() => {
      setStatus('error');
    }, 8000);

    const handleCallback = async () => {
      try {
        // Try existing session first
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          clearTimeout(timeout);
          router.replace('/?login=success');
          return;
        }

        // Try PKCE code exchange
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (data?.session) {
            clearTimeout(timeout);
            router.replace('/?login=success');
            return;
          }
          if (error) throw error;
        }

        // No session, no code — go home
        clearTimeout(timeout);
        router.replace('/');
      } catch (e) {
        console.error('Auth callback error:', e);
        clearTimeout(timeout);
        setStatus('error');
      }
    };

    handleCallback();
    return () => clearTimeout(timeout);
  }, []);

  if (status === 'error') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a', color: 'white',
        fontFamily: 'system-ui', gap: '16px', textAlign: 'center', padding: '20px',
      }}>
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>Login failed</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', maxWidth: '320px' }}>
          Google sign-in is not yet configured. Please contact the site admin.
        </div>
        <button
          onClick={() => router.replace('/')}
          style={{
            marginTop: '8px', background: '#FF6200', color: 'white', border: 'none',
            padding: '12px 28px', borderRadius: '8px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 700, fontFamily: 'system-ui',
          }}
        >
          Back to site
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0a0a', color: 'white',
      fontFamily: 'system-ui', gap: '12px',
    }}>
      <div style={{
        width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #FF6200', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)' }}>Signing you in...</div>
    </div>
  );
}
