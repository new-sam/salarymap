import { createClient } from '@supabase/supabase-js';

/* KTC 랜딩 공고 조회 + 정규화.
   원본 ktc-landing 레포와 같은 Supabase(jobs, is_active=true)를 읽기 전용으로 쓴다.
   목록 API(pages/api/ktc/jobs.js)와 상세 페이지(pages/ktc/jobs/[id].js)가 공유. */

let client = null;
function db() {
  if (!process.env.KTC_LANDING_SUPABASE_URL || !process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!client) {
    client = createClient(
      process.env.KTC_LANDING_SUPABASE_URL,
      process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return client;
}

/* 서비스 롤 키를 쓰는 공개 경로라 컬럼을 명시적으로 고른다 — select('*') 로 두면
   나중에 내부용 컬럼이 추가됐을 때 그대로 공개돼 버린다. */
const COLUMNS = [
  'id', 'job_id', 'title', 'company_name', 'company_logo', 'company_website',
  'location', 'work_type', 'category', 'industry', 'experience',
  'salary_min', 'salary_max', 'headcount', 'is_matching_week',
  'description', 'responsibilities', 'requirements', 'benefits', 'created_at',
].join(',');

// 한 줄 값 — 앞뒤 공백과 중간 개행("\nHCM, ĐN, HN", "District 7, HCMC ")을 정리
const oneLine = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s || null;
};

// 본문 — 줄바꿈은 살리되 CRLF 통일하고 빈 줄 3개 이상은 2개로 줄인다
const multiLine = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s || null;
};

/* 입력이 "0n-site"(숫자 0), "On-site\r\n", "Onsite", "On-site\n" 등으로 제각각이라
   비교 가능한 세 값으로 접는다. 매칭 안 되면 null → 필터에서 제외. */
export function normalizeWorkType(raw) {
  const s = String(raw || '').toLowerCase().replace(/[\s\-_]/g, '').replace(/0n/g, 'on');
  if (!s) return null;
  if (s.includes('remote')) return 'Remote';
  if (s.includes('hybrid')) return 'Hybrid';
  if (s.includes('onsite')) return 'Onsite';
  return null;
}

function shape(j) {
  return {
    id: j.id,
    jobId: oneLine(j.job_id),
    title: oneLine(j.title),
    company: oneLine(j.company_name),
    companyLogo: oneLine(j.company_logo),
    companyWebsite: oneLine(j.company_website),
    location: oneLine(j.location),
    workType: normalizeWorkType(j.work_type),
    category: oneLine(j.category),
    // 랜딩 필터는 IT / Non-IT 두 갈래 — category 는 IT·Marketing·UI/UX·Business·Designer·HR 로 들어온다
    group: oneLine(j.category) === 'IT' ? 'IT' : 'Non-IT',
    industry: oneLine(j.industry),
    experience: oneLine(j.experience),
    salaryMin: j.salary_min ?? null,
    salaryMax: j.salary_max ?? null,
    headcount: j.headcount ?? null,
    isMatchingWeek: !!j.is_matching_week,
    description: multiLine(j.description),
    responsibilities: multiLine(j.responsibilities),
    requirements: multiLine(j.requirements),
    benefits: multiLine(j.benefits),
  };
}

export async function fetchKtcJobs() {
  const c = db();
  if (!c) throw new Error('KTC landing Supabase is not configured');
  const { data, error } = await c
    .from('jobs')
    .select(COLUMNS)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(shape);
}

export async function fetchKtcJob(id) {
  const c = db();
  if (!c) throw new Error('KTC landing Supabase is not configured');
  const { data, error } = await c
    .from('jobs')
    .select(COLUMNS)
    .eq('is_active', true)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? shape(data) : null;
}
