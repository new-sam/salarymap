import supabase from '../../lib/supabaseAdmin'

// FYI 회사 검색(search_company 이벤트)을 집계해 실시간 인기 회사 TOP N을 만든다.
// 직전 동일 길이 창과 순위를 비교해 변동(new/up/down/same)을 함께 내려준다.
// ?hours=N 으로 창 길이 조절(기본 24h, 최대 30일).
const LIMIT = 10

// 데이터 초기엔 검색 이벤트가 적어 리스트가 빈다. 실데이터가 10개 안 되면
// 아래 시드 회사로 채워 일단 10개를 노출한다(시드는 변동표시 없음/–).
const SEED = ['Grab', 'Shopee', 'VNG', 'MoMo', 'Tiki', 'FPT Software', 'Viettel', 'VNPay', 'Lazada', 'Be Group']

export default async function handler(req, res) {
  const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 24 * 30)
  const now = Date.now()
  const curStartMs = now - hours * 3600 * 1000
  const prevStartMs = now - 2 * hours * 3600 * 1000

  const { data, error } = await supabase
    .from('events')
    .select('meta, created_at')
    .eq('event', 'search_company')
    .gte('created_at', new Date(prevStartMs).toISOString())
  if (error) return res.status(500).json({ error: error.message })

  // key = 소문자 정규화(대소문자/공백 차이 병합), display = 처음 본 원본 표기
  const cur = {}, prev = {}, display = {}
  for (const row of data || []) {
    const name = (row.meta?.company || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!display[key]) display[key] = name
    const ts = new Date(row.created_at).getTime()
    const bucket = ts >= curStartMs ? cur : prev
    bucket[key] = (bucket[key] || 0) + 1
  }

  const rank = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k]) => k)
  const prevPos = {}
  rank(prev).forEach((k, i) => { prevPos[k] = i })

  const companies = rank(cur).slice(0, LIMIT).map((key, i) => {
    const prevI = prevPos[key]
    let move = 'same'
    if (prevI === undefined) move = 'new'
    else if (prevI > i) move = 'up'
    else if (prevI < i) move = 'down'
    return { company: display[key], count: cur[key], rank: i + 1, move }
  })

  // 실데이터가 10개 미만이면 시드로 패딩(중복 제외, 변동표시 없음).
  const seen = new Set(companies.map(c => c.company.toLowerCase()))
  for (const name of SEED) {
    if (companies.length >= LIMIT) break
    if (seen.has(name.toLowerCase())) continue
    companies.push({ company: name, count: 0, rank: companies.length + 1, move: 'same', seed: true })
    seen.add(name.toLowerCase())
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
  res.status(200).json({ companies })
}
