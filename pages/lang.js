import { useEffect, useRef, useState } from 'react'
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
      uiLang: normLang(query.lang),
      name: prof.full_name || '',
      initial: {
        english_cert: prof.english_cert || '',
        korean_cert: prof.korean_cert || '',
      },
    },
  }
}

// 화면 언어는 URL 이 정한다 — 메일을 어느 언어로 보냈는지는 send.mjs 의 --lang 이
// 이미 알고 있고, 그 값을 링크에 실어 보낸다. 브라우저 Accept-Language 나 localStorage
// 로 추측하면 안 된다: 수신자는 베트남에서 한국어 브라우저를 쓰기도 하고, 무엇보다
// 로그아웃 상태로 메일에서 처음 들어오므로 저장된 선호가 없다.
// 기본값이 vi 인 이유 — 실발송 200통이 전부 베트남어다. ko 는 검수용이다.
const LANGS = ['vi', 'ko', 'en']
const normLang = (v) => (LANGS.includes(String(v || '')) ? String(v) : 'vi')

// 메일의 수준 버튼 → 프로필 수준 값. '일상 회화'를 Fluent 로 올려 잡으면 실제보다
// 높게 기록되므로 Intermediate 로 둔다. 어차피 랜딩에서 본인이 조정할 수 있다.
const LEVEL_OF = { daily: 'Intermediate', basic: 'Basic' }

// 문구는 lib/translations 를 쓰지 않고 여기 둔다 — 이 페이지 전용이고 캠페인이 끝나면
// 같이 사라지는 문구라, 전역 사전에 넣으면 다음 사람이 지울 수 없는 키가 된다.
// vi 문구는 email-vi.html 과 같은 표현을 쓴다. 메일에서 누른 버튼과 착지 화면의 말이
// 다르면 같은 흐름으로 안 읽힌다.
const T = {
  vi: {
    title: 'Nhập thông tin ngoại ngữ | FYI',
    badHead: 'Liên kết đã hết hạn hoặc không hợp lệ',
    badSub: 'Vui lòng bấm lại nút trong email. Nếu vẫn không được, hãy trả lời email này để chúng tôi hỗ trợ.',
    toJobs: 'Xem tin tuyển dụng',
    doneHead: (n) => (n ? `Đã lưu, ${n} ơi` : 'Đã lưu'),
    doneSub: 'Từ giờ chúng tôi sẽ ưu tiên gợi ý những vị trí có yêu cầu ngoại ngữ.',
    doneCta: 'Xem vị trí có thể ứng tuyển ngay',
    toProfile: 'Chỉnh sửa thêm trong hồ sơ',
    pickHead: (n) => (n ? `${n} ơi, đó là ngôn ngữ nào?` : 'Đó là ngôn ngữ nào?'),
    pickSub: (choice) => `Bạn đã chọn “${choice}”. Chỉ cần cho biết đó là ngôn ngữ nào.`,
    choiceDaily: 'Giao tiếp hằng ngày được',
    choiceBasic: 'Chỉ biết chào hỏi cơ bản',
    en: 'Tiếng Anh',
    ko: 'Tiếng Hàn',
    selfInput: 'Tôi sẽ tự nhập',
    formHead: (n) => (n ? `${n} ơi, chỉ cần điền một ô ngoại ngữ` : 'Chỉ cần điền một ô ngoại ngữ'),
    formSub: 'Không cần đăng nhập · 30 giây · Chỉ tiếng Anh cũng đủ.',
    noneHead: (n) => (n ? `${n} ơi, đúng là không biết cả hai chứ?` : 'Không biết cả hai, đúng chứ?'),
    noneSub: 'Bạn cho biết là xong — chúng tôi sẽ không hỏi lại về ngoại ngữ nữa.',
    noneYes: 'Đúng, tôi không biết cả hai',
    noneNo: 'Thật ra tôi có biết một chút',
    noneDoneSub: 'Cảm ơn bạn đã cho biết. Chúng tôi sẽ không gửi email về ngoại ngữ nữa.',
    sameHead: (n) => (n ? `${n} ơi, vẫn như cũ chứ?` : 'Vẫn như cũ chứ?'),
    sameSub: (v) => `Bạn đã cho biết là “${v}”. Từ đó tới nay bạn có thi lấy chứng chỉ nào không?`,
    sameYes: 'Vẫn vậy, tôi chưa có chứng chỉ',
    sameNo: 'Tôi đã có điểm rồi',
    sameDoneSub: 'Cảm ơn bạn đã xác nhận. Khi nào có chứng chỉ, bạn thêm vào hồ sơ bất cứ lúc nào cũng được.',
    save: 'Lưu',
    saving: 'Đang lưu…',
    fine: 'Thông tin này được lưu vào mục ngoại ngữ trong hồ sơ của bạn.',
    errNotFound: 'Không tìm thấy tài khoản.',
    errSave: 'Lưu không thành công. Vui lòng thử lại sau.',
  },
  ko: {
    title: '어학 정보 입력 | FYI',
    badHead: '링크가 만료되었거나 올바르지 않아요',
    badSub: '메일의 버튼을 다시 눌러주세요. 계속 안 되면 답장 주시면 도와드릴게요.',
    toJobs: '채용 공고 보러가기',
    doneHead: (n) => (n ? `저장했습니다, ${n}님` : '저장했습니다'),
    doneSub: '이제 어학을 보는 공고에 우선 추천해 드릴게요.',
    doneCta: '지금 지원할 수 있는 공고 보기',
    toProfile: '내 프로필에서 더 수정하기',
    pickHead: (n) => (n ? `${n}님, 어느 언어인가요?` : '어느 언어인가요?'),
    pickSub: (choice) => `‘${choice}’를 선택하셨어요. 어느 언어인지만 알려주시면 됩니다.`,
    choiceDaily: '일상 회화는 됩니다',
    choiceBasic: '인사말 정도만 압니다',
    en: '영어',
    ko: '한국어',
    selfInput: '직접 입력할게요',
    formHead: (n) => (n ? `${n}님, 어학 한 칸만 채워주세요` : '어학 한 칸만 채워주세요'),
    formSub: '로그인 없이 30초 · 영어만 채우셔도 충분합니다.',
    noneHead: (n) => (n ? `${n}님, 둘 다 못하시는 게 맞나요?` : '둘 다 못하시는 게 맞나요?'),
    noneSub: '알려주시면 끝납니다 — 앞으로 어학은 다시 묻지 않습니다.',
    noneYes: '네, 둘 다 못합니다',
    noneNo: '사실은 좀 합니다',
    noneDoneSub: '알려주셔서 감사합니다. 앞으로 어학 메일은 보내지 않습니다.',
    sameHead: (n) => (n ? `${n}님, 그대로신가요?` : '그대로신가요?'),
    sameSub: (v) => `‘${v}’라고 알려주셨었죠. 그 뒤로 시험 보신 게 있으실까요?`,
    sameYes: '그대로입니다, 자격증은 없어요',
    sameNo: '점수가 생겼어요',
    sameDoneSub: '확인해 주셔서 감사합니다. 나중에 자격증이 생기면 프로필에서 언제든 추가하실 수 있어요.',
    save: '저장하기',
    saving: '저장 중…',
    fine: '입력한 값은 내 프로필의 어학 항목에 저장됩니다.',
    errNotFound: '계정을 찾을 수 없어요.',
    errSave: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.',
  },
  en: {
    title: 'Add your language info | FYI',
    badHead: 'This link has expired or is invalid',
    badSub: 'Please tap the button in the email again. If it still fails, just reply and we will help.',
    toJobs: 'Browse job posts',
    doneHead: (n) => (n ? `Saved, ${n}` : 'Saved'),
    doneSub: 'We will now prioritise roles that look at language ability.',
    doneCta: 'See jobs you can apply to now',
    toProfile: 'Edit more in my profile',
    pickHead: (n) => (n ? `${n}, which language?` : 'Which language?'),
    pickSub: (choice) => `You chose “${choice}”. Just tell us which language it was.`,
    choiceDaily: 'I can hold everyday conversations',
    choiceBasic: 'I only know basic greetings',
    en: 'English',
    ko: 'Korean',
    selfInput: 'I will type it myself',
    formHead: (n) => (n ? `${n}, just one language field` : 'Just one language field'),
    formSub: 'No login · 30 seconds · English alone is enough.',
    noneHead: (n) => (n ? `${n}, neither language — is that right?` : 'Neither language — is that right?'),
    noneSub: 'Tell us once and we are done — we will not ask about language again.',
    noneYes: 'Right, I speak neither',
    noneNo: 'Actually I know a little',
    noneDoneSub: 'Thanks for telling us. We will not email you about language again.',
    sameHead: (n) => (n ? `${n}, still the same?` : 'Still the same?'),
    sameSub: (v) => `You told us “${v}”. Have you taken any test since then?`,
    sameYes: 'Still the same, no certificate',
    sameNo: 'I have a score now',
    sameDoneSub: 'Thanks for confirming. You can add a certificate to your profile any time.',
    save: 'Save',
    saving: 'Saving…',
    fine: 'This is saved to the language section of your profile.',
    errNotFound: 'Account not found.',
    errSave: 'Could not save. Please try again in a moment.',
  },
}

export default function LangLanding({ valid, token, cta, uiLang, name, initial }) {
  const t = T[uiLang] || T.vi
  const [form, setForm] = useState({
    english_cert: initial?.english_cert || '',
    korean_cert: initial?.korean_cert || '',
    languages: [],
  })
  /* cta=none('영어·한국어 모두 못합니다')은 자격증 폼을 아예 안 띄운다. 채울 게 없는
     사람에게 드롭다운을 내미는 건 답을 받기 어렵게 만들 뿐이고, 잘못 눌렀더라도
     프로필에서 직접 고칠 수 있다. 대신 버튼 한 번은 남긴다 — 메일 보안 스캐너가 링크를
     미리 열기 때문에, 링크를 여는 것만으로 저장하면 본인 의사 없이 'None' 이 박힌다.
     그러면 그 사람은 앞으로 어학 캠페인 대상에서도 빠진다. */
  const [noneConfirm, setNoneConfirm] = useState(cta === 'none')
  /* cta=same('그대로입니다') — 자기서술만 적어둔 사람에게 "그 뒤로 자격증 땄나요"를
     되묻는 경로. 값은 안 바뀌지만 coldmail_lang_responses 에 한 줄이 남아, 다음부터는
     '안 물어봤다'가 아니라 '물어봤고 아직 없다'로 읽힌다.

     화면에서 한 번 더 묻지 않는다 — 메일에서 이미 답한 사람에게 같은 질문을 두 번 하는
     꼴이다. 대신 저장을 서버 렌더가 아니라 브라우저에서 태운다: 메일 보안 스캐너는
     링크를 미리 열되 자바스크립트는 실행하지 않으므로, 이렇게 해야 사람이 누른 것만
     기록된다. 이 회차는 그 기록 자체가 목적이라 가짜 확인이 섞이면 안 된다.
     기존 값이 없으면 되물을 게 없으므로 평소 폼으로 보낸다. */
  const currentText = [initial?.english_cert, initial?.korean_cert].filter(Boolean).join(' · ')
  const sameAuto = cta === 'same' && !!currentText
  const autoFired = useRef(false)
  // '일상 회화'·'인사말'은 어느 언어인지 메일에서 알 수 없다 — 메일 버튼이 언어를
  // 구분하지 않기 때문이다(구분하려면 버튼이 4~6개가 되어 클릭 장벽이 도로 올라간다).
  // 그래서 랜딩에서 한 번만 묻는다. 임의로 영어라고 가정하면 한국어를 뜻한 사람의
  // 프로필에 틀린 값이 박힌다.
  const needLangPick = !!LEVEL_OF[cta] && !initial?.english_cert && !initial?.korean_cert
  const [langPicked, setLangPicked] = useState(!needLangPick)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  /* 사람이 실제로 연 것만 세는 이벤트.

     coldmail_lang_click 은 getServerSideProps 에서 찍는다 — 메일 보안 스캐너가 링크를
     미리 열어도 똑같이 찍히므로 '도달'이지 '클릭'이 아니다. 스캐너는 자바스크립트를
     실행하지 않으니, 브라우저에서 한 번 더 찍어야 사람 수를 셀 수 있다.
     click 을 고치지 않고 이벤트를 하나 더 두는 이유: 기존 대시보드가 click 으로
     시계열을 그리고 있어, 정의를 바꾸면 8월 이전 숫자와 비교가 끊긴다.
     StrictMode 이중 마운트로 두 번 찍히는 건 표에서 사람 단위로 세니 문제되지 않는다. */
  useEffect(() => {
    if (!valid) return
    fetch('/api/lang/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, cta }),
      keepalive: true,
    }).catch(() => {})
  }, [])

  const pickLang = (which) => {
    setForm((f) => ({ ...f, [which === 'ko' ? 'korean_cert' : 'english_cert']: LEVEL_OF[cta] }))
    setLangPicked(true)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  // score 경로에선 손대지 않은 칸을 아예 보내지 않는다. 그대로 실어 보내면 기존
  // 자기서술("Intermediate")이 이번 답변인 것처럼 다시 저장되고, 응답 원본 기록에도
  // 그 값이 남아 "이번에 자기서술을 냈다"로 집계된다. 빼면 save.js 가 그 칼럼을
  // 건드리지 않아 DB 값은 그대로 보존된다 — 화면에 남는 안내문과 뜻이 맞는다.
  const untouched = (k) => cta === 'score' && form[k] === (initial?.[k] || '')
  const payload = {}
  if (!untouched('english_cert')) payload.english_cert = form.english_cert
  if (!untouched('korean_cert')) payload.korean_cert = form.korean_cert
  const filled = Object.values(payload).some((v) => String(v || '').trim())

  /* 인자 없이 부르면 폼 값을, 값을 주면 그걸 저장한다 — 확인 화면은 폼을 안 띄우므로
     setForm 을 거치면 리렌더 한 박자 뒤에나 저장돼 버튼이 먹통처럼 보인다. */
  const save = async (override, mode) => {
    // 폼에서 저장할 때는 payload 를 쓴다 — score 경로에서 손대지 않은 칸이 빠져 있다.
    // 확인 모드(override)는 보낼 값을 직접 넘기므로 그대로 둔다.
    const body = override || payload
    if (saving) return
    // 확인 모드는 값을 안 보내므로 빈 값 검사를 건너뛴다.
    if (mode !== 'confirm' && !String(body.english_cert || '').trim() && !String(body.korean_cert || '').trim()) return
    setSaving(true); setErr('')
    try {
      const r = await fetch('/api/lang/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // cta 를 같이 보낸다 — 응답 원본 기록(coldmail_lang_responses)에 "어느 버튼으로
        // 들어와 저장했는지"를 남겨야 프리셀렉트 값인지 직접 고친 값인지 나중에 가른다.
        body: JSON.stringify({ token, cta, mode, ...body }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'failed')
      setDone(true)
    } catch (e) {
      setErr(e.message === 'profile_not_found' ? t.errNotFound : t.errSave)
    }
    setSaving(false)
  }

  // save 가 정의된 뒤에 건다. StrictMode 가 effect 를 두 번 돌려도 ref 로 한 번만 저장한다
  // (두 번 돌면 coldmail_lang_fill 이 두 줄 남는다).
  useEffect(() => {
    if (!valid || !sameAuto || autoFired.current) return
    autoFired.current = true
    save({}, 'confirm')
  }, [])

  if (!valid) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <h1 className="lg-h">{t.badHead}</h1>
        <p className="lg-sub">{t.badSub}</p>
        <a className="lg-btn lg-btn-ghost" href="/jobs">{t.toJobs}</a>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <div className="lg-check">✓</div>
        <h1 className="lg-h">{t.doneHead(name)}</h1>
        {/* '못한다'고 답한 사람에게 "어학 보는 공고에 우선 추천할게요"는 앞뒤가 안 맞는다. */}
        <p className="lg-sub">{cta === 'none' ? t.noneDoneSub : cta === 'same' ? t.sameDoneSub : t.doneSub}</p>
        <a className="lg-btn" href="/jobs">{cta === 'none' ? t.toJobs : t.doneCta}</a>
        {/* '그대로'로 들어왔는데 사실 점수가 있는 사람의 출구 — 프로필까지 안 가도 된다. */}
        {cta === 'same'
          ? <a className="lg-link" href={`/lang?t=${encodeURIComponent(token)}&cta=score&lang=${uiLang}`}>{t.sameNo}</a>
          : <a className="lg-link" href="/profile#language">{t.toProfile}</a>}
      </Shell>
    )
  }

  /* '둘 다 못합니다'로 들어온 사람 — 폼 대신 확인 한 번. 누르면 바로 저장된다.
     '사실은 좀 합니다'를 고르면 평소 폼으로 넘어간다(잘못 누른 사람의 출구). */
  if (noneConfirm) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <h1 className="lg-h">{t.noneHead(name)}</h1>
        <p className="lg-sub">{t.noneSub}</p>
        {err && <p className="lg-err">{err}</p>}
        <button className="lg-btn" onClick={() => save({ english_cert: 'None', korean_cert: 'None' })} disabled={saving}>
          {saving ? t.saving : t.noneYes}
        </button>
        <button className="lg-link lg-linkbtn" onClick={() => setNoneConfirm(false)}>{t.noneNo}</button>
        <p className="lg-fine">{t.fine}</p>
      </Shell>
    )
  }

  /* '그대로입니다'로 들어온 사람 — 뜨자마자 저장된다. 실패했을 때만 버튼이 보인다
     (자바스크립트가 막혀 있거나 네트워크가 끊긴 경우의 유일한 출구). */
  if (sameAuto && !err) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <h1 className="lg-h">{t.sameHead(name)}</h1>
        <p className="lg-sub">{t.sameSub(currentText)}</p>
        <p className="lg-fine">{t.saving}</p>
      </Shell>
    )
  }
  if (sameAuto && err) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <h1 className="lg-h">{t.sameHead(name)}</h1>
        <p className="lg-err">{err}</p>
        <button
          className="lg-btn"
          onClick={() => save({}, 'confirm')}
          disabled={saving}
        >
          {saving ? t.saving : t.sameYes}
        </button>
      </Shell>
    )
  }

  // 수준 버튼으로 들어온 사람에게만 뜨는 한 단계 — 어느 언어였는지만 고른다.
  if (!langPicked) {
    return (
      <Shell t={t} uiLang={uiLang}>
        <h1 className="lg-h">{t.pickHead(name)}</h1>
        <p className="lg-sub">{t.pickSub(cta === 'basic' ? t.choiceBasic : t.choiceDaily)}</p>
        <button className="lg-btn lg-btn-ghost lg-pick" onClick={() => pickLang('en')}>{t.en}</button>
        <button className="lg-btn lg-btn-ghost lg-pick" onClick={() => pickLang('ko')}>{t.ko}</button>
        <button className="lg-link lg-linkbtn" onClick={() => setLangPicked(true)}>{t.selfInput}</button>
      </Shell>
    )
  }

  return (
    <Shell t={t} uiLang={uiLang}>
      <h1 className="lg-h">{t.formHead(name)}</h1>
      <p className="lg-sub">{t.formSub}</p>

      {/* '점수 있어요'로 들어온 사람에게는 '자격증 없음(수준만)'을 안 보여준다 — 방금
          점수가 있다고 답한 사람에게 자기서술 선택지를 내미는 건 모순이고, 이 캠페인이
          고치려는 자기서술 52% 를 그 경로에서 다시 쌓게 된다. */}
      <div className="lg-card">
        <LanguageCard form={form} set={set} lang={uiLang} allowLevelOnly={cta !== 'score'} />
      </div>

      {err && <p className="lg-err">{err}</p>}

      <button className="lg-btn" onClick={() => save()} disabled={!filled || saving}>
        {saving ? t.saving : t.save}
      </button>
      <p className="lg-fine">{t.fine}</p>
    </Shell>
  )
}

function Shell({ children, t, uiLang }) {
  return (
    <>
      <Head>
        <title>{t?.title || T.vi.title}</title>
        <meta name="robots" content="noindex" />
        <html lang={uiLang || 'vi'} />
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