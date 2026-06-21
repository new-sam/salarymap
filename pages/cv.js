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
            <div className="cv-glow" />
            <div className="cv-burst" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="cv-fyi-mark">FY<i /></div>
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
          width: 240px;
          height: 142px;
          margin-bottom: 4px;
        }

        .cv-glow {
          position: absolute;
          inset: 34px 10px 4px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255, 90, 0, .18), transparent 68%);
          filter: blur(18px);
        }

        .cv-fyi-mark {
          position: relative;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f8efe7;
          font-size: 66px;
          line-height: .88;
          font-weight: 950;
          letter-spacing: -.08em;
          text-shadow:
            0 2px 0 #cf4200,
            0 6px 0 #a92d00,
            0 18px 34px rgba(255, 90, 0, .28);
          animation: cvPop 900ms cubic-bezier(.16, 1, .3, 1) both;
        }

        .cv-fyi-mark i {
          display: block;
          width: 30px;
          height: 62px;
          border-radius: 8px;
          background: linear-gradient(135deg, #ffb165 0 24%, #ff5a00 25% 62%, #b53200 63% 100%);
          transform: skewX(-18deg) translateY(4px);
          box-shadow: 0 14px 24px rgba(255, 90, 0, .28);
        }

        .cv-burst {
          position: absolute;
          z-index: 1;
          width: 178px;
          height: 94px;
        }

        .cv-burst span {
          position: absolute;
          display: block;
          border-radius: 999px;
          background: #ff8a2a;
          opacity: .86;
        }

        .cv-burst span:nth-child(1) { left: 36px; top: 20px; width: 7px; height: 34px; transform: rotate(-34deg); }
        .cv-burst span:nth-child(2) { right: 32px; top: 24px; width: 7px; height: 34px; transform: rotate(34deg); }
        .cv-burst span:nth-child(3) { left: 82px; top: 0; width: 7px; height: 44px; background: #ffc15d; }
        .cv-burst span:nth-child(4) { left: 22px; bottom: 22px; width: 10px; height: 10px; background: #4f8dff; }
        .cv-burst span:nth-child(5) { right: 18px; bottom: 25px; width: 10px; height: 10px; background: #ff5b5b; }

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
            width: 190px;
            height: 112px;
          }

          .cv-fyi-mark {
            font-size: 50px;
          }

          .cv-fyi-mark i {
            width: 22px;
            height: 48px;
            border-radius: 6px;
          }

          .cv-burst {
            width: 146px;
            height: 78px;
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
