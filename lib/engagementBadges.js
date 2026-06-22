// 참여형(인게이지먼트) 뱃지 카탈로그 — 백엔드 진실원본.
// 우리 기능을 잘 쓰면 자동으로 따지는 누적/연속 달성형. 각 그룹의 최상위는 gold(희귀).
// metric: posts | comments | likes_given | likes_received | applications | streak
// (streak = 연속 출석일. 한 번 달성하면 영구 보유 — 끊겨도 회수하지 않음.)
// 모바일은 같은 key로 비주얼 카탈로그를 따로 갖는다(라벨/아이콘/색/희귀도 문구).
export const ENGAGEMENT_BADGES = [
  { key: 'post_1', metric: 'posts', threshold: 1, gold: false },
  { key: 'post_10', metric: 'posts', threshold: 10, gold: false },
  { key: 'post_100', metric: 'posts', threshold: 100, gold: true },

  { key: 'comment_10', metric: 'comments', threshold: 10, gold: false },
  { key: 'comment_50', metric: 'comments', threshold: 50, gold: false },
  { key: 'comment_500', metric: 'comments', threshold: 500, gold: true },

  { key: 'like_10', metric: 'likes_given', threshold: 10, gold: false },
  { key: 'like_300', metric: 'likes_given', threshold: 300, gold: false },
  { key: 'like_1000', metric: 'likes_given', threshold: 1000, gold: true },

  { key: 'fan_100', metric: 'likes_received', threshold: 100, gold: false },
  { key: 'fan_1000', metric: 'likes_received', threshold: 1000, gold: false },
  { key: 'fan_3000', metric: 'likes_received', threshold: 3000, gold: true },

  { key: 'streak_7', metric: 'streak', threshold: 7, gold: false },
  { key: 'streak_30', metric: 'streak', threshold: 30, gold: false },
  { key: 'streak_100', metric: 'streak', threshold: 100, gold: true },

  { key: 'apply_1', metric: 'applications', threshold: 1, gold: false },
  { key: 'apply_10', metric: 'applications', threshold: 10, gold: false },
  { key: 'apply_50', metric: 'applications', threshold: 50, gold: true },
]

export const ENGAGEMENT_BY_KEY = Object.fromEntries(ENGAGEMENT_BADGES.map(b => [b.key, b]))
export const ENGAGEMENT_KEYS = new Set(ENGAGEMENT_BADGES.map(b => b.key))

export function isEngagementKey(key) {
  return ENGAGEMENT_KEYS.has(key)
}

// metrics({posts, comments, likes_given, likes_received, applications, streak})로
// 달성한 참여형 뱃지 key 배열 반환.
export function earnedEngagementKeys(metrics) {
  return ENGAGEMENT_BADGES
    .filter(b => (metrics[b.metric] || 0) >= b.threshold)
    .map(b => b.key)
}

// 특정 참여형 뱃지를 해당 metrics로 달성했는지.
export function hasEarnedEngagement(key, metrics) {
  const b = ENGAGEMENT_BY_KEY[key]
  return !!b && (metrics[b.metric] || 0) >= b.threshold
}
