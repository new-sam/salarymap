import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import pdf from 'pdf-parse/lib/pdf-parse.js' // 패키지 index의 디버그 로드(테스트 PDF 읽기) 회피 — 스크립트/런타임 양쪽 안전
import mammoth from 'mammoth'
import { ROLE_GROUPS } from '../constants/jobs.js' // 확장자 필수 — 이 모듈은 plain node 스크립트에서도 import된다

// 이력서 PDF → 구조화 프로필 필드(학교/연차/직무/경력/스킬) 파싱 & user_profiles 갱신.
// admin/parse-resumes(수동 "AI 채우기") · cron/parse-public-resumes(공개인재 자동파싱) · 백필 스크립트가 공유.
// ⚠️ 파싱 성공 시 해당 필드를 덮어쓴다 — 빈 필드 대상에만 쓰는 게 안전(수동입력 보존).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// position 후보는 프로필 폼과 같은 canonical 직군(ROLE_GROUPS)을 그대로 쓴다.
// 예전 프롬프트는 개발 9개 + Other 뿐이라 마케팅·영업·재무 이력서가 전부 Other로 떨어졌다
// (이력서 보유 689명 중 213명) → 인재풀 직군 구성에서 비개발이 통째로 사라졌다.
// 그룹으로 묶어 보여주면 모델이 그룹명("Other Tech")을 답으로 내놓아서 평면 목록으로 준다.
export const ROLE_ENUM = ROLE_GROUPS.flatMap((g) => g.roles.map((r) => r.value)).join(', ')

const SYSTEM_PROMPT = `You are a resume parser for a staffing agency that places candidates at Korean companies. Extract structured profile data that a Korean hiring manager uses to judge a candidate's calibre (school, employers, seniority, language ability).

Return a JSON object with these fields:
- full_name (string): Full name of the person
- headline (string): A short professional headline, e.g. "Senior Backend Engineer" or "Full-stack Developer with 5+ years experience"
- location (string): City/Country if mentioned
- position (string): The person's role, copied EXACTLY as one of these values: ${ROLE_ENUM}. Judge by what they actually do day to day, not by tools they mention — a marketer who edits landing pages is Marketing, not Fullstack; an accountant who uses Excel macros is Finance. Use "Non-IT" only when the person is clearly non-IT and no other value fits. Empty string only if the resume gives no clue at all.
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

// PDF에 박힌 증명사진 후보 추출 — profile/parse-resume·admin/korean-cv 와 같은 휴리스틱
// (JPEG SOI/EOI 스캔, 아이콘/스캔본 배제용 10KB~2MB 창). 첫 매칭을 증명사진으로 본다.
function isValidJpeg(buf) {
  if (buf.length < 4) return false
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return false
  return [0xe0, 0xe1, 0xe2, 0xe3, 0xdb, 0xc0, 0xc2, 0xc4, 0xfe].includes(buf[3])
}
export function extractPhotoJpegFromPdf(buffer) {
  // %PDF- 헤더 앞에 개행/공백이 붙은 파일이 실존(백필에서 260건) — 스펙대로 앞 1KB 안에서 찾는다
  if (buffer.subarray(0, 1024).indexOf('%PDF-') === -1) return null
  const SOI = Buffer.from([0xff, 0xd8])
  const EOI = Buffer.from([0xff, 0xd9])
  let offset = 0
  while (offset < buffer.length - 1) {
    const startIdx = buffer.indexOf(SOI, offset)
    if (startIdx === -1) break
    const endIdx = buffer.indexOf(EOI, startIdx + 2)
    if (endIdx === -1) break
    const jpeg = buffer.slice(startIdx, endIdx + 2)
    if (jpeg.length > 10000 && jpeg.length < 2 * 1024 * 1024 && isValidJpeg(jpeg)) return jpeg
    offset = endIdx + 2
  }
  return null
}

// 이력서 파일에서 텍스트 추출. 파일명 확장자는 믿을 수 없다 — 옛 업로드 코드가 워드 파일도
// <id>.pdf 로 저장해서 실제 형식과 이름이 어긋난다(기존 17건). 그래서 시그니처로 판별한다.
// 스캔 이미지 PDF는 여기서 빈 텍스트가 나오고 호출부가 실패로 처리한다(OCR 미지원).
async function extractResumeText(buffer) {
  if (buffer.subarray(0, 2).toString('latin1') === 'PK') { // ZIP 컨테이너 = docx
    const { value } = await mammoth.extractRawText({ buffer })
    return value
  }
  const data = await pdf(buffer)
  return data.text
}

// 이력서 파일 버퍼 → user_profiles 갱신 shape 의 구조화 객체. DB 는 안 건드린다.
// parseResumeForUser(회원)와 KTC 클레임 사전파싱(비회원 리드)이 공유 — 같은 shape 이라
// 클레임 가입 콜백이 결과를 user_profiles 에 그대로 upsert 할 수 있다.
export async function parseResumeBuffer(fileBuffer, fallbackName = '') {
  const text = await extractResumeText(fileBuffer)
  if (!text || text.trim().length < 50) throw new Error('Could not extract text from resume')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Resume text:\n\n${text.slice(0, 15000)}` },
    ],
    temperature: 0.1,
  })
  const parsed = JSON.parse(completion.choices[0].message.content)

  const update = {
    full_name: parsed.full_name || fallbackName || '',
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
  const parsedName = parsed.full_name || fallbackName || ''
  if (parsedName) {
    try { update.resume_summary.name_ko = (await refineNameKo(parsedName)) || update.resume_summary.name_ko } catch {}
  }
  return update
}

// 한 유저의 이력서를 파싱해 user_profiles를 갱신. 실패 시 throw(호출부에서 개별 처리).
// touchUpdatedAt=false: 전체 재파싱(백필)용 — updated_at을 안 건드려 이력서풀 지표
// 착시(7/14 +294% 사례)와 어드민 정렬 뒤섞임을 막는다.
export async function parseResumeForUser(userId, { touchUpdatedAt = true } = {}) {
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles').select('id, resume_url, full_name, photo_url').eq('id', userId).single()
  if (profileErr || !profile?.resume_url) throw new Error('No resume found for this user')

  const fileRes = await fetch(profile.resume_url)
  if (!fileRes.ok) throw new Error('Failed to download resume')
  const fileBuffer = Buffer.from(await fileRes.arrayBuffer())

  const update = await parseResumeBuffer(fileBuffer, profile.full_name)
  // 증명사진: 직접 업로드/기존 사진이 없을 때만 CV에서 추출해 채운다(구글 아바타 대신 CV 사진 노출).
  // 경로 고정 + upsert 라 재파싱해도 멱등. 실패해도 본파싱 결과는 유지.
  if (!profile.photo_url) {
    try {
      const jpeg = extractPhotoJpegFromPdf(fileBuffer)
      if (jpeg) {
        const path = `${userId}/photo_cv.jpg`
        const { error: upErr } = await supabase.storage.from('profiles').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const url = supabase.storage.from('profiles').getPublicUrl(path).data?.publicUrl
          if (url) update.photo_url = url
        }
      }
    } catch {}
  }
  if (touchUpdatedAt) update.updated_at = new Date().toISOString()
  const { error: updateErr } = await supabase.from('user_profiles').update(update).eq('id', userId)
  if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`)
  return update
}

// 구조화 필드(연차 or 학교)가 비어 파싱이 필요한 유저 id 목록.
// all=true: 필드 채움 여부와 무관하게 전체(양식 변경 후 일괄 재파싱용).
// includePrivate=true: 비공개 이력서까지 포함 — 파싱 결과는 기업 노출용이 아니라
// 우리가 인재↔공고를 매칭해 콜드메일을 보낼 때 쓰므로 비공개도 대상이 된다.
export async function findPublicUnparsed(limit = 20, all = false, { includePrivate = false } = {}) {
  let q = supabase
    .from('user_profiles')
    .select('id')
    .not('resume_url', 'is', null)
  if (!includePrivate) q = q.eq('is_resume_public', true)
  if (!all) q = q.or('yoe_months.is.null,university.is.null')
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data || []).map((r) => r.id)
}
