/**
 * XP curve: total XP required to *reach* a level.
 * Level 1 = 0 XP, level 2 = 100 XP, level 3 = ~283 XP, level 5 = 800 XP...
 */
export const totalXpForLevel = (level: number): number =>
  Math.round(100 * Math.pow(level - 1, 1.5));

export const levelFromXp = (xp: number): number => {
  let level = 1;
  while (totalXpForLevel(level + 1) <= xp) level++;
  return level;
};

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export const levelProgress = (xp: number): LevelProgress => {
  const level = levelFromXp(xp);
  const current = totalXpForLevel(level);
  const next = totalXpForLevel(level + 1);
  return { level, xpIntoLevel: xp - current, xpForNextLevel: next - current };
};

/** XP removed when a streak is broken. */
export const STREAK_BREAK_PENALTY = 15;

/** Streak lengths that trigger an auto-shared milestone post. */
export const MILESTONES = [7, 14, 30, 50, 100, 365];

/** Bonus XP per completion: +1 per streak day, capped. */
export const streakBonus = (streak: number): number => Math.min(streak, 10);
