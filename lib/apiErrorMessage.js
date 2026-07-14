// Company API endpoints return a machine-readable `code` alongside the Korean
// `error` string (the Korean text is kept for backward compat — the mobile app
// and older clients display it as-is). The web resolves the code through i18n
// so VI/EN users don't see Korean errors; unknown or absent codes fall back to
// the server text, then to the caller's fallback key.
const CODE_KEYS = new Set([
  'authRequired', 'sessionExpired', 'forbidden', 'serverConfig', 'badRequest',
  'candidateNotFound', 'jobNotFound', 'alreadyActive', 'noCandidateEmail',
  'invalidEmail', 'needsApproval',
]);

export function apiErrorMessage(json, t, fallbackKey) {
  if (json?.code && CODE_KEYS.has(json.code)) return t(`company.apiErr.${json.code}`);
  if (json?.error) return json.error;
  return fallbackKey ? t(fallbackKey) : '';
}
