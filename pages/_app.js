import "@/styles/globals.css";
import { I18nProvider, LanguageSwitcher } from '../lib/i18n';

export default function App({ Component, pageProps }) {
  return (
    <I18nProvider>
      <Component {...pageProps} />
      <footer style={{
        background: '#0a0a09', borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <LanguageSwitcher />
      </footer>
    </I18nProvider>
  );
}
