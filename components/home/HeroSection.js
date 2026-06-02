import { useState, useEffect, useRef } from 'react';

const TABS = [
  { key: 'career', label: 'Career' },
  { key: 'network', label: 'Network' },
];

// Tab-specific video sources — add paths when videos are ready
const TAB_VIDEOS = {
  career: ['/interview1.mp4', '/interview2.mp4'],
  network: [],  // e.g. ['/hero-network-1.mp4']
};

const HERO_CONTENT = {
  career: {
    kicker: 'Salary & Jobs in Vietnam IT',
    headline: (
      <>
        Know your worth.<br />
        <span className="hero-accent">Find your next move.</span>
      </>
    ),
    sub: 'Real salary data from real people at top IT companies in Vietnam — plus curated job opportunities matched to your experience.',
    cta: { label: 'Am I underpaid? →', scrollTo: 'submit' },
    ctaSec: { label: 'Browse companies', scrollTo: 'companies' },
  },
  network: {
    kicker: 'Community for IT Professionals',
    headline: (
      <>
        Connect with people<br />
        <span className="hero-accent">who get it.</span>
      </>
    ),
    sub: 'Honest conversations about salary, career growth, and company culture — with verified IT professionals across Vietnam.',
    cta: null,
    comingSoon: true,
  },
};

function HeroCopy({ content, visible }) {
  const handleCta = (scrollTo) => {
    const el = document.getElementById(scrollTo);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`hero-new-copy ${visible ? 'fade-in' : 'fade-out'}`}>
      <div className="hero-new-kicker">
        <span className="kdot" />
        {content.kicker}
      </div>
      <h1 className="hero-new-h1">{content.headline}</h1>
      <p className="hero-new-sub">{content.sub}</p>

      <div className="hero-new-btns">
        {content.cta && (
          <button className="btn-p" onClick={() => handleCta(content.cta.scrollTo)}>
            {content.cta.label}
          </button>
        )}
        {content.ctaSec && (
          <button className="btn-g" onClick={() => handleCta(content.ctaSec.scrollTo)}>
            {content.ctaSec.label}
          </button>
        )}
        {content.comingSoon && (
          <div className="hero-coming-soon">
            <span className="hero-coming-dot" />
            Coming Soon
          </div>
        )}
      </div>
    </div>
  );
}

export default function HeroSection({ activeTab, onTabChange }) {
  const videoRef = useRef(null);
  const videoIdxRef = useRef(0);

  // Play video for current tab, or hide if no videos
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const sources = TAB_VIDEOS[activeTab] || [];
    if (sources.length === 0) {
      vid.removeAttribute('src');
      vid.load();
      return;
    }

    videoIdxRef.current = 0;
    vid.src = sources[0];
    vid.play().catch(() => {});

    const onEnded = () => {
      videoIdxRef.current = (videoIdxRef.current + 1) % sources.length;
      vid.src = sources[videoIdxRef.current];
      vid.play();
    };
    vid.addEventListener('ended', onEnded);
    return () => vid.removeEventListener('ended', onEnded);
  }, [activeTab]);

  const hasVideo = (TAB_VIDEOS[activeTab] || []).length > 0;

  return (
    <section className="hero-new">
      <video
        ref={videoRef}
        muted
        playsInline
        className="hero-new-video"
        style={{ display: hasVideo ? 'block' : 'none' }}
      />

      <div className="hero-new-content">
        {/* Toggle */}
        <div className="hero-toggle">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`hero-toggle-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
          <div
            className="hero-toggle-indicator"
            style={{ transform: activeTab === 'network' ? 'translateX(100%)' : 'translateX(0)' }}
          />
        </div>

        {/* Both copies always rendered, CSS handles visibility */}
        <div className="hero-copy-stack">
          <HeroCopy content={HERO_CONTENT.career} visible={activeTab === 'career'} />
          <HeroCopy content={HERO_CONTENT.network} visible={activeTab === 'network'} />
        </div>
      </div>

      <style jsx>{heroStyles}</style>
    </section>
  );
}

const heroStyles = `
  .hero-new {
    position: relative;
    height: 100vh;
    overflow: hidden;
    background: #0c0c0b;
  }

  .hero-new-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.3;
    z-index: 0;
  }

  .hero-new-content {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 80px 52px 80px 96px;
    max-width: 760px;
  }

  /* Toggle */
  .hero-toggle {
    position: relative;
    display: inline-flex;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 40px;
    width: fit-content;
  }

  .hero-toggle-btn {
    position: relative;
    z-index: 2;
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: rgba(242, 240, 235, 0.4);
    background: none;
    border: none;
    padding: 10px 28px;
    cursor: pointer;
    transition: color 0.25s ease;
    width: 130px;
    text-align: center;
  }

  .hero-toggle-btn.active {
    color: #fff;
  }

  .hero-toggle-btn:hover:not(.active) {
    color: rgba(242, 240, 235, 0.65);
  }

  .hero-toggle-indicator {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 130px;
    height: calc(100% - 8px);
    background: rgba(255, 96, 0, 0.4);
    border: 1px solid rgba(255, 96, 0, 0.7);
    border-radius: 6px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
  }

  /* Copy stack — both layers overlap, CSS toggles visibility */
  .hero-copy-stack {
    position: relative;
  }

  .hero-new-copy {
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: none;
  }

  .hero-new-copy:not(:first-child) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  .hero-new-copy.fade-in {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .hero-new-copy.fade-out {
    opacity: 0;
    transform: translateY(8px);
  }

  .hero-new-kicker {
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: #ff6000;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .hero-new-h1 {
    font-size: clamp(36px, 4.5vw, 60px);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -2px;
    margin-bottom: 24px;
    color: #f2f0eb;
  }

  .hero-accent {
    color: #ff6000;
  }

  .hero-new-sub {
    font-size: 16px;
    color: rgba(242, 240, 235, 0.45);
    line-height: 1.8;
    font-weight: 300;
    max-width: 440px;
    margin-bottom: 40px;
  }

  .hero-new-btns {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Coming Soon badge */
  .hero-coming-soon {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: 'Geist Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    color: rgba(242, 240, 235, 0.5);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 12px 24px;
    border-radius: 6px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .hero-coming-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff6000;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 4px #ff6000; }
    50% { opacity: 0.4; box-shadow: 0 0 12px #ff6000; }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .hero-new-content {
      padding: 100px 24px 60px;
      max-width: 100%;
    }

    .hero-toggle-btn {
      font-size: 13px;
      padding: 8px 20px;
      width: 110px;
    }

    .hero-toggle-indicator {
      width: 110px;
    }

    .hero-new-h1 {
      font-size: clamp(28px, 7vw, 42px);
      letter-spacing: -1px;
    }

    .hero-new-sub {
      font-size: 14px;
    }
  }

  @media (max-width: 480px) {
    .hero-new-content {
      padding: 90px 20px 40px;
    }

    .hero-toggle-btn {
      width: 96px;
      padding: 8px 16px;
      font-size: 12px;
    }

    .hero-toggle-indicator {
      width: 96px;
    }
  }
`;
