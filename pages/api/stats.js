import supabase from '../../lib/supabaseAdmin';
import { excludeSuspicious, DEFAULT_SLIDER_VALUE, SLIDER_GUARD_DEPLOYED_AT } from '../../lib/salaryQuality';
import { SALARY_MIN, SALARY_MAX } from '../../lib/salaryStats';

// 실제 제출 폼 taxonomy(submit.js)와 일치 — 기존엔 라벨 불일치로 과소 집계됐음
const VALID_ROLES = ['Backend','Frontend','Mobile','Data · AI','DevOps','PM · PO','Design','QA'];
const VALID_EXP   = ['Under 1yr','1–2 yrs','3–4 yrs','5–7 yrs','8+ yrs'];

export default async function handler(req, res) {
  // 유효 실유입(seed·이상치 제외) 기준 카운트.
  // 하드범위는 슬라이더 끝값 배타 — lib/salaryStats.js와 동일 기준.
  const base = () => supabase.from('submissions').select('*', { count: 'exact', head: true })
    .neq('source', 'seed').in('role', VALID_ROLES).in('experience', VALID_EXP)
    .gt('salary', SALARY_MIN).lt('salary', SALARY_MAX);

  const [totalResult, suspiciousResult, coResult, recentResult] = await Promise.all([
    base(),
    // 슬라이더 기본값(62) 미입력 통과 의심값 — 카운트에서도 제외.
    // 조건은 lib/salaryQuality.js와 동일(가드 배포 이전 행만).
    base().eq('salary', DEFAULT_SLIDER_VALUE).lt('created_at', SLIDER_GUARD_DEPLOYED_AT),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('company, role, experience, salary, created_at')
      .neq('source', 'seed').in('role', VALID_ROLES).in('experience', VALID_EXP)
      .gt('salary', SALARY_MIN).lt('salary', SALARY_MAX)
      .order('created_at', { ascending: false }).limit(30),
  ]);

  const submissionCount = Math.max(0, (totalResult.count || 0) - (suspiciousResult.count || 0));

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.json({
    submissionCount,
    companyCount: coResult.count || 0,
    recent: excludeSuspicious(recentResult.data || []),
  });
}
