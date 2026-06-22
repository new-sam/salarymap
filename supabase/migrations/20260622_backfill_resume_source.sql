-- 20260621 마이그레이션이 resume_source 컬럼을 추가했지만, 그 전에 이미
-- 이력서를 등록한 사람들은 source 가 NULL 인 상태로 남아 있다. 그러면 admin
-- 이력서 탭의 새 필터가 "지금까지 CV 페이지로 들어온 사람은?" 같은 질문에
-- 답을 못 한다. 가능한 단서를 모아 retroactive 하게 source 를 추정한다.
--
-- 우선순위:
--   1) events 테이블에 cv_register_success 가 있으면 → CV 페이지 등록
--   2) resume_platform = 'app' (이미 X-Client-Platform 으로 기록됨) → 앱 등록
--   3) 그 외 resume_url 이 있는 행은 직접 등록(/profile) 으로 본다 — 가장
--      흔한 경로. /jobs 의 AI 프롬프트 동의는 별도 식별 단서가 없어 묶이지만
--      "어디로 등록됐는지" 가 NULL 보다 정확하다.

-- 1) CV 페이지: cv_register_success 이벤트 자취가 있는 사용자
UPDATE user_profiles up
SET resume_source = 'cv'
WHERE up.resume_url IS NOT NULL
  AND up.resume_source IS NULL
  AND EXISTS (
    SELECT 1 FROM events e
    WHERE e.event = 'cv_register_success'
      AND e.user_id = up.id
  );

-- 2) 앱 등록: platform 이 app 으로 이미 기록된 행
UPDATE user_profiles
SET resume_source = 'app'
WHERE resume_url IS NOT NULL
  AND resume_source IS NULL
  AND resume_platform = 'app';

-- 3) 직접 등록(/profile) 으로 추정: 나머지 web/null platform 의 이력서
--    소유자. /jobs AI 프롬프트 경로도 여기 묶이지만 별도 단서가 없다.
UPDATE user_profiles
SET resume_source = 'profile'
WHERE resume_url IS NOT NULL
  AND resume_source IS NULL;
