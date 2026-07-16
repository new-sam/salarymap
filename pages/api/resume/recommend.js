import supabase from '../../../lib/supabaseAdmin'
import { verifyToken } from '../../../lib/campaignToken'

// 담당자 추천 콜드메일 원클릭 랜딩 — 이메일 버튼(개인 토큰 링크)을 누르면 로그인 없이
// "기업들이 FYI 추천으로 당신 프로필에 관심" 톤으로 추천 공고를 보여주고, 각 공고를
// 토큰 인증 원탭(/api/resume/quick-apply)으로 지원. 공고 id는 링크의 j= 로 전달(발송 시 확정).
// prefetch 자동지원 방지: 클릭은 랜딩까지만, 실제 지원은 페이지의 버튼 원탭(POST).
// 측정: events recommend_click.
const escHtml = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default async function handler(req, res) {
  const token = req.query.t
  const parsed = verifyToken(token)
  if (!parsed) return res.status(400).send(page('invalid'))
  const { userId, campaign } = parsed

  const jobIds = String(req.query.j || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)
  if (!jobIds.length) return res.status(400).send(page('invalid'))

  try {
    const { data: p } = await supabase.from('user_profiles')
      .select('full_name, resume_url').eq('id', userId).single()
    if (!p || !p.resume_url) return res.status(404).send(page('noresume'))

    const { data: jobs } = await supabase.from('jobs')
      .select('id, title, company, role, location, logo_url')
      .in('id', jobIds).eq('is_active', true)
    if (!jobs?.length) return res.status(404).send(page('closed'))
    // 링크 순서 유지
    const ordered = jobIds.map((id) => jobs.find((j) => j.id === id)).filter(Boolean)

    const { data: mine } = await supabase.from('job_applications')
      .select('job_id').eq('user_id', userId).in('job_id', jobIds)
    const applied = new Set((mine || []).map((a) => a.job_id))

    await supabase.from('events').insert([{
      event: 'recommend_click', page: '/api/resume/recommend',
      meta: { campaign, job_ids: jobIds }, user_id: userId,
    }])

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(landing(p.full_name, token, ordered, applied))
  } catch (e) {
    console.error('recommend error:', e.message)
    return res.status(500).send(page('error'))
  }
}

function landing(name, token, jobs, applied) {
  const cards = jobs.map((j) => {
    const logo = j.logo_url
      ? `<img src="${escHtml(j.logo_url)}" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#f0ebe3">`
      : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${escHtml((j.company || '?').trim().charAt(0).toUpperCase())}</div>`
    const meta = [j.role, j.location].filter(Boolean).map(escHtml).join(' · ')
    const btn = applied.has(j.id)
      ? '<button disabled style="background:#f0ebe3;color:#8a8073;font-weight:700;font-size:13px;border:0;padding:10px 16px;border-radius:10px;white-space:nowrap">Đã ứng tuyển ✓</button>'
      : `<button onclick="applyJob(this,'${j.id}')" style="background:#ff6000;color:#fff;font-weight:700;font-size:13px;border:0;padding:10px 16px;border-radius:10px;cursor:pointer;white-space:nowrap">Ứng tuyển ngay</button>`
    return `<div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eee5da;border-radius:14px;padding:16px">
      ${logo}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(j.company)}</div>
        <div style="font-size:14.5px;font-weight:700;line-height:1.35;margin-bottom:4px">${escHtml(j.title)}</div>
        <div style="font-size:12px;color:#b0691a">${meta}</div>
      </div>${btn}</div>`
  }).join('\n')

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FYI — Nhà tuyển dụng quan tâm đến bạn</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:28px 16px 48px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:18px">FYI</div>
  <div style="text-align:center;background:#fff;border:1px solid #eee5da;border-radius:18px;padding:28px 22px;margin-bottom:22px">
    <div style="font-size:44px;line-height:1;margin-bottom:14px">👀</div>
    <div style="font-size:18px;font-weight:800;margin-bottom:8px;letter-spacing:-.01em">Nhà tuyển dụng đang quan tâm đến hồ sơ của bạn</div>
    <div style="font-size:13.5px;color:#6b6357;line-height:1.55">Dựa trên hồ sơ của bạn trên FYI, chúng tôi đã giới thiệu bạn tới các công ty dưới đây. Họ đang tuyển vị trí phù hợp — ứng tuyển chỉ với 1 chạm, CV của bạn được gửi ngay.</div>
  </div>
  <div style="font-size:13px;font-weight:800;color:#8a8073;text-transform:uppercase;letter-spacing:.04em;margin:0 2px 10px">✨ Vị trí phù hợp với bạn (${jobs.length})</div>
  <div style="display:flex;flex-direction:column;gap:10px">${cards}</div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:26px 0 0;line-height:1.5">CV đã đăng ký của bạn sẽ được gửi kèm khi ứng tuyển.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a></p>
</div>
<script>
var T=${JSON.stringify(token)};
function applyJob(btn, jobId){
  btn.disabled=true; btn.style.cursor='default'; btn.textContent='Đang gửi…';
  fetch('/api/resume/quick-apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:T,jobId:jobId})})
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j} }) })
    .then(function(x){
      if(!x.ok) throw new Error((x.j&&x.j.error)||'error');
      btn.textContent='Đã ứng tuyển ✓'; btn.style.background='#f0ebe3'; btn.style.color='#8a8073';
    })
    .catch(function(){ btn.disabled=false; btn.style.cursor='pointer'; btn.textContent='Ứng tuyển ngay'; alert('Có lỗi xảy ra, vui lòng thử lại.'); });
}
</script>
</body></html>`
}

function page(state) {
  const M = {
    noresume: { emoji: '📄', vi: 'Chưa tìm thấy CV.', vi2: 'Vui lòng đăng ký CV trước tại salary-fyi.com/cv.' },
    closed: { emoji: '🔒', vi: 'Vị trí đã đóng.', vi2: 'Các vị trí này hiện không còn tuyển. Xem thêm việc làm mới tại salary-fyi.com/jobs.' },
    invalid: { emoji: '⚠️', vi: 'Liên kết không hợp lệ hoặc đã hết hạn.', vi2: 'Vui lòng dùng nút trong email mới nhất.' },
    error: { emoji: '⚠️', vi: 'Đã có lỗi xảy ra.', vi2: 'Vui lòng thử lại sau giây lát.' },
  }
  const m = M[state] || M.error
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FYI</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#1a1612;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="max-width:440px;text-align:center;background:#fff;border:1px solid #eee5da;border-radius:20px;padding:40px 28px;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<div style="font-size:52px;line-height:1;margin-bottom:18px">${m.emoji}</div>
<div style="font-size:19px;font-weight:800;margin-bottom:10px;letter-spacing:-.01em">${m.vi}</div>
<div style="font-size:14px;color:#6b6357;line-height:1.5;margin-bottom:24px">${m.vi2}</div>
<a href="https://salary-fyi.com/jobs" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:10px">Xem việc làm phù hợp →</a>
</div></body></html>`
}
