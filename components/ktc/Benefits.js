import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { ANCHOR, BRAND, c, s } from './ktcStyles';

const ITEMS = [
  { n: 1, img: '/ktc/benefit-2.png' },
  { n: 2, img: '/ktc/benefit-4.png' },
  // 안내할 예정 이벤트가 아직 없어 '가까운 이벤트 보러가기' CTA 는 뺐다.
  // 되살릴 때는 cta 경로만 다시 넣으면 된다(문구는 ktc.benefit.3.cta 에 그대로 있음).
  { n: 3, img: '/ktc/event.jpg', events: true },
];

/* 1행 3열 — 이미지 위 / 텍스트 아래인 세로 카드 세 개를 가로로 나란히.
   좁은 화면에서는 .ktc-grid-3 이 1열로 접는다. */
export default function Benefits() {
  const { t } = useT();

  return (
    <section id={ANCHOR.benefit} className="ktc-anchor" style={s.section}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2}>{t('ktc.benefit.title')}</h2>
          <p style={s.sub}>{t('ktc.benefit.sub')}</p>
        </Reveal>

        <div
          className="ktc-grid-3"
          style={{ marginTop: 'clamp(28px, 4vw, 52px)', display: 'grid', gap: 18 }}
        >
          {ITEMS.map((item, idx) => (
            <Reveal key={item.n} delay={idx * 70}>
              <div style={{ ...s.card, padding: 0, overflow: 'hidden', height: '100%' }}>
                <img
                  className="ktc-benefit-img"
                  src={item.img}
                  alt={t(`ktc.benefit.${item.n}.title`)}
                  style={{ width: '100%', objectFit: 'cover', display: 'block', borderBottom: `1px solid ${c.line}` }}
                />

                <div style={{ padding: 'clamp(20px, 3vw, 28px)' }}>
                  <h3 style={{ fontSize: 'clamp(17px, 2vw, 21px)', fontWeight: 800, letterSpacing: '-0.02em', color: c.text, lineHeight: 1.35 }}>
                    {t(`ktc.benefit.${item.n}.title`)}
                  </h3>

                  {item.events ? (
                    <ul style={{ marginTop: 14, display: 'grid', gap: 12, listStyle: 'none' }}>
                      {['event1', 'event2'].map((k) => (
                        <li key={k} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.7, color: c.textDim }}>
                          <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: 999, background: BRAND, marginTop: 9 }} />
                          <span>{t(`ktc.benefit.${item.n}.${k}`)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.72, color: c.textDim }}>
                      {t(`ktc.benefit.${item.n}.desc`)}
                    </p>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
