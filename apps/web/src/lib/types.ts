export type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  username: string;
  xp: number;
  level: number;
  role: Role;
}

/** The editable profile fields, as stored — any of them may be unset. */
export interface ProfileFields {
  name: string | null;
  imageUrl: string | null;
  age: number | null;
  profession: string | null;
}

export interface Profile extends User, ProfileFields {
  isVerified: boolean;
  lastUsernameChangedAt: string | null;
  /** Whole days until the username may change again; 0 means "right now". */
  usernameChangeableIn: number;
  createdAt: string;
}

export interface Me extends User, ProfileFields {
  isVerified: boolean;
  lastUsernameChangedAt: string | null;
  createdAt: string;
  tier: 'free' | 'starter' | 'pro' | 'elite';
  renewsAt: string | null;
  progress: { level: number; xpIntoLevel: number; xpForNextLevel: number };
  stats: { totalCompletions: number; bestStreak: number };
  ai: { used: number; limit: number | null };
}

/** Signup no longer returns a session — the account is inert until verified. */
export interface PendingVerification {
  status: 'verification_required';
  email: string;
  message: string;
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
  /** True for your own posts, and for every post when you are an admin. */
  canDelete: boolean;
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

/** A roadmap as persisted — survives a refresh, unlike the generated response. */
export interface SavedRoadmap {
  id: string;
  goal: string;
  createdAt: string;
  plan: Roadmap;
}
