// VTM(외부 인재마켓) 포트폴리오 웹훅 — 이력서 공개 ON/OFF 시 PDF를 전송/삭제한다.
// share-resume.js(마이페이지 토글)와 콜드메일 원클릭 공개(go-public.js)가 공유.
const VTM_WEBHOOK_URL = 'https://vtm-neon.vercel.app/api/webhook/portfolio'
const VTM_API_KEY = process.env.VTM_WEBHOOK_API_KEY || ''

export async function sendResumeToVtm(userId, resumeUrl, fullName) {
  const pdfRes = await fetch(resumeUrl)
  if (!pdfRes.ok) throw new Error('Failed to download resume PDF')

  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  const base64 = pdfBuffer.toString('base64')

  const webhookRes = await fetch(VTM_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': VTM_API_KEY },
    body: JSON.stringify({
      pdf_base64: base64,
      name: fullName || '',
      source: 'salarymap',
      external_id: userId,
    }),
  })

  if (!webhookRes.ok) {
    const errText = await webhookRes.text().catch(() => 'unknown error')
    throw new Error(`VTM webhook failed (${webhookRes.status}): ${errText}`)
  }

  return webhookRes.json()
}

export async function deleteResumeFromVtm(userId) {
  const webhookRes = await fetch(VTM_WEBHOOK_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-api-key': VTM_API_KEY },
    body: JSON.stringify({ source: 'salarymap', external_id: userId }),
  })

  if (!webhookRes.ok) {
    const errText = await webhookRes.text().catch(() => 'unknown error')
    console.error(`VTM delete failed (${webhookRes.status}): ${errText}`)
  }
}
