import supabase from '../../../lib/supabaseAdmin'
import { verifyToken } from '../../../lib/campaignToken'
import { sendResumeToVtm } from '../../../lib/vtm'

// 콜드메일 원클릭 공개 전환 — 이메일 버튼(개인 토큰 링크)을 누르면 로그인 없이
// 이력서를 기업 공개(is_resume_public=true, VTM 전송)로 바꾸고 클릭/전환을 events에 로깅한다.
// 측정: coldmail_public_click(클릭) / coldmail_public_convert(실제 비공개→공개 전환).
export default async function handler(req, res) {
  const token = req.query.t
  const parsed = verifyToken(token)
  if (!parsed) return res.status(400).send(page('invalid'))

  const { userId, campaign } = parsed
  try {
    const { data: p } = await supabase
      .from('user_profiles')
      .select('resume_url, full_name, is_resume_public, vtm_talent_id')
      .eq('id', userId)
      .single()

    if (!p || !p.resume_url) return res.status(404).send(page('noresume'))

    const alreadyPublic = !!p.is_resume_public
    await supabase.from('events').insert([{
      event: 'coldmail_public_click', page: '/api/resume/go-public',
      meta: { campaign, already_public: alreadyPublic }, user_id: userId,
    }])

    if (!alreadyPublic) {
      // 실제 공개 전환 — VTM 전송 실패해도 유저에겐 성공 안내(재전송은 마이페이지에서 가능).
      let vtmTalentId = p.vtm_talent_id || null
      try {
        const r = await sendResumeToVtm(userId, p.resume_url, p.full_name)
        vtmTalentId = r?.talent_id || vtmTalentId
      } catch (e) {
        console.error('go-public VTM send failed:', e.message)
      }
      await supabase.from('user_profiles')
        .update({ is_resume_public: true, vtm_talent_id: vtmTalentId, updated_at: new Date().toISOString() })
        .eq('id', userId)
      await supabase.from('events').insert([{
        event: 'coldmail_public_convert', page: '/api/resume/go-public',
        meta: { campaign }, user_id: userId,
      }])
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(page(alreadyPublic ? 'already' : 'done'))
  } catch (e) {
    console.error('go-public error:', e.message)
    return res.status(500).send(page('error'))
  }
}

// 자체 완결 확인 페이지(베트남어 우선 + 한국어). CSP/외부의존 없음.
function page(state) {
  const M = {
    done: { emoji: '🎉', vi: 'CV của bạn đã được công khai!', vi2: 'Giờ bạn đã đủ điều kiện tham gia sự kiện thưởng 2.000.000 VND. Các công ty phù hợp có thể liên hệ với bạn.', ko: '이력서가 공개되었습니다 — 이제 축하금 이벤트 참여 가능!' },
    already: { emoji: '✅', vi: 'CV của bạn đã ở chế độ công khai.', vi2: 'Bạn đã đủ điều kiện tham gia sự kiện thưởng. Không cần làm gì thêm.', ko: '이미 공개 상태입니다 — 이벤트 참여 가능합니다.' },
    noresume: { emoji: '📄', vi: 'Chưa tìm thấy CV.', vi2: 'Vui lòng đăng ký CV trước tại salary-fyi.com/cv.', ko: '등록된 이력서가 없습니다.' },
    invalid: { emoji: '⚠️', vi: 'Liên kết không hợp lệ hoặc đã hết hạn.', vi2: 'Vui lòng dùng nút trong email mới nhất.', ko: '유효하지 않은 링크입니다.' },
    error: { emoji: '⚠️', vi: 'Đã có lỗi xảy ra.', vi2: 'Vui lòng thử lại sau giây lát.', ko: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
  }
  const m = M[state] || M.error
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FYI</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#1a1612;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="max-width:440px;text-align:center;background:#fff;border:1px solid #eee5da;border-radius:20px;padding:40px 28px;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<div style="font-size:52px;line-height:1;margin-bottom:18px">${m.emoji}</div>
<div style="font-size:19px;font-weight:800;margin-bottom:10px;letter-spacing:-.01em">${m.vi}</div>
<div style="font-size:14px;color:#6b6357;line-height:1.5;margin-bottom:8px">${m.vi2}</div>
<div style="font-size:12.5px;color:#a89f92;margin-bottom:24px">${m.ko}</div>
<a href="https://salary-fyi.com/jobs" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:10px">Xem việc làm phù hợp →</a>
</div></body></html>`
}
