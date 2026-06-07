// ICT (Indochina Time, UTC+7). 인터뷰 일정은 사용자(채용 담당자)·후보자 위치와 무관하게
// 항상 베트남 시간 기준으로 통일 표시한다.

export const ICT_TZ = 'Asia/Ho_Chi_Minh';
export const ICT_LABEL = '(ICT)';

// UTC ISO 문자열 → ICT 기준 사람용 문자열
export function formatICT(utcIso, options = {}) {
  if (!utcIso) return '';
  return new Date(utcIso).toLocaleString(undefined, {
    timeZone: ICT_TZ,
    ...options,
  });
}

// ATS-wide short interview format: "6/14 14:00 (ICT)" — locale-independent.
// Use this everywhere a single-line interview datetime is shown so the look
// is consistent across the kanban, candidate header, timeline, and modals.
export function formatInterviewShort(utcIso, { withZone = true } = {}) {
  if (!utcIso) return '';
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ICT_TZ,
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcIso));
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  // strip leading zero from month/day for the short look
  const m = String(Number(get('month')));
  const d = String(Number(get('day')));
  const base = `${m}/${d} ${get('hour')}:${get('minute')}`;
  return withZone ? `${base} ${ICT_LABEL}` : base;
}

// Local timezone short datetime: "6/4 14:00" — for mail logs / generic timeline.
export function formatLocalShort(utcIso) {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}

// Local timezone short date only: "6/4" — for "applied N days ago" pills etc.
export function formatLocalShortDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ICT 기준 시간만
export function formatICTTime(utcIso) {
  if (!utcIso) return '';
  return new Date(utcIso).toLocaleTimeString(undefined, {
    timeZone: ICT_TZ,
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// 사용자가 input[type=date]/[type=time]에 입력한 ICT 시각을 UTC ISO로 저장
export function ictInputToUtc(date, time) {
  if (!date) return null;
  // date "YYYY-MM-DD", time "HH:MM" 형태. ICT(+07:00)로 해석 후 ISO.
  return new Date(`${date}T${time || '00:00'}:00+07:00`).toISOString();
}

// UTC ISO → ICT 기준 input 채움용 {date, time}
export function utcToIctInput(utcIso) {
  if (!utcIso) return { date: '', time: '14:00' };
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ICT_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcIso));
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}
