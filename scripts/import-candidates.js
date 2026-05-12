// Usage: node scripts/import-candidates.js <path-to-tsv-file>
// Imports candidate data from the KTC spreadsheet (tab-separated) into Supabase

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Parse YOE text to months
function parseYOE(raw) {
  if (!raw) return 0
  const s = raw.toLowerCase().replace(/intern/g, '').trim()
  let months = 0
  // "3 năm" / "3 year"
  const yearMatch = s.match(/(\d+)\s*(năm|year|years)/i)
  if (yearMatch) months += parseInt(yearMatch[1]) * 12
  // "6 tháng" / "6 month"
  const monthMatch = s.match(/(\d+)\s*(tháng|month|months)/i)
  if (monthMatch) months += parseInt(monthMatch[1])
  // plain number like "2" or "1"
  if (months === 0) {
    const num = parseFloat(s)
    if (!isNaN(num) && num > 0) months = Math.round(num * 12)
  }
  return months
}

// Normalize position
function normalizePosition(raw) {
  if (!raw) return 'Other'
  const s = raw.toLowerCase()
  if (s.includes('back') || s.includes('backend')) return 'Backend'
  if (s.includes('front') || s.includes('frontend')) return 'Frontend'
  if (s.includes('full') || s.includes('fullstack')) return 'Fullstack'
  if (s.includes('mobile') || s.includes('app')) return 'Mobile'
  if (s.includes('ai') || s.includes('ml') || s.includes('data') || s.includes('machine')) return 'AI/Data'
  if (s.includes('devops') || s.includes('infra') || s.includes('cloud')) return 'DevOps'
  if (s.includes('qa') || s.includes('test')) return 'QA'
  if (s.includes('design') || s.includes('ui') || s.includes('ux')) return 'Design'
  if (s.includes('pm') || s.includes('product') || s.includes('project')) return 'PM'
  return 'Other'
}

// Parse tech stack
function parseTechStack(raw) {
  if (!raw) return []
  return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean).slice(0, 15)
}

// Compute english score (0-99)
function computeEnglishScore(level, cert) {
  const combined = ((level || '') + ' ' + (cert || '')).toLowerCase()
  if (combined.match(/ielts\s*(8|9)/)) return 95
  if (combined.match(/ielts\s*7/)) return 85
  if (combined.match(/ielts\s*(6|5\.5|6\.5)/)) return 72
  if (combined.match(/toeic\s*(9\d\d|8[5-9]\d)/)) return 85
  if (combined.match(/toeic\s*(7\d\d|8[0-4]\d)/)) return 72
  if (combined.match(/toeic\s*(6\d\d)/)) return 60
  if (combined.match(/toeic\s*(\d{3})/)) return 45
  if (combined.includes('c2') || combined.includes('native')) return 95
  if (combined.includes('c1') || combined.includes('advanced') || combined.includes('business')) return 80
  if (combined.includes('b2') || combined.includes('upper')) return 72
  if (combined.includes('b1') || combined.includes('intermediate')) return 60
  if (combined.includes('a2') || combined.includes('basic') || combined.includes('elementary')) return 40
  if (combined.includes('a1') || combined.includes('beginner')) return 30
  if (combined.length > 3) return 50 // has some mention
  return 30 // default
}

// Compute graduation status
function normalizeGradStatus(raw) {
  if (!raw) return 'unknown'
  const s = raw.toLowerCase()
  if (s.includes('đã tốt nghiệp') || s.includes('graduated')) return 'graduated'
  if (s.includes('sắp') || s.includes('upcoming') || s.includes('chưa tốt nghiệp')) return 'upcoming'
  return 'unknown'
}

// Compute stats
function computeStats(candidate) {
  const { yoe_months, tech_stack, test_score, interview_avg, final_score } = candidate
  const englishScore = candidate._english_score

  // Experience (0-99): 0m=20, 6m=35, 12m=50, 24m=65, 36m=75, 60m=85, 120m=95
  const expScore = Math.min(99, Math.round(20 + (yoe_months || 0) * 1.3))

  // Tech (0-99): based on number of techs
  const techCount = (tech_stack || []).length
  const techScore = Math.min(99, Math.round(30 + techCount * 10))

  // Education: graduated=70, upcoming=55, unknown=40 (base)
  let eduScore = candidate.graduation_status === 'graduated' ? 70 : candidate.graduation_status === 'upcoming' ? 55 : 40
  // Bonus for well-known universities
  const uni = (candidate.university || '').toLowerCase()
  if (uni.includes('bách khoa') || uni.includes('fpt') || uni.includes('khoa học tự nhiên') || uni.includes('rmit')) eduScore += 15
  else if (uni.includes('đại học')) eduScore += 5
  eduScore = Math.min(99, eduScore)

  // Soft skills (from interview)
  const softScore = interview_avg ? Math.min(99, Math.round(interview_avg * 10)) : null

  // Overall: weighted average
  const weights = []
  const scores = []
  if (final_score) { weights.push(3); scores.push(Math.min(99, Math.round(final_score))) }
  weights.push(2); scores.push(expScore)
  weights.push(2); scores.push(techScore)
  weights.push(1.5); scores.push(englishScore)
  weights.push(1); scores.push(eduScore)
  if (softScore) { weights.push(1.5); scores.push(softScore) }

  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const overallScore = Math.round(scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalWeight)

  return {
    stat_overall: Math.min(99, Math.max(20, overallScore)),
    stat_experience: Math.min(99, Math.max(20, expScore)),
    stat_tech: Math.min(99, Math.max(20, techScore)),
    stat_english: Math.min(99, Math.max(20, englishScore)),
    stat_education: Math.min(99, Math.max(20, eduScore)),
    stat_soft: softScore ? Math.min(99, Math.max(20, softScore)) : null,
  }
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node scripts/import-candidates.js <path-to-tsv-file>')
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim())
  const headers = lines[0].split('\t')

  console.log(`Found ${lines.length - 1} rows, ${headers.length} columns`)
  console.log('Headers:', headers.slice(0, 5).join(', '), '...')

  // Column index helper
  const col = (name) => headers.indexOf(name)

  const candidates = []
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t')
    const get = (name) => {
      const idx = col(name)
      return idx >= 0 ? (fields[idx] || '').trim() : ''
    }

    const id = get('ID')
    if (!id) continue

    const yoeRaw = get('YOE_Data') || get('12. Years of Experience')
    const yoeMonths = parseYOE(yoeRaw)
    const position = normalizePosition(get('Position_Data') || get('Vị trí/Position'))
    const techStack = parseTechStack(get('13. Teck Stacks'))
    const englishScore = computeEnglishScore(get('15.1. Năng lực tiếng Anh (Business English)'), get('15.2. Bằng cấp/chứng chỉ tiếng Anh (nếu có)'))
    const gradStatus = normalizeGradStatus(get('7. Tình trạng tốt nghiệp'))
    const testScore = parseInt(get('Test Result')) || null
    const interviewAvg = parseFloat(get('Average of Soft skill')) || null
    const finalScore = parseFloat(get('Final Score')) || null

    const candidate = {
      id,
      email: get('Email Address') || get('20. Thông tin liên hệ - Email'),
      phone: get('Phone_Data') || get('21. Thông tin liên hệ - Số điện thoại'),
      name_vi: get('Name_Data') || get('2.1. Họ tên (Tiếng Việt)'),
      name_en: get('2.2. English name') || null,
      gender: get('3. Giới tính') || null,
      birthdate: get('4. Ngày sinh(DD/MM/YYYY)') || null,
      age: parseInt(get('5. Tuổi')) || null,
      university: get('6. Trường đại học bạn theo học') || null,
      graduation_status: gradStatus,
      graduation_date: get('8. Thời gian tốt nghiệp') || null,
      major: get('9. Ngành học') || null,
      degree_url: get('10. Bằng đại học') || null,
      location: get('11. Khu vực sinh sống hiện tại') || null,
      yoe_raw: yoeRaw || null,
      yoe_months: yoeMonths,
      position,
      tech_stack: techStack.length > 0 ? techStack : null,
      projects: get('14. Projects/Experiences') || null,
      english_level: get('15.1. Năng lực tiếng Anh (Business English)') || null,
      english_cert: get('15.2. Bằng cấp/chứng chỉ tiếng Anh (nếu có)') || null,
      korean_level: get('15.3. Năng lực tiếng Hàn (Korean)') || null,
      korean_cert: get('15.4. Bằng cấp/chứng chỉ tiếng Hàn (nếu có)') || null,
      cv_url: get('CV_Data') || get('16. Upload CV') || null,
      want_korea: get('17. Nếu có cơ hội, bạn có muốn làm việc ở Hàn Quốc không?') || null,
      work_preference: get('18. Hình thức làm việc bạn mong muốn/ưu tiên') || null,
      motivation: get('19. Động lực tham gia chương trình KTC') || null,
      data_source: get('Data Source') || get('First Data Source') || null,
      test_score: testScore,
      interview_avg: interviewAvg,
      interview_q1: parseInt(get('Q1')) || null,
      interview_q2: parseInt(get('Q2')) || null,
      interview_q3: parseInt(get('Q3')) || null,
      interview_q4: parseInt(get('Q4')) || null,
      interview_q5: parseInt(get('Q5')) || null,
      interview_q6: parseInt(get('Q6')) || null,
      interview_note: get('Note Interview Answer') || null,
      final_score: finalScore,
      status: get('Status Form & Test') || get('Matching Status') || null,
      _english_score: englishScore,
    }

    const stats = computeStats(candidate)
    delete candidate._english_score
    Object.assign(candidate, stats)
    candidates.push(candidate)
  }

  console.log(`\nParsed ${candidates.length} candidates`)
  console.log('Position breakdown:')
  const posCount = {}
  candidates.forEach(c => { posCount[c.position] = (posCount[c.position] || 0) + 1 })
  Object.entries(posCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

  // Upsert in batches
  const BATCH = 100
  let inserted = 0
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const { error } = await supabase.from('candidates').upsert(batch, { onConflict: 'id' })
    if (error) {
      console.error(`Batch ${i} error:`, error.message)
      // Try one by one
      for (const c of batch) {
        const { error: e2 } = await supabase.from('candidates').upsert(c, { onConflict: 'id' })
        if (e2) console.error(`  Failed ${c.id}: ${e2.message}`)
        else inserted++
      }
    } else {
      inserted += batch.length
    }
  }

  console.log(`\nDone! Imported ${inserted}/${candidates.length} candidates`)
}

main().catch(console.error)
