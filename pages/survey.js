import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'

// 유저 서베이 콜드메일 랜딩 — 로그인 없이 토큰(?t=)으로 진입, 대상이 베트남 회원이라 기본 VI.
// ?lang=ko 는 검수용(실발송 링크에는 안 붙임).
//
// 질문 설계: 기능 가설(첨삭·사진·모의면접·코칭·교육·정보)을 직접 묻지 않는다 — 영역별 자연스러운
// 현황·경험 질문을 흩어놓고 니즈는 어드민에서 답변 조합으로 도출한다.
// UX: 한 화면에 한 질문(스텝퍼) — 긴 스크롤 회피. 꼬리 질문(N-1)은 별도 스텝이 아니라
// 같은 화면에 슥 나타나고 자동 포커스 스크롤. 후속 없는 라디오는 답하면 자동으로 다음 스텝.
const QUESTIONS = [
  {
    key: 'status', type: 'radio',
    title: { vi: 'Tình trạng hiện tại của bạn?', ko: '현재 상태가 어떻게 되세요?' },
    opts: [
      { value: 'seeking', vi: 'Đang tìm việc', ko: '구직 중' },
      { value: 'employed_open', vi: 'Đang đi làm, nhưng quan tâm cơ hội mới', ko: '재직 중이지만 새 기회에 관심' },
      { value: 'employed_stay', vi: 'Đang đi làm, chưa có ý định chuyển việc', ko: '재직 중, 이직 생각 없음' },
      { value: 'student', vi: 'Sinh viên / sắp tốt nghiệp', ko: '학생 / 졸업 예정' },
    ],
  },
  {
    key: 'stage', type: 'radio',
    title: { vi: 'Trong quá trình tìm việc, bạn thấy [bước nào khó khăn nhất]?', ko: '구직 과정에서 [가장 막히는 단계]는 어디인가요?' },
    opts: [
      { value: 'finding_jobs', vi: 'Tìm được công việc / công ty phù hợp', ko: '맞는 공고·괜찮은 회사 찾기' },
      { value: 'no_response', vi: 'Ứng tuyển nhưng không nhận được phản hồi', ko: '지원해도 답이 없음' },
      { value: 'interview', vi: 'Phỏng vấn', ko: '면접' },
      { value: 'salary_offer', vi: 'Lương & đàm phán offer (không rõ mức lương thị trường)', ko: '연봉·오퍼 협상 (시세를 모름)' },
      { value: 'direction', vi: 'Không biết nên học gì / định hướng sự nghiệp', ko: '뭘 공부할지 · 커리어 방향' },
      { value: 'language', vi: 'Ngôn ngữ (tiếng Hàn / tiếng Anh)', ko: '언어 (한국어/영어)' },
    ],
  },
  // ── CV (첨삭 수요는 worry×feedback 조합으로 도출) ──
  {
    key: 'cv_feedback', type: 'multi',
    title: { vi: 'Bạn đã từng nhờ ai [xem và góp ý CV] của mình chưa? (chọn tất cả)', ko: 'CV를 누군가에게 [보여주고 피드백] 받아본 적 있나요? (모두 선택)' },
    opts: [
      { value: 'none', exclusive: true, vi: 'Chưa từng', ko: '받아본 적 없음' },
      { value: 'friends', vi: 'Bạn bè · người quen', ko: '친구·지인' },
      { value: 'mentor', vi: 'Mentor · tiền bối · giảng viên', ko: '멘토·선배·교수' },
      { value: 'paid', vi: 'Dịch vụ trả phí', ko: '유료 서비스' },
      { value: 'ai', vi: 'Công cụ AI (ChatGPT…)', ko: 'AI 도구 (ChatGPT 등)' },
    ],
  },
  {
    key: 'cv_worry', type: 'radio',
    title: { vi: 'Khi ứng tuyển, điều gì trong [CV] làm bạn lo lắng nhất?', ko: '지원할 때 [CV에서 가장 걱정되는 부분]은 뭔가요?' },
    opts: [
      { value: 'confident', vi: 'Không có gì — mình khá tự tin', ko: '딱히 없음 — 자신 있음' },
      { value: 'content', vi: 'Không biết viết nội dung thế nào cho tốt', ko: '내용을 어떻게 써야 좋을지 모르겠음' },
      { value: 'design', vi: 'Thiết kế · bố cục chưa đẹp', ko: '디자인·형식이 아쉬움' },
      { value: 'language', vi: 'Diễn đạt bằng tiếng Hàn / tiếng Anh', ko: '한국어·영어 표현' },
      { value: 'thin', vi: 'Kinh nghiệm · thành tích trông có vẻ mỏng', ko: '경력·스펙이 부족해 보임' },
    ],
  },
  // ── 프로필 사진 ──
  {
    key: 'photo_current', type: 'radio',
    title: { vi: 'Hiện tại bạn đang dùng [ảnh hồ sơ xin việc] như thế nào?', ko: '[지원용 프로필 사진]은 지금 어떤 걸 쓰고 있나요?' },
    opts: [
      { value: 'studio', vi: 'Ảnh chụp tại studio', ko: '스튜디오에서 촬영한 사진' },
      { value: 'app', vi: 'Ảnh tự chỉnh bằng app', ko: '앱으로 보정한 사진' },
      { value: 'casual', vi: 'Ảnh selfie · ảnh thường', ko: '셀카·일반 사진' },
      { value: 'none', vi: 'Chưa có ảnh hồ sơ', ko: '아직 없음' },
    ],
  },
  // ── 면접 (모의면접 수요는 prep×weak 조합으로 도출) ──
  {
    key: 'interview_prep', type: 'radio',
    title: { vi: 'Bạn thường [chuẩn bị phỏng vấn] như thế nào?', ko: '[면접 준비]는 주로 어떻게 하나요?' },
    opts: [
      { value: 'no_exp', vi: 'Chưa từng đi phỏng vấn', ko: '아직 면접 경험이 없음' },
      { value: 'none', vi: 'Không chuẩn bị gì đặc biệt', ko: '따로 준비하지 않음' },
      { value: 'solo', vi: 'Tự tìm kiếm & soạn câu trả lời dự kiến', ko: '혼자 검색하고 예상 답변 정리' },
      { value: 'friends', vi: 'Luyện cùng bạn bè · nhóm học', ko: '친구·스터디와 연습' },
      { value: 'paid', vi: 'Dùng khóa học · dịch vụ luyện phỏng vấn trả phí', ko: '유료 강의·연습 서비스 이용' },
    ],
  },
  {
    key: 'interview_weak', type: 'radio',
    title: { vi: 'Trong [phỏng vấn], bạn thấy mình thiếu tự tin nhất ở điểm nào?', ko: '[면접]에서 가장 자신 없는 부분은 뭔가요?' },
    opts: [
      { value: 'language', vi: 'Trả lời bằng tiếng Hàn / tiếng Anh', ko: '한국어/영어로 답변하기' },
      { value: 'unknown_q', vi: 'Không biết sẽ bị hỏi những gì', ko: '어떤 질문이 나올지 모르겠음' },
      { value: 'nervous', vi: 'Hồi hộp, nói không được trôi chảy', ko: '긴장해서 말이 잘 안 나옴' },
      { value: 'technical', vi: 'Câu hỏi chuyên môn · kỹ thuật', ko: '기술·직무 관련 질문' },
      { value: 'salary', vi: 'Nói về lương · điều kiện', ko: '연봉·조건 이야기' },
      { value: 'no_exp', vi: 'Chưa từng đi phỏng vấn nên chưa rõ', ko: '면접 경험이 없어서 모르겠음' },
    ],
  },
  // ── 커리어 상담 (코칭 수요는 who×exp 조합으로 도출) ──
  {
    key: 'coach_who', type: 'radio',
    title: { vi: 'Khi băn khoăn về [định hướng sự nghiệp], bạn thường trao đổi với ai?', ko: '[커리어 고민]이 생기면 주로 누구와 상의하나요?' },
    opts: [
      { value: 'nobody', vi: 'Không có ai — tự suy nghĩ một mình', ko: '상의할 사람이 없음 — 혼자 고민' },
      { value: 'friends', vi: 'Bạn bè · gia đình', ko: '친구·가족' },
      { value: 'colleagues', vi: 'Đồng nghiệp · tiền bối ở công ty', ko: '회사 선배·동료' },
      { value: 'mentor', vi: 'Mentor', ko: '멘토' },
      { value: 'community', vi: 'Cộng đồng online', ko: '온라인 커뮤니티' },
    ],
  },
  {
    key: 'coach_exp', type: 'radio',
    title: { vi: 'Bạn đã từng được [tư vấn sự nghiệp một cách nghiêm túc] chưa?', ko: '[제대로 된 커리어 상담]을 받아본 적 있나요?' },
    opts: [
      { value: 'helped', vi: 'Rồi — và thấy hữu ích', ko: '받아봤고, 도움이 됐음' },
      { value: 'lacking', vi: 'Rồi — nhưng chưa như mong đợi', ko: '받아봤지만 아쉬웠음' },
      { value: 'wanted', vi: 'Muốn nhưng chưa có cách · cơ hội', ko: '받고 싶었지만 방법·기회가 없었음' },
      { value: 'no_need', vi: 'Chưa thấy cần', ko: '필요성을 못 느낌' },
    ],
  },
  // ── 채용정보·정보공유 (정보 소스→신뢰도, 부족 정보→실제 곤란 경험으로 심각도 판별) ──
  {
    key: 'info_source', type: 'multi',
    title: { vi: 'Bạn thường [tìm thông tin việc làm & sự nghiệp] (lương, công ty, tin tuyển dụng) ở đâu? (chọn tất cả)', ko: '[구직·커리어 정보](연봉·회사·공고)는 주로 어디서 얻나요? (모두 선택)' },
    opts: [
      { value: 'fb_groups', vi: 'Nhóm Facebook', ko: 'Facebook 그룹' },
      { value: 'friends', vi: 'Bạn bè · người quen', ko: '친구·지인' },
      { value: 'linkedin', vi: 'LinkedIn', ko: 'LinkedIn' },
      { value: 'job_sites', vi: 'Trang tuyển dụng (VietnamWorks, TopCV…)', ko: '구직 사이트 (VietnamWorks 등)' },
      { value: 'youtube', vi: 'YouTube · blog', ko: '유튜브·블로그' },
      { value: 'none', exclusive: true, vi: 'Không có nguồn nào cụ thể', ko: '딱히 없음' },
    ],
  },
  {
    key: 'info_gap', type: 'radio',
    title: { vi: 'Thông tin nào bạn thấy [khó tìm hoặc khó tin nhất]?', ko: '[찾기 어렵거나 믿기 어려운 정보]는 뭔가요?' },
    opts: [
      { value: 'salary', vi: 'Mức lương thị trường thực tế', ko: '실제 연봉 시세' },
      { value: 'reviews', vi: 'Đánh giá · văn hóa thật của công ty', ko: '회사 실제 평판·문화' },
      { value: 'kr_company', vi: 'Thông tin về công ty Hàn Quốc', ko: '한국 기업 정보' },
      { value: 'job_fresh', vi: 'Tin tuyển dụng có thật · còn tuyển không', ko: '공고가 진짜인지·아직 뽑는지' },
      { value: 'none', vi: 'Không có gì đặc biệt', ko: '딱히 없음' },
    ],
  },
  // ── 교육 (블로커 유형으로 교육 상품 기회 판별) ──
  {
    key: 'learn_block', type: 'radio',
    title: { vi: 'Có điều gì bạn thấy [cần học nhưng chưa bắt đầu được] không?', ko: '[배워야 한다고 느끼지만 시작 못 한 것]이 있나요?' },
    opts: [
      { value: 'doing', vi: 'Không — mình đang học những gì cần', ko: '없음 — 필요한 건 하고 있음' },
      { value: 'what', vi: 'Có — vì không biết nên học gì', ko: '있음 — 뭘 배울지 몰라서' },
      { value: 'money_time', vi: 'Có — vì thời gian · chi phí', ko: '있음 — 시간·돈 때문에' },
      { value: 'quality', vi: 'Có — chưa tìm được khóa học · tài liệu tốt', ko: '있음 — 좋은 강의·자료를 못 찾아서' },
    ],
  },
  // ── 지불의사 실측 — 항목 선택+금액 숫자입력(모바일 숫자키패드), 주관식보다 정량 집계가 쉽다 ──
  {
    key: 'spend', type: 'spend',
    title: { vi: 'Trong 6 tháng qua, bạn đã [chi tiền] cho những khoản nào liên quan đến nghề nghiệp? Chọn và nhập số tiền ước tính.', ko: '최근 6개월간 커리어 관련해 [돈을 쓴 항목]을 고르고, 대략적인 금액을 입력해주세요.' },
    opts: [
      { value: 'language_test', vi: 'Lệ phí thi chứng chỉ (TOPIK · IELTS…)', ko: '어학시험 응시료 (TOPIK·IELTS 등)' },
      { value: 'course', vi: 'Khóa học · lớp học (online / offline)', ko: '강의·클래스 (온/오프라인)' },
      { value: 'cv_service', vi: 'Dịch vụ CV (sửa CV · mẫu CV)', ko: 'CV 서비스 (첨삭·템플릿)' },
      { value: 'photo', vi: 'Chụp / chỉnh ảnh hồ sơ', ko: '프로필 사진 촬영·보정' },
      { value: 'coaching', vi: 'Mentoring · tư vấn sự nghiệp', ko: '멘토링·커리어 상담' },
      { value: 'other', vi: 'Khoản khác', ko: '기타' },
      { value: 'none', exclusive: true, vi: 'Không chi khoản nào', ko: '쓴 적 없음' },
    ],
  },
]
const RADIO_KEYS = QUESTIONS.filter((q) => q.type === 'radio').map((q) => q.key)

// 2-1 후속 주관식 — Q2에서 고른 단계에 맞춰 질문이 바뀐다(막연한 "겪은 일" 방지).
const PAIN_PROMPTS = {
  finding_jobs: { vi: 'Khi tìm công việc / công ty phù hợp, [cụ thể điều gì khó nhất] với bạn?', ko: '맞는 공고·회사를 찾을 때, [구체적으로 뭐가 가장 어려웠나요]?' },
  no_response: { vi: 'Kể về lần gần đây bạn [ứng tuyển mà không nhận được phản hồi] — bạn đã nộp bao nhiêu nơi, và xử lý thế nào?', ko: '[지원하고 답을 못 받았던] 최근 경험을 알려주세요 — 몇 곳에 지원했고, 어떻게 대응하셨나요?' },
  interview: { vi: 'Trong buổi [phỏng vấn gần đây], cụ thể điều gì khó nhất với bạn?', ko: '[최근 면접]에서 구체적으로 뭐가 가장 어려웠나요?' },
  salary_offer: { vi: 'Về [lương & offer], cụ thể bạn gặp khó ở đâu? (biết mức lương thị trường, đàm phán…)', ko: '[연봉·오퍼]에서 구체적으로 뭐가 어려웠나요? (시세 파악, 협상…)' },
  direction: { vi: 'Về [định hướng sự nghiệp], gần đây bạn băn khoăn cụ thể điều gì nhất?', ko: '[커리어 방향]에서 요즘 구체적으로 뭐가 가장 고민되나요?' },
  language: { vi: 'Vì [ngôn ngữ], bạn đã gặp khó trong tình huống cụ thể nào?', ko: '[언어] 때문에 구체적으로 어떤 상황에서 막혔나요?' },
}
const PAIN_PH = { vi: 'Kể lại một tình huống cụ thể gần đây — càng chi tiết càng giúp bọn mình hiểu rõ hơn.', ko: '최근 겪은 구체적인 상황을 적어주세요 — 자세할수록 도움이 됩니다.' }

// 조건부 후속(N-1) — 경험 있으면 "어땠는지", 없으면 "왜 없는지"를 파서 미충족 수요를 가른다.
const FOLLOWUPS = [
  {
    key: 'cv_fb_quality', parent: 'cv_feedback', type: 'radio',
    when: (a) => a.cv_feedback.some((v) => v !== 'none'),
    title: { vi: 'Những góp ý CV bạn nhận được [như thế nào]?', ko: '받아본 피드백은 [어땠나요]?' },
    opts: [
      { value: 'helped', vi: 'Rất hữu ích', ko: '충분히 도움됐음' },
      { value: 'some', vi: 'Có ích nhưng chưa đủ', ko: '도움됐지만 아쉬웠음' },
      { value: 'not', vi: 'Không giúp được mấy', ko: '별로 도움 안 됐음' },
    ],
  },
  {
    key: 'cv_fb_why_not', parent: 'cv_feedback', type: 'radio',
    when: (a) => a.cv_feedback.includes('none'),
    title: { vi: 'Vì sao bạn [chưa từng nhờ ai góp ý CV]?', ko: '피드백을 받아보지 않은 [이유]가 있나요?' },
    opts: [
      { value: 'no_one', vi: 'Không có ai để nhờ', ko: '부탁할 사람이 없어서' },
      { value: 'embarrassed', vi: 'Ngại cho người khác xem', ko: '보여주기 좀 부끄러워서' },
      { value: 'no_need', vi: 'Thấy không cần thiết', ko: '필요 없다고 생각해서' },
      { value: 'no_thought', vi: 'Chưa nghĩ tới', ko: '딱히 생각해본 적 없음' },
    ],
  },
  {
    key: 'photo_app_sat', parent: 'photo_current', type: 'radio',
    when: (a) => a.photo_current === 'app',
    title: { vi: 'Ảnh chỉnh bằng app có [làm bạn hài lòng] không?', ko: '앱 보정 사진에 [만족하나요]?' },
    opts: [
      { value: 'satisfied', vi: 'Hài lòng', ko: '만족함' },
      { value: 'okay', vi: 'Tạm ổn, nhưng chưa thật ưng ý', ko: '아쉽지만 그냥 쓰는 중' },
      { value: 'unsatisfied', vi: 'Chưa hài lòng — đang tìm cách tốt hơn', ko: '불만족 — 더 나은 방법을 찾는 중' },
    ],
  },
  {
    key: 'photo_why', parent: 'photo_current', type: 'radio',
    when: (a) => a.photo_current === 'none' || a.photo_current === 'casual',
    title: { vi: 'Vì sao bạn [chưa chuẩn bị ảnh hồ sơ chỉn chu]?', ko: '제대로 된 프로필 사진을 준비하지 않은 [이유]는?' },
    opts: [
      { value: 'cost', vi: 'Chi phí hơi cao', ko: '비용이 부담돼서' },
      { value: 'hassle', vi: 'Không có thời gian · ngại đi chụp', ko: '시간이 없고 번거로워서' },
      { value: 'dont_know', vi: 'Không biết chụp ở đâu · thế nào', ko: '어디서·어떻게 준비할지 몰라서' },
      { value: 'no_need', vi: 'Thấy không quan trọng', ko: '중요하지 않다고 생각해서' },
    ],
  },
  {
    key: 'prep_enough', parent: 'interview_prep', type: 'radio',
    when: (a) => ['solo', 'friends', 'paid'].includes(a.interview_prep),
    title: { vi: 'Cách chuẩn bị đó có [đủ] với bạn không?', ko: '그 준비 방식으로 [충분하다고 느끼나요]?' },
    opts: [
      { value: 'enough', vi: 'Đủ rồi', ko: '충분함' },
      { value: 'lacking', vi: 'Chưa đủ — đang tìm cách tốt hơn', ko: '부족함 — 더 나은 방법을 찾는 중' },
    ],
  },
  {
    key: 'prep_why_not', parent: 'interview_prep', type: 'radio',
    when: (a) => a.interview_prep === 'none',
    title: { vi: 'Vì sao bạn [không chuẩn bị gì đặc biệt]?', ko: '따로 준비하지 않는 [이유]는?' },
    opts: [
      { value: 'no_need', vi: 'Thấy chưa cần', ko: '필요성을 못 느껴서' },
      { value: 'dont_know', vi: 'Không biết nên chuẩn bị gì', ko: '뭘 준비해야 할지 몰라서' },
      { value: 'no_partner', vi: 'Không có ai luyện cùng', ko: '같이 연습할 사람이 없어서' },
    ],
  },
  {
    key: 'info_trust', parent: 'info_source', type: 'radio',
    when: (a) => a.info_source.some((v) => v !== 'none'),
    title: { vi: 'Những thông tin từ các nguồn đó có [đáng tin] không?', ko: '그 정보들은 [믿을 만한가요]?' },
    opts: [
      { value: 'trust', vi: 'Khá đáng tin', ko: '믿을 만함' },
      { value: 'mixed', vi: 'Phải tự lọc — thật giả lẫn lộn', ko: '절반은 걸러 들어야 함' },
      { value: 'distrust', vi: 'Nhiều quảng cáo · phóng đại, khó tin', ko: '광고·과장이 많아 믿기 어려움' },
    ],
  },
  {
    key: 'info_gap_impact', parent: 'info_gap', type: 'radio',
    when: (a) => a.info_gap && a.info_gap !== 'none',
    title: { vi: 'Vì thiếu thông tin đó, bạn đã từng [gặp rắc rối thực sự] chưa?', ko: '그 정보가 없어서 [실제로 곤란했던 적] 있나요?' },
    opts: [
      { value: 'yes_bad', vi: 'Rồi — từng chọn sai / mất nhiều thời gian', ko: '있음 — 잘못된 선택·시간 낭비까지 했음' },
      { value: 'yes_minor', vi: 'Có, nhưng chỉ hơi bất tiện', ko: '있음 — 조금 불편한 정도' },
      { value: 'no', vi: 'Chưa', ko: '딱히 없음' },
    ],
  },
  {
    key: 'learn_want', parent: 'learn_block', type: 'radio',
    when: (a) => a.learn_block && a.learn_block !== 'doing',
    title: { vi: 'Bạn muốn học [điều gì] nhất?', ko: '가장 [배우고 싶은 것]은 뭔가요?' },
    opts: [
      { value: 'language', vi: 'Tiếng Hàn / tiếng Anh', ko: '한국어·영어' },
      { value: 'job_skill', vi: 'Kỹ năng chuyên môn của ngành', ko: '직무 전문 스킬' },
      { value: 'coding', vi: 'Lập trình · dữ liệu', ko: '코딩·데이터' },
      { value: 'cert', vi: 'Chứng chỉ', ko: '자격증' },
      { value: 'soft', vi: 'Phỏng vấn · giao tiếp (kỹ năng mềm)', ko: '면접·커뮤니케이션 등 소프트스킬' },
      { value: 'other', vi: 'Khác', ko: '기타' },
    ],
  },
]

const COPY = {
  callTitle: { vi: 'Bạn có sẵn lòng trò chuyện online 15 phút với mình để chia sẻ thêm không?', ko: '창업자와 15분 온라인 대화로 더 이야기해주실 수 있나요?' },
  callYes: { vi: 'Có, mình sẵn lòng!', ko: '네, 좋아요!' },
  callPh: { vi: 'Zalo / số điện thoại của bạn', ko: 'Zalo / 전화번호' },
  callAlt: {
    vi: 'Nếu cuộc gọi làm bạn hơi ngại, bạn cũng có thể nhắn tin cho mình qua LinkedIn — mình sẽ lắng nghe mọi ý kiến thật chi tiết.',
    ko: '미팅이 부담스러우시면 제 링크드인으로 메시지 주셔도 좋습니다 — 모든 의견을 자세히 듣겠습니다.',
  },
  introHi: { vi: (n) => `Chào ${n} 👋`, ko: (n) => `안녕하세요 ${n}님 👋` },
  intro: {
    vi: 'Mình là [Sean, người sáng lập FYI]. Để hỗ trợ bạn tốt hơn trên hành trình tìm việc và phát triển sự nghiệp, mong bạn trả lời vài câu hỏi dưới đây — hầu hết chỉ cần chạm chọn (~3 phút). Mình sẽ cố gắng hết sức để xây dựng một FYI tốt hơn cho bạn.',
    ko: '저는 [FYI 창업자 Sean]입니다. 여러분의 구직과 커리어 성장을 더 잘 돕기 위해, 아래 질문들에 답해주세요 — 대부분 선택형이라 3분이면 충분합니다. 더 나은 FYI를 만들도록 최선을 다하겠습니다.',
  },
  next: { vi: 'Tiếp tục →', ko: '다음 →' },
  start: { vi: 'Bắt đầu', ko: '시작하기' },
  back: { vi: '← Quay lại', ko: '← 이전' },
  submit: { vi: 'Gửi câu trả lời', ko: '답변 보내기' },
  submitting: { vi: 'Đang gửi…', ko: '보내는 중…' },
  privacy: { vi: 'Câu trả lời chỉ dùng để cải thiện FYI, không chia sẻ cho bên thứ ba.', ko: '답변은 FYI 개선에만 사용되며 제3자와 공유하지 않습니다.' },
  fail: { vi: 'Gửi thất bại. Vui lòng thử lại.', ko: '전송에 실패했습니다. 다시 시도해주세요.' },
  loading: { vi: 'Đang tải…', ko: '불러오는 중…' },
  invalidTitle: { vi: 'Liên kết không hợp lệ', ko: '유효하지 않은 링크입니다' },
  invalidBody: { vi: 'Vui lòng mở lại từ email bạn nhận được.', ko: '받으신 이메일의 링크로 다시 열어주세요.' },
  doneTitle: { vi: (n) => `Cảm ơn ${n} rất nhiều!`, ko: (n) => `${n}님, 정말 감사합니다!` },
  doneBody: {
    vi: 'Câu trả lời của bạn sẽ giúp FYI hỗ trợ hành trình tìm việc và sự nghiệp của bạn tốt hơn.',
    ko: '답변은 여러분의 구직과 커리어를 더 잘 돕는 데 소중히 반영됩니다.',
  },
}
// [강조] 마크업 — 문장 안 일부만 주황색
const em = (s) => {
  const parts = String(s).split(/\[|\]/)
  return parts.map((p, i) => i % 2 ? <span key={i} style={{ color: '#ff6000' }}>{p}</span> : p)
}

const INITIAL = { pain: '', cv_feedback: [], info_source: [], spend_sel: [], spend_amounts: {}, spend_other: '', call_ok: false, contact: '' }
for (const k of RADIO_KEYS) INITIAL[k] = ''
for (const f of FOLLOWUPS) INITIAL[f.key] = ''

// 금액 입력 — 숫자만 받아 베트남식 천단위 점 표기로 보여준다 (150000 → 1.500.000)
const digitsOf = (s) => String(s || '').replace(/\D/g, '').slice(0, 12)
const fmtVnd = (d) => d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''

export default function Survey() {
  const [token, setToken] = useState(null) // null=파싱 전, ''=없음
  const [lang, setLang] = useState('vi')
  const [name, setName] = useState('')
  const [state, setState] = useState('loading') // loading | invalid | form | submitting | done
  const [error, setError] = useState('')
  const [step, setStep] = useState(-1) // -1=인사 화면, 0..QUESTIONS.length-1 = 질문, QUESTIONS.length = 인터뷰+제출
  const [a, setA] = useState(INITIAL)
  const cardRef = useRef(null)
  const set = (k, v) => setA((prev) => ({ ...prev, [k]: v }))
  const L = (o) => o[lang] || o.vi
  const LOpt = (o) => (lang === 'ko' ? o.ko : o.vi)
  const TOTAL = QUESTIONS.length + 1

  // multi 토글 — exclusive 옵션('없음' 류)은 배타
  const nextMulti = (cur, opt, opts) => {
    if (opt.exclusive) return cur.includes(opt.value) ? [] : [opt.value]
    const exclusives = opts.filter((o) => o.exclusive).map((o) => o.value)
    const rest = cur.filter((x) => !exclusives.includes(x))
    return rest.includes(opt.value) ? rest.filter((x) => x !== opt.value) : [...rest, opt.value]
  }

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const t = sp.get('t') || ''
    if (sp.get('lang') === 'ko') setLang('ko')
    setToken(t)
    if (!t) { setState('invalid'); return }
    fetch('/api/survey', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t, view: true }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => { setName(d.name || ''); setState(d.submitted ? 'done' : 'form') })
      .catch(() => setState('invalid'))
  }, [])

  // 현재 스텝 완료 판정 — 본질문 + 화면에 뜬 꼬리 질문까지 다 답해야 다음으로
  const stepDone = (st, ans = a) => {
    if (st >= QUESTIONS.length) return true // 인터뷰 스텝은 선택 사항
    const q = QUESTIONS[st]
    let base
    if (q.type === 'radio') base = !!ans[q.key]
    else if (q.type === 'multi') base = (ans[q.key] || []).length > 0
    else if (q.type === 'spend') base = ans.spend_sel.includes('none')
      || (ans.spend_sel.length > 0 && ans.spend_sel.every((k) => digitsOf(ans.spend_amounts[k])))
    else base = true
    if (!base) return false
    if (q.key === 'stage' && ans.pain.trim().length < 5) return false
    for (const f of FOLLOWUPS) if (f.parent === q.key && f.when(ans) && !ans[f.key]) return false
    return true
  }

  const goTo = (st) => {
    setStep(st)
    requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  // 입력칸 포커스 — 키보드가 열린 뒤(≈300ms) 입력칸을 보이는 영역 중앙으로 재스크롤
  // (iOS는 100vh가 키보드를 무시해 가운데 정렬이 키보드 뒤로 숨을 수 있다)
  const focusScroll = (e) => {
    const el = e.currentTarget
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
  }
  // 라디오 클릭 — 스텝이 완결되면 딜레이 없이 바로 다음, 꼬리가 생기면 거기로 포커스
  const clickRadio = (key, v) => {
    const nextA = { ...a, [key]: v }
    set(key, v)
    if (stepDone(step, nextA)) goTo(Math.min(step + 1, QUESTIONS.length))
    else setTimeout(() => document.querySelector('[data-follow]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
  }
  // 다중선택 토글 — '없음'(배타)으로 스텝이 완결되면 자동 진행, 아니면 꼬리로 포커스만.
  // 일반 항목 선택은 자동 진행하지 않는다(더 고를 수 있으므로) — 진행은 꼬리 라디오 답에서 일어난다.
  const clickMulti = (key, opt, opts) => {
    const arr = nextMulti(a[key] || [], opt, opts)
    set(key, arr)
    const nextA = { ...a, [key]: arr }
    if (opt.exclusive && stepDone(step, nextA)) goTo(Math.min(step + 1, QUESTIONS.length))
    else setTimeout(() => document.querySelector('[data-follow]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
  }

  const canSubmit = RADIO_KEYS.every((k) => a[k])
    && a.cv_feedback.length > 0
    && a.info_source.length > 0
    && a.pain.trim().length >= 5
    && (a.spend_sel.includes('none') || (a.spend_sel.length > 0 && a.spend_sel.every((k) => digitsOf(a.spend_amounts[k]))))
    && FOLLOWUPS.every((f) => !f.when(a) || a[f.key])

  async function submit() {
    if (!canSubmit || state === 'submitting') return
    setState('submitting')
    setError('')
    // 도중에 부모 답을 바꿔 숨겨진 후속 질문의 잔존값은 비우고 보낸다
    const payload = { ...a }
    for (const f of FOLLOWUPS) if (!f.when(a)) payload[f.key] = ''
    // 지출은 구조화해서 보낸다 — {item, amount(VND), note?}[]
    payload.spent_none = a.spend_sel.includes('none')
    payload.spent_items = payload.spent_none ? [] : a.spend_sel.map((k) => ({
      item: k,
      amount: parseInt(digitsOf(a.spend_amounts[k]) || '0', 10),
      ...(k === 'other' && a.spend_other.trim() ? { note: a.spend_other.trim() } : {}),
    }))
    delete payload.spend_sel; delete payload.spend_amounts; delete payload.spend_other
    try {
      const res = await fetch('/api/survey', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, answers: payload }),
      })
      if (!res.ok) throw new Error()
      setState('done')
    } catch {
      setState('form')
      setError(L(COPY.fail))
    }
  }

  const firstName = (name || '').trim().split(/\s+/).slice(-1)[0] || (lang === 'ko' ? '회원' : 'bạn')
  // 밋밋한 단색 대신 상단에 브랜드 오렌지 글로우 2개를 깐 웜 그라데이션 — 카드 가독성은 유지
  const wrap = {
    minHeight: '100vh',
    background: 'radial-gradient(640px 320px at 88% -60px, rgba(255,96,0,.14), transparent 70%), radial-gradient(520px 300px at -8% 140px, rgba(255,160,90,.12), transparent 70%), linear-gradient(180deg, #fff3ea 0%, #faf9f7 420px)',
    display: 'flex', justifyContent: 'center', padding: '28px 16px 60px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#1a1612',
  }
  const card = { maxWidth: 560, width: '100%' }
  const qBox = { background: '#fff', border: '1px solid #eee5da', borderRadius: 16, padding: '18px 18px 16px', marginBottom: 14 }
  const qTitle = { fontSize: 15, fontWeight: 700, lineHeight: 1.45, marginBottom: 12 }
  const rowSt = (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, border: active ? '2px solid #ff6000' : '1px solid #e5ddd2', background: active ? '#fff4ec' : '#fff', fontSize: 14, cursor: 'pointer', marginBottom: 8, fontWeight: active ? 700 : 400 })
  const ta = { width: '100%', minHeight: 96, border: '1px solid #e5ddd2', borderRadius: 11, padding: '11px 13px', fontSize: 14, lineHeight: 1.55, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }
  const input = { ...ta, minHeight: 0, resize: 'none' }
  const btn = (enabled) => ({ display: 'block', width: '100%', padding: '15px 0', border: 'none', borderRadius: 12, background: enabled ? '#ff6000' : '#f5c9a8', color: '#fff', fontSize: 15.5, fontWeight: 800, cursor: enabled ? 'pointer' : 'default' })
  const Dot = ({ on }) => <span style={{ width: 16, height: 16, borderRadius: '50%', border: on ? '5px solid #ff6000' : '2px solid #d9cfc2', boxSizing: 'border-box', flexShrink: 0 }} />
  const Check = ({ on }) => <span style={{ width: 16, height: 16, borderRadius: 4, border: on ? 'none' : '2px solid #d9cfc2', background: on ? '#ff6000' : '#fff', boxSizing: 'border-box', flexShrink: 0, color: '#fff', fontSize: 12, fontWeight: 800, textAlign: 'center', lineHeight: '16px' }}>{on ? '✓' : ''}</span>

  const q = step >= 0 && step < QUESTIONS.length ? QUESTIONS[step] : null
  const followBox = { ...qBox, borderLeft: '3px solid #ff6000', animation: 'surveySlideIn .25s ease' }

  return (
    <div style={wrap}>
      <Head>
        <title>Khảo sát FYI</title>
        <meta name="robots" content="noindex" />
        {/* 안드로이드 크롬: 키보드가 레이아웃 뷰포트를 줄이게 해 가운데 정렬이 키보드 위 기준으로 재계산되게 */}
        <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content" />
      </Head>
      <div style={card} ref={cardRef}>
        <img src="/fyi-logo.png" alt="FYI" style={{ height: 28, width: 'auto', display: 'block', margin: '0 auto 18px' }} />

        {state === 'loading' && <div style={{ textAlign: 'center', padding: 60, color: '#8a8073' }}>{L(COPY.loading)}</div>}

        {state === 'invalid' && (
          <div style={{ ...qBox, textAlign: 'center', padding: 36 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{L(COPY.invalidTitle)}</div>
            <div style={{ fontSize: 13.5, color: '#8a8073' }}>{L(COPY.invalidBody)}</div>
          </div>
        )}

        {state === 'done' && (
          <div style={{ ...qBox, textAlign: 'center', padding: 36 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🙏</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{L(COPY.doneTitle)(firstName)}</div>
            <div style={{ fontSize: 14, color: '#4a443c', lineHeight: 1.6 }}>{L(COPY.doneBody)}</div>
          </div>
        )}

        {(state === 'form' || state === 'submitting') && (
          <>
            <style>{`
              @keyframes surveySlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
              /* 풀하이트 센터링 — dvh 지원 브라우저는 주소창/키보드 변화에 맞춰 재계산 */
              .sv-full { min-height: calc(100vh - 175px); display: flex; flex-direction: column; }
              @supports (height: 100dvh) { .sv-full { min-height: calc(100dvh - 175px); } }
            `}</style>

            {/* 인사 화면 — 말풍선은 화면 세로 가운데, 시작하기는 하단 고정 배치 */}
            {step === -1 && (
              <div className="sv-full" style={{ animation: 'surveySlideIn .25s ease' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                    <img src="/founder-seungju.jpg" alt="Sean" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,.1)', flexShrink: 0 }} />
                    <div style={{ flex: 1, background: '#fff', border: '1px solid #eee5da', borderRadius: '4px 16px 16px 16px', padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,.05)' }}>
                      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35, marginBottom: 6 }}>{L(COPY.introHi)(firstName)}</div>
                      <div style={{ fontSize: 14, color: '#4a443c', lineHeight: 1.6 }}>{em(L(COPY.intro))}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <button style={btn(true)} onClick={() => goTo(0)}>{L(COPY.start)}</button>
                  <div style={{ fontSize: 12, color: '#a89f92', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
                    {L(COPY.privacy)}
                  </div>
                </div>
              </div>
            )}

            {/* 질문 화면 — 이전 버튼은 상단, 질문 카드는 세로 가운데(짧을 때 하단 공백 방지, margin:auto라 길면 자연 스크롤) */}
            {step >= 0 && (
              <div className="sv-full">
                {step > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <button onClick={() => goTo(step - 1)} style={{ border: 'none', background: 'none', color: '#8a8073', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{L(COPY.back)}</button>
                  </div>
                )}
                <div style={{ margin: 'auto 0', paddingBottom: 24 }}>

            {q && (
              <div key={q.key} style={{ animation: 'surveySlideIn .25s ease' }}>
                <div style={qBox}>
                  <div style={qTitle}>{step + 1}. {em(L(q.title))}</div>
                  {q.type === 'radio' && q.opts.map((o) => (
                    <div key={o.value} style={rowSt(a[q.key] === o.value)} onClick={() => clickRadio(q.key, o.value)}>
                      <Dot on={a[q.key] === o.value} />{LOpt(o)}
                    </div>
                  ))}
                  {q.type === 'multi' && q.opts.map((o) => (
                    <div key={o.value} style={rowSt(a[q.key].includes(o.value))} onClick={() => clickMulti(q.key, o, q.opts)}>
                      <Check on={a[q.key].includes(o.value)} />{LOpt(o)}
                    </div>
                  ))}
                  {q.type === 'spend' && (
                    <>
                      {q.opts.map((o) => (
                        <div key={o.value} style={rowSt(a.spend_sel.includes(o.value))} onClick={() => clickMulti('spend_sel', o, q.opts)}>
                          <Check on={a.spend_sel.includes(o.value)} />{LOpt(o)}
                        </div>
                      ))}
                      {/* 고른 항목마다 금액 입력이 슥 나타난다 — 모바일 숫자 키패드(inputmode) */}
                      {a.spend_sel.filter((k) => k !== 'none').map((k) => {
                        const o = q.opts.find((x) => x.value === k)
                        return (
                          <div key={k} style={{ animation: 'surveySlideIn .25s ease', marginTop: 8 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8a8073', margin: '0 0 4px 2px' }}>{o ? LOpt(o) : k}</div>
                            {k === 'other' && (
                              <input style={{ ...input, marginBottom: 6 }} value={a.spend_other} onChange={(e) => set('spend_other', e.target.value)} onFocus={focusScroll}
                                placeholder={lang === 'ko' ? '어떤 항목인가요?' : 'Khoản gì vậy?'} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                style={{ ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                                inputMode="numeric" pattern="[0-9]*" placeholder="500.000"
                                value={fmtVnd(digitsOf(a.spend_amounts[k]))}
                                onChange={(e) => set('spend_amounts', { ...a.spend_amounts, [k]: digitsOf(e.target.value) })}
                                onFocus={focusScroll}
                              />
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#8a8073', flexShrink: 0 }}>₫</span>
                            </div>
                          </div>
                        )
                      })}
                      {/* 금액은 타이핑이라 자동 진행 불가 — 버튼을 항상 보여주되 다 채우기 전엔 비활성 ('없음'은 자동 진행) */}
                      {!a.spend_sel.includes('none') && (
                        <button style={{ ...btn(stepDone(step)), marginTop: 12 }} disabled={!stepDone(step)} onClick={() => stepDone(step) && goTo(step + 1)}>
                          {L(COPY.next)}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* 2-1 후속 — Q2에서 단계를 고르면 그 단계 맞춤 주관식이 같은 화면에 슥 나타난다 */}
                {q.key === 'stage' && a.stage && (
                  <div key={a.stage} data-follow style={followBox}>
                    <div style={qTitle}>2-1. {em(L(PAIN_PROMPTS[a.stage] || PAIN_PH))}</div>
                    <textarea style={ta} value={a.pain} onChange={(e) => set('pain', e.target.value)} onFocus={focusScroll} placeholder={L(PAIN_PH)} />
                    {/* 주관식은 타이핑이라 자동 진행 불가 — 버튼을 항상 보여주되 쓰기 전엔 비활성 */}
                    <button style={{ ...btn(a.pain.trim().length >= 5), marginTop: 10 }} disabled={a.pain.trim().length < 5} onClick={() => goTo(step + 1)}>
                      {L(COPY.next)}
                    </button>
                  </div>
                )}
                {/* N-1 후속 — 답에 따라 "어땠는지"/"왜 안 했는지"가 같은 화면에 슥 나타난다 */}
                {FOLLOWUPS.filter((f) => f.parent === q.key && f.when(a)).map((f) => (
                  <div key={f.key} data-follow style={followBox}>
                    <div style={qTitle}>{step + 1}-1. {em(L(f.title))}</div>
                    {f.opts.map((o) => (
                      <div key={o.value} style={rowSt(a[f.key] === o.value)} onClick={() => clickRadio(f.key, o.value)}>
                        <Dot on={a[f.key] === o.value} />{LOpt(o)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* 마지막 스텝 — 인터뷰 옵트인 + 제출 */}
            {step === QUESTIONS.length && (
              <div style={{ animation: 'surveySlideIn .25s ease' }}>
                <div style={qBox}>
                  <div style={qTitle}>{TOTAL}. {em(L(COPY.callTitle))}</div>
                  <div style={rowSt(a.call_ok)} onClick={() => set('call_ok', !a.call_ok)}>
                    <Check on={a.call_ok} />{L(COPY.callYes)}
                  </div>
                  {a.call_ok && (
                    <input style={{ ...input, marginTop: 6 }} value={a.contact} onChange={(e) => set('contact', e.target.value)} onFocus={focusScroll} placeholder={L(COPY.callPh)} />
                  )}
                  <div style={{ fontSize: 13, color: '#8a8073', marginTop: 10, lineHeight: 1.55 }}>
                    {L(COPY.callAlt)}{' '}
                    <a href="https://www.linkedin.com/in/wiseungju/" target="_blank" rel="noreferrer" style={{ color: '#0a66c2', fontWeight: 700 }}>LinkedIn →</a>
                  </div>
                </div>

                {error && <div style={{ color: '#c00', fontSize: 13.5, marginBottom: 10, textAlign: 'center' }}>{error}</div>}
                <button style={btn(canSubmit && state !== 'submitting')} onClick={submit} disabled={!canSubmit || state === 'submitting'}>
                  {state === 'submitting' ? L(COPY.submitting) : L(COPY.submit)}
                </button>
                <div style={{ fontSize: 12, color: '#a89f92', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
                  {L(COPY.privacy)}
                </div>
              </div>
            )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
