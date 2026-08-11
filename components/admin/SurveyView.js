import { useState } from 'react'
import { useAdmin } from '../../lib/adminSwr'

// 유저 서베이 결과 — 콜드메일 개인 토큰 링크(/survey?t=)로 받은 응답 열람.
// 서베이는 기능을 직접 묻지 않으므로(현황·경험 질문만), 기능 수요는 여기서 답변 조합으로 도출한다.
// 데이터: /api/admin/survey-results (events survey_* 집계). 문항 정의는 pages/survey.js QUESTIONS와 1:1.
const PALETTE = ['#EA580C', '#2563EB', '#0D9488', '#7C3AED', '#B45309', '#DB2777', '#6B7280', '#0891B2']
const mk = (entries) => Object.fromEntries(entries.map(([v, ko, en, vi], i) => [v, { ko, en, vi, color: PALETTE[i % PALETTE.length] }]))

const OPT_LABELS = {
  status: mk([
    ['seeking', '구직 중', 'Job seeking', 'Đang tìm việc'],
    ['employed_open', '재직·이직 관심', 'Employed, open', 'Đi làm, quan tâm'],
    ['employed_stay', '재직·이직 생각 없음', 'Employed, staying', 'Đi làm, không đổi'],
    ['student', '학생', 'Student', 'Sinh viên'],
  ]),
  stage: mk([
    ['finding_jobs', '맞는 공고 찾기', 'Finding jobs', 'Tìm việc phù hợp'],
    ['no_response', '지원해도 답 없음', 'No response', 'Không phản hồi'],
    ['interview', '면접', 'Interview', 'Phỏng vấn'],
    ['salary_offer', '연봉·오퍼', 'Salary/offer', 'Lương/offer'],
    ['direction', '뭘 배울지·방향', 'Direction', 'Định hướng'],
    ['language', '언어', 'Language', 'Ngôn ngữ'],
  ]),
  cv_feedback: mk([
    ['none', '받아본 적 없음', 'Never', 'Chưa từng'],
    ['friends', '친구·지인', 'Friends', 'Bạn bè'],
    ['mentor', '멘토·선배·교수', 'Mentor', 'Mentor'],
    ['paid', '유료 서비스', 'Paid service', 'Dịch vụ trả phí'],
    ['ai', 'AI 도구', 'AI tools', 'Công cụ AI'],
  ]),
  cv_worry: mk([
    ['confident', '자신 있음', 'Confident', 'Tự tin'],
    ['content', '내용 쓰기', 'Content', 'Nội dung'],
    ['design', '디자인·형식', 'Design', 'Thiết kế'],
    ['language', '한/영 표현', 'Language', 'Diễn đạt'],
    ['thin', '스펙 부족해 보임', 'Looks thin', 'Trông mỏng'],
  ]),
  photo_current: mk([
    ['studio', '스튜디오 촬영', 'Studio', 'Studio'],
    ['app', '앱 보정', 'App-edited', 'Chỉnh app'],
    ['casual', '셀카·일반', 'Casual/selfie', 'Selfie'],
    ['none', '아직 없음', 'None', 'Chưa có'],
  ]),
  interview_prep: mk([
    ['no_exp', '면접 경험 없음', 'No experience', 'Chưa từng PV'],
    ['none', '준비 안 함', 'No prep', 'Không chuẩn bị'],
    ['solo', '혼자 검색·정리', 'Solo', 'Tự chuẩn bị'],
    ['friends', '친구·스터디', 'With friends', 'Cùng bạn bè'],
    ['paid', '유료 이용', 'Paid', 'Trả phí'],
  ]),
  interview_weak: mk([
    ['language', '한/영 답변', 'Language', 'Ngôn ngữ'],
    ['unknown_q', '질문 예측 불가', 'Unknown questions', 'Không biết hỏi gì'],
    ['nervous', '긴장·말하기', 'Nervous', 'Hồi hộp'],
    ['technical', '기술 질문', 'Technical', 'Chuyên môn'],
    ['salary', '연봉 이야기', 'Salary talk', 'Nói về lương'],
    ['no_exp', '경험 없어 모름', 'No experience', 'Chưa từng PV'],
  ]),
  coach_who: mk([
    ['nobody', '상의할 사람 없음', 'Nobody', 'Không có ai'],
    ['friends', '친구·가족', 'Friends/family', 'Bạn bè·gia đình'],
    ['colleagues', '회사 선배·동료', 'Colleagues', 'Đồng nghiệp'],
    ['mentor', '멘토', 'Mentor', 'Mentor'],
    ['community', '온라인 커뮤니티', 'Community', 'Cộng đồng'],
  ]),
  coach_exp: mk([
    ['helped', '받아봄·도움됨', 'Had, helpful', 'Rồi, hữu ích'],
    ['lacking', '받아봄·아쉬움', 'Had, lacking', 'Rồi, chưa đủ'],
    ['wanted', '원했지만 못 받음', 'Wanted, no way', 'Muốn mà chưa có'],
    ['no_need', '필요 못 느낌', 'No need', 'Chưa cần'],
  ]),
  // 조건부 후속(N-1) — 경험의 질/부재 이유
  cv_fb_quality: mk([
    ['helped', '충분히 도움됨', 'Helpful', 'Hữu ích'],
    ['some', '도움됐지만 아쉬움', 'Some, lacking', 'Chưa đủ'],
    ['not', '별로 도움 안 됨', 'Not helpful', 'Không giúp mấy'],
  ]),
  cv_fb_why_not: mk([
    ['no_one', '부탁할 사람 없음', 'No one to ask', 'Không có ai'],
    ['embarrassed', '보여주기 부끄러움', 'Embarrassed', 'Ngại'],
    ['no_need', '필요 없다 생각', 'No need', 'Không cần'],
    ['no_thought', '생각 안 해봄', 'Never thought', 'Chưa nghĩ tới'],
  ]),
  photo_app_sat: mk([
    ['satisfied', '만족함', 'Satisfied', 'Hài lòng'],
    ['okay', '아쉽지만 그냥 씀', 'Okay, not great', 'Tạm ổn'],
    ['unsatisfied', '불만족·더 나은 방법 찾는 중', 'Unsatisfied', 'Chưa hài lòng'],
  ]),
  photo_why: mk([
    ['cost', '비용 부담', 'Cost', 'Chi phí'],
    ['hassle', '시간·번거로움', 'Hassle', 'Ngại·bận'],
    ['dont_know', '방법 모름', "Don't know how", 'Không biết cách'],
    ['no_need', '중요치 않다 생각', 'No need', 'Không quan trọng'],
  ]),
  prep_enough: mk([
    ['enough', '충분함', 'Enough', 'Đủ'],
    ['lacking', '부족함·더 나은 방법 찾는 중', 'Lacking', 'Chưa đủ'],
  ]),
  prep_why_not: mk([
    ['no_need', '필요 못 느낌', 'No need', 'Chưa cần'],
    ['dont_know', '뭘 준비할지 모름', "Don't know what", 'Không biết gì'],
    ['no_partner', '연습 상대 없음', 'No partner', 'Không có ai luyện'],
  ]),
  info_source: mk([
    ['fb_groups', 'Facebook 그룹', 'FB groups', 'Nhóm FB'],
    ['friends', '친구·지인', 'Friends', 'Bạn bè'],
    ['linkedin', 'LinkedIn', 'LinkedIn', 'LinkedIn'],
    ['job_sites', '구직 사이트', 'Job sites', 'Trang tuyển dụng'],
    ['youtube', '유튜브·블로그', 'YouTube/blog', 'YouTube'],
    ['none', '딱히 없음', 'None', 'Không có'],
  ]),
  info_trust: mk([
    ['trust', '믿을 만함', 'Trustworthy', 'Đáng tin'],
    ['mixed', '절반은 걸러야 함', 'Half noise', 'Phải tự lọc'],
    ['distrust', '광고·과장 많아 불신', 'Distrust', 'Khó tin'],
  ]),
  info_gap: mk([
    ['salary', '실제 연봉 시세', 'Real salary', 'Mức lương thật'],
    ['reviews', '회사 평판·문화', 'Company reviews', 'Đánh giá cty'],
    ['kr_company', '한국 기업 정보', 'KR company info', 'Cty Hàn'],
    ['job_fresh', '공고 진위·최신성', 'Job freshness', 'Tin thật·mới'],
    ['none', '딱히 없음', 'None', 'Không có'],
  ]),
  info_gap_impact: mk([
    ['yes_bad', '잘못된 선택·시간 낭비', 'Real harm', 'Chọn sai·mất time'],
    ['yes_minor', '조금 불편한 정도', 'Minor', 'Hơi bất tiện'],
    ['no', '딱히 없음', 'No', 'Chưa'],
  ]),
  learn_block: mk([
    ['doing', '필요한 건 하는 중', 'Already learning', 'Đang học'],
    ['what', '뭘 배울지 몰라서', "Don't know what", 'Không biết học gì'],
    ['money_time', '시간·돈 때문에', 'Time/money', 'Thời gian·tiền'],
    ['quality', '좋은 강의 못 찾음', 'No good courses', 'Chưa tìm được'],
  ]),
  learn_want: mk([
    ['language', '한국어·영어', 'Language', 'Ngoại ngữ'],
    ['job_skill', '직무 스킬', 'Job skills', 'Kỹ năng ngành'],
    ['coding', '코딩·데이터', 'Coding/data', 'Lập trình'],
    ['cert', '자격증', 'Certificates', 'Chứng chỉ'],
    ['soft', '소프트스킬', 'Soft skills', 'Kỹ năng mềm'],
    ['other', '기타', 'Other', 'Khác'],
  ]),
  spent_item: mk([
    ['language_test', '어학시험 응시료', 'Language test', 'Lệ phí thi'],
    ['course', '강의·클래스', 'Course', 'Khóa học'],
    ['cv_service', 'CV 서비스', 'CV service', 'Dịch vụ CV'],
    ['photo', '프로필 사진', 'Photo', 'Ảnh hồ sơ'],
    ['coaching', '멘토링·상담', 'Coaching', 'Tư vấn'],
    ['other', '기타', 'Other', 'Khác'],
  ]),
}
const vnd = (n) => (n || 0).toLocaleString('vi-VN') + '₫'

// 기능 수요 도출 — 서베이는 기능을 직접 안 물었으므로, 답변 조합으로 판정한다.
// 판정식은 카드에 그대로 노출해 유저가 타당성을 직접 판단할 수 있게 한다.
const SIGNALS = [
  {
    key: 'cv_review',
    name: { ko: '이력서 첨삭', en: 'CV review', vi: 'Sửa CV' },
    formula: { ko: '(CV 걱정 + 제대로 된 피드백 경험 없음) 또는 받아봤지만 아쉬움/도움 안 됨, 또는 못 받은 이유가 사람 없음/부끄러움', en: 'Worry + no proper feedback, or unmet', vi: '' },
    test: (a) => (a.cv_worry && a.cv_worry !== 'confident'
      && (Array.isArray(a.cv_feedback) ? a.cv_feedback : []).every((v) => v === 'none' || v === 'friends'))
      || a.cv_fb_quality === 'some' || a.cv_fb_quality === 'not'
      || a.cv_fb_why_not === 'no_one' || a.cv_fb_why_not === 'embarrassed',
  },
  {
    key: 'photo',
    name: { ko: '프로필 사진', en: 'Profile photo', vi: 'Ảnh hồ sơ' },
    formula: { ko: '사진 없음/셀카 + 이유가 비용·번거로움·방법 모름("불필요" 제외), 또는 앱 사용 중인데 아쉬움·불만족', en: 'No photo blocked by cost/hassle, or app-unsatisfied', vi: '' },
    test: (a) => ((a.photo_current === 'none' || a.photo_current === 'casual') && a.photo_why !== 'no_need')
      || (a.photo_current === 'app' && (a.photo_app_sat === 'okay' || a.photo_app_sat === 'unsatisfied')),
  },
  {
    key: 'mock_interview',
    name: { ko: '모의 면접', en: 'Mock interview', vi: 'PV thử' },
    formula: { ko: '(약점=질문예측/긴장/언어 + 준비 취약) 또는 현재 방식 부족함, 또는 준비 안 하는 이유가 방법·상대 없음', en: 'Weakness + weak prep, or lacking', vi: '' },
    test: (a) => (['unknown_q', 'nervous', 'language'].includes(a.interview_weak)
      && ['none', 'solo', 'no_exp'].includes(a.interview_prep))
      || a.prep_enough === 'lacking'
      || a.prep_why_not === 'dont_know' || a.prep_why_not === 'no_partner',
  },
  {
    key: 'coaching',
    name: { ko: '커리어 코칭', en: 'Career coaching', vi: 'Coaching' },
    formula: { ko: '상의할 사람 없음, 또는 상담 원했지만 못 받음·받았지만 아쉬움', en: 'Nobody to ask, or unmet demand', vi: '' },
    test: (a) => a.coach_who === 'nobody' || a.coach_exp === 'wanted' || a.coach_exp === 'lacking',
  },
  {
    key: 'job_info',
    name: { ko: '채용·기업 정보', en: 'Job/company info', vi: 'Thông tin việc làm' },
    formula: { ko: '부족 정보 있음 + 실제 곤란 경험(잘못된 선택·시간 낭비), 또는 정보 불신', en: 'Info gap with real harm, or distrust', vi: '' },
    test: (a) => (a.info_gap && a.info_gap !== 'none' && a.info_gap_impact === 'yes_bad') || a.info_trust === 'distrust',
  },
  {
    key: 'education',
    name: { ko: '교육·강의', en: 'Education', vi: 'Khóa học' },
    formula: { ko: '배우고 싶지만 못 시작 — 뭘 배울지 모름 또는 좋은 강의·자료 못 찾음(시간·돈은 제외)', en: 'Blocked by what/quality', vi: '' },
    test: (a) => a.learn_block === 'what' || a.learn_block === 'quality',
  },
  {
    key: 'community',
    name: { ko: '정보 공유·커뮤니티', en: 'Info sharing', vi: 'Cộng đồng' },
    formula: { ko: '정보 소스가 없음, 또는 있어도 절반은 걸러야 함·불신', en: 'No source, or low trust', vi: '' },
    test: (a) => (Array.isArray(a.info_source) && a.info_source.includes('none')) || a.info_trust === 'mixed' || a.info_trust === 'distrust',
  },
]

const CHARTS = [
  { key: 'status', title: { ko: 'Q1. 현재 상태', en: 'Q1. Status', vi: 'Q1' } },
  { key: 'stage', title: { ko: 'Q2. 가장 막히는 단계', en: 'Q2. Hardest stage', vi: 'Q2' } },
  { key: 'cv_feedback', title: { ko: 'Q3. CV 피드백 경험 (다중)', en: 'Q3. CV feedback', vi: 'Q3' }, multi: true },
  { key: 'cv_fb_quality', title: { ko: 'Q3-1. 피드백 만족도 (경험자)', en: 'Q3-1. Feedback quality', vi: 'Q3-1' } },
  { key: 'cv_fb_why_not', title: { ko: 'Q3-1. 안 받은 이유 (무경험)', en: 'Q3-1. Why not', vi: 'Q3-1' } },
  { key: 'cv_worry', title: { ko: 'Q4. CV 걱정', en: 'Q4. CV worry', vi: 'Q4' } },
  { key: 'photo_current', title: { ko: 'Q5. 프로필 사진 현황', en: 'Q5. Photo', vi: 'Q5' } },
  { key: 'photo_app_sat', title: { ko: 'Q5-1. 앱 사진 만족도 (앱 사용자)', en: 'Q5-1. App photo satisfaction', vi: 'Q5-1' } },
  { key: 'photo_why', title: { ko: 'Q5-1. 사진 미준비 이유', en: 'Q5-1. Why no photo', vi: 'Q5-1' } },
  { key: 'interview_prep', title: { ko: 'Q6. 면접 준비 방식', en: 'Q6. Interview prep', vi: 'Q6' } },
  { key: 'prep_enough', title: { ko: 'Q6-1. 준비 방식 충분한가', en: 'Q6-1. Prep enough?', vi: 'Q6-1' } },
  { key: 'prep_why_not', title: { ko: 'Q6-1. 준비 안 하는 이유', en: 'Q6-1. Why no prep', vi: 'Q6-1' } },
  { key: 'interview_weak', title: { ko: 'Q7. 면접 약점', en: 'Q7. Interview weakness', vi: 'Q7' } },
  { key: 'coach_who', title: { ko: 'Q8. 커리어 상의 상대', en: 'Q8. Career advisor', vi: 'Q8' } },
  { key: 'coach_exp', title: { ko: 'Q9. 커리어 상담 경험', en: 'Q9. Coaching experience', vi: 'Q9' } },
  { key: 'info_source', title: { ko: 'Q10. 정보 소스 (다중)', en: 'Q10. Info sources', vi: 'Q10' }, multi: true },
  { key: 'info_trust', title: { ko: 'Q10-1. 정보 신뢰도', en: 'Q10-1. Info trust', vi: 'Q10-1' } },
  { key: 'info_gap', title: { ko: 'Q11. 부족한 정보', en: 'Q11. Info gap', vi: 'Q11' } },
  { key: 'info_gap_impact', title: { ko: 'Q11-1. 실제 곤란 경험', en: 'Q11-1. Real impact', vi: 'Q11-1' } },
  { key: 'learn_block', title: { ko: 'Q12. 학습 블로커', en: 'Q12. Learning blocker', vi: 'Q12' } },
  { key: 'learn_want', title: { ko: 'Q12-1. 배우고 싶은 것', en: 'Q12-1. Want to learn', vi: 'Q12-1' } },
]

export default function SurveyView({ token, lang }) {
  const ko = lang === 'ko'
  const L = (k, e, v) => (lang === 'vi' ? (v ?? e) : ko ? k : e)
  const Lm = (m) => (lang === 'vi' ? (m.vi || m.en) : ko ? m.ko : m.en)
  const { data, error, isLoading } = useAdmin('/api/admin/survey-results', token)
  const [campaign, setCampaign] = useState('all')

  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c00' }}>{L('불러오기 실패', 'Failed to load', 'Tải thất bại')} — {error.message}</div>
  if (isLoading || !data) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L('불러오는 중…', 'Loading…', 'Đang tải…')}</div>

  const { campaigns = [], responses = [] } = data
  const rows = campaign === 'all' ? responses : responses.filter((r) => r.campaign === campaign)

  const label = (key, v) => {
    const o = OPT_LABELS[key]?.[v]
    return o ? Lm(o) : (v || '—')
  }
  const pct = (n, d) => d ? `${Math.round((n / d) * 100)}%` : '—'

  const distOf = (key, multi) => {
    const m = {}
    for (const r of rows) {
      const v = r.answers?.[key]
      if (multi) for (const x of (Array.isArray(v) ? v : [])) m[x] = (m[x] || 0) + 1
      else if (v) m[v] = (m[v] || 0) + 1
    }
    return m
  }
  const callOk = rows.filter((r) => r.answers?.call_ok).length

  // 지출 — 카테고리별 지출자 수·평균 금액 (구조화 spent_items 기반)
  const spendStat = {}
  let spendNone = 0
  for (const r of rows) {
    const a = r.answers || {}
    if (a.spent_none) { spendNone++; continue }
    for (const it of (Array.isArray(a.spent_items) ? a.spent_items : [])) {
      const s = (spendStat[it.item] ||= { n: 0, sum: 0 })
      s.n++
      s.sum += it.amount || 0
    }
  }

  const card = { background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, padding: '14px 16px' }
  const th = (txt, extra) => <th style={{ textAlign: 'left', padding: '10px 10px', fontWeight: 600, whiteSpace: 'nowrap', ...extra }}>{txt}</th>

  const DistBars = ({ title, map, d }) => (
    <div style={card}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {Object.keys(map).map((k) => {
        const n = d[k] || 0
        const max = Math.max(1, ...Object.values(d))
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, width: 130, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{Lm(map[k])}</div>
            <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4 }}>
              <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: map[k].color, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
          </div>
        )
      })}
      {!Object.values(d).some(Boolean) && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{L('응답 없음', 'No responses', 'Chưa có')}</div>}
    </div>
  )

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 6 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{L('유저 서베이', 'User survey', 'Khảo sát người dùng')}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7280' }}>
          {L('콜드메일 개인 링크(/survey?t=) 응답 — 기능 수요는 직접 안 묻고 아래 도출 패널에서 조합 판정', 'Cold-mail personal-link responses — feature demand derived from combinations', 'Phản hồi qua link cá nhân')}
        </div>
      </div>

      {/* 캠페인별 퍼널 */}
      <div className="adm-m-scroll" style={{ margin: '14px 0 18px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, minWidth: 560, width: '100%' }}>
          <thead style={{ background: '#F9FAFB', color: '#6B7280', fontSize: 12 }}>
            <tr>
              {th(L('캠페인', 'Campaign', 'Chiến dịch'))}
              {th(L('발송', 'Sent', 'Đã gửi'), { textAlign: 'right' })}
              {th(L('열람', 'Viewed', 'Đã mở'), { textAlign: 'right' })}
              {th(L('제출', 'Submitted', 'Đã trả lời'), { textAlign: 'right' })}
              {th(L('열람률', 'View rate', 'Tỷ lệ mở'), { textAlign: 'right' })}
              {th(L('제출률', 'Submit rate', 'Tỷ lệ trả lời'), { textAlign: 'right' })}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.campaign} style={{ borderTop: '1px solid #F3F4F6' }}>
                <td style={{ padding: '10px 10px', fontWeight: 600 }}>{c.campaign}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.sent.toLocaleString()}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.viewed.toLocaleString()}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{c.submitted.toLocaleString()}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', color: '#6B7280' }}>{pct(c.viewed, c.sent)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', color: '#6B7280' }}>{pct(c.submitted, c.sent)}</td>
              </tr>
            ))}
            {!campaigns.length && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>{L('아직 발송된 캠페인이 없습니다', 'No campaigns yet', 'Chưa có chiến dịch')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 캠페인 필터 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {['all', ...campaigns.map((c) => c.campaign)].map((c) => (
          <button key={c} onClick={() => setCampaign(c)} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: campaign === c ? '1px solid #0F172A' : '1px solid #E5E8EB',
            background: campaign === c ? '#0F172A' : '#fff', color: campaign === c ? '#fff' : '#374151',
          }}>{c === 'all' ? L('전체', 'All', 'Tất cả') : c}</button>
        ))}
      </div>

      {/* 기능 수요 도출 — 답변 조합 판정 (판정식 노출) */}
      <div style={{ fontSize: 13.5, fontWeight: 700, margin: '4px 0 8px' }}>{L('기능 수요 도출', 'Derived feature demand', 'Nhu cầu tính năng (suy ra)')}</div>
      <div className="adm-m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
        {SIGNALS.map((s) => {
          const n = rows.filter((r) => s.test(r.answers || {})).length
          return (
            <div key={s.key} style={card}>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{Lm(s.name)}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                {pct(n, rows.length)} <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>({n}/{rows.length})</span>
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.45 }}>{s.formula.ko}</div>
            </div>
          )
        })}
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>{L('인터뷰 승낙', 'Call opt-in', 'Đồng ý gọi')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
            {pct(callOk, rows.length)} <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>({callOk}/{rows.length})</span>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{L('15분 통화 OK + 연락처', '15-min call OK', 'OK gọi 15 phút')}</div>
        </div>
      </div>

      {/* 문항별 분포 */}
      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 18 }}>
        {CHARTS.map((c) => (
          <DistBars key={c.key} title={Lm(c.title)} map={OPT_LABELS[c.key]} d={distOf(c.key, c.multi)} />
        ))}
        {/* Q10 지출 — 카테고리별 지출자 수 + 평균 금액 (실지불 = 최강 수요 신호) */}
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 10 }}>{L('Q13. 실지출 (지출자 수 · 평균액)', 'Q13. Actual spend', 'Q13. Chi tiêu')}</div>
          {Object.keys(OPT_LABELS.spent_item).map((k) => {
            const s = spendStat[k]
            const max = Math.max(1, ...Object.values(spendStat).map((x) => x.n), spendNone)
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, width: 110, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{Lm(OPT_LABELS.spent_item[k])}</div>
                <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4 }}>
                  <div style={{ width: `${((s?.n || 0) / max) * 100}%`, height: '100%', background: OPT_LABELS.spent_item[k].color, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, width: 110, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {s ? `${s.n}명 · ${vnd(Math.round(s.sum / s.n))}` : '0'}
                </div>
              </div>
            )
          })}
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 8 }}>{L('지출 없음', 'No spend', 'Không chi')}: {spendNone}{L('명', '', '')}</div>
        </div>
      </div>

      {/* 응답 전문 */}
      <div className="adm-m-scroll">
        <table style={{ borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #E5E8EB', borderRadius: 12, minWidth: 1000, width: '100%' }}>
          <thead style={{ background: '#F9FAFB', color: '#6B7280', fontSize: 12 }}>
            <tr>
              {th(L('일시', 'Date', 'Ngày'))}
              {th(L('응답자', 'User', 'Người dùng'))}
              {th(L('상태', 'Status', 'Tình trạng'))}
              {th(L('단계', 'Stage', 'Bước khó'))}
              {th(L('2-1. 구체적 사건', '2-1. What happened', '2-1. Chuyện cụ thể'), { minWidth: 200 })}
              {th(L('선택 응답', 'Choices', 'Lựa chọn'), { minWidth: 220 })}
              {th(L('Q13. 지출', 'Q13. Spend', 'Q13. Chi tiền'), { minWidth: 150 })}
              {th(L('인터뷰', 'Call', 'Gọi'))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = r.answers || {}
              const st = OPT_LABELS.status[a.status]
              const sg = OPT_LABELS.stage[a.stage]
              const pick = (k) => label(k, a[k])
              const fb = (Array.isArray(a.cv_feedback) ? a.cv_feedback : []).map((v) => label('cv_feedback', v)).join('·') || '—'
              return (
                <tr key={`${r.campaign}:${r.user_id}`} style={{ borderTop: '1px solid #F3F4F6', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', color: '#6B7280', fontSize: 12 }}>{(r.created_at || '').slice(0, 10)}</td>
                  <td style={{ padding: '10px 10px', minWidth: 140 }}>
                    <div style={{ fontWeight: 600 }}>{r.name || '—'}</div>
                    <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{r.email}{r.position ? ` · ${r.position}` : ''}</div>
                  </td>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    {st ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${st.color}18`, color: st.color }}>{Lm(st)}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    {sg ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${sg.color}18`, color: sg.color }}>{Lm(sg)}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', lineHeight: 1.5, maxWidth: 300 }}>{a.pain || '—'}</td>
                  <td style={{ padding: '10px 10px', fontSize: 11.5, lineHeight: 1.6, color: '#374151' }}>
                    <div>CV: {pick('cv_worry')} / {fb}{a.cv_fb_quality ? ` → ${pick('cv_fb_quality')}` : ''}{a.cv_fb_why_not ? ` → ${pick('cv_fb_why_not')}` : ''}</div>
                    <div>{L('사진', 'Photo', 'Ảnh')}: {pick('photo_current')}{a.photo_app_sat ? ` → ${pick('photo_app_sat')}` : ''}{a.photo_why ? ` → ${pick('photo_why')}` : ''}</div>
                    <div>{L('면접', 'Interview', 'PV')}: {pick('interview_prep')}{a.prep_enough ? ` → ${pick('prep_enough')}` : ''}{a.prep_why_not ? ` → ${pick('prep_why_not')}` : ''} / {pick('interview_weak')}</div>
                    <div>{L('상담', 'Advice', 'Tư vấn')}: {pick('coach_who')} / {pick('coach_exp')}</div>
                    <div>{L('정보', 'Info', 'Thông tin')}: {(Array.isArray(a.info_source) ? a.info_source : []).map((v) => label('info_source', v)).join('·') || '—'}{a.info_trust ? ` → ${pick('info_trust')}` : ''} / {pick('info_gap')}{a.info_gap_impact ? ` → ${pick('info_gap_impact')}` : ''}</div>
                    <div>{L('교육', 'Learn', 'Học')}: {pick('learn_block')}{a.learn_want ? ` → ${pick('learn_want')}` : ''}</div>
                  </td>
                  <td style={{ padding: '10px 10px', lineHeight: 1.6, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {a.spent_none
                      ? <span style={{ color: '#9CA3AF' }}>{L('없음', 'None', 'Không')}</span>
                      : (Array.isArray(a.spent_items) ? a.spent_items : []).map((it, j) => (
                        <div key={j}>{label('spent_item', it.item)}{it.note ? `(${it.note})` : ''} <b>{vnd(it.amount)}</b></div>
                      ))}
                    {!a.spent_none && !(Array.isArray(a.spent_items) && a.spent_items.length) && '—'}
                  </td>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    {a.call_ok ? <span style={{ color: '#0D9488', fontWeight: 700 }}>✓ {a.contact || ''}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>{L('아직 응답이 없습니다', 'No responses yet', 'Chưa có phản hồi')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
