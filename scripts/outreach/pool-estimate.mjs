// 풀봇 로직 CLI 테스트 — JD 파일을 넣으면 Slack 봇이 달 댓글을 그대로 출력한다.
//   node scripts/outreach/pool-estimate.mjs <jd.txt>
import { readFileSync } from 'node:fs'
import './lib.mjs' // side effect: .env.local → process.env

const file = process.argv[2]
if (!file) { console.error('usage: node scripts/outreach/pool-estimate.mjs <jd.txt>'); process.exit(1) }
const jd = readFileSync(file, 'utf8')

const { estimatePool, formatSlackReply } = await import('../../lib/poolEstimator.js')
const result = await estimatePool(jd)
console.log('── 추출 필터 ──')
console.log(JSON.stringify(result.filters, null, 2))
console.log('\n── Slack 댓글 미리보기 ──')
console.log(formatSlackReply(result))
