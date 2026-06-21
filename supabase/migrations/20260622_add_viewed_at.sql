-- 지원자 detail 을 처음 열어본 시점을 status 와 분리해서 기록한다.
-- 그 전에는 detail 을 여는 순간 job_applications.status 가 pending → viewed 로
-- 자동 전환됐는데, ATS UI 가 status 의 의미를 4단계 stepper(서류 → 1차 인터뷰
-- → 2차 인터뷰 → 최종) 로 재정의한 뒤로는 "카드 클릭 한 번에 1차 인터뷰로
-- 진급" 되어 버리는 버그였다.
--
-- viewed_at 이 채워지면 NEW 카운트에서 빠지지만 status 는 그대로 유지된다.
-- 명시적인 stage 이동(드래그, 다음 단계 버튼)만 status 를 바꾼다.

ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

COMMENT ON COLUMN job_applications.viewed_at IS
  '담당자가 지원자 상세를 처음 연 시점. NEW 카운트 산정용. status 와 분리.';

CREATE INDEX IF NOT EXISTS idx_job_applications_viewed_at
  ON job_applications (job_id, viewed_at)
  WHERE viewed_at IS NULL;
