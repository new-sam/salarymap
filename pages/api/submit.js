import supabase from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { role, experience, salary, company, source, email, user_id } = req.body;

  if (!role || !experience || !salary) {
    return res.status(400).json({ error: 'role, experience, salary are required.' });
  }

  // Insert into existing submissions table (anonymous, no user link)
  const record = { role, experience, salary, company, source };
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
