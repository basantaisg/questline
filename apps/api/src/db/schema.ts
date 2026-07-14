import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { RoadmapPlan } from '../common/roadmap';

export const tierEnum = pgEnum('tier', ['free', 'starter', 'pro', 'elite']);
export const roleEnum = pgEnum('role', ['user', 'admin']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'confirmed', 'expired']);
export const cryptoCurrencyEnum = pgEnum('crypto_currency', ['btc', 'eth', 'sol', 'usdt']);
export const frequencyEnum = pgEnum('frequency', ['daily', 'weekly']);
export const postTypeEnum = pgEnum('post_type', ['quote', 'milestone']);
export const reactionEnum = pgEnum('reaction_type', ['salute', 'fire', 'keep_going']);
export const otpPurposeEnum = pgEnum('otp_purpose', ['signup', 'password_change']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('user'),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),

  // --- Profile ---
  name: varchar('name', { length: 80 }),
  imageUrl: text('image_url'),
  age: integer('age'),
  profession: varchar('profession', { length: 80 }),
  /** Null until the first username change; drives the 14-day cooldown. */
  lastUsernameChangedAt: timestamp('last_username_changed_at'),

  // --- Email verification / OTP ---
  isVerified: boolean('is_verified').notNull().default(false),
  /** SHA-256 of the 6-digit code, never the code itself. */
  otpCode: text('otp_code'),
  otpExpiresAt: timestamp('otp_expires_at'),
  /** What the pending code authorizes — a signup code cannot change a password. */
  otpPurpose: otpPurposeEnum('otp_purpose'),
  /** Wrong guesses against the pending code; caps online brute force. */
  otpAttempts: integer('otp_attempts').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  tier: tierEnum('tier').notNull().default('free'),
  renewsAt: timestamp('renews_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tier: tierEnum('tier').notNull(),
    currency: cryptoCurrencyEnum('currency').notNull(),
    amountUsd: integer('amount_usd').notNull(),
    // Crypto amounts kept as text to avoid float precision loss.
    amountCrypto: varchar('amount_crypto', { length: 32 }).notNull(),
    address: varchar('address', { length: 128 }).notNull(),
    txHash: varchar('tx_hash', { length: 128 }),
    status: paymentStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at').notNull(),
    confirmedAt: timestamp('confirmed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('payments_user_idx').on(t.userId, t.createdAt)],
);

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    description: text('description'),
    frequency: frequencyEnum('frequency').notNull().default('daily'),
    xpReward: integer('xp_reward').notNull().default(10),
    color: varchar('color', { length: 16 }).notNull().default('cyan'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('habits_user_idx').on(t.userId)],
);

export const habitCompletions = pgTable(
  'habit_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    completedOn: date('completed_on').notNull(),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('completion_once_per_day').on(t.habitId, t.completedOn),
    index('completions_user_idx').on(t.userId),
  ],
);

export const streaks = pgTable('streaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitId: uuid('habit_id')
    .notNull()
    .unique()
    .references(() => habits.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  current: integer('current').notNull().default(0),
  longest: integer('longest').notNull().default(0),
  lastCompletedOn: date('last_completed_on'),
});

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: postTypeEnum('type').notNull().default('quote'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('posts_created_idx').on(t.createdAt)],
);

export const postReactions = pgTable(
  'post_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: reactionEnum('type').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('one_reaction_per_type').on(t.postId, t.userId, t.type)],
);

export const aiUsageLogs = pgTable(
  'ai_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 32 }).notNull(),
    model: varchar('model', { length: 64 }).notNull(),
    promptChars: integer('prompt_chars').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('ai_usage_user_idx').on(t.userId, t.createdAt)],
);

/**
 * Every generated roadmap is kept: a generation burns a metered AI prompt, so
 * losing it on refresh would cost the user something they paid for.
 */
export const roadmaps = pgTable(
  'roadmaps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goal: varchar('goal', { length: 500 }).notNull(),
    plan: jsonb('plan').$type<RoadmapPlan>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('roadmaps_user_idx').on(t.userId, t.createdAt)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revoked: boolean('revoked').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('refresh_user_idx').on(t.userId)],
);
