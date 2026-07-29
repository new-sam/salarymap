import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { c, s } from './ktcStyles';

/* 데스크톱은 로고 위 / 기관명·설명 아래, 가운데 정렬 2x2 카드.
   모바일에서는 카드 4장이 세로로 쌓여 길어지므로 설명만 감춘다(로고·기관명은 유지).
   높이가 로고마다 다른 이유: SVG 3종은 283x50 박스를 공유하지만 jobkorea.png 는
   여백을 잘라낸 워드마크라 박스 대비 글자 점유율이 90.7% (LIKELION 57.7%) — 0.64배. */
const ORGS = [
  { key: 'mss', logo: '/ktc/mss.svg', h: 32, hm: 19 },
  { key: 'kosme', logo: '/ktc/kosme.svg', h: 32, hm: 19 },
  { key: 'likelion', logo: '/ktc/likelion.svg', h: 32, hm: 19 },
  { key: 'jobkorea', logo: '/ktc/jobkorea.png', h: 20, hm: 12 },
];

export default function Organization() {
  const { t } = useT();

  return (
    <section style={s.section}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2}>{t('ktc.org.title')}</h2>
          <p style={s.sub}>{t('ktc.org.sub')}</p>
        </Reveal>

        <div className="ktc-org-grid">
          {ORGS.map((o, i) => (
            <Reveal key={o.key} delay={i * 70} style={{ height: '100%' }}>
              <div
                className="ktc-org-item"
                style={{
                  ...s.card,
                  height: '100%',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  '--ktc-logo-h': `${o.h}px`,
                  '--ktc-logo-hm': `${o.hm}px`,
                }}
              >
                {/* 라이트 배경이라 기관 로고를 원본 색 그대로 쓴다(색 변형 규정에도 안전). */}
                <div className="ktc-org-plate">
                  <img
                    className="ktc-org-logo"
                    src={o.logo}
                    alt={t(`ktc.org.${o.key}.title`)}
                    style={{ width: 'auto', maxWidth: '100%' }}
                  />
                </div>
                <h3 className="ktc-org-title" style={{ fontWeight: 750, color: c.text, lineHeight: 1.45 }}>
                  {t(`ktc.org.${o.key}.title`)}
                </h3>
                <p className="ktc-org-desc" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: c.textDim }}>
                  {t(`ktc.org.${o.key}.desc`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
