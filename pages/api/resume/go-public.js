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
    // jobs* 캠페인(적극채용 공고 콜드메일)은 전환 후 기업등록 공고 리스트 + 원탭 지원 랜딩.
    if (/^jobs/.test(campaign)) {
      return res.status(200).send(await jobsLanding(userId, token, alreadyPublic))
    }
    return res.status(200).send(page(alreadyPublic ? 'already' : 'done'))
  } catch (e) {
    console.error('go-public error:', e.message)
    return res.status(500).send(page('error'))
  }
}

// jobs 캠페인 랜딩 — 공개 전환 확인 + 기업이 직접 등록한 활성 공고(company_self)를
// 지원 많은 순으로 나열하고, 각 공고를 토큰 인증 원탭(/api/resume/quick-apply)으로 지원.
const escHtml = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

async function jobsLanding(userId, token, alreadyPublic) {
  const { data: jobs } = await supabase.from('jobs')
    .select('id, title, company, created_at')
    .eq('source', 'company_self').eq('is_active', true)
    .not('company', 'ilike', '%likelion%')
  const ids = (jobs || []).map((j) => j.id)
  const [{ data: apps }, { data: mine }] = await Promise.all([
    supabase.from('job_applications').select('job_id').in('job_id', ids),
    supabase.from('job_applications').select('job_id').eq('user_id', userId).in('job_id', ids),
  ])
  const counts = {}
  for (const a of apps || []) counts[a.job_id] = (counts[a.job_id] || 0) + 1
  const applied = new Set((mine || []).map((a) => a.job_id))
  const sorted = (jobs || []).sort((a, b) =>
    (counts[b.id] || 0) - (counts[a.id] || 0) || new Date(b.created_at) - new Date(a.created_at))

  const dayLabel = (iso) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    return d <= 0 ? 'hôm nay' : `${d} ngày trước`
  }
  const cards = sorted.map((j) => {
    const c = counts[j.id] || 0
    const meta = [c > 0 ? `${c} ứng viên đã ứng tuyển` : null, dayLabel(j.created_at)].filter(Boolean).join(' · ')
    const btn = applied.has(j.id)
      ? '<button disabled style="background:#f0ebe3;color:#8a8073;font-weight:700;font-size:13px;border:0;padding:10px 16px;border-radius:10px;white-space:nowrap">Đã ứng tuyển ✓</button>'
      : `<button onclick="applyJob(this,'${j.id}')" style="background:#ff6000;color:#fff;font-weight:700;font-size:13px;border:0;padding:10px 16px;border-radius:10px;cursor:pointer;white-space:nowrap">Ứng tuyển ngay</button>`
    return `<div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eee5da;border-radius:14px;padding:16px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(j.company)}</div>
        <div style="font-size:14.5px;font-weight:700;line-height:1.35;margin-bottom:4px">${escHtml(j.title)}</div>
        <div style="font-size:12px;color:#b0691a">${escHtml(meta)}</div>
      </div>${btn}</div>`
  }).join('\n')

  const head = alreadyPublic
    ? { emoji: '✅', t: 'CV của bạn đang ở chế độ công khai', s: 'Nhà tuyển dụng có thể tìm thấy bạn. Các công ty dưới đây đang tuyển dụng tích cực — ứng tuyển chỉ với 1 chạm, CV của bạn sẽ được gửi ngay.' }
    : { emoji: '🎉', t: 'CV của bạn đã được công khai!', s: 'Nhà tuyển dụng giờ có thể tìm thấy bạn. Các công ty dưới đây đang tuyển dụng tích cực — ứng tuyển chỉ với 1 chạm, CV của bạn sẽ được gửi ngay.' }

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FYI — Việc làm đang tuyển</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:28px 16px 48px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:18px">FYI</div>
  <div style="text-align:center;background:#fff;border:1px solid #eee5da;border-radius:18px;padding:28px 22px;margin-bottom:22px">
    <div style="font-size:44px;line-height:1;margin-bottom:14px">${head.emoji}</div>
    <div style="font-size:18px;font-weight:800;margin-bottom:8px;letter-spacing:-.01em">${head.t}</div>
    <div style="font-size:13.5px;color:#6b6357;line-height:1.55">${head.s}</div>
  </div>
  <div style="font-size:13px;font-weight:800;color:#8a8073;text-transform:uppercase;letter-spacing:.04em;margin:0 2px 10px">🔥 Đang tuyển dụng tích cực (${sorted.length})</div>
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

// 자체 완결 확인 페이지(베트남어 전용 — 수신자 전원 베트남 유저). CSP/외부의존 없음.
function page(state) {
  const M = {
    done: { emoji: '🎉', vi: 'CV của bạn đã được công khai!', vi2: 'Giờ bạn đã đủ điều kiện tham gia sự kiện thưởng 2.000.000₫. Các công ty phù hợp có thể liên hệ với bạn.' },
    already: { emoji: '✅', vi: 'CV của bạn đã ở chế độ công khai.', vi2: 'Bạn đã đủ điều kiện tham gia sự kiện thưởng. Không cần làm gì thêm.' },
    noresume: { emoji: '📄', vi: 'Chưa tìm thấy CV.', vi2: 'Vui lòng đăng ký CV trước tại salary-fyi.com/cv.' },
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
