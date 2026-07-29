import { createClient } from '@supabase/supabase-js';
import { roleGroupKey } from '../constants/jobs';

/* /ktc 공고 조회 + 정규화.
   원본은 FYI jobs 테이블(source='ktc') — 구 KTC 랜딩 Supabase 는 /ktc 로 대체되면서
   일회성 임포트(lib/ktcJobsSync.js) 후 더 이상 읽지 않는다.
   FYI jobs 를 읽어야 공고 id 가 FYI uuid 가 되고, 지원이 job_applications 로 그대로 붙는다.

   FYI jobs 는 본문이 description 한 칸이라 /ktc 가 쓰는 4블록(소개·담당업무·자격요건·복리후생)과
   KTC 고유 값(공고코드·직무 카테고리·경력 표기)은 raw_payload.ktc 에서 복원한다.
   목록 API(pages/api/ktc/jobs.js)와 상세 페이지(pages/ktc/jobs/[id].js)가 공유. */

let client = null;
function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return client;
}

/* 서비스 롤 키를 쓰는 공개 경로라 컬럼을 명시적으로 고른다 — select('*') 로 두면
   나중에 내부용 컬럼이 추가됐을 때 그대로 공개돼 버린다. */
const COLUMNS = [
  'id', 'source_id', 'title', 'company', 'logo_url', 'company_url',
  'location', 'type', 'role', 'experience_min', 'experience_max',
  'salary_min', 'salary_max', 'headcount', 'description', 'raw_payload', 'created_at',
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
   비교 가능한 세 값으로 접는다. 매칭 안 되면 null → 필터에서 제외.
   (임포트 전 원본 표기를 다루므로 lib/ktcJobsSync.js 도 이 함수를 쓴다) */
export function normalizeWorkType(raw) {
  const s = String(raw || '').toLowerCase().replace(/[\s\-_]/g, '').replace(/0n/g, 'on');
  if (!s) return null;
  if (s.includes('remote')) return 'Remote';
  if (s.includes('hybrid')) return 'Hybrid';
  if (s.includes('onsite')) return 'Onsite';
  return null;
}

// source_id 'WF1502#2'(재게시분) → 화면엔 앞머리 코드만
const baseCode = (v) => (String(v || '').match(/^([A-Z]{2,6}\d{3,4})/) || [])[1] || oneLine(v);

/* 어드민에서 직접 등록한 KTC 공고는 raw_payload.ktc 가 없어 category 를 FYI role 로 만든다.
   /ktc 필터는 데이터에 있는 category 값을 그대로 칩으로 뽑으므로(components/ktc/JobBoard.js),
   'Backend' 같은 FYI 직군이 새 칩으로 새지 않게 KTC 6개 값으로 접어준다. */
const ROLE_TO_KTC_CATEGORY = {
  Design: 'Designer', 'UX Researcher': 'Designer',
  Marketing: 'Marketing', HR: 'HR',
};
const GROUP_TO_KTC_CATEGORY = {
  software: 'IT', data: 'IT', infra: 'IT', qa: 'IT', security: 'IT', leadership: 'IT', other_tech: 'IT',
  product: 'Business',        // PM·PO — 디자인 직군은 ROLE_TO_KTC_CATEGORY 에서 먼저 걸린다
  business: 'Business', manufacturing: 'Business',
};
const ktcCategory = (role) =>
  ROLE_TO_KTC_CATEGORY[role] || GROUP_TO_KTC_CATEGORY[roleGroupKey(role)] || null;

// experience_min/max → "3+ year" 류 표기 복원(raw_payload 에 원문이 없을 때만)
function expText(min, max) {
  if (!min && !max) return null;
  if (min && max) return `${min}-${max} year`;
  return `${min || max}+ year`;
}

/* FYI jobs 행 → /ktc 화면이 쓰는 모양.
   KTC 고유 값은 raw_payload.ktc 우선, 없으면 FYI 컬럼에서 최대한 복원한다.
   (어드민에서 손질된 role/type 보다 KTC 원본 category/work_type 이 /ktc 필터 기준에 맞다) */
function shape(j) {
  const k = (j.raw_payload && j.raw_payload.ktc) || {};
  const role = oneLine(j.role);
  // 마지막 폴백(role 원문)은 KTC 목록에 없는 레거시 직군값 대비 — 매핑에 걸리면 여기까지 오지 않는다
  const category = oneLine(k.category) || ktcCategory(role) || role;
  return {
    id: j.id,
    jobId: baseCode(k.job_id || j.source_id),
    title: oneLine(j.title),
    company: oneLine(j.company),
    companyLogo: oneLine(j.logo_url) || oneLine(k.company_logo),
    companyWebsite: oneLine(j.company_url) || oneLine(k.company_website),
    location: oneLine(j.location),
    workType: normalizeWorkType(k.work_type || j.type),
    category,
    // 랜딩 필터는 IT / Non-IT 두 갈래 — category 는 IT·Marketing·UI/UX·Business·Designer·HR 로 들어온다
    group: category === 'IT' ? 'IT' : 'Non-IT',
    industry: oneLine(k.industry),
    experience: oneLine(k.experience) || expText(j.experience_min, j.experience_max),
    salaryMin: j.salary_min ?? null,
    salaryMax: j.salary_max ?? null,
    headcount: j.headcount ?? null,
    isMatchingWeek: !!k.is_matching_week,
    // 4블록이 없으면(임포트 이전 행) description 한 덩어리만 보여준다
    description: multiLine(k.description) || multiLine(j.description),
    responsibilities: multiLine(k.responsibilities),
    requirements: multiLine(k.requirements),
    benefits: multiLine(k.benefits),
  };
}

export async function fetchKtcJobs() {
  const c = db();
  if (!c) throw new Error('Supabase is not configured');
  const { data, error } = await c
    .from('jobs')
    .select(COLUMNS)
    .eq('source', 'ktc')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(shape);
}

export async function fetchKtcJob(id) {
  const c = db();
  if (!c) throw new Error('Supabase is not configured');
  const { data, error } = await c
    .from('jobs')
    .select(COLUMNS)
    .eq('source', 'ktc')
    .eq('is_active', true)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? shape(data) : null;
}
