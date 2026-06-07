// Korean particle (조사) selector based on the final consonant (받침) of the
// previous syllable. Falls back gracefully for non-Korean strings.
export function hasFinalConsonant(str) {
  if (!str) return false;
  const ch = str.charCodeAt(str.length - 1);
  if (ch < 0xAC00 || ch > 0xD7A3) return false; // not a Hangul syllable block char
  return (ch - 0xAC00) % 28 !== 0;
}

/**
 * josa('남영훈', '이', '가') → '이'   (남영훈 → 받침 ㄴ)
 * josa('위승주', '이', '가') → '가'   (주 → 받침 없음)
 * josa('관리자', '이', '가') → '가'
 */
export function josa(word, withFinal, withoutFinal) {
  return hasFinalConsonant(word) ? withFinal : withoutFinal;
}

// Common particle helpers
export const ka = (word) => josa(word, '이', '가');
export const eun = (word) => josa(word, '은', '는');
export const eul = (word) => josa(word, '을', '를');
export const ro  = (word) => josa(word, '으로', '로');
export const gwa = (word) => josa(word, '과', '와');
