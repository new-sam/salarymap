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

// PDF에 박힌 증명사진 추출. ⚠️ "첫 JPEG = 증명사진" 휴리스틱은 템플릿 장식 이미지(배너/
// 아이콘/배경)를 프로필 사진으로 올리는 사고를 냈다(8/5) — 후보를 전부 모아 인물사진 비율로
// 거른 뒤 vision 으로 "실제 1인 인물사진"인지 검증한 것만 쓴다.
function isValidJpeg(buf) {
  if (buf.length < 4) return false
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return false
  return [0xe0, 0xe1, 0xe2, 0xe3, 0xdb, 0xc0, 0xc2, 0xc4, 0xfe].includes(buf[3])
}

// JPEG SOF 헤더에서 픽셀 크기 — 의존성 없이 (sharp 를 lib 에 끌어오면 서버리스 번들이 커진다)
function jpegSize(buf) {
  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue }
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

// 증명사진 후보: 크기 창(아이콘/풀스캔 배제) + 인물사진스러운 비율·해상도 → 정방형(0.8)에
// 가까운 순으로 정렬해 반환
function photoCandidates(buffer) {
  if (buffer.subarray(0, 1024).indexOf('%PDF-') === -1) return []
  const SOI = Buffer.from([0xff, 0xd8])
  const EOI = Buffer.from([0xff, 0xd9])
  const out = []
  let offset = 0
  while (offset < buffer.length - 1 && out.length < 8) {
    const startIdx = buffer.indexOf(SOI, offset)
    if (startIdx === -1) break
    const endIdx = buffer.indexOf(EOI, startIdx + 2)
    if (endIdx === -1) break
    const jpeg = buffer.slice(startIdx, endIdx + 2)
    if (jpeg.length > 10000 && jpeg.length < 2 * 1024 * 1024 && isValidJpeg(jpeg)) {
      const dim = jpegSize(jpeg)
      const ratio = dim ? dim.w / dim.h : 0
      if (dim && dim.w >= 100 && dim.h >= 100 && ratio > 0.45 && ratio < 1.5) {
        out.push({ jpeg, score: Math.abs(ratio - 0.8) })
      }
    }
    offset = endIdx + 2
  }
  return out.sort((a, b) => a.score - b.score).map(c => c.jpeg)
}

// vision 검증: 프로필 사진으로 쓸 수 있는 "실제 1인 인물사진"인가 (로고/배너/일러스트 배제)
export async function isPortraitPhoto(imageBuffer, mime = 'image/jpeg') {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Is this image a photograph of a single real person (headshot/portrait style, usable as a profile picture)? Logos, banners, illustrations, cartoon avatars, monogram/letter avatars, icons, screenshots, documents, or group photos are NO. Answer only YES or NO.' },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBuffer.toString('base64')}`, detail: 'low' } },
      ],
    }],
    temperature: 0,
    max_tokens: 3,
  })
  return /yes/i.test(completion.choices[0]?.message?.content || '')
}

// 후보 상위 3개를 순서대로 vision 검증 — 통과한 첫 이미지만 반환, 없으면 null
export async function extractVerifiedPhotoFromPdf(buffer) {
  for (const jpeg of photoCandidates(buffer).slice(0, 3)) {
    try { if (await isPortraitPhoto(jpeg)) return jpeg } catch { return null }
  }
  return null
}

// 포트폴리오/작업물 링크 추출 — 디자이너 평가는 학교·어학보다 포폴이 본질이라 카드 1급 신호
// (개발자는 GitHub). 본문 텍스트와 PDF raw 바이트(/URI 링크 주석은 텍스트에 안 나옴)를 함께 스캔.
// 알려진 포폴/코드 호스트만 잡아 노이즈를 막는다.
const LINK_RE = /(?:https?:\/\/)?(?:www\.)?((?:behance\.net|dribbble\.com|artstation\.com|github\.com|gitlab\.com|notion\.site|notion\.so|figma\.com|myportfolio\.com|wixsite\.com|carrd\.co|framer\.website|drive\.google\.com|youtube\.com|youtu\.be|vimeo\.com)\/[A-Za-z0-9@._~\/#?&=%+-]+)/gi
export function extractPortfolioLinks(text = '', buffer = null) {
  const hay = text + '\n' + (buffer ? buffer.toString('latin1') : '')
  const seen = new Set()
  const links = []
  let m
  LINK_RE.lastIndex = 0 // g 플래그 정규식은 호출 간 lastIndex가 남는다
  while ((m = LINK_RE.exec(hay)) && links.length < 4) {
    const url = m[1].replace(/[.,;:_-]+$/, '')
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    links.push('https://' + url)
  }
  return links
}

// 이력서 파일에서 텍스트 추출. 파일명 확장자는 믿을 수 없다 — 옛 업로드 코드가 워드 파일도
// <id>.pdf 로 저장해서 실제 형식과 이름이 어긋난다(기존 17건). 그래서 시그니처로 판별한다.
// 스캔 이미지 PDF는 여기서 빈 텍스트가 나오고 호출부가 실패로 처리한다(OCR 미지원).
export async function extractResumeText(buffer) {
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
  let text = ''
  try { text = await extractResumeText(fileBuffer) } catch {}

  // 텍스트 레이어가 없는 PDF(스캔본·글자가 이미지/벡터로 박힌 템플릿)는 pdf-parse 가 빈 텍스트를
  // 뱉는다 — 이 경우 PDF 를 통째로 vision 입력해 읽는다(8/5, 실패 72명 중 다수가 이 유형).
  // base64 페이로드가 커서 15MB 초과 파일만 포기.
  let userContent
  if (text && text.trim().length >= 50) {
    userContent = `Resume text:\n\n${text.slice(0, 15000)}`
  } else if (fileBuffer.subarray(0, 1024).indexOf('%PDF-') !== -1 && fileBuffer.length < 15 * 1024 * 1024) {
    userContent = [
      { type: 'text', text: 'Parse this resume PDF.' },
      { type: 'file', file: { filename: 'resume.pdf', file_data: `data:application/pdf;base64,${fileBuffer.toString('base64')}` } },
    ]
  } else {
    throw new Error('Could not extract text from resume')
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
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
    // 어드민 인재풀 카드용 요약(한국어 호칭·학위·주요이력 3줄·포폴 링크) — 20260727 마이그레이션
    resume_summary: {
      name_ko: parsed.name_ko || '',
      degree: parsed.degree || '',
      edu_ko: parsed.edu_ko || '',
      bullets: Array.isArray(parsed.summary_ko) ? parsed.summary_ko : [],
      links: extractPortfolioLinks(text, fileBuffer),
    },
  }
  const parsedName = parsed.full_name || fallbackName || ''
  if (parsedName) {
    try { update.resume_summary.name_ko = (await refineNameKo(parsedName)) || update.resume_summary.name_ko } catch {}
  }
  return update
}

/* 사람이 직접 넣은 값은 파싱 결과로 덮지 않는다(어학·희망직무·연차).

   이력서에 어학 항목이 아예 없는 경우가 흔하다 — 2026-08 어학 콜드메일에서 TOEIC 950 을
   받은 사람의 이력서를 열어보니 TOEIC·IELTS·English 라는 단어 자체가 없었다. 그런 이력서를
   재파싱하면 english_level 이 '' 로 나오고, update 가 그대로 나가면서 **사람이 직접 넣은
   값이 빈 문자열로 지워진다.** 그 캠페인으로 모은 값이 지금 128건이라 손실이 크다.

   그래서 규칙을 하나로 둔다: 기존 값이 비어 있을 때만 파싱 결과를 채운다.

   /cv 직접입력 트랙(희망 직무·연차·자격증)이 붙으면서 position·yoe_months 도 같은
   보호가 필요해졌다 — 파일도 올리고 직접입력도 한 사람은 파싱이 돌면서 본인이 고른
   희망 직무가 이력서에서 추론한 직무로 조용히 바뀐다. 희망 직무는 '지금 뭘 하는가'가
   아니라 '앞으로 뭘 하고 싶은가'라 이력서가 이길 이유가 없다.
   파싱이 더 나은 값을 찾아도 못 쓰게 되지만, 이력서에서 나온 값이 사람이 넣은 값보다
   정확할 이유가 없으므로 이쪽이 안전하다.

   ※ 새 필드를 만들지 않는 이유: 출처를 따로 기록하려면 컬럼과 마이그레이션이 필요한데,
     '비어 있을 때만 채운다'로도 같은 결과가 나온다. */
export const USER_ENTERED_FIELDS = ['english_cert', 'korean_cert', 'position', 'yoe_months']

export function preserveUserEntered(update, profile) {
  // yoe_months 는 0(신입)이 정상값이다 — String(0 || '') === '' 이라 예전 검사로는
  // 신입만 보호에서 빠져 파싱값으로 덮였다. 널/빈문자만 '비었다'로 본다.
  const filled = (v) => v !== null && v !== undefined && String(v).trim() !== ''
  const out = { ...update }
  for (const k of USER_ENTERED_FIELDS) {
    if (filled(profile?.[k])) delete out[k]
  }
  return out
}

// 한 유저의 이력서를 파싱해 user_profiles를 갱신. 실패 시 throw(호출부에서 개별 처리).
// touchUpdatedAt=false: 전체 재파싱(백필)용 — updated_at을 안 건드려 이력서풀 지표
// 착시(7/14 +294% 사례)와 어드민 정렬 뒤섞임을 막는다.
export async function parseResumeForUser(userId, { touchUpdatedAt = true } = {}) {
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles').select('id, resume_url, full_name, photo_url, english_cert, korean_cert, position, yoe_months')
    .eq('id', userId).single()
  if (profileErr || !profile?.resume_url) throw new Error('No resume found for this user')

  const fileRes = await fetch(profile.resume_url)
  if (!fileRes.ok) throw new Error('Failed to download resume')
  const fileBuffer = Buffer.from(await fileRes.arrayBuffer())

  // 사람이 직접 넣은 값(어학·희망직무·연차)은 지키고 나머지만 갱신한다.
  const update = preserveUserEntered(await parseResumeBuffer(fileBuffer, profile.full_name), profile)
  // 증명사진: 직접 업로드/기존 사진이 없을 때만 CV에서 추출해 채운다(vision 검증 통과분만).
  // 소셜 아바타 폴백(photo_social)은 CV 사진이 나오면 덮어쓴다 — CV 사진이 항상 우선.
  // 경로 고정 + upsert 라 재파싱해도 멱등. 실패해도 본파싱 결과는 유지.
  if (!profile.photo_url || profile.photo_url.includes('/photo_social')) {
    try {
      const jpeg = await extractVerifiedPhotoFromPdf(fileBuffer)
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
    .neq('resume_url', '')
  if (!includePrivate) q = q.eq('is_resume_public', true)
  if (!all) {
    q = q.or('yoe_months.is.null,university.is.null')
    // parse_failed 마킹(이미지 PDF 등 영구 실패)은 큐에서 제외 — 없으면 매일 무한 재시도.
    // 재시도는 scripts/retry-failed-parses.mjs 로 수동.
    q = q.or('resume_summary->>parse_failed.is.null,resume_summary->>parse_failed.eq.false')
  }
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data || []).map((r) => r.id)
}
