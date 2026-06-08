// Expo 푸시 발송 헬퍼 — 모바일 앱(salary-fyi)이 등록한 토큰으로 알림을 보낸다.
// 토큰/선호는 push_tokens 테이블(user_id, expo_push_token, prefs jsonb, enabled).
// 카테고리별 선호(prefs[category] !== false)와 enabled를 서버에서 필터링한 뒤 전송한다.
import supabaseAdmin from './supabaseAdmin';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 지정 사용자들에게 푸시 발송. 트리거 본 작업을 막지 않도록 절대 throw하지 않는다.
 * @param {string[]} userIds  수신 대상 user_id 목록
 * @param {object} opts
 * @param {string} opts.title  알림 제목
 * @param {string} opts.body   알림 본문
 * @param {string} opts.category  push_tokens.prefs 키(like|comment|application|daily_hot|marketing)
 * @param {object} [opts.data]  탭 시 딥링크용 데이터(예: { url: '/community/123' })
 */
export async function sendPush(userIds, { title, body, category, data = {} }) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;

    const { data: rows, error } = await supabaseAdmin
      .from('push_tokens')
      .select('expo_push_token, prefs, enabled')
      .in('user_id', ids)
      .eq('enabled', true);
    if (error || !rows?.length) return;

    // 카테고리 opt-out(prefs[category] === false) 제외. 키 없으면 기본 on.
    const tokens = rows
      .filter((r) => !category || r.prefs?.[category] !== false)
      .map((r) => r.expo_push_token)
      .filter((tk) => typeof tk === 'string' && tk.startsWith('ExponentPushToken'));
    if (!tokens.length) return;

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const invalid = [];
    for (const batch of chunk(tokens, 100)) {
      const messages = batch.map((to) => ({ to, title, body, data, sound: 'default' }));
      let json;
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(messages),
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
          invalid.push(batch[i]);
        }
      });
    }

    if (invalid.length) {
      await supabaseAdmin.from('push_tokens').delete().in('expo_push_token', invalid);
    }
  } catch (e) {
    console.error('[push] sendPush error:', e);
  }
}
