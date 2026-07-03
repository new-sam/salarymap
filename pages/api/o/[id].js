import supabaseAdmin from '../../../lib/supabaseAdmin'

// 콜드아웃리치 오픈 추적 픽셀. 이메일 HTML의 1x1 이미지가 로드되면 오픈으로 기록.
// ※ 애플 메일 프라이버시(선로드)·이미지차단으로 숫자는 방향성 참고용.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export default async function handler(req, res) {
  const { id } = req.query
  if (id) {
    try {
      const { data } = await supabaseAdmin
        .from('cold_outreach').select('open_count, opened_at, sent_ts').eq('id', id).single()
      // 발송 순간의 프리페치만 건너뛰기 위한 짧은 유예. (발신자 본인 오픈 배제는 발신자 Gmail의
      // "외부 이미지 표시 전 확인" 설정으로 처리 — 회사계정 수신자는 5분내 여는 경우가 많아 grace를 길게 두면 진짜 오픈을 버림)
      const GRACE_MS = 30 * 1000
      if (data && data.sent_ts && (Date.now() - new Date(data.sent_ts).getTime()) >= GRACE_MS) {
        await supabaseAdmin.from('cold_outreach').update({
          open_count: (data.open_count || 0) + 1,
          opened_at: data.opened_at || new Date().toISOString(),
        }).eq('id', id)
      }
    } catch (e) { /* 로깅 실패해도 픽셀은 항상 반환 */ }
  }
  res.setHeader('Content-Type', 'image/gif')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.status(200).send(PIXEL)
}
