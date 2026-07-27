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
- english_level (string): English proficiency if stated — a test score ("TOEIC 900", "IELTS 7.0"), CEFR level ("B1"), or a self-described level ("Native", "Fluent", "Intermediate"). Empty if not mentioned.
- korean_level (string): Korean proficiency if stated — TOPIK level ("TOPIK 5"), or a level ("Native", "Business", "Beginner"). Empty if not mentioned.
- name_ko (string): Hangul rendering of the short name the candidate goes by — for Vietnamese names, the last syllable of the given name transliterated to Korean. Examples: "Hằng" → "항", "Linh" → "린", "Chương" → "쭝", "Vũ" → "부", "Ân" → "언". Empty if there is no name.
- degree (string): Highest degree level from the resume, one of: "Associate", "Bachelor", "Master", "PhD". Empty if no degree mentioned.
- summary_ko (string[]): Exactly 3 concise Korean bullet points (주요이력) a Korean hiring manager would care about — years/domain of experience, tool or skill proficiency, standout strengths. Style example: ["10년 이상의 전자상거래 및 캠페인 비주얼 디자인 경험", "Adobe Creative Suite 및 Canva 숙련", "프로젝트 관리 및 팀 협업 능력"]. Write in the same 명사형 종결 style, no periods.
- edu_ko (string): Short Korean gloss of the education a Korean reader instantly understands — the university's commonly used Korean name + major, e.g. "하노이 국립대, 법학 전공" or "호치민 공과대, 컴퓨터공학 전공". Under 25 characters. Empty if university unknown.

Rules:
- Only include information explicitly found in the resume. Do not fabricate company names, scores, or schools.
- For missing fields, use empty string "" or empty array [].
- For yoe_months and experience months, calculate precisely from dates. Round to nearest month.
- Skills should be specific (e.g. "React", "PostgreSQL") not generic (e.g. "programming").
- Return ONLY valid JSON, no markdown or extra text.`

// 한국어 호칭은 본파싱(mini)이 성씨를 자주 오추출(1차 백필서 ~25% 오류)해
// 이름만 넣는 집중 프롬프트 + gpt-4o로 별도 보정한다. 실패 시 본파싱 값 유지.
const NAME_KO_PROMPT = `For a Vietnamese full name, return the Hangul transliteration of the person's GIVEN name — the syllable they go by.

Rules:
- Vietnamese name order is FAMILY - MIDDLE - GIVEN, so the given name is usually the LAST word: "Nguyễn Phước Thiện" → Thiện → "티엔".
- Some names are written given-name-first: if the LAST word is a common family name (Nguyễn, Trần, Lê, Phạm, Hoàng, Huỳnh, Phan, Vũ, Võ, Đặng, Bùi, Đỗ, Hồ, Ngô, Dương, Lý), use the FIRST word instead: "Hau Nguyen Ngoc" → Hau → "하우".
- NEVER transliterate a family name.
- Transliterate by Vietnamese pronunciation. Examples: Thiện→티엔, Hằng→항, Linh→린, Chương→쭝, Anh→아인, Phát→팟, Nghĩa→응이아, Duy→주이, Trân→쩐, Phúc→푹, Đức→득, Trí→치, Mai→마이, Sơn→선, Phú→푸.

Return JSON: {"name_ko": "<1-3 hangul syllables>"}`

async function refineNameKo(fullName) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: NAME_KO_PROMPT },
      { role: 'user', content: fullName },
    ],
    temperature: 0,
  })
  return (JSON.parse(completion.choices[0].message.content).name_ko || '').trim()
}

// 한 유저의 이력서를 파싱해 user_profiles를 갱신. 실패 시 throw(호출부에서 개별 처리).
// touchUpdatedAt=false: 전체 재파싱(백필)용 — updated_at을 안 건드려 이력서풀 지표
// 착시(7/14 +294% 사례)와 어드민 정렬 뒤섞임을 막는다.
export async function parseResumeForUser(userId, { touchUpdatedAt = true } = {}) {
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
    // 어드민 인재풀 카드용 요약(한국어 호칭·학위·주요이력 3줄) — 20260727 마이그레이션
    resume_summary: {
      name_ko: parsed.name_ko || '',
      degree: parsed.degree || '',
      edu_ko: parsed.edu_ko || '',
      bullets: Array.isArray(parsed.summary_ko) ? parsed.summary_ko : [],
    },
  }
  const parsedName = parsed.full_name || profile.full_name || ''
  if (parsedName) {
    try { update.resume_summary.name_ko = (await refineNameKo(parsedName)) || update.resume_summary.name_ko } catch {}
  }
  if (touchUpdatedAt) update.updated_at = new Date().toISOString()
  const { error: updateErr } = await supabase.from('user_profiles').update(update).eq('id', userId)
  if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`)
  return update
}

// 공개 인재풀에서 구조화 필드(연차 or 학교)가 비어 파싱이 필요한 유저 id 목록.
// all=true: 필드 채움 여부와 무관하게 공개 이력서 전체(양식 변경 후 일괄 재파싱용).
export async function findPublicUnparsed(limit = 20, all = false) {
  let q = supabase
    .from('user_profiles')
    .select('id')
    .not('resume_url', 'is', null)
    .eq('is_resume_public', true)
  if (!all) q = q.or('yoe_months.is.null,university.is.null')
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data || []).map((r) => r.id)
}
