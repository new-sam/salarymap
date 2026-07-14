import supabase from '../../lib/supabaseAdmin';

// 실험 플래그 공개 읽기 — 클라이언트 useFlags()가 호출. 값이 없으면 클라 기본값(ON)이 적용됨.
export default async function handler(req, res) {
  try {
    const { data, error } = await supabase.from('app_flags').select('key, enabled');
    if (error) throw error;
    const out = {};
    for (const r of data || []) out[r.key] = r.enabled;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(out);
  } catch {
    // 테이블 미생성 등 — 빈 객체를 주면 클라가 기본값으로 동작
    return res.status(200).json({});
  }
}
