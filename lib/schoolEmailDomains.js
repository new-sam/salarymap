// School / university email domains — used to classify a verification email as a
// *student* (school) credential rather than a *worker* (company) one. A school
// email is the proof of student status, the mirror of a work email for employment.
//
// Heuristic on the domain labels (no exhaustive list — academic TLDs are regular):
//   - 'edu' as any label: mit.edu, school.edu.au, hcmus.edu.vn
//   - 'ac' as the second-to-last label: snu.ac.kr, ox.ac.uk, u-tokyo.ac.jp
// Admin can still curate exact names in the school_domains table.
export function isSchoolDomain(domain) {
  const d = (domain || '').toLowerCase().trim()
  if (!d) return false
  const labels = d.split('.')
  if (labels.includes('edu')) return true
  // 'ac.<cc>' pattern needs at least sub.ac.cc (3 labels) so a bare 'ac.com' is not a school.
  if (labels.length >= 3 && labels[labels.length - 2] === 'ac') return true
  return false
}

// Label-boundary suffixes of a domain, longest first — used to resolve a verified
// email's host against the curated school_domains table. Student mailboxes commonly
// sit on a faculty/student subdomain (sis.hust.edu.vn, gm.uit.edu.vn,
// student.tdtu.edu.vn), so we match the seeded *parent* domain by suffix rather than
// requiring an exact host. Stops at 2 labels so we never emit a bare TLD ('vn').
//   'gm.uit.edu.vn' -> ['gm.uit.edu.vn', 'uit.edu.vn', 'edu.vn']
export function domainSuffixes(domain) {
  const d = (domain || '').toLowerCase().trim()
  if (!d) return []
  const labels = d.split('.').filter(Boolean)
  const out = []
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join('.'))
  return out
}

export default isSchoolDomain
