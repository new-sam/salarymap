import supabase from './supabaseAdmin';

// 입력된 회사명을, 같은 회사(대소문자만 다른) 기존 제출들 중 "가장 흔한 표기"로 통일한다.
// 'GRAB VIETNAM' / 'grab vietnam' → 'Grab Vietnam' 처럼 대소문자 분산을 저장 시점에 막는다.
// 신규 회사(기존 제출 없음)면 입력값(trim) 그대로 둔다.
// 주의: 'Grab Viet' 같은 부분/오타 변형은 다른 키라 합치지 않음(그건 기존 데이터 병합으로 처리).
export async function canonicalCompanyName(raw) {
  const name = (raw || '').trim();
  if (!name) return null;

  // ilike에 와일드카드 없이 넘기면 대소문자 무시 완전일치. %,_ 는 패턴 특수문자라 이스케이프.
  const pattern = name.replace(/[%_\\]/g, '\\$&');
  const { data, error } = await supabase
    .from('submissions')
    .select('company')
    .ilike('company', pattern)
    .limit(1000);

  if (error || !data || data.length === 0) return name;

  const casing = {};
  for (const r of data) {
    const c = (r.company || '').trim();
    if (c) casing[c] = (casing[c] || 0) + 1;
  }
  const best = Object.entries(casing).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : name;
}
