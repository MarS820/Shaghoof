// Shared badge tier definitions — single source of truth.
// Each tier has an XP threshold, display names (EN/AR), and a badge image.

export const BADGE_TIERS = [
  { xp: 0, name: 'First Spark', ar: 'البداية', image: '/brand/badge-1.png' },
  { xp: 250, name: 'Explorer', ar: 'المستكشف', image: '/brand/badge-2.png' },
  { xp: 650, name: 'Determined', ar: 'المثابر', image: '/brand/badge-3.png' },
  { xp: 1200, name: 'Habit Builder', ar: 'صانع العادات', image: '/brand/badge-4.png' },
  { xp: 2000, name: 'Learning Star', ar: 'نجم التعلم', image: '/brand/badge-5.png' },
  { xp: 3200, name: 'Skill Captain', ar: 'قائد المهارة', image: '/brand/badge-6.png' },
  { xp: 4800, name: 'Knowledge Mage', ar: 'ساحر المعرفة', image: '/brand/badge-7.png' },
  { xp: 7000, name: 'Shaghoof Legend', ar: 'أسطورة شغوف', image: '/brand/badge-8.png' },
  { xp: 10000, name: 'Learning Hero', ar: 'بطل التعلم', image: '/brand/badge-9.png' },
]

/** Get the current badge tier for a given XP value. */
export function getCurrentBadge(xp) {
  return [...BADGE_TIERS].reverse().find((t) => xp >= t.xp) || BADGE_TIERS[0]
}

/** Get the next badge tier to unlock, or null if maxed. */
export function getNextBadge(xp) {
  return BADGE_TIERS.find((t) => t.xp > xp) || null
}

/** Get badge tier name for a given XP, in the specified language. */
export function getBadgeName(xp, lang = 'en', arabic = false) {
  const tier = getCurrentBadge(xp)
  return arabic ? tier.ar : tier.name
}
