// Daily community seeding (CLI runner). Generates fresh posts+comments and
// inserts them under the system account (community@system.local). All logic +
// guardrails live in lib/communityContent.js, shared with the Vercel cron route.
//
// Usage:
//   node scripts/community-daily.js --tick [--dry] [--force]        ← scheduled trickle (1 post sometimes + seed-post comment drip)
//   node scripts/community-daily.js --user-drip [--dry] [--force]   ← drip bot comments onto REAL users' posts (every ~5 min)
//   node scripts/community-daily.js [--count N] [--dry]             ← one-off batch of N posts
//   --dry     generate + print, insert nothing
//   --force   (tick/user-drip) ignore active-hour gate
//   --count   (batch) how many posts this run (default 6)
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const OpenAI = require('openai')
const { runDailySeed, runTick, runRealPostDrip } = require('../lib/communityContent')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const log = (m) => console.log(m)

let task
if (args.includes('--user-drip')) {
  task = runRealPostDrip({ supabase, openai, dry, force: args.includes('--force'), log })
} else if (args.includes('--tick')) {
  task = runTick({ supabase, openai, dry, force: args.includes('--force'), log })
} else {
  const ci = args.indexOf('--count')
  const count = ci >= 0 ? Math.max(1, parseInt(args[ci + 1], 10) || 1) : 6
  task = runDailySeed({ supabase, openai, count, dry, log })
}

task
  .then((r) => console.log(dry ? '\n(dry run — không insert gì)' : `\nXong. ${JSON.stringify(r)}`))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
