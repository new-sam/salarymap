import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import supabaseAdmin from '../../lib/supabaseAdmin'
import { supabase } from '../../lib/supabaseClient'
import { verifyToken, leadId } from '../../lib/ktcMailToken'
import { track } from '../../lib/track'

// KTC CV 클레임 콜드메일 착지점 — "네 프로필이 이미 만들어져 있다"의 이행 지점.
// /ktc/status 와 같은 이유로 vi 고정(수신자 100% 베트남어권, i18n 키 안 팜 — 머지 유실 이력).
//
// 역할: 로그인 전에 본인 실데이터(이름·대학·직무)를 먼저 보여준다. "진짜 내 거네"를
// 확인시킨 뒤 로그인을 태워야 OAuth 완주(3차 실측 31%)까지 동기가 버틴다.
// 버튼 클릭 = KTC 에 낸 CV 를 FYI 프로필로 옮기는 데 대한 동의(문구로 명시).
//
// 로그인은 서버 OAuth(/api/auth/google)로 태운다 — 클라이언트 signInWithOAuth 를 쓰면
// sign_up 이벤트도, 콜드메일 전환 귀속도, CV 임포트(콜백에서 수행)도 전부 비켜간다
// (기존 /ktc/status 가 정확히 그 함정에 빠져 있었다).
//
// ?done=1 — 가입 콜백이 임포트를 마친 뒤 돌아오는 완료 화면. 등록된 프로필 확인 +
// 맞는 공고 3개 원탭 지원(/cv 완료 모달과 같은 선정 규칙)으로 가입을 지원까지 잇는다.
export default function KtcClaim({ email, name, ten, university, position, yoe, parsed, tokenValid, token }) {
  const router = useRouter()
  const done = router.query.done === '1'

  if (done) return <DoneView />

  if (!tokenValid) {
    return (
      <div className="kc-wrap">
        <div className="kc-card kc-center">
          <p className="kc-lead">Liên kết không hợp lệ hoặc đã hết hạn.</p>
          <a className="kc-btn" href="/jobs">Xem tin tuyển dụng</a>
        </div>
        <style jsx global>{css}</style>
      </div>
    )
  }

  const login = () => {
    track('ktc_claim_login_click', { page: '/ktc/claim', meta: { lead: leadId(email) } })
    // 완료 화면에서도 토큰을 유지 — 세션이 늦게 붙는 엣지에서 카드라도 띄울 수 있게.
    const ret = `/ktc/claim?done=1&t=${encodeURIComponent(token)}`
    window.location.href = `/api/auth/google?return=${encodeURIComponent(ret)}&login_hint=${encodeURIComponent(email)}`
  }

  const yoeNum = parseFloat(yoe)
  return (
    <>
      <Head>
        <title>Hồ sơ của bạn đã sẵn sàng | FYI</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="kc-wrap">
        <div className="kc-card">
          <div className="kc-brand">FYI<span>Nền tảng tuyển dụng do K-Tech College xây dựng</span></div>

          <h1 className="kc-h1">
            {ten ? `${ten} ơi, ` : ''}hồ sơ của bạn <b>đã sẵn sàng</b>
          </h1>

          <p className="kc-lead">
            Với CV bạn đã nộp qua <b>K-Tech College</b>, chúng tôi đã chuẩn bị sẵn hồ sơ FYI cho bạn.
          </p>

          {parsed ? (
            // 사전 파싱된 리치 카드 — "CV가 이렇게 정리돼 있구나"가 이 페이지의 와우 포인트.
            // 학력·경력·스킬은 CV 원문 표기 그대로(영/베트남어)라 번역 없이 노출한다.
            <div className="kc-profile">
              <div className="kc-profile-tag">HỒ SƠ FYI CỦA BẠN</div>
              <div className="kc-profile-name">{parsed.full_name || name || ten}</div>
              {parsed.headline ? <div className="kc-profile-headline">{parsed.headline}</div> : null}
              {(parsed.university || university) ? (
                <div className="kc-profile-sec">
                  <div className="kc-profile-sec-label">Học vấn</div>
                  <div className="kc-profile-row">
                    🎓 {parsed.university || university}
                    {parsed.major ? ` — ${parsed.major}` : ''}
                    {parsed.graduation_year ? ` (${parsed.graduation_year})` : ''}
                  </div>
                </div>
              ) : null}
              {(parsed.experiences || []).length > 0 && (
                <div className="kc-profile-sec">
                  <div className="kc-profile-sec-label">Kinh nghiệm</div>
                  {/* 파서가 최신순을 항상 지키진 않는다 — 진행중(Present) 우선, 종료일 내림차순으로 재정렬 */}
                  {[...(parsed.experiences || [])].sort((a, b) => {
                    const key = (e) => /present/i.test(e.end || '') ? '9999' : (e.end || e.start || '')
                    return key(b).localeCompare(key(a))
                  }).slice(0, 3).map((ex, idx) => (
                    <div className="kc-profile-row" key={idx}>
                      💼 {ex.title}{ex.company ? ` @ ${ex.company}` : ''}
                      {ex.start ? <span className="kc-profile-dim"> · {ex.start}–{ex.end || ''}</span> : null}
                    </div>
                  ))}
                </div>
              )}
              {(parsed.skills || []).length > 0 && (
                <div className="kc-profile-sec">
                  <div className="kc-profile-sec-label">Kỹ năng</div>
                  <div className="kc-chips">
                    {(parsed.skills || []).slice(0, 8).map(s => <span className="kc-chip" key={s}>{s}</span>)}
                  </div>
                </div>
              )}
              <div className="kc-profile-note">
                ✓ Được tạo từ CV bạn đã nộp qua K-Tech College<br />
                ✓ <b>Sẵn sàng ứng tuyển chỉ với một chạm</b> — không cần đăng ký lại
              </div>
            </div>
          ) : (
            // 파싱 실패(스캔 PDF 등) 리드 폴백 — 시트 데이터 기본 카드
            <div className="kc-profile">
              <div className="kc-profile-tag">HỒ SƠ FYI CỦA BẠN</div>
              <div className="kc-profile-name">{name || ten}</div>
              {university ? <div className="kc-profile-row">🎓 {university}</div> : null}
              <div className="kc-profile-row">
                💼 {position}{Number.isFinite(yoeNum) && yoeNum >= 1 ? ` · ${yoeNum} năm kinh nghiệm` : ''}
              </div>
              <div className="kc-profile-note">✓ Được tạo từ CV bạn đã nộp qua K-Tech College</div>
            </div>
          )}

          <ul className="kc-points">
            <li>Đăng nhập <b>một lần</b> — CV được đăng ký tự động, không cần viết lại</li>
            <li>Ứng tuyển các vị trí mới <b>chỉ với một chạm</b></li>
            <li>Có vị trí phù hợp, hồ sơ được <b>gửi trực tiếp đến nhà tuyển dụng</b> — bạn nhận liên hệ qua email</li>
          </ul>

          <button className="kc-btn kc-btn-lg" onClick={login}>
            Đăng nhập Google và nhận hồ sơ →
          </button>
          <p className="kc-hint">
            Khi nhấn nút, CV bạn đã nộp cho K-Tech College sẽ được đăng ký vào hồ sơ FYI của bạn và
            hiển thị với nhà tuyển dụng.<br />Đăng nhập bằng <b>{email}</b> — email bạn đã dùng để ứng tuyển.
          </p>
        </div>
        <style jsx global>{css}</style>
      </div>
    </>
  )
}

// 완료 화면 — 임포트는 가입 콜백(서버)이 이미 끝냈다. 여기선 결과 확인 + 원탭 지원.
function DoneView() {
  const [resumeUrl, setResumeUrl] = useState(undefined) // undefined=확인중, null=없음
  const [jobs, setJobs] = useState([])
  const [applied, setApplied] = useState({})
  const [applyingId, setApplyingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session?.user?.id) { setResumeUrl(null); return }
      const { data } = await supabase.from('user_profiles')
        .select('resume_url').eq('id', session.user.id).maybeSingle()
      if (cancelled) return
      setResumeUrl(data?.resume_url || null)
      track('ktc_claim_done', { page: '/ktc/claim', meta: { imported: !!data?.resume_url } })
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    fetch('/api/jobs?counts=1')
      .then(r => r.json())
      .then(arr => setJobs(Array.isArray(arr) ? arr : (arr.jobs || [])))
      .catch(() => {})
  }, [])

  // /cv 완료 모달과 같은 선정 규칙 — ATS(기업 직접등록) 우선 → 누적 지원 수 → 회사당 1개.
  const top3 = useMemo(() => {
    const seenCompany = new Set()
    return jobs
      .filter(j => j.is_active !== false)
      .sort((a, b) => (a.source === 'company_self' ? 0 : 1) - (b.source === 'company_self' ? 0 : 1)
        || (b.application_count || 0) - (a.application_count || 0))
      .filter(j => { if (seenCompany.has(j.company)) return false; seenCompany.add(j.company); return true })
      .slice(0, 3)
  }, [jobs])

  const apply = async (job) => {
    if (applied[job.id] || applyingId) return
    setApplyingId(job.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('no_session')
      // 프로필 조회가 늦게 끝난 상태에서 눌렀을 수 있다 — 지원 레코드에 이력서가 비지 않게 재조회(cv.js와 동일).
      let ru = resumeUrl
      if (!ru) {
        const { data } = await supabase.from('user_profiles').select('resume_url').eq('id', session.user.id).maybeSingle()
        ru = data?.resume_url || null
      }
      const res = await fetch('/api/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ jobId: job.id, jobTitle: job.title, jobCompany: job.company, resumeUrl: ru, applicationSource: 'ktc_claim' }),
      })
      if (!res.ok) throw new Error('apply_failed')
      setApplied(a => ({ ...a, [job.id]: true }))
      track('submit_application', { meta: { job_id: job.id, source: 'ktc_claim' }, page: '/ktc/claim' })
    } catch {} finally {
      setApplyingId(null)
    }
  }

  return (
    <>
      <Head>
        <title>Hồ sơ đã được đăng ký | FYI</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="kc-wrap">
        <div className="kc-card">
          <div className="kc-brand">FYI<span>Nền tảng tuyển dụng do K-Tech College xây dựng</span></div>

          {resumeUrl === null ? (
            // 세션이 없거나 임포트가 안 된 엣지 — 약속을 못 지킨 상태로 두지 않고 /cv 로 잇는다.
            <>
              <h1 className="kc-h1">Chỉ còn <b>một bước nữa</b></h1>
              <p className="kc-lead">Chưa tìm thấy CV trong tài khoản của bạn. Đăng ký CV chỉ mất 1 phút.</p>
              <a className="kc-btn kc-btn-lg" href="/cv">Đăng ký CV →</a>
            </>
          ) : (
            <>
              <h1 className="kc-h1">Hồ sơ của bạn <b>đã được đăng ký</b> ✓</h1>
              <p className="kc-lead">
                Từ giờ bạn có thể ứng tuyển chỉ với một chạm. Khi có vị trí phù hợp,
                chúng tôi sẽ gửi hồ sơ của bạn đến nhà tuyển dụng và liên hệ qua email.
              </p>

              {top3.length > 0 && (
                <div className="kc-jobs">
                  <div className="kc-jobs-title">Ứng tuyển ngay với hồ sơ vừa đăng ký</div>
                  {top3.map(job => (
                    <div className="kc-job" key={job.id}>
                      <div className="kc-job-info">
                        <div className="kc-job-title">{job.title}</div>
                        <div className="kc-job-company">{job.company}</div>
                      </div>
                      <button
                        className={`kc-job-btn${applied[job.id] ? ' on' : ''}`}
                        onClick={() => apply(job)}
                        disabled={!!applied[job.id] || !!applyingId}
                      >
                        {applied[job.id] ? '✓ Đã nộp' : applyingId === job.id ? '...' : 'Ứng tuyển'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <a className="kc-more" href="/jobs">Xem tất cả việc làm →</a>
            </>
          )}
        </div>
        <style jsx global>{css}</style>
      </div>
    </>
  )
}

const css = `
  body { margin: 0; background: #f2f4f6; }
  .kc-wrap { min-height: 100vh; padding: 24px 16px 48px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #191F28; }
  .kc-card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #E5E8EB; border-radius: 16px; padding: 28px 24px 32px; }
  .kc-center { text-align: center; }
  .kc-brand { font-size: 20px; font-weight: 900; color: #ff4400; letter-spacing: -.5px; padding-bottom: 18px; border-bottom: 1px solid #F2F4F6; margin-bottom: 22px; }
  .kc-brand span { display: block; font-size: 11px; font-weight: 700; color: #8B95A1; letter-spacing: .3px; margin-top: 4px; }
  .kc-h1 { margin: 0 0 14px; font-size: 23px; line-height: 1.4; font-weight: 800; letter-spacing: -.4px; }
  .kc-h1 b { color: #ff4400; }
  .kc-lead { margin: 0 0 22px; font-size: 14px; line-height: 1.75; color: #4E5968; }
  .kc-lead b { color: #191F28; }
  .kc-profile { border: 1px solid #FFD9C7; background: #FFF7F3; border-radius: 12px; padding: 18px 20px; margin-bottom: 22px; }
  .kc-profile-tag { font-size: 11px; font-weight: 800; color: #ff4400; letter-spacing: .6px; margin-bottom: 8px; }
  .kc-profile-name { font-size: 18px; font-weight: 800; letter-spacing: -.2px; margin-bottom: 8px; }
  .kc-profile-headline { font-size: 13px; font-weight: 700; color: #ff4400; margin: -4px 0 8px; }
  .kc-profile-sec { margin-top: 12px; }
  .kc-profile-sec-label { font-size: 11px; font-weight: 800; color: #8B95A1; letter-spacing: .4px; text-transform: uppercase; margin-bottom: 4px; }
  .kc-profile-dim { color: #8B95A1; font-size: 12px; }
  .kc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .kc-chip { font-size: 12px; font-weight: 700; color: #4E5968; background: #fff; border: 1px solid #FFD9C7; border-radius: 999px; padding: 4px 10px; }
  .kc-profile-row { font-size: 14px; color: #4E5968; line-height: 1.7; }
  .kc-profile-note { font-size: 12px; color: #8B95A1; border-top: 1px solid #FFE4D6; margin-top: 12px; padding-top: 10px; line-height: 1.5; }
  .kc-points { margin: 0 0 24px; padding: 0 0 0 18px; }
  .kc-points li { font-size: 13.5px; line-height: 1.7; color: #4E5968; margin-bottom: 8px; }
  .kc-points b { color: #191F28; }
  .kc-btn { display: inline-block; background: #ff4400; color: #fff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 26px; border: 0; border-radius: 12px; cursor: pointer; }
  .kc-btn-lg { display: block; width: 100%; font-size: 16px; padding: 16px; text-align: center; box-sizing: border-box; }
  .kc-hint { margin: 12px 0 0; font-size: 12px; color: #8B95A1; text-align: center; line-height: 1.6; }
  .kc-hint b { color: #4E5968; word-break: break-all; }
  .kc-jobs { border: 1px solid #E5E8EB; border-radius: 12px; padding: 6px 16px; margin-bottom: 18px; }
  .kc-jobs-title { font-size: 13px; font-weight: 800; color: #191F28; padding: 12px 0 4px; }
  .kc-job { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid #F2F4F6; }
  .kc-job:first-of-type { border-top: 0; }
  .kc-job-info { flex: 1; min-width: 0; }
  .kc-job-title { font-size: 14px; font-weight: 700; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .kc-job-company { font-size: 12px; color: #8B95A1; margin-top: 2px; }
  .kc-job-btn { flex-shrink: 0; background: #ff4400; color: #fff; font-size: 13px; font-weight: 800; border: 0; border-radius: 10px; padding: 10px 14px; cursor: pointer; }
  .kc-job-btn:disabled { opacity: .55; cursor: default; }
  .kc-job-btn.on { background: #0d9488; opacity: 1; }
  .kc-more { display: block; text-align: center; font-size: 14px; font-weight: 700; color: #ff4400; text-decoration: none; margin-top: 4px; }
`

// "TRƯƠNG ĐỨC NHẬT TÂY" → "Tây" — 발송 스크립트의 호칭(tên) 규칙과 동일하게 마지막 어절.
function tenOf(fullName) {
  const last = String(fullName || '').trim().split(/\s+/).pop() || ''
  if (!last) return ''
  return last.charAt(0).toLocaleUpperCase('vi') + last.slice(1).toLocaleLowerCase('vi')
}

export async function getServerSideProps({ query }) {
  const tok = verifyToken(query.t)
  if (!tok) return { props: { tokenValid: false, email: '', name: '', ten: '', university: '', position: '', yoe: '', parsed: null, token: '' } }

  // 카드 소스 둘: 사전 파싱된 리치 프로필(ktc_claim_profiles, 발송 전 배치 파싱) 우선,
  // 없으면(스캔 PDF 등 파싱 실패 ~5%) 시트 미러(ktc_candidates) 기본 카드로 폴백.
  // 한 사람이 여러 건 지원했을 수 있어 미러는 최신 지원 행 기준(발송 스크립트와 동일 규칙).
  const [{ data }, { data: claim }] = await Promise.all([
    supabaseAdmin
      .from('ktc_candidates')
      .select('full_name, university, position, yoe')
      .eq('email', tok.email)
      .order('applied_at', { ascending: false })
      .limit(1),
    supabaseAdmin
      .from('ktc_claim_profiles')
      .select('summary')
      .eq('email', tok.email)
      .maybeSingle(),
  ])
  const c = data?.[0] || {}

  return {
    props: {
      tokenValid: true,
      token: query.t,
      email: tok.email,
      name: c.full_name || '',
      ten: tenOf(c.full_name),
      university: c.university || '',
      position: c.position || '',
      yoe: c.yoe || '',
      parsed: claim?.summary || null,
    },
  }
}
