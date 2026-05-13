import { COMPANY_PROFILES } from '../data/companyProfiles'

export function generateCompanyDescription(job) {
  const profile = COMPANY_PROFILES[job.company]
  const sizeNum = profile?.employees || parseInt(job.company_size) || 0
  const techList = job.tech_stack?.length ? job.tech_stack.slice(0, 4).join(', ') : null
  const locationDesc = job.location || 'Vietnam'
  const typeDesc = job.type === 'remote' ? 'remote-first culture with distributed teams' : job.type === 'hybrid' ? 'flexible hybrid work model' : 'collaborative on-site environment'
  const expDesc = job.experience_min != null && job.experience_max != null
    ? (job.experience_max >= 30 ? `${job.experience_min}+ years` : `${job.experience_min}\u2013${job.experience_max} years`)
    : null

  const paragraphs = []

  if (profile) {
    paragraphs.push(`${profile.desc} Founded in ${profile.founded}, headquartered in ${profile.hq}.`)
  } else {
    const sizeDesc = sizeNum >= 500 ? 'large-scale enterprise' : sizeNum >= 100 ? 'mid-sized company' : sizeNum >= 10 ? 'growing startup' : 'technology company'
    paragraphs.push(`${job.company} is a ${sizeDesc} based in ${locationDesc}, offering a ${typeDesc}. The company operates in the technology sector and is actively expanding its ${job.role} team.`)
  }

  if (profile) {
    let metrics = `\ud83d\udcca Key Metrics \u2014 `
    const parts = []
    if (profile.revenue) parts.push(`Revenue: ${profile.revenue}`)
    if (profile.funding) parts.push(`Funding: ${profile.funding}`)
    if (profile.employees) parts.push(`Team Size: ${profile.employees.toLocaleString()}+ employees`)
    if (profile.industry) parts.push(`Industry: ${profile.industry}`)
    metrics += parts.join(' \u00b7 ')
    if (profile.clients) metrics += `\nClients & Reach: ${profile.clients}`
    paragraphs.push(metrics)
  }

  if (techList || expDesc) {
    let rolePara = `\ud83d\udd27 This Position \u2014 `
    const roleParts = []
    if (techList) roleParts.push(`Tech stack includes ${techList}`)
    if (expDesc) roleParts.push(`looking for ${expDesc} of experience`)
    if (job.salary_min > 0) roleParts.push(`offering ${Math.round(job.salary_min / 1e6)}M\u2013${Math.round(job.salary_max / 1e6)}M VND`)
    rolePara += roleParts.join(', ') + '.'
    paragraphs.push(rolePara)
  }

  if (sizeNum >= 500) {
    paragraphs.push(`\ud83c\udfe2 Work Culture \u2014 With ${sizeNum.toLocaleString()}+ employees, ${job.company} provides structured career paths, mentorship programs, and cross-functional collaboration. Employees benefit from established processes, competitive compensation, and long-term stability.`)
  } else if (sizeNum >= 100) {
    paragraphs.push(`\ud83c\udfe2 Work Culture \u2014 A team of ${sizeNum}+ professionals balancing structured growth with startup agility. Individual contributions have visible impact while benefiting from established engineering practices and clear promotion paths.`)
  } else if (sizeNum >= 10) {
    paragraphs.push(`\ud83c\udfe2 Work Culture \u2014 A lean team of ${sizeNum}+ members offering high ownership and direct impact. Early team members often experience accelerated career growth with broader responsibilities and close collaboration with leadership.`)
  }

  if (job.benefits?.length > 0) {
    paragraphs.push(`\u2705 Benefits \u2014 ${job.benefits.slice(0, 6).join(', ')}`)
  }

  return paragraphs.join('\n\n')
}
