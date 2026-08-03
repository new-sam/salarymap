// VietnamWorks 공고 전문 추출.
// 검색 API(job-search/v1.0/search)는 jobDescription/jobRequirement 를 250~400자
// 요약본("..." 로 끝남)으로만 준다. 전문은 공고 상세 페이지 HTML 의 Next.js RSC
// 플라이트 데이터(self.__next_f.push)에 통째로 들어 있어 거기서 뽑는다.
// 크롤러(pages/api/cron/crawl-vietnamworks.js)와 백필 스크립트가 공유한다.

export async function fetchVwFullTexts(jobUrl) {
  if (!jobUrl) return null
  let html
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(jobUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) return null
    html = await resp.text()
  } catch {
    return null
  }
  const flight = collectFlight(html)
  if (!flight) return null
  const textRows = collectTextRows(flight)
  const description = extractField(flight, textRows, 'jobDescription')
  const requirement = extractField(flight, textRows, 'jobRequirement')
  if (!description && !requirement) return null
  return { description, requirement }
}

// self.__next_f.push([1,"..."]) 문자열 페이로드를 이어붙여 하나의 플라이트 스트림으로.
function collectFlight(html) {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g
  let out = ''
  for (const m of html.matchAll(re)) {
    try { out += JSON.parse(m[1]) } catch {}
  }
  return out
}

// 플라이트 스트림의 텍스트 행(id:T<hex 바이트 길이>,<본문>)을 전부 수집한다.
// T 행 본문은 길이로 구분될 뿐 뒤에 개행이 없어서, 다음 행이 본문 끝에 바로 붙는다 —
// 개행 기준으로는 못 찾고 스트림을 앞에서부터 순회해야 한다.
function collectTextRows(flight) {
  const rows = {}
  let minIndex = 0
  for (const m of flight.matchAll(/([0-9a-zA-Z]{1,4}):T([0-9a-f]+),/g)) {
    if (m.index < minIndex) continue // 이전 T 행 본문 안의 우연한 매치
    // 진짜 행 시작은 스트림 처음, 개행 뒤, 또는 직전 T 행 본문 끝
    if (m.index !== 0 && m.index !== minIndex && flight[m.index - 1] !== '\n') continue
    const bytes = parseInt(m[2], 16) // 길이는 UTF-8 바이트 수 (베트남어 = 멀티바이트)
    const start = m.index + m[0].length
    const text = Buffer.from(flight.slice(start), 'utf8').subarray(0, bytes).toString('utf8')
    rows[m[1]] = text
    minIndex = start + text.length
  }
  return rows
}

// "key":"..." 값을 전부 찾아 가장 긴 것을 고른다. (연관 공고 데이터에 같은 키가
// 요약본으로 또 등장할 수 있어, 본 공고의 전문 = 최장 텍스트로 판별)
function extractField(flight, textRows, key) {
  const marker = `"${key}":"`
  let best = null
  for (let i = flight.indexOf(marker); i >= 0; i = flight.indexOf(marker, i + 1)) {
    const raw = readJsonString(flight, i + marker.length)
    // "$29" 꼴은 텍스트 행 참조
    const text = raw.startsWith('$') ? textRows[raw.slice(1)] : raw
    if (text && (!best || text.length > best.length)) best = text
  }
  return best
}

// pos 부터 닫는 따옴표까지 JSON 문자열 이스케이프를 풀어 읽는다.
function readJsonString(flight, pos) {
  let out = ''
  let j = pos
  while (j < flight.length) {
    const c = flight[j]
    if (c === '"') break
    if (c === '\\') {
      const n = flight[j + 1]
      if (n === 'u') {
        out += String.fromCharCode(parseInt(flight.slice(j + 2, j + 6), 16))
        j += 6
        continue
      }
      out += { n: '\n', t: '\t', r: '\r' }[n] ?? n
      j += 2
      continue
    }
    out += c
    j += 1
  }
  return out
}

export function buildDescription(jobDescription, jobRequirement) {
  const parts = []
  if (jobDescription) parts.push(stripHtml(jobDescription))
  if (jobRequirement) parts.push(`[Requirements]\n${stripHtml(jobRequirement)}`)
  return parts.join('\n\n')
}

export function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
