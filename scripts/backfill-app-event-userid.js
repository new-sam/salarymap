// Backfill: app analytics events whose user_id column is null because the mobile app
// sends the id inside meta.user_id (not as a top-level field). pages/api/track.js was
// fixed to fall back to meta.user_id going forward; this recovers historical rows so the
// KPI tracker's APP tab (active / writers / posts) counts past weeks.
//
// Rule: events where user_id IS NULL, meta.platform='app', meta.user_id present
//       → set user_id = meta.user_id.
//
// Usage:
//   node scripts/backfill-app-event-userid.js           # DRY RUN (no writes)
//   node scripts/backfill-app-event-userid.js --apply    # apply the UPDATE
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://twpxsbnkypocjfnerfmd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;

async function main() {
  // ---- collect candidates (paginated) ----
  const candidates = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('events')
      .select('id, meta, created_at')
      .is('user_id', null)
      .eq('meta->>platform', 'app')
      .not('meta->>user_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('Select error:', error.message); process.exit(1); }
    candidates.push(...data);
    if (data.length < PAGE) break;
  }

  // Group ids by the user_id we'll write, for fewer update calls.
  const byUid = new Map();
  let minDate = null, maxDate = null;
  for (const r of candidates) {
    const uid = r.meta && r.meta.user_id;
    if (!uid) continue;
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid).push(r.id);
    if (!minDate || r.created_at < minDate) minDate = r.created_at;
    if (!maxDate || r.created_at > maxDate) maxDate = r.created_at;
  }

  console.log(`\nCandidate app events (user_id NULL, has meta.user_id): ${candidates.length}`);
  console.log(`Distinct users to recover: ${byUid.size}`);
  console.log(`Date range: ${minDate} … ${maxDate}`);

  if (!APPLY) {
    console.log('\n[DRY RUN] No writes. Re-run with --apply to backfill user_id.');
    return;
  }

  // ---- apply: one update per distinct uid, ids chunked ----
  let updated = 0;
  for (const [uid, ids] of byUid) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from('events')
        .update({ user_id: uid })
        .in('id', chunk)
        .select('id');
      if (error) { console.error(`Update error (uid ${uid}):`, error.message); process.exit(1); }
      updated += data.length;
    }
  }
  console.log(`\n[APPLIED] Backfilled user_id on ${updated} app events.`);
}

main();
