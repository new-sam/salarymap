import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Explicit admin allowlist. Previously any @likelion.net address was auto-admin,
// which handed full PII/salary access to every domain account (and any account
// that could obtain such an address). Admins are now an explicit set: the
// ADMIN_EMAILS env var (comma-separated) plus a small bootstrap list so the
// owner can never be locked out, plus the admin_users table.
const BOOTSTRAP_ADMINS = ['ceo_office@likelion.net']
const ALLOWLIST = new Set(
  [...BOOTSTRAP_ADMINS, ...(process.env.ADMIN_EMAILS || '').split(',')]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
)

export async function isAdmin(email) {
  if (!email) return false
  if (ALLOWLIST.has(email.toLowerCase())) return true
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .single()
  return !!data
}

export async function verifyAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const admin = await isAdmin(user.email)
  if (!admin) return null
  return user
}

// Diagnostic variant — returns { ok, reason, detail, email } so callers can
// surface why a 401 happened (no token / token verify failed / not admin).
// Use only for endpoints under active debugging.
export async function verifyAdminVerbose(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return { ok: false, reason: 'no_token' }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error) return { ok: false, reason: 'getUser_failed', detail: (error.message || '').slice(0, 200) }
  if (!user) return { ok: false, reason: 'no_user' }
  const admin = await isAdmin(user.email)
  if (!admin) return { ok: false, reason: 'not_admin', email: user.email }
  return { ok: true, user }
}

// Dev convenience: under `next dev` we let the admin views render with a stub
// user even without a logged-in session, so design tweaks on /admin can be
// previewed locally without redoing OAuth on every browser/profile. Guarded
// by NODE_ENV so production builds never take this branch.
export async function verifyAdminOrDevStub(req) {
  if (process.env.NODE_ENV === 'development') {
    return { id: 'dev-local', email: 'dev@local.likelion.net' }
  }
  return verifyAdmin(req)
}

export default async function handler(req, res) {
  const { email } = req.query
  if (!email) return res.status(400).json({ isAdmin: false })
  const result = await isAdmin(email)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ isAdmin: result })
}
