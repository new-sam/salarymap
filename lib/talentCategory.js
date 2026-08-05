/* 인재 직군 분류 — 인재풀 '엘리트' 탭과 어학 A/B급 전시장이 함께 쓴다.

   원래 TalentPoolView 안에 있던 것을 옮겼다(규칙은 그대로). 두 화면이 같은
   '프론트엔드/백엔드/UIUX/브랜딩/소셜/퍼포먼스'를 말해야 하는데 분류를 각자
   들고 있으면 한쪽만 고쳤을 때 같은 사람이 화면마다 다른 직군으로 뜬다. */

export const ELITE_CATS = [
  { key: 'dev', label: { ko: '개발', en: 'Development', vi: 'Phát triển' }, cats: [
    { key: 'frontend', label: { ko: '프론트엔드', en: 'Frontend', vi: 'Frontend' } },
    { key: 'backend', label: { ko: '백엔드', en: 'Backend', vi: 'Backend' } },
  ] },
  { key: 'design', label: { ko: '디자인', en: 'Design', vi: 'Thiết kế' }, cats: [
    { key: 'uiux', label: { ko: 'UI/UX', en: 'UI/UX', vi: 'UI/UX' } },
    { key: 'branding', label: { ko: '브랜딩 · 에셋', en: 'Branding & Assets', vi: 'Branding & Assets' } },
  ] },
  { key: 'marketing', label: { ko: '마케터', en: 'Marketing', vi: 'Marketing' }, cats: [
    { key: 'social', label: { ko: '소셜 마케터', en: 'Social', vi: 'Social' } },
    { key: 'performance', label: { ko: '퍼포먼스 마케터', en: 'Performance', vi: 'Performance' } },
  ] },
]

export function asSkills(skills) {
  if (!skills) return []
  return (Array.isArray(skills) ? skills : String(skills).split(',')).map(s => s.trim()).filter(Boolean)
}

export function asExperiences(exp) {
  if (!exp) return []
  if (Array.isArray(exp)) return exp
  try { const p = JSON.parse(exp); return Array.isArray(p) ? p : [] } catch { return [] }
}

// position 만으로는 안 갈린다 — Fullstack 은 스택으로, 디자인은 헤드라인 문구로 가른다.
// 여섯 갈래에 안 걸리면 null(= 전시장·엘리트 모두에서 '그 외').
export function eliteCategory(r) {
  const h = (r.headline || '').toLowerCase()
  const t = [r.headline, ...asSkills(r.skills), r.major, ...asExperiences(r.experiences).map(e => e?.title)]
    .filter(Boolean).join(' ').toLowerCase()
  if (r.position === 'Backend') return 'backend'
  if (['Frontend', 'Web'].includes(r.position)) return 'frontend'
  if (r.position === 'Fullstack') return /back|node|java|spring|php|laravel|\.net|golang/.test(t) ? 'backend' : 'frontend'
  if (['Design', 'UX Researcher'].includes(r.position)) {
    return (/graphic|brand|illustrator|motion|art director|visual/.test(h) && !/ui|ux/.test(h)) ? 'branding' : 'uiux'
  }
  if (/graphic|motion|illustrator|art director|visual design|multimedia design/.test(h)) return 'branding'
  if (r.position === 'Marketing') {
    return /performance|growth|google ads|meta ads|facebook ads|media buy|ppc|paid|digital marketing manager/.test(h) ? 'performance' : 'social'
  }
  return null
}
