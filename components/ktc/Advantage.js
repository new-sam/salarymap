import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { BRAND, c, s } from './ktcStyles';

/* 원본 ktc-landing advantage.tsx 의 카드 스타일을 따른다:
   2x2 그리드 · 가운데 정렬 · 제목은 액센트 컬러 · 아래로 크게 번지는 소프트 섀도우
   (원본 shadow-[0px_64px_64px_-48px_#0F0F0F1A]). 번호칩은 원본에 없어서 뺐다. */
export default function Advantage() {
  const { t } = useT();

  return (
    <section style={s.sectionAlt}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2}>{t('ktc.adv.title')}</h2>
          <p style={s.sub}>{t('ktc.adv.sub')}</p>
        </Reveal>

        <div className="ktc-grid-2 ktc-adv-grid" style={{ marginTop: 'clamp(32px, 5vw, 56px)', display: 'grid', gap: 22 }}>
          {[1, 2, 3, 4].map((n, i) => (
            <Reveal key={n} delay={i * 70}>
              <div
                className="ktc-adv-card"
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  background: '#FCFCFD',
                  border: `1px solid ${c.line}`,
                  borderRadius: 20,
                  boxShadow: '0 64px 64px -48px rgba(15,15,15,0.12)',
                }}
              >
                <h3 className="ktc-adv-title" style={{ fontWeight: 750, color: BRAND, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                  {t(`ktc.adv.${n}.title`)}
                </h3>
                <p className="ktc-adv-desc" style={{ lineHeight: 1.72, color: c.textDim }}>
                  {t(`ktc.adv.${n}.desc`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
