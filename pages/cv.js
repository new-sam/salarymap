import Head from 'next/head';

const steps = [
  { label: '이력서 등록 완료', value: '✓', active: true },
  { label: '포지션 제안', value: '2' },
  { label: '합격 축하금', value: '3', final: true },
];

export default function CvCompletePage() {
  return (
    <>
      <Head>
        <title>이력서 등록 완료 · FYI</title>
        <meta
          name="description"
          content="FYI 이력서 등록이 완료되었습니다. 조건에 맞는 IT 포지션과 합격 축하금 안내를 확인하세요."
        />
      </Head>

      <main className="cv-page">
        <section className="cv-shell">
          <div className="cv-visual" aria-label="FYI celebration">
            <img
              className="cv-celebration-img"
              src="/cv-fyi-celebration.png"
              alt="FYI celebration"
            />
          </div>

          <h1>이력서 등록 완료!</h1>
          <p className="cv-sub">조건에 맞는 IT 포지션이 생기면 바로 알려드릴게요.</p>

          <div className="cv-reward-card">
            <div className="cv-reward-line">
              <span>합격 축하금</span>
              <strong>2,000,000 VND</strong>
              <span>까지</span>
            </div>
            <p className="cv-helper">입사 후 2개월(60일) 근속 확인 시 지급</p>

            <div className="cv-steps">
              {steps.map((step) => (
                <div className="cv-step" key={step.label}>
                  <div className={`cv-dot${step.active ? ' is-active' : ''}${step.final ? ' is-final' : ''}`}>
                    {step.value}
                  </div>
                  <b>{step.label}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="cv-notice">
            <b>메일함을 항상 확인해 주세요</b>
            <p>FYI에서 더 높은 연봉을 받을 수 있는 포지션을 제안 드릴 거예요.</p>
          </div>

          <a className="cv-cta" href="/jobs">
            더 높은 연봉의 포지션 보기 →
          </a>
        </section>
      </main>

      <style jsx>{`
        .cv-page {
          min-height: 100svh;
          padding: 0;
          background:
            radial-gradient(circle at 50% 6%, rgba(255, 90, 0, .1), transparent 25%),
            linear-gradient(180deg, #fffefd 0%, #fffaf6 100%);
          color: #171412;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .cv-shell {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: min(1228px, calc(100% - 48px));
          margin: 0 auto;
          padding: clamp(54px, 7vw, 88px) 0 72px;
        }

        .cv-visual {
          position: relative;
          display: grid;
          place-items: center;
          width: min(430px, 44vw);
          aspect-ratio: 1821 / 864;
          margin-bottom: 10px;
        }

        .cv-celebration-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          mix-blend-mode: multiply;
          filter: drop-shadow(0 18px 36px rgba(255, 90, 0, .12));
          animation: cvPop 900ms cubic-bezier(.16, 1, .3, 1) both;
        }

        h1 {
          margin: 0;
          font-size: clamp(56px, 5.2vw, 78px);
          line-height: 1.02;
          font-weight: 950;
          letter-spacing: -.055em;
          text-align: center;
        }

        .cv-sub {
          margin: 18px 0 0;
          color: #857d77;
          font-size: 23px;
          line-height: 1.45;
          font-weight: 750;
          text-align: center;
        }

        .cv-reward-card {
          width: 100%;
          margin-top: 54px;
          padding: 54px 68px 48px;
          border: 1px solid #eee8e2;
          border-radius: 30px;
          background: rgba(255, 255, 255, .74);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 28px 70px rgba(38, 26, 14, .04);
        }

        .cv-reward-line {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 22px;
          white-space: nowrap;
        }

        .cv-reward-line span {
          color: #8a837d;
          font-size: 28px;
          font-weight: 950;
        }

        .cv-reward-line strong {
          color: #ff5a00;
          font-size: clamp(64px, 7vw, 98px);
          line-height: .95;
          font-weight: 950;
          letter-spacing: -.05em;
        }

        .cv-helper {
          margin: 22px 0 0;
          color: #99918a;
          font-size: 24px;
          font-weight: 760;
          text-align: center;
        }

        .cv-steps {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 30px;
          margin-top: 70px;
        }

        .cv-steps::before {
          content: '';
          position: absolute;
          top: 32px;
          left: 11%;
          right: 11%;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #ff5a00 0 42%, #e6e0da 42% 100%);
        }

        .cv-step {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: center;
          gap: 22px;
        }

        .cv-dot {
          display: grid;
          place-items: center;
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: #fff;
          border: 5px solid #e2ddd8;
          color: #99918a;
          font-size: 26px;
          font-weight: 950;
          box-shadow: 0 0 0 18px rgba(216, 211, 205, .22);
        }

        .cv-dot.is-active {
          border-color: #ff5a00;
          background: #ff5a00;
          color: #fff;
          box-shadow: 0 0 0 18px rgba(255, 90, 0, .16), 0 18px 42px rgba(255, 90, 0, .24);
        }

        .cv-dot.is-final {
          border-color: #e54a00;
          background: #e54a00;
          color: #fff;
          box-shadow: 0 0 0 22px rgba(255, 90, 0, .12);
        }

        .cv-step b {
          color: #8f8780;
          font-size: 24px;
          font-weight: 950;
          text-align: center;
        }

        .cv-step:first-child b,
        .cv-step:last-child b {
          color: #dd3f00;
        }

        .cv-notice {
          width: 100%;
          margin-top: 44px;
          padding: 32px 38px;
          border: 1px solid #eee8e2;
          border-radius: 24px;
          background: rgba(255, 255, 255, .68);
        }

        .cv-notice b {
          display: block;
          margin-bottom: 12px;
          font-size: 25px;
          font-weight: 950;
        }

        .cv-notice p {
          margin: 0;
          color: #746d67;
          font-size: 22px;
          line-height: 1.45;
          font-weight: 700;
        }

        .cv-cta {
          display: grid;
          place-items: center;
          width: 100%;
          min-height: 112px;
          margin-top: 76px;
          border-radius: 18px;
          background: linear-gradient(180deg, #ff650e, #ff5100);
          color: #fff;
          text-decoration: none;
          font-size: 28px;
          font-weight: 950;
          box-shadow: 0 28px 64px rgba(255, 90, 0, .22);
        }

        @keyframes cvPop {
          from {
            opacity: 0;
            transform: translateY(14px) scale(.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 780px) {
          .cv-shell {
            width: calc(100% - 34px);
            padding: 46px 0 42px;
          }

          .cv-visual {
            width: min(300px, 82vw);
          }

          h1 {
            font-size: 42px;
          }

          .cv-sub {
            font-size: 16px;
          }

          .cv-reward-card {
            margin-top: 34px;
            padding: 30px 18px 28px;
            border-radius: 22px;
          }

          .cv-reward-line {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            justify-items: center;
            white-space: normal;
          }

          .cv-reward-line span {
            font-size: 15px;
          }

          .cv-reward-line strong {
            font-size: clamp(42px, 12vw, 48px);
            letter-spacing: -.06em;
          }

          .cv-helper {
            font-size: 15px;
          }

          .cv-steps {
            gap: 8px;
            margin-top: 44px;
          }

          .cv-steps::before {
            top: 23px;
          }

          .cv-dot {
            width: 50px;
            height: 50px;
            font-size: 18px;
            box-shadow: 0 0 0 10px rgba(216, 211, 205, .22);
          }

          .cv-dot.is-active,
          .cv-dot.is-final {
            box-shadow: 0 0 0 10px rgba(255, 90, 0, .14);
          }

          .cv-step b {
            font-size: 14px;
          }

          .cv-notice {
            margin-top: 28px;
            padding: 22px;
          }

          .cv-notice b {
            font-size: 18px;
          }

          .cv-notice p {
            font-size: 15px;
          }

          .cv-cta {
            min-height: 72px;
            margin-top: 38px;
            font-size: 18px;
          }
        }
      `}</style>
    </>
  );
}
