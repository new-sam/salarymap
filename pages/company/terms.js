import Head from 'next/head';
import Brand from '../../components/company/Brand';
import { TERMS, PRIVACY_TABLE, TERMS_VERSION } from '../../lib/companyTerms';

export default function CompanyTerms() {
  return (
    <>
      <Head><title>서비스 이용약관 · FYI for Companies</title></Head>
      <div style={css.shell}>
        <div style={css.topRow}>
          <Brand href="/for-companies" />
          <span style={css.version}>버전 {TERMS_VERSION}</span>
        </div>

        <article style={css.doc}>
          <h1 style={css.docTitle}>FYI 서비스 이용약관</h1>

          {TERMS.map((ch) => (
            <section key={ch.chapter} style={css.chapter}>
              <h2 style={css.chapterH}>{ch.chapter}</h2>
              {ch.articles.map((a) => (
                <div key={a.h} style={css.article}>
                  <h3 style={css.articleH}>{a.h}</h3>
                  {a.body.map((p, i) => (
                    <p key={i} style={css.p}>{p}</p>
                  ))}
                  {a.list && (
                    <ol style={css.ol}>
                      {a.list.map((li, i) => (
                        <li key={i} style={css.li}>{li}</li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </section>
          ))}

          <hr style={css.hr} />

          <section style={css.chapter}>
            <h2 style={css.chapterH}>{PRIVACY_TABLE.title}</h2>
            <table style={css.table}>
              <tbody>
                {PRIVACY_TABLE.rows.map(([k, v]) => (
                  <tr key={k}>
                    <th style={css.th}>{k}</th>
                    <td style={css.td}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={css.note}>{PRIVACY_TABLE.note}</p>
          </section>
        </article>
      </div>
    </>
  );
}

const css = {
  shell: {
    minHeight: '100vh',
    background: '#F7F7F8',
    color: '#1a1a1a',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    WebkitFontSmoothing: 'antialiased',
    padding: '34px clamp(18px, 5vw, 48px) 64px',
  },
  topRow: {
    maxWidth: 820, margin: '0 auto 22px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  version: { fontSize: 12, color: '#9ca3af', fontWeight: 700 },
  doc: {
    maxWidth: 820, margin: '0 auto', background: '#fff',
    border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16,
    padding: 'clamp(28px, 5vw, 52px)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 14px 36px rgba(0,0,0,0.06)',
  },
  docTitle: { fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 28px', color: '#111' },
  chapter: { marginBottom: 26 },
  chapterH: {
    fontSize: 16, fontWeight: 800, color: '#111', margin: '0 0 14px',
    paddingBottom: 8, borderBottom: '1px solid #EEF0F2',
  },
  article: { marginBottom: 16 },
  articleH: { fontSize: 14, fontWeight: 800, color: '#1f2937', margin: '0 0 6px' },
  p: { fontSize: 13.5, lineHeight: 1.8, color: '#374151', margin: '0 0 6px' },
  ol: { margin: '6px 0 0', paddingLeft: 20 },
  li: { fontSize: 13.5, lineHeight: 1.8, color: '#374151', marginBottom: 4 },
  hr: { border: 'none', borderTop: '1px solid #EEF0F2', margin: '32px 0' },
  table: {
    width: '100%', borderCollapse: 'collapse', margin: '6px 0 14px',
    fontSize: 13, color: '#374151',
  },
  th: {
    textAlign: 'left', verticalAlign: 'top', width: 110, padding: '11px 14px',
    background: '#F9FAFB', border: '1px solid #E5E7EB', fontWeight: 800, color: '#111',
  },
  td: { padding: '11px 14px', border: '1px solid #E5E7EB', lineHeight: 1.7 },
  note: { fontSize: 12.5, lineHeight: 1.7, color: '#6b7280', margin: 0 },
};
