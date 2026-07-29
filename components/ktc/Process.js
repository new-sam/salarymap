import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { BRAND, c, s } from './ktcStyles';

export default function Process() {
  const { t } = useT();

  return (
    <section style={s.sectionAlt}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2}>{t('ktc.process.title')}</h2>
          <p style={s.sub}>{t('ktc.process.sub')}</p>
        </Reveal>

        {/* 데스크톱은 3단 가운데 정렬 카드, 모바일은 번호를 왼쪽으로 눕힌 단계 목록.
            세로로 쌓았을 때 카드 하나당 높이를 크게 줄인다 — .ktc-proc-* 참고. */}
        <div className="ktc-grid-3 ktc-proc-grid" style={{ marginTop: 'clamp(32px, 5vw, 56px)', display: 'grid', gap: 18 }}>
          {[1, 2, 3].map((n, i) => (
            <Reveal key={n} delay={i * 90}>
              <div className="ktc-proc-card" style={{ ...s.card, height: '100%' }}>
                <span
                  className="ktc-proc-num"
                  style={{
                    fontWeight: 850,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    color: BRAND,
                    opacity: 0.9,
                  }}
                >
                  {`0${n}`}
                </span>
                <div className="ktc-proc-text">
                  <h3 className="ktc-proc-title" style={{ fontWeight: 800, color: c.text, lineHeight: 1.38 }}>
                    {t(`ktc.process.${n}.title`)}
                  </h3>
                  <p className="ktc-proc-desc" style={{ lineHeight: 1.68, color: c.textDim }}>
                    {t(`ktc.process.${n}.desc`)}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
