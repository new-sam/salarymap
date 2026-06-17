-- 원본 레코드(지원/이력서)에 유입 플랫폼(app/web) 기록.
-- events 테이블의 meta.platform은 분석용 근사치(fire-and-forget)라 일부 누락될 수 있어,
-- 지원자 상세·이력서 목록을 정확히 앱/웹으로 분류하려면 레코드 자체에 출처를 남긴다.
-- 값: 'app'(salary-fyi 모바일) | 'web'(웹) | NULL(이 마이그레이션 이전의 기존 행 = 미상).
-- 식별 방식: 앱은 모든 API 요청에 X-Client-Platform: app 헤더를 붙이고(웹은 헤더 없음→'web'),
--           백엔드(api/job-applications.js, api/profile/upload.js)가 그 값을 기록한다.

ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE user_profiles    ADD COLUMN IF NOT EXISTS resume_platform text;

COMMENT ON COLUMN job_applications.platform IS '지원 유입 플랫폼: app | web | NULL(미상)';
COMMENT ON COLUMN user_profiles.resume_platform IS '마지막 이력서 업로드 출처: app | web | NULL(미상)';
