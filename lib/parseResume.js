import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import pdf from 'pdf-parse/lib/pdf-parse.js' // 패키지 index의 디버그 로드(테스트 PDF 읽기) 회피 — 스크립트/런타임 양쪽 안전

// 이력서 PDF → 구조화 프로필 필드(학교/연차/직무/경력/스킬) 파싱 & user_profiles 갱신.
// admin/parse-resumes(수동 "AI 채우기") · cron/parse-public-resumes(공개인재 자동파싱) · 백필 스크립트가 공유.
// ⚠️ 파싱 성공 시 해당 필드를 덮어쓴다 — 빈 필드 대상에만 쓰는 게 안전(수동입력 보존).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are a resume parser for a staffing agency that places candidates at Korean companies. Extract structured profile data that a Korean hiring manager uses to judge a candidate's calibre (school, employers, seniority, language ability).

Return a JSON object with these fields:
- full_name (string): Full name of the person
- headline (string): A short professional headline, e.g. "Senior Backend Engineer" or "Full-stack Developer with 5+ years experience"
- location (string): City/Country if mentioned
- position (string): Best matching category from: Backend, Frontend, Fullstack, Mobile, AI/Data, DevOps, QA, Design, PM, Other
- yoe_months (number): Total months of professional work experience, calculated from experience dates. New graduate with no work experience = 0. If unclear, estimate from context.
- skills (string[]): List of technical skills, frameworks, languages, tools mentioned
- university (string): University/college name (keep the official name so its prestige is recognizable)
- major (string): Field of study
- graduation_year (string): Year of graduation (most recent degree), e.g. "2021". Empty if unknown.
- experiences (array): Work history, MOST RECENT FIRST. Each item: { "company": string, "title": string, "start": "YYYY-MM" or "YYYY", "end": "YYYY-MM"/"YYYY" or "Present", "months": number }. Keep official company names. Exclude internships shorter than ~2 months only if clearly trivial.
- english_level (string): English proficiency if stated — a test score ("TOEIC 900", "IELTS 7.0") or a self-described level ("Native", "Fluent", "Business"). Empty if not mentioned.
- korean_level (string): Korean proficiency if stated — TOPIK level ("TOPIK 5"), or a level ("Native", "Business", "Conversational"). Empty if not mentioned.

Rules:
- Only include information explicitly found in the resume. Do not fabricate company names, scores, or schools.
- For missing fields, use empty string "" or empty array [].
- For yoe_months and experience months, calculate precisely from dates. Round to nearest month.
- Skills should be specific (e.g. "React", "PostgreSQL") not generic (e.g. "programming").
- Return ONLY valid JSON, no markdown or extra text.`

// 한 유저의 이력서를 파싱해 user_profiles를 갱신. 실패 시 throw(호출부에서 개별 처리).
export async function parseResumeForUser(userId) {
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles').select('id, resume_url, full_name').eq('id', userId).single()
  if (profileErr || !profile?.resume_url) throw new Error('No resume found for this user')

  const pdfRes = await fetch(profile.resume_url)
  if (!pdfRes.ok) throw new Error('Failed to download resume')
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

  const pdfData = await pdf(pdfBuffer)
  if (!pdfData.text || pdfData.text.trim().length < 50) throw new Error('Could not extract text from PDF')

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

  const update = {
    full_name: parsed.full_name || profile.full_name || '',
    headline: parsed.headline || '',
    location: parsed.location || '',
    position: parsed.position || '',
    yoe_months: parsed.yoe_months ?? null,
    skills: parsed.skills || [],
    university: parsed.university || '',
    major: parsed.major || '',
    graduation_year: parsed.graduation_year || '',
    experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
    english_cert: parsed.english_level || '',
    korean_cert: parsed.korean_level || '',
    updated_at: new Date().toISOString(),
  }
  await supabase.from('user_profiles').update(update).eq('id', userId)
  return update
}

// 공개 인재풀에서 구조화 필드(연차 or 학교)가 비어 파싱이 필요한 유저 id 목록.
export async function findPublicUnparsed(limit = 20) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .not('resume_url', 'is', null)
    .eq('is_resume_public', true)
    .or('yoe_months.is.null,university.is.null')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map((r) => r.id)
}
