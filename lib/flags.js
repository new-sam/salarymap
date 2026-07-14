import { useState, useEffect } from 'react';

// 실험 런타임 플래그 (app_flags 테이블) — 원클릭 롤백용.
// 재배포 없이 어드민 토글로 즉시 on/off. 테이블/행이 없으면 기본 ON(실험 진행).
export const FLAG_DEFAULTS = { hero_wizard: true, hard_gate: true, one_tap: true };

let cache = null;
let inflight = null;

export function useFlags() {
  const [state, setState] = useState(() => ({ flags: cache || FLAG_DEFAULTS, loaded: !!cache }));

  useEffect(() => {
    if (cache) return;
    if (!inflight) {
      inflight = fetch('/api/flags')
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    }
    let alive = true;
    inflight.then((f) => {
      cache = { ...FLAG_DEFAULTS, ...f };
      if (alive) setState({ flags: cache, loaded: true });
    });
    return () => { alive = false; };
  }, []);

  return state;
}
