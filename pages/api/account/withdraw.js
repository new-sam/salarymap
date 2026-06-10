import { createClient } from '@supabase/supabase-js'

// 회원 탈퇴. 모바일 settings → 탈퇴 화면에서 호출.
// service_role로 Bearer 토큰의 user.id를 검증한 뒤:
//   1) account_withdrawals에 사유 적재(이메일 스냅샷 포함)
//   2) 익명 연봉 제보(submissions)는 보존하되 개인 식별자만 제거(user_id/email → null)
//   3) FK cascade가 보장되지 않는 개인정보 테이블을 명시적으로 삭제
//      - user_profiles: 대시보드 생성이라 auth.users→cascade가 보장되지 않음(이름·사진·이력서·인증회사명 보유)
//      - job_bookmarks: FK 자체가 없어 cascade로 안 지워짐
//      - push_tokens: 안 지우면 탈퇴한 기기로 푸시가 계속 발송됨
//   4) auth.users 행 삭제 → 커뮤니티 글/댓글/좋아요·배지·인증·동의 등 cascade FK는 함께 정리
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

const REASONS = [
  'no_longer_use',
  'found_job',
  'privacy',
  'too_many_notifications',
  'not_useful',
  'bug',
  'other',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { reason, detail, platform, app_version } = req.body || {}
  if (!REASONS.includes(reason)) {
    return res.status(400).json({ error: 'invalid_reason', message: '탈퇴 사유가 올바르지 않습니다.' })
  }

  // 1) 사유 적재 — 계정 삭제 전에 먼저 남긴다(삭제되면 토큰이 무효라 이후 호출 불가).
  const { error: logErr } = await supabase.from('account_withdrawals').insert({
    user_id: user.id,
    email: user.email || null,
    reason,
    detail: typeof detail === 'string' && detail.trim() ? detail.trim().slice(0, 1000) : null,
    platform: platform || null,
    app_version: app_version || null,
  })
  if (logErr) return res.status(500).json({ error: logErr.message })

  // 2) 익명 연봉 제보는 집계 가치가 있어 보존 — 개인 식별 컬럼만 비운다(GDPR식 익명화).
  //    submissions에 cascade FK가 걸려 있어도, 미리 user_id를 끊어두면 삭제에 휩쓸리지 않는다.
  await supabase.from('submissions').update({ user_id: null, email: null }).eq('user_id', user.id)

  // 3) cascade가 보장되지 않는 개인정보를 직접 삭제한다(계정 삭제 전에).
  //    user_profiles는 PK가 id(=auth user id), 나머지는 user_id 컬럼.
  const { error: profileErr } = await supabase.from('user_profiles').delete().eq('id', user.id)
  if (profileErr) return res.status(500).json({ error: profileErr.message })
  // bookmarks/push_tokens 정리는 베스트 에포트 — 실패해도 계정 삭제 자체는 막지 않는다.
  await supabase.from('job_bookmarks').delete().eq('user_id', user.id)
  await supabase.from('push_tokens').delete().eq('user_id', user.id)
  // company_email_verifications: cascade에만 맡기면 행이 남아 같은 회사 이메일로 재인증이
  //   '이미 다른 계정에서 인증된 이메일'로 막힌다(send-code.js의 email_taken 체크). 명시적으로 지운다.
  await supabase.from('company_email_verifications').delete().eq('user_id', user.id)

  // 4) 계정 본체 삭제. 커뮤니티/배지/인증/동의 등 user_id FK는 on delete cascade로 함께 정리됨.
  const { error: delErr } = await supabase.auth.admin.deleteUser(user.id)
  if (delErr) return res.status(500).json({ error: delErr.message })

  return res.status(200).json({ ok: true })
}
