-- 공고 게시 게이트 강화 (2026-07-05)
-- 배경: 외부 기업 계정이 브라우저에서 jobs 테이블에 직접 insert/update 하는 구조라,
--       기존 RLS는 company_id 소속만 검사하고 is_active/status는 제약하지 않았음.
--       → 외부 계정이 is_active=true / status='live' 를 스스로 넣어 어드민 승인 없이 게시 가능.
-- 조치: BEFORE INSERT/UPDATE 트리거로 "외부(비-likelion, 비-service_role) 계정은
--       스스로 공고를 노출(is_active=true)하거나 status='live'로 승격하지 못하게" 서버에서 차단.
--       어드민 승인 API / 크롤러(service_role), 내부(likelion.net) 계정은 통과.

CREATE OR REPLACE FUNCTION enforce_job_publish_gate()
RETURNS TRIGGER AS $$
DECLARE
  jwt_email text := lower(coalesce(
    current_setting('request.jwt.claims', true)::json ->> 'email', ''));
  is_internal boolean := jwt_email LIKE '%@likelion.net';
BEGIN
  -- service_role(어드민 API/크롤러) · 마이그레이션 · 대시보드 등은 통과.
  -- 실제 로그인 사용자(authenticated/anon)만 게이트 적용.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 내부 스태프는 즉시 게시 허용(기존 동작 유지).
  IF is_internal THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- 외부 계정은 숨겨진 승인 대기 공고만 생성 가능.
    IF NEW.is_active IS TRUE OR NEW.status NOT IN ('draft', 'pending_review') THEN
      RAISE EXCEPTION
        'jobs: 외부 계정은 공고를 직접 게시할 수 없습니다 (status=draft/pending_review, is_active=false 만 허용)';
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- 숨겨진 공고를 스스로 노출시키거나 live로 승격하는 것만 차단.
    -- 이미 승인되어 live/활성인 공고를 수정하거나 pause 하는 것은 허용.
    IF NEW.is_active IS TRUE AND OLD.is_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION
        'jobs: 외부 계정은 공고를 스스로 활성화할 수 없습니다 (관리자 승인 필요)';
    END IF;
    IF NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live' THEN
      RAISE EXCEPTION
        'jobs: 외부 계정은 status=live 로 승격할 수 없습니다 (관리자 승인 필요)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_publish_gate ON jobs;
CREATE TRIGGER trg_jobs_publish_gate
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION enforce_job_publish_gate();
