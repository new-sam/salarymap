import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { BRAND, c, s } from './ktcStyles';

/* 원본 ktc-landing 의 "왜 참여해야 하나" 카드를 그대로 따른다:
   2x2 그리드 · 좌측 정렬 · 작은 사각 아이콘 박스(연한 액센트 배경) ·
   제목은 액센트 컬러 · 설명은 회색.
   아이콘은 원본의 라인 아이콘(별·격자·하트·노트북)을 인라인 SVG 로 옮겼다 —
   currentColor 를 쓰므로 브랜드 컬러가 그대로 적용되고 파일 요청도 없다. */
const ITEMS = [
  {
    n: 1, // 베트남 지원자 전용 공고
    icon: <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5z" />,
  },
  {
    n: 2, // 다양한 직무
    icon: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      </>
    ),
  },
  {
    n: 3, // 지원 전 과정 동행
    icon: (
      <>
        <path d="M12 20s-6.2-3.7-8.1-7A4.3 4.3 0 0 1 12 8.6a4.3 4.3 0 0 1 8.1 4.4C18.2 16.3 12 20 12 20z" />
      </>
    ),
  },
  {
    n: 4, // 리모트 근무
    icon: (
      <>
        <rect x="3" y="5" width="18" height="11" rx="2" />
        <path d="M2 20h20" />
      </>
    ),
  },
];

export default function Advantage() {
  const { t } = useT();

  return (
    <section style={s.sectionAlt}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2}>{t('ktc.adv.title')}</h2>
          <p style={s.sub}>{t('ktc.adv.sub')}</p>
        </Reveal>

        <div className="ktc-grid-2 ktc-adv-grid" style={{ marginTop: 'clamp(32px, 5vw, 56px)', display: 'grid', gap: 20 }}>
          {ITEMS.map(({ n, icon }, i) => (
            <Reveal key={n} delay={i * 70}>
              <div
                className="ktc-adv-card"
                style={{
                  height: '100%',
                  background: c.surface,
                  border: `1px solid ${c.line}`,
                  borderRadius: 16,
                  boxShadow: '0 1px 3px rgba(17,24,39,0.05)',
                }}
              >
                <span className="ktc-adv-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {icon}
                  </svg>
                </span>

                <h3 className="ktc-adv-title" style={{ fontWeight: 750, color: BRAND, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                  {t(`ktc.adv.${n}.title`)}
                </h3>
                <p className="ktc-adv-desc" style={{ lineHeight: 1.7, color: c.textDim }}>
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
