import { track } from '../../lib/track';

/* /ktc 계측 공용 — 히어로 CTA 가 실제로 공고까지 보내는지 재기 위한 최소 세트.
   기존에 /ktc* 에서 찍히던 이벤트는 session_start(세션당 1회) 와 submit_application
   뿐이라, 랜딩 안에서 무슨 일이 일어나는지가 통째로 안 보였다.

   도달 경로(via)는 Hero / KtcNav / JobBoard 세 컴포넌트에 흩어져 있어 props 로
   내리면 KtcNav → index → JobBoard 로 우회해야 한다. 페이지당 하나뿐인 값이라
   모듈 스코프에 둔다(라우트 이동 시 resetVia 로 초기화). */
let via = 'scroll';

export const setVia = (v) => { via = v; };
export const getVia = () => via;
export const resetVia = () => { via = 'scroll'; };

export const trackKtc = (event, meta = {}) => track(event, { meta, page: '/ktc' });