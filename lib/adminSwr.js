import useSWR, { preload } from 'swr'

// Shared SWR fetcher for admin endpoints. The cache key is [url, token] so
// responses are cached per token and survive tab switches / page navigation —
// re-mounting a view shows cached data instantly and revalidates in the
// background instead of refetching from scratch every time.
const fetcher = async ([url, token]) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return res.json()
}

const DEFAULTS = {
  revalidateOnFocus: false, // 탭 포커스마다 재요청 방지
  keepPreviousData: true,   // 날짜 범위 변경 시 이전 데이터 유지(깜빡임 제거)
  dedupingInterval: 30000,  // 30초 내 같은 키 중복요청 합치기
}

// useAdmin(url, token, options) → { data, error, isLoading, mutate, isValidating }
// token 또는 url 이 없으면 요청을 보내지 않는다(인증 전 대기).
export function useAdmin(url, token, options) {
  return useSWR(url && token ? [url, token] : null, fetcher, { ...DEFAULTS, ...options })
}

// 백그라운드 프리페치 — 다른 탭의 데이터를 미리 캐시에 채워 첫 진입을 즉시화한다.
// useAdmin 과 동일한 [url, token] 키 + 동일 fetcher 를 써야 캐시에 적중한다.
export function prefetchAdmin(url, token) {
  if (!url || !token) return
  preload([url, token], fetcher)
}
