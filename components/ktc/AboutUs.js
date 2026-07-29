import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { ANCHOR, c, s } from './ktcStyles';

export default function AboutUs() {
  const { t } = useT();

  return (
    <section id={ANCHOR.about} className="ktc-anchor" style={s.sectionAlt}>
      <div style={s.container}>
        <Reveal>
          <div className="ktc-split" style={{ display: 'flex', gap: 'clamp(28px, 5vw, 72px)', alignItems: 'center' }}>
            {/* minWidth 를 0 으로 두면 제목이 칸보다 넓을 때 칸이 눌려 줄바꿈된다.
                제목을 한 줄로 유지하려면 이 칸이 콘텐츠보다 작아지지 않아야 한다. */}
            <div className="ktc-about-text" style={{ flex: '1 1 340px' }}>
              <h2 className="ktc-about-title" style={{ ...s.h2, textAlign: 'left' }}>{t('ktc.about.title')}</h2>
              <div
                style={{ marginTop: 22, fontSize: 'clamp(14px, 1.5vw, 16px)', lineHeight: 1.75, color: c.textDim, display: 'grid', gap: 16 }}
              >
                <p dangerouslySetInnerHTML={{ __html: t('ktc.about.p1') }} />
                <p dangerouslySetInnerHTML={{ __html: t('ktc.about.p2') }} />
              </div>
            </div>

            <div style={{ flex: '1 1 380px', minWidth: 0 }}>
              <img
                src="/ktc/about.jpg"
                alt={t('ktc.about.title')}
                style={{
                  width: '100%',
                  borderRadius: 18,
                  border: `1px solid ${c.line}`,
                  display: 'block',
                }}
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
