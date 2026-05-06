import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const dict = [
  [/재택\s*근무|원격\s*근무|리모트\s*워크/i, 'Remote work'],
  [/유연\s*근무|탄력\s*근무|자율\s*출퇴근|시차\s*출퇴근|자율\s*근무|유연\s*출퇴근|시차\s*출근/i, 'Flexible work hours'],
  [/재량\s*근로/i, 'Discretionary work hours'],
  [/주\s*4\s*일|주4일/i, '4-day work week'],
  [/야근\s*없|불필요한\s*야근|칼퇴|야근\s*강요\s*없/i, 'No forced overtime'],
  [/회식\s*강요\s*없|불필요한.*회식/i, 'No forced company dinners'],
  [/점심|중식|식대|식비\s*지원/i, 'Lunch provided'],
  [/석식|저녁\s*식사|저녁\s*지원/i, 'Dinner support'],
  [/조식|아침\s*식사/i, 'Breakfast provided'],
  [/간식|스낵/i, 'Snacks provided'],
  [/커피|원두/i, 'Coffee provided'],
  [/음료/i, 'Beverages provided'],
  [/건강\s*검진/i, 'Annual health checkup'],
  [/의료\s*보험|건강\s*보험|단체\s*보험/i, 'Health insurance'],
  [/스톡\s*옵션|RSU|주식/i, 'Stock options'],
  [/인센티브|성과급|보너스|상여/i, 'Performance bonus'],
  [/연봉|급여|보상/i, 'Competitive salary'],
  [/경조사/i, 'Family event support'],
  [/생일/i, 'Birthday benefit'],
  [/교육|강의|세미나|컨퍼런스|학회|역량\s*개발/i, 'Education & conference support'],
  [/도서|서적/i, 'Book purchase support'],
  [/장비|노트북|맥북|모니터|개인\s*장비|업무\s*장비|원하는\s*장비/i, 'Equipment support'],
  [/웰컴\s*키트/i, 'Welcome kit'],
  [/휴가|연차|리프레쉬|리프레시|안식/i, 'Extra vacation / refresh leave'],
  [/복장|캐주얼|자유로운\s*복장/i, 'Casual dress code'],
  [/통근|교통|출퇴근\s*지원|교통비/i, 'Commute support'],
  [/주차/i, 'Parking'],
  [/헬스|운동|피트니스|체력\s*단련/i, 'Fitness support'],
  [/동호회|사내\s*활동|취미/i, 'Club activities'],
  [/워크샵|워크숍|팀\s*빌딩|MT/i, 'Team building / workshop'],
  [/자기\s*계발/i, 'Self-development support'],
  [/출산|육아|육아\s*휴직/i, 'Parental leave'],
  [/어린이집|보육/i, 'Childcare support'],
  [/해외\s*여행|해외\s*워크숍|해외\s*연수/i, 'Overseas team trip'],
  [/포상|우수\s*직원|상금/i, 'Employee awards'],
  [/추천\s*인|추천.*포상|레퍼럴/i, 'Referral bonus'],
  [/멘토링|온보딩|적응\s*지원|Soft.?landing/i, 'Onboarding & mentoring program'],
  [/명절|설|추석/i, 'Holiday bonus'],
  [/최신\s*기술|기술\s*스택|신기술/i, 'Latest tech stack'],
  [/수평적|수평\s*문화|자유로운\s*분위기|자유로운\s*문화/i, 'Flat organizational culture'],
  [/지하철|역\s*근처|접근성|도보/i, 'Convenient location (near subway)'],
  [/휴게실|라운지|휴식/i, 'Lounge / break room'],
  [/반려\s*동물|펫/i, 'Pet-friendly office'],
  [/채용.*마감|상시\s*채용|조기\s*마감/i, 'Rolling recruitment'],
  [/전문\s*연구|병역\s*특례/i, 'Military service exemption eligible'],
]

function translateBenefit(text) {
  if (!text || text.length < 2) return null
  // Already English
  if (!/[가-힣]/.test(text)) return text

  // Header-like text (＜...＞, [...], numbered headers)
  if (/^[＜<\[■□●◆▶▷☞※★♦\d]/.test(text.trim()) && text.length < 20) return null
  if (/^[\d]+\.?\s/.test(text.trim()) && text.length < 20) return null

  for (const [pattern, eng] of dict) {
    if (pattern.test(text)) return eng
  }

  // Generic patterns
  if (/지원/.test(text) && text.length < 40) return 'Company support'
  if (/제공/.test(text) && text.length < 40) return 'Company benefit'
  if (/운영/.test(text) && text.length < 40) return 'Company program'

  // Too long or unrecognized - skip
  if (text.length > 50) return null

  return null
}

const { data } = await supabase.from('jobs').select('id, benefits').eq('source', 'wanted')
const kr = data.filter(j => j.benefits?.some(b => /[가-힣]/.test(b)))

let updated = 0
for (const job of kr) {
  const translated = job.benefits
    .map(b => translateBenefit(b))
    .filter(b => b !== null && b.length > 0)

  // Deduplicate
  const unique = [...new Set(translated)].slice(0, 8)

  if (unique.length > 0) {
    await supabase.from('jobs').update({ benefits: unique }).eq('id', job.id)
    updated++
  }
}

// Verify
const { data: check } = await supabase.from('jobs').select('id, benefits').eq('source', 'wanted')
const remaining = check.filter(j => j.benefits?.some(b => /[가-힣]/.test(b)))
console.log('Updated:', updated)
console.log('Remaining Korean benefits:', remaining.length)
if (remaining.length > 0) {
  for (const j of remaining.slice(0, 3)) {
    const krItems = j.benefits.filter(b => /[가-힣]/.test(b))
    console.log('  ', krItems)
  }
}
