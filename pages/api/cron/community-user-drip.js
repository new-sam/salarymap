// Drip bot comments onto REAL users' posts so fresh posts don't sit at 0 comments.
// Primary trigger is GitHub Actions (.github/workflows/community-user-drip.yml,
// every ~5 min running the CLI). This route is a manual/alternative endpoint:
// GET ?dry=1[&force=1] (Bearer ${CRON_SECRET} required).
// Logic/guardrails live in lib/communityContent.js (shared with the CLI): runRealPostDrip.
import OpenAI from 'openai';
import supabaseAdmin from '../../../lib/supabaseAdmin';
import { runRealPostDrip } from '../../../lib/communityContent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dry = req.query.dry === '1';
  const force = req.query.force === '1';

  try {
    const result = await runRealPostDrip({ supabase: supabaseAdmin, openai, dry, force });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
