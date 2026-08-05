import crypto from 'crypto'

/* 비공개 인재 전시장(/private/showcasing) 의 기업별 링크 토큰.
   콜드메일 한 통마다 다른 주소를 주고, 그 주소로 들어온 이벤트에 기업 이름을 실는다.

   왜 평문(?co=mpnx)이 아니라 서명인가.
   지금은 화면에 아무것도 없어서 주소를 위조해도 얻을 게 없다. 하지만 이 링크는 곧
   메일로 나가고, 한 번 나간 주소는 회수가 안 된다 — 나중에 "기업마다 다른 후보"를
   보여주게 되는 순간 주소가 곧 열쇠가 되는데, 그때 평문이면 남의 회사 이름을 넣어
   남의 목록을 여는 걸 막을 방법이 없다. 그 시점에 형식을 바꾸면 이미 보낸 메일의
   링크가 전부 죽는다. 그래서 처음부터 서명해서 내보낸다.

   서명은 위조를 막을 뿐 내용을 감추지는 않는다(payload 는 base64 라 풀면 읽힌다).
   받는 기업이 제 회사 이름을 보는 건 상관없고, 우리가 막고 싶은 건 '발급 안 한 링크'다.

   '|' 로 나누는 건 ktcMailToken 과 같은 이유 — 기업명에 점이 들어가면(A.I. Corp)
   '.' 로 쪼개는 campaignToken 방식은 파싱이 깨진다.
   시크릿도 같은 값을 쓴다: 링크를 로컬 스크립트가 서명하고 prod 서버가 검증하는
   구조라 양쪽이 반드시 같아야 하고, 그래서 env 가 아니라 소스 리터럴이 기본값이다. */

const SECRET = process.env.RESUME_PUBLIC_TOKEN_SECRET || 'wsj11029-resume-public'

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sign = (payload) => b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())

// 기업명은 사람이 손으로 넣는 값이라 앞뒤 공백·구분자만 털어낸다. 표기(주식회사/Co.,Ltd)를
// 우리가 정규화하지 않는 이유: 메일에 그대로 들어갈 이름이고, 로그에서도 넣은 대로 보여야
// "이건 어디로 보낸 링크였나"가 헷갈리지 않는다.
export const normCompany = (name) => String(name || '').replace(/\|/g, ' ').trim().slice(0, 80)

export function makeToken(company, campaign = 'showcase1') {
  const payload = `${normCompany(company)}|${String(campaign || '').replace(/\|/g, '')}`
  return `${b64url(payload)}.${sign(payload)}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let payload
  try { payload = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString() } catch { return null }
  if (sign(payload) !== sig) return null
  const sep = payload.indexOf('|')
  if (sep < 0) return null
  return { company: payload.slice(0, sep), campaign: payload.slice(sep + 1) }
}
