-- 입사 축하금 클레임의 출발점 — 지원자 본인이 "입사했어요"를 누른 시각.
--
-- status 컬럼을 쓰지 않는 이유: status 는 기업이 ATS 에서 관리하는 파이프라인 값
-- (pending/viewed/reviewing/decided)이다. 지원자의 자기신고를 여기에 쓰면 기업이
-- 기록한 진행 상태를 덮어쓴다. 두 축은 주체가 다르므로 컬럼도 분리한다.
--
-- 실제 지급은 입사 후 2개월(60일) 근속이 확인된 뒤 — 이 컬럼은 "신고 시각"일 뿐
-- 지급 승인이 아니다. 승인 기록이 필요해지면 그때 별도 컬럼/테이블로 붙인다.
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS hired_reported_at TIMESTAMPTZ;

COMMENT ON COLUMN job_applications.hired_reported_at IS 'When the applicant self-reported being hired. Start of the hiring-bonus claim; admin confirms separately after 60 days of employment. Not a payout approval.';