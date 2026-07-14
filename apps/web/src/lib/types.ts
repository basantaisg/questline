export interface User {
  id: string;
  email: string;
  username: string;
  xp: number;
  level: number;
}

export interface Me extends User {
  tier: 'free' | 'starter' | 'pro' | 'elite';
  renewsAt: string | null;
  progress: { level: number; xpIntoLevel: number; xpForNextLevel: number };
  stats: { totalCompletions: number; bestStreak: number };
  ai: { used: number; limit: number | null };
}

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: 'daily' | 'weekly';
  xpReward: number;
  color: 'cyan' | 'magenta' | 'lime' | 'amber';
  archived: boolean;
  streak: number;
  longestStreak: number;
  doneThisPeriod: boolean;
  lastCompletedOn: string | null;
}

export interface CompleteResult {
  xpAwarded: number;
  penalty: number;
  streakBroken: boolean;
  streak: number;
  longestStreak: number;
  milestone: number | null;
  totalXp: number;
  leveledUp: boolean;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export type ReactionType = 'salute' | 'fire' | 'keep_going';

export interface Post {
  id: string;
  type: 'quote' | 'milestone';
  content: string;
  createdAt: string;
  author: string;
  authorLevel: number;
  mine: boolean;
  reactions: Record<ReactionType, number>;
  myReactions: ReactionType[];
}

export interface Payment {
  id: string;
  tier: 'starter' | 'pro' | 'elite';
  currency: 'btc' | 'eth' | 'sol' | 'usdt';
  amountUsd: number;
  amountCrypto: string;
  address: string;
  txHash: string | null;
  status: 'pending' | 'confirmed' | 'expired';
  expiresAt: string;
}

export interface Roadmap {
  title: string;
  summary: string;
  days: { day: number; theme: string; tasks: string[] }[];
  suggestedHabits: { name: string; frequency: 'daily' | 'weekly'; xpReward: number }[];
}
