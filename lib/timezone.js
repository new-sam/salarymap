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
