import formidable from 'formidable'
import fs from 'fs'
import supabase from '../../../lib/supabaseAdmin'
import { verifyToken } from '../../../lib/campaignToken'

// 콜드메일 원클릭 이력서 등록 — 이미 가입했지만 이력서가 없는 회원에게 보내는 링크.
// 신원은 링크의 서명 토큰(campaignToken)이 증명하므로 로그인 화면을 거치지 않는다
// (go-public / quick-apply 와 같은 방식). 처음 오는 사람은 신원이 없어 이 경로를 못 쓴다.
//
//   GET  ?t=<token>  → 랜딩(성과 문구 + 파일 선택)
//   POST t + file    → 스토리지 저장 + user_profiles.resume_url 갱신
//
// 측정: coldmail_resume_click(랜딩 진입) / coldmail_resume_upload(등록 완료).
export const config = { api: { bodyParser: false } }

const RESUME_EXTS = new Set(['pdf', 'doc', 'docx'])
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default async function handler(req, res) {
  const token = req.method === 'POST' ? null : req.query.t
  if (req.method === 'POST') return handleUpload(req, res)

  const parsed = verifyToken(token)
  if (!parsed) return res.status(400).send(page('invalid'))

  const { userId, campaign } = parsed
  const { data: p } = await supabase.from('user_profiles')
    .select('full_name, resume_url').eq('id', userId).single()
  if (!p) return res.status(404).send(page('invalid'))

  await supabase.from('events').insert([{
    event: 'coldmail_resume_click', page: '/api/resume/upload',
    meta: { campaign, already_has_resume: !!p.resume_url }, user_id: userId,
  }])

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  if (p.resume_url) return res.status(200).send(page('already'))
  return res.status(200).send(landing(token, p.full_name, /^resume-register-bonus/.test(campaign || '')))
}

async function handleUpload(req, res) {
  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
    const [fields, files] = await form.parse(req)
    const parsed = verifyToken(fields.t?.[0])
    if (!parsed) return res.status(401).json({ error: 'invalid_token' })
    const file = files.file?.[0]
    if (!file) return res.status(400).json({ error: 'file required' })

    const { userId, campaign } = parsed
    const rawExt = (file.originalFilename || '').split('.').pop()?.toLowerCase()
    const ext = RESUME_EXTS.has(rawExt) ? rawExt : 'pdf'
    const path = `${userId}.${ext}`

    const { error: upErr } = await supabase.storage.from('resumes')
      .upload(path, fs.readFileSync(file.filepath), { contentType: file.mimetype, upsert: true })
    if (upErr) return res.status(500).json({ error: upErr.message })

    // 경로가 user id로 고정이라 URL이 매번 같다 → 버전 쿼리로 CDN 캐시를 우회한다(profile/upload와 동일).
    const publicUrl = `${supabase.storage.from('resumes').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    const { error: profErr } = await supabase.from('user_profiles').update({
      resume_url: publicUrl,
      resume_source: 'coldmail',
      resume_platform: 'web',
      updated_at: new Date().toISOString(),
    }).eq('id', userId)
    if (profErr) return res.status(500).json({ error: profErr.message })

    await supabase.from('events').insert([{
      event: 'coldmail_resume_upload', page: '/api/resume/upload',
      meta: { campaign }, user_id: userId,
    }])
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// 콜드메일 랜딩은 전부 베트남어(go-public / recommend와 동일).
const SHELL = (inner) => `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>FYI</title></head>
<body style="margin:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612;-webkit-font-smoothing:antialiased">
<div style="max-width:480px;margin:0 auto;padding:32px 16px 48px">
<div style="font-size:17px;font-weight:800;color:#ff6000;letter-spacing:-0.01em;margin-bottom:14px">FYI</div>
${inner}</div></body></html>`

function landing(token, fullName, bonus) {
  const hi = fullName ? `Chào ${esc(String(fullName).trim().split(/\s+/).slice(-1)[0])},` : 'Chào bạn,'
  // 메일과 같은 구조 — 320px에서 2열로 깔면 라벨이 서너 줄로 접힌다.
  const stat = (n, label) => `<tr>
    <td width="72" style="font-size:30px;font-weight:800;color:#ff6000;line-height:1.15;letter-spacing:-0.02em;vertical-align:middle;padding:9px 0">${n}</td>
    <td style="font-size:14px;font-weight:600;color:#1a1612;line-height:1.4;vertical-align:middle;padding:9px 0">${label}</td>
  </tr>`
  // 축하금 캠페인(resume-register-bonus*)은 메일과 같은 이벤트 프레임으로 —
  // 조건 문구는 /cv 랜딩(cv.how.notice)과 동일하게 유지한다.
  const hero = bonus ? `
  <div style="font-size:20px;font-weight:800;line-height:1.45;letter-spacing:-0.01em;margin-bottom:6px">Sự kiện thưởng <span style="color:#ff6000">1.000.000₫</span> khi được tuyển qua FYI</div>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#57504a">Đăng ký CV để tham gia. Khi có vị trí phù hợp, nhà tuyển dụng xem hồ sơ và chủ động liên hệ bạn — được tuyển qua FYI là bạn nhận thưởng.</p>
  <p style="border-top:1px solid #eeeae4;padding-top:16px;margin:0 0 22px;font-size:12px;line-height:1.6;color:#9a9186">Thưởng chỉ áp dụng cho vị trí tại doanh nghiệp Việt Nam, chi trả sau 2 tháng (60 ngày) làm việc.</p>` : `
  <div style="font-size:20px;font-weight:800;line-height:1.45;letter-spacing:-0.01em;margin-bottom:20px">Đăng ký CV, nhà tuyển dụng sẽ tìm đến bạn.</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">
    ${stat('7', 'lời mời mỗi tháng')}
    ${stat('85%', 'đậu vòng hồ sơ qua FYI')}
  </table>
  <div style="font-size:12px;color:#9a9186;line-height:1.5;margin-bottom:20px">Số liệu trung bình của người đã đăng ký CV.</div>

  <p style="border-top:1px solid #eeeae4;padding-top:20px;margin:0 0 22px;font-size:14px;line-height:1.7;color:#57504a">Bạn không cần tìm việc nữa. Chúng tôi chọn những vị trí bạn có khả năng đậu cao và liên hệ trước.</p>`
  return SHELL(`
<div style="background:#fff;border-radius:18px;padding:32px 24px 28px">
  <div style="font-size:13.5px;color:#8a8177;margin-bottom:12px">${hi}</div>
${hero}

  <input id="f" type="file" accept=".pdf,.doc,.docx" style="display:none">
  <button id="b" style="display:block;width:100%;background:#ff6000;color:#fff;font-weight:700;font-size:15px;border:0;border-radius:12px;padding:16px;cursor:pointer;font-family:inherit">Chọn file CV</button>
  <div id="m" style="font-size:12.5px;color:#9a9186;text-align:center;margin-top:12px;line-height:1.5">Không cần đăng nhập · PDF / DOCX · tối đa 10MB</div>
</div>

<script>
var T=${JSON.stringify(token)},f=document.getElementById('f'),b=document.getElementById('b'),m=document.getElementById('m');
b.onclick=function(){f.click()};
f.onchange=function(){
  var file=f.files[0]; if(!file) return;
  b.disabled=true; b.textContent='Đang tải lên...'; m.textContent=file.name;
  var fd=new FormData(); fd.append('t',T); fd.append('file',file);
  fetch('/api/resume/upload',{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(j){
    if(j&&j.ok){
      b.style.background='#0d9488'; b.textContent='✓ Đã đăng ký CV';
      m.innerHTML='Xong! Chúng tôi sẽ liên hệ khi có vị trí phù hợp.<br><a href="https://salary-fyi.com/jobs" style="color:#ff6000;font-weight:700">Xem việc làm phù hợp →</a>';
    } else { b.disabled=false; b.textContent='Thử lại'; m.textContent=(j&&j.error)||'Tải lên thất bại'; }
  }).catch(function(){ b.disabled=false; b.textContent='Thử lại'; m.textContent='Tải lên thất bại'; });
};
</script>`)
}

function page(kind) {
  const copy = {
    invalid: { emoji: '🔗', t: 'Liên kết không hợp lệ.', s: 'Vui lòng mở lại liên kết trong email của bạn.' },
    already: { emoji: '✅', t: 'CV của bạn đã được đăng ký.', s: 'Chúng tôi sẽ liên hệ khi có vị trí phù hợp.' },
  }[kind] || { emoji: '⚠️', t: 'Đã xảy ra lỗi.', s: 'Vui lòng thử lại sau.' }
  return SHELL(`<div style="background:#fff;border-radius:18px;padding:40px 28px;text-align:center">
<div style="font-size:36px;margin-bottom:16px">${copy.emoji}</div>
<div style="font-size:18px;font-weight:800;margin-bottom:8px;line-height:1.4">${copy.t}</div>
<div style="font-size:14px;color:#8a8177;line-height:1.6;margin-bottom:26px">${copy.s}</div>
<a href="https://salary-fyi.com/jobs" style="display:block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px;border-radius:12px">Xem việc làm phù hợp</a></div>`)
}
