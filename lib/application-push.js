// 지원(application) 관련 푸시 문구 — 어드민 상태 변경(api/admin/applications.js)과
// 기업 ATS(api/company/mark-viewed.js·send-mail.js)가 공유한다.
// 토큰 locale(vi|ko|en)별 문구 선택은 lib/push.js sendPush가 한다.

// 지원 상태 → 지원자에게 보낼 단계 안내 문구.
export const STATUS_PUSH = {
  applied: {
    vi: 'Hồ sơ của bạn đã được tiếp nhận',
    ko: '지원서가 접수되었습니다',
    en: 'Your application has been received',
  },
  pending: {
    vi: 'Hồ sơ của bạn đã được tiếp nhận',
    ko: '지원서가 접수되었습니다',
    en: 'Your application has been received',
  },
  viewed: {
    vi: 'Nhà tuyển dụng đã xem hồ sơ của bạn',
    ko: '채용 담당자가 지원서를 열람했습니다',
    en: 'The recruiter viewed your application',
  },
  reviewing: {
    vi: 'Hồ sơ của bạn đang được xem xét',
    ko: '지원서를 검토하고 있습니다',
    en: 'Your application is under review',
  },
  decided: {
    vi: 'Đã có kết quả cho hồ sơ ứng tuyển của bạn',
    ko: '지원 결과가 나왔습니다',
    en: 'A decision has been made on your application',
  },
  accepted: {
    vi: 'Chúc mừng! Hồ sơ của bạn đã được chấp nhận',
    ko: '축하합니다! 지원서가 합격되었습니다',
    en: 'Congratulations! Your application was accepted',
  },
  rejected: {
    vi: 'Đã có cập nhật cho hồ sơ ứng tuyển của bạn',
    ko: '지원서에 업데이트가 있습니다',
    en: 'There is an update on your application',
  },
}

// 담당자가 지원자에게 메일(면접 안내/결과 등)을 보냈을 때.
export const RECRUITER_MAIL_PUSH = {
  vi: 'Nhà tuyển dụng đã gửi email cho bạn',
  ko: '채용 담당자가 메일을 보냈습니다',
  en: 'The recruiter sent you an email',
}

// 회사·직무가 없을 때의 제목 폴백.
export const APP_FALLBACK_TITLE = {
  vi: 'Cập nhật ứng tuyển',
  ko: '지원 현황 업데이트',
  en: 'Application update',
}

// 푸시 제목: "회사 · 직무" (유저 데이터라 언어 중립). 둘 다 없으면 언어별 폴백.
export function appPushTitle(company, title) {
  return [company, title].filter(Boolean).join(' · ') || APP_FALLBACK_TITLE
}
