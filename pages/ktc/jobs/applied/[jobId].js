import { useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BRAND, c, s } from '../../../../components/ktc/ktcStyles';
import { useT } from '../../../../lib/i18n';
import { fireApplyConversion } from '../../../../lib/applyConversion';

/* KTC 지원 완료 확인 페이지 — /ktc/jobs/applied/<jobId>
   공고 id 를 경로에 담아 달라는 광고팀 요청. 이 경로에 도달한 것 자체가
   "KTC 공고 지원 성공"이라 광고 쪽에서 URL 규칙 하나로 전환을 잡을 수 있다.
   (일반 공고는 /jobs/applied — 그쪽과 URL 로 분리된다.)

   공고 제목·회사는 이벤트 파라미터용으로 쿼리로 받는다. 없어도 전환 자체는
   경로로 성립하므로 화면만 간단해진다.

   /ktc/jobs/[id] 와 경로가 겹치지 않는다 — Next 는 정적 세그먼트(applied)를
   동적 세그먼트보다 먼저 매칭한다. */
export default function KtcJobApplied() {
  const router = useRouter();
  const { t } = useT();
  const { jobId, title, company } = router.query;

  // 전환은 한 번만 — router.query 가 첫 렌더에 비어 있어 가드 없이는 두 번 쏜다.
  const fired = useRef(false);
  useEffect(() => {
    if (!router.isReady || fired.current) return;
    fired.current = true;
    fireApplyConversion({ title, company, source: 'ktc' });
  }, [router.isReady, title, company]);

  return (
    <>
      <Head>
        <title>{t('ktc.applied.title')} | K-Tech College</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ background: c.bg, color: c.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ ...s.container, maxWidth: 520, textAlign: 'center' }}>
          <svg viewBox="0 0 120 120" style={{ width: 92, height: 92 }} fill="none" aria-hidden>
            <circle cx="60" cy="60" r="56" fill="#FFF1E8" stroke={BRAND} strokeWidth="3" />
            <path d="M36 62 L52 78 L84 46" stroke={BRAND} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <animate attributeName="stroke-dasharray" from="0 100" to="100 0" dur="0.6s" fill="freeze" />
            </path>
          </svg>

          <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, letterSpacing: '-0.025em', color: c.text, margin: '26px 0 0' }}>
            {t('ktc.applied.heading')}
          </h1>

          {title && (
            <p style={{ fontSize: 15, fontWeight: 700, color: c.text, margin: '14px 0 0' }}>
              {title}{company ? ` — ${company}` : ''}
            </p>
          )}

          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: c.textDim, margin: '12px 0 0' }}>
            {t('ktc.applied.desc')}
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 30 }}>
            <Link href="/ktc#jobs" style={{ padding: '13px 26px', borderRadius: 10, background: BRAND, color: '#fff', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
              {t('ktc.applied.browse')}
            </Link>
            {jobId && (
              <Link href={`/ktc/jobs/${jobId}`} style={{ padding: '13px 26px', borderRadius: 10, background: c.surface, color: c.textDim, border: `1px solid ${c.line}`, fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
                {t('ktc.applied.backToJob')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}