// 프로필 → 맞는 공고 매칭. 원래 recommend-jobs-coldmail.mjs 안에만 있던 로직인데,
// /resume 등록 완료 화면도 같은 목록을 보여주게 되면서 이리로 뺐다. 메일이 "당신에게 맞는
// 공고"라고 보낸 것과 화면이 보여주는 것이 다르면 안 된다 — 기준은 한 곳에만 둔다.
//
// 스크립트(.mjs)와 Next 양쪽에서 import 하므로 내부 import 는 확장자를 붙인다.
import { guessRole } from './roleGuess.js'
import { roleGroupKey } from '../constants/jobs.js'

export function cityOf(loc) {
  const s = (loc || '').toLowerCase()
  if (/hcm|ho chi minh|hồ chí minh|tp\.? ?hcm|thu duc|thủ đức|district|quận/.test(s)) return 'hcmc'
  if (/ha noi|hà nội|hanoi/.test(s)) return 'hanoi'
  if (/da nang|đà nẵng/.test(s)) return 'danang'
  if (/hai phong|hải phòng/.test(s)) return 'haiphong'
  if (/remote/.test(s)) return 'remote'
  return s ? 'other' : null
}

// 매칭에 쓰는 파생 필드(직군키·JD 텍스트·도시)를 공고에 붙인다. matchJobs 는 이 필드를
// 전제로 도므로, 어디서 공고를 읽어오든 넣기 전에 한 번 통과시킨다.
export function decorateJob(j) {
  return {
    ...j,
    grp: j.role ? roleGroupKey(j.role) : null,
    jdText: `${j.title} ${j.description || ''} ${(j.tech_stack || []).join(' ')}`.toLowerCase(),
    city: cityOf(j.location),
  }
}

// 후보 프로필 → 상위 매칭 공고(정렬). 기발송 job_id 는 exclude 로 제외.
export function matchJobs(p, jobs, exclude = new Set()) {
  const roles = new Set()
  for (const t of [p.position, p.headline, ...(p.desired_roles || [])]) { const r = guessRole(t || '', p.skills || []); if (r) roles.add(r) }
  for (const d of (p.desired_roles || [])) roles.add(d)
  const grps = new Set([...roles].map((r) => roleGroupKey(r)).filter(Boolean))
  const yoe = p.yoe_months ? p.yoe_months / 12 : null
  const skills = (p.skills || []).map((s) => String(s).toLowerCase()).filter((s) => s.length >= 3)
  const pcity = cityOf(p.location)
  const rank = { roleExact: 3, roleGroup: 2, skillOnly: 1 }
  const out = []
  for (const j of jobs) {
    if (exclude.has(j.id)) continue
    let yoeOk = true
    if (yoe != null && j.experience_min != null) {
      const lo = Math.max(0, (j.experience_min ?? 0) - 1), hi = (j.experience_max ?? j.experience_min + 5) + 3
      yoeOk = yoe >= lo && yoe <= hi
    }
    if (!yoeOk) continue
    const skillHits = skills.filter((s) => j.jdText.includes(s)).length
    let tier = null
    if (j.role && roles.has(j.role)) tier = 'roleExact'
    else if (j.grp && grps.has(j.grp)) tier = 'roleGroup'
    else if (skillHits >= 2) tier = 'skillOnly'
    if (!tier) continue
    const sameCity = pcity && j.city && pcity === j.city
    out.push({ job: j, tier, skillHits, sameCity, score: rank[tier] * 100 + skillHits * 5 + (sameCity ? 3 : 0) })
  }
  return out.sort((a, b) => b.score - a.score || new Date(b.job.created_at) - new Date(a.job.created_at))
}
