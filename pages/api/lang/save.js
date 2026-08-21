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
  VSTEP: 'english_cert', APTIS: 'english_cert', OPIC: 'english_cert', TOPIK: 'korean_cert',
}

/* mode='attach' 가 붙일 수 있는 시험. 맨 등급값("B2")에 시험명만 얹는 경로다.

   왜 CEFR 을 안 넣는가: CEFR 은 시험이 아니라 척도다. 아무도 CEFR 을 응시하지 않고,
   VSTEP·APTIS 가 성적을 CEFR 등급으로 발급할 뿐이다. 실제로 시험명이 확인된 값 중
   CEFR 척도로 발급되는 100건은 VSTEP 59 · APTIS 39 · CEFR 2 였다.
   "CEFR 맞나요"로 물으면 시험을 안 본 사람도 정직하게 '예'라고 답할 수 있어
   (본인은 정말 CEFR 척도를 뜻했으므로) 자기서술이 급수로 세탁된다. 그래서 묻는 말이
   척도가 아니라 시험명이어야 하고, 붙일 수 있는 것도 실재하는 시험뿐이다. */
const ATTACH_CERT = { vstep: 'VSTEP', aptis: 'APTIS' }
const BARE_LEVEL = /^[A-C][12]$/i

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

    // cta 를 같이 싣는다 — 이 경로로 들어오는 버튼이 둘이다(5차 'same' / 7차 'self').
    // 뜻이 다르므로(아직 시험 안 봤다 vs 이 값은 시험이 아니다) 이벤트만 보고 갈라야 한다.
    await supabaseAdmin.from('events').insert({
      event: 'coldmail_lang_same',
      user_id: p.id,
      meta: {
        campaign: claim.campaign,
        lead: leadId(claim.email),
        cta: typeof cta === 'string' ? cta.slice(0, 20) : null,
      },
    })
    return res.status(200).json({ ok: true, confirmed: true })
  }

  /* mode='attach' — 7차('어느 시험이었나요') 원탭 확정. 맨 등급값에 시험명만 붙인다.

     값을 클라이언트에서 받지 않는다. 받으면 링크가 유출됐을 때 남이 아무 등급이나 심을
     수 있고, 본인이 B1 을 C1 로 올려 보내는 것도 못 막는다. 서버가 저장된 등급을 읽어
     그대로 쓰고 앞에 시험명만 얹으므로, 이 경로로는 급수가 오르지도 내리지도 않는다.
     바뀌는 건 "확인 가능한 시험명이 붙었다" 하나뿐이다 — VSTEP·APTIS·CEFR 는 급수표가
     같아서(langTier.GRADES) 이름이 달라져도 급수는 동일하다. */
  if (mode === 'attach') {
    const cert = ATTACH_CERT[String(cta || '').toLowerCase()]
    if (!cert) return res.status(400).json({ error: 'bad_cta' })

    const { data: p, error } = await supabaseAdmin
      .from('user_profiles').select('id, english_cert').ilike('email', claim.email).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!p) return res.status(404).json({ error: 'profile_not_found' })

    /* 맨 등급값일 때만 붙인다. 이미 다른 시험명이 있거나("DELF B1") 범위값("B2–C1")이면
       덮는 순간 원문이 사라진다 — 그런 값은 폼으로 보내 본인이 고르게 해야 한다.
       발송 대상을 맨 등급값으로 좁혀 뽑지만, 메일을 받은 뒤 프로필에서 값을 고치고
       나서 버튼을 누를 수 있으므로 저장 직전에 다시 본다. */
    const lv = String(p.english_cert || '').trim()
    if (!BARE_LEVEL.test(lv)) return res.status(409).json({ error: 'not_bare_level' })

    const value = `${cert} ${lv.toUpperCase()}`
    const { error: upErr } = await supabaseAdmin
      .from('user_profiles')
      .update({ english_cert: value, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    if (upErr) return res.status(500).json({ error: upErr.message })

    const { error: logErr } = await supabaseAdmin.from('coldmail_lang_responses').insert({
      user_id: p.id,
      campaign: claim.campaign || null,
      cta: typeof cta === 'string' ? cta.slice(0, 20) : null,
      english_cert: value,
      korean_cert: null,
      source: 'lang-attach',
    })
    if (logErr) console.error('coldmail_lang_responses insert failed:', logErr.message)

    await supabaseAdmin.from('events').insert({
      event: 'coldmail_lang_fill',
      user_id: p.id,
      meta: {
        campaign: claim.campaign,
        lead: leadId(claim.email),
        cta: typeof cta === 'string' ? cta.slice(0, 20) : null,
        saved: 'cert',
        // 붙이기 전 값. 나중에 "무엇이 무엇으로 바뀌었나"를 이벤트만 보고 복원할 수 있다.
        from: lv.toUpperCase(),
      },
    })
    return res.status(200).json({ ok: true, attached: value })
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
  const isCert = (v) => /^(TOEIC|IELTS|TOEFL|VSTEP|APTIS|TOPIK|CEFR|OPIC)\b/i.test(String(v || '').trim())
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