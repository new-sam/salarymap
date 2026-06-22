// 뱃지 비주얼 카탈로그 — 웹 진실원본(프로필 뱃지 탭 + 커뮤니티 author 줄이 같은 key로 렌더).
// 모바일 src/lib/badge-visuals.ts의 웹 포팅. key/threshold/gold는 lib/salaryTiers,
// lib/engagementBadges(백엔드와 공유)에서 가져오고, 여기서는 색/아이콘/희귀도 표시만 얹는다.
//  - 일반(gold:false): 그룹 시그니처 색. 골드(gold:true): 각 그룹 최상위, 골드 그라데이션 + 희귀도.
//  - 잠금 상태는 색을 쓰지 않고 회색으로(렌더 쪽에서 처리). 획득 시에만 colors 적용.
import { SALARY_TIERS } from './salaryTiers'
import { ENGAGEMENT_BADGES } from './engagementBadges'

const GOLD = ['#fde68a', '#f59e0b'] // 골드 공통 그라데이션

// 그룹 시그니처 색(일반 뱃지 획득 시).
const C = {
  applications: ['#34d399', '#059669'],
  posts: ['#60a5fa', '#2563eb'],
  comments: ['#2dd4bf', '#0d9488'],
  likes_received: ['#fb7185', '#e11d48'],
  likes_given: ['#818cf8', '#4f46e5'],
  streak: ['#fb923c', '#ea580c'],
}

// 그룹별 아이콘(components/Badge.js의 BadgeIcon name과 매칭).
const GROUP_ICON = {
  applications: 'paperplane',
  posts: 'pencil',
  comments: 'bubbles',
  likes_received: 'heart',
  likes_given: 'thumbsup',
  streak: 'flame',
}

// 연봉 등급(기존). 상위 3개는 골드(희귀도 표시), 하위 2개는 일반.
const SALARY_VISUAL = {
  nghindo: { colors: ['#60a5fa', '#2563eb'], icon: 'rosette', gold: false },
  nghindo2: { colors: ['#a78bfa', '#7c3aed'], icon: 'medal', gold: false },
  tienty: { colors: ['#fbbf24', '#d97706'], icon: 'crown', gold: true, rarityPct: '2%' },
  tienty2: { colors: ['#fb7185', '#be123c'], icon: 'crown', gold: true, rarityPct: '0.5%' },
  tienty3: { colors: ['#67e8f9', '#8b5cf6'], icon: 'diamond', gold: true, rarityPct: '0.1%' },
}

// 참여형 골드 뱃지 희귀도(각 그룹 최상위).
const ENG_RARITY = {
  apply_50: '3%', post_100: '2%', comment_500: '1%', fan_3000: '0.5%', like_1000: '2%', streak_100: '0.3%',
}

const SALARY = SALARY_TIERS.map(t => ({
  key: t.key, group: 'salary', ...SALARY_VISUAL[t.key],
}))

const ENGAGEMENT = ENGAGEMENT_BADGES.map(b => ({
  key: b.key, group: b.metric === 'applications' ? 'applications' : b.metric,
  gold: b.gold, metric: b.metric, threshold: b.threshold,
  icon: GROUP_ICON[b.metric === 'applications' ? 'applications' : b.metric],
  colors: b.gold ? GOLD : C[b.metric === 'applications' ? 'applications' : b.metric],
  rarityPct: b.gold ? ENG_RARITY[b.key] : undefined,
}))

export const BADGE_VISUALS = [...SALARY, ...ENGAGEMENT]
export const BADGE_BY_KEY = Object.fromEntries(BADGE_VISUALS.map(b => [b.key, b]))

// 연봉 등급 사다리(낮은→높은).
export const TIER_LADDER = SALARY_TIERS.map(t => t.key)

// 뱃지 탭에 노출할 참여형 그룹 순서.
export const ENGAGEMENT_GROUPS = ['applications', 'posts', 'comments', 'likes_received', 'likes_given', 'streak']

// 그룹별 참여형 뱃지(순서 유지).
export function engagementBadgesByGroup(group) {
  return ENGAGEMENT.filter(b => b.group === group)
}

export function badgeVisual(key) {
  return key ? BADGE_BY_KEY[key] || null : null
}

// 대표로 "장착" 가능한 뱃지 — 연봉 등급 전체 + 골드(각 그룹 최상위)만. 일반 참여형은 컬렉션 전용.
export function isEquippable(key) {
  const v = BADGE_BY_KEY[key]
  return !!v && (v.group === 'salary' || v.gold)
}
