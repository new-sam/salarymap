import supabase from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { role, experience, salary, company, source, email, user_id } = req.body;

  if (!role || !experience || !salary) {
    return res.status(400).json({ error: 'role, experience, salary are required.' });
  }

  // ── Input validation ──
  const VALID_ROLES = ['Backend','Frontend','Mobile','Data · AI','DevOps','PM · PO','Design','QA'];
  const VALID_EXPS  = ['Under 1yr','1–2 yrs','3–4 yrs','5–7 yrs','8+ yrs'];
  const MIN_SALARY = 3;
  const MAX_SALARY = 300;

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (!VALID_EXPS.includes(experience)) {
    return res.status(400).json({ error: `Invalid experience. Must be one of: ${VALID_EXPS.join(', ')}` });
  }
  const salNum = Number(salary);
  if (!Number.isFinite(salNum) || salNum < MIN_SALARY || salNum > MAX_SALARY) {
    return res.status(400).json({ error: `Salary must be between ${MIN_SALARY} and ${MAX_SALARY} (triệu VND).` });
  }
  if (company && (company.trim().length < 2 || company.trim().length > 100)) {
    return res.status(400).json({ error: 'Company name must be 2–100 characters.' });
  }
  const junkPattern = /^(test|qwer|asdf|abc|xxx|123|zzz|aaa|bbb)/i;
  if (company && junkPattern.test(company.trim())) {
    return res.status(400).json({ error: 'Please enter a real company name.' });
  }

  // Insert into existing submissions table (anonymous, no user link)
  const record = { role, experience, salary: salNum, company: company?.trim() || null, source };
  if (email && email.trim()) record.email = email.trim();

  const { data, error } = await supabase
    .from('submissions')
    .insert([record])
    .select('id')
    .single();

  console.log('[submit] record:', record);
  console.log('[submit] error:', error);
  console.log('[submit] data:', data);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Also insert into salary_submissions to link to user (if logged in)
  if (!supabaseAdmin) {
    console.log('[submit] skipping salary_submissions — no service role key');
  } else {
  const { error: ssError } = await supabaseAdmin
    .from('salary_submissions')
    .insert({
      user_id: user_id || null,
      role,
      experience,
      salary,
      company,
      source: source || null,
      created_at: new Date().toISOString(),
    });

  if (ssError) {
    console.error('[submit] salary_submissions error:', ssError.message);
    // Non-fatal — don't fail the request
  }
  } // end supabaseAdmin block

  // Auto-add company to companies table if not exists
  if (company && company.trim()) {
    await supabase
      .from('companies')
      .upsert(
        { name: company.trim(), tier: 4 },
        { onConflict: 'name', ignoreDuplicates: true }
      );
  }

  return res.status(201).json({ success: true, data });
}
