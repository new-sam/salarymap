import Head from 'next/head';
import { useT } from '../lib/i18n';

const css = `
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#0c0c0b; --bg1:#141413; --bg2:#1c1c1a;
  --line:rgba(255,255,255,0.07);
  --white:#f2f0eb; --mid:rgba(242,240,235,0.42); --dim:rgba(242,240,235,0.2);
  --orange:#ff6000;
}
html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--white); font-family:'Geist',sans-serif; -webkit-font-smoothing:antialiased; }
nav { position:fixed; top:0; left:0; right:0; z-index:200; padding:0 52px; height:56px; display:flex; align-items:center; justify-content:space-between; background:#0c0c0b; border-bottom:1px solid var(--line); }
.logo { display:flex; align-items:center; gap:10px; font-family:'Barlow',sans-serif; font-size:13px; font-weight:400; color:var(--white); text-decoration:none; letter-spacing:-0.08px; }
.logo img { width:28px; height:28px; object-fit:contain; }
.logo em { color:var(--orange); font-style:normal; }
.nav-r { display:flex; align-items:center; gap:32px; }
.nav-link { font-family:'Barlow',sans-serif; font-size:14px; color:var(--white); text-decoration:none; transition:color .15s; }
.nav-link:hover { color:var(--orange); }
.nav-link.active { color:var(--orange); }
.nav-btn { font-family:'Barlow',sans-serif; font-size:13px; font-weight:600; background:var(--orange); color:#fff; border:none; padding:8px 18px; border-radius:100px; cursor:pointer; }
.page { max-width:720px; margin:0 auto; padding:120px 52px 80px; }
.kicker { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:24px; }
.page-h1 { font-size:clamp(32px,4vw,52px); font-weight:800; letter-spacing:-2px; line-height:1.08; margin-bottom:16px; }
.page-sub { font-size:16px; color:var(--mid); line-height:1.8; font-weight:300; margin-bottom:64px; }
.section { margin-bottom:56px; padding-bottom:56px; border-bottom:1px solid var(--line); }
.section:last-child { border-bottom:none; }
.section-num { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); margin-bottom:12px; }
.section-title { font-size:22px; font-weight:700; letter-spacing:-.5px; margin-bottom:16px; }
.section-body { font-size:15px; color:var(--mid); line-height:1.9; font-weight:300; }
.section-body a { color:var(--orange); text-decoration:none; }
@media(max-width:768px){
  nav { padding:0 16px; gap:8px; }
  .nav-r { gap:14px; }
  .nav-link { display:none; }
  .page { padding:100px 20px 60px; }
}
`;

const EN = {
  navHome: 'Home',
  navHow: 'How it works',
  navCta: 'Submit Salary',
  kicker: 'Transparency',
  h1: 'How SalaryMap works',
  sub: "Transparent, anonymous, and built for Vietnam's IT community.",
  sections: [
    {
      num: '01',
      title: 'How we collect data',
      body: <>On the website, engineers submit their salary anonymously — no account required, just role, experience level, and monthly salary. In the mobile app, you can optionally create an account (Sign in with Apple) to access community and profile features; account data is collected only with your consent. See our <a href="/privacy">Privacy Policy</a>.</>,
    },
    {
      num: '02',
      title: 'How we verify data',
      body: <>All submissions are cross-referenced with ITviec 2024–2025 market benchmarks. Outliers are flagged and reviewed. Companies with fewer than 3 submissions show ranges only — never individual figures.</>,
    },
    {
      num: '03',
      title: 'What we never do',
      body: <>We never sell your data to recruiters or companies. We never show individual identified salaries — only aggregated ranges per company. Website submissions stay anonymous, and any account data you provide in the app is used only to run the service, never sold.</>,
    },
    {
      num: '04',
      title: 'Who built this',
      body: <>SalaryMap is built by Likelion Vietnam, a tech education company that has worked with thousands of Vietnamese developers since 2020. We built this because salary transparency benefits everyone in the ecosystem.</>,
    },
  ],
};

const KO = {
  navHome: '홈',
  navHow: '서비스 안내',
  navCta: '연봉 제출하기',
  kicker: '투명성',
  h1: 'SalaryMap은 이렇게 작동합니다',
  sub: '베트남 IT 커뮤니티를 위해 만든 투명하고 익명성이 보장된 서비스입니다.',
  sections: [
    {
      num: '01',
      title: '데이터를 어떻게 모으나요',
      body: <>웹사이트에서는 개발자가 익명으로 연봉을 제출합니다 — 계정 없이 직무, 경력, 월 급여만 입력하면 됩니다. 모바일 앱에서는 선택적으로 계정(Apple 로그인)을 만들어 커뮤니티·프로필 기능을 이용할 수 있고, 계정 정보는 동의를 받은 경우에만 수집합니다. 자세한 내용은 <a href="/privacy">개인정보 처리방침</a>을 참고해 주세요.</>,
    },
    {
      num: '02',
      title: '데이터를 어떻게 검증하나요',
      body: <>제출된 모든 데이터는 ITviec 2024–2025 시장 벤치마크와 교차 검증됩니다. 이상치는 따로 표시해 검토합니다. 제출 건수가 3건 미만인 회사는 개별 수치 없이 범위만 노출합니다.</>,
    },
    {
      num: '03',
      title: '절대 하지 않는 것',
      body: <>채용 담당자나 회사에 사용자의 데이터를 판매하지 않습니다. 식별 가능한 개인 연봉은 절대 표시하지 않으며, 회사별 합산 범위만 보여줍니다. 웹사이트 제출 데이터는 익명을 유지하고, 앱에서 제공한 계정 정보는 서비스 운영에만 사용되며 제3자에게 판매되지 않습니다.</>,
    },
    {
      num: '04',
      title: '누가 만들었나요',
      body: <>SalaryMap은 2020년부터 베트남 개발자 수천 명과 함께해 온 테크 교육 기업 Likelion Vietnam이 만들었습니다. 연봉 투명성이 생태계 모두에게 이롭다고 믿고 만든 서비스입니다.</>,
    },
  ],
};

const VI = {
  navHome: 'Trang chủ',
  navHow: 'Cách hoạt động',
  navCta: 'Gửi mức lương',
  kicker: 'Minh bạch',
  h1: 'SalaryMap hoạt động thế nào',
  sub: 'Minh bạch, ẩn danh, và được xây dựng cho cộng đồng IT Việt Nam.',
  sections: [
    {
      num: '01',
      title: 'Cách chúng tôi thu thập dữ liệu',
      body: <>Trên website, các kỹ sư gửi mức lương của mình một cách ẩn danh — không cần tài khoản, chỉ cần vị trí, cấp độ kinh nghiệm và mức lương hàng tháng. Trong ứng dụng di động, bạn có thể tùy chọn tạo tài khoản (Đăng nhập bằng Apple) để dùng các tính năng cộng đồng và hồ sơ; dữ liệu tài khoản chỉ được thu thập khi bạn đồng ý. Xem <a href="/privacy">Chính sách Quyền riêng tư</a> của chúng tôi.</>,
    },
    {
      num: '02',
      title: 'Cách chúng tôi xác minh dữ liệu',
      body: <>Mọi dữ liệu gửi lên đều được đối chiếu với mức chuẩn thị trường ITviec 2024–2025. Các giá trị bất thường được đánh dấu và xem xét. Công ty có ít hơn 3 lượt gửi chỉ hiển thị khoảng lương — không bao giờ hiển thị con số cá nhân.</>,
    },
    {
      num: '03',
      title: 'Những điều chúng tôi không bao giờ làm',
      body: <>Chúng tôi không bao giờ bán dữ liệu của bạn cho nhà tuyển dụng hay công ty. Chúng tôi không bao giờ hiển thị mức lương cá nhân có thể nhận dạng — chỉ hiển thị khoảng lương tổng hợp theo từng công ty. Dữ liệu gửi qua website luôn ẩn danh, và mọi dữ liệu tài khoản bạn cung cấp trong ứng dụng chỉ được dùng để vận hành dịch vụ, không bao giờ bị bán.</>,
    },
    {
      num: '04',
      title: 'Ai xây dựng nền tảng này',
      body: <>SalaryMap được xây dựng bởi Likelion Vietnam, một công ty giáo dục công nghệ đã làm việc với hàng nghìn lập trình viên Việt Nam từ năm 2020. Chúng tôi xây dựng nền tảng này vì sự minh bạch về lương mang lại lợi ích cho mọi người trong hệ sinh thái.</>,
    },
  ],
};

export default function HowItWorks() {
  // Drive locale from the global LanguageSwitcher (footer).
  const { lang } = useT();
  const t = lang === 'ko' ? KO : lang === 'en' ? EN : VI;
  return (
    <>
      <Head>
        <title>How It Works — FYI Salary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="How FYI Salary collects, verifies, and displays Vietnam IT salary data. Anonymous submissions, real-time results." />
        <meta property="og:title" content="How It Works — FYI Salary" />
        <meta property="og:description" content="How FYI Salary collects, verifies, and displays Vietnam IT salary data." />
        <meta property="og:image" content="https://salary-fyi.com/og-image.png" />
        <link rel="canonical" href="https://salary-fyi.com/how-it-works" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav>
        <a className="logo" href="/">
          <img src="/logo.png" alt="FYI" />
          <span>FOR YOUR <em>'SALARY'</em> INFORMATION</span>
        </a>
        <div className="nav-r">
          <a className="nav-link" href="/">{t.navHome}</a>
          <a className="nav-link active" href="/how-it-works">{t.navHow}</a>
          <button className="nav-btn" onClick={() => { window.location.href = '/' }}>{t.navCta}</button>
        </div>
      </nav>
      <div className="page">
        <div className="kicker">{t.kicker}</div>
        <h1 className="page-h1">{t.h1}</h1>
        <p className="page-sub">{t.sub}</p>
        {t.sections.map((s) => (
          <div className="section" key={s.num}>
            <div className="section-num">{s.num}</div>
            <div className="section-title">{s.title}</div>
            <div className="section-body">{s.body}</div>
          </div>
        ))}
      </div>
    </>
  );
}
