import { sb } from './lib.mjs'
import { generateDraft } from '../../lib/outreachDraft.js'
const { data } = await sb.from('cold_outreach')
  .select('id, company_name, contact_name, industry, industry_detail, business_desc, campaign, email')
  .eq('campaign','pikdi_targets').eq('company_name','MEDIPEEL').single()
const { subject, body } = await generateDraft(data, 'wsj', 1)
console.log('제목:', subject); console.log('──────────'); console.log(body)
console.log('\n7%/환불/포트폴리오 검사:', /7%|환불|포트폴리오/.test(body) ? '🚨 발견!' : '✅ 없음')
