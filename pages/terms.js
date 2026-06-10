import Head from 'next/head';
import { useState } from 'react';

// NOTE for operators: operating entity = Likelion Vietnam; contact placeholder below.
// Governing law set to Vietnam. Have a Vietnamese lawyer review before relying on it.

const CONTACT_EMAIL = 'hello@salary-fyi.com';
const ENTITY = 'Likelion Vietnam';
const EFFECTIVE = '9 June 2026';

const css = `
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#0c0c0b; --bg1:#141413; --bg2:#1c1c1a;
  --line:rgba(255,255,255,0.07);
  --white:#f2f0eb; --mid:rgba(242,240,235,0.62); --dim:rgba(242,240,235,0.2);
  --orange:#ff6000;
}
html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--white); font-family:'Geist',sans-serif; -webkit-font-smoothing:antialiased; }
nav { position:fixed; top:0; left:0; right:0; z-index:200; padding:0 52px; height:56px; display:flex; align-items:center; justify-content:space-between; background:rgba(12,12,11,0.9); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
.logo { font-family:'Geist Mono',monospace; font-size:13px; font-weight:500; color:var(--white); text-decoration:none; }
.logo span { color:var(--orange); }
.nav-r { display:flex; align-items:center; gap:32px; }
.nav-link { font-size:13px; color:var(--mid); text-decoration:none; transition:color .15s; }
.nav-link:hover { color:var(--white); }
.lang-toggle { display:flex; gap:0; border:1px solid var(--line); border-radius:3px; overflow:hidden; }
.lang-btn { font-family:'Geist Mono',monospace; font-size:11px; font-weight:500; padding:6px 12px; background:transparent; color:var(--mid); border:none; cursor:pointer; transition:all .15s; }
.lang-btn.active { background:var(--orange); color:#fff; }
.page { max-width:760px; margin:0 auto; padding:120px 52px 100px; }
.kicker { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:24px; }
.page-h1 { font-size:clamp(30px,4vw,46px); font-weight:800; letter-spacing:-1.5px; line-height:1.1; margin-bottom:14px; }
.page-sub { font-size:14px; color:var(--mid); line-height:1.7; font-weight:300; margin-bottom:56px; }
.section { margin-bottom:44px; padding-bottom:44px; border-bottom:1px solid var(--line); }
.section:last-child { border-bottom:none; }
.section-num { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); margin-bottom:12px; }
.section-title { font-size:20px; font-weight:700; letter-spacing:-.4px; margin-bottom:14px; }
.section-body { font-size:14.5px; color:var(--mid); line-height:1.85; font-weight:300; }
.section-body strong { color:var(--white); font-weight:500; }
.section-body ul { margin:12px 0 0 0; padding-left:18px; }
.section-body li { margin-bottom:7px; }
.section-body a { color:var(--orange); text-decoration:none; }
@media(max-width:768px){
  nav { padding:0 16px; gap:8px; }
  .nav-r { gap:14px; }
  .nav-link { display:none; }
  .page { padding:96px 20px 64px; }
}
`;

function Section({ num, title, children }) {
  return (
    <div className="section">
      <div className="section-num">{num}</div>
      <div className="section-title">{title}</div>
      <div className="section-body">{children}</div>
    </div>
  );
}

const EN = {
  kicker: 'Terms',
  h1: 'Terms of Service',
  sub: `Effective ${EFFECTIVE}. These terms govern your use of SalaryMap, operated by ${ENTITY}. By using the service you agree to them.`,
  sections: [
    {
      num: '01',
      title: 'Acceptance',
      body: <>By accessing or using SalaryMap (the website and mobile app, the “Service”), you agree to these Terms and to our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the Service.</>,
    },
    {
      num: '02',
      title: 'Eligibility',
      body: <>You must be at least 15 years old and a working professional or student to use account features. By creating an account you confirm the information you provide is true and that you have the right to share it.</>,
    },
    {
      num: '03',
      title: 'Accounts',
      body: <>App accounts use <strong>Sign in with Apple</strong>. You are responsible for activity under your account. You may delete your account at any time from within the app.</>,
    },
    {
      num: '04',
      title: 'Your submissions',
      body: (
        <>
          You may submit salary data and post community content. You agree that:
          <ul>
            <li>your submissions are <strong>truthful and accurate</strong> to the best of your knowledge;</li>
            <li>you will <strong>not disclose another person’s</strong> salary or personal data without their consent;</li>
            <li>you will not post confidential information, trade secrets, or anything you are contractually barred from sharing;</li>
            <li>you will not post defamatory, harassing, unlawful, or misleading content.</li>
          </ul>
        </>
      ),
    },
    {
      num: '05',
      title: 'Prohibited conduct',
      body: (
        <>
          You must not: scrape, harvest or bulk-export data; impersonate others; submit fake or
          manipulated salary data; attempt to de-anonymize other users; interfere with or attack the
          Service; or use the Service for any unlawful purpose.
        </>
      ),
    },
    {
      num: '06',
      title: 'Content licence',
      body: (
        <>
          You keep ownership of what you submit. You grant <strong>{ENTITY}</strong> a worldwide,
          royalty-free licence to host, process and display your submissions, including in{' '}
          <strong>aggregated and de-identified</strong> form, to operate and improve the Service.
        </>
      ),
    },
    {
      num: '07',
      title: 'Moderation, reporting & blocking',
      body: (
        <>
          We may review, moderate, and remove content that violates these Terms. The app provides
          tools to <strong>report</strong> and <strong>block</strong> users and content; we act on
          reports of objectionable content. We may suspend or terminate accounts that breach these
          Terms.
        </>
      ),
    },
    {
      num: '08',
      title: 'Disclaimers',
      body: (
        <>
          Salary figures are <strong>user-submitted and aggregated</strong>; we do not guarantee their
          accuracy and they are provided “as is” for informational purposes only. They are not career,
          legal or financial advice. The Service may be unavailable or change at any time.
        </>
      ),
    },
    {
      num: '09',
      title: 'Limitation of liability',
      body: <>To the maximum extent permitted by law, {ENTITY} is not liable for indirect, incidental or consequential damages arising from your use of the Service or reliance on its data.</>,
    },
    {
      num: '10',
      title: 'Termination',
      body: <>You may stop using the Service and delete your account at any time. We may suspend or terminate access if you breach these Terms or where required by law.</>,
    },
    {
      num: '11',
      title: 'Governing law',
      body: <>These Terms are governed by the laws of <strong>Vietnam</strong>. Disputes will be resolved by the competent courts of Vietnam, unless mandatory law provides otherwise.</>,
    },
    {
      num: '12',
      title: 'Changes',
      body: <>We may update these Terms. The current version is always posted here with its effective date; continued use after changes means you accept them.</>,
    },
    {
      num: '13',
      title: 'Contact',
      body: <>{ENTITY} — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>,
    },
  ],
};

const VI = {
  kicker: 'Điều khoản',
  h1: 'Điều khoản Dịch vụ',
  sub: `Hiệu lực từ ${EFFECTIVE}. Điều khoản này điều chỉnh việc bạn sử dụng SalaryMap, do ${ENTITY} vận hành. Khi sử dụng dịch vụ, bạn đồng ý với các điều khoản này.`,
  sections: [
    {
      num: '01',
      title: 'Chấp thuận',
      body: <>Khi truy cập hoặc sử dụng SalaryMap (website và ứng dụng, “Dịch vụ”), bạn đồng ý với Điều khoản này và <a href="/privacy">Chính sách Quyền riêng tư</a>. Nếu không đồng ý, vui lòng không sử dụng Dịch vụ.</>,
    },
    {
      num: '02',
      title: 'Điều kiện sử dụng',
      body: <>Bạn phải từ 15 tuổi trở lên và là người đi làm hoặc sinh viên để dùng các tính năng tài khoản. Khi tạo tài khoản, bạn xác nhận thông tin cung cấp là đúng sự thật và bạn có quyền chia sẻ thông tin đó.</>,
    },
    {
      num: '03',
      title: 'Tài khoản',
      body: <>Tài khoản ứng dụng sử dụng <strong>Đăng nhập bằng Apple</strong>. Bạn chịu trách nhiệm về hoạt động dưới tài khoản của mình. Bạn có thể xóa tài khoản bất cứ lúc nào trong ứng dụng.</>,
    },
    {
      num: '04',
      title: 'Nội dung bạn gửi',
      body: (
        <>
          Bạn có thể gửi dữ liệu lương và đăng nội dung cộng đồng. Bạn đồng ý rằng:
          <ul>
            <li>nội dung bạn gửi là <strong>trung thực và chính xác</strong> theo hiểu biết của bạn;</li>
            <li>bạn <strong>không tiết lộ</strong> lương hoặc dữ liệu cá nhân của người khác khi chưa được họ đồng ý;</li>
            <li>bạn không đăng thông tin mật, bí mật kinh doanh, hay nội dung mà bạn bị ràng buộc hợp đồng không được chia sẻ;</li>
            <li>bạn không đăng nội dung bôi nhọ, quấy rối, vi phạm pháp luật hoặc gây hiểu lầm.</li>
          </ul>
        </>
      ),
    },
    {
      num: '05',
      title: 'Hành vi bị cấm',
      body: <>Bạn không được: thu thập, trích xuất hàng loạt dữ liệu; mạo danh người khác; gửi dữ liệu lương giả hoặc bị thao túng; cố gắng nhận dạng người dùng ẩn danh; can thiệp hoặc tấn công Dịch vụ; hay sử dụng Dịch vụ cho mục đích trái pháp luật.</>,
    },
    {
      num: '06',
      title: 'Giấy phép nội dung',
      body: <>Bạn giữ quyền sở hữu nội dung mình gửi. Bạn cấp cho <strong>{ENTITY}</strong> giấy phép toàn cầu, miễn phí bản quyền để lưu trữ, xử lý và hiển thị nội dung của bạn, bao gồm ở dạng <strong>tổng hợp và đã ẩn danh</strong>, nhằm vận hành và cải thiện Dịch vụ.</>,
    },
    {
      num: '07',
      title: 'Kiểm duyệt, báo cáo & chặn',
      body: <>Chúng tôi có thể xem xét, kiểm duyệt và gỡ bỏ nội dung vi phạm Điều khoản. Ứng dụng cung cấp công cụ để <strong>báo cáo</strong> và <strong>chặn</strong> người dùng, nội dung; chúng tôi xử lý các báo cáo về nội dung không phù hợp và có thể tạm khóa hoặc chấm dứt tài khoản vi phạm.</>,
    },
    {
      num: '08',
      title: 'Miễn trừ trách nhiệm',
      body: <>Số liệu lương là <strong>do người dùng gửi và được tổng hợp</strong>; chúng tôi không bảo đảm tính chính xác và cung cấp “nguyên trạng” chỉ nhằm mục đích tham khảo. Đây không phải là tư vấn nghề nghiệp, pháp lý hay tài chính. Dịch vụ có thể không khả dụng hoặc thay đổi bất cứ lúc nào.</>,
    },
    {
      num: '09',
      title: 'Giới hạn trách nhiệm',
      body: <>Trong phạm vi tối đa pháp luật cho phép, {ENTITY} không chịu trách nhiệm cho các thiệt hại gián tiếp, ngẫu nhiên hoặc hệ quả phát sinh từ việc bạn sử dụng Dịch vụ hoặc dựa vào dữ liệu của Dịch vụ.</>,
    },
    {
      num: '10',
      title: 'Chấm dứt',
      body: <>Bạn có thể ngừng sử dụng Dịch vụ và xóa tài khoản bất cứ lúc nào. Chúng tôi có thể tạm khóa hoặc chấm dứt quyền truy cập nếu bạn vi phạm Điều khoản hoặc khi pháp luật yêu cầu.</>,
    },
    {
      num: '11',
      title: 'Luật áp dụng',
      body: <>Điều khoản này được điều chỉnh bởi pháp luật <strong>Việt Nam</strong>. Tranh chấp sẽ được giải quyết tại tòa án có thẩm quyền của Việt Nam, trừ khi pháp luật bắt buộc quy định khác.</>,
    },
    {
      num: '12',
      title: 'Thay đổi',
      body: <>Chúng tôi có thể cập nhật Điều khoản. Phiên bản hiện hành luôn được đăng tại đây kèm ngày hiệu lực; việc tiếp tục sử dụng sau khi thay đổi đồng nghĩa bạn chấp nhận.</>,
    },
    {
      num: '13',
      title: 'Liên hệ',
      body: <>{ENTITY} — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>,
    },
  ],
};

export default function Terms() {
  const [lang, setLang] = useState('vi');
  const t = lang === 'en' ? EN : VI;
  return (
    <>
      <Head>
        <title>Terms of Service — SalaryMap</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="SalaryMap terms of service — rules for using the salary-transparency service, governed by the laws of Vietnam." />
        <link rel="canonical" href="https://salary-fyi.com/terms" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav>
        <a className="logo" href="/">Salary<span>Map</span>.vn</a>
        <div className="nav-r">
          <a className="nav-link" href="/how-it-works">How it works</a>
          <a className="nav-link" href="/privacy">Privacy</a>
          <div className="lang-toggle">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            <button className={`lang-btn ${lang === 'vi' ? 'active' : ''}`} onClick={() => setLang('vi')}>VI</button>
          </div>
        </div>
      </nav>
      <div className="page">
        <div className="kicker">{t.kicker}</div>
        <h1 className="page-h1">{t.h1}</h1>
        <p className="page-sub">{t.sub}</p>
        {t.sections.map((s) => (
          <Section key={s.num} num={s.num} title={s.title}>
            {s.body}
          </Section>
        ))}
      </div>
    </>
  );
}
