import { createClient } from '@supabase/supabase-js';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key';

export const supabase = createClient(url || fallbackUrl, key || fallbackKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
