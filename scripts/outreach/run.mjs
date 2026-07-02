// 콜드아웃리치 오케스트레이터 — 초안생성 → 검수 → 테스트발송 → 실발송(소량).
// 실발송은 --confirm 없으면 절대 안 나갑니다. 발신자는 --owner 로 선택(기본 wsj).
//
//   node scripts/outreach/run.mjs generate [N] [--corp] [--owner younghun]
//   node scripts/outreach/run.mjs preview  [N] [--owner younghun]
//   node scripts/outreach/run.mjs test [email] [--owner younghun]
//   node scripts/outreach/run.mjs send [N] --confirm [--owner younghun]
import { sb, sendMail, getSignature, composeHtml, pixelUrl, resolveOwner, splitName } from './lib.mjs'
import { generateDraft } from './draft.mjs'

const COLS = 'id, company_name, contact_name, email, industry, industry_detail, business_desc, memo, status, email_subject, email_body'
const [mode, ...rest] = process.argv.slice(2)
const confirm = rest.includes('--confirm')
const corpOnly = rest.includes('--corp')
const ownerArg = (() => { const i = rest.indexOf('--owner'); return i >= 0 ? rest[i + 1] : null })()
const owner = resolveOwner(ownerArg)
const CAMPAIGN = owner.campaign
const N = parseInt(rest.find(a => /^\d+$/.test(a)) || '5', 10)

const enrich = (r) => {
  const c = splitName(r.company_name), n = splitName(r.contact_name)
  return { ...r, company_en: c.en, company_ko: c.ko, contact_en: n.en, contact_ko: n.ko }
}
const label = (r) => `${r.company_ko || r.company_en}`

async function fetchTodo({ needDraft }) {
  let q = sb.from('cold_outreach').select(COLS).eq('campaign', CAMPAIGN).eq('status', 'todo')
    .order('created_at', { ascending: true }).limit(N)
  if (corpOnly) q = q.like('memo', '%[corp]%')
  q = needDraft ? q.not('email_body', 'is', null) : q.is('email_body', null)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(enrich)
}

if (mode === 'generate') {
  const leads = await fetchTodo({ needDraft: false })
  console.log(`[${owner.name}] 초안 생성 대상 ${leads.length}건${corpOnly ? ' (회사도메인만)' : ''}…`)
  for (const l of leads) {
    try {
      const { subject, body } = await generateDraft(l, owner.key)
      await sb.from('cold_outreach').update({ email_subject: subject, email_body: body, generated_at: new Date().toISOString() }).eq('id', l.id)
      console.log(`  ✓ ${label(l)} — ${subject}`)
    } catch (e) { console.log(`  ✗ ${label(l)}: ${e.message}`) }
  }
  console.log(`\n다음: node scripts/outreach/run.mjs preview${ownerArg ? ` --owner ${ownerArg}` : ''}`)
}

else if (mode === 'preview') {
  const { data } = await sb.from('cold_outreach').select(COLS).eq('campaign', CAMPAIGN)
    .not('email_body', 'is', null).order('generated_at', { ascending: false }).limit(N)
  for (const r of (data || []).map(enrich)) {
    console.log('\n────────────────────────────────────────')
    console.log(`받는사람: ${r.contact_ko || r.contact_en || '담당자'} <${r.email}>  |  ${label(r)}`)
    console.log(`제목: ${r.email_subject}`)
    console.log('')
    console.log(r.email_body)
  }
  console.log(`\n(${(data || []).length}건 미리보기 — 발송 안 함)`)
}

else if (mode === 'test') {
  const to = rest.find(a => a.includes('@')) || owner.sender
  const { data } = await sb.from('cold_outreach').select(COLS).eq('campaign', CAMPAIGN).limit(1)
  if (!data?.length) { console.log(`리드가 없습니다 (campaign=${CAMPAIGN}).`); process.exit(1) }
  const lead = enrich(data[0])
  const draft = lead.email_body ? { subject: lead.email_subject, body: lead.email_body } : await generateDraft(lead, owner.key)
  console.log(`\n[${owner.name}] 테스트 대상: ${label(lead)}`)
  console.log(`제목: ${draft.subject}\n`)
  console.log(draft.body)
  const sig = await getSignature(owner)
  const r = await sendMail(owner, { to, subject: `[테스트] ${draft.subject}`, html: composeHtml(draft.body, sig, pixelUrl(lead.id)) })
  console.log(`\n✅ ${to} 로 테스트 발송됨 (id: ${r.id})`)
}

else if (mode === 'send') {
  if (!confirm) { console.log('실발송입니다(되돌릴 수 없음). 확인하려면 --confirm 을 붙여 다시 실행하세요.'); process.exit(1) }
  const leads = await fetchTodo({ needDraft: true })
  const sig = await getSignature(owner)
  console.log(`[${owner.name}] 실발송 ${leads.length}건 → ${owner.sender} 에서 발송 (건당 4초 간격)…`)
  let ok = 0
  for (const l of leads) {
    try {
      const r = await sendMail(owner, { to: l.email, subject: l.email_subject, html: composeHtml(l.email_body, sig, pixelUrl(l.id)) })
      await sb.from('cold_outreach').update({ status: 'sent', sent_at: new Date().toISOString().slice(0, 10), gmail_thread_id: r.threadId || null }).eq('id', l.id)
      ok++; console.log(`  ✓ ${l.email} (${label(l)}) id:${r.id}`)
      await new Promise(s => setTimeout(s, 4000))
    } catch (e) { console.log(`  ✗ ${l.email}: ${e.message}`) }
  }
  console.log(`\n완료 — 발송 ${ok}/${leads.length}`)
}

else {
  console.log(`콜드아웃리치 파이프라인 (발신자 --owner, 기본 ${owner.name} / ${owner.sender})

  node scripts/outreach/run.mjs generate [N] [--corp] [--owner younghun]  초안 생성(기본5)
  node scripts/outreach/run.mjs preview  [N] [--owner younghun]           초안 검수(발송X)
  node scripts/outreach/run.mjs test [email] [--owner younghun]           테스트 발송
  node scripts/outreach/run.mjs send [N] --confirm [--owner younghun]     소량 실발송`)
}
