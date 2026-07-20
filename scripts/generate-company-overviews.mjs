import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { COMPANY_PROFILES } from '../data/companyProfiles.js'
import { generateCompanyOverview } from '../lib/companyOverview.js'

// .env.local 수동 로드
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
)

const LANG = process.env.OVERVIEW_LANG || 'vi'
const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity   // 테스트: `node ... 3`
const CONCURRENCY = 3

const today = new Date().toISOString().slice(0, 10)

// 활성 공고(마감 없음 또는 미래) 전체 로드
const { data: jobs, error } = await supabase
  .from('jobs')
  .select('company, title, location, tech_stack, description, deadline')
  .or(`deadline.is.null,deadline.gte.${today}`)
if (error) throw error

// 회사별 대표 공고(설명 가장 긴 것) 선택
const byCompany = new Map()
for (const j of jobs) {
  if (!j.company) continue
  const cur = byCompany.get(j.company)
  if (!cur || (j.description?.length || 0) > (cur.description?.length || 0)) byCompany.set(j.company, j)
}

// 이미 생성된 회사 조회
const { data: existing } = await supabase.from('company_overviews').select('company')
const done = new Set((existing || []).map(r => r.company))

// 대상: 수기 프로필 없음 + 아직 생성 안 됨
let targets = [...byCompany.values()].filter(j => !COMPANY_PROFILES[j.company] && !done.has(j.company))
targets = targets.slice(0, LIMIT)

console.log(`활성 회사 ${byCompany.size} · 수기프로필/기생성 제외 → 생성 대상 ${targets.length} (lang=${LANG})`)

let ok = 0, fail = 0
async function worker(queue) {
  while (queue.length) {
    const job = queue.shift()
    try {
      const overview = await generateCompanyOverview({
        company: job.company, location: job.location, title: job.title,
        tech_stack: job.tech_stack, description: job.description, lang: LANG,
      })
      if (!overview || overview.length < 40) throw new Error('empty/too short')
      const { error: upErr } = await supabase.from('company_overviews').upsert({
        company: job.company, overview, lang: LANG, model: 'gpt-4o', source: 'web_search', generated_at: new Date().toISOString(),
      })
      if (upErr) throw upErr
      ok++
      console.log(`✓ ${job.company}  (${overview.length}자)`)
    } catch (e) {
      fail++
      console.log(`✗ ${job.company}  — ${e.message}`)
    }
  }
}

const q = [...targets]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(q)))
console.log(`\n완료: 성공 ${ok} · 실패 ${fail}`)
