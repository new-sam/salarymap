// Expo 푸시 발송 헬퍼 — 모바일 앱(salary-fyi)이 등록한 토큰으로 알림을 보낸다.
// 토큰/선호는 push_tokens 테이블(user_id, expo_push_token, locale, prefs jsonb, enabled).
// 카테고리별 선호(prefs[category] !== false)와 enabled를 서버에서 필터링한 뒤 전송한다.
// 다국어: title/body에 문자열 대신 { vi, ko, en } 맵을 넘기면 토큰의 locale에 맞춰 발송한다.
import supabaseAdmin from './supabaseAdmin';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const SUPPORTED_LOCALES = ['vi', 'ko', 'en'];
const DEFAULT_LOCALE = 'vi'; // 1차 시장. locale 미지정/미지원 토큰의 폴백 언어.

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 문자열은 그대로, { vi, ko, en } 맵이면 locale 값을 고른다(없으면 기본 언어).
function localize(field, locale) {
  if (field && typeof field === 'object') {
    return field[locale] ?? field[DEFAULT_LOCALE] ?? '';
  }
  return field;
}

function normLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

// Expo 메시지 배열을 100개씩 끊어 발송하고, DeviceNotRegistered 토큰을 정리한다.
// messages: [{ to, title, body, data, sound }] — title/body는 이미 localize된 문자열.
async function deliver(messages) {
  if (!messages.length) return;

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const invalid = [];
  for (const batch of chunk(messages, 100)) {
    let json;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      json = await res.json();
    } catch (e) {
      console.error('[push] send failed:', e);
      continue;
    }
    // 응답 ticket에서 DeviceNotRegistered 토큰 수집 → 정리.
    const tickets = Array.isArray(json?.data) ? json.data : [];
    tickets.forEach((ticket, i) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        invalid.push(batch[i].to);
      }
    });
  }

  if (invalid.length) {
    await supabaseAdmin.from('push_tokens').delete().in('expo_push_token', invalid);
  }
}

/**
 * 지정 사용자들에게 동일 내용 푸시 발송. 트리거 본 작업을 막지 않도록 절대 throw하지 않는다.
 * @param {string[]} userIds  수신 대상 user_id 목록
 * @param {object} opts
 * @param {string|{vi?:string,ko?:string,en?:string}} opts.title  알림 제목(문자열 또는 언어맵)
 * @param {string|{vi?:string,ko?:string,en?:string}} opts.body   알림 본문(문자열 또는 언어맵)
 * @param {string} opts.category  push_tokens.prefs 키(like|comment|application|company_salary|company_post|daily_hot|marketing)
 * @param {object} [opts.data]  탭 시 딥링크용 데이터(예: { url: '/community/123' })
 */
export async function sendPush(userIds, { title, body, category, data = {} }) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;

    const { data: rows, error } = await supabaseAdmin
      .from('push_tokens')
      .select('expo_push_token, locale, prefs, enabled')
      .in('user_id', ids)
      .eq('enabled', true);
    if (error || !rows?.length) return;

    // 카테고리 opt-out(prefs[category] === false) 제외. 키 없으면 기본 on.
    // 토큰별 locale을 유지해 발송 시 언어를 고른다.
    const messages = rows
      .filter((r) => !category || r.prefs?.[category] !== false)
      .filter((r) => typeof r.expo_push_token === 'string' && r.expo_push_token.startsWith('ExponentPushToken'))
      .map((r) => {
        const locale = normLocale(r.locale);
        return {
          to: r.expo_push_token,
          title: localize(title, locale),
          body: localize(body, locale),
          data,
          sound: 'default',
        };
      });

    await deliver(messages);
  } catch (e) {
    console.error('[push] sendPush error:', e);
  }
}

/**
 * 사용자마다 다른 내용을 한 번에 발송(다이제스트용). 토큰 조회를 1회로 묶는다.
 * 카테고리 필터링은 하지 않는다 — 호출부(예: follow-digest cron)가 prefs를 보고
 * 수신자/본문을 이미 결정했다는 전제. enabled 토큰에만 보내고 throw하지 않는다.
 * @param {Array<{userId:string, title:any, body:any, data?:object}>} items
 */
export async function sendPushBulk(items) {
  try {
    const list = (items || []).filter((it) => it && it.userId && (it.title || it.body));
    if (!list.length) return;

    const userIds = [...new Set(list.map((it) => it.userId))];
    const { data: rows, error } = await supabaseAdmin
      .from('push_tokens')
      .select('user_id, expo_push_token, locale, enabled')
      .in('user_id', userIds)
      .eq('enabled', true);
    if (error || !rows?.length) return;

    // user_id → 유효 토큰 목록(여러 기기 가능).
    const tokensByUser = new Map();
    for (const r of rows) {
      if (typeof r.expo_push_token !== 'string' || !r.expo_push_token.startsWith('ExponentPushToken')) continue;
      const arr = tokensByUser.get(r.user_id) || [];
      arr.push({ token: r.expo_push_token, locale: normLocale(r.locale) });
      tokensByUser.set(r.user_id, arr);
    }

    const messages = [];
    for (const it of list) {
      const toks = tokensByUser.get(it.userId);
      if (!toks) continue;
      for (const { token, locale } of toks) {
        messages.push({
          to: token,
          title: localize(it.title, locale),
          body: localize(it.body, locale),
          data: it.data || {},
          sound: 'default',
        });
      }
    }

    await deliver(messages);
  } catch (e) {
    console.error('[push] sendPushBulk error:', e);
  }
}
