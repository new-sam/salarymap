import supabaseAdmin from '../../../lib/supabaseAdmin'
import { verifyToken, leadId } from '../../../lib/ktcMailToken'

// 어학 콜드메일 착지 페이지(/lang)의 저장 엔드포인트 — 로그인 없이 동작한다.
//
// 인증은 세션이 아니라 메일 링크의 HMAC 토큰이다. 콜드메일 수신자에게 로그인을 요구하면
// 뎁스가 한 단계 늘고 거기서 대부분 빠진다(그게 이 페이지를 만든 이유다).
//
// 그래서 권한을 최소로 묶는다:
//   · 토큰에 든 이메일의 프로필 1건만 수정한다
//   · english_cert / korean_cert 두 칼럼만 쓴다 — 다른 필드는 건드릴 수 없다
//   · 읽어서 돌려주는 것도 없다(응답에 프로필 데이터를 싣지 않는다)
// 링크가 유출돼도 남이 할 수 있는 건 그 사람의 어학 칸을 바꾸는 것뿐이다.

const CERT_TO_FIELD = {
  TOEIC: 'english_cert', IELTS: 'english_cert', TOEFL: 'english_cert',
  VSTEP: 'english_cert', APTIS: 'english_cert', TOPIK: 'korean_cert',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, english_cert: en, korean_cert: ko, cta, mode } = req.body || {}
  const claim = verifyToken(token)
  if (!claim?.email) return res.status(401).json({ error: 'invalid_token' })

  /* mode='confirm' — 5차 재확인('그대로입니다')의 저장. 프로필은 건드리지 않는다:
     바뀐 값이 없는데 update 를 때리면 updated_at 만 밀려서, 나중에 "언제 어학을 넣었나"를
     볼 때 오늘 넣은 것처럼 보인다.
     이벤트도 coldmail_lang_fill 이 아니라 별도 이름을 쓴다 — '그대로'는 새로 받아낸
     입력이 아니라 기존 값의 확인이라, 같은 칸에 세면 전환율이 부풀어 오른다. */
  if (mode === 'confirm') {
    const { data: p, error } = await supabaseAdmin
      .from('user_profiles').select('id, english_cert, korean_cert').ilike('email', claim.email).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!p) return res.status(404).json({ error: 'profile_not_found' })

    const { error: logErr } = await supabaseAdmin.from('coldmail_lang_responses').insert({
      user_id: p.id,
      campaign: claim.campaign || null,
      cta: typeof cta === 'string' ? cta.slice(0, 20) : null,
      english_cert: p.english_cert ?? null,   // 확인 시점의 값을 그대로 박아둔다
      korean_cert: p.korean_cert ?? null,
      source: 'lang-confirm',
    })
    if (logErr) console.error('coldmail_lang_responses insert failed:', logErr.message)

    await supabaseAdmin.from('events').insert({
      event: 'coldmail_lang_same',
      user_id: p.id,
      meta: { campaign: claim.campaign, lead: leadId(claim.email) },
    })
    return res.status(200).json({ ok: true, confirmed: true })
  }

  // 한 줄 텍스트 포맷은 LanguageCard 와 동일하게 유지한다("TOEIC 900").
  // 여기서 다른 포맷으로 저장하면 프로필 화면이 그 값을 칩으로 못 쪼갠다.
  const clean = (v) => String(v || '').trim().slice(0, 120)
  const patch = {}
  if (en !== undefined) patch.english_cert = clean(en) || null
  if (ko !== undefined) patch.korean_cert = clean(ko) || null
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing_to_save' })
  if (!patch.english_cert && !patch.korean_cert) return res.status(400).json({ error: 'empty' })

  const { data: prof, error: findErr } = await supabaseAdmin
    .from('user_profiles').select('id').ilike('email', claim.email).maybeSingle()
  if (findErr) return res.status(500).json({ error: findErr.message })
  if (!prof) return res.status(404).json({ error: 'profile_not_found' })

  const { error: upErr } = await supabaseAdmin
    .from('user_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', prof.id)
  if (upErr) return res.status(500).json({ error: upErr.message })

  /* 저장한 값을 그대로 남긴다.

     user_profiles 는 이력서 재파싱이 덮어쓴다 — 2026-08-05 에 실제로 그렇게 21명의
     응답이 지워졌고, 값이 어디에도 안 남아 있어 대부분 복구하지 못했다. 대시보드가
     프로필을 다시 읽는 구조라 과거 목록까지 소급해 바뀌었다.
     이 표는 그 시점의 값을 박아두는 append-only 로그라 나중에 무엇이 덮어도 안 변한다.

     실패해도 저장 자체는 성공으로 돌린다 — 프로필에는 이미 값이 들어갔고, 기록이 없다고
     사용자에게 에러를 보여줄 이유가 없다. */
  const { error: logErr } = await supabaseAdmin.from('coldmail_lang_responses').insert({
    user_id: prof.id,
    campaign: claim.campaign || null,
    cta: typeof cta === 'string' ? cta.slice(0, 20) : null,
    english_cert: patch.english_cert ?? null,
    korean_cert: patch.korean_cert ?? null,
    source: 'lang',
  })
  // supabase-js 는 throw 하지 않고 error 를 돌려준다 — try/catch 로는 못 잡는다.
  if (logErr) console.error('coldmail_lang_responses insert failed:', logErr.message)

  /* 전환 이벤트. user_id 를 같이 남겨 유진 작업실 표가 사람 수로 셀 수 있게 한다.

     cta 를 같이 싣는다 — coldmail_lang_responses 에는 있는데 events 에는 없어서,
     "어느 버튼으로 들어온 사람이 저장했나"를 표에서 가를 수 없었다. 재확인 회차는
     그 구분이 곧 결론이다(점수 갱신 vs 그대로 확인).
     saved 는 실제로 자격증 형태가 들어왔는지다. cta=score 를 눌러놓고 "Basic" 을
     저장한 사람이 실제로 있었다 — 버튼만 세면 그 사람이 점수를 낸 걸로 잡힌다. */
  const isCert = (v) => /^(TOEIC|IELTS|TOEFL|VSTEP|APTIS|TOPIK|CEFR)\b/i.test(String(v || '').trim())
  await supabaseAdmin.from('events').insert({
    event: 'coldmail_lang_fill',
    user_id: prof.id,
    meta: {
      campaign: claim.campaign,
      lead: leadId(claim.email),
      cta: typeof cta === 'string' ? cta.slice(0, 20) : null,
      saved: isCert(patch.english_cert) || isCert(patch.korean_cert) ? 'cert' : 'level',
    },
  })

  return res.status(200).json({ ok: true })
}