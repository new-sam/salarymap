import { useState } from 'react'
import Head from 'next/head'
import supabaseAdmin from '../../lib/supabaseAdmin'
import { supabase } from '../../lib/supabaseClient'
import { verifyToken, leadId } from '../../lib/ktcMailToken'
import { track } from '../../lib/track'

// KTC 콜드메일 착지점 — 가입 게이트.
// 콜드메일 수신자는 100% 베트남어권(발송 템플릿도 vi 전용)이라 이 페이지는 vi 고정이다.
// i18n 키를 새로 파지 않는 이유: 캠페인 전용 1회성 랜딩이라 세 로케일에 키가 흩어지면
// 머지 때 유실되기 쉽다(과거에 실제로 겪음).
//
// 역할 분담: 메일이 과거(지원했는데 결과를 못 들음)를 말하고, 이 페이지는 앞으로만 말한다.
// 지난 지원 내역은 띄우지 않는다 — 마감된 공고인 데다 '결과 미확인'을 줄줄이 나열하는 건
// 우리가 안 해준 걸 여러 번 광고하는 꼴이 된다.
//
// 토큰이 하는 일은 두 가지: 클릭 귀속(events)과 login_hint 용 이메일 확보.
export default function KtcStatus({ email, name, tokenValid }) {
  const [busy, setBusy] = useState(false)

  const login = async () => {
    if (busy) return
    setBusy(true)
    track('ktc_status_login_click', { page: '/ktc/status', meta: { lead: leadId(email) } })
    try { localStorage.setItem('fyi_login_return', '/my-applications') } catch {}
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
        // 우린 이 사람 이메일을 안다 → 구글 계정 선택 화면을 건너뛴다(가입 마찰 한 단계 제거).
        queryParams: { login_hint: email },
      },
    })
  }

  if (!tokenValid) {
    return (
      <div className="ks-wrap">
        <div className="ks-card ks-center">
          <p className="ks-lead">Liên kết không hợp lệ hoặc đã hết hạn.</p>
          <a className="ks-btn" href="/jobs">Xem tin tuyển dụng</a>
        </div>
        <style jsx global>{css}</style>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Theo dõi hồ sơ ứng tuyển của bạn | FYI</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="ks-wrap">
        <div className="ks-card">
          <div className="ks-brand">FYI<span>Nền tảng tuyển dụng do KTC xây dựng</span></div>

          <h1 className="ks-h1">
            {name ? `${name}, từ nay ` : 'Từ nay '}bạn <b>tự theo dõi được</b> hồ sơ của mình
          </h1>

          <p className="ks-lead">
            Không còn phải chờ đợi trong im lặng. Mỗi hồ sơ bạn nộp qua <b>FYI</b> đều
            hiển thị rõ đang ở bước nào.
          </p>

          <div className="ks-promise">
            <div className="ks-steps">
              {['Đã nộp', 'NTD đã xem', 'Đang xét duyệt', 'Kết quả'].map((s, i) => (
                <div className="ks-step" key={s}>
                  {i > 0 && <div className="ks-step-line" />}
                  <div className={`ks-step-dot${i === 0 ? ' on' : ''}`}>{i === 0 ? '✓' : ''}</div>
                  <div className="ks-step-label">{s}</div>
                </div>
              ))}
            </div>
            <p className="ks-promise-b">
              Và bạn <b>được thông báo ngay khi trạng thái thay đổi</b>.
            </p>
          </div>

          <button className="ks-btn ks-btn-lg" onClick={login} disabled={busy}>
            {busy ? 'Đang mở...' : 'Tạo tài khoản và bắt đầu →'}
          </button>
          <p className="ks-hint">Đăng nhập bằng <b>{email}</b> — email bạn đã dùng để ứng tuyển</p>
        </div>
        <style jsx global>{css}</style>
      </div>
    </>
  )
}

const css = `
  body { margin: 0; background: #f2f4f6; }
  .ks-wrap { min-height: 100vh; padding: 24px 16px 48px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #191F28; }
  .ks-card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #E5E8EB; border-radius: 16px; padding: 28px 24px 32px; }
  .ks-center { text-align: center; }
  .ks-brand { font-size: 20px; font-weight: 900; color: #ff4400; letter-spacing: -.5px; padding-bottom: 18px; border-bottom: 1px solid #F2F4F6; margin-bottom: 22px; }
  .ks-brand span { display: block; font-size: 11px; font-weight: 700; color: #8B95A1; letter-spacing: .3px; margin-top: 4px; }
  .ks-h1 { margin: 0 0 14px; font-size: 23px; line-height: 1.4; font-weight: 800; letter-spacing: -.4px; }
  .ks-h1 b { color: #ff4400; }
  .ks-lead { margin: 0 0 24px; font-size: 14px; line-height: 1.75; color: #4E5968; }
  .ks-lead b { color: #191F28; }
  .ks-promise { border: 1px solid #FFD9C7; background: #FFF7F3; border-radius: 12px; padding: 22px 18px 18px; margin-bottom: 26px; }
  .ks-promise-b { margin: 18px 0 0; font-size: 13px; line-height: 1.65; color: #4E5968; text-align: center; }
  .ks-promise-b b { color: #191F28; }
  .ks-steps { display: flex; align-items: flex-start; }
  .ks-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
  .ks-step-line { position: absolute; top: 10px; right: 50%; width: 100%; height: 2px; background: #F0D5C8; z-index: 0; }
  .ks-step-dot { width: 20px; height: 20px; border-radius: 50%; background: #F0D5C8; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
  .ks-step-dot.on { background: #ff4400; }
  .ks-step-label { margin-top: 6px; font-size: 10px; font-weight: 600; color: #8B95A1; text-align: center; line-height: 1.3; }
  .ks-btn { display: inline-block; background: #ff4400; color: #fff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 26px; border: 0; border-radius: 12px; cursor: pointer; }
  .ks-btn:disabled { opacity: .6; cursor: default; }
  .ks-btn-lg { display: block; width: 100%; font-size: 16px; padding: 16px; }
  .ks-hint { margin: 10px 0 0; font-size: 12px; color: #8B95A1; text-align: center; line-height: 1.6; word-break: break-all; }
  .ks-hint b { color: #4E5968; }
`

// "TRƯƠNG ĐỨC NHẬT TÂY" → "Tây". 발송 스크립트의 호칭(tên) 규칙과 동일하게 마지막 어절을 쓴다.
// DB 실명은 전대문자로 들어와 그대로 쓰면 고지서처럼 읽힌다.
function tenOf(fullName) {
  const last = String(fullName || '').trim().split(/\s+/).pop() || ''
  if (!last) return ''
  return last.charAt(0).toLocaleUpperCase('vi') + last.slice(1).toLocaleLowerCase('vi')
}

export async function getServerSideProps({ query }) {
  const parsed = verifyToken(query.t)
  if (!parsed) return { props: { tokenValid: false, email: '', name: '' } }

  const { data } = await supabaseAdmin
    .from('ktc_candidates')
    .select('full_name')
    .eq('email', parsed.email)
    .limit(1)

  return {
    props: {
      tokenValid: true,
      email: parsed.email,
      name: tenOf(data?.[0]?.full_name),
    },
  }
}
