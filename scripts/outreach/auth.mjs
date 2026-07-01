// 1회용: wsj@likelion.net 로 Gmail 발송 권한 동의 → refresh_token 발급.
// 사전조건: .env.local 에 GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET 존재,
//           Google Cloud OAuth 클라이언트의 리다이렉트 URI 에
//           http://localhost:3737/oauth2callback 등록.
// 실행: node scripts/outreach/auth.mjs
import http from 'node:http'
import { oauthClient, GMAIL_SCOPE, OAUTH_REDIRECT, env, SENDER } from './lib.mjs'

if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET) {
  console.error('✗ .env.local 에 GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET 를 먼저 넣으세요.')
  process.exit(1)
}

const client = oauthClient()
const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent select_account', scope: GMAIL_SCOPE, login_hint: SENDER })

console.log('\n1) 아래 URL 을 브라우저에서 열고 wsj@likelion.net 으로 동의하세요:\n')
console.log(url + '\n')

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) { res.writeHead(404); res.end(); return }
  const code = new URL(req.url, OAUTH_REDIRECT).searchParams.get('code')
  res.end('인증 완료. 터미널로 돌아가세요.')
  server.close()
  try {
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) {
      console.error('\n✗ refresh_token 이 없습니다. Google 계정 > 보안 > 앱 권한에서 기존 동의를 제거하고 다시 시도하세요.')
      process.exit(1)
    }
    console.log('\n✅ 아래 값을 .env.local 에 추가하세요:\n')
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`)
    process.exit(0)
  } catch (e) {
    console.error('✗ 토큰 교환 실패:', e.message)
    process.exit(1)
  }
})
server.listen(3737, () => console.log('(localhost:3737 에서 리다이렉트 대기중…)'))
