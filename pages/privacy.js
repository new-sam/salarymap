import Head from 'next/head';
import { useT } from '../lib/i18n';

// NOTE for operators:
//  - Operating entity: Likelion Vietnam (data controller).
//  - Contact email below is a placeholder — create privacy@salary-fyi.com (or change it).
//  - Data is stored on Supabase (hosted outside Vietnam, Singapore region). Confirm the exact
//    region in your Supabase project settings and update §7 if it differs.
//  - This is a compliance-oriented template aligned with Vietnam Decree 13/2023/ND-CP and the
//    Personal Data Protection Law (Law 91/2025/QH15, effective 2026-01-01). Have a Vietnamese
//    lawyer review before relying on it — salary data is sensitive.

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
nav { position:fixed; top:0; left:0; right:0; z-index:200; padding:0 52px; height:56px; display:flex; align-items:center; justify-content:space-between; background:#0c0c0b; border-bottom:1px solid var(--line); }
.logo { display:flex; align-items:center; gap:10px; font-family:'Barlow',sans-serif; font-size:13px; font-weight:400; color:var(--white); text-decoration:none; letter-spacing:-0.08px; }
.logo img { height:24px; width:auto; object-fit:contain; }
.logo em { color:var(--orange); font-style:normal; }
.nav-r { display:flex; align-items:center; gap:32px; }
.nav-link { font-family:'Barlow',sans-serif; font-size:14px; color:var(--white); text-decoration:none; transition:color .15s; }
.nav-link:hover { color:var(--orange); }
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
  kicker: 'Privacy',
  h1: 'Privacy Policy',
  sub: `Effective ${EFFECTIVE}. This policy explains what personal data SalaryMap (operated by ${ENTITY}) collects, how we use it, and your rights under Vietnamese law.`,
  sections: [
    {
      num: '01',
      title: 'Who we are',
      body: (
        <>
          SalaryMap (“we”, “us”) is a salary-transparency service for Vietnam’s tech community,
          operated by <strong>{ENTITY}</strong>, which acts as the <strong>data controller</strong>{' '}
          (Bên Kiểm soát dữ liệu) of your personal data. For any privacy question or to exercise your
          rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </>
      ),
    },
    {
      num: '02',
      title: 'Scope — website vs. app',
      body: (
        <>
          <strong>Website (salary-fyi.com):</strong> salary submissions can be made{' '}
          <strong>anonymously, without an account</strong> — we collect only the salary data you
          choose to enter (role, level, salary).
          <br />
          <br />
          <strong>Mobile app:</strong> you may create an optional account to access community and
          profile features. Accounts collect additional personal data, described below.
        </>
      ),
    },
    {
      num: '03',
      title: 'What we collect',
      body: (
        <>
          <ul>
            <li>
              <strong>Account data</strong> — when you sign in with Apple: your email address (or
              Apple’s private relay address), display name (if shared), and a user identifier.
            </li>
            <li>
              <strong>Profile data</strong> — company, job title/position, salary figures, years of
              experience, education/school, age and level — only what you choose to enter.
            </li>
            <li>
              <strong>Verification data</strong> — your company or school email address, used solely
              to verify employment/student status.
            </li>
            <li>
              <strong>User-generated content</strong> — salary submissions, community posts and
              comments, job applications, bookmarks, reports and feedback you send us.
            </li>
            <li>
              <strong>Technical data</strong> — device information, app usage, log/IP data, and your
              push-notification token if you enable notifications.
            </li>
            <li>
              <strong>AI auto-fill data</strong> — if you use the profile auto-fill feature, the text
              you provide is sent to a third-party AI provider to structure your profile.
            </li>
          </ul>
        </>
      ),
    },
    {
      num: '04',
      title: 'How we use your data',
      body: (
        <>
          We use personal data to: provide and operate the service; show{' '}
          <strong>aggregated</strong> salary statistics (we never publish individual identified
          salaries — companies with too few submissions show ranges only); verify employment/student
          status; send notifications you opt into; power profile auto-fill; and keep the community
          safe (moderation, reporting and blocking). We process data for these purposes and no other.
        </>
      ),
    },
    {
      num: '05',
      title: 'Legal basis & consent',
      body: (
        <>
          We process your personal data based on <strong>your consent</strong>, which you give before
          collection (e.g. at sign-up and when submitting data), and where permitted on other legal
          bases under Vietnam’s Personal Data Protection Law (Law 91/2025/QH15) and Decree
          13/2023/ND-CP. Your consent is voluntary and specific to the purposes above. You can{' '}
          <strong>withdraw consent at any time</strong> by deleting your account or contacting us;
          withdrawal does not affect processing already carried out.
        </>
      ),
    },
    {
      num: '06',
      title: 'Sharing & third parties',
      body: (
        <>
          We <strong>never sell your personal data</strong>, and we never share it with recruiters or
          employers in identifiable form. We share data only with service providers who process it on
          our behalf:
          <ul>
            <li>
              <strong>Supabase</strong> — database and hosting (stores your account, profile and
              content).
            </li>
            <li>
              <strong>Apple</strong> — Sign in with Apple, and Apple Push Notification service for
              notifications.
            </li>
            <li>
              <strong>AI provider</strong> — only when you use the auto-fill feature, to structure the
              text you submit.
            </li>
          </ul>
        </>
      ),
    },
    {
      num: '07',
      title: 'Cross-border transfer',
      body: (
        <>
          Our database and hosting (Supabase) are located <strong>outside Vietnam</strong> (Singapore
          region). This means your personal data is transferred and processed abroad. We apply
          contractual and technical safeguards to protect it and, where required, prepare a
          Cross-border Transfer Impact Assessment in line with Vietnam’s Personal Data Protection Law.
          By using the service you are informed of and consent to this transfer.
        </>
      ),
    },
    {
      num: '08',
      title: 'Retention & deletion',
      body: (
        <>
          We keep your personal data only as long as your account is active or as needed to provide
          the service and meet legal obligations. You can <strong>delete your account</strong> in the
          app at any time, which removes your profile and personal data; aggregated, de-identified
          statistics may be retained. You may also email us to request deletion.
        </>
      ),
    },
    {
      num: '09',
      title: 'Your rights',
      body: (
        <>
          Under Vietnamese law you have the right to: access your data; correct it; delete it; restrict
          or object to processing; withdraw consent; request a copy; and lodge a complaint. To exercise
          any right, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You may also
          complain to the competent authority (the Department of Cybersecurity and Hi-tech Crime
          Prevention, A05, Ministry of Public Security).
        </>
      ),
    },
    {
      num: '10',
      title: 'Security',
      body: (
        <>
          We protect your data with encryption in transit, access controls and database row-level
          security. No system is perfectly secure, but we take reasonable measures appropriate to the
          sensitivity of salary data.
        </>
      ),
    },
    {
      num: '11',
      title: 'Minors',
      body: (
        <>
          The service is intended for working professionals and students aged 15 and above. We do not
          knowingly collect data from children under 15 without verified parental/guardian consent. If
          you believe a child has provided us data, contact us and we will delete it.
        </>
      ),
    },
    {
      num: '12',
      title: 'Changes',
      body: (
        <>
          We may update this policy. We will post the new version here with a revised effective date
          and, for material changes, notify you in the app.
        </>
      ),
    },
    {
      num: '13',
      title: 'Contact',
      body: (
        <>
          {ENTITY} — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </>
      ),
    },
  ],
};

const KO = {
  kicker: '개인정보',
  h1: '개인정보 처리방침',
  sub: `시행일: ${EFFECTIVE}. 본 방침은 ${ENTITY}가 운영하는 SalaryMap이 어떤 개인정보를 수집하고 어떻게 사용하는지, 그리고 베트남법상 이용자의 권리를 설명합니다.`,
  sections: [
    {
      num: '01',
      title: '운영자',
      body: (
        <>
          SalaryMap(이하 “저희”)은 베트남 IT 커뮤니티를 위한 연봉 투명성 서비스이며, <strong>{ENTITY}</strong>가 이용자 개인정보의 <strong>데이터 컨트롤러</strong>(Bên Kiểm soát dữ liệu)로서 운영합니다. 개인정보 관련 문의나 권리 행사는 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>로 연락 주세요.
        </>
      ),
    },
    {
      num: '02',
      title: '적용 범위 — 웹사이트와 앱',
      body: (
        <>
          <strong>웹사이트(salary-fyi.com):</strong> 연봉 정보는 <strong>계정 없이 익명으로</strong> 제출할 수 있으며, 이때 직무·경력·연봉 등 입력하신 데이터만 수집합니다.
          <br />
          <br />
          <strong>모바일 앱:</strong> 커뮤니티·프로필 기능을 이용하시려면 계정을 선택적으로 생성할 수 있으며, 이 경우 아래에 설명된 추가 개인정보가 수집됩니다.
        </>
      ),
    },
    {
      num: '03',
      title: '수집 항목',
      body: (
        <>
          <ul>
            <li>
              <strong>계정 정보</strong> — Apple 로그인 시: 이메일 주소(또는 Apple 비공개 릴레이 주소), 표시 이름(공유 시), 사용자 식별자.
            </li>
            <li>
              <strong>프로필 정보</strong> — 회사, 직무·직급, 연봉, 경력, 학력, 연령, 레벨 등 본인이 직접 입력한 항목.
            </li>
            <li>
              <strong>인증 정보</strong> — 재직·재학 인증을 위한 회사·학교 이메일 주소.
            </li>
            <li>
              <strong>이용자 콘텐츠</strong> — 연봉 제출, 커뮤니티 글·댓글, 지원 내역, 스크랩, 신고 및 피드백.
            </li>
            <li>
              <strong>기술 정보</strong> — 기기 정보, 앱 이용 로그·IP, 알림 활성화 시 푸시 토큰.
            </li>
            <li>
              <strong>AI 자동 입력 데이터</strong> — 프로필 자동 입력 기능 이용 시, 입력하신 텍스트가 프로필 구조화를 위해 외부 AI 제공업체로 전송됩니다.
            </li>
          </ul>
        </>
      ),
    },
    {
      num: '04',
      title: '이용 목적',
      body: (
        <>
          서비스 운영·제공, <strong>집계</strong> 형태의 연봉 통계 표시(개별 식별 연봉은 절대 공개하지 않으며, 제출 수가 적은 회사는 범위만 노출), 재직·재학 인증, 동의하신 알림 발송, 프로필 자동 입력, 커뮤니티 안전(검수·신고·차단) 운영에 사용합니다. 위 목적 외에는 이용하지 않습니다.
        </>
      ),
    },
    {
      num: '05',
      title: '법적 근거 및 동의',
      body: (
        <>
          저희는 베트남 개인정보 보호법(91/2025/QH15)과 시행령 13/2023/NĐ-CP에 따라, 수집 전 받은 <strong>이용자의 동의</strong>(가입 시 및 데이터 제출 시) 및 법령상 허용되는 그 밖의 법적 근거에 따라 개인정보를 처리합니다. 동의는 위 목적에 한정되며 자발적입니다. 계정 삭제 또는 연락을 통해 <strong>언제든지 동의를 철회</strong>할 수 있으며, 철회 이전에 이미 수행된 처리에는 영향을 미치지 않습니다.
        </>
      ),
    },
    {
      num: '06',
      title: '공유 및 제3자',
      body: (
        <>
          개인정보를 <strong>판매하지 않으며</strong>, 식별 가능한 형태로 채용 담당자나 회사와 공유하지 않습니다. 저희를 대신하여 데이터를 처리하는 서비스 제공업체와만 공유합니다:
          <ul>
            <li>
              <strong>Supabase</strong> — 데이터베이스 및 호스팅(계정·프로필·콘텐츠 저장).
            </li>
            <li>
              <strong>Apple</strong> — Apple 로그인 및 알림용 Apple Push Notification 서비스.
            </li>
            <li>
              <strong>AI 제공업체</strong> — 자동 입력 기능 이용 시 한정, 입력 텍스트 구조화 목적.
            </li>
          </ul>
        </>
      ),
    },
    {
      num: '07',
      title: '국외 이전',
      body: (
        <>
          데이터베이스 및 호스팅(Supabase)은 <strong>베트남 외부</strong>(싱가포르 리전)에 위치합니다. 따라서 이용자의 개인정보는 해외로 이전·처리됩니다. 보호를 위해 계약적·기술적 보호 조치를 적용하며, 필요한 경우 베트남 개인정보 보호법에 따라 국외 이전 영향평가를 수행합니다. 서비스 이용 시 본 이전에 대해 안내받고 동의하신 것으로 봅니다.
        </>
      ),
    },
    {
      num: '08',
      title: '보관 및 삭제',
      body: (
        <>
          개인정보는 계정이 활성화된 동안 또는 서비스 제공과 법적 의무 이행에 필요한 기간 동안만 보관합니다. 앱 내에서 언제든지 <strong>계정을 삭제</strong>할 수 있으며, 삭제 시 프로필과 개인정보가 제거됩니다. 집계 및 비식별 통계는 보관될 수 있습니다. 이메일을 통해서도 삭제를 요청할 수 있습니다.
        </>
      ),
    },
    {
      num: '09',
      title: '이용자의 권리',
      body: (
        <>
          베트남법에 따라 이용자는 다음의 권리를 가집니다: 데이터 열람, 정정, 삭제, 처리 제한 또는 거부, 동의 철회, 사본 요청, 그리고 신고. 권리 행사를 위해 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>로 연락해 주세요. 관할 기관(공안부 산하 사이버보안·하이테크범죄 예방국, A05)에 신고할 수도 있습니다.
        </>
      ),
    },
    {
      num: '10',
      title: '보안',
      body: (
        <>
          전송 구간 암호화, 접근 통제, 데이터베이스 행 단위 보안(RLS) 등을 통해 데이터를 보호합니다. 완벽한 시스템은 없지만, 연봉 데이터의 민감도에 맞춰 합리적인 조치를 적용하고 있습니다.
        </>
      ),
    },
    {
      num: '11',
      title: '미성년자',
      body: (
        <>
          본 서비스는 만 15세 이상의 직장인과 학생을 대상으로 합니다. 부모·보호자의 검증된 동의 없이 만 15세 미만 아동의 데이터를 의도적으로 수집하지 않습니다. 자녀의 데이터가 제공된 사실을 알게 된 경우 연락 주시면 삭제하겠습니다.
        </>
      ),
    },
    {
      num: '12',
      title: '방침의 변경',
      body: (
        <>
          본 방침은 변경될 수 있습니다. 변경된 방침은 새 시행일과 함께 본 페이지에 게시되며, 중대한 변경의 경우 앱 내에서 알려 드립니다.
        </>
      ),
    },
    {
      num: '13',
      title: '문의',
      body: (
        <>
          {ENTITY} — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </>
      ),
    },
  ],
};

const VI = {
  kicker: 'Quyền riêng tư',
  h1: 'Chính sách Quyền riêng tư',
  sub: `Hiệu lực từ ${EFFECTIVE}. Chính sách này giải thích SalaryMap (do ${ENTITY} vận hành) thu thập dữ liệu cá nhân nào, sử dụng ra sao, và quyền của bạn theo pháp luật Việt Nam.`,
  sections: [
    {
      num: '01',
      title: 'Chúng tôi là ai',
      body: (
        <>
          SalaryMap (“chúng tôi”) là dịch vụ minh bạch lương cho cộng đồng công nghệ Việt Nam, do{' '}
          <strong>{ENTITY}</strong> vận hành với vai trò <strong>Bên Kiểm soát dữ liệu</strong> đối với
          dữ liệu cá nhân của bạn. Mọi thắc mắc về quyền riêng tư hoặc để thực hiện quyền của mình, vui
          lòng liên hệ <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </>
      ),
    },
    {
      num: '02',
      title: 'Phạm vi — website và ứng dụng',
      body: (
        <>
          <strong>Website (salary-fyi.com):</strong> bạn có thể gửi thông tin lương{' '}
          <strong>ẩn danh, không cần tài khoản</strong> — chúng tôi chỉ thu thập dữ liệu lương bạn tự
          nhập (vị trí, cấp bậc, mức lương).
          <br />
          <br />
          <strong>Ứng dụng di động:</strong> bạn có thể tạo tài khoản (tùy chọn) để dùng tính năng cộng
          đồng và hồ sơ. Tài khoản thu thập thêm dữ liệu cá nhân như mô tả bên dưới.
        </>
      ),
    },
    {
      num: '03',
      title: 'Dữ liệu chúng tôi thu thập',
      body: (
        <>
          <ul>
            <li>
              <strong>Dữ liệu tài khoản</strong> — khi đăng nhập bằng Apple: email (hoặc địa chỉ relay
              riêng của Apple), tên hiển thị (nếu bạn chia sẻ) và mã định danh người dùng.
            </li>
            <li>
              <strong>Dữ liệu hồ sơ</strong> — công ty, chức danh/vị trí, mức lương, số năm kinh nghiệm,
              học vấn/trường học, độ tuổi và cấp bậc — chỉ những gì bạn tự nhập.
            </li>
            <li>
              <strong>Dữ liệu xác minh</strong> — email công ty hoặc trường học của bạn, chỉ dùng để xác
              minh tình trạng việc làm/sinh viên.
            </li>
            <li>
              <strong>Nội dung do người dùng tạo</strong> — thông tin lương đã gửi, bài viết và bình
              luận cộng đồng, đơn ứng tuyển, mục đã lưu, báo cáo và phản hồi.
            </li>
            <li>
              <strong>Dữ liệu kỹ thuật</strong> — thông tin thiết bị, hành vi sử dụng, nhật ký/IP, và mã
              thông báo đẩy nếu bạn bật thông báo.
            </li>
            <li>
              <strong>Dữ liệu tự động điền bằng AI</strong> — nếu dùng tính năng tự động điền hồ sơ, nội
              dung bạn cung cấp sẽ được gửi tới nhà cung cấp AI bên thứ ba để cấu trúc hồ sơ.
            </li>
          </ul>
        </>
      ),
    },
    {
      num: '04',
      title: 'Cách chúng tôi sử dụng dữ liệu',
      body: (
        <>
          Chúng tôi dùng dữ liệu cá nhân để: cung cấp và vận hành dịch vụ; hiển thị thống kê lương{' '}
          <strong>tổng hợp</strong> (không bao giờ công bố lương cá nhân có thể nhận dạng — công ty quá
          ít dữ liệu chỉ hiển thị khoảng); xác minh tình trạng việc làm/sinh viên; gửi thông báo bạn
          đăng ký; hỗ trợ tự động điền hồ sơ; và giữ cộng đồng an toàn (kiểm duyệt, báo cáo, chặn). Chúng
          tôi chỉ xử lý cho các mục đích này.
        </>
      ),
    },
    {
      num: '05',
      title: 'Cơ sở pháp lý & sự đồng ý',
      body: (
        <>
          Chúng tôi xử lý dữ liệu cá nhân dựa trên <strong>sự đồng ý của bạn</strong>, được đưa ra trước
          khi thu thập (ví dụ khi đăng ký và khi gửi dữ liệu), và trên các cơ sở pháp lý khác được cho
          phép theo Luật Bảo vệ dữ liệu cá nhân (Luật 91/2025/QH15) và Nghị định 13/2023/NĐ-CP. Sự đồng ý
          là tự nguyện và cụ thể cho các mục đích nêu trên. Bạn có thể{' '}
          <strong>rút lại sự đồng ý bất cứ lúc nào</strong> bằng cách xóa tài khoản hoặc liên hệ chúng
          tôi; việc rút lại không ảnh hưởng đến hoạt động xử lý đã thực hiện trước đó.
        </>
      ),
    },
    {
      num: '06',
      title: 'Chia sẻ & bên thứ ba',
      body: (
        <>
          Chúng tôi <strong>không bao giờ bán dữ liệu cá nhân</strong> và không chia sẻ ở dạng có thể
          nhận dạng cho nhà tuyển dụng. Chỉ chia sẻ với các nhà cung cấp dịch vụ xử lý thay mặt chúng
          tôi:
          <ul>
            <li>
              <strong>Supabase</strong> — cơ sở dữ liệu và lưu trữ (tài khoản, hồ sơ, nội dung).
            </li>
            <li>
              <strong>Apple</strong> — Đăng nhập bằng Apple và dịch vụ thông báo đẩy của Apple.
            </li>
            <li>
              <strong>Nhà cung cấp AI</strong> — chỉ khi bạn dùng tính năng tự động điền.
            </li>
          </ul>
        </>
      ),
    },
    {
      num: '07',
      title: 'Chuyển dữ liệu ra nước ngoài',
      body: (
        <>
          Cơ sở dữ liệu và lưu trữ (Supabase) đặt <strong>ngoài Việt Nam</strong> (khu vực Singapore).
          Nghĩa là dữ liệu cá nhân của bạn được chuyển và xử lý ở nước ngoài. Chúng tôi áp dụng biện pháp
          hợp đồng và kỹ thuật để bảo vệ và, khi được yêu cầu, lập Đánh giá tác động chuyển dữ liệu ra
          nước ngoài theo Luật Bảo vệ dữ liệu cá nhân. Khi sử dụng dịch vụ, bạn được thông báo và đồng ý
          với việc chuyển này.
        </>
      ),
    },
    {
      num: '08',
      title: 'Lưu trữ & xóa dữ liệu',
      body: (
        <>
          Chúng tôi chỉ lưu dữ liệu cá nhân trong thời gian tài khoản còn hoạt động hoặc khi cần để cung
          cấp dịch vụ và tuân thủ pháp luật. Bạn có thể <strong>xóa tài khoản</strong> trong ứng dụng bất
          cứ lúc nào để xóa hồ sơ và dữ liệu cá nhân; số liệu thống kê tổng hợp đã ẩn danh có thể được
          giữ lại. Bạn cũng có thể gửi email yêu cầu xóa.
        </>
      ),
    },
    {
      num: '09',
      title: 'Quyền của bạn',
      body: (
        <>
          Theo pháp luật Việt Nam, bạn có quyền: truy cập dữ liệu; chỉnh sửa; xóa; hạn chế hoặc phản đối
          việc xử lý; rút lại sự đồng ý; yêu cầu bản sao; và khiếu nại. Để thực hiện quyền, gửi email tới{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Bạn cũng có thể khiếu nại tới cơ quan
          có thẩm quyền (Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ cao – A05, Bộ Công
          an).
        </>
      ),
    },
    {
      num: '10',
      title: 'Bảo mật',
      body: (
        <>
          Chúng tôi bảo vệ dữ liệu bằng mã hóa khi truyền, kiểm soát truy cập và bảo mật cấp hàng trong
          cơ sở dữ liệu. Không hệ thống nào an toàn tuyệt đối, nhưng chúng tôi áp dụng biện pháp hợp lý
          phù hợp với mức độ nhạy cảm của dữ liệu lương.
        </>
      ),
    },
    {
      num: '11',
      title: 'Trẻ vị thành niên',
      body: (
        <>
          Dịch vụ dành cho người đi làm và sinh viên từ 15 tuổi trở lên. Chúng tôi không cố ý thu thập dữ
          liệu của trẻ dưới 15 tuổi khi chưa có sự đồng ý của cha mẹ/người giám hộ. Nếu bạn cho rằng một
          trẻ em đã cung cấp dữ liệu, hãy liên hệ và chúng tôi sẽ xóa.
        </>
      ),
    },
    {
      num: '12',
      title: 'Thay đổi',
      body: (
        <>
          Chúng tôi có thể cập nhật chính sách này. Phiên bản mới sẽ được đăng tại đây kèm ngày hiệu lực
          mới và, với thay đổi quan trọng, thông báo trong ứng dụng.
        </>
      ),
    },
    {
      num: '13',
      title: 'Liên hệ',
      body: (
        <>
          {ENTITY} — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </>
      ),
    },
  ],
};

export default function Privacy() {
  // Drive locale from the global LanguageSwitcher (footer).
  const { lang, t: gt } = useT();
  const t = lang === 'ko' ? KO : lang === 'en' ? EN : VI;
  return (
    <>
      <Head>
        <title>Privacy Policy — SalaryMap</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="SalaryMap privacy policy — what personal data we collect, how we use it, and your rights under Vietnamese law." />
        <link rel="canonical" href="https://salary-fyi.com/privacy" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav>
        <a className="logo" href="/">
          <img src="/fyi-logo.png" alt="FYI" />
          <span dangerouslySetInnerHTML={{ __html: gt('nav.brandTagline') }} />
        </a>
        <div className="nav-r">
          <a className="nav-link" href="/how-it-works">{gt('footer.howItWorks')}</a>
          <a className="nav-link" href="/terms">{gt('footer.terms')}</a>
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
