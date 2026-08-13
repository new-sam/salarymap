import { useState } from 'react'
import Head from 'next/head'
import supabaseAdmin from '../lib/supabaseAdmin'
import { verifyToken } from '../lib/campaignToken'

/* 현/직전연봉 콜드메일 착지 페이지 — 로그인 없이 숫자 한 칸만 받는다.
   /salary-update?t=<token(user_id)>

   /lang 과 같은 설계: 수신자는 전원 로그아웃 상태로 메일에서 들어오므로 /profile 로
   보내면 구글 로그인 한 단계에서 대부분 빠진다. 토큰이 이미 누구인지 담고 있다.

   저장 단위는 프로필 폼과 동일 — 입력은 백만 VND/월(triệu), DB 는 ×1e6 원 단위
   (user_profiles.current_salary, 20260813 마이그). 프리셋 칩 없이 직접 입력만 받는다 —
   정확한 연봉이 목적이라 구간 탭이 아니라 본인이 친 숫자여야 한다(유저 결정 8/13).
   현재/직전 선택은 DB 컬럼 없이 events(coldmail_salary_fill).meta.type 에만 남긴다 —
   current_salary 는 "현 또는 직전" 단일 개념이고, 구분은 신선도 참고용이다. */

export async function getServerSideProps({ query }) {
  const claim = verifyToken(query.t)
  if (!claim?.userId) return { props: { valid: false, uiLang: normLang(query.lang) } }

  // current_salary(20260813) 미적용 환경 방어 — 컬럼이 없으면 빼고 재시도.
  let { data: prof, error } = await supabaseAdmin
    .from('user_profiles').select('id, full_name, current_salary').eq('id', claim.userId).maybeSingle()
  if (error && /current_salary/.test(error.message || '')) {
    ;({ data: prof } = await supabaseAdmin
      .from('user_profiles').select('id, full_name').eq('id', claim.userId).maybeSingle())
  }
  if (!prof) return { props: { valid: false, uiLang: normLang(query.lang) } }

  // 도달=클릭으로 센다 — 프리페치와 사람이 구분 안 되지만 기존 콜드메일 지표와 같은 조건.
  try {
    await supabaseAdmin.from('events').insert({
      event: 'coldmail_salary_click',
      user_id: prof.id,
      meta: { campaign: claim.campaign },
    })
  } catch {}

  return {
    props: {
      valid: true,
      token: query.t,
      uiLang: normLang(query.lang),
      name: prof.full_name || '',
      initial: prof.current_salary ? Math.round(prof.current_salary / 1000000) : null,
    },
  }
}

const LANGS = ['vi', 'ko', 'en']
const normLang = (v) => (LANGS.includes(String(v || '')) ? String(v) : 'vi')

// 문구는 이 페이지 전용이라 전역 사전에 넣지 않는다(/lang 과 같은 이유).
const T = {
  vi: {
    title: 'Cập nhật mức lương | FYI',
    badHead: 'Liên kết đã hết hạn hoặc không hợp lệ',
    badSub: 'Vui lòng bấm lại nút trong email. Nếu vẫn không được, hãy trả lời email này để chúng tôi hỗ trợ.',
    toJobs: 'Xem tin tuyển dụng',
    formHead: (n) => (n ? `${n} ơi, chỉ cần một con số` : 'Chỉ cần một con số'),
    formSub: 'FYI đang tiến cử bạn với các công ty. Khi biết mức lương của bạn, chúng tôi chỉ chọn những công ty có mức lương khiến bạn thực sự hài lòng — không cần đăng nhập, 30 giây.',
    typeCurrent: 'Lương hiện tại',
    typePrevious: 'Lương công việc gần nhất',
    unit: 'triệu VND / tháng',
    placeholder: 'VD: 25',
    preview: (s) => `= ${s} ₫ / tháng`,
    save: 'Lưu',
    saving: 'Đang lưu…',
    fine: 'Thông tin này không hiển thị với công ty — chỉ dùng để chọn những công ty xứng đáng với bạn.',
    doneHead: (n) => (n ? `Đã lưu, ${n} ơi` : 'Đã lưu'),
    doneSub: 'Từ giờ chúng tôi sẽ chỉ tiến cử bạn với những công ty có mức lương xứng đáng với bạn.',
    doneCta: 'Xem vị trí có thể ứng tuyển ngay',
    toProfile: 'Chỉnh sửa thêm trong hồ sơ',
    errSave: 'Lưu không thành công. Vui lòng thử lại sau.',
  },
  ko: {
    title: '연봉 정보 입력 | FYI',
    badHead: '링크가 만료되었거나 올바르지 않아요',
    badSub: '메일의 버튼을 다시 눌러주세요. 계속 안 되면 답장 주시면 도와드릴게요.',
    toJobs: '채용 공고 보러가기',
    formHead: (n) => (n ? `${n}님, 숫자 하나면 됩니다` : '숫자 하나면 됩니다'),
    formSub: 'FYI가 회원님을 기업에 직접 추천하고 있어요. 연봉을 알면 정말 만족할 만한 기업만 골라 추천할 수 있습니다 — 로그인 없이 30초.',
    typeCurrent: '현재 월급',
    typePrevious: '직전 직장 월급',
    unit: '백만 VND / 월',
    placeholder: '예: 25',
    preview: (s) => `= ${s} ₫ / 월`,
    save: '저장하기',
    saving: '저장 중…',
    fine: '이 정보는 기업에 공개되지 않고, 회원님이 만족할 기업을 고르는 데만 사용됩니다.',
    doneHead: (n) => (n ? `저장했습니다, ${n}님` : '저장했습니다'),
    doneSub: '이제 연봉이 만족스러운 기업에만 추천해 드릴게요.',
    doneCta: '지금 지원할 수 있는 공고 보기',
    toProfile: '내 프로필에서 더 수정하기',
    errSave: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.',
  },
  en: {
    title: 'Update your salary | FYI',
    badHead: 'This link has expired or is invalid',
    badSub: 'Please tap the button in the email again. If it still fails, just reply and we will help.',
    toJobs: 'Browse job posts',
    formHead: (n) => (n ? `${n}, just one number` : 'Just one number'),
    formSub: 'FYI recommends you directly to companies. Knowing your salary lets us pick only companies you would truly be happy with — no login, 30 seconds.',
    typeCurrent: 'Current salary',
    typePrevious: 'Previous job salary',
    unit: 'million VND / month',
    placeholder: 'e.g. 25',
    preview: (s) => `= ${s} ₫ / month`,
    save: 'Save',
    saving: 'Saving…',
    fine: 'This is never shown to companies — it is only used to pick companies that are worth your while.',
    doneHead: (n) => (n ? `Saved, ${n}` : 'Saved'),
    doneSub: 'From now on we will only recommend you to companies whose pay matches you.',
    doneCta: 'See jobs you can apply to now',
    toProfile: 'Edit more in my profile',
    errSave: 'Could not save. Please try again in a moment.',
  },
}

export default function SalaryUpdateLanding({ valid, token, uiLang, name, initial }) {
  const t = T[uiLang] || T.vi
  const [amount, setAmount] = useState(initial ? String(initial) : '')
  const [type, setType] = useState('current')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const n = parseInt(amount, 10)
  const filled = Number.isFinite(n) && n >= 1 && n <= 999

  const save = async () => {
    if (!filled || saving) return
    setSaving(true); setErr('')
    try {
      const r = await fetch('/api/salary-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, amount: n, type }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'failed')
      setDone(true)
    } catch {
      setErr(t.errSave)
    }
    setSaving(false)
  }

  if (!valid) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <h1 className="su-h">{t.badHead}</h1>
        <p className="su-sub">{t.badSub}</p>
        <a className="su-btn su-btn-ghost" href="/jobs">{t.toJobs}</a>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <div className="su-check">✓</div>
        <h1 className="su-h">{t.doneHead(name)}</h1>
        <p className="su-sub">{t.doneSub}</p>
        <a className="su-btn" href="/jobs">{t.doneCta}</a>
        <a className="su-link" href="/profile">{t.toProfile}</a>
      </Shell>
    )
  }

  return (
    <Shell t={t} uiLang={uiLang}>
      <h1 className="su-h">{t.formHead(name)}</h1>
      <p className="su-sub">{t.formSub}</p>

      <div className="su-seg">
        <button className={`su-seg-btn${type === 'current' ? ' su-seg-on' : ''}`} onClick={() => setType('current')}>{t.typeCurrent}</button>
        <button className={`su-seg-btn${type === 'previous' ? ' su-seg-on' : ''}`} onClick={() => setType('previous')}>{t.typePrevious}</button>
      </div>

      <div className="su-inputrow">
        <input
          className="su-input" inputMode="numeric" autoFocus
          value={amount} placeholder={t.placeholder}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <span className="su-unit">{t.unit}</span>
      </div>
      {/* 백만 단위 입력이라 0을 안 쳐도 된다는 걸 환산으로 못박는다 — 25 ↔ 25.000.000 혼동 방지 */}
      <p className="su-preview">{filled ? t.preview((n * 1000000).toLocaleString('vi-VN')) : ' '}</p>

      {err && <p className="su-err">{err}</p>}

      <button className="su-btn" onClick={save} disabled={!filled || saving}>
        {saving ? t.saving : t.save}
      </button>
      <p className="su-fine">{t.fine}</p>
    </Shell>
  )
}

function Shell({ children, t, uiLang }) {
  return (
    <>
      <Head>
        <title>{t?.title || T.vi.title}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="su-page"><div className="su-inner">{children}</div></div>
      <style jsx global>{`
        body { margin: 0; background: #f2f4f6; font-family: 'Pretendard', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #191F28; }
        .su-page { min-height: 100vh; padding: 40px 16px 64px; }
        .su-inner { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #E5E8EB; border-radius: 16px; padding: 32px 24px 28px; }
        .su-h { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.35; margin: 0 0 8px; }
        .su-sub { font-size: 14px; color: #8B95A1; line-height: 1.6; margin: 0 0 22px; }
        .su-seg { display: flex; gap: 8px; margin-bottom: 14px; }
        .su-seg-btn { flex: 1; padding: 12px 8px; border: 1px solid #D1D6DB; border-radius: 10px; background: #fff; color: #4E5968; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .su-seg-on { border-color: #ff6000; color: #ff6000; background: #fff7f2; }
        .su-inputrow { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .su-preview { font-size: 13px; font-weight: 600; color: #8B95A1; margin: 0 0 14px; min-height: 18px; }
        .su-input { flex: 1; font-size: 22px; font-weight: 800; padding: 13px 14px; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; color: #111; font-family: inherit; outline: none; box-sizing: border-box; width: 100%; }
        .su-input:focus { border-color: #ff6000; }
        .su-unit { font-size: 14px; font-weight: 600; color: #4E5968; white-space: nowrap; }
        .su-btn { display: block; width: 100%; padding: 15px; border: none; border-radius: 10px; background: #ff6000; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; text-align: center; text-decoration: none; }
        .su-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .su-btn-ghost { background: #fff; color: #4E5968; border: 1px solid #D1D6DB; }
        .su-link { display: block; text-align: center; margin-top: 14px; font-size: 13.5px; font-weight: 600; color: #8B95A1; text-decoration: none; }
        .su-fine { font-size: 12px; color: #B0B8C1; text-align: center; margin: 12px 0 0; line-height: 1.5; }
        .su-err { font-size: 13px; color: #E5484D; margin: 0 0 12px; }
        .su-check { width: 52px; height: 52px; border-radius: 50%; background: #E7F6EC; color: #16a34a; font-size: 26px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
      `}</style>
    </>
  )
}
