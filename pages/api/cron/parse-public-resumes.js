// 인재풀 이력서 자동 파싱 cron — 구조화 필드(연차/학교)가 비어 인재풀 카드에
// "미상"으로 뜨는 이력서를 매일 파싱해 채운다. /cv는 PDF만 저장하고
// 구조화 필드를 안 만들어서 미상 카드가 쌓이는 걸 자가 치유.
// 8/6부터 비공개 이력서도 포함 — 어드민 인재풀이 비공개까지 다 보여주므로.
// Vercel cron이 Authorization: Bearer ${CRON_SECRET} 로 호출.
// vercel.json crons: { "path": "/api/cron/parse-public-resumes", "schedule": "0 5 * * *" }  (05:00 UTC = 12:00 ICT)
// 수동 점검: GET ?dry=1 — 파싱 대상 수만 반환(파싱 안 함).
// 슬랙 알림은 폐지(8/3): 실패분이 매일 같은 6명(빈 resume_url 1 + 스캔 이미지 PDF 5)이라
// 영구 재시도 → 매일 같은 에러가 뜨는 노이즈였다. 결과는 응답 JSON/Vercel 로그로 확인.
import { parseResumeForUser, findPublicUnparsed } from '../../../lib/parseResume'

const MAX_PER_RUN = 20 // OpenAI 비용/Vercel 타임아웃 여유. 밀리면 다음 날 이어서 처리.

export default async function handler(req, res) {
  const dry = req.query.dry === '1'
  if (!dry && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const ids = await findPublicUnparsed(MAX_PER_RUN, false, { includePrivate: true })
    if (dry) return res.json({ dry: true, pending: ids.length, ids })

    let ok = 0, fail = 0
    const errors = []
    for (const id of ids) {
      try { await parseResumeForUser(id); ok++ }
      catch (e) { fail++; errors.push(`${id.slice(0, 8)}: ${e.message}`) }
    }
    return res.json({ processed: ids.length, ok, fail, errors })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
