import crypto from 'crypto';
import supabase from './supabase';

export function generateClaimToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashClaimToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function tokensMatch(hexA, hexB) {
  if (!hexA || !hexB) return false;
  const a = Buffer.from(hexA, 'utf8');
  const b = Buffer.from(hexB, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function verifyClaim(submissionId, claimToken) {
  if (!submissionId || !claimToken) return { ok: false, reason: 'missing' };

  const { data, error } = await supabase
    .from('submissions')
    .select('id, claim_token_hash')
    .eq('id', submissionId)
    .single();

  if (error || !data) return { ok: false, reason: 'not_found' };
  if (!data.claim_token_hash) return { ok: false, reason: 'legacy' };

  const incoming = hashClaimToken(claimToken);
  if (!tokensMatch(data.claim_token_hash, incoming)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true };
}
