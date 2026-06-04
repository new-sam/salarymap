import crypto from 'crypto'

// Pepper for hashing verification codes at rest. Server-only secret;
// falls back to the service-role key when a dedicated pepper isn't set.
const PEPPER = (process.env.COMPANY_VERIFY_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export function hashCode(code) {
  return crypto.createHash('sha256').update(`${code}:${PEPPER}`).digest('hex')
}

// 6-digit numeric code as a zero-padded string.
export function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}
