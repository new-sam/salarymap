-- 한국어 스피드퀴즈 시도 기록.
-- 목적: 한국어 가능한 베트남 인재 유입 퍼널(퀴즈 → 가입 → CV 등록)의 시작점.
-- 익명(client_id)으로 플레이 → 가입 후 claim 으로 user_id 연결(랭킹 등록).
-- 채점은 서버(문제은행 lib/quizBank.js)에서만 하므로 정답은 DB에 두지 않는다.
-- ⚠️ 수동 적용: Supabase 대시보드 SQL 에디터에서 실행 (db push 금지 — 히스토리 미동기)

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  user_id uuid references auth.users(id) on delete set null,
  question_ids jsonb not null,        -- 출제된 문제 id 배열 (제출 시 이 순서로 채점)
  answers jsonb,                      -- 선택지 인덱스 배열 (미응답 null)
  score int,
  total int not null,
  elapsed_ms int,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 리더보드: user 가 연결된 완료 시도만 대상
create index if not exists idx_quiz_attempts_user on quiz_attempts (user_id) where user_id is not null;
create index if not exists idx_quiz_attempts_score on quiz_attempts (score desc) where score is not null;

-- 접근은 전부 service_role API 경유 — 정책 없이 잠근다
alter table quiz_attempts enable row level security;
