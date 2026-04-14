import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { role, experience, salary, company, source, email, user_id, utm_source, utm_medium, utm_campaign } = req.body;

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

  // Insert into submissions table — link to user if logged in
  const record = { role, experience, salary: salNum, company: company?.trim() || null, source };
  if (user_id) record.user_id = user_id;
  if (email && email.trim()) record.email = email.trim();
  if (utm_source) record.utm_source = utm_source;
  if (utm_medium) record.utm_medium = utm_medium;
  if (utm_campaign) record.utm_campaign = utm_campaign;

  const { data, error } = await supabase
    .from('submissions')
    .insert([record])
    .select('id')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

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
