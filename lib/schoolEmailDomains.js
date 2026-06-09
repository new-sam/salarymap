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

export default isSchoolDomain
