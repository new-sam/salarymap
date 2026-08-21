/* 어학 자유입력값 → 시험·구간·급(A/B/C).

   /api/admin/lang-scores(분포)와 /api/admin/lang-tier(전시장)가 같은 규칙을 써야
   "A급 74명"과 전시장에 뜨는 카드 수가 같다. 규칙을 각자 들고 있으면 한쪽만 고쳤을 때
   두 화면이 조용히 어긋난다.

   구간(900+·7.0+·6급)은 시험 안에서만 뜻이 있지만 급은 시험을 가로질러 같은 뜻이다 —
   A급 = CEFR C1 언저리, B급 = B2. 대응은 어림이다: ETS 공식 대응은 TOEIC 945+/785+ 이고
   TOPIK 은 다른 언어라 공식 대응표가 아예 없다. 후보를 추리는 1차 거름망이라 관용적인
   자리(900/800)에 맞췄다 — 경계에 걸친 사람은 어차피 직무로 다시 본다.
   TOPIK 만 한 급 위로 얹었다(5급→A, 4급→B). 한국어는 응시자 모수와 쓰임이 달라
   CEFR 자리 그대로 놓으면 실무에서 쓸 만한 층이 통째로 그 외로 빠진다. */

export const CHIP_CERTS = ['TOEIC', 'IELTS', 'VSTEP', 'TOPIK']
export const OTHER_CERTS = ['TOEFL', 'APTIS', 'CEFR', 'OPIC']
export const ALL_CERTS = [...CHIP_CERTS, ...OTHER_CERTS]

export const GRADES = {
  TOEIC: [['900+', 'A'], ['800–899', 'B'], ['700–799', 'C'], ['600–699', 'C'], ['~599', 'C']],
  TOEFL: [['100+', 'A'], ['90–99', 'B'], ['80–89', 'C'], ['~79', 'C']],
  IELTS: [['7.0+', 'A'], ['6.0–6.5', 'B'], ['5.0–5.5', 'C'], ['~4.5', 'C']],
  TOPIK: [['6급', 'A'], ['5급', 'A'], ['4급', 'B'], ['3급', 'C'], ['1–2급', 'C']],
  // VSTEP·APTIS 는 CEFR 등급으로 발급된다. "Vstep 6.0"·"Level 4" 처럼 원점수/레벨로
  // 적은 값은 두 척도가 섞여 있어(0–10점 vs 1–6레벨) 임의로 환산하지 않고 미상에 둔다.
  VSTEP: [['C1+', 'A'], ['B2', 'B'], ['B1', 'C'], ['A1–A2', 'C']],
  APTIS: [['C1+', 'A'], ['B2', 'B'], ['B1', 'C'], ['A1–A2', 'C']],
  // CEFR 은 시험이 아니라 척도 자체다. /cv 직접입력이 이 값을 받기 시작했고,
  // VSTEP·APTIS 가 이미 같은 척도로 환산되므로 같은 표를 쓴다.
  CEFR: [['C1+', 'A'], ['B2', 'B'], ['B1', 'C'], ['A1–A2', 'C']],
  /* OPIc — 점수가 아니라 ACTFL 숙달도 등급(NL·NM·NH·IL·IM·IH·AL)으로 발급된다.
     구간 이름을 CEFR 로 바꿔 적지 않고 OPIc 등급 그대로 둔다: 응시자가 받은 성적표에
     적힌 말과 화면에 뜨는 말이 같아야 "내 등급이 왜 저기 있지"가 안 생긴다.
     급 대응은 관용적인 자리에 맞췄다 — IH 를 B급(≈B2)에 두는 건 국내 채용에서
     'IH 이상'을 실무 가능선으로 보는 관행을 따른 것이고, IM 은 세 단계(IM1~IM3)가
     한 칸에 뭉쳐 있어 위로 올리면 과대평가가 된다. 경계는 어차피 직무로 다시 본다. */
  OPIC: [['AL+', 'A'], ['IH', 'B'], ['IM', 'C'], ['IL 이하', 'C']],
}

export const TIER_OF = Object.fromEntries(
  Object.entries(GRADES).map(([cert, bands]) => [cert, Object.fromEntries(bands)]),
)

export const TIER_RANK = { A: 0, B: 1, C: 2, 미상: 3 }

/* 베트남어 값에서 언어 이름은 시험명이 아니라 '무슨 언어인가'다 — "Tiếng Hàn Topik 6"
   은 한국어 TOPIK 6급이라는 뜻이라, 앞의 "Tiếng Hàn"을 떼야 시험명이 맨 앞에 온다.
   이걸 안 떼면 실제 급수를 적어준 사람이 통째로 자기서술로 떨어진다. */
const VI_LANG = /^(tiếng|tieng)\s+(anh|hàn|han|trung|nhật|nhat|pháp|phap|đức|duc|nga|việt|viet|hoa|quốc\s*tế)\s*/i

/* 남의 점수로 환산해 적은 값은 점수로 세지 않는다 — "C1 (IELTS equivalent 7.5)" 는
   IELTS 를 봤다는 뜻이 아니라 자기 등급이 그쯤이라는 주장이다. 그걸 IELTS 7.5 로
   세면 없는 성적표를 있다고 세는 것이고, 기업에 그 숫자로 추천하게 된다. */
const EQUIV = /(equivalent|equiv\.|t\u01b0\u01a1ng \u0111\u01b0\u01a1ng|tuong duong|\uc0c1\ub2f9|\uc815\ub3c4)/i

/* 시험명이 문장 어디에 있든 점수로 본다. 맨 앞만 보던 때는 "6.5 IELTS", "C1 Aptis",
   "Intermediate (IELTS 5.5)" 처럼 값이 앞에 오는 표기가 통째로 자기서술로 떨어졌다.
   가장 먼저 나오는 시험명을 쓴다 — 한 값에 둘이 겹치면("Intermediate (CEFR B1)")
   앞선 쪽이 그 사람이 말하려던 시험이다. */
export const certOf = (raw) => {
  const s = String(raw || '').trim().replace(VI_LANG, '')
  if (!s || EQUIV.test(s)) return null
  let best = null, at = Infinity
  for (const c of ALL_CERTS) {
    const m = s.match(new RegExp(`\\b${c}\\b`, 'i'))
    if (m && m.index < at) { best = c; at = m.index }
  }
  return best
}

export function gradeOf(cert, raw) {
  /* 베트남 표기 — VSTEP 은 'bậc N'(등급 N), TOPIK 은 'cấp N'(N급)으로 적는다.
     둘 다 공식 성적표에 그렇게 인쇄돼 나오는 말이라 자기서술이 아니다.
     VSTEP bậc 3/4/5 = CEFR B1/B2/C1 (공식 대응). */
  const bac = raw.match(/\b(?:bậc|bac)\s*([1-6])\b/i)
  if (cert === 'VSTEP' && bac) {
    const n = Number(bac[1])
    return n >= 5 ? 'C1+' : n === 4 ? 'B2' : n === 3 ? 'B1' : 'A1–A2'
  }
  const cap = raw.match(/\b(?:cấp|cap)\s*([1-6])\b/i)
  if (cert === 'TOPIK' && cap) {
    const n = Number(cap[1])
    return n >= 6 ? '6급' : n === 5 ? '5급' : n === 4 ? '4급' : n === 3 ? '3급' : '1–2급'
  }

  /* OPIc — ACTFL 등급 두 글자. IM 은 IM1~IM3 로 세분되지만 셋 다 같은 칸이라
     뒤 숫자는 무시한다. AM·AH 는 AL 위쪽이므로 같이 A급으로 본다.
     'IM level' 처럼 시험명 없이 등급만 적힌 값은 여기 오지 않는다 — certOf 가
     OPIc 을 못 찾아 애초에 자격증으로 안 잡힌다. 그건 물어봐야 하는 값이다. */
  if (cert === 'OPIC') {
    const m = raw.match(/\b(N[LMH]|I[LMH]|A[LMH])\s*[123]?\b/i)
    if (!m) return null
    const g = m[1].toUpperCase()
    if (g[0] === 'A') return 'AL+'
    if (g === 'IH') return 'IH'
    if (g === 'IM') return 'IM'
    return 'IL 이하'
  }

  if (cert === 'VSTEP' || cert === 'APTIS' || cert === 'CEFR') {
    const m = raw.match(/\b([ABC][12])\b/i)
    if (!m) return null
    const lv = m[1].toUpperCase()
    return lv[0] === 'C' ? 'C1+' : lv === 'B2' ? 'B2' : lv === 'B1' ? 'B1' : 'A1–A2'
  }
  /* 점수를 찾을 때 CEFR 토큰의 숫자는 지운다 — "Upper Intermediate (B2) - TOEIC 690/990"
     에서 첫 숫자를 그냥 집으면 B2 의 '2' 가 잡혀 TOEIC 2점이 된다(최하위 급). */
  const m = raw.replace(/\b[ABC][12]\b/gi, ' ').match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  // 척도 밖 숫자는 점수가 아니다 — "Toeic - 2025"(연도), "TOPIK 2024" 같은 값이
  // 그냥 두면 최상위 등급으로 올라간다. 범위를 벗어나면 미상으로 보낸다.
  if (cert === 'TOEIC') {
    if (n > 990) return null
    return n >= 900 ? '900+' : n >= 800 ? '800–899' : n >= 700 ? '700–799' : n >= 600 ? '600–699' : '~599'
  }
  if (cert === 'TOEFL') {
    // 120점 만점 iBT 와 677점 만점 PBT 가 섞여 들어온다. 큰 숫자는 PBT 로 읽는다
    // (PBT 550 ≈ iBT 80 ≈ B2). 둘 다 아닌 숫자는 미상.
    if (n > 677) return null
    if (n > 120) return n >= 627 ? '100+' : n >= 543 ? '90–99' : n >= 460 ? '80–89' : '~79'
    return n >= 100 ? '100+' : n >= 90 ? '90–99' : n >= 80 ? '80–89' : '~79'
  }
  if (cert === 'IELTS') {
    if (n > 9) return null
    return n >= 7 ? '7.0+' : n >= 6 ? '6.0–6.5' : n >= 5 ? '5.0–5.5' : '~4.5'
  }
  if (cert === 'TOPIK') {
    if (n > 6) return null // "TOPIK 2024" 방어. 급수는 1~6 뿐이다
    return n >= 6 ? '6급' : n >= 5 ? '5급' : n >= 4 ? '4급' : n >= 3 ? '3급' : '1–2급'
  }
  return null
}

// 값 하나 → { cert, band, tier, value }. 자격증이 아니면 null.
export function readCert(raw) {
  const cert = certOf(raw)
  if (!cert) return null
  const band = gradeOf(cert, String(raw).trim())
  return { cert, band: band || '미상', tier: band ? TIER_OF[cert][band] : '미상', value: String(raw).trim() }
}

/* 사람 하나의 급 — 두 시험을 가졌으면 높은 쪽으로. 후보를 추릴 때 필요한 건
   '이 사람이 A급이냐'지 '몇 개의 A급 점수가 있느냐'가 아니다. 자격증이 하나도 없으면 null. */
export function tierOfProfile(p) {
  const certs = [p.english_cert, p.korean_cert].map(readCert).filter(Boolean)
  if (!certs.length) return null
  certs.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])
  return { tier: certs[0].tier, certs }
}
