import { useState } from 'react'
import Head from 'next/head'
import supabaseAdmin from '../lib/supabaseAdmin'
import { verifyToken, leadId } from '../lib/ktcMailToken'
import LanguageCard from '../components/profile/LanguageCard'

/* 어학 콜드메일 착지 페이지 — 로그인 없이 어학 한 칸만 받는다.
   /lang?t=<token>&cta=score|daily|basic

   왜 /profile 로 안 보내는가: 수신자는 전원 로그아웃 상태로 메일에서 들어온다.
   /profile 은 세션이 없으면 구글 로그인을 태우는데, 그 한 단계에서 대부분 빠진다.
   토큰이 이미 "누구인지"를 담고 있으므로 로그인을 물을 이유가 없다.

   입력 UI 는 프로필의 LanguageCard 를 그대로 쓴다. 같은 화면을 두 벌 만들면
   저장 포맷("TOEIC 900")이 갈라져 프로필 쪽에서 칩으로 못 쪼개게 된다.

   cta 는 메일에서 누른 버튼이다. 값을 저장하지 않고 화면만 미리 맞춰준다 —
   메일 클릭만으로 거친 값을 저장하면 지금 자기서술 178건이 생긴 경로를 반복한다. */

export async function getServerSideProps({ query }) {
  const claim = verifyToken(query.t)
  if (!claim?.email) return { props: { valid: false } }

  const { data: prof } = await supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, english_cert, korean_cert')
    .ilike('email', claim.email)
    .maybeSingle()

  if (!prof) return { props: { valid: false } }

  // 도달 자체를 클릭으로 센다 — 메일 클라이언트가 링크를 프리페치해도 사람이 온 것과
  // 구분이 안 되지만, 그건 기존 콜드메일 지표와 같은 조건이라 비교 가능성이 유지된다.
  try {
    // user_id 를 같이 남긴다 — sent/fill 은 user_id 로 세는데 click 만 lead 해시로 세면
    // 세 지표가 서로 다른 식별자 공간이 되어 "클릭했는데 저장 안 한 사람"을 못 짚는다.
    await supabaseAdmin.from('events').insert({
      event: 'coldmail_lang_click',
      user_id: prof.id,
      meta: { campaign: claim.campaign, cta: query.cta || null, lead: leadId(claim.email) },
    })
  } catch {}

  return {
    props: {
      valid: true,
      token: query.t,
      cta: query.cta || null,
      name: prof.full_name || '',
      initial: {
        english_cert: prof.english_cert || '',
        korean_cert: prof.korean_cert || '',
      },
    },
  }
}

// 메일의 수준 버튼 → 프로필 수준 값. '일상 회화'를 Fluent 로 올려 잡으면 실제보다
// 높게 기록되므로 Intermediate 로 둔다. 어차피 랜딩에서 본인이 조정할 수 있다.
const LEVEL_OF = { daily: 'Intermediate', basic: 'Basic' }

export default function LangLanding({ valid, token, cta, name, initial }) {
  // cta=none('영어·한국어 모두 못합니다')만 예외적으로 값을 미리 채운다. 'None' 은 거친
  // 값이 아니라 그 자체로 확정된 답이고, 폼을 그대로 보여주므로 잘못 눌렀으면 저장 전에
  // 고칠 수 있다. 빈칸("아직 안 물어봤다")과 뜻이 달라 다시 묻지 않아도 된다.
  const [form, setForm] = useState({
    english_cert: initial?.english_cert || (cta === 'none' ? 'None' : ''),
    korean_cert: initial?.korean_cert || (cta === 'none' ? 'None' : ''),
    languages: [],
  })
  // '일상 회화'·'인사말'은 어느 언어인지 메일에서 알 수 없다 — 메일 버튼이 언어를
  // 구분하지 않기 때문이다(구분하려면 버튼이 4~6개가 되어 클릭 장벽이 도로 올라간다).
  // 그래서 랜딩에서 한 번만 묻는다. 임의로 영어라고 가정하면 한국어를 뜻한 사람의
  // 프로필에 틀린 값이 박힌다.
  const needLangPick = !!LEVEL_OF[cta] && !initial?.english_cert && !initial?.korean_cert
  const [langPicked, setLangPicked] = useState(!needLangPick)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const pickLang = (which) => {
    setForm((f) => ({ ...f, [which === 'ko' ? 'korean_cert' : 'english_cert']: LEVEL_OF[cta] }))
    setLangPicked(true)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const filled = String(form.english_cert || '').trim() || String(form.korean_cert || '').trim()

  const save = async () => {
    if (!filled || saving) return
    setSaving(true); setErr('')
    try {
      const r = await fetch('/api/lang/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, english_cert: form.english_cert, korean_cert: form.korean_cert }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'failed')
      setDone(true)
    } catch (e) {
      setErr(e.message === 'profile_not_found' ? '계정을 찾을 수 없어요.' : '저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    }
    setSaving(false)
  }

  if (!valid) {
    return (
      <Shell>
        <h1 className="lg-h">링크가 만료되었거나 올바르지 않아요</h1>
        <p className="lg-sub">메일의 버튼을 다시 눌러주세요. 계속 안 되면 답장 주시면 도와드릴게요.</p>
        <a className="lg-btn lg-btn-ghost" href="/jobs">채용 공고 보러가기</a>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="lg-check">✓</div>
        <h1 className="lg-h">저장했습니다{name ? `, ${name}님` : ''}</h1>
        <p className="lg-sub">이제 어학을 보는 공고에 우선 추천해 드릴게요.</p>
        <a className="lg-btn" href="/jobs">지금 지원할 수 있는 공고 보기</a>
        <a className="lg-link" href="/profile#language">내 프로필에서 더 수정하기</a>
      </Shell>
    )
  }

  // 수준 버튼으로 들어온 사람에게만 뜨는 한 단계 — 어느 언어였는지만 고른다.
  if (!langPicked) {
    return (
      <Shell>
        <h1 className="lg-h">{name ? `${name}님, ` : ''}어느 언어인가요?</h1>
        <p className="lg-sub">
          {cta === 'basic' ? '‘인사말 정도만 압니다’' : '‘일상 회화는 됩니다’'}를 선택하셨어요.
          어느 언어인지만 알려주시면 됩니다.
        </p>
        <button className="lg-btn lg-btn-ghost lg-pick" onClick={() => pickLang('en')}>영어</button>
        <button className="lg-btn lg-btn-ghost lg-pick" onClick={() => pickLang('ko')}>한국어</button>
        <button className="lg-link lg-linkbtn" onClick={() => setLangPicked(true)}>직접 입력할게요</button>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="lg-h">{name ? `${name}님, ` : ''}어학 한 칸만 채워주세요</h1>
      <p className="lg-sub">
        {cta === 'none'
          ? '‘영어·한국어 모두 못합니다’로 채워뒀습니다. 맞으면 저장만 눌러주세요.'
          : '로그인 없이 30초 · 영어만 채우셔도 충분합니다.'}
      </p>

      <div className="lg-card">
        <LanguageCard form={form} set={set} lang="ko" />
      </div>

      {err && <p className="lg-err">{err}</p>}

      <button className="lg-btn" onClick={save} disabled={!filled || saving}>
        {saving ? '저장 중…' : '저장하기'}
      </button>
      <p className="lg-fine">입력한 값은 내 프로필의 어학 항목에 저장됩니다.</p>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <>
      <Head>
        <title>어학 정보 입력 | FYI</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="lg-page"><div className="lg-inner">{children}</div></div>
      <style jsx global>{`
        body { margin: 0; background: #f2f4f6; font-family: 'Pretendard', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #191F28; }
        .lg-page { min-height: 100vh; padding: 40px 16px 64px; }
        .lg-inner { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #E5E8EB; border-radius: 16px; padding: 32px 24px 28px; }
        .lg-h { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.35; margin: 0 0 8px; }
        .lg-sub { font-size: 14px; color: #8B95A1; line-height: 1.6; margin: 0 0 22px; }
        .lg-card { border: 1px solid #F2F4F6; background: #FAFBFC; border-radius: 12px; padding: 18px 16px 6px; margin-bottom: 18px; }
        .lg-btn { display: block; width: 100%; padding: 15px; border: none; border-radius: 10px; background: #ff6000; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; text-align: center; text-decoration: none; }
        .lg-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .lg-btn-ghost { background: #fff; color: #4E5968; border: 1px solid #D1D6DB; }
        .lg-pick { margin-bottom: 10px; font-size: 16px; padding: 17px; }
        .lg-pick:hover { border-color: #ff6000; color: #ff6000; }
        .lg-linkbtn { background: none; border: none; width: 100%; cursor: pointer; font-family: inherit; }
        .lg-link { display: block; text-align: center; margin-top: 14px; font-size: 13.5px; font-weight: 600; color: #8B95A1; text-decoration: none; }
        .lg-fine { font-size: 12px; color: #B0B8C1; text-align: center; margin: 12px 0 0; }
        .lg-err { font-size: 13px; color: #E5484D; margin: 0 0 12px; }
        .lg-check { width: 52px; height: 52px; border-radius: 50%; background: #E7F6EC; color: #16a34a; font-size: 26px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }

        /* LanguageCard 가 쓰는 프로필 폼 클래스 — profile.js 의 style 블록 안에 있어
           이 페이지에서는 안 따라온다. 필요한 셋만 같은 값으로 다시 정의한다. */
        .pfield { margin-bottom: 14px; }
        .pfield-label { font-size: 12px; font-weight: 600; color: #4E5968; margin-bottom: 6px; }
        .pinput { width: 100%; font-size: 14px; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; background: #fff; color: #111; font-family: inherit; outline: none; box-sizing: border-box; }
        .pinput:focus { border-color: #ff6000; }
      `}</style>
    </>
  )
}