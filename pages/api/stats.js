import supabase from '../../lib/supabaseAdmin';
import { excludeSuspicious } from '../../lib/salaryQuality';

// 실제 제출 폼 taxonomy(submit.js)와 일치 — 기존엔 라벨 불일치로 과소 집계됐음
const VALID_ROLES = ['Backend','Frontend','Mobile','Data · AI','DevOps','PM · PO','Design','QA'];
const VALID_EXP   = ['Under 1yr','1–2 yrs','3–4 yrs','5–7 yrs','8+ yrs'];
const MIN_SAL = 5, MAX_SAL = 300;

export default async function handler(req, res) {
  // 유효 실유입(seed·이상치 제외) 기준 카운트
  const base = () => supabase.from('submissions').select('*', { count: 'exact', head: true })
    .neq('source', 'seed').in('role', VALID_ROLES).in('experience', VALID_EXP)
    .gte('salary', MIN_SAL).lte('salary', MAX_SAL);

  const [totalResult, suspiciousResult, coResult, recentResult] = await Promise.all([
    base(),
    // 슬라이더 기본값(62) 미입력 통과 의심값 — 카운트에서도 제외
    base().eq('salary', 62).in('experience', ['Under 1yr', '1–2 yrs']),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('company, role, experience, salary')
      .neq('source', 'seed').in('role', VALID_ROLES).in('experience', VALID_EXP)
      .gte('salary', MIN_SAL).lte('salary', MAX_SAL)
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
