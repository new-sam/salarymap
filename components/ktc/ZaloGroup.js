import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { c, s } from './ktcStyles';

/* 원본 랜딩 맨 아래의 Zalo 그룹 참여 섹션.
   원본은 QR 을 api.qrserver.com 에서 실시간 생성하는데, 외부 서비스가 죽으면 QR 이
   통째로 사라지므로 한 번 받아서 public/ktc/zalo-qr.png 로 호스팅한다.
   링크가 바뀌면 QR 도 다시 만들어야 한다 — 아래 ZALO_URL 과 짝. */
const ZALO_URL = 'https://zalo.me/g/iclzd3pgnhlwsnz8jdb7';

/* 배지·버튼은 FYI 오렌지가 아니라 Zalo 브랜드 블루를 쓴다 —
   외부 서비스로 나가는 버튼이라 브랜드 색이 그대로 단서가 된다(원본도 동일). */
const ZALO_BLUE = '#0068FF';

function ChatIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.4 1.2 4.5 3.2 5.9v3.6l3.3-1.8c.8.2 1.6.3 2.5.3 5.1 0 9-3.5 9-7.8S17.1 3 12 3z" />
    </svg>
  );
}

export default function ZaloGroup() {
  const { t } = useT();

  return (
    /* 위:아래 = 약 2:1. 바로 아래가 푸터라 위아래를 1:1 로 두면 아랫동이 뜬다(원본도 동일). */
    <section style={{ ...s.sectionAlt, padding: 'clamp(56px, 9vw, 120px) 0 clamp(28px, 4.5vw, 56px)' }}>
      <div style={s.container}>
        <Reveal>
          <div className="ktc-zalo">
            <img
              src="/ktc/zalo-qr.png"
              alt=""
              aria-hidden="true"
              className="ktc-zalo-qr"
              style={{ borderRadius: 12, border: `1px solid ${c.line}`, background: '#fff', padding: 10, flexShrink: 0 }}
            />

            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: 'rgba(0,104,255,0.09)',
                  color: ZALO_BLUE,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <ChatIcon />
                {t('ktc.zalo.badge')}
              </span>

              <h2 className="ktc-zalo-title" style={{ marginTop: 14, fontWeight: 800, color: c.text, letterSpacing: '-0.02em', lineHeight: 1.35 }}>
                {t('ktc.zalo.title')}
              </h2>
              <p className="ktc-zalo-desc" style={{ marginTop: 10, lineHeight: 1.65, color: c.textDim }}>
                {t('ktc.zalo.desc')}
              </p>

              <a
                href={ZALO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="ktc-zalo-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  marginTop: 20,
                  padding: '13px 24px',
                  borderRadius: 10,
                  background: ZALO_BLUE,
                  color: '#fff',
                  fontSize: 14.5,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <ChatIcon size={16} />
                {t('ktc.zalo.cta')}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
