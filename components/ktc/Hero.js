import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { ANCHOR, BRAND, c, s, scrollTo } from './ktcStyles';

const LOGOS = [
  { src: '/ktc/mss.svg', alt: 'MSS', h: 34, hm: 20 },
  { src: '/ktc/kosme.svg', alt: 'KOSME', h: 34, hm: 20 },
  { src: '/ktc/likelion.svg', alt: 'LIKELION', h: 34, hm: 20 },
  { src: '/ktc/jobkorea.png', alt: 'JOBKOREA', h: 22, hm: 13 },
];

export default function Hero() {
  const { t } = useT();

  return (
    <section className="ktc-hero" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 원본 illustration 을 아주 옅게 깔고 위에 흰 베일을 덮어 텍스트 대비를 확보 */}
      <div
        className="ktc-hero-bg"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/ktc/illustration.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 28%',
          opacity: 0.62,
          filter: 'grayscale(0.15)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, rgba(255,96,0,0.12) 0%, transparent 58%), linear-gradient(180deg, rgba(249,249,249,0.28) 0%, rgba(249,249,249,0.62) 58%, ${c.bg} 100%)`,
        }}
      />

      {/* s.container 의 인라인 padding 이 클래스보다 우선하므로, 세로 여백은
          CSS 변수로 받아 인라인에서 조립한다(미디어쿼리로 값만 갈아끼움). */}
      <div
        className="ktc-hero-inner"
        style={{
          ...s.container,
          position: 'relative',
          padding: 'var(--ktc-hero-pt) clamp(18px, 4vw, 40px) var(--ktc-hero-pb)',
        }}
      >
        <Reveal>
          {/* flex 세로 스택 — 로고 스트립 위치를 order 로만 바꾼다(모바일은 CTA 아래,
              768px 이상은 맨 위). 두 벌 렌더할 필요가 없다. */}
          <div className="ktc-hero-stack" style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            {/* 주관/파트너 로고 스트립 — 원본 히어로의 MSSxKOSMExLIKELION 로고 자리.
                모바일은 2열 2줄이면 세로를 많이 먹어 한 줄 롤링으로 흘린다(복제본을 이어
                붙여 -50% 이동이 한 바퀴). 768px 이상은 4열 한 줄 grid.
                h/hm 이 다른 이유: SVG 3종은 283x50 박스를 공유하지만 jobkorea.png 는
                여백을 잘라낸 워드마크라 박스 대비 글자 점유율이 90.7% (LIKELION 57.7%)다.
                글자 크기를 맞추려면 0.64배. */}
            <div className="ktc-hero-logostrip">
              <div className="ktc-hero-logos">
                {[...LOGOS, ...LOGOS].map((l, i) => {
                  const dup = i >= LOGOS.length;
                  return (
                    <div
                      key={`${l.alt}-${i}`}
                      className={`ktc-hero-logocell${dup ? ' ktc-hero-logo-dup' : ''}`}
                      aria-hidden={dup || undefined}
                      style={{ '--ktc-logo-h': `${l.h}px`, '--ktc-logo-hm': `${l.hm}px` }}
                    >
                      <img
                        className="ktc-hero-logo"
                        src={l.src}
                        alt={dup ? '' : l.alt}
                        style={{ width: 'auto', filter: 'grayscale(1)', opacity: 0.72 }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="ktc-hero-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 999,
                border: `1px solid ${c.lineStrong}`,
                background: 'rgba(255,96,0,0.10)',
                color: BRAND,
                fontWeight: 800,
                letterSpacing: '0.06em',
              }}
            >
              <span className="ktc-hero-badge-dot" style={{ borderRadius: 999, background: BRAND }} />
              {t('ktc.hero.badge')}
            </div>

            {/* word-break:keep-all — 한국어가 단어 중간에서 끊기지 않게. 줄바꿈 위치는
                번역문의 NBSP 로 잡는다(ko: '채용 프로그램' → 'IT 리모트 / 채용 프로그램'). */}
            <h1
              className="ktc-hero-title"
              style={{
                fontWeight: 850,
                letterSpacing: '-0.03em',
                lineHeight: 1.14,
                color: c.text,
                wordBreak: 'keep-all',
              }}
            >
              {t('ktc.hero.title1')}
              <br />
              <span style={{ color: BRAND }}>{t('ktc.hero.title2')}</span>
            </h1>

            {/* 번역문에 <br />이 들어 있어 줄바꿈 위치를 언어별로 고정한다
                (ko: '…선발·교육해' 뒤 / vi: '…của Việt Nam,' 뒤).
                width:fit-content — 고정 max-width 를 쓰면 폰트만 vw 로 커지고 상자는 그대로라
                넓은 화면에서 오히려 줄이 하나 더 생긴다. 상자를 가장 긴 줄에 맞춘다. */}
            <p
              style={{
                margin: '22px auto 0',
                width: 'fit-content',
                maxWidth: '100%',
                fontSize: 'clamp(14px, 1.7vw, 18px)',
                lineHeight: 1.65,
                color: c.textDim,
                wordBreak: 'keep-all',
              }}
              dangerouslySetInnerHTML={{ __html: t('ktc.hero.sub') }}
            />

            <div
              style={{
                marginTop: 38,
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button className="ktc-hero-btn" style={s.btnPrimary} onClick={() => scrollTo(ANCHOR.jobs)}>
                {t('ktc.hero.cta')} →
              </button>
            </div>

          </div>
        </Reveal>
      </div>
    </section>
  );
}
