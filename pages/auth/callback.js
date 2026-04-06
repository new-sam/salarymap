import { useEffect } from 'react';
import { useRouter } from 'next/router';
import supabaseClient from '../../lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/?login=success');
      } else {
        router.push('/');
      }
    });
  }, []);
  return (
    <div style={{
      background: '#0c0c0b', color: 'white', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Barlow', sans-serif", fontSize: '16px',
    }}>
      Signing you in…
    </div>
  );
}
