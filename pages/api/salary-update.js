import supabaseAdmin from '../../lib/supabaseAdmin'
import { verifyToken } from '../../lib/campaignToken'
import { canonicalCompanyName } from '../../lib/canonicalCompany'
import { deriveSalarySubmission } from '../../lib/salarySubmission'

// 현/직전연봉 착지 페이지(/salary-update)의 저장 엔드포인트 — 로그인 없이 동작한다.
// 인증은 메일 링크의 HMAC 토큰(user_id). /api/lang/save 와 같은 최소권한 설계:
//   · 토큰에 든 user_id 의 프로필 1건, current_salary 한 칼럼만 쓴다
//   · 응답에 프로필 데이터를 싣지 않는다
// 입력은 백만 VND/월(triệu) 정수, 저장은 ×1e6 원 단위 — 프로필 폼과 동일 컨벤션.
// 저장값은 events(coldmail_salary_fill).meta.amount 에도 남는다 — 프로필이 나중에
// 무엇에 덮여도 응답 원본이 남는 append-only 기록(어학 8/5 유실 사고의 교훈).

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, amount, type } = req.body || {}
  const claim = verifyToken(token)
  if (!claim?.userId) return res.status(401).json({ error: 'invalid_token' })

  const n = parseInt(amount, 10)
  if (!Number.isFinite(n) || n < 1 || n > 999) return res.status(400).json({ error: 'invalid_amount' })
  // 현재/직전 구분 — DB 컬럼 없이 이벤트 기록에만 남긴다(신선도 참고용).
  const salaryType = ['current', 'previous'].includes(type) ? type : null

  const { data: prof, error: findErr } = await supabaseAdmin
    .from('user_profiles').select('id, position, yoe_months, experiences').eq('id', claim.userId).maybeSingle()
  if (findErr) return res.status(500).json({ error: findErr.message })
  if (!prof) return res.status(404).json({ error: 'profile_not_found' })

  const { error: upErr } = await supabaseAdmin
    .from('user_profiles')
    .update({ current_salary: n * 1000000, updated_at: new Date().toISOString() })
    .eq('id', prof.id)
  if (upErr) return res.status(500).json({ error: upErr.message })

  await supabaseAdmin.from('events').insert({
    event: 'coldmail_salary_fill',
    user_id: prof.id,
    meta: { campaign: claim.campaign, amount: n, type: salaryType },
  })

  // 수집값을 연봉 통계에도 append(source='talent', 재입력도 그대로 쌓음 — 유저 결정 8/14).
  // 파생 실패가 본 저장을 막으면 안 되므로 best-effort.
  try {
    const sub = deriveSalarySubmission({ ...prof, current_salary: n * 1000000 }, salaryType)
    if (sub) {
      const company = sub.company ? await canonicalCompanyName(sub.company) : null
      await supabaseAdmin.from('submissions')
        .insert({ role: sub.role, experience: sub.experience, salary: sub.salary, company, user_id: prof.id, source: 'talent' })
      if (company) {
        await supabaseAdmin.from('companies')
          .upsert({ name: company, tier: 4 }, { onConflict: 'name', ignoreDuplicates: true })
      }
    }
  } catch (e) {
    console.error('salary-update: derived submission failed', e?.message)
  }

  return res.status(200).json({ ok: true })
}
