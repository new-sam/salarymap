import supabase from '../../../lib/supabaseAdmin';

// 커뮤니티 검색의 "관련 회사" 매칭 전용.
// companies 테이블은 대소문자/오타 변형이 수십 건씩 섞여 있어(예: 'fpt' 49행)
// 쓰레기가 많다. 대신 실제 연봉 제출(submissions.company)을 집계해
// "제출 건수 = 진짜 회사" 신호로 상위 N개만 노출한다. 오타 변형은 건수가 적어 밀려난다.
export default async function handler(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.status(200).json({ companies: [] });

  const { data, error } = await supabase
    .from('submissions')
    .select('company')
    .ilike('company', `%${q}%`)
    .limit(3000);

  if (error || !data) return res.status(200).json({ companies: [] });

  // 정규화 키(lower+trim)로 묶어 건수 집계 + 표시용으로 가장 흔한 원본 표기를 고른다.
  const counts = {};
  const casing = {};
  for (const r of data) {
    const orig = (r.company || '').trim();
    if (!orig) continue;
    const key = orig.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    (casing[key] || (casing[key] = {}))[orig] = (casing[key][orig] || 0) + 1;
  }

  // 건수 하한선으로 오타/부분입력 변형(보통 1~3건)을 걸러낸다. 진짜 회사만 남음.
  const companies = Object.entries(counts)
    .filter(([, c]) => c >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => {
      const name = Object.entries(casing[key]).sort((a, b) => b[1] - a[1])[0][0];
      return { name, count };
    });

  res.status(200).json({ companies });
}
