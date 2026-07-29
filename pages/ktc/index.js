import Head from 'next/head';
import AboutUs from '../../components/ktc/AboutUs';
import Advantage from '../../components/ktc/Advantage';
import Benefits from '../../components/ktc/Benefits';
import ComingSoonModal from '../../components/ktc/ComingSoonModal';
import Faq from '../../components/ktc/Faq';
import Hero from '../../components/ktc/Hero';
import ImageGallery from '../../components/ktc/ImageGallery';
import JobBoard from '../../components/ktc/JobBoard';
import KtcNav from '../../components/ktc/KtcNav';
import Organization from '../../components/ktc/Organization';
import Participants from '../../components/ktc/Participants';
import Process from '../../components/ktc/Process';
import ZaloGroup from '../../components/ktc/ZaloGroup';
import { c } from '../../components/ktc/ktcStyles';

/* K-Tech College 2026 랜딩.
   섹션 순서는 원본 ktc-landing(src/app/page.tsx)과 동일하게 유지하고,
   비주얼만 FYI 다크 컨셉으로 옮겼다. */
export default function KtcLanding() {
  return (
    <>
      <Head>
        <title>K-Tech College 2026 | 한국 기업 IT 리모트 채용 프로그램</title>
        <meta
          name="description"
          content="베트남의 우수한 IT 인재를 선발·교육해 한국 테크 기업과 연결하는 K-Tech College 2026. 한국 정부 지원, LIKELION 운영."
        />
      </Head>

      <div className="ktc-page" style={{ background: c.bg, color: c.text, minHeight: '100vh' }}>
        <KtcNav />
        <Hero />
        <AboutUs />
        <Organization />
        <Advantage />
        <Participants />
        <JobBoard />
        <Benefits />
        <Process />
        <ImageGallery />
        <Faq />
        <ZaloGroup />
      </div>

      <ComingSoonModal />

      <style>{`
        /* 섹션 탭바 — FYI GlobalNav(데스크톱 sticky 56px / 모바일 fixed 52px) 바로 아래.
           fixed 로 띄워야 탭바가 나타날 때 본문이 밀려 내려가는 점프가 없다.
           .ktc-anchor 오프셋은 항상 헤더 + 탭바 높이와 같아야 앵커 점프 시 제목이 안 가린다.
           (모바일 상단 여백은 globals.css 의 body padding-top:52px 이 담당) */
        .ktc-sectiontabs { position: fixed; top: 56px; left: 0; right: 0; z-index: 190; }
        .ktc-tabs-row { height: 46px; }
        .ktc-anchor { scroll-margin-top: 102px; }   /* 56 + 46 */

        /* 히어로 배경 사진은 쓰지 않는다 — 잘려서 맥락 없이 보이고 글자 대비만 떨어진다.
           오렌지 글로우 베일만 남긴다. 요소는 남겨둬서 다시 켜기 쉽게. */
        .ktc-hero-bg { display: none; }

        /* 히어로 — 배지/타이틀/로고 스트립 치수 */
        .ktc-hero-inner { --ktc-hero-pt: clamp(64px, 11vw, 130px); --ktc-hero-pb: clamp(56px, 9vw, 110px); }
        .ktc-hero-stack { display: flex; flex-direction: column; }
        /* flex 아이템이 되면 inline-flex 배지가 가로로 늘어난다 — 콘텐츠 폭 유지 */
        .ktc-hero-badge { align-self: center; gap: 8px; padding: 7px 14px; font-size: 12px; }
        .ktc-hero-badge-dot { width: 6px; height: 6px; }
        .ktc-hero-title { margin-top: 26px; font-size: clamp(30px, 5.6vw, 60px); }
        /* 4개 로고를 grid 로 고정 — flex-wrap 이면 3+1 로 갈릴 수 있다.
           기본은 2열 2줄(auto 열 + 가운데 정렬이라 칸이 로고 폭에 맞는다),
           768px 이상에서 4열 한 줄. 4열은 셀이 충분히 넓은 폭에서만 쓴다. */
        /* 모바일: 한 줄 롤링 — 2열 2줄이면 세로를 너무 먹는다. 목록을 두 번 이어
           붙였으므로 -50% 이동이 한 바퀴(.ktc-marquee 키프레임 재사용). */
        .ktc-hero-logostrip {
          order: 2;           /* CTA 아래 */
          margin-top: 34px;
          overflow: hidden;
          mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
        }
        .ktc-hero-logos {
          display: flex;
          width: max-content;
          align-items: center;
          gap: 34px;
          opacity: 0.62;
          animation: ktc-marquee 24s linear infinite;
        }
        .ktc-hero-logocell { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
        .ktc-hero-logo { height: var(--ktc-logo-hm); max-width: 100%; object-fit: contain; }

        /* 데스크톱 전용 규칙 — 인라인 style 로는 표현할 수 없는 미디어 쿼리만 여기에 둔다. */
        .ktc-nav-links { display: none; }
        .ktc-split { flex-wrap: wrap; }
        .ktc-grid-2, .ktc-grid-3 { grid-template-columns: 1fr; }
        /* 공고 목록 — 상세는 /ktc/jobs/[id] 페이지로 전환하므로 카드 그리드만 남는다 */
        .ktc-job-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 18px; }
        .ktc-job-card:hover { border-color: rgba(255,96,0,0.45) !important; box-shadow: 0 6px 18px rgba(17,24,39,0.10) !important; }
        /* 주관 기관 — 모바일에서도 2x2 를 유지하고 설명만 감춘다.
           로고·기관명은 유지 (해외 채용 신뢰도 판단의 핵심 정보).
           칸이 좁아지므로 로고·기관명을 한 단계 줄인다. */
        .ktc-org-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: clamp(28px, 4vw, 56px);
        }
        .ktc-org-item { padding: 16px 12px !important; }
        /* 로고 자리 — 배경판 없이 흰색 단색 로고만 (밝은 판은 대비가 너무 세다) */
        .ktc-org-plate { height: 46px; display: flex; align-items: center; justify-content: center; }
        .ktc-org-logo { height: var(--ktc-logo-hm); }
        /* keep-all — 없으면 "잡코리아"가 "잡코리 / 아"로 잘린다. */
        .ktc-org-title { margin-top: 14px; font-size: 12.5px; word-break: keep-all; }
        .ktc-org-desc { display: none; }

        /* 맨 아래 Zalo 섹션이 자체 아래 패딩(80px)을 갖고 있어 GlobalFooter 의 marginTop 은 끈다
           — 안 그러면 120:136 이 돼서 맞춰둔 위:아래 비율이 무너진다. */
        .gfooter { margin-top: 0 !important; }

        /* Zalo 그룹 — 카드 없이 QR + 텍스트만. 좁은 화면에서는 QR 을 위로 올린다.
           fit-content + auto 마진 — 텍스트는 왼쪽 정렬로 두되 QR+텍스트 덩어리 자체는
           가운데. (그냥 두면 1180 컨테이너 왼쪽 끝에 붙어 오른쪽이 텅 빈다.) */
        .ktc-zalo {
          display: flex; flex-direction: column; align-items: flex-start;
          gap: 24px;
          width: fit-content; max-width: 100%;
          margin-left: auto; margin-right: auto;
        }
        .ktc-zalo-qr { width: 140px; height: 140px; }
        .ktc-zalo-title { font-size: 21px; }
        .ktc-zalo-desc { font-size: 14px; }
        @media (min-width: 600px) {
          .ktc-zalo { flex-direction: row; align-items: center; gap: 36px; }
          .ktc-zalo-qr { width: 176px; height: 176px; }
          .ktc-zalo-title { font-size: 24px; }
          .ktc-zalo-desc { font-size: 15px; max-width: 420px; }
        }

        /* 참가 혜택 — 1행 3열 세로 카드. 이미지는 카드 상단 배너처럼 고정 높이로 자른다. */
        .ktc-benefit-img { height: clamp(150px, 26vw, 200px); }

        /* 차별점 — 원본처럼 좌측 정렬 카드 + 작은 사각 아이콘 박스.
           1180 컨테이너를 꽉 채우면 카드가 가로로 늘어져 제목이 한 줄로 붙으므로 900 으로 좁힌다. */
        .ktc-adv-grid { max-width: 900px; margin-left: auto; margin-right: auto; }
        .ktc-adv-card { padding: clamp(26px, 3.4vw, 34px) clamp(22px, 3vw, 30px); }
        .ktc-adv-icon {
          width: 46px; height: 46px; margin-bottom: 24px;
          display: grid; place-items: center;
          border-radius: 12px; background: rgba(255,96,0,0.10); color: #ff6000;
        }
        .ktc-adv-icon svg { width: 21px; height: 21px; }
        .ktc-adv-title { font-size: 17px; }
        .ktc-adv-desc { margin-top: 10px; font-size: 14px; }

        /* 여정 — 데스크톱은 번호 위 / 텍스트 아래, 가운데 정렬. */
        .ktc-proc-card { text-align: center; }
        .ktc-proc-num { display: block; font-size: 44px; }
        .ktc-proc-text { margin-top: 20px; }
        .ktc-proc-title { font-size: 17.5px; }
        .ktc-proc-desc { margin-top: 10px; font-size: 14px; }

        /* 참가 대상 — 모바일은 탭으로 하나씩, 데스크톱은 2단 전개(아래 900px 블록). */
        .ktc-part-wrap { max-width: 640px; margin: 0 auto; }
        .ktc-part-grid { display: grid; gap: 18px; grid-template-columns: 1fr; margin-top: 18px; }
        .ktc-part-badge { display: none; }

        /* 모바일 GlobalNav 는 52px fixed — 탭바를 그 아래로 내린다. */
        @media (max-width: 768px) {
          .ktc-sectiontabs { top: 52px; }
          .ktc-tabs-row { height: 40px; }
          .ktc-anchor { scroll-margin-top: 92px; }  /* 52 + 40 */
        }

        @media (max-width: 480px) {
          .ktc-tabs-row button { padding: 0 11px !important; font-size: 12.5px !important; }
          /* 히어로 CTA — 300px 화면에서 세로로 쌓이면 기본 패딩이 너무 두껍다. */
          .ktc-hero-btn { padding: 11px 18px !important; font-size: 13.5px !important; }
          /* 세로 여백은 기본 clamp 그대로 둔다(390px 에서 64px) — 배지만 축소. */
          .ktc-hero-badge { gap: 6px; padding: 5px 10px; font-size: 10.5px; }
          .ktc-hero-badge-dot { width: 5px; height: 5px; }
          .ktc-hero-title { margin-top: 16px; }

          /* 차별점 — 카드 4장이 세로로 쌓이므로 여백·글자를 한 단계 줄인다. */
          .ktc-adv-grid { gap: 12px !important; }
          .ktc-adv-card { padding: 20px 18px; }
          .ktc-adv-icon { width: 38px; height: 38px; margin-bottom: 14px; border-radius: 10px; }
          .ktc-adv-icon svg { width: 18px; height: 18px; }
          .ktc-adv-title { font-size: 15px !important; }
          .ktc-adv-desc { margin-top: 8px; font-size: 13px !important; }

          /* 여정 — 번호를 왼쪽으로 눕혀 단계 목록처럼. 카드 높이가 절반 이하로 준다. */
          .ktc-proc-grid { gap: 10px !important; }
          .ktc-proc-card { display: flex; align-items: flex-start; gap: 14px; text-align: left; padding: 15px 16px !important; }
          .ktc-proc-num { flex: 0 0 34px; font-size: 28px !important; }
          .ktc-proc-text { margin-top: 0; min-width: 0; }
          .ktc-proc-title { font-size: 14.5px !important; }
          .ktc-proc-desc { margin-top: 5px; font-size: 13px !important; }
        }

        @media (min-width: 768px) {
          .ktc-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ktc-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .ktc-job-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }

          /* 히어로 로고 — 넓어지면 롤링을 멈추고 4열 한 줄 grid 로 고정 */
          /* 넓은 화면에서도 CTA 아래에 둔다 — 롤링만 멈추고 4열 grid 로 고정 */
          .ktc-hero-logostrip { margin-top: clamp(40px, 6vw, 64px); overflow: visible; mask-image: none; -webkit-mask-image: none; }
          .ktc-hero-logos {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            width: auto;
            gap: 0;
            column-gap: clamp(16px, 3vw, 40px);
            animation: none;
          }
          .ktc-hero-logo-dup { display: none; }
          .ktc-hero-logo { height: var(--ktc-logo-h); }

          /* 주관 기관 — 넓은 화면에서는 카드를 키우고 설명까지 전개 */
          .ktc-org-grid { gap: 18px; margin-top: clamp(32px, 5vw, 56px); }
          .ktc-org-item { padding: clamp(22px, 3vw, 32px) !important; }
          .ktc-org-plate { height: 64px; }
          .ktc-org-logo { height: var(--ktc-logo-h); }
          .ktc-org-title { margin-top: 18px; font-size: 16.5px; }
          .ktc-org-desc { display: block; }
        }

        @media (min-width: 900px) {
          .ktc-nav-links { display: flex; }
          .ktc-split { flex-wrap: nowrap; }
          /* 소개 — 좌우 2단이 되는 폭부터 제목을 한 줄로 고정한다.
             텍스트 칸이 제목보다 좁아지지 않으므로(min-width:auto) 이미지 쪽이 대신 줄어든다. */
          .ktc-about-title { white-space: nowrap; }

          /* 참가 대상 — 탭바를 감추고 Non-IT/IT 를 2단으로 편다. 카드의 inline
             display 는 선택된 탭만 보이게 하므로 !important 로 덮어써야 한다. */
          .ktc-part-wrap { max-width: 940px; }
          .ktc-part-tabs { display: none !important; }
          .ktc-part-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: clamp(32px, 5vw, 56px); }
          .ktc-part-card { display: block !important; }
          /* 공통 카드는 데스크톱에서 감춘다 — 위 block 규칙보다 뒤에 와야 이긴다. */
          .ktc-part-card-common { display: none !important; }
          .ktc-part-badge { display: inline-flex; }
        }

        /* 섹션 탭바 — 히어로 CTA가 화면 밖으로 나갈 때 나타난다. */
        .ktc-sectiontabs { animation: ktc-fade-in .25s cubic-bezier(0.16,1,0.3,1) both; }
        /* 모바일에서 탭이 넘칠 때 가로 스크롤은 되지만 스크롤바는 감춘다. */
        .ktc-sectiontabs > div { scrollbar-width: none; -ms-overflow-style: none; }
        .ktc-sectiontabs > div::-webkit-scrollbar { display: none; }
        @keyframes ktc-fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: none; }
        }

        /* 갤러리 무한 스크롤 — 목록을 두 번 이어 붙였으므로 -50% 이동이 한 바퀴. */
        .ktc-marquee-left { animation: ktc-marquee 46s linear infinite; }
        .ktc-marquee-right { animation: ktc-marquee 46s linear infinite reverse; }
        @keyframes ktc-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ktc-marquee, .ktc-hero-logos { animation: none !important; }
        }

        /* 다크 배경 위 select 드롭다운이 흰 배경으로 뜨는 것 방지 */
        .ktc-page select option { background: ${c.bgAlt}; color: ${c.text}; }
      `}</style>
    </>
  );
}
