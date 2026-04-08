import { useEffect } from 'react';
import { useRouter } from 'next/router';
import supabaseClient from '../../lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();

      if (session) {
        router.replace('/?login=success');
      } else {
        // Handle PKCE / hash fragment flow
        const { data } = await supabaseClient.auth.exchangeCodeForSession(
          window.location.href
        );
        if (data?.session) {
          router.replace('/?login=success');
        } else {
          router.replace('/');
        }
      }
    };

    handleCallback();
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0a0a', color: 'white',
      fontSize: '16px', fontFamily: 'system-ui',
    }}>
      Signing you in...
    </div>
  );
}
