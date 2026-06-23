// 인앱 알림 적재 헬퍼 — 푸시(lib/push.js sendPush)를 보내는 자리 옆에서 호출해
// notifications 테이블에 같은 알림을 1건 쌓는다(홈 종 아이콘 → 알림함에서 모아 보기).
// 푸시처럼 트리거 본 작업을 막지 않도록 절대 throw하지 않는다(실패는 로깅만).
import supabaseAdmin from './supabaseAdmin';

/**
 * 알림 1건 적재. 자기 자신 알림 가드(userId === actorId)는 호출부에서 이미 하는 전제지만
 * 한 번 더 막는다. data는 모바일 routeFromNotification이 쓰는 딥링크 payload(푸시와 동일).
 * @param {object} n
 * @param {string} n.userId        수신자 user_id (필수)
 * @param {string} [n.actorId]     행위자 user_id (공지는 생략)
 * @param {string|null} [n.actorName] 표시용 이름(익명/시스템이면 null → 클라가 "누군가")
 * @param {string} n.type          'comment' | 'like' | 'follow' | 'announcement'
 * @param {string} [n.postId]
 * @param {string} [n.commentId]
 * @param {string|null} [n.body]   미리보기 텍스트(댓글 스니펫 등)
 * @param {object} [n.data]        탭 딥링크 payload(예: { url: '/community/123' } | { user: '<id>' })
 */
export async function createNotification({ userId, actorId = null, actorName = null, type, postId = null, commentId = null, body = null, data = {} }) {
  try {
    if (!userId || !type) return;
    if (actorId && actorId === userId) return; // 자기 행동은 알림 안 함

    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      actor_id: actorId,
      actor_name: actorName,
      type,
      post_id: postId,
      comment_id: commentId,
      body,
      data: data || {},
    });
    if (error) console.error('[notify] insert failed:', error.message);
  } catch (e) {
    console.error('[notify] createNotification error:', e);
  }
}
