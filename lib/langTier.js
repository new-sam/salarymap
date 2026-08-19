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
export const OTHER_CERTS = ['TOEFL', 'APTIS', 'CEFR']
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
}

export const TIER_OF = Object.fromEntries(
  Object.entries(GRADES).map(([cert, bands]) => [cert, Object.fromEntries(bands)]),
)

export const TIER_RANK = { A: 0, B: 1, C: 2, 미상: 3 }

// 자격증명으로 시작하면 점수로 본다. "Intermediate"·"Fluent" 같은 자기서술은 제외.
export const certOf = (raw) => {
  const s = String(raw || '').trim()
  if (!s) return null
  return ALL_CERTS.find((c) => new RegExp(`^${c}\\b`, 'i').test(s)) || null
}

export function gradeOf(cert, raw) {
  if (cert === 'VSTEP' || cert === 'APTIS' || cert === 'CEFR') {
    const m = raw.match(/\b([ABC][12])\b/i)
    if (!m) return null
    const lv = m[1].toUpperCase()
    return lv[0] === 'C' ? 'C1+' : lv === 'B2' ? 'B2' : lv === 'B1' ? 'B1' : 'A1–A2'
  }
  const m = raw.match(/(\d+(?:\.\d+)?)/)
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
