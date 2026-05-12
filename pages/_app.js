import "@/styles/globals.css";
import { useRouter } from 'next/router';
import { I18nProvider, LanguageSwitcher } from '../lib/i18n';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isHR = router.pathname.startsWith('/hr');

  return (
    <I18nProvider>
      <Component {...pageProps} />
      {!isHR && (
        <footer style={{
          background: '#0a0a09', borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LanguageSwitcher />
        </footer>
      )}
    </I18nProvider>
  );
}
