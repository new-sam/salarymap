import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import pdf from 'pdf-parse'
import crypto from 'crypto'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

function isValidJpeg(buf) {
  // Must start with FF D8 FF (SOI + first marker)
  if (buf.length < 4) return false
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return false
  // Third byte after FF must be a valid JPEG marker: E0(JFIF) E1(EXIF) E2(ICC) DB(DQT) C0(SOF0) C2(SOF2)
  const marker = buf[3]
  const validMarkers = [0xe0, 0xe1, 0xe2, 0xe3, 0xdb, 0xc0, 0xc2, 0xc4, 0xfe]
  return validMarkers.includes(marker)
}

function extractJpegsFromPdf(buffer) {
  const images = []
  const SOI = Buffer.from([0xff, 0xd8])
  const EOI = Buffer.from([0xff, 0xd9])
  let offset = 0
  while (offset < buffer.length - 1) {
    const startIdx = buffer.indexOf(SOI, offset)
    if (startIdx === -1) break
    const endIdx = buffer.indexOf(EOI, startIdx + 2)
    if (endIdx === -1) break
    const jpegData = buffer.slice(startIdx, endIdx + 2)
    // Profile photo: valid JPEG, 10KB~2MB (not tiny icons, not huge scans)
    if (jpegData.length > 10000 && jpegData.length < 2 * 1024 * 1024 && isValidJpeg(jpegData)) {
      images.push(jpegData)
    }
    offset = endIdx + 2
  }
  return images
}

const SYSTEM_PROMPT = `You are a resume parser. Extract structured profile data from the resume text below.

Return a JSON object with these fields:
- full_name (string): Full name of the person
- headline (string): A short professional headline, e.g. "Senior Backend Engineer" or "Full-stack Developer with 5+ years experience"
- location (string): City/Country if mentioned
- position (string): The single best-matching job category. Choose from this list (do NOT invent new values):
  Engineering: "Backend", "Frontend", "Fullstack", "Mobile", "AI/Data", "DevOps", "QA", "Security", "Embedded", "Game"
  Product & Design: "PM", "Planning", "Design", "UX"
  Data & Growth: "Data Analyst", "Data Scientist", "Marketing", "Growth"
  Business & Ops: "Sales", "Business Dev", "Strategy", "Operations", "HR", "Finance", "PR/Content"
  Fallback: "Other"
  Mapping hints: Product Owner / PO / 프로덕트 매니저 → "PM". 서비스 기획 / 사업 기획 / 기획자 / Service Planner → "Planning". UX/UI 기획·리서치 → "UX". Only use "Other" when nothing above fits.
- yoe_months (number): Total months of professional work experience, calculated from experience dates. If unclear, estimate from context.
- skills (string[]): List of technical skills, frameworks, languages, tools mentioned
- university (string): University/college name
- major (string): Field of study
- graduation_year (string): Graduation year
- gpa (string): GPA if mentioned, e.g. "3.8 / 4.0"
- experiences (array of objects): Each with:
  - company (string): Company name
  - role (string): Job title
  - period (string): e.g. "2022.03 - 2024.01"
  - desc (string): Brief bullet points of responsibilities/achievements, keep it concise (2-3 lines max)
- projects (array of objects): Each with:
  - name (string): Project name
  - desc (string): Brief description (1-2 lines)
  - url (string): Project URL if mentioned, otherwise empty string

Rules:
- Only include information explicitly found in the resume. Do not fabricate.
- For missing fields, use empty string "" or empty array [].
- For yoe_months, calculate precisely from work experience dates. Round to nearest month.
- Skills should be specific (e.g. "React", "PostgreSQL") not generic (e.g. "programming").
- Keep descriptions concise and professional.
- Return ONLY valid JSON, no markdown or extra text.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  try {
    // 1. Get resume URL
    const { data: profile } = await supabase.from('user_profiles').select('resume_url').eq('id', user.id).single()
    if (!profile?.resume_url) return res.status(400).json({ error: 'No resume found' })

    // 2. Download PDF
    const pdfRes = await fetch(profile.resume_url)
    if (!pdfRes.ok) return res.status(500).json({ error: 'Failed to download resume' })
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

    // 3. Extract text
    const pdfData = await pdf(pdfBuffer)
    if (!pdfData.text || pdfData.text.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from PDF. The file may be image-based.' })
    }

    // 4. Extract profile photo
    let photoUrl = null
    const jpegs = extractJpegsFromPdf(pdfBuffer)
    if (jpegs.length > 0) {
      const filename = `${user.id}/photo_${crypto.randomBytes(4).toString('hex')}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('profiles')
        .upload(filename, jpegs[0], { contentType: 'image/jpeg', upsert: true })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(filename)
        photoUrl = urlData?.publicUrl || null
      }
    }

    // 5. OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Resume text:\n\n${pdfData.text.slice(0, 15000)}` },
      ],
      temperature: 0.1,
    })

    const parsed = JSON.parse(completion.choices[0].message.content)

    // 6. Build fields
    const fields = {
      full_name: parsed.full_name || '',
      headline: parsed.headline || '',
      location: parsed.location || '',
      position: parsed.position || '',
      yoe_months: parsed.yoe_months || null,
      skills: (parsed.skills || []).join(', '),
      university: parsed.university || '',
      major: parsed.major || '',
      graduation_year: parsed.graduation_year || '',
      gpa: parsed.gpa || '',
      experiences: parsed.experiences || [],
      projects: parsed.projects || [],
      ...(photoUrl && { photo_url: photoUrl }),
    }

    // 7. Save to DB
    const dbUpdate = {
      ...fields,
      skills: parsed.skills || [],
      updated_at: new Date().toISOString(),
    }
    await supabase.from('user_profiles').update(dbUpdate).eq('id', user.id)

    return res.json({ fields: { ...fields, yoe_months: fields.yoe_months ? String(fields.yoe_months) : '' } })
  } catch (err) {
    console.error('Resume parse error:', err)
    return res.status(500).json({ error: err.message || 'Failed to parse resume' })
  }
}
