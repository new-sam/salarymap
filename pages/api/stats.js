import supabase from '../../lib/supabaseAdmin';

const VALID_ROLES = ['Backend','Frontend','Fullstack','Mobile','Data Engineer','DevOps / Cloud','UI/UX','PM'];
const VALID_EXP   = ['Under 1 year','1–2 yrs','3–4 yrs','5–7 yrs','8+ yrs'];
const MIN_SAL = 5, MAX_SAL = 300;

export default async function handler(req, res) {
  const [subResult, coResult, recentResult] = await Promise.all([
    supabase.from('submissions').select('*', { count: 'exact', head: true })
      .in('role', VALID_ROLES).in('experience', VALID_EXP)
      .gte('salary', MIN_SAL).lte('salary', MAX_SAL),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('company, role, experience, salary')
      .in('role', VALID_ROLES).in('experience', VALID_EXP)
      .gte('salary', MIN_SAL).lte('salary', MAX_SAL)
      .limit(30),
  ]);

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.json({
    submissionCount: subResult.count || 0,
    companyCount: coResult.count || 0,
    recent: recentResult.data || [],
  });
}
