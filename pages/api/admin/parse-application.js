import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import pdf from 'pdf-parse'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from the resume text.

Return a JSON object with these fields:
- position (string): Best matching category from: Backend, Frontend, Fullstack, Mobile, AI/Data, DevOps, QA, Design, PM, Marketing, Operations, Other
- skills (string[]): List of technical skills, frameworks, languages, tools mentioned
- yoe_months (number): Total months of professional work experience, calculated from experience dates. If unclear, estimate from context. 0 for new grads.
- headline (string): A short professional headline, e.g. "Senior Backend Engineer" or "Junior Frontend Developer"

Rules:
- Only include information explicitly found in the resume. Do not fabricate.
- For missing fields, use empty string "" or empty array [] or 0.
- For yoe_months, calculate precisely from work experience dates. Round to nearest month.
- Skills should be specific (e.g. "React", "PostgreSQL") not generic (e.g. "programming").
- Return ONLY valid JSON, no markdown or extra text.`

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { applicationId } = req.body
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' })

  try {
    // 1. Get application
    const { data: app, error: appErr } = await supabase
      .from('job_applications')
      .select('id, resume_url, user_id, applicant_name, applicant_email')
      .eq('id', applicationId)
      .single()

    if (appErr || !app?.resume_url) {
      return res.status(400).json({ error: 'No resume found for this application' })
    }

    // 2. Download PDF
    const pdfRes = await fetch(app.resume_url)
    if (!pdfRes.ok) return res.status(500).json({ error: 'Failed to download resume' })
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

    // 3. Extract text
    const pdfData = await pdf(pdfBuffer)
    if (!pdfData.text || pdfData.text.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from PDF' })
    }

    // 4. OpenAI parse
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

    // 5. Format YoE
    const yoeMonths = parsed.yoe_months || 0
    const y = Math.floor(yoeMonths / 12)
    const m = yoeMonths % 12
    const yoeStr = yoeMonths === 0 ? 'New grad' : (y > 0 ? `${y}y${m > 0 ? ` ${m}m` : ''}` : `${m}m`)

    // 6. Update job_applications
    const skillsStr = (parsed.skills || []).join(', ')
    const update = {
      applicant_role: parsed.position || null,
      applicant_experience: yoeStr,
      parsed_skills: skillsStr,
      parsed_headline: parsed.headline || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('job_applications').update(update).eq('id', applicationId)

    return res.json({
      applicationId,
      position: parsed.position || '',
      skills: skillsStr,
      yoe: yoeStr,
      yoe_months: yoeMonths,
      headline: parsed.headline || '',
    })
  } catch (err) {
    console.error('Admin application parse error:', err)
    return res.status(500).json({ error: err.message || 'Failed to parse resume' })
  }
}
