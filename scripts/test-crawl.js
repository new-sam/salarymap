// 크롤러 로컬 테스트 스크립트
// Usage: node scripts/test-crawl.js

// Node 18+ has built-in fetch

const WANTED_API = 'https://www.wanted.co.kr/api/v4/jobs'
const PAGE_LIMIT = 5 // 테스트용 소량

async function test() {
  console.log('=== 원티드 원격근무 공고 크롤링 테스트 ===\n')

  // 1. 목록 가져오기
  const url = `${WANTED_API}?country=kr&tag_type_ids=518&location=all&years=-1&limit=${PAGE_LIMIT}&offset=0`
  console.log(`Fetching: ${url}\n`)

  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const data = await resp.json()
  const jobs = data.data || []

  console.log(`목록 결과: ${jobs.length}개\n`)

  // 2. 첫 번째 공고 상세 가져오기
  if (jobs.length > 0) {
    const first = jobs[0]
    console.log(`--- 상세 조회: ${first.position} (${first.company.name}) ---`)

    const detailResp = await fetch(`${WANTED_API}/${first.id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const detailData = await detailResp.json()
    const detail = detailData.job

    console.log(`Title: ${detail.position}`)
    console.log(`Company: ${detail.company?.name}`)
    console.log(`Location: ${detail.address?.full_location}`)
    console.log(`Experience: ${detail.annual_from}~${detail.annual_to}년`)
    console.log(`Skill Tags: ${(detail.skill_tags || []).map(s => s.title).join(', ')}`)
    console.log(`Deadline: ${first.due_time || 'none'}`)
    console.log(`Apply URL: https://www.wanted.co.kr/wd/${first.id}`)
    console.log(`Image: ${first.title_img?.origin || 'none'}`)

    const benefits = detail.detail?.benefits
    if (benefits) {
      const parsed = benefits.split('\n').map(s => s.replace(/^[•\-\s]+/, '').trim()).filter(s => s.length > 0 && s.length < 100).slice(0, 5)
      console.log(`Benefits: ${parsed.join(' | ')}`)
    }

    console.log('\n--- 전체 목록 요약 ---')
    for (const j of jobs) {
      console.log(`  [${j.id}] ${j.position} @ ${j.company.name} (due: ${j.due_time || '-'})`)
    }
  }
}

test().catch(console.error)
