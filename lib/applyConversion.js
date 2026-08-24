/* 지원 성공 전환 신호 — 광고 플랫폼(Meta Pixel · GA4)용 단일 정의.
   POST /api/job-applications 가 200 을 준 뒤에만 호출한다. "지원 버튼 클릭"이 아니라
   "접수 성공"이 전환이다 (Meta 가 자동 감지하는 SubscribedButtonClick 은 클릭이라
   실패·미로그인 이탈까지 섞여 전환으로 쓸 수 없다).

   URL 을 확인 URL(/jobs/applied)로 먼저 바꾸고 이벤트를 쏘는 순서가 중요하다 —
   그래야 이벤트에 실려 나가는 event_source_url 이 /jobs/applied 가 되어
   "URL 에 /jobs/applied 포함" 같은 URL 규칙 기반 전환 설정에도 걸린다.

   확인 URL 은 두 종류다 — 일반 공고는 /jobs/applied, KTC 공고는
   /ktc/jobs/applied/<jobId>. KTC 광고 성과를 URL 규칙으로 따로 떼어 보려는
   광고팀 요청. 이벤트 이름은 양쪽 동일하고 source 파라미터로도 구분된다. */

export const APPLIED_PATH = '/jobs/applied'
// KTC 공고는 광고팀 요청대로 전용 경로 + 공고 id 를 경로에 담는다 —
// "URL 에 /ktc/jobs/applied 포함" 규칙 하나로 KTC 지원만 따로 전환을 잡을 수 있다.
export const KTC_APPLIED_PATH = '/ktc/jobs/applied'

function withParams(path, { title, company, source }) {
  const q = new URLSearchParams()
  if (title) q.set('title', title)
  if (company) q.set('company', company)
  if (source) q.set('source', source)
  const qs = q.toString()
  return qs ? `${path}?${qs}` : path
}

export function appliedUrl({ title, company, source }) {
  return withParams(APPLIED_PATH, { title, company, source })
}

export function ktcAppliedUrl({ jobId, title, company }) {
  return withParams(`${KTC_APPLIED_PATH}/${jobId}`, { title, company, source: 'ktc' })
}

// 픽셀/GA 이벤트만 발사. 페이지 이동으로 끝나는 지원 경로는 이걸 직접 부르지 말고
// appliedUrl() 로 이동할 것 — /jobs/applied 가 마운트 시 같은 이벤트를 쏘므로
// 양쪽에서 다 쏘면 전환이 두 번 잡힌다.
export function fireApplyConversion({ title, company, source }) {
  if (typeof window === 'undefined') return
  const name = title || 'unknown'
  const src = source || 'unknown'
  if (typeof fbq === 'function') {
    fbq('track', 'Lead', { content_name: 'job_apply_confirmed', content_category: name, source: src })
    // 지원 완료 전용 표준 이벤트 병행 발사. 모든 퍼널이 'Lead' 하나를 공유하면 캠페인별 전환이
    // 섞인다 — 연봉 제출도 Lead 라서, 공고 캠페인을 클릭하고 연봉만 제출해도 그 캠페인의 리드로
    // 잡혔다 (실사례: TOPIK 캠페인 Meta 리드 3 vs 실제 지원 0, 2026-08-23). 공고 캠페인은
    // SubmitApplication 으로 최적화 이벤트를 갈아탈 것 — Lead 는 광고 세팅 전환 뒤에 제거.
    fbq('track', 'SubmitApplication', { content_name: name, content_category: company || 'unknown', source: src })
  }
  if (typeof gtag === 'function') {
    gtag('event', 'job_apply_confirmed', {
      event_category: 'conversion',
      event_label: name,
      company: company || 'unknown',
      source: src,
    })
  }
}

/* 모달 안에서 끝나는 지원(화면 이동 없음) — URL 만 확인 URL 로 바꾸고 이벤트를 쏜다.
   같은 모달에서 연속으로 지원할 수 있는 흐름(유사 공고 추천, /cv 완료 모달)이 있어
   두 번째부터는 history 를 쌓지 않고 교체한다. */
export function confirmAppliedInline({ title, company, source }) {
  if (typeof window === 'undefined') return
  const url = appliedUrl({ title, company, source })
  const method = window.location.pathname === APPLIED_PATH ? 'replaceState' : 'pushState'
  try { window.history[method](null, '', url) } catch {}
  fireApplyConversion({ title, company, source })
}