-- 콜드메일 영업 대상/진행 관리 (B2B 공고 영입)
-- 발송 자체는 외부(Gmail 등)에서 하고, 여기서는 대상·진행상태만 추적한다.
-- 업종이 IT에 한정되지 않고 운영하며 컬럼이 바뀔 수 있어 우선 뼈대만 잡는다.
CREATE TABLE IF NOT EXISTS cold_outreach (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  contact_name text,                      -- 담당자
  email text,
  industry text,                          -- 업종 (자유 입력)
  campaign text,                          -- 라운드/캠페인 라벨 (내용 버전 구분용)
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','sent','replied','meeting','won','lost')),
  sent_at date,                           -- 발송일
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cold_outreach_status ON cold_outreach (status);
CREATE INDEX IF NOT EXISTS idx_cold_outreach_campaign ON cold_outreach (campaign);

-- service_role(서버 API)로만 접근. 클라이언트 직접 접근 정책은 두지 않아 차단된다.
ALTER TABLE cold_outreach ENABLE ROW LEVEL SECURITY;
